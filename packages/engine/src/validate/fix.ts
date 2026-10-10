// Deterministic repairs `check` applies BEFORE the rules (engine-port §5.2 "repair" column). Each mutates the lesson
// in place and returns what it did ({rule, detail}); ids are never changed and no item is ever deleted.
import type { Assessment, Block, Chunk, LessonContent } from '@bilimind/core';
import { codeTests, isDisabledCode } from './code.ts';
import { blockNo, codeItemOf, liveItems as allLive, narrativeTexts } from './lesson.ts';
import type { Raw } from './lesson.ts';
import { sweepFormula, formulaProblem } from './playground.ts';
import { mermaidProblem } from './mermaid.ts';
import { LANG_RE, MULTI_COUNT, MULTI_HINT, RULE, blanksIn, mcqAllowance, mcqLeak, playgroundInputs } from './rules.ts';
import { buildIndex } from '../retrieve.ts';
import type { RetrievalIndex } from '../contracts.ts';
import { dominantDeck, isFrontMatter, resolveMentions } from '../sources.ts';
import type { CheckContext } from './rules.ts';

export interface Fix { rule: string; detail: string }
type Fixer = (lesson: LessonContent, cx: CheckContext) => Fix[];

/** Live items with a usable prompt (a broken item is reported by Q0 schema, never repaired blindly). */
const liveItems = (lesson: LessonContent) => allLive(lesson).filter(r => typeof r.item.prompt === 'string');
const where = (b: Block, a?: Assessment) => (a ? `${a.id}` : `b${blockNo(b) ?? '?'}`);

/** mcq -> short_answer that keeps the question: the learner must produce the answer instead of recognising it. */
export function demoteToShortAnswer(a: Assessment, referenceAnswer: string): void {
  a.kind = 'short_answer';
  delete a.options;
  a.answer_key = referenceAnswer ? { reference_answer: referenceAnswer } : {};
  a.grader = Array.isArray(a.rubric) && a.rubric.length ? 'llm_rubric' : 'self';
}
const correctText = (a: Assessment) => (a.options ?? []).find(o => o.id === a.answer_key?.correct_option_ids?.[0])?.text ?? '';

const fixMcqLeak: Fixer = lesson => {
  const out: Fix[] = [];
  for (const { item } of liveItems(lesson)) {
    if (item.kind !== 'mcq') continue;
    const leak = mcqLeak(item);
    if (!leak) continue;
    demoteToShortAnswer(item, leak);
    out.push({ rule: RULE.mcq, detail: `${item.id}: the correct option was written in the prompt; demoted mcq to short_answer` });
  }
  return out;
};

const fixMcqCap: Fixer = lesson => {
  const items = liveItems(lesson).map(r => r.item);
  const mcqs = items.filter(a => a.kind === 'mcq');
  const allowed = mcqAllowance(items.length);
  return mcqs.slice(allowed).map(a => {
    demoteToShortAnswer(a, correctText(a));
    return { rule: RULE.mcqCap, detail: `${a.id}: demoted mcq to short_answer (over the 40% MCQ cap, ${allowed} allowed of ${items.length})` };
  });
};

const COUNT_WORDS: Record<string, number> = { two: 2, three: 3, four: 4, '2': 2, '3': 3, '4': 4 };
const fixMulti: Fixer = lesson => {
  const out: Fix[] = [];
  for (const { item } of liveItems(lesson)) {
    if (item.kind !== 'multi_select') continue;
    // G2 review: "Which two statements..." with three correct ids cannot be scored by a student who follows the prompt
    const m = MULTI_COUNT.exec(item.prompt);
    const correct = item.answer_key?.correct_option_ids?.length ?? 0;
    if (m && COUNT_WORDS[m[2]!.toLowerCase()] !== correct) {
      item.prompt = item.prompt.replace(MULTI_COUNT, (_all, verb: string) => verb).replace(/\s{2,}/g, ' ');
      out.push({ rule: RULE.multi, detail: `${item.id}: the prompt said "${m[0]}" but ${correct} options are correct; dropped the count` });
    }
    if (!MULTI_HINT.test(item.prompt)) {
      item.prompt = `${item.prompt.trimEnd()} (Select all that apply.)`;
      out.push({ rule: RULE.multi, detail: `${item.id}: added "(Select all that apply.)" to the prompt` });
    }
  }
  return out;
};

/** G2 review: a quiz intro written at draft time ("Four items. Two of them...") goes stale when an item is excluded. */
const COUNT_SENTENCE = /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(items?|questions?|of them|of these)\b/i;
const fixQuizIntro: Fixer = lesson => {
  const out: Fix[] = [];
  for (const b of lesson.blocks.filter(x => x.type === 'quiz')) {
    const p = (b.payload ?? {}) as Raw;
    if (typeof p.intro !== 'string' || !COUNT_SENTENCE.test(p.intro)) continue;
    const kept = p.intro.split(/(?<=[.!?])\s+/).filter(sn => !COUNT_SENTENCE.test(sn)).join(' ').trim();
    if (kept) p.intro = kept; else delete p.intro;
    out.push({ rule: RULE.count, detail: `${where(b)}: removed the item count from the quiz intro (it is shown live)` });
  }
  return out;
};

/** The lesson's lecture chunks: everything cx knows except past papers and front matter. */
function lectureChunksOf(cx: CheckContext): Chunk[] {
  if (!cx.chunks) return [];
  const paper = new Set([...cx.files.values()].filter(f => f.role === 'past_paper' || f.role === 'other').map(f => f.material_id));
  return [...cx.chunks.values()].filter(c => !paper.has(c.material_id) && !isFrontMatter(c));
}
const lessonDecks = (lesson: LessonContent, cx: CheckContext): Chunk[] =>
  lesson.blocks.flatMap(b => (b.source_material_ids ?? []).map(id => cx.chunks?.get(id)).filter((c): c is Chunk => !!c));

/** G2 review: prose that says "slide 7" cites slide 7's chunk, so the chip and the Checker's evidence cover it. */
const fixSlideMentionCites: Fixer = (lesson, cx) => {
  if (!cx.chunks) return [];
  const pool = lectureChunksOf(cx);
  const deck = dominantDeck(lessonDecks(lesson, cx));
  const out: Fix[] = [];
  for (const b of lesson.blocks) {
    const own = (b.source_material_ids ?? []).map(id => cx.chunks!.get(id)).filter((c): c is Chunk => !!c);
    const text = narrativeTexts(b).join('\n');
    const found = resolveMentions(text, pool, [...cx.files.values()], dominantDeck(own) ?? deck);
    const add = found.map(f => f.chunk.id).filter(id => !(b.source_material_ids ?? []).includes(id));
    if (!add.length) continue;
    b.source_material_ids = [...(b.source_material_ids ?? []), ...add];
    out.push({ rule: RULE.cites, detail: `${where(b)}: the prose names ${found.filter(f => add.includes(f.chunk.id)).map(f => `slide ${f.mention.n}`).join(', ')}; cited chunk${add.length === 1 ? '' : 's'} ${add.join(', ')}` });
  }
  return out;
};

const DETERMINISTIC = new Set(['mcq', 'multi_select', 'ordering', 'numeric', 'cloze']);
const indexCache = new WeakMap<Map<number, Chunk>, RetrievalIndex>();
/** The words of an item's accepted answer, for retrieval. */
function answerText(a: Assessment): string {
  const k = (a.answer_key ?? {}) as Raw;
  const opt = (id: unknown) => (a.options ?? []).find(o => o.id === id)?.text ?? '';
  if (Array.isArray(k.correct_option_ids)) return k.correct_option_ids.map(opt).join(' ');
  if (Array.isArray(k.accepted)) return (k.accepted as unknown[]).map(String).join(' ');
  if (typeof k.value === 'number') return String(k.value);
  return '';
}
/**
 * G2 review: every deterministic item gets an item-level cite: minisearch over the lecture chunks with the prompt and
 * the correct answer, preferring the lesson's own decks; no hit above the floor = no cite (the Checker may rule it
 * beyond the slides).
 */
const fixItemCites: Fixer = (lesson, cx) => {
  if (!cx.chunks) return [];
  const pool = lectureChunksOf(cx);
  if (!pool.length) return [];
  let idx = indexCache.get(cx.chunks);
  if (!idx) { idx = buildIndex(pool); indexCache.set(cx.chunks, idx); }
  const decks = new Set(lessonDecks(lesson, cx).map(c => c.material_id));
  const out: Fix[] = [];
  for (const { item, block } of liveItems(lesson)) {
    if (!DETERMINISTIC.has(item.kind) || (item.cite_chunk_ids ?? []).length) continue;
    const hits = idx.search(`${item.prompt} ${answerText(item)} ${answerText(item)}`, 8).filter(h => !isFrontMatter(h.chunk));
    if (!hits.length) continue;
    const top = hits[0]!;
    const own = new Set(block.source_material_ids ?? []);
    const pick = hits.find(h => own.has(h.chunk.id) && h.score >= top.score * 0.6)
      ?? hits.find(h => decks.has(h.chunk.material_id) && h.score >= top.score * 0.6) ?? top;
    if ((pick.terms?.length ?? 0) < 3) continue;          // score floor: at least 3 query terms in the chunk
    item.cite_chunk_ids = [pick.chunk.id];
    out.push({ rule: RULE.itemCites, detail: `${item.id}: cited chunk ${pick.chunk.id} (${pick.chunk.locator ?? 'part ' + pick.chunk.ordinal}), found by its question and answer` });
  }
  return out;
};

const fixOrdering: Fixer = lesson => {
  const out: Fix[] = [];
  for (const { item } of liveItems(lesson)) {
    if (item.kind !== 'ordering' || !item.options || item.options.length < 2) continue;
    const order = item.answer_key?.correct_order ?? [];
    if (item.options.map(o => o.id).join() !== order.join()) continue;
    item.options = [...item.options.slice(1), item.options[0]!];
    out.push({ rule: RULE.ordering, detail: `${item.id}: options were shown in the correct order; rotated them` });
  }
  return out;
};

const fixCloze: Fixer = lesson => {
  const out: Fix[] = [];
  for (const { item } of liveItems(lesson)) {
    if (item.kind !== 'cloze') continue;
    const blanks = blanksIn(item.prompt);
    if (blanks.some(b => b.length !== 4)) {
      item.prompt = item.prompt.replace(/_{3,}/g, '____');
      out.push({ rule: RULE.cloze, detail: `${item.id}: normalised the blank to ____` });
    }
    if (!blanks.length) {
      const acc = item.answer_key?.accepted ?? [];
      demoteToShortAnswer(item, acc[0] ?? '');
      out.push({ rule: RULE.cloze, detail: `${item.id}: cloze prompt had no blank; converted to short_answer` });
    }
  }
  return out;
};

const fixNumeric: Fixer = lesson => {
  const out: Fix[] = [];
  for (const { item } of liveItems(lesson)) {
    if (item.kind !== 'numeric' || !item.answer_key) continue;
    const k = item.answer_key;
    if (typeof k.value === 'number' && Number.isFinite(k.value) && !Number.isInteger(k.value) && !(typeof k.tolerance === 'number' && k.tolerance > 0)) {
      k.tolerance = Math.max(0.01, Math.round(Math.abs(k.value) * 0.01 * 1e6) / 1e6);
      out.push({ rule: RULE.numeric, detail: `${item.id}: set tolerance ${k.tolerance} for a non-integer answer` });
    }
    // a pseudo-unit ("dimensionless", "none", "n/a", "units") is not a unit: drop it rather than say "answer in dimensionless"
    if (typeof k.unit === 'string' && /^\s*(dimensionless|unitless|no units?|none|n\/?a|-|units?)\s*$/i.test(k.unit)) {
      k.unit = null;
      item.prompt = item.prompt.replace(/\s*Give your answer in (dimensionless|unitless|no units?|none|n\/?a|-|units?)\.\s*$/i, '');
      out.push({ rule: RULE.numeric, detail: `${item.id}: dropped the pseudo-unit` });
    }
    if (typeof k.unit === 'string' && k.unit.trim() && !item.prompt.toLowerCase().includes(k.unit.trim().toLowerCase())) {
      item.prompt = `${item.prompt.trimEnd()} Give your answer in ${k.unit.trim()}.`;
      out.push({ rule: RULE.numeric, detail: `${item.id}: the prompt now names the unit (${k.unit.trim()})` });
    }
  }
  return out;
};

const fixRubric: Fixer = lesson => {
  const out: Fix[] = [];
  for (const { item } of liveItems(lesson)) {
    const rows = item.rubric;
    if (!Array.isArray(rows) || !rows.length) continue;
    const w = rows.map(r => (typeof r.weight === 'number' && r.weight > 0 ? r.weight : 0));
    const sum = w.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) <= 0.01) continue;
    rows.forEach((r, i) => { r.weight = sum > 0 ? Math.round((w[i]! / sum) * 1000) / 1000 : Math.round(1000 / rows.length) / 1000; });
    out.push({ rule: RULE.rubric, detail: `${item.id}: normalised rubric weights to sum to 1` });
  }
  return out;
};

const fixCodeTestNames: Fixer = lesson => {
  const out: Fix[] = [];
  for (const b of lesson.blocks.filter(x => x.type === 'code')) {
    const item = codeItemOf(b);
    if (!item || isDisabledCode(b)) continue;
    const names = codeTests(b).map(t => t.name);
    const key = (item.answer_key ??= {});
    if (JSON.stringify(key.tests ?? []) === JSON.stringify(names)) continue;
    key.tests = names;
    out.push({ rule: RULE.code, detail: `${item.id}: answer_key.tests now lists the block's ${names.length} test names` });
  }
  return out;
};

const fixPlaygroundOrder: Fixer = lesson => {
  const out: Fix[] = [];
  for (const b of lesson.blocks.filter(x => x.type === 'playground')) {
    const p = (b.payload ?? {}) as Raw;
    const inputs = playgroundInputs(p);
    const formula = typeof p.formula_js === 'string' ? p.formula_js : '';
    if (inputs.length < 2 || !formulaProblem(formula, inputs.map(i => i.key)).ok) continue;
    const first = sweepFormula(formula, inputs, 0);
    if (first.error || !first.constant) continue;
    const better = inputs.findIndex((_, i) => i > 0 && (() => { const sw = sweepFormula(formula, inputs, i); return !sw.error && sw.finite && !sw.constant; })());
    if (better < 0) continue;
    const raw = p.inputs as unknown[];
    p.inputs = [raw[better], ...raw.filter((_, i) => i !== better)];
    out.push({ rule: RULE.playground, detail: `${where(b)}: moved input \`${inputs[better]!.key}\` first (the sparkline sweeps input 1, which did not change the output)` });
  }
  return out;
};

const fixCiteIds: Fixer = (lesson, cx) => {
  if (!cx.chunks) return [];
  const out: Fix[] = [];
  // unknown ids, and front matter (title / learning-outcomes / references slides are never evidence: G2 review)
  const keep = (ids: unknown) => (Array.isArray(ids) ? ids.filter(id => typeof id === 'number' && cx.chunks!.has(id) && !isFrontMatter(cx.chunks!.get(id)!)) : ids);
  for (const b of lesson.blocks) {
    if (Array.isArray(b.source_material_ids)) {
      const before = b.source_material_ids.length;
      b.source_material_ids = keep(b.source_material_ids) as number[];
      if (b.source_material_ids.length !== before) out.push({ rule: RULE.cites, detail: `${where(b)}: removed ${before - b.source_material_ids.length} chunk id(s) that are not in crew/ingest.json` });
    }
    for (const a of b.assessments ?? []) {
      if (!Array.isArray(a.cite_chunk_ids)) continue;
      const before = a.cite_chunk_ids.length;
      a.cite_chunk_ids = keep(a.cite_chunk_ids) as number[];
      if (a.cite_chunk_ids.length !== before) out.push({ rule: RULE.cites, detail: `${a.id}: removed ${before - a.cite_chunk_ids.length} unknown chunk id(s)` });
    }
  }
  return out;
};

/** Removes URLs, keeping link text: [text](https://x) -> text, <https://x> and bare URLs -> removed. */
export function stripUrls(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\(\s*https?:\/\/[^)]*\)/gi, '$1')
    .replace(/<https?:\/\/[^>]*>/gi, '')
    .replace(/\(\s*https?:\/\/[^\s)]*\s*\)/gi, '')
    .replace(/https?:\/\/[^\s)\]>"']+/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([.,;:])/g, '$1');
}
const deepStrip = (v: unknown): unknown => {
  if (typeof v === 'string') return /https?:\/\//i.test(v) ? stripUrls(v) : v;
  if (Array.isArray(v)) return v.map(deepStrip);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepStrip(x)]));
  return v;
};
const fixUrls: Fixer = lesson => {
  const out: Fix[] = [];
  for (const b of lesson.blocks) {
    const before = JSON.stringify(b.payload);
    if (!/https?:\/\//i.test(before)) continue;
    b.payload = deepStrip(b.payload) as Raw;
    out.push({ rule: RULE.urls, detail: `${where(b)}: removed URL(s) from the ${b.type} payload, kept the text` });
  }
  return out;
};

const fixLanguage: Fixer = lesson => {
  const out: Fix[] = [];
  const spoken = lesson.blocks.filter(b => ['speaking', 'dialogue', 'audio'].includes(b.type));
  const known = spoken.map(b => String(((b.payload ?? {}) as Raw).language ?? '').trim()).find(l => LANG_RE.test(l));
  for (const b of spoken) {
    const p = (b.payload ??= {}) as Raw;
    const lang = typeof p.language === 'string' ? p.language.trim() : '';
    if (LANG_RE.test(lang)) continue;
    const first = lang.split(/[\s,;/|+]+/).map(x => x.trim()).find(x => LANG_RE.test(x));
    const pick = first ?? known;
    if (!pick) continue;
    p.language = pick;
    out.push({ rule: RULE.language, detail: `${where(b)}: set ${b.type} language to ${pick}${lang ? ` (was "${lang}")` : ''}` });
  }
  return out;
};

/** Q13: an implausible Mermaid diagram is dropped (the player could only show its alt text); Q1 then asks for a new one if it was mandatory. */
const fixDiagram: Fixer = lesson => {
  const out: Fix[] = [];
  lesson.blocks = lesson.blocks.filter(b => {
    if (b.type !== 'diagram' || (b.assessments ?? []).length) return true;
    const p = (b.payload ?? {}) as Raw;
    const why = p.format !== undefined && p.format !== 'mermaid' ? `format ${String(p.format)}` : mermaidProblem(typeof p.source === 'string' ? p.source : '');
    if (!why) return true;
    out.push({ rule: RULE.diagram, detail: `${where(b)}: dropped an implausible Mermaid diagram (${why}); re-draft it with \`draft --only diagram\` if it was mandatory` });
    return false;
  });
  return out;
};

/** In order: leaks before the cap (a leaked mcq is demoted anyway), then the rest. */
export const FIXERS: Fixer[] = [fixMcqLeak, fixMcqCap, fixMulti, fixOrdering, fixCloze, fixNumeric, fixRubric, fixCodeTestNames,
  fixPlaygroundOrder, fixCiteIds, fixSlideMentionCites, fixItemCites, fixQuizIntro, fixUrls, fixLanguage, fixDiagram];

export const autoFix = (lesson: LessonContent, cx: CheckContext): Fix[] => FIXERS.flatMap(f => f(lesson, cx));

// `check` rules Q0-Q17 (engine-port §5.2) as PURE functions: (lesson, cx) -> Check[]. One passing row per subject
// (the lesson, a block or an item) or one failing row per problem, each with a detail and a suggestion the Writer can
// act on. Deterministic repairs live in fix.ts and run BEFORE these rules, so a repaired fault shows up as passed.
import { AssessmentItemSchema, HIGHER_ORDER, isEnabledType, mandatoryFormats, payloadIssues } from '@bilimind/core';
import type { Archetype, Assessment, Block, Check, Chunk, LessonContent, SourceFile } from '@bilimind/core';
import { mermaidProblem } from './mermaid.ts';
import { formulaProblem, sweepFormula } from './playground.ts';
import type { PlaygroundInput } from './playground.ts';
import { testCodeBlock } from './code.ts';
import { workProblems } from './arith.ts';
import { blockNo, isLive, liveItems, narrativeTexts, narrativeWords } from './lesson.ts';
import type { Raw } from './lesson.ts';

export interface CheckContext {
  key: string;
  archetype: Archetype | null;         // from crew/outline.json (Q1 skipped when unknown)
  minutes: number | null;              // estimated minutes (Q15 skipped when unknown)
  chunks: Map<number, Chunk> | null;   // crew/ingest.json chunks (Q14 id check skipped when unknown)
  files: Map<number, SourceFile>;
  timeoutMs: number;                   // Q11 per test (2000)
  share?: number | null;               // the lesson's past-paper share (Q2 asks for more practice on heavy topics)
  supplied?: number[] | null;          // `draft` only: the chunk ids the Writer was given (preferred when citing an uncited block)
}

export const RULE = {
  schema: 'Q0 schema', ids: 'Q0 ids', formats: 'Q1 formats', count: 'Q2 item count', bloom: 'Q3 bloom', mcqCap: 'Q4 mcq cap',
  mcq: 'Q5 mcq', multi: 'Q6 multi_select', ordering: 'Q7 ordering', cloze: 'Q8 cloze', numeric: 'Q9 numeric', rubric: 'Q10 rubric',
  code: 'Q11 code runs', playground: 'Q12 playground', diagram: 'Q13 diagram', cites: 'Q14 citations', itemCites: 'Q14b item citations', thin: 'Q15 thin lesson',
  urls: 'Q16 no urls', language: 'Q17 language',
} as const;

type Rule = (lesson: LessonContent, cx: CheckContext) => Check[];

const row = (cx: CheckContext, rule: string, ok: boolean, detail: string, o: { block?: Block; item?: Assessment; suggestion?: string } = {}): Check => {
  const c: Check = { lesson: cx.key, rule, ok, detail };
  const n = o.block ? blockNo(o.block) : null;
  if (n !== null) c.block = n;
  if (o.item) c.item = o.item.id;
  if (o.suggestion && !ok) c.suggestion = o.suggestion;
  return c;
};
const s = (v: unknown) => (typeof v === 'string' ? v : '');
const norm = (t: string) => String(t ?? '').toLowerCase().replace(/[\s ]+/g, ' ').replace(/[.,;:!?'"`()]/g, '').trim();
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

// ---------- Q0 ----------
export const ruleIds: Rule = (lesson, cx) => {
  const problems: string[] = [];
  const bids = lesson.blocks.map(b => b.id ?? '');
  const iids = lesson.blocks.flatMap(b => (b.assessments ?? []).map(a => a.id ?? ''));
  const badB = bids.filter(id => !/^b\d+$/.test(id));
  const badI = iids.filter(id => !/^q\d+$/.test(id));
  const dupB = bids.filter((id, i) => id && bids.indexOf(id) !== i);
  const dupI = iids.filter((id, i) => id && iids.indexOf(id) !== i);
  if (badB.length) problems.push(`${plural(badB.length, 'block')} without a b<n> id`);
  if (badI.length) problems.push(`${plural(badI.length, 'item')} without a q<n> id`);
  if (dupB.length) problems.push(`duplicate block ids: ${[...new Set(dupB)].join(', ')}`);
  if (dupI.length) problems.push(`duplicate item ids: ${[...new Set(dupI)].join(', ')}`);
  return [row(cx, RULE.ids, !problems.length, problems.length ? problems.join('; ') : `${plural(bids.length, 'block')} and ${plural(iids.length, 'item')} have unique ids`,
    { suggestion: 'Give every block a unique id b<n> and every item a unique id q<n> (next free number); never renumber or reuse ids.' })];
};

export const ruleSchema: Rule = (lesson, cx) => {
  const out: Check[] = [];
  for (const b of lesson.blocks) {
    const issues = isEnabledType(b.type) ? payloadIssues(b.type, b.payload) : [`type \`${b.type}\` is not enabled in this player`];
    out.push(row(cx, RULE.schema, !issues.length, issues.length ? `${b.type}: ${issues.slice(0, 3).join('; ')}` : `${b.type} payload valid`,
      { block: b, suggestion: isEnabledType(b.type) ? `Fix the ${b.type} payload by hand, or re-draft it: \`draft --lesson ${cx.key} --only ${b.type}\`.` : `Delete this block; the player cannot show \`${b.type}\`.` }));
    for (const a of (b.assessments ?? []).filter(isLive)) {
      const r = AssessmentItemSchema.safeParse(a);
      const issues2 = r.success ? [] : r.error.issues.map(i => `${i.path.join('.') || '(item)'}: ${i.message}`);
      out.push(row(cx, RULE.schema, !issues2.length, issues2.length ? `${a.kind} item: ${issues2.slice(0, 3).join('; ')}` : `${a.kind} item valid`,
        { block: b, item: a, suggestion: 'Fix the item fields named in the detail (answer_key, options, bloom, grader, max_score 1-100).' }));
    }
  }
  return out;
};

// ---------- Q1-Q4 (lesson level) ----------
export const ruleFormats: Rule = (lesson, cx) => {
  if (!cx.archetype) return [];
  const present = new Set(lesson.blocks.map(b => b.type));
  const need = mandatoryFormats(cx.archetype);
  const missing = need.filter(t => !present.has(t));
  return [row(cx, RULE.formats, !missing.length,
    missing.length ? `${cx.archetype} lesson is missing ${missing.map(m => `\`${m}\``).join(', ')} (mandatory: ${need.join(', ')})` : `${cx.archetype}: has ${need.join(', ')}`,
    { suggestion: `This kind of knowledge cannot be taught without ${missing.join(' and ')}. Run ${missing.map(m => `\`draft --lesson ${cx.key} --only ${m}\``).join(' and ')}.` })];
};

/** G2 review: code exercises and projects do not count as practice items; a heavy exam topic needs 4. */
export const minItems = (share: number | null | undefined) => (typeof share === 'number' && share >= 0.2 ? 4 : 3);
export const ruleCount: Rule = (lesson, cx) => {
  const n = liveItems(lesson).filter(r => r.item.kind !== 'code' && r.item.kind !== 'project').length;
  const min = minItems(cx.share);
  const max = Math.max(6, min + 2);
  const ok = n >= min && n <= max;
  return [row(cx, RULE.count, ok, `${plural(n, 'practice item')} besides code and projects (wanted ${min}-${max}${min > 3 ? `: ${Math.round((cx.share ?? 0) * 100)}% of the paper` : ''})`, {
    suggestion: n < min
      ? `Add ${min - n} more item${min - n === 1 ? '' : 's'} to the quiz block (new ids from q<next>), at least one apply/analyze, grounded in the cited slides.`
      : `Remove the ${n - max} weakest item${n - max === 1 ? '' : 's'} (delete from the JSON; the ids are never reused).`,
  })];
};

export const ruleBloom: Rule = (lesson, cx) => {
  const items = liveItems(lesson).map(r => r.item);
  if (!items.length) return [];
  const higher = items.filter(a => (HIGHER_ORDER as readonly string[]).includes(a.bloom)).length;
  const remember = items.filter(a => a.bloom === 'remember').length;
  const problems: string[] = [];
  if (!higher) problems.push('no item is apply/analyze/evaluate/create');
  if (remember > items.length / 2) problems.push(`${remember} of ${items.length} items are remember (max half)`);
  return [row(cx, RULE.bloom, !problems.length, problems.length ? problems.join('; ') : `${higher} higher-order, ${remember} remember of ${items.length}`, {
    suggestion: 'Rewrite one recall item as a case to work through (apply) or a comparison/prediction (analyze) and set its bloom accordingly.',
  })];
};

export const mcqAllowance = (n: number) => Math.max(1, Math.floor(n * 0.4));
export const ruleMcqCap: Rule = (lesson, cx) => {
  const items = liveItems(lesson).map(r => r.item);
  if (!items.length) return [];
  const mcq = items.filter(a => a.kind === 'mcq').length;
  const allowed = mcqAllowance(items.length);
  return [row(cx, RULE.mcqCap, mcq <= allowed, `${mcq} mcq of ${items.length} items (max ${allowed})`, {
    suggestion: `Turn ${mcq - allowed} mcq into short_answer/cloze/numeric items so the learner produces the answer instead of recognising it.`,
  })];
};

// ---------- Q5-Q10 (items) ----------
const itemRule = (kinds: string[] | null, fn: (a: Assessment, b: Block, cx: CheckContext) => Check | null): Rule => (lesson, cx) => {
  const out: Check[] = [];
  for (const { block, item } of liveItems(lesson)) {
    if (typeof item.prompt !== 'string') continue;          // Q0 schema reports it
    if (kinds && !kinds.includes(item.kind)) continue;
    const c = fn(item, block, cx);
    if (c) out.push(c);
  }
  return out;
};

/** The correct option's text appears in the prompt (a giveaway). Short / numeric options are ignored. */
export function mcqLeak(a: Assessment): string | null {
  const id = a.answer_key?.correct_option_ids?.[0];
  const text = (a.options ?? []).find(o => o.id === id)?.text ?? '';
  const t = norm(text);
  if (t.length < 8 || !/[a-z]/.test(t)) return null;
  return ` ${norm(a.prompt)} `.includes(` ${t} `) ? text : null;
}

export const ruleMcq: Rule = itemRule(['mcq'], (a, b, cx) => {
  const opts = a.options ?? [];
  const problems: string[] = [];
  if (opts.length !== 4) problems.push(`${opts.length} options (wanted exactly 4)`);
  const ids = opts.map(o => o.id);
  if (new Set(ids).size !== ids.length) problems.push('duplicate option ids');
  const texts = opts.map(o => norm(o.text));
  if (new Set(texts).size !== texts.length) problems.push('two options have the same text');
  const correct = a.answer_key?.correct_option_ids ?? [];
  if (correct.length !== 1 || !ids.includes(correct[0]!)) problems.push(`answer_key.correct_option_ids must name exactly one existing option (has ${JSON.stringify(correct)})`);
  const leak = mcqLeak(a);
  if (leak) problems.push(`the correct option ("${leak}") is written in the prompt`);
  return row(cx, RULE.mcq, !problems.length, problems.length ? problems.join('; ') : '4 distinct options, one correct, no giveaway', {
    block: b, item: a, suggestion: 'Give exactly 4 distinct options (ids a-d), exactly one correct id, and keep the answer text out of the prompt.',
  });
});

export const MULTI_HINT = /more than one|all that apply|select all|choose all|tick all|(select|choose|pick) (two|three|2|3)\b/i;
/** "Which two ...", "Select three ...": a count the prompt promises (group 1 = the verb, group 2 = the number). */
export const MULTI_COUNT = /\b(which|select|choose|pick|tick|identify|name)\s+(two|three|four|2|3|4)\b/i;
const COUNTS: Record<string, number> = { two: 2, three: 3, four: 4, '2': 2, '3': 3, '4': 4 };
export const ruleMulti: Rule = itemRule(['multi_select'], (a, b, cx) => {
  const opts = a.options ?? [];
  const correct = a.answer_key?.correct_option_ids ?? [];
  const problems: string[] = [];
  if (opts.length < 4 || opts.length > 6) problems.push(`${opts.length} options (wanted 4-6)`);
  if (correct.length < 2 || correct.length > 3) problems.push(`${correct.length} correct ids (wanted 2-3)`);
  const said = MULTI_COUNT.exec(a.prompt);
  // "Which two ..." with exactly two correct ids already says more than one answer is correct
  if (!MULTI_HINT.test(a.prompt) && !(said && COUNTS[said[2]!.toLowerCase()] === correct.length)) problems.push('the prompt does not say more than one answer is correct');
  if (said && COUNTS[said[2]!.toLowerCase()] !== correct.length) problems.push(`the prompt says "${said[0]}" but ${correct.length} options are correct`);
  return row(cx, RULE.multi, !problems.length, problems.length ? problems.join('; ') : `${opts.length} options, ${correct.length} correct`, {
    block: b, item: a, suggestion: 'Use 4-6 options with 2-3 correct ids, and say "(Select all that apply.)" in the prompt.',
  });
});

export const ruleOrdering: Rule = itemRule(['ordering'], (a, b, cx) => {
  const presented = (a.options ?? []).map(o => o.id);
  const order = a.answer_key?.correct_order ?? [];
  const perm = order.length === presented.length && new Set(order).size === order.length && order.every(id => presented.includes(id));
  const problems: string[] = [];
  if (!perm) problems.push('correct_order is not a permutation of all option ids');
  else if (presented.join() === order.join()) problems.push('the options are presented already in the correct order');
  return row(cx, RULE.ordering, !problems.length, problems.length ? problems.join('; ') : `${presented.length} steps, scrambled`, {
    block: b, item: a, suggestion: 'List every option id exactly once in answer_key.correct_order and present the options scrambled.',
  });
});

export const blanksIn = (prompt: string): string[] => prompt.match(/_{3,}/g) ?? [];
export const ruleCloze: Rule = itemRule(['cloze'], (a, b, cx) => {
  const blanks = blanksIn(a.prompt);
  const key = (a.answer_key ?? {}) as Raw;
  const multi = Array.isArray(key.blanks) ? key.blanks.length : 0;
  const problems: string[] = [];
  if (!blanks.length) problems.push('the prompt has no ____ blank');
  else if (blanks.length > 1 && blanks.length !== multi) problems.push(`${blanks.length} blanks but one accepted list (wanted exactly one ____)`);
  if (blanks.some(x => x.length !== 4)) problems.push('blanks must be exactly four underscores ____');
  const accepted = Array.isArray(key.accepted) ? key.accepted : [];
  if (!accepted.length && !multi) problems.push('answer_key.accepted is empty');
  return row(cx, RULE.cloze, !problems.length, problems.length ? problems.join('; ') : `one blank, ${plural(accepted.length || multi, 'accepted answer')}`, {
    block: b, item: a, suggestion: 'Write the prompt with exactly one ____ blank and list every acceptable spelling in answer_key.accepted.',
  });
});

export const ruleNumeric: Rule = itemRule(['numeric'], (a, b, cx) => {
  const k = a.answer_key ?? {};
  const problems: string[] = [];
  if (typeof k.value !== 'number' || !Number.isFinite(k.value)) problems.push('answer_key.value is not a finite number');
  else if (!Number.isInteger(k.value) && !(typeof k.tolerance === 'number' && k.tolerance > 0)) problems.push(`non-integer answer ${k.value} needs a tolerance > 0`);
  if (typeof k.unit === 'string' && k.unit.trim() && !a.prompt.toLowerCase().includes(k.unit.trim().toLowerCase())) problems.push(`the prompt does not name the unit (${k.unit})`);
  // G2 review: recompute the item's working (69 mod 10 = 9 ...) and compare its last number with the key
  const work = (k as Raw).work;
  const slips = typeof k.value === 'number' ? workProblems(work, k.value, k.tolerance) : [];
  problems.push(...slips);
  const ok = !problems.length;
  const detail = ok
    ? `value ${k.value}${k.tolerance ? ` ± ${k.tolerance}` : ''}${k.unit ? ` ${k.unit}` : ''}${typeof work === 'string' && work.trim() ? ', working recomputed' : ' (no working: the Checker recomputes it)'}`
    : problems.join('; ');
  return row(cx, RULE.numeric, ok, detail, {
    block: b, item: a, suggestion: slips.length
      ? `The answer key or its working is wrong: recompute it by hand and fix answer_key.value/work in crew/lessons/${cx.key}.json, or \`rewrite-item --lesson ${cx.key} --item ${a.id} --reason "${slips[0]!.replace(/"/g, "'")}"\`.`
      : 'Set a finite value, a tolerance for non-integer answers, and name the unit in the prompt.',
  });
});

export const GENERIC_CRITERIA = ['understanding', 'clarity', 'quality of writing', 'quality', 'effort', 'presentation', 'overall quality', 'grammar', 'structure'];
export const ruleRubric: Rule = itemRule(null, (a, b, cx) => {
  const rows = Array.isArray(a.rubric) ? a.rubric : null;
  if (!rows) {
    if (a.grader === 'llm_rubric') return row(cx, RULE.rubric, false, 'grader llm_rubric but no rubric', { block: b, item: a, suggestion: 'Add 2-4 rubric rows or set grader to self.' });
    return null;
  }
  const problems: string[] = [];
  if (rows.length < 2 || rows.length > 4) problems.push(`${rows.length} rubric rows (wanted 2-4)`);
  const sum = rows.reduce((t, r) => t + (typeof r.weight === 'number' ? r.weight : 0), 0);
  if (Math.abs(sum - 1) > 0.01) problems.push(`weights sum to ${Math.round(sum * 100) / 100} (wanted 1)`);
  const generic = rows.filter(r => GENERIC_CRITERIA.includes(norm(s(r.criterion))));
  if (generic.length) problems.push(`generic criterion: ${generic.map(r => `"${r.criterion}"`).join(', ')}`);
  return row(cx, RULE.rubric, !problems.length, problems.length ? problems.join('; ') : `${rows.length} specific criteria, weights sum to 1`, {
    block: b, item: a, suggestion: 'Name what the learner must show in each criterion (e.g. "Explains why chaining keeps search O(1 + α)"), never "Clarity" or "Understanding".',
  });
});

// ---------- Q11-Q13 (executable / renderable blocks) ----------
export const ruleCode: Rule = (lesson, cx) => {
  const out: Check[] = [];
  for (const b of lesson.blocks.filter(x => x.type === 'code')) {
    const v = testCodeBlock(b, cx.timeoutMs);
    if (v.state === 'skipped') continue;
    const n = v.block ?? '?';
    out.push(row(cx, RULE.code, v.state !== 'fail', v.state === 'fail' ? v.problems.join('; ') : `${v.summary}${v.state === 'ok' ? ' · OK' : ''}`, {
      block: b,
      suggestion: `Run \`code-test --lesson ${cx.key} --block ${n} --dump\`, fix solution.js / starter.js / tests.json in crew/code/${cx.key}-b${n}/, then \`code-test --lesson ${cx.key} --block ${n} --apply\`. If it cannot be fixed: \`code-test --lesson ${cx.key} --block ${n} --disable --reason "<why>"\`.`,
    }));
  }
  return out;
};

export const playgroundInputs = (p: Raw): PlaygroundInput[] =>
  (Array.isArray(p.inputs) ? (p.inputs as Raw[]) : []).map(i => ({ key: s(i.key), min: Number(i.min), max: Number(i.max), step: Number(i.step), default: Number(i.default) }));

export const rulePlayground: Rule = (lesson, cx) => {
  const out: Check[] = [];
  for (const b of lesson.blocks.filter(x => x.type === 'playground')) {
    const p = (b.payload ?? {}) as Raw;
    const inputs = playgroundInputs(p);
    const problems: string[] = [];
    let detail = '';
    const fp = formulaProblem(s(p.formula_js), inputs.map(i => i.key));
    if (!inputs.length) problems.push('no inputs');
    else if (!fp.ok) problems.push(fp.why!);
    else if (inputs.some(i => !Number.isFinite(i.min) || !Number.isFinite(i.max) || i.max <= i.min)) problems.push('an input has max <= min');
    else {
      const sw = sweepFormula(s(p.formula_js), inputs, 0);
      if (sw.error) problems.push(sw.error);
      else if (!sw.finite) {
        const k = sw.ys.findIndex(y => typeof y !== 'number' || !Number.isFinite(y));
        problems.push(`compute() gives ${JSON.stringify(sw.ys[k])} at ${sw.input} = ${+sw.xs[k]!.toFixed(4)} (every point must be a finite number)`);
      } else if (sw.constant) problems.push(`the output does not change as ${sw.input} moves (${sw.ys[0]} everywhere): nothing to discover`);
      else {
        const ys = sw.ys as number[];
        detail = `${sw.input} ${inputs[0]!.min}..${inputs[0]!.max} gives ${+Math.min(...ys).toFixed(3)}..${+Math.max(...ys).toFixed(3)} over 28 points`;
      }
      const d = p.discover as Raw | undefined;
      if (d && typeof d === 'object') {
        const inp = inputs.find(i => i.key === d.input);
        if (!inp) problems.push(`discover.input \`${s(d.input)}\` is not an input`);
        else if (typeof d.value !== 'number' || d.value < inp.min || d.value > inp.max) problems.push(`discover.value ${String(d.value)} is outside ${inp.key}'s range ${inp.min}..${inp.max}`);
      }
    }
    out.push(row(cx, RULE.playground, !problems.length, problems.length ? problems.join('; ') : detail, {
      block: b, suggestion: `Make compute(p) a pure formula over the declared inputs that moves across the first input's range, or re-draft: \`draft --lesson ${cx.key} --only playground\`.`,
    }));
  }
  return out;
};

export const ruleDiagram: Rule = (lesson, cx) => lesson.blocks.filter(b => b.type === 'diagram').map(b => {
  const p = (b.payload ?? {}) as Raw;
  const why = p.format !== undefined && p.format !== 'mermaid' ? `format is ${String(p.format)} (only mermaid renders)` : mermaidProblem(s(p.source));
  const lines = s(p.source).split('\n').length;
  return row(cx, RULE.diagram, !why, why ?? `plausible Mermaid (${plural(lines, 'line')})`, {
    block: b, suggestion: `Fix the Mermaid source (${why ?? ''}) or re-draft it: \`draft --lesson ${cx.key} --only diagram\`.`,
  });
});

// ---------- Q14 citations ----------
const MENTION = /\b(slides?|pages?|pp?\.)\s*(\d{1,4})(?:\s*(?:-|–|to|and)\s*(\d{1,4}))?/gi;
export function proseMentions(b: Block): { text: string; n: number }[] {
  const out: { text: string; n: number }[] = [];
  for (const t of narrativeTexts(b)) {
    for (const m of t.matchAll(MENTION)) {
      out.push({ text: m[0], n: Number(m[2]) });
      if (m[3]) out.push({ text: m[0], n: Number(m[3]) });
    }
  }
  return out;
}

export const ruleCites: Rule = (lesson, cx) => {
  if (!cx.chunks) return [];                                  // nothing to resolve against without crew/ingest.json
  const out: Check[] = [];
  const nums = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []);
  const lessonFiles = new Set<number>();
  if (cx.chunks) for (const b of lesson.blocks) for (const id of nums(b.source_material_ids)) { const c = cx.chunks.get(id); if (c) lessonFiles.add(c.material_id); }
  let cited = 0, mentions = 0;
  for (const b of lesson.blocks) {
    const ids = [...nums(b.source_material_ids), ...(b.assessments ?? []).flatMap(a => nums(a.cite_chunk_ids))];
    cited += ids.length;
    if (cx.chunks) {
      const unknown = ids.filter(id => !cx.chunks!.has(id));
      if (unknown.length) out.push(row(cx, RULE.cites, false, `cites chunk id${unknown.length === 1 ? '' : 's'} ${[...new Set(unknown)].join(', ')}, which ${unknown.length === 1 ? 'is' : 'are'} not in crew/ingest.json`, {
        block: b, suggestion: 'Cite only chunk ids the draft was given (crew/ingest.json chunks[].id); remove the others.' }));
    }
    if (!cx.files.size) continue;
    const own = new Set<number>();
    if (cx.chunks) for (const id of nums(b.source_material_ids)) { const c = cx.chunks.get(id); if (c) own.add(c.material_id); }
    const scope = own.size ? own : lessonFiles.size ? lessonFiles : new Set([...cx.files.values()].filter(f => f.role !== 'past_paper').map(f => f.material_id));
    const maxPages = Math.max(0, ...[...scope].map(id => cx.files.get(id)?.pages ?? 0));
    for (const m of proseMentions(b)) {
      mentions++;
      if (maxPages && m.n > maxPages) {
        const names = [...scope].map(id => cx.files.get(id)?.title ?? `file ${id}`).join(', ');
        out.push(row(cx, RULE.cites, false, `the prose says "${m.text}" but ${names} ${scope.size === 1 ? 'has' : 'have at most'} ${maxPages} pages`, {
          block: b, suggestion: 'Name a slide/page that exists in the cited file (see the chunk locators), or drop the number.' }));
      }
    }
  }
  // G2: a live draft came back with no source_material_ids on any block: the page then shows no "From your files"
  // chips and nothing ties the lesson to the slides, so a lesson that cites nothing fails (the Writer re-drafts).
  // G2 review: item cites alone do not count; a lesson whose BLOCKS cite nothing shows no "From your files" chips
  const citedBlocks = lesson.blocks.filter(b => nums(b.source_material_ids).length).length;
  if (!citedBlocks && cx.chunks.size && lesson.blocks.length) out.push(row(cx, RULE.cites, false, `no block cites a source chunk${cited ? ` (only ${plural(cited, 'question cite')})` : ''}`, {
    suggestion: `Re-draft: \`draft --lesson ${cx.key} --note "give every block and question source_material_ids from its chunk list"\`.` }));
  if (!out.length) out.push(row(cx, RULE.cites, true, `${plural(cited, 'chunk citation')} on ${plural(citedBlocks, 'block')} resolve${mentions ? `, ${plural(mentions, 'slide/page mention')} exist` : ''}`));
  return out;
};

/** Q14b (G2 review): every live deterministic item cites at least one chunk (check backfills them; misses go to the Checker). */
const DETERMINISTIC_KINDS_Q = ['mcq', 'multi_select', 'ordering', 'numeric', 'cloze'];
export const ruleItemCites: Rule = (lesson, cx) => {
  if (!cx.chunks) return [];
  const items = liveItems(lesson).filter(r => DETERMINISTIC_KINDS_Q.includes(r.item.kind));
  if (!items.length) return [];
  const bare = items.filter(r => !(r.item.cite_chunk_ids ?? []).length);
  return [row(cx, RULE.itemCites, !bare.length, bare.length
    ? `${bare.map(r => r.item.id).join(', ')} cite${bare.length === 1 ? 's' : ''} no slide (the Checker decides whether ${bare.length === 1 ? 'it is' : 'they are'} beyond the slides)`
    : `${plural(items.length, 'auto-marked item')} each cite a slide`, {
    suggestion: 'Let the Checker rule these: a supported ruling cites the slide it quotes; not_covered labels them "Beyond your slides".' })];
};

// ---------- Q15-Q17 ----------
export const thinTarget = (minutes: number) => Math.round((minutes / 5) * 150);
export const ruleThin: Rule = (lesson, cx) => {
  if (!cx.minutes || cx.minutes <= 0) return [];
  const words = lesson.blocks.reduce((t, b) => t + narrativeWords(b), 0);
  const target = thinTarget(cx.minutes);
  const ok = words >= target * 0.5;
  return [row(cx, RULE.thin, ok, `${words} teaching words for a ${cx.minutes}-minute lesson (target about ${target}, minimum ${Math.ceil(target * 0.5)})`, {
    suggestion: `Re-draft with: \`draft --lesson ${cx.key} --note "The lesson came back at ${words} words for a ${cx.minutes}-minute node; the target is about ${target}. Expand the teaching blocks with concrete worked detail; do not add new blocks."\``,
  })];
};

export const URL_RE = /https?:\/\/[^\s)\]>"']+/i;
export function urlPaths(v: unknown, path = ''): string[] {
  if (typeof v === 'string') return URL_RE.test(v) ? [path || '(payload)'] : [];
  if (Array.isArray(v)) return v.flatMap((x, i) => urlPaths(x, path ? `${path}.${i}` : String(i)));
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => urlPaths(x, path ? `${path}.${k}` : k));
  return [];
}
export const ruleUrls: Rule = (lesson, cx) => {
  const out = lesson.blocks.flatMap(b => {
    const paths = urlPaths(b.payload);
    return paths.length ? [row(cx, RULE.urls, false, `URL in ${paths.slice(0, 3).join(', ')}`, { block: b, suggestion: 'Remove the URL and keep the text; the course works offline and cites the student\'s own files.' })] : [];
  });
  return out.length ? out : [row(cx, RULE.urls, true, 'no URLs in any payload')];
};

export const LANG_RE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
export const ruleLanguage: Rule = (lesson, cx) => lesson.blocks.filter(b => ['speaking', 'dialogue', 'audio'].includes(b.type)).map(b => {
  const lang = s(((b.payload ?? {}) as Raw).language).trim();
  const ok = LANG_RE.test(lang);
  return row(cx, RULE.language, ok, ok ? `${b.type} language ${lang}` : `${b.type} language is ${lang ? `"${lang}" (wanted one code like ms or ms-MY)` : 'missing'}`, {
    block: b, suggestion: `Set payload.language to the ONE language the learner hears/speaks in this ${b.type} (e.g. "ms").`,
  });
});

/** Every rule, in report order. */
export const RULES: Rule[] = [ruleIds, ruleSchema, ruleFormats, ruleCount, ruleBloom, ruleMcqCap, ruleMcq, ruleMulti, ruleOrdering, ruleCloze,
  ruleNumeric, ruleRubric, ruleCode, rulePlayground, ruleDiagram, ruleCites, ruleItemCites, ruleThin, ruleUrls, ruleLanguage];

export const runRules = (lesson: LessonContent, cx: CheckContext): Check[] => RULES.flatMap(r => r(lesson, cx));

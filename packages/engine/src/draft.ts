// `draft --lesson k [--note "..."] [--only <type>]`: one expand call per lesson (reasoning off) with its top-6 chunks,
// its neighbours and the formats derived from its archetype; normalise (aliases, singleton rule, orphans, strip
// code, MCQ cap). NO automatic re-ask: the Writer reads `check` and decides. `--note` is the Writer's own
// instruction (rendered as the steer); `--only <type>` rewrites that one block in place (keeping its id) or adds
// it when missing. The higher-order repair call (SaaS ensureHigherOrderAssessment) runs only when a fresh draft
// has no apply/analyze/evaluate/create item at all.
// Owner: WP2. Keep the export names and types (src/contracts.ts).
import { existsSync } from 'node:fs';
import { CARRIES_ASSESSMENTS, HIGHER_ORDER, isEnabledType, mandatoryFormats } from '@bilimind/core';
import type { Block, BlockType, Chunk, LessonContent } from '@bilimind/core';
import type { Ctx, DraftData, DraftFn, ReadLessonDraft, WriteLessonDraft } from './contracts.ts';
import { BilimindError } from './contracts.ts';
import { coursePaths, readJson, readJsonOrNull, writeJson } from './course.ts';
import { callJson } from './llm.ts';
import { readIngest } from './ingest/index.ts';
import { readOutline } from './outline.ts';
import { readPlan } from './plan.ts';
import {
  expandSchema, expandSystem, expandUser, higherOrderSchema, higherOrderSystem, higherOrderUser, lessonDigest, payloadExcerpt,
  rewriteSchema, rewriteUser,
} from './prompts/expand.ts';
import { briefFromGoal, fillSlideRange, goalDefaults, lessonNeighbours, lessonSources, teachingChunks } from './prompts/context.ts';
import { refineLessonChunks } from './sources.ts';
import { readExamMap } from './exam.ts';
import type { ExamTarget } from './prompts/expand.ts';
import { capMcq, hasHigherOrder, missingFormats, normaliseLessonDraft, normaliseRawBlocks, stripCode } from './normalise/lesson.ts';
import { normaliseItem } from './normalise/assessment.ts';
import type { DraftItem } from './normalise/assessment.ts';
import { groundCites } from './validate/fix.ts';
import type { CheckContext } from './validate/rules.ts';

export const readLessonDraft: ReadLessonDraft = (course, key) => readJson<LessonContent>(coursePaths(course).lessonJson(key));
export const writeLessonDraft: WriteLessonDraft = (course, content) => writeJson(coursePaths(course).lessonJson(content.key), content);

const maxId = (ids: (string | undefined)[], prefix: 'b' | 'q') =>
  ids.reduce((m, id) => Math.max(m, Number(new RegExp(`^${prefix}(\\d+)$`).exec(id ?? '')?.[1] ?? 0)), 0);
const allItems = (blocks: Block[]) => blocks.flatMap(b => b.assessments);
const round6 = (x: number) => Math.round(x * 1e6) / 1e6;

/** Everything one lesson's prompt needs, read from crew/. */
function lessonContext(ctx: Ctx, key: string) {
  const p = coursePaths(ctx.course);
  const goal = goalDefaults(readJsonOrNull(p.goal));
  const outline = readOutline(ctx.course);
  const lesson = outline.lessons.find(l => l.key === key);
  if (!lesson) throw new BilimindError(`No lesson "${key}" in the outline.`, `Lesson keys: ${outline.lessons.map(l => l.key).join(', ')}`);
  const ingest = readIngest(ctx.course);
  const pool = teachingChunks(ingest);
  const plan = readPlan(ctx.course);
  let chunks: Chunk[] = [];
  if (pool.length) {
    try {
      chunks = refineLessonChunks({ ingest, pool, lesson, outline, plan, lexical: n => lessonSources(pool, lesson, n).chunks });
    } catch {
      const byId = new Map(pool.map(c => [c.id, c]));
      chunks = lesson.chunk_ids.map(id => byId.get(id)).filter((c): c is Chunk => !!c).slice(0, 6);
    }
    if (!chunks.length) chunks = lessonSources(pool, lesson).chunks;
    try { chunks = fillSlideRange(chunks, pool, { lesson, outline, plan, cap: lesson.track === 'core' ? 12 : 9 }); } catch { /* keep the picked set */ }
  }
  const allowsCode = outline.allows_code;
  // EXAM TARGETS (G2 review): the past-paper parts counted towards this lesson, incl. parts folded into it from its
  // subtopics, and the parts folded AWAY from it into its parent when this subtopic is itself a kept lesson. The text
  // keeps its section heading ("Hashing: ..."): it is context for the Writer, never a citation.
  let em: ReturnType<typeof readExamMap> = null;
  try { em = readExamMap(ctx.course); } catch { em = null; }
  const examTargets: ExamTarget[] = (em?.questions ?? [])
    .filter(q => q.assigned === key || (q as { folded_from?: string }).folded_from === key)
    .sort((a, b) => b.marks - a.marks).slice(0, 8)
    .map(q => ({ id: q.id, marks: q.marks, text: q.text }));
  return {
    p, goal, outline, lesson, chunks, plan, allowsCode, examTargets, knownChunkIds: pool.map(c => c.id), ingest,
    codeLanguage: allowsCode ? outline.code_language ?? goal.code_language ?? 'javascript' : null,
    brief: briefFromGoal(goal, { title: outline.title, hasMaterials: pool.length > 0 }),
    neighbours: lessonNeighbours(outline, key, plan),
  };
}
type LessonCtx = ReturnType<typeof lessonContext>;

/**
 * G2 review: cite before `check` ever runs. Drops unknown/front-matter ids, cites the slides the prose names, gives
 * auto-marked items their best-matching chunk and an uncited block the supplied chunk its prose matches. Never throws.
 */
function ground(content: LessonContent, lc: LessonCtx, repairs: string[]): void {
  try {
    const cx: CheckContext = {
      key: content.key, archetype: null, minutes: null, timeoutMs: 2000,
      chunks: new Map(lc.ingest.chunks.map(c => [c.id, c])), files: new Map(lc.ingest.files.map(f => [f.material_id, f])),
      supplied: lc.chunks.map(c => c.id),
    };
    if (!cx.chunks!.size) return;
    for (const f of groundCites(content, cx)) repairs.push(`cites: ${f.detail}`);
  } catch (e) {
    repairs.push(`citation backfill skipped (${(e as Error).message.slice(0, 80)})`);
  }
}

function summarise(content: LessonContent, lc: LessonCtx, repairs: string[]): DraftData {
  const cites = new Set(content.blocks.flatMap(b => b.source_material_ids ?? []));
  const data: DraftData = {
    blocks: content.blocks.map(b => b.type), items: allItems(content.blocks).length,
    code_blocks: content.blocks.filter(b => b.type === 'code').length, cites: cites.size,
  };
  return Object.assign(data, {
    missing_formats: missingFormats(lc.lesson.archetype, content.blocks),
    mandatory: mandatoryFormats(lc.lesson.archetype),
    repairs, thin: lc.lesson.thin, chunks: lc.chunks.map(c => c.id), file: `crew/lessons/${content.key}.json`,
  });
}

/** SaaS ensureHigherOrderAssessment: 1-2 apply+ items appended to the last container (else a new quiz). Failure swallowed. */
async function higherOrderRepair(ctx: Ctx, lc: LessonCtx, content: LessonContent, repairs: string[]): Promise<number> {
  const existing = allItems(content.blocks).map(a => ({ kind: a.kind, prompt: a.prompt, bloom: a.bloom }));
  try {
    const res = await callJson<{ assessments?: unknown[] }>(ctx, {
      stage: 'higher_order', system: higherOrderSystem(), schema: higherOrderSchema, reasoning: false,
      user: higherOrderUser(lc.brief, lc.lesson, lc.allowsCode, existing, lessonDigest(content.blocks)),
    });
    const extra: DraftItem[] = [];
    for (const raw of res.data?.assessments ?? []) {
      const r = normaliseItem(raw);
      if (r.item && (HIGHER_ORDER as readonly string[]).includes(r.item.bloom) && (lc.allowsCode || r.item.kind !== 'code')) extra.push(r.item);
    }
    if (extra.length) {
      let q = maxId(allItems(content.blocks).map(a => a.id), 'q');
      const items = extra.map(a => ({ ...a, id: `q${++q}` })) as Block['assessments'];
      const host = [...content.blocks].reverse().find(b => CARRIES_ASSESSMENTS.includes(b.type));
      if (host) host.assessments.push(...items);
      else content.blocks.push({ id: `b${maxId(content.blocks.map(b => b.id), 'b') + 1}`, type: 'quiz', payload: {}, source_material_ids: null, assessments: items });
      repairs.push(`added ${extra.length} higher-order item${extra.length === 1 ? '' : 's'} (every question was recall; one repair call)`);
      capMcq(content.blocks, repairs);
    }
    return res.cost_usd;
  } catch (e) {
    repairs.push(`higher-order repair call failed (${(e as Error).message.slice(0, 80)}); the lesson keeps recall-only questions`);
    return 0;
  }
}

async function fullDraft(ctx: Ctx, lc: LessonCtx, note: string | undefined, prev: LessonContent | null): Promise<DraftData> {
  ctx.progress(`draft ${lc.lesson.key}: writing ${mandatoryFormats(lc.lesson.archetype).join(' + ')} from ${lc.chunks.length} source chunks...`);
  const res = await callJson(ctx, {
    stage: 'expand', system: expandSystem(), schema: expandSchema(), reasoning: false,
    user: expandUser({
      brief: lc.brief, lesson: lc.lesson, allowsCode: lc.allowsCode, codeLanguage: lc.codeLanguage,
      prerequisites: lc.neighbours.prerequisites, dependents: lc.neighbours.dependents, chunks: lc.chunks,
      mandatory: mandatoryFormats(lc.lesson.archetype), instruction: note ?? null, examTargets: lc.examTargets,
    }),
  });
  const { content, repairs } = normaliseLessonDraft(res.data, {
    key: lc.lesson.key, allowsCode: lc.allowsCode, suppliedChunkIds: lc.chunks.map(c => c.id), knownChunkIds: lc.knownChunkIds, language: lc.goal.language,
  });
  let cost = res.cost_usd;
  if (!hasHigherOrder(content.blocks)) cost += await higherOrderRepair(ctx, lc, content, repairs);
  ground(content, lc, repairs);
  content.attempts = (prev?.attempts ?? 0) + 1;
  content.cost_usd = round6((prev?.cost_usd ?? 0) + cost);
  content.repairs = [...(note ? [`re-drafted with the Writer's note: "${note.slice(0, 200)}"`] : []), ...repairs];
  writeLessonDraft(ctx.course, content);
  return summarise(content, lc, content.repairs);
}

async function onlyBlock(ctx: Ctx, lc: LessonCtx, type: BlockType, note: string | undefined, prev: LessonContent): Promise<DraftData> {
  const existing = prev.blocks.find(b => b.type === type) ?? null;
  ctx.progress(`draft ${lc.lesson.key}: ${existing ? `rewriting ${existing.id} (${type})` : `adding the missing ${type}`}...`);
  const res = await callJson<{ blocks?: unknown[] }>(ctx, {
    stage: 'expand_block', system: expandSystem(), schema: rewriteSchema(type), reasoning: false,
    user: rewriteUser({
      brief: lc.brief, lesson: lc.lesson, allowsCode: lc.allowsCode, codeLanguage: lc.codeLanguage, chunks: lc.chunks, type,
      current: existing?.payload ?? null, instruction: note ?? null,
      otherParts: prev.blocks.filter(b => b !== existing).map(b => ({ type: b.type, excerpt: payloadExcerpt(b.payload) })),
      examTargets: CARRIES_ASSESSMENTS.includes(type) || type === 'worked_example' || type === 'walkthrough' ? lc.examTargets : [],
    }),
  });
  const repairs: string[] = [];
  const opts = { key: lc.lesson.key, allowsCode: lc.allowsCode, suppliedChunkIds: lc.chunks.map(c => c.id), knownChunkIds: lc.knownChunkIds, language: lc.goal.language };
  const fresh = stripCode(normaliseRawBlocks(res.data?.blocks, opts, repairs), lc.allowsCode, repairs).filter(b => b.type === type);
  if (!fresh.length) throw new BilimindError(`The model returned no usable ${type} block.`, repairs.join('; ') || 'Run it again with a clearer --note.');
  const nb = fresh[0]!;
  let q = maxId(allItems(prev.blocks).map(a => a.id), 'q');
  const items = nb.assessments.map(a => ({ ...a, id: `q${++q}` })) as Block['assessments'];
  const blocks = prev.blocks.map(b => ({ ...b, assessments: [...b.assessments] }));
  let id: string;
  if (existing) {
    id = existing.id!;
    const i = blocks.findIndex(b => b.id === existing.id);
    blocks[i] = { ...blocks[i]!, payload: nb.payload, source_material_ids: nb.source_material_ids,
      assessments: CARRIES_ASSESSMENTS.includes(type) ? items : blocks[i]!.assessments };
  } else {
    id = `b${maxId(prev.blocks.map(b => b.id), 'b') + 1}`;
    const block: Block = { id, type, payload: nb.payload, source_material_ids: nb.source_material_ids, assessments: CARRIES_ASSESSMENTS.includes(type) ? items : [] };
    const quizAt = type === 'quiz' ? -1 : blocks.findIndex(b => b.type === 'quiz');
    if (quizAt >= 0) blocks.splice(quizAt, 0, block); else blocks.push(block);
  }
  capMcq(blocks, repairs);
  const content: LessonContent = {
    ...prev, blocks, attempts: prev.attempts + 1, cost_usd: round6(prev.cost_usd + res.cost_usd),
    repairs: [],
  };
  ground(content, lc, repairs);
  content.repairs = [...prev.repairs, `${existing ? 'rewrote' : 'added'} the ${type} block (${id})${note ? ` with the Writer's note: "${note.slice(0, 200)}"` : ''}`, ...repairs];
  writeLessonDraft(ctx.course, content);
  return summarise(content, lc, repairs);
}

export const draft: DraftFn = async (ctx, opts) => {
  const lc = lessonContext(ctx, opts.lesson);
  const prev = existsSync(lc.p.lessonJson(opts.lesson)) ? readLessonDraft(ctx.course, opts.lesson) : null;
  if (opts.only) {
    if (!isEnabledType(opts.only)) throw new BilimindError(`--only ${opts.only}: not a block type this course uses.`, 'Use one of the mandatory formats `check` reported, e.g. --only walkthrough.');
    if (!prev) throw new BilimindError(`No draft of ${opts.lesson} yet.`, `Run \`draft --lesson ${opts.lesson}\` first.`);
    if (opts.only === 'code' && !lc.allowsCode) throw new BilimindError('This course is not a coding subject, so it has no code exercises.', 'Pick another format.');
    return onlyBlock(ctx, lc, opts.only, opts.note, prev);
  }
  return fullDraft(ctx, lc, opts.note, prev);
};

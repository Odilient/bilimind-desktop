// Shared helpers over a lesson draft (crew/lessons/<key>.json): ids, live items, chunk sets, answers in words.
// Used by check, code-test, evidence, verdict, rewrite-item and plant so they all agree on the same rules.
import { DROPPED_STATUSES, blockNumber, spokenText, wordCount } from '@bilimind/core';
import type { Assessment, Block, Chunk, IngestResult, LessonContent, OutlineResult, Lesson as OutlineLesson, SourceFile } from '@bilimind/core';
import { coursePaths, readJsonOrNull } from '../course.ts';

export type Raw = Record<string, unknown>;

/** Block number = numeric part of the block id (`b3` -> 3); null when the id is missing or malformed. */
export const blockNo = (b: Pick<Block, 'id'>): number | null => {
  const n = blockNumber(b.id ?? '');
  return Number.isFinite(n) ? n : null;
};
/** Item still in play (not contradicted / excluded). */
export const isLive = (a: Assessment): boolean => !DROPPED_STATUSES.includes(a.status ?? 'unchecked');

export interface ItemRef { block: Block; item: Assessment; blockIndex: number; itemIndex: number }
export function allItems(lesson: LessonContent): ItemRef[] {
  const out: ItemRef[] = [];
  lesson.blocks.forEach((block, blockIndex) => (block.assessments ?? []).forEach((item, itemIndex) => out.push({ block, item, blockIndex, itemIndex })));
  return out;
}
export const liveItems = (lesson: LessonContent): ItemRef[] => allItems(lesson).filter(r => isLive(r.item));
export const findItem = (lesson: LessonContent, id: string): ItemRef | null => allItems(lesson).find(r => r.item.id === id) ?? null;
export const findBlock = (lesson: LessonContent, n: number): Block | null => lesson.blocks.find(b => blockNo(b) === n) ?? null;

/** Next free `q<n>`: above every id in the lesson AND every id the verdict history has seen (ids are never reused). */
export function nextItemId(lesson: LessonContent, seen: readonly string[] = []): string {
  let max = 0;
  for (const id of [...allItems(lesson).map(r => r.item.id), ...seen]) {
    const m = /^q(\d+)$/.exec(String(id ?? ''));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `q${max + 1}`;
}

/** The code item of a code block (kind 'code'), if any. */
export const codeItemOf = (b: Block): Assessment | undefined => (b.assessments ?? []).find(a => a.kind === 'code');

const nums = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)) : []);
const uniq = <T>(xs: T[]): T[] => [...new Set(xs)];

/** Every chunk id any block or item of the lesson cites. */
export const lessonChunkIds = (lesson: LessonContent): number[] =>
  uniq(lesson.blocks.flatMap(b => [...nums(b.source_material_ids), ...(b.assessments ?? []).flatMap(a => nums(a.cite_chunk_ids))]));

/**
 * The chunks an item is judged against: its own cite_chunk_ids + its block's source_material_ids. When both are
 * empty (a quiz block the writer did not cite), fall back to everything the lesson cites, then to the outline's
 * retrieved chunks. evidence, verdict and rewrite-item all use THIS set, so a quote shown in the packet is accepted.
 */
export function itemChunkIds(lesson: LessonContent, block: Block, item: Assessment, outlineChunkIds: readonly number[] = []): number[] {
  const own = uniq([...nums(item.cite_chunk_ids), ...nums(block.source_material_ids)]);
  if (own.length) return own;
  const all = lessonChunkIds(lesson);
  return all.length ? all : uniq(nums(outlineChunkIds));
}

/** The accepted answer written out for a human (evidence packets, rewrite prompts). Never shown to learners. */
export function answerInWords(item: Assessment): string {
  const k = (item.answer_key ?? {}) as Raw;
  const opt = (id: string) => {
    const o = (item.options ?? []).find(x => x.id === id);
    return o ? `${id}) ${o.text}` : `${id}) (no such option)`;
  };
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  switch (item.kind) {
    case 'mcq':
    case 'multi_select': {
      const ids = list(k.correct_option_ids);
      return ids.length ? ids.map(opt).join('; ') : '(no correct option set)';
    }
    case 'ordering': {
      const ids = list(k.correct_order);
      return ids.length ? ids.map((id, i) => `${i + 1}. ${opt(id)}`).join('  ') : '(no order set)';
    }
    case 'numeric': {
      const tol = typeof k.tolerance === 'number' && k.tolerance > 0 ? ` ± ${k.tolerance}` : '';
      const unit = typeof k.unit === 'string' && k.unit ? ` ${k.unit}` : '';
      return `${k.value ?? '(no value)'}${tol}${unit}`;
    }
    case 'cloze': {
      if (Array.isArray(k.blanks)) return k.blanks.map((b, i) => `blank ${i + 1}: ${list(Array.isArray(b) ? b : (b as Raw)?.accepted).join(' / ')}`).join('; ');
      const acc = list(k.accepted);
      return acc.length ? acc.map(a => `"${a}"`).join(' or ') : '(no accepted answer)';
    }
    case 'code':
      return 'Passes the exercise tests (checked by code-test, not by the Checker).';
    default:
      return typeof k.reference_answer === 'string' && k.reference_answer.trim() ? k.reference_answer : '(no reference answer; judge the question itself)';
  }
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);

/**
 * The teaching prose of a block (engine-port Q15): explainer, example, analogy, walkthrough details, worked_example
 * explanations, scenario outcomes, comparison cells, plus misconception / key points / timeline / audio / reflection.
 */
export function narrativeTexts(b: Block): string[] {
  const p = (b.payload ?? {}) as Raw;
  switch (b.type) {
    case 'explainer': return [str(p.markdown)];
    case 'example': return [str(p.markdown)];
    case 'analogy': return [str(p.markdown), str(p.breaks_down_when)];
    case 'misconception': return [str(p.belief), str(p.why_it_seems_right), str(p.what_is_true)];
    case 'key_points': return arr(p.points).map(x => str(x));
    case 'walkthrough': return [str(p.intro), ...arr(p.steps).flatMap(s => [str(s.detail_markdown), str(s.warning), str(s.check)])];
    case 'worked_example': return [str(p.problem_markdown), ...arr(p.steps).map(s => str(s.explanation)), str(p.answer), ...arr(p.common_mistakes).map(x => str(x))];
    case 'scenario': return [str(p.setup_markdown), ...arr(p.steps).flatMap(s => arr(s.options).map(o => str(o.outcome_markdown))), str(p.debrief_markdown)];
    case 'comparison': return [str(p.intro), ...arr(p.items).flatMap(i => [...arr(i.values).map(x => str(x)), str(i.best_for)])];
    case 'timeline': return arr(p.events).map(e => str(e.detail));
    case 'audio': return [str(p.script_markdown)];
    case 'diagram': return [str(p.caption)];
    case 'reflection': return [str(p.prompt)];
    case 'project': return [str(p.brief_markdown)];
    default: return [];
  }
}
export const narrativeWords = (b: Block): number => narrativeTexts(b).reduce((n, t) => n + (t.trim() ? wordCount(spokenText(t)) : 0), 0);

// ---------- course data (outline + ingest), loaded once per command ----------
export interface CourseData {
  ingest: IngestResult | null;
  outline: OutlineResult | null;
  chunks: Map<number, Chunk>;
  files: Map<number, SourceFile>;
  goalLanguage: string | null;
  shares: Map<string, number>;          // lesson key -> past-paper share (crew/exam-map.json)
}
export function loadCourseData(course: string): CourseData {
  const p = coursePaths(course);
  const ingest = readJsonOrNull<IngestResult>(p.ingest);
  const outline = readJsonOrNull<OutlineResult>(p.outline);
  const goal = readJsonOrNull<{ language?: string }>(p.goal);
  const em = readJsonOrNull<{ weights?: { key: string; share: number }[] }>(p.examMap);
  return {
    ingest, outline,
    chunks: new Map((ingest?.chunks ?? []).map(c => [c.id, c])),
    files: new Map((ingest?.files ?? []).map(f => [f.material_id, f])),
    goalLanguage: goal?.language ?? null,
    shares: new Map((em?.weights ?? []).map(w => [w.key, w.share])),
  };
}
export const outlineLessonOf = (data: CourseData, key: string): OutlineLesson | null =>
  data.outline?.lessons.find(l => l.key === key) ?? null;

/** Chunks for ids, in order, skipping unknown ids. */
export const chunksFor = (data: CourseData, ids: readonly number[]): Chunk[] =>
  ids.map(id => data.chunks.get(id)).filter((c): c is Chunk => !!c);

/** "Lecture 4 · Hashing · Page 7" */
export const chunkLabel = (data: CourseData, c: Chunk): string => {
  const f = data.files.get(c.material_id);
  return [f?.title ?? c.title, c.locator ?? (c.page ? `Page ${c.page}` : null)].filter(Boolean).join(' · ');
};

export const clip = (t: string, n: number): string => (t.length <= n ? t : t.slice(0, n - 1).trimEnd() + '…');
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

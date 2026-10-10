// Lesson-level normalisation: port of NodeExpander::normaliseBlocks + capMultipleChoice + stripCodeUnlessAllowed
// (engine-port.md §5.1). Never fails the lesson for a sloppy part: a bad payload drops its block, a bad item drops
// the item, and every decision is written to `repairs` in plain words (REPORT.md shows them).
import { BLOCK_TYPES, CARRIES_ASSESSMENTS, DISABLED_TYPES, HIGHER_ORDER, SINGLETON, isEnabledType, mandatoryFormats } from '@bilimind/core';
import type { Archetype, Block, BlockType, LessonContent } from '@bilimind/core';
import { normalisePayload } from './blocks.ts';
import { demoteToShortAnswer, normaliseItem, reconcileCode } from './assessment.ts';
import type { DraftItem } from './assessment.ts';
import { cap, isObj, text } from './util.ts';
import type { Raw } from './util.ts';
import { MAX_MCQ_SHARE } from '../prompts/expand.ts';

export interface LessonNormaliseOptions {
  key: string;
  allowsCode: boolean;
  suppliedChunkIds: number[];
  /** Every chunk id in crew/ingest.json (teaching chunks): a cited id outside the supplied set is kept, with a repair note. */
  knownChunkIds?: number[];
  language?: string;            // default 'en' (speaking/dialogue/audio blocks that name no language)
}
/** A block before ids are assigned. */
export interface DraftBlock { type: BlockType; payload: Raw; source_material_ids: number[] | null; assessments: DraftItem[] }

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const typeOf = (v: unknown) => String(v ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

function materialIds(v: unknown, supplied: number[], known: number[] = [], outside?: number[]): number[] | null {
  if (!Array.isArray(v) || (!supplied.length && !known.length)) return null;
  const out: number[] = [];
  for (const id of v) {
    const n = typeof id === 'number' ? id : typeof id === 'string' && /^\d+$/.test(id.trim()) ? Number(id) : NaN;
    if (!Number.isInteger(n) || out.includes(n)) continue;
    if (supplied.includes(n)) out.push(n);
    else if (known.includes(n)) { out.push(n); outside?.push(n); }
  }
  return out.length ? out : null;
}

/**
 * G2 review: models often nest the block's citations (and sometimes its items) INSIDE the payload. Hoist
 * payload.source_material_ids / payload.cite_chunk_ids / payload.assessments to the block before the payload is
 * normalised, so a lesson never silently loses its citations.
 */
export function hoistNested(row: Raw, repairs: string[]): Raw {
  const p = row.payload;
  if (!isObj(p)) return row;
  const out: Raw = { ...row, payload: { ...p } };
  const pay = out.payload as Raw;
  const moved: string[] = [];
  for (const k of ['source_material_ids', 'cite_chunk_ids'] as const) {
    if (!Array.isArray(pay[k])) continue;
    const have = Array.isArray(out.source_material_ids) ? out.source_material_ids as unknown[] : [];
    out.source_material_ids = [...have, ...(pay[k] as unknown[]).filter(x => !have.includes(x))];
    delete pay[k];
    moved.push(k);
  }
  if (Array.isArray(pay.assessments)) {
    const have = Array.isArray(out.assessments) ? out.assessments as unknown[] : [];
    out.assessments = [...have, ...(pay.assessments as unknown[])];
    delete pay.assessments;
    moved.push('assessments');
  }
  if (moved.length) repairs.push(`moved ${moved.join(' and ')} out of a ${String(row.type)} payload to the block`);
  return out;
}

/** A container block with no item would be dropped (SaaS); for project/code we write the missing item instead. */
function synthesiseItem(type: BlockType, payload: Raw): DraftItem | null {
  if (type === 'project') {
    const prompt = cap(`${text(payload, 'title') ?? 'Project'}: ${text(payload, 'brief_markdown') ?? ''}`, 1200);
    return { kind: 'project', prompt, bloom: 'create', grader: 'self', max_score: 100 };
  }
  if (type === 'code') {
    return reconcileCode([{ kind: 'code', prompt: cap(text(payload, 'instructions_markdown') ?? 'Complete the exercise.', 1200),
      bloom: 'apply', grader: 'deterministic', answer_key: {}, max_score: 100 }], payload)[0]!;
  }
  return null;
}

/**
 * Raw model blocks -> normalised blocks (no ids yet). Applies: payload normaliser, disabled types, singleton rule,
 * item normaliser, code-item reconciliation, orphan items re-homed into a trailing quiz, empty containers.
 */
export function normaliseRawBlocks(rawBlocks: unknown, o: LessonNormaliseOptions, repairs: string[]): DraftBlock[] {
  const rows = Array.isArray(rawBlocks) ? rawBlocks : [];
  const blocks: DraftBlock[] = [];
  const orphans: DraftItem[] = [];
  const seen = new Set<string>();
  const ctx = { language: o.language ?? 'en' };
  for (const row0 of rows) {
    if (!isObj(row0)) continue;
    const row = hoistNested(row0, repairs);
    const type = typeOf(row.type);
    if (!(BLOCK_TYPES as readonly string[]).includes(type)) { repairs.push(`dropped a block of unknown type "${String(row.type)}"`); continue; }
    if (DISABLED_TYPES.includes(type as BlockType) || !isEnabledType(type)) { repairs.push(`dropped a ${type} block (that format is switched off)`); continue; }
    const { payload, why } = normalisePayload(type, row.payload, ctx);
    if (!payload) { repairs.push(`dropped ${type}: ${why ?? 'payload unusable'}`); continue; }
    if (SINGLETON.includes(type)) {
      if (seen.has(type)) { repairs.push(`dropped a second ${type} (one per lesson)`); continue; }
      seen.add(type);
    }
    let items: DraftItem[] = [];
    for (const raw of Array.isArray(row.assessments) ? row.assessments : []) {
      const r = normaliseItem(raw);
      if (r.item) items.push(r.item); else repairs.push(`dropped an item: ${r.why}`);
      if (r.note) repairs.push(r.note);
    }
    if (type === 'code') items = reconcileCode(items, payload);
    const carries = CARRIES_ASSESSMENTS.includes(type);
    if (!carries) { orphans.push(...items); items = []; }
    if (carries && !items.length) {
      const made = synthesiseItem(type, payload);
      if (!made) { if (type !== 'quiz') repairs.push(`dropped an empty ${type}`); continue; }
      items = [made];
      repairs.push(type === 'code'
        ? 'added the missing code item (it has no reference solution yet: the Coder must write one)'
        : 'added the missing project item (self-marked against the brief)');
    }
    const outside: number[] = [];
    blocks.push({ type, payload, source_material_ids: materialIds(row.source_material_ids, o.suppliedChunkIds, o.knownChunkIds, outside), assessments: items });
    if (outside.length) repairs.push(`kept ${type} citation${outside.length === 1 ? '' : 's'} ${outside.join(', ')} (real chunks, but not in the lesson's supplied list)`);
  }
  if (orphans.length) {
    // HACKATHON: into the lesson's last quiz when it has one (two quizzes in a row read as a glitch), else a new one
    const host = [...blocks].reverse().find(b => b.type === 'quiz');
    if (host) host.assessments.push(...orphans);
    else blocks.push({ type: 'quiz', payload: {}, source_material_ids: null, assessments: orphans });
    repairs.push(`re-homed ${plural(orphans.length, 'question')} from narrative blocks into ${host ? 'the quiz' : 'a quiz'}`);
  }
  return blocks;
}

/** stripCodeUnlessAllowed: no code block and no code item unless the subject is about code. */
export function stripCode(blocks: DraftBlock[], allowsCode: boolean, repairs: string[]): DraftBlock[] {
  if (allowsCode) return blocks;
  let n = 0;
  const out = blocks.filter(b => (b.type === 'code' ? (n++, false) : true)).map(b => {
    const kept = b.assessments.filter(a => a.kind !== 'code');
    n += b.assessments.length - kept.length;
    return { ...b, assessments: kept };
  }).filter(b => !(b.type === 'quiz' && !b.assessments.length));
  if (n) repairs.push(`stripped ${plural(n, 'code exercise')} (this is not a coding subject)`);
  return out;
}

/** capMultipleChoice across the lesson: at most max(1, floor(total x 0.40)) mcq; later ones are demoted. */
export function capMcq<T extends { assessments: DraftItem[] }>(blocks: T[], repairs: string[]): number {
  const refs: [number, number][] = [];
  let total = 0;
  blocks.forEach((b, bi) => b.assessments.forEach((a, ii) => { total++; if (a.kind === 'mcq') refs.push([bi, ii]); }));
  const allowed = Math.max(1, Math.floor(total * MAX_MCQ_SHARE));
  if (!total || refs.length <= allowed) return 0;
  let demoted = 0;
  for (const [bi, ii] of refs.slice(allowed)) {
    const d = demoteToShortAnswer(blocks[bi]!.assessments[ii]!);
    if (d) { blocks[bi]!.assessments[ii] = d; demoted++; }
  }
  if (demoted) repairs.push(`demoted ${demoted} of ${refs.length} mcq to short_answer (at most ${allowed} of ${total} items may be multiple choice)`);
  return demoted;
}

/** Fresh ids b1.. / q1.. in reading order (a full draft). */
export function withFreshIds(blocks: DraftBlock[]): Block[] {
  let q = 0;
  return blocks.map((b, i) => ({
    id: `b${i + 1}`, type: b.type, payload: b.payload, source_material_ids: b.source_material_ids,
    assessments: b.assessments.map(a => ({ ...a, id: `q${++q}` })) as Block['assessments'],
  }));
}

export const missingFormats = (archetype: Archetype, blocks: { type: string }[]): BlockType[] =>
  mandatoryFormats(archetype).filter(t => !blocks.some(b => b.type === t));

export const hasHigherOrder = (blocks: { assessments: { bloom: string }[] }[]): boolean =>
  blocks.some(b => b.assessments.some(a => (HIGHER_ORDER as readonly string[]).includes(a.bloom)));

/** The whole pipeline for one fresh draft: blocks -> strip code -> MCQ cap -> ids. */
export function normaliseLessonDraft(raw: unknown, o: LessonNormaliseOptions): { content: LessonContent; repairs: string[] } {
  const repairs: string[] = [];
  const rawBlocks = Array.isArray(raw) ? raw : isObj(raw) ? raw.blocks : null;
  let blocks = normaliseRawBlocks(rawBlocks, o, repairs);
  blocks = stripCode(blocks, o.allowsCode, repairs);
  capMcq(blocks, repairs);
  return { content: { key: o.key, blocks: withFreshIds(blocks), attempts: 1, cost_usd: 0, repairs: [...repairs] }, repairs };
}

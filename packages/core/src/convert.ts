// fromSaasLesson(): turn a SaaS/engine-shaped lesson ({blocks:[{id?, type, payload, source_material_ids, assessments}]},
// e.g. hackathon/research/engine-port-samples/lesson-bst-*.json or crew/lessons/<key>.json) into a course.json
// lesson. Minimal deterministic normalisation so the result validates; the full BlockPayloadNormaliser port
// lives in packages/engine/src/normalise (WP2).
//
// It is THE draft -> course step: build.ts uses it (with a real cite resolver) AND tts.ts narrates its output, so
// narration cue ids equal the sentence ids the player wraps. Rules:
// - Block ids `b<n>` and item ids `q<n>` from the draft are KEPT (a Writer may delete b4; b5 stays b5). Missing,
//   malformed or duplicate ids get the next free number. Ids are never renumbered by position.
// - Items with status 'contradicted' or 'excluded' are dropped (they go to receipts.excluded, see excludedItems()).
// - status -> course `verdict`; not_covered adds the 'beyond_slides' label; cite_chunk_ids -> item `cites`.
// - Disabled types and duplicate singletons are dropped; a leading "# Heading" in an explainer becomes its title;
//   items on blocks that cannot carry them are re-homed into a trailing quiz; an empty quiz is removed.
import { CARRIES_ASSESSMENTS, DROPPED_STATUSES, ITEM_LABELS, SINGLETON } from './types.ts';
import type { Archetype, BlockType, ItemStatus, Mark, Track } from './types.ts';
import { isEnabledType } from './blocks.ts';
import type { Cite } from './blocks.ts';
import { plannedBlockTypes } from './archetypes.ts';
import { narrationMatches } from './sentences.ts';
import type { CourseLesson, ExcludedItem, Narration } from './course-schema.ts';

type Raw = Record<string, unknown>;
export interface SaasLesson {
  key?: string;
  blocks: { id?: string; type: string; title?: string | null; payload: Raw;
    source_material_ids?: number[] | null; cites?: Cite[]; assessments?: Raw[] }[];
}
export interface FromSaasOptions {
  id: string;                      // lesson id (outline key)
  n?: number;
  title: string;
  summary?: string;
  archetype: Archetype;
  minutes?: number;
  track?: Track;
  parent?: string | null;
  mark?: Mark | null;
  section?: string | null;
  day?: string | null;
  thin?: boolean;
  /** Dropped (null) with a warning when its cue ids do not equal lessonSentences() of the converted lesson. */
  narration?: Narration | null;
  /**
   * chunk id -> resolved citation (build.ts). `quote` is the Checker's verbatim quote for items (the cite should
   * show and highlight it); blocks pass none and the resolver picks the chunk sentence. Null = dropped. Default: no cites.
   */
  resolveCite?: (chunkId: number, quote?: string) => Cite | null;
  warn?: (message: string) => void;
}

const OPTION_IDS = 'abcdefghijklmnopqrstuvwxyz';
const BLOOMS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
const VERDICT_OF: Partial<Record<ItemStatus, 'supported' | 'not_covered' | 'pending' | 'unchecked'>> = {
  supported: 'supported', not_covered: 'not_covered', pending: 'pending', unchecked: 'unchecked',
};

/** Hands out `<prefix><n>` ids: keeps valid unused ones, otherwise the next number above everything seen. */
function idAllocator(prefix: string, existing: readonly unknown[]) {
  const re = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const v of existing) { const m = typeof v === 'string' ? re.exec(v) : null; if (m) max = Math.max(max, Number(m[1])); }
  const used = new Set<string>();
  return (wanted: unknown): string => {
    if (typeof wanted === 'string' && re.test(wanted) && !used.has(wanted)) { used.add(wanted); return wanted; }
    const id = `${prefix}${++max}`;
    used.add(id);
    return id;
  };
}

function dedupeCites(cites: Cite[]): Cite[] {
  const seen = new Set<string>();
  return cites.filter(c => { const k = `${c.file}|${c.locator}|${c.quote}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

function normaliseItem(a: Raw, id: string, o: FromSaasOptions): Raw {
  const kind = String(a.kind ?? '');
  const options = Array.isArray(a.options)
    ? (a.options as Raw[]).map((x, i) => ({ id: String(x.id ?? OPTION_IDS[i]), text: String(x.text ?? '') }))
    : undefined;
  const key = { ...((a.answer_key as Raw | undefined) ?? {}) };
  if ((kind === 'mcq' || kind === 'multi_select') && !Array.isArray(key.correct_option_ids) && key.correct_option_id !== undefined)
    key.correct_option_ids = [String(key.correct_option_id)];
  if (kind === 'ordering' && !Array.isArray(key.correct_order)) {
    for (const alias of ['order', 'sequence', 'correct_option_ids']) if (Array.isArray(key[alias])) { key.correct_order = key[alias]; break; }
  }
  let grader = String(a.grader ?? 'self');
  if (grader === 'llm_rubric' && !Array.isArray(a.rubric)) grader = 'self';
  const max = Number(a.max_score);
  const out: Raw = {
    id,
    kind,
    prompt: String(a.prompt ?? ''),
    bloom: BLOOMS.includes(String(a.bloom)) ? a.bloom : 'understand',
    grader,
    max_score: Number.isInteger(max) && max >= 1 && max <= 100 ? max : 100,
  };
  if (options) out.options = options;
  if (Object.keys(key).length || ['mcq', 'multi_select', 'ordering', 'numeric', 'cloze', 'code'].includes(kind)) out.answer_key = key;
  if (Array.isArray(a.rubric)) out.rubric = a.rubric;
  if (typeof a.explanation === 'string' && a.explanation.trim()) out.explanation = a.explanation;

  // Checker state: draft `status` (or an already course-shaped `verdict`)
  const status = (typeof a.status === 'string' ? a.status : undefined) as ItemStatus | undefined;
  const verdict = (status && VERDICT_OF[status]) ?? (typeof a.verdict === 'string' ? a.verdict : undefined);
  if (verdict) out.verdict = verdict;
  const labels = new Set((Array.isArray(a.labels) ? a.labels : []).filter(l => (ITEM_LABELS as readonly unknown[]).includes(l)) as string[]);
  if (verdict === 'not_covered') labels.add('beyond_slides');
  if (labels.size) out.labels = [...labels];

  const cites: Cite[] = Array.isArray(a.cites) ? [...(a.cites as Cite[])] : [];
  if (Array.isArray(a.cite_chunk_ids) && o.resolveCite) {
    for (const cid of a.cite_chunk_ids) {
      const q = typeof a.quote === 'string' && a.quote.trim() ? a.quote : typeof a.explanation === 'string' ? a.explanation : undefined;
      const c = typeof cid === 'number' ? o.resolveCite(cid, q) : null;
      if (c) cites.push(c);
    }
  }
  if (cites.length) out.cites = dedupeCites(cites);
  return out;
}

const isDropped = (a: Raw) => DROPPED_STATUSES.includes(a.status as ItemStatus);

export function fromSaasLesson(saas: SaasLesson, o: FromSaasOptions): CourseLesson {
  const nextBlockId = idAllocator('b', saas.blocks.map(b => b.id));
  const nextItemId = idAllocator('q', saas.blocks.flatMap(b => (b.assessments ?? []).map(a => a.id)));
  const seen = new Set<string>();
  const blocks: Raw[] = [];
  const orphans: Raw[] = [];
  for (const b of saas.blocks) {
    if (!isEnabledType(b.type)) { o.warn?.(`${o.id}: dropped disabled block type ${b.type}`); continue; }
    if (SINGLETON.includes(b.type as BlockType) && seen.has(b.type)) { o.warn?.(`${o.id}: dropped a second ${b.type} (singleton)`); continue; }
    seen.add(b.type);
    const id = nextBlockId(b.id);
    const payload = { ...b.payload };
    let title = b.title ?? null;
    if (b.type === 'explainer' && typeof payload.markdown === 'string') {   // a leading "# Heading" becomes the title
      const m = payload.markdown.match(/^\s*#{1,3}\s+(.+)\n+/);
      if (m) { title = title ?? m[1]!.trim(); payload.markdown = payload.markdown.slice(m[0].length); }
    }
    if (b.type === 'example' && typeof payload.title === 'string') title = title ?? payload.title;
    const items = (b.assessments ?? []).filter(a => !isDropped(a)).map(a => normaliseItem(a, nextItemId(a.id), o));
    const carries = CARRIES_ASSESSMENTS.includes(b.type as BlockType);
    if (!carries) orphans.push(...items);
    const cites = [
      ...(Array.isArray(b.cites) ? b.cites : []),
      ...(b.source_material_ids ?? []).map(cid => o.resolveCite?.(cid) ?? null).filter((c): c is Cite => !!c),
    ];
    blocks.push({ id, type: b.type, title, payload, cites: dedupeCites(cites), assessments: carries ? items : [] });
  }
  if (orphans.length) blocks.push({ id: nextBlockId(undefined), type: 'quiz', title: null, payload: {}, cites: [], assessments: orphans });
  const kept = blocks.filter(b => !(b.type === 'quiz' && (b.assessments as unknown[]).length === 0));
  const lesson: CourseLesson = {
    id: o.id,
    n: o.n ?? 1,
    title: o.title,
    summary: o.summary ?? '',
    archetype: o.archetype,
    minutes: o.minutes ?? 15,
    track: o.track ?? 'core',
    parent: o.parent ?? null,
    mark: o.mark ?? null,
    section: o.section ?? null,
    day: o.day ?? null,
    formats: plannedBlockTypes(o.archetype),
    ...(o.thin ? { thin: true } : {}),
    blocks: kept as unknown as CourseLesson['blocks'],
    narration: null,
  };
  if (o.narration) {
    if (narrationMatches(lesson, o.narration)) lesson.narration = o.narration;
    else o.warn?.(`${o.id}: narration cues do not match the lesson's sentences (lesson changed after narrate); narration dropped`);
  }
  return lesson;
}

/**
 * The draft's items that never reach the course (status contradicted/excluded), shaped for receipts.excluded.
 * `replaced_by` = the id of the item whose `replaces` names it. Pass the same resolveCite as fromSaasLesson.
 */
export function excludedItems(lessonId: string, saas: SaasLesson,
  resolveCite?: (chunkId: number, quote?: string) => Cite | null): ExcludedItem[] {
  const items = saas.blocks.flatMap(b => b.assessments ?? []);
  return items.filter(isDropped).map(a => {
    const q = typeof a.quote === 'string' && a.quote.trim() ? a.quote : a.explanation;
    const quote = typeof q === 'string' && q.trim() ? q : undefined;
    const cid = Array.isArray(a.cite_chunk_ids) ? a.cite_chunk_ids.find(x => typeof x === 'number') as number | undefined : undefined;
    const cite = cid !== undefined ? resolveCite?.(cid, quote) ?? undefined : undefined;
    const by = items.find(x => x.replaces === a.id && !isDropped(x));
    return {
      lesson: lessonId,
      item: String(a.id ?? ''),
      prompt: String(a.prompt ?? ''),
      reason: typeof a.reason === 'string' && a.reason.trim() ? a.reason : 'Contradicted by the cited source.',
      ...(quote ? { quote } : {}),
      ...(cite ? { cite } : {}),
      replaced_by: by ? String(by.id) : null,
    };
  });
}

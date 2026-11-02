// What the prompts are fed: the learner brief (from crew/goal.json), a lesson's neighbours, and its source chunks.
// Retrieval uses WP1's retrieve.ts (minisearch, SaaS term recipe); if that module is unavailable it falls back to
// a small local keyword scorer with the same recipe, so outline/draft never die on a missing index.
import type { Chunk, CourseBrief, Goal, IngestResult, Lesson, OutlineResult, PlanResult } from '@bilimind/core';
import { defaultTimeZone } from '../export/time.ts';
import { buildIndex, retrieveForLesson } from '../retrieve.ts';
import { isFrontMatter } from '../sources.ts';
import type { Neighbour } from './expand.ts';

/** crew/goal.json may hold only {sentence} when `goal` was skipped: fill the safe defaults. */
export function goalDefaults(g: Partial<Goal> | null | undefined): Goal {
  return {
    sentence: g?.sentence ?? '',
    ...(g?.topic ? { topic: g.topic } : {}),
    ...(g?.title ? { title: g.title } : {}),
    deadline: g?.deadline ?? (g?.exam_at ? g.exam_at.slice(0, 10) : null),
    exam_time: g?.exam_time ?? null,
    exam_at: g?.exam_at ?? null,
    timezone: g?.timezone ?? defaultTimeZone(),
    minutes_per_day: g?.minutes_per_day && g.minutes_per_day > 0 ? g.minutes_per_day : 45,
    audience: g?.audience ?? 'student',
    language: g?.language || 'en',
    code_language: g?.code_language ?? null,
    assumptions: g?.assumptions ?? [],
    created_at: g?.created_at ?? new Date(0).toISOString(),
  };
}

export function briefFromGoal(goal: Goal, opts: { title?: string; hasMaterials: boolean }): CourseBrief {
  const deadline = goal.deadline
    ? goal.deadline + (goal.exam_time ? ` ${goal.exam_time}` : '')
    : undefined;
  return {
    topic: goal.topic?.trim() || goal.sentence,
    ...(opts.title ?? goal.title ? { title: opts.title ?? goal.title } : {}),
    language: goal.language || 'en',
    ...(goal.sentence ? { goal: goal.sentence } : {}),
    ...(deadline ? { deadline } : {}),
    minutes_per_day: goal.minutes_per_day,
    source_type: opts.hasMaterials ? 'materials' : 'topic',
    audience: goal.audience,
  };
}

// ---------- retrieval ----------
const STOPWORDS = new Set(('the and for with from that this these those what when how why into onto your you are was were will shall can its his her their '
  + 'about over under between introduction intro overview basics fundamentals part chapter lesson module section').split(' '));

/** The SaaS term recipe (local copy for the fallback scorer and exam-map's explainable matching). */
export function terms(text: string, max = 24): string[] {
  const out: string[] = [];
  for (const t of text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^\p{L}\p{N}]+/u)) {
    if (t.length < 3 || STOPWORDS.has(t) || out.includes(t)) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

const countWords = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length;

interface Scored { chunk: Chunk; score: number; terms: string[] }

/** Local scorer: term frequency x idf, prefix match for terms of 4+ chars. */
export function localSearch(pool: Chunk[], query: string, limit: number): Scored[] {
  const q = terms(query);
  if (!q.length) return [];
  const toks = pool.map(c => terms(c.content, 100000));
  const df = new Map<string, number>();
  for (const t of q) df.set(t, toks.filter(ts => ts.some(w => w === t || (t.length >= 4 && w.startsWith(t)))).length);
  const scored = pool.map((chunk, i) => {
    const hit: string[] = [];
    let score = 0;
    const lower = chunk.content.toLowerCase();
    for (const t of q) {
      const n = toks[i]!.some(w => w === t || (t.length >= 4 && w.startsWith(t))) ? (lower.split(t).length - 1 || 1) : 0;
      if (!n) continue;
      hit.push(t);
      score += (1 + Math.log(n)) * Math.log(1 + pool.length / (df.get(t) || 1));
    }
    return { chunk, score, terms: hit };
  });
  return scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Chunks a lesson may cite: everything except past papers (a lesson teaches from the slides, not from the exam) and
 * front matter (title, learning-outcomes and references slides are never evidence: G2 review).
 */
export function teachingChunks(ingest: Pick<IngestResult, 'files' | 'chunks'>): Chunk[] {
  const exam = new Set(ingest.files.filter(f => f.role === 'past_paper' || f.role === 'other').map(f => f.material_id));
  return ingest.chunks.filter(c => !exam.has(c.material_id) && c.content.trim() && !isFrontMatter(c));
}

const indexCache = new WeakMap<Chunk[], ReturnType<typeof buildIndex> | null>();
function wp1Index(pool: Chunk[]) {
  if (!indexCache.has(pool)) {
    try { indexCache.set(pool, buildIndex(pool)); } catch { indexCache.set(pool, null); }
  }
  return indexCache.get(pool) ?? null;
}

export interface LessonSources { chunks: Chunk[]; supportWords: number; thin: boolean }
export const THIN_WORDS = 150;

/**
 * Top `limit` (6) chunks for a lesson, at least `minimum` (2) when anything exists; thin = fewer than ~150 words
 * in chunks that genuinely match (2+ query terms).
 */
export function lessonSources(pool: Chunk[], lesson: { title: string; summary?: string; concept_key?: string }, limit = 6, minimum = 2): LessonSources {
  const query = [lesson.title, lesson.summary ?? '', (lesson.concept_key ?? '').replace(/[._]/g, ' ')].join(' ');
  let chunks: Chunk[] | null = null;
  let scored: Scored[] | null = null;
  const idx = wp1Index(pool);
  if (idx) {
    try {
      chunks = retrieveForLesson(idx, pool, lesson, { limit, minimum });
      scored = idx.search(query, limit);
    } catch { chunks = null; scored = null; }
  }
  if (!scored) scored = localSearch(pool, query, limit);
  if (!chunks) {
    chunks = scored.map(s => s.chunk);
    if (chunks.length < minimum) {   // every lesson gets its best chunks even on weak overlap
      for (const c of pool) { if (chunks.length >= minimum) break; if (!chunks.includes(c)) chunks.push(c); }
    }
  }
  const supportWords = scored.filter(s => s.terms.length >= 2).reduce((n, s) => n + countWords(s.chunk.content), 0);
  return { chunks, supportWords, thin: supportWords < THIN_WORDS };
}

/**
 * G2 review: retrieval left holes inside the lesson's own slide run (heaps got L04 slides 3, 4, 6, 8, 10-13, missing
 * the insert and extract traces on slides 5, 7 and 9). Fill the holes between the first and last picked slide of the
 * lesson's dominant deck, skipping front matter and slides a cut topic owns, up to `cap` chunks in all.
 */
export function fillSlideRange(picked: Chunk[], pool: Chunk[], o: { lesson: Lesson; outline: OutlineResult; plan?: PlanResult | null; cap: number }): Chunk[] {
  const slideNo = (c: Chunk) => { const m = /^\s*slide\s+(\d+)\s*$/i.exec(c.locator ?? ''); return m ? Number(m[1]) : null; };
  const count = new Map<number, number>();
  for (const c of picked) if (slideNo(c) !== null) count.set(c.material_id, (count.get(c.material_id) ?? 0) + 1);
  const deck = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (deck === undefined || picked.length >= o.cap) return picked;
  const nums = picked.filter(c => c.material_id === deck).map(slideNo).filter((n): n is number => n !== null);
  const lo = Math.min(...nums), hi = Math.max(...nums);
  const kept = new Set((o.plan?.lessons ?? []).map(l => l.key));
  const own = new Set(o.lesson.chunk_ids ?? []);
  const cutOwned = new Set(o.plan?.lessons?.length
    ? o.outline.lessons.filter(l => l.key !== o.lesson.key && !kept.has(l.key)).flatMap(l => l.chunk_ids ?? []).filter(id => !own.has(id))
    : []);
  const have = new Set(picked.map(c => c.id));
  const holes = pool.filter(c => c.material_id === deck && !have.has(c.id) && !cutOwned.has(c.id) && !isFrontMatter(c))
    .filter(c => { const n = slideNo(c); return n !== null && n > lo && n < hi; })
    .sort((a, b) => slideNo(a)! - slideNo(b)!);
  if (!holes.length) return picked;
  const out = [...picked, ...holes.slice(0, o.cap - picked.length)];
  return out.sort((a, b) => (a.material_id === deck ? 0 : 1) - (b.material_id === deck ? 0 : 1) || a.material_id - b.material_id || a.ordinal - b.ordinal);
}

// ---------- neighbours ----------
/**
 * Prerequisites / dependents for the writer. With a plan: the kept lessons in plan order (what the learner really
 * studies). Without: engine-port §3.5 compact rule (previous core topic + parent; next core topic + own subtopics).
 */
export function lessonNeighbours(outline: OutlineResult, key: string, plan?: PlanResult | null): { prerequisites: Neighbour[]; dependents: Neighbour[] } {
  const by = new Map(outline.lessons.map(l => [l.key, l]));
  const nb = (l: Lesson | undefined): Neighbour[] => (l ? [{ title: l.title, summary: l.summary }] : []);
  const kept = plan?.lessons?.length ? [...plan.lessons].sort((a, b) => a.order - b.order).map(p => p.key).filter(k => by.has(k)) : null;
  if (kept && kept.includes(key)) {
    const i = kept.indexOf(key);
    return { prerequisites: nb(by.get(kept[i - 1] ?? '')), dependents: nb(by.get(kept[i + 1] ?? '')) };
  }
  const lessons = outline.lessons;
  const me = by.get(key);
  if (!me) return { prerequisites: [], dependents: [] };
  const i = lessons.indexOf(me);
  const prevCore = [...lessons.slice(0, i)].reverse().find(l => l.track === 'core' && l.key !== me.branch_of);
  const nextCore = lessons.slice(i + 1).find(l => l.track === 'core');
  const children = lessons.filter(l => l.branch_of === key);
  const prerequisites = me.track === 'core' ? nb(prevCore) : nb(by.get(me.branch_of ?? ''));
  return { prerequisites, dependents: [...nb(nextCore), ...children.map(c => ({ title: c.title, summary: c.summary }))].slice(0, 8) };
}

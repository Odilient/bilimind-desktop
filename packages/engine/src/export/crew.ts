// Reading the crew/ workbench for WP4 (narrate, review, export, build): the files, the kept lessons in plan
// order with their fromSaasLesson() meta, and the chunk-id -> Cite resolver. One place, so narrate's cue ids,
// review's card ids and build's course.json all come from the SAME course-shaped lessons.
// Owner: WP4.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename } from 'node:path';
import {
  FALLBACK_ARCHETYPE, fromSaasLesson, parseArchetype, splitSentences,
} from '@bilimind/core';
import type {
  Chunk, Cite, CourseLesson, ExamMap, FromSaasOptions, SaasLesson, Goal, IngestResult, LessonContent, LogEvent, NarrationIndex,
  OutlineResult, PlanResult, ReviewState, SourceFile,
} from '@bilimind/core';
import { BilimindError } from '../contracts.ts';
import type { CoursePaths } from '../contracts.ts';
import { coursePaths, readJson, readJsonOrNull } from '../course.ts';
import { DEFAULT_TIMEZONE } from './time.ts';

export interface Crew {
  course: string;
  paths: CoursePaths;
  goal: Goal;
  ingest: IngestResult | null;
  outline: OutlineResult;
  examMap: ExamMap | null;
  plan: PlanResult | null;
  narration: NarrationIndex | null;
  state: ReviewState | null;
  timezone: string;
}

/** Reads every crew file WP4 needs. Only outline.json is required. */
export function loadCrew(course: string): Crew {
  const paths = coursePaths(course);
  if (!existsSync(paths.outline)) throw new BilimindError('No outline yet (crew/outline.json is missing).', 'Run `outline` and `plan` first, then draft the lessons.');
  const rawGoal = readJsonOrNull<Partial<Goal>>(paths.goal) ?? {};
  const goal: Goal = {
    sentence: rawGoal.sentence ?? '',
    topic: rawGoal.topic, title: rawGoal.title,
    deadline: rawGoal.deadline ?? null,
    exam_time: rawGoal.exam_time ?? null,
    exam_at: rawGoal.exam_at ?? null,
    timezone: rawGoal.timezone || DEFAULT_TIMEZONE,
    minutes_per_day: rawGoal.minutes_per_day && rawGoal.minutes_per_day > 0 ? rawGoal.minutes_per_day : 30,
    audience: rawGoal.audience === 'staff' ? 'staff' : 'student',
    language: rawGoal.language || 'en',
    code_language: rawGoal.code_language ?? null,
    assumptions: Array.isArray(rawGoal.assumptions) ? rawGoal.assumptions : [],
    created_at: rawGoal.created_at ?? new Date().toISOString(),
  };
  return {
    course: paths.root, paths, goal,
    ingest: readJsonOrNull<IngestResult>(paths.ingest),
    outline: readJson<OutlineResult>(paths.outline),
    examMap: readJsonOrNull<ExamMap>(paths.examMap),
    plan: readJsonOrNull<PlanResult>(paths.plan),
    narration: readJsonOrNull<NarrationIndex>(paths.narrationJson),
    state: readJsonOrNull<ReviewState>(paths.reviewState),
    timezone: goal.timezone,
  };
}

export type LessonMeta = Omit<FromSaasOptions, 'resolveCite' | 'narration' | 'warn'> & { id: string; n: number };
export interface PlannedLessonEntry { key: string; meta: LessonMeta; draft: LessonContent }

/**
 * The lessons that go into the course, in plan order (plan.json lessons; without a plan: outline order),
 * each with its draft. Kept lessons without a draft are skipped with a warning.
 */
export function plannedLessons(crew: Crew, warn: (m: string) => void = () => {}): PlannedLessonEntry[] {
  const nodes = crew.outline.lessons ?? [];
  const byKey = new Map(nodes.map(n => [n.key, n]));
  const planned = crew.plan?.lessons?.length
    ? [...crew.plan.lessons].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : nodes.slice().sort((a, b) => a.index - b.index).map((n, i) => ({ key: n.key, title: n.title, day: null as unknown as string, minutes: n.estimated_minutes, weight: null, order: i }));
  const out: PlannedLessonEntry[] = [];
  for (const p of planned) {
    const file = crew.paths.lessonJson(p.key);
    if (!existsSync(file)) { if (crew.plan?.lessons?.length) warn(`${p.key}: no draft (crew/lessons/${p.key}.json), lesson left out`); continue; }
    const draft = readJson<LessonContent>(file);
    if (!Array.isArray(draft.blocks) || !draft.blocks.length) { warn(`${p.key}: draft has no blocks, lesson left out`); continue; }
    const node = byKey.get(p.key);
    const parentNode = node?.branch_of ? byKey.get(node.branch_of)
      : node?.parent !== null && node?.parent !== undefined ? nodes.find(n => n.index === node.parent) : undefined;
    const minutes = Number(p.minutes) > 0 ? Number(p.minutes) : node?.estimated_minutes && node.estimated_minutes > 0 ? node.estimated_minutes : 15;
    out.push({
      key: p.key,
      draft,
      meta: {
        id: p.key,
        n: out.length + 1,
        title: node?.title || p.title || p.key,
        summary: node?.summary ?? '',
        archetype: parseArchetype(node?.archetype) ?? FALLBACK_ARCHETYPE,
        minutes,
        track: node?.track === 'subtopic' ? 'subtopic' : 'core',
        parent: parentNode && parentNode.key !== p.key ? parentNode.key : null,
        mark: node?.mark ?? null,
        section: node?.section ?? null,
        day: typeof p.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.day) ? p.day : null,
        thin: !!node?.thin,
      },
    });
  }
  return out;
}

/** Course-shaped lesson (core fromSaasLesson), the ONE conversion narrate/review/build share. */
export function toCourseLesson(entry: PlannedLessonEntry, extra: Pick<FromSaasOptions, 'resolveCite' | 'narration' | 'warn'> = {}): CourseLesson {
  return fromSaasLesson(entry.draft as unknown as SaasLesson, { ...entry.meta, ...extra });
}

// ---------- citations ----------
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** 'sources/<name>' for a source file (the key into course.sources[].file). */
export function sourceRef(f: Pick<SourceFile, 'name' | 'path'>): string {
  const p = (f.path || '').replace(/\\/g, '/');
  return p.startsWith('sources/') ? p : `sources/${f.name || basename(p)}`;
}

/** First substantive sentence of a chunk (the quote a block's chip shows). */
export function chunkSentence(content: string): string {
  const sentences = splitSentences(content);
  const pick = sentences.find(s => s.split(/\s+/).length >= 5) ?? sentences[0] ?? norm(content);
  return pick.length > 220 ? pick.slice(0, pick.lastIndexOf(' ', 217) > 60 ? pick.lastIndexOf(' ', 217) : 217) + '…' : pick;
}

const words = (s: string) => new Set(s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 3));
/**
 * The quote a chip shows must be verbatim in the chunk: the given quote when it is (whitespace/case-insensitive),
 * else the chunk sentence sharing the most words with it (a paraphrased explanation), else the first sentence.
 */
export function verbatimQuote(content: string, quote: string): string {
  const q = norm(quote);
  const text = norm(content);
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  if (at >= 0) return text.slice(at, at + q.length);          // the source's own casing
  const want = words(q);
  let best = '';
  let score = 0;
  for (const s of splitSentences(content)) {
    let n = 0;
    for (const w of words(s)) if (want.has(w)) n++;
    if (n > score) { score = n; best = s; }
  }
  return score >= 2 ? (best.length > 300 ? chunkSentence(best) : best) : chunkSentence(content);
}

/** <= max chars of the chunk around the quote (the quote always inside when found). */
export function excerptAround(content: string, quote: string, max = 700): string {
  const text = norm(content);
  if (text.length <= max) return text;
  const q = norm(quote).replace(/…$/, '');
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) {
    const cut = text.lastIndexOf(' ', max - 2);
    return text.slice(0, cut > max / 2 ? cut : max - 2) + ' …';
  }
  const room = Math.max(0, max - 4 - q.length);
  let start = Math.max(0, at - Math.floor(room / 2));
  let end = Math.min(text.length, start + q.length + room);
  start = Math.max(0, end - q.length - room);
  if (start > 0) { const sp = text.indexOf(' ', start); if (sp > 0 && sp < at) start = sp + 1; }
  if (end < text.length) { const sp = text.lastIndexOf(' ', end); if (sp > at + q.length) end = sp; }
  return (start > 0 ? '… ' : '') + text.slice(start, end) + (end < text.length ? ' …' : '');
}

/**
 * chunk id -> Cite: {file 'sources/<name>', locator (chunk locator, else 'Page N', else the file title), page,
 * quote (the Checker's quote, else the chunk's first substantive sentence), excerpt <= 700 chars containing the quote, chunk_id}.
 */
export function makeCiteResolver(ingest: IngestResult | null): (chunkId: number, quote?: string) => Cite | null {
  if (!ingest) return () => null;
  const chunks = new Map<number, Chunk>(ingest.chunks.map(c => [c.id, c]));
  const files = new Map<number, SourceFile>(ingest.files.map(f => [f.material_id, f]));
  return (chunkId, quote) => {
    const chunk = chunks.get(chunkId);
    if (!chunk) return null;
    const file = files.get(chunk.material_id);
    if (!file) return null;
    const q = quote && quote.trim() ? verbatimQuote(chunk.content, quote) : chunkSentence(chunk.content);
    if (!q) return null;
    const locator = chunk.locator?.trim() || (chunk.page ? `Page ${chunk.page}` : file.title || file.name);
    return {
      file: sourceRef(file),
      locator,
      page: chunk.page && chunk.page >= 1 ? chunk.page : null,
      quote: q,
      excerpt: excerptAround(chunk.content, q),
      chunk_id: chunk.id,
    };
  };
}

// ---------- log ----------
/** crew/log.jsonl, tolerant of a half-written last line. */
export function readCrewLog(course: string): LogEvent[] {
  const file = coursePaths(course).log;
  if (!existsSync(file)) return [];
  const out: LogEvent[] = [];
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line) as LogEvent); } catch { /* skip a torn line */ }
  }
  return out;
}

// ---------- licence notes (sources/LICENSE*.md) ----------
/** {attribution line, licence per file name} from sources/LICENSE*.md (ingest skips these files). */
export function readLicenceNotes(sourcesDir: string): { attribution: string | null; byFile: Map<string, string> } {
  const byFile = new Map<string, string>();
  let attribution: string | null = null;
  if (!existsSync(sourcesDir)) return { attribution, byFile };
  for (const name of readdirSync(sourcesDir).filter(n => /^licen[cs]e.*\.md$/i.test(n))) {
    const text = readFileSync(`${sourcesDir}/${name}`, 'utf8');
    for (const row of text.split(/\r?\n/).filter(l => l.trim().startsWith('|'))) {
      const cells = row.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length < 2) continue;
      const file = cells[0]!.replace(/[`*]/g, '').trim();
      if (/\.[a-z0-9]{2,5}$/i.test(file)) byFile.set(file, cells[cells.length - 1]!.replace(/[`*]/g, ''));
    }
    if (!attribution) {
      const m = text.match(/^#+\s*Attribution[^\n]*\n+([\s\S]*?)(\n\s*\n|$)/im);
      const para = m?.[1] ? norm(m[1].replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')) : '';
      if (para) attribution = para.length > 320 ? para.slice(0, para.lastIndexOf(' ', 317)) + '…' : para;
    }
  }
  return { attribution, byFile };
}

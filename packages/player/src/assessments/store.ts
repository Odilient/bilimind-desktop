// Learner state for the interactive blocks, all in localStorage under bm:<courseId>:* (PLAN 5.2 WP5a contract):
//   bm:<id>:progress  { lessons: { <lessonId>: { seen: [], passed: ["b4"], done?, at? } } }   (shared with the shell)
//   bm:<id>:fsrs      { <cardId>: FsrsState }   quiz items '<lesson>/<item>', flashcards '<lesson>/<block>/c<n>'
//   bm:<id>:ui        { '<lesson>/<block>': per-block UI state (ticks, code drafts, ratings) }
// Every write also fires a window CustomEvent ('bm:progress' / 'bm:fsrs') so the shell can refresh its own
// reactive copy instead of overwriting ours. Storage failures (private mode, quota) are swallowed: the
// blocks keep working in memory.
import { newCard, rateCard } from '@bilimind/core';
import type { Course, FsrsState } from '@bilimind/core';

export type Rating = 'again' | 'hard' | 'good' | 'easy';
export const RATINGS: Rating[] = ['again', 'hard', 'good', 'easy'];

const key = (courseId: string, name: string) => `bm:${courseId}:${name}`;

export function readJson<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return fallback;
    const v = JSON.parse(raw) as unknown;
    return (v && typeof v === 'object' ? v : fallback) as T;
  } catch { return fallback; }
}
export function writeJson(k: string, v: unknown): void {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* in-memory only */ }
}
function emit(name: string, detail: Record<string, unknown>): void {
  try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch { /* no window (tests) */ }
}

// ---------- progress (passed blocks) ----------
interface LessonProgress { seen?: string[]; passed?: string[]; done?: boolean; at?: number; [k: string]: unknown }
interface Progress { lessons?: Record<string, LessonProgress>; [k: string]: unknown }

export function isPassedStored(courseId: string, lessonId: string, blockId: string): boolean {
  const p = readJson<Progress>(key(courseId, 'progress'), {});
  return !!p.lessons?.[lessonId]?.passed?.includes(blockId);
}

/** Record a task block as passed (idempotent). The shell's table of blocks and finish card read this. */
export function markPassed(courseId: string, lessonId: string, blockId: string, passed = true): void {
  const k = key(courseId, 'progress');
  const p = readJson<Progress>(k, {});
  const lessons = (p.lessons ??= {});
  const l = (lessons[lessonId] ??= {});
  const list = new Set(l.passed ?? []);
  const had = list.has(blockId);
  if (passed) list.add(blockId); else list.delete(blockId);
  l.passed = [...list];
  if (!l.seen) l.seen = [];
  if (passed && !l.seen.includes(blockId)) l.seen.push(blockId);
  writeJson(k, { v: 1, ...p });
  if (had !== passed) emit('bm:progress', { course: courseId, lesson: lessonId, block: blockId, passed });
  // the shell's runtime/progress.ts keeps a reactive copy and listens for this on document
  if (passed) {
    try { document.dispatchEvent(new CustomEvent('bm:passed', { bubbles: true, detail: { lesson: lessonId, block: blockId } })); } catch { /* no DOM */ }
  }
}

// ---------- per-block UI state ----------
export function loadUi<T>(courseId: string, id: string, fallback: T): T {
  const all = readJson<Record<string, unknown>>(key(courseId, 'ui'), {});
  return (id in all ? all[id] : fallback) as T;
}
export function saveUi(courseId: string, id: string, value: unknown): void {
  const k = key(courseId, 'ui');
  const all = readJson<Record<string, unknown>>(k, {});
  if (value === undefined || value === null) delete all[id]; else all[id] = value;
  writeJson(k, all);
}

// ---------- FSRS ----------
export function readFsrs(courseId: string): Record<string, FsrsState> {
  return readJson<Record<string, FsrsState>>(key(courseId, 'fsrs'), {});
}
function cardState(courseId: string, cardId: string, now: Date): FsrsState {
  return readFsrs(courseId)[cardId] ?? newCard(now, now);
}
const examOf = (course: Course): string | null => course.goal?.exam_at ?? null;

/** Rate one card with core FSRS (due capped before the exam) and persist it. */
export function rate(course: Course, cardId: string, rating: Rating, now = new Date()): FsrsState {
  const next = rateCard(cardState(course.id, cardId, now), rating, now, { notAfter: examOf(course) });
  const k = key(course.id, 'fsrs');
  const all = readFsrs(course.id);
  all[cardId] = next;
  writeJson(k, all);
  emit('bm:fsrs', { course: course.id, card: cardId, rating, due: next.due });
  return next;
}

/** "<1 min" / "10 min" / "5 h" / "3 days": how long until a card comes back. */
export function formatInterval(ms: number): string {
  if (ms < 60_000) return '<1 min';
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'}`;
}

/** The next interval each rating would give, without saving (the labels under Again/Hard/Good/Easy). */
export function previewIntervals(course: Course, cardId: string, now = new Date()): Record<Rating, string> {
  const s = cardState(course.id, cardId, now);
  const out = {} as Record<Rating, string>;
  for (const r of RATINGS) {
    try {
      const n = rateCard(s, r, now, { notAfter: examOf(course) });
      out[r] = formatInterval(new Date(n.due).getTime() - now.getTime());
    } catch { out[r] = ''; }
  }
  return out;
}

/** Quiz answer -> FSRS rating, using the learner's confidence when they gave one. */
export function ratingFor(correct: boolean, ratio: number, confidence: Confidence | null): Rating {
  if (!correct) return ratio >= 0.5 ? 'hard' : 'again';
  if (confidence === 'guess') return 'hard';
  if (confidence === 'sure') return 'easy';
  return 'good';
}

export type Confidence = 'guess' | 'think' | 'sure';

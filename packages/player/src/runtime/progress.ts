// Learner progress, persisted per course in localStorage (keys bm:<courseId>:*; every access is
// try/catch so a blocked storage never breaks the page). Reactive, so the home ring, the path and
// the table of blocks update together.
//
// Blocks report a passed task either by calling markPassed(lessonId, blockId) or, without importing
// anything, by dispatching a bubbling DOM event from their root element:
//   el.dispatchEvent(new CustomEvent('bm:passed', { bubbles: true, detail: { lesson, block } }))
import { reactive } from 'vue';

export interface LessonProgress { seen: string[]; passed: string[]; done: boolean; at?: number }
export interface ProgressState { v: 1; lessons: Record<string, LessonProgress>; last?: string }
export interface Prefs { density?: 'stage' | ''; text?: 'S' | 'M' | 'L'; night?: boolean }

export const storageKey = (courseId: string, key: string): string => `bm:${courseId}:${key}`;

export function readJson<T>(key: string): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
export function writeJson(key: string, value: unknown): void {
  try { globalThis.localStorage?.setItem(key, JSON.stringify(value)); } catch { /* storage blocked or full */ }
}

/** Sanitise whatever was stored (older shapes, hand edits) into a valid state. */
export function normaliseProgress(raw: unknown): ProgressState {
  const out: ProgressState = { v: 1, lessons: {} };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as { lessons?: unknown; last?: unknown };
  if (typeof r.last === 'string') out.last = r.last;
  if (r.lessons && typeof r.lessons === 'object') {
    for (const [id, v] of Object.entries(r.lessons as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const l = v as Partial<LessonProgress>;
      out.lessons[id] = {
        seen: Array.isArray(l.seen) ? l.seen.filter((x): x is string => typeof x === 'string') : [],
        passed: Array.isArray(l.passed) ? l.passed.filter((x): x is string => typeof x === 'string') : [],
        done: l.done === true,
        ...(typeof l.at === 'number' ? { at: l.at } : {}),
      };
    }
  }
  return out;
}

let courseId = '';
export const progress = reactive<ProgressState>({ v: 1, lessons: {} });
export const prefs = reactive<Prefs>({});

export function initProgress(id: string): void {
  courseId = id;
  const p = normaliseProgress(readJson(storageKey(id, 'progress')));
  progress.lessons = p.lessons;
  progress.last = p.last;
  Object.assign(prefs, readJson<Prefs>(storageKey(id, 'prefs')) ?? {});
}

function save(): void { if (courseId) writeJson(storageKey(courseId, 'progress'), { v: 1, lessons: progress.lessons, last: progress.last }); }
export function savePrefs(): void { if (courseId) writeJson(storageKey(courseId, 'prefs'), { ...prefs }); }

export function lessonProgress(id: string): LessonProgress {
  if (!progress.lessons[id]) progress.lessons[id] = { seen: [], passed: [], done: false };
  return progress.lessons[id]!;
}
export const isDone = (id: string | null | undefined): boolean => !!id && progress.lessons[id]?.done === true;

export function markSeen(lesson: string, block: string): void {
  const l = lessonProgress(lesson);
  if (l.seen.includes(block)) return;
  l.seen.push(block);
  progress.last = lesson;
  save();
}
export function markPassed(lesson: string, block: string): void {
  const l = lessonProgress(lesson);
  if (!l.seen.includes(block)) l.seen.push(block);
  if (l.passed.includes(block)) return;
  l.passed.push(block);
  save();
}
export function setDone(lesson: string, done: boolean, at: number = Date.now()): void {
  const l = lessonProgress(lesson);
  l.done = done;
  if (done) l.at = at; else delete l.at;
  progress.last = lesson;
  save();
}
export function resetProgress(): void {
  progress.lessons = {};
  delete progress.last;
  save();
}

/** Listen for blocks reporting a passed task (see the header). */
export function listenForPassed(target: EventTarget = document): void {
  target.addEventListener('bm:passed', (e: Event) => {
    const d = (e as CustomEvent<{ lesson?: string; block?: string }>).detail;
    if (d?.lesson && d.block) markPassed(d.lesson, d.block);
  });
}

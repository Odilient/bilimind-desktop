import type { CourseNode } from '~/types/api'

/**
 * How long the model's work takes, so a screen can say so.
 *
 * Measured on production on 2026-10-08, from `generation_runs` over the last
 * 45 days, successful runs only:
 *
 *   drawing the plan (outline, pro)   p50 114s   p90 195s   n=21
 *   writing one lesson (expand_node)  p50  82s   p90 217s   n=605
 *   parts, one batch of six steps     121s, 173s and 10s on the latest course
 *
 * and, from one outline streamed the same day: ~54s of reasoning before the
 * first step is written, then a step every one to two seconds. Researching a
 * lesson before it is written took 24–41s on three lessons the same day.
 *
 * A lesson's clock (`writing_for`) starts with the model call. Research comes
 * before it, while the lesson still says "waiting" — so a lesson still to be
 * written costs research plus writing, and one being written only the rest of
 * its writing.
 *
 * Every figure here is shown as "about", and a clock that runs past one says
 * "taking longer than usual" instead of counting below zero. An estimate that
 * turns out generous is a pleasant surprise; one that is short is a broken
 * promise, so where a figure is unsure it leans long.
 */
export const PACE = {
  planSeconds: 120,
  /** The first, silent part of drawing the plan, before any step appears. */
  planThinkingSeconds: 55,
  /** The model writing one lesson: expand_node's median plus a margin. */
  lessonSeconds: 95,
  /** Finding sources for a lesson, before it is written. */
  researchSeconds: 35,
  /** Past this a lesson is slow enough to say so: expand_node's p90. */
  lessonSlowSeconds: 220,
  partsBatchSeconds: 150,
  /**
   * Lessons written side by side — the API's queue workers (`queue` and
   * `queue-2` in its compose.yml). Change both together.
   */
  writers: 2,
} as const

/** 7 → "0:07", 102 → "1:42". A stopwatch, so it never rounds. */
export function clockLabel(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(whole / 60)
  const rest = whole % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/**
 * A wait in the vaguest words that are still true: "under a minute", "about 3 min".
 * Rounds up, so the number on screen only ever falls as time passes and the
 * wait ends no later than it said.
 */
export function aboutLabel(seconds: number): string {
  if (seconds < 50) return 'under a minute'
  const minutes = Math.max(1, Math.ceil(seconds / 60))
  return minutes === 1 ? 'about a minute' : `about ${minutes} min`
}

/**
 * How long `count` lessons take from a standing start — the same arithmetic
 * `writingQueue` runs once they are under way, so the number the dialog and the
 * toast promise is the number the progress line then counts down from.
 */
export function writingEstimate(count: number): number {
  if (count <= 0) return 0
  return Math.max(perLesson(), (count * perLesson()) / PACE.writers)
}

/**
 * How far through a wait of a known typical length, as a fraction that keeps
 * moving but never arrives: 80% at the typical length, then creeping towards
 * 95%. Only for bars that sit beside a real signal (steps appearing, lessons
 * finishing) — on its own it would be the progress bar that lies.
 */
export function easedProgress(elapsed: number, typical: number): number {
  if (typical <= 0) return 0
  return Math.min(0.95, 1 - Math.exp((-1.6 * Math.max(0, elapsed)) / typical))
}

/**
 * What is probably left of one lesson that has been writing for `elapsed`.
 * Past the usual time it is not "nearly done" — the slow ones are slow by
 * minutes (p90 is more than twice the median) — so it never claims less than
 * most of a minute.
 */
function leftOn(elapsed: number): number {
  if (elapsed < PACE.lessonSeconds) return Math.max(PACE.lessonSeconds - elapsed, 20)
  return Math.max(45, Math.min(90, PACE.lessonSlowSeconds - elapsed))
}

export interface WritingQueue {
  /** Being written now, in reading order. */
  writing: CourseNode[]
  /** Waiting their turn, in reading order — the order the batch takes them in. */
  waiting: CourseNode[]
  /** Seconds until the last of them is written, roughly. */
  secondsLeft: number
  /** Something has been writing for longer than it normally takes. */
  slow: boolean
}

/**
 * The lessons in flight on a course, and roughly how long until they are all
 * written. `elapsed` turns a node's server-counted `writing_for` into a live
 * number (see `useStopwatch`).
 *
 * The estimate assumes `PACE.writers` lessons at once and nothing else in the
 * queue, so on a busy box it is the optimistic end — but each lesson that
 * finishes resets it to the truth.
 */
export function writingQueue(
  ordered: CourseNode[],
  elapsed: (node: CourseNode) => number,
): WritingQueue {
  const writing = ordered.filter((node) => node.status === 'generating')
  const waiting = ordered.filter((node) => node.status === 'queued')

  const leftOnWriting = writing.map((node) => leftOn(elapsed(node)))
  const total = leftOnWriting.reduce((sum, left) => sum + left, 0) + waiting.length * perLesson()
  const secondsLeft = Math.max(Math.max(0, ...leftOnWriting), total / PACE.writers)

  return {
    writing,
    waiting,
    secondsLeft,
    slow: writing.some((node) => elapsed(node) > PACE.lessonSlowSeconds),
  }
}

/**
 * Roughly when a waiting lesson starts: once the lessons ahead of it have
 * cleared the writers. `ahead` counts those still waiting before it.
 */
export function startsIn(ahead: number, queue: WritingQueue, elapsed: (node: CourseNode) => number): number {
  const freeing = queue.writing.map((node) => leftOn(elapsed(node))).sort((a, b) => a - b)
  const freeAt = queue.writing.length < PACE.writers ? 0 : (freeing[0] ?? 0)
  return freeAt + Math.floor(ahead / PACE.writers) * perLesson()
}

/** One lesson from "waiting" to written: its research, then its writing. */
function perLesson(): number {
  return PACE.researchSeconds + PACE.lessonSeconds
}

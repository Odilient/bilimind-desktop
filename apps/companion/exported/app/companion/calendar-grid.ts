/**
 * The Calendar's time grid as numbers: where a block sits in its day, and how
 * blocks that overlap share the column. Google Calendar's way: a cluster of
 * blocks that overlap one another splits the day into as many lanes as it
 * needs at once, and each block takes the first lane free when it starts.
 *
 * Minutes are from the day's midnight, in the learner's zone; the page turns
 * instants into them (`time.ts` `parts`). No imports, so
 * `node scripts/check-calendar-grid.ts` can check it as it is (type imports
 * are erased).
 */
import type { Deadline, PlanTask, Session } from './types'

/** What a click in the grid opens a peek on: a block, or an empty slot to add to. */
export type CalendarTarget =
  | { kind: 'class'; session: Session }
  | { kind: 'due'; deadline: Deadline }
  | { kind: 'task'; task: PlanTask }
  | { kind: 'add'; day: string; minute: number | null }

export const DAY_MINUTES = 24 * 60

/** The shortest a block is drawn, so a 5-minute thing still has a title. */
export const MIN_BLOCK = 25

export interface Span {
  id: string
  start: number
  end: number
}

export interface Placed {
  /** Which lane, from 0. */
  col: number
  /** How many lanes its cluster has. */
  cols: number
}

/** A block's drawn span: at least `MIN_BLOCK` long and never past midnight. */
export function drawn(start: number, end: number): { start: number; end: number } {
  const from = Math.max(0, Math.min(start, DAY_MINUTES - MIN_BLOCK))
  return { start: from, end: Math.min(DAY_MINUTES, Math.max(end, from + MIN_BLOCK)) }
}

/** Lanes for one day's blocks: overlapping ones side by side, the rest full width. */
export function pack(spans: Span[]): Map<string, Placed> {
  const out = new Map<string, Placed>()
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end)
  let cluster: { id: string; col: number }[] = []
  let ends: number[] = []
  let clusterEnd = -1
  const close = (): void => {
    for (const p of cluster) out.set(p.id, { col: p.col, cols: ends.length })
    cluster = []
    ends = []
  }
  for (const s of sorted) {
    if (s.start >= clusterEnd) close()
    let col = ends.findIndex((e) => e <= s.start)
    if (col === -1) {
      col = ends.length
      ends.push(s.end)
    } else {
      ends[col] = s.end
    }
    cluster.push({ id: s.id, col })
    clusterEnd = Math.max(clusterEnd, s.end)
  }
  close()
  return out
}

/** A task's `HH:MM` as minutes from midnight. */
export function minuteOfClock(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Minutes from midnight as `HH:MM`, the form a task's `starts_at` is stored in. */
export function clockOfMinute(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

/** The slot a pointer `offset` px down a day column means: snapped to the half hour, kept inside the day. */
export function slotAt(offset: number, hour: number, length = 30): number {
  const minute = Math.floor((offset / hour) * 2) * 30
  return Math.max(0, Math.min(DAY_MINUTES - Math.max(30, length), minute))
}

/** Where the grid opens: half an hour before the week's first thing, and never after 07:30. */
export function firstView(starts: number[]): number {
  return Math.max(0, Math.min(8 * 60, ...starts) - 30)
}

/**
 * Pen ink: from pointer events to stored points, and from points to the
 * filled outline the canvas paints.
 *
 * Capture follows research/vue-stack.md §5. Every coalesced event is kept,
 * because a pen reports at 240 Hz and the browser hands us one event per
 * frame; dropping the rest is what makes web ink look faceted. Predicted
 * events are drawn but never stored: they are guesses, and the stored stroke
 * has to be what the hand did, with the time each point happened.
 */
import { getStroke } from 'perfect-freehand'
import type { StrokePoint } from './model'

/** Epoch milliseconds of an event, from its high-resolution timestamp. */
export function eventTime(e: PointerEvent): number {
  return performance.timeOrigin + e.timeStamp
}

/**
 * A pen's pressure as reported; a mouse's as a steady middle; a finger's as
 * the same, since most touchscreens report 0 or 1 and nothing between.
 */
export function pressureOf(e: PointerEvent): number {
  if (e.pointerType === 'pen') return Math.max(0.05, e.pressure || 0.05)
  return 0.5
}

export function coalesced(e: PointerEvent): PointerEvent[] {
  const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : []
  return list.length ? list : [e]
}

export function predicted(e: PointerEvent): PointerEvent[] {
  return typeof e.getPredictedEvents === 'function' ? e.getPredictedEvents() : []
}

export interface InkStyle {
  size: number
  /** Real pressure from a pen, or simulated from speed. */
  pen: boolean
}

/** The outline polygon of a stroke, as perfect-freehand draws it. */
export function outline(points: StrokePoint[], style: InkStyle, complete: boolean): number[][] {
  return getStroke(
    points.map((p) => [p.x, p.y, p.p]),
    {
      size: style.size,
      thinning: style.pen ? 0.62 : 0.5,
      smoothing: 0.5,
      // Low streamline keeps the tip under the pen; high reads as lag.
      streamline: style.pen ? 0.3 : 0.45,
      simulatePressure: !style.pen,
      last: complete,
    },
  )
}

/** An outline as SVG path data, smoothed through the midpoints. */
export function outlinePath(pts: number[][]): string {
  const n = pts.length
  if (n < 4) return ''
  const r = (v: number) => Math.round(v * 100) / 100
  let d = `M${r(pts[0]![0]!)} ${r(pts[0]![1]!)}`
  // One explicit Q per segment: not every path parser repeats an implicit command.
  for (let i = 0; i < n; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % n]!
    d += `Q${r(a[0]!)} ${r(a[1]!)} ${r((a[0]! + b[0]!) / 2)} ${r((a[1]! + b[1]!) / 2)}`
  }
  return d + 'Z'
}

export function strokePath(points: StrokePoint[], style: InkStyle, complete = true): string {
  return outlinePath(outline(points, style, complete))
}

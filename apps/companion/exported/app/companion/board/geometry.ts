/**
 * Plain geometry for the board: rectangles, hit tests, where a connector
 * meets its objects, and text measured the way the canvas will draw it.
 *
 * Hit testing lives here rather than in the render engine on purpose. The
 * board's model is the source of truth and the engine only paints it, so the
 * same tests work under Leafer, under Konva in the spike, and in a test with
 * no canvas at all.
 */
import type { BoardObject, ConnectorObj, End, Stroke } from './model'
import { FONT } from './palette'

export interface Pt { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }

/** World → screen is `screen = world * scale + (x, y)`. */
export interface Camera { x: number; y: number; scale: number }

export const GRID = 20
export const MIN_SCALE = 0.1
export const MAX_SCALE = 4

export function toWorld(cam: Camera, p: Pt): Pt {
  return { x: (p.x - cam.x) / cam.scale, y: (p.y - cam.y) / cam.scale }
}
export function toScreen(cam: Camera, p: Pt): Pt {
  return { x: p.x * cam.scale + cam.x, y: p.y * cam.scale + cam.y }
}

export function snap(v: number, step = GRID): number {
  return Math.round(v / step) * step
}

export function inRect(p: Pt, r: Rect, pad = 0): boolean {
  return p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export function contains(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h
}

export function union(list: Rect[]): Rect | null {
  if (!list.length) return null
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const r of list) {
    x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y)
    x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export function normRect(a: Pt, b: Pt): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }
}

export function center(r: Rect): Pt {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

/** A frame's title sits above it, so its hit area reaches up a little. */
export const FRAME_TITLE_H = 22

export function objectRect(o: BoardObject): Rect {
  return { x: o.x, y: o.y, w: o.w, h: o.h }
}

// ---- strokes -------------------------------------------------------------

export function strokeRect(s: Stroke, dx = 0, dy = 0): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i + 3 < s.pts.length; i += 4) {
    const x = s.pts[i]! / 10, y = s.pts[i + 1]! / 10
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  const pad = s.size
  return { x: x0 - pad + dx, y: y0 - pad + dy, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 }
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const vx = b.x - a.x, vy = b.y - a.y
  const len = vx * vx + vy * vy
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len)) : 0
  const x = a.x + t * vx - p.x, y = a.y + t * vy - p.y
  return Math.sqrt(x * x + y * y)
}

export function hitStroke(s: Stroke, p: Pt, tol: number, dx = 0, dy = 0): boolean {
  const reach = s.size / 2 + tol
  let prev: Pt | null = null
  for (let i = 0; i + 3 < s.pts.length; i += 4) {
    const cur = { x: s.pts[i]! / 10 + dx, y: s.pts[i + 1]! / 10 + dy }
    if (prev ? distToSegment(p, prev, cur) <= reach : Math.hypot(p.x - cur.x, p.y - cur.y) <= reach) return true
    prev = cur
  }
  return false
}

// ---- connectors ----------------------------------------------------------

export type Resolve = (id: string) => BoardObject | undefined

function endPoint(end: End, resolve: Resolve): { pt: Pt; obj?: BoardObject } {
  if ('id' in end) {
    const obj = resolve(end.id)
    if (obj) return { pt: center(objectRect(obj)), obj }
    return { pt: { x: 0, y: 0 } }
  }
  return { pt: { x: end.x, y: end.y } }
}

/** Where the ray from an object's centre towards `toward` leaves its outline. */
function clipToOutline(obj: BoardObject, toward: Pt, gap: number): Pt {
  const c = center(objectRect(obj))
  const dx = toward.x - c.x, dy = toward.y - c.y
  if (!dx && !dy) return c
  const hw = obj.w / 2 + gap, hh = obj.h / 2 + gap
  let t: number
  if (obj.kind === 'shape' && obj.shape === 'ellipse') {
    t = 1 / Math.sqrt((dx * dx) / (hw * hw) + (dy * dy) / (hh * hh))
  } else if (obj.kind === 'shape' && obj.shape === 'diamond') {
    t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh)
  } else {
    t = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity)
  }
  return { x: c.x + dx * Math.min(t, 1), y: c.y + dy * Math.min(t, 1) }
}

/** The two points a connector is drawn between, already clipped to its objects. */
export function connectorPoints(c: Pick<ConnectorObj, 'from' | 'to'>, resolve: Resolve): [Pt, Pt] {
  const a = endPoint(c.from, resolve)
  const b = endPoint(c.to, resolve)
  const p0 = a.obj ? clipToOutline(a.obj, b.pt, 4) : a.pt
  const p1 = b.obj ? clipToOutline(b.obj, a.pt, 6) : b.pt
  return [p0, p1]
}

export function connectorRect(c: ConnectorObj, resolve: Resolve): Rect {
  const [a, b] = connectorPoints(c, resolve)
  return { x: Math.min(a.x, b.x) - 6, y: Math.min(a.y, b.y) - 6, w: Math.abs(a.x - b.x) + 12, h: Math.abs(a.y - b.y) + 12 }
}

export function hitConnector(c: ConnectorObj, p: Pt, tol: number, resolve: Resolve): boolean {
  const [a, b] = connectorPoints(c, resolve)
  return distToSegment(p, a, b) <= tol
}

// ---- text ----------------------------------------------------------------

let measureCtx: CanvasRenderingContext2D | null = null
function ctx(): CanvasRenderingContext2D {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')!
  return measureCtx
}

export function font(size: number, weight = 400, family = FONT.body): string {
  return `${weight} ${size}px ${family}`
}

export function textWidth(text: string, f: string): number {
  const c = ctx()
  c.font = f
  return c.measureText(text).width
}

/**
 * Break text into the lines the canvas will draw, by words, breaking a word
 * only when it alone is wider than the box. The renderer draws these lines
 * as given, so what was measured is exactly what's painted.
 */
export function wrapLines(text: string, f: string, maxWidth: number): string[] {
  const c = ctx()
  c.font = f
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/(\s+)/)
    let line = ''
    for (const w of words) {
      const next = line + w
      if (!line || c.measureText(next).width <= maxWidth) {
        line = next
        continue
      }
      out.push(line.trimEnd())
      line = w.trimStart()
      while (line && c.measureText(line).width > maxWidth) {
        let cut = line.length - 1
        while (cut > 1 && c.measureText(line.slice(0, cut)).width > maxWidth) cut--
        out.push(line.slice(0, cut))
        line = line.slice(cut)
      }
    }
    out.push(line.trimEnd())
  }
  return out
}

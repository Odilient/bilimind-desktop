/**
 * A board is one Y.Doc. This file is its schema and the only code that writes
 * to it, so every change goes through one origin the undo manager can track.
 *
 *   objects  Y.Map<id, Y.Map>  stickies, shapes, text, frames, connectors,
 *                              images, page cards and mind-map nodes. Each is
 *                              its own Y.Map so two people editing different
 *                              fields of one sticky (one moves it, one types)
 *                              both win.
 *   strokes  Y.Array<Stroke>   pen ink, append-only: a stroke is written once
 *                              at pen-up and never changed, because its point
 *                              times are what later line it up with the
 *                              lecture audio.
 *   erased   Y.Map<id, 1>      tombstones for strokes. Erasing never removes
 *                              the entry from `strokes`.
 *   moved    Y.Map<id, {dx,dy}> a translation per stroke, for moving ink
 *                              without rewriting its points.
 *   meta     Y.Map             title, template, subject, so a board found
 *                              offline in IndexedDB can still name itself.
 */
import * as Y from 'yjs'
import type { PenColor, ShapeFill, StickyColor } from './palette'

export type ShapeKind = 'rect' | 'ellipse' | 'diamond'
/** A connector end: stuck to an object, or loose at a point. */
export type End = { id: string } | { x: number; y: number }

interface Base {
  id: string
  x: number
  y: number
  w: number
  h: number
  /** Stacking order; larger is on top. Frames always sit under everything. */
  z: number
}

export interface StickyObj extends Base {
  kind: 'sticky'
  text: string
  color: StickyColor
  /** Who wrote it, shown small under the text. */
  by?: string
}
export interface ShapeObj extends Base {
  kind: 'shape'
  shape: ShapeKind
  text: string
  fill: ShapeFill
  stroke: PenColor
}
export interface TextObj extends Base {
  kind: 'text'
  text: string
  size: number
}
export interface FrameObj extends Base {
  kind: 'frame'
  title: string
}
export interface ConnectorObj extends Base {
  kind: 'connector'
  from: End
  to: End
  label?: string
}
export interface ImageObj extends Base {
  kind: 'image'
  /** Whatever `repo.upload` answered with: a URL, or an item to look up. */
  src: string
  item_id?: string
}
export interface PageObj extends Base {
  kind: 'page'
  item_id: string
  /** Copied at placement so the card draws offline and before the item loads. */
  title: string
  preview: string
}
export interface MindObj extends Base {
  kind: 'mind'
  text: string
  /** `null` for a root. */
  parent: string | null
  /** Which side of the root a first-level branch hangs on; children inherit. */
  side: 'l' | 'r' | null
  /** Order among siblings. */
  order: number
  /** Hex, shared by the whole tree. */
  color: string
  /** Where the idea came from: "slide 16", "L7 12:02". */
  source?: string
  /** A flag a lecturer raised: "exam hint · L7 12:02". */
  hint?: string
}

export type BoardObject =
  | StickyObj | ShapeObj | TextObj | FrameObj | ConnectorObj | ImageObj | PageObj | MindObj
export type ObjKind = BoardObject['kind']

/**
 * Pen ink. Points are packed flat, four integers each, because a lecture's
 * worth of handwriting is tens of thousands of points and Yjs stores a small
 * integer in one or two bytes but a fraction in nine:
 *
 *   [x * 10, y * 10, pressure * 1000, ms since t0, ...]
 */
export interface Stroke {
  id: string
  by: string | null
  color: PenColor | (string & {})
  size: number
  /** Epoch ms of the first point. */
  t0: number
  pts: number[]
  /** True when pressure is real (a pen); false when it was simulated. */
  pen: boolean
}

export interface StrokePoint {
  x: number
  y: number
  p: number
  t: number
}

export function packPoints(points: StrokePoint[], t0: number): number[] {
  const out: number[] = []
  for (const pt of points) {
    out.push(Math.round(pt.x * 10), Math.round(pt.y * 10), Math.round(pt.p * 1000), Math.round(pt.t - t0))
  }
  return out
}

export function unpackPoints(s: Stroke, dx = 0, dy = 0): StrokePoint[] {
  const out: StrokePoint[] = []
  for (let i = 0; i + 3 < s.pts.length; i += 4) {
    out.push({ x: s.pts[i]! / 10 + dx, y: s.pts[i + 1]! / 10 + dy, p: s.pts[i + 2]! / 1000, t: s.t0 + s.pts[i + 3]! })
  }
  return out
}

export interface BoardMeta {
  title?: string
  template?: string
  subject_id?: string | null
  /** The assessment a revision map is for. */
  deadline_id?: string | null
  color?: string
}

/** The origin of every change made on this device; the undo manager tracks only these. */
export const LOCAL = { local: true }

export interface BoardParts {
  doc: Y.Doc
  objects: Y.Map<Y.Map<unknown>>
  strokes: Y.Array<Stroke>
  erased: Y.Map<number>
  moved: Y.Map<{ dx: number; dy: number }>
  meta: Y.Map<unknown>
}

export function boardParts(doc: Y.Doc): BoardParts {
  return {
    doc,
    objects: doc.getMap('objects') as Y.Map<Y.Map<unknown>>,
    strokes: doc.getArray('strokes') as Y.Array<Stroke>,
    erased: doc.getMap('erased') as Y.Map<number>,
    moved: doc.getMap('moved') as Y.Map<{ dx: number; dy: number }>,
    meta: doc.getMap('meta'),
  }
}

/** Short ids: unique within one board is all they need, and they're stored on every edge. */
export function newId(): string {
  const bytes = new Uint8Array(9)
  crypto.getRandomValues(bytes)
  let s = ''
  for (const b of bytes) s += (b % 36).toString(36)
  return s
}

/**
 * A v4 uuid for the board's item. `crypto.randomUUID` exists only in secure
 * contexts, and a phone testing the dev server over the LAN is on plain
 * http, so this builds one from `getRandomValues`, which works everywhere.
 */
export function newUuid(): string {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function readObject(m: Y.Map<unknown>): BoardObject {
  return m.toJSON() as BoardObject
}

function toYMap(o: Record<string, unknown>): Y.Map<unknown> {
  const m = new Y.Map<unknown>()
  for (const [k, v] of Object.entries(o)) if (v !== undefined) m.set(k, v)
  return m
}

/** All writes go through here: one transaction, one origin, one undo step. */
export function change(parts: BoardParts, fn: () => void) {
  parts.doc.transact(fn, LOCAL)
}

export function addObjects(parts: BoardParts, list: BoardObject[]) {
  change(parts, () => {
    for (const o of list) parts.objects.set(o.id, toYMap(o as unknown as Record<string, unknown>))
  })
}

/** Patch fields of several objects at once. Unchanged values are skipped so they don't churn the log. */
export function patchObjects(parts: BoardParts, patches: Record<string, Partial<BoardObject>>) {
  change(parts, () => {
    for (const [id, patch] of Object.entries(patches)) {
      const m = parts.objects.get(id)
      if (!m) continue
      for (const [k, v] of Object.entries(patch)) {
        if (k === 'id' || k === 'kind') continue
        const cur = m.get(k)
        if (v === undefined) {
          if (cur !== undefined) m.delete(k)
        } else if (typeof v === 'object' ? JSON.stringify(cur) !== JSON.stringify(v) : cur !== v) {
          m.set(k, v)
        }
      }
    }
  })
}

export function removeObjects(parts: BoardParts, ids: Iterable<string>) {
  change(parts, () => {
    for (const id of ids) parts.objects.delete(id)
  })
}

export function appendStroke(parts: BoardParts, s: Stroke) {
  change(parts, () => parts.strokes.push([s]))
}

export function eraseStrokes(parts: BoardParts, ids: Iterable<string>) {
  change(parts, () => {
    for (const id of ids) parts.erased.set(id, 1)
  })
}

export function moveStrokes(parts: BoardParts, ids: Iterable<string>, dx: number, dy: number) {
  change(parts, () => {
    for (const id of ids) {
      const cur = parts.moved.get(id) ?? { dx: 0, dy: 0 }
      parts.moved.set(id, { dx: cur.dx + dx, dy: cur.dy + dy })
    }
  })
}

export function readMeta(parts: BoardParts): BoardMeta {
  return parts.meta.toJSON() as BoardMeta
}

export function writeMeta(parts: BoardParts, meta: BoardMeta) {
  change(parts, () => {
    for (const [k, v] of Object.entries(meta)) if (v !== undefined) parts.meta.set(k, v)
  })
}

export function maxZ(objects: Iterable<BoardObject>): number {
  let z = 0
  for (const o of objects) if (o.z > z) z = o.z
  return z
}

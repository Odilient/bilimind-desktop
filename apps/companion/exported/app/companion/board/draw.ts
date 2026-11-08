/**
 * How each kind of board object looks, as a short list of primitives.
 *
 * The render engine never sees a sticky or a mind node; it sees rectangles,
 * paths and lines of text. That keeps the look in one file, and it is what
 * let the spike draw the identical scene under Leafer and under Konva: only
 * the adapter that turns primitives into engine nodes differs.
 *
 * Primitives are in the object's local space (its top-left is 0,0), except
 * links and connectors, which are drawn in world space at 0,0.
 */
import type { BoardObject, ConnectorObj, MindObj, PageObj, ShapeObj, StickyObj, TextObj } from './model'
import { connectorPoints, font, textWidth, wrapLines, type Pt, type Resolve } from './geometry'
// The theme's hexes, looked up as each object is drawn (`palette.ts`): a board stores keys, not colours.
import { FONT, fills, ink, paint, pen, sticky } from './palette'

export type Prim =
  | { t: 'rect'; x: number; y: number; w: number; h: number; r?: number; fill?: string; stroke?: string; sw?: number; dash?: number[]; opacity?: number }
  | { t: 'ellipse'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; sw?: number }
  | { t: 'path'; d: string; fill?: string; stroke?: string; sw?: number; opacity?: number }
  | {
    t: 'text'
    x: number
    y: number
    lines: string[]
    size: number
    lh: number
    weight: number
    family: string
    color: string
    /** Set for centred text: the box the lines are centred in. */
    w?: number
    align?: 'left' | 'center'
    opacity?: number
  }
  | { t: 'image'; x: number; y: number; w: number; h: number; url: string; r?: number }

export interface DrawEnv {
  resolve: Resolve
  /** 0 for a mind-map root, 1 for its branches, 2+ beyond. */
  depth: (id: string) => number
}

// ---- sticky ----------------------------------------------------------------

// A sticky is something a hand wrote: Caveat, as on course.html's board.
const STICKY_PAD = 12
const STICKY_SIZE = 20
const STICKY_LH = 22
export const STICKY_FONT = { size: STICKY_SIZE, lh: STICKY_LH, weight: 600 }

export function stickyLines(o: Pick<StickyObj, 'text' | 'w'>): string[] {
  return wrapLines(o.text || ' ', font(STICKY_SIZE, 600, FONT.hand), o.w - STICKY_PAD * 2)
}

export function stickyHeight(o: Pick<StickyObj, 'text' | 'w' | 'by'>): number {
  const body = stickyLines(o).length * STICKY_LH
  return Math.max(o.w * 0.78, STICKY_PAD + body + (o.by ? 30 : STICKY_PAD))
}

function drawSticky(o: StickyObj): Prim[] {
  const out: Prim[] = [
    // A cheap lift instead of a blurred shadow: a darker card peeking out
    // under the bottom edge. Blur on hundreds of notes costs every frame.
    { t: 'rect', x: 3, y: 5, w: o.w - 6, h: o.h - 2, r: 3, fill: ink().stickyShadow },
    { t: 'rect', x: 0, y: 0, w: o.w, h: o.h, r: 3, fill: sticky()[o.color] ?? sticky().yellow },
  ]
  if (o.text) {
    out.push({ t: 'text', x: STICKY_PAD, y: STICKY_PAD - 2, lines: stickyLines(o), size: STICKY_SIZE, lh: STICKY_LH, weight: 600, family: FONT.hand, color: ink().stickyText })
  }
  if (o.by) {
    out.push({ t: 'text', x: STICKY_PAD, y: o.h - 24, lines: [o.by], size: 11.5, lh: 14, weight: 600, family: FONT.body, color: ink().stickyText, opacity: 0.6 })
  }
  return out
}

// ---- shape -----------------------------------------------------------------

const SHAPE_SIZE = 14
const SHAPE_LH = 19

export function shapeTextWidth(o: Pick<ShapeObj, 'shape' | 'w'>): number {
  return o.shape === 'rect' ? o.w - 24 : o.w * (o.shape === 'diamond' ? 0.55 : 0.72)
}

function drawShape(o: ShapeObj): Prim[] {
  const fill = fills()[o.fill] ?? fills().white
  const stroke = pen()[o.stroke] ?? pen().ink
  const out: Prim[] = []
  if (o.shape === 'ellipse') out.push({ t: 'ellipse', x: 0, y: 0, w: o.w, h: o.h, fill, stroke, sw: 1.5 })
  else if (o.shape === 'diamond') {
    out.push({ t: 'path', d: `M${o.w / 2} 0L${o.w} ${o.h / 2}L${o.w / 2} ${o.h}L0 ${o.h / 2}Z`, fill, stroke, sw: 1.5 })
  } else out.push({ t: 'rect', x: 0, y: 0, w: o.w, h: o.h, r: 6, fill, stroke, sw: 1.5 })
  if (o.text) {
    const tw = shapeTextWidth(o)
    const lines = wrapLines(o.text, font(SHAPE_SIZE, 500), tw)
    const th = lines.length * SHAPE_LH
    out.push({ t: 'text', x: (o.w - tw) / 2, y: (o.h - th) / 2, w: tw, align: 'center', lines, size: SHAPE_SIZE, lh: SHAPE_LH, weight: 500, family: FONT.body, color: ink().text })
  }
  return out
}

// ---- text ------------------------------------------------------------------

export function textLines(o: Pick<TextObj, 'text' | 'w' | 'size'>): string[] {
  return wrapLines(o.text || ' ', font(o.size, 500), o.w)
}

export function textHeight(o: Pick<TextObj, 'text' | 'w' | 'size'>): number {
  return textLines(o).length * Math.round(o.size * 1.3)
}

function drawText(o: TextObj): Prim[] {
  return [{ t: 'text', x: 0, y: 0, lines: textLines(o), size: o.size, lh: Math.round(o.size * 1.3), weight: 500, family: FONT.body, color: ink().text }]
}

// ---- frame -----------------------------------------------------------------

function drawFrame(o: BoardObject & { kind: 'frame' }): Prim[] {
  return [
    { t: 'rect', x: 0, y: 0, w: o.w, h: o.h, r: 8, fill: ink().frameFill, stroke: ink().line, sw: 1.5 },
    { t: 'text', x: 2, y: -20, lines: [o.title || 'Frame'], size: 12.5, lh: 16, weight: 600, family: FONT.body, color: ink().dim },
  ]
}

// ---- connector -------------------------------------------------------------

function arrowHead(a: Pt, b: Pt, size: number): string {
  const ang = Math.atan2(b.y - a.y, b.x - a.x)
  const l = { x: b.x - size * Math.cos(ang - 0.42), y: b.y - size * Math.sin(ang - 0.42) }
  const r = { x: b.x - size * Math.cos(ang + 0.42), y: b.y - size * Math.sin(ang + 0.42) }
  return `M${b.x} ${b.y}L${l.x} ${l.y}L${r.x} ${r.y}Z`
}

export function drawConnector(c: Pick<ConnectorObj, 'from' | 'to' | 'label'>, env: DrawEnv, color = ink().dim): Prim[] {
  const [a, b] = connectorPoints(c, env.resolve)
  const out: Prim[] = [
    { t: 'path', d: `M${a.x} ${a.y}L${b.x} ${b.y}`, stroke: color, sw: 2 },
    { t: 'path', d: arrowHead(a, b, 11), fill: color },
  ]
  if (c.label) {
    const f = font(12, 500)
    const w = textWidth(c.label, f) + 12
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    out.push({ t: 'rect', x: m.x - w / 2, y: m.y - 10, w, h: 20, r: 6, fill: ink().bg })
    out.push({ t: 'text', x: m.x - w / 2, y: m.y - 8, w, align: 'center', lines: [c.label], size: 12, lh: 16, weight: 500, family: FONT.body, color: ink().dim })
  }
  return out
}

// ---- image and page card ---------------------------------------------------

function drawImage(o: BoardObject & { kind: 'image' }): Prim[] {
  return [
    { t: 'rect', x: 0, y: 0, w: o.w, h: o.h, r: 6, fill: ink().sunken },
    ...(o.src ? [{ t: 'image', x: 0, y: 0, w: o.w, h: o.h, url: o.src, r: 6 } as Prim] : []),
    { t: 'rect', x: 0, y: 0, w: o.w, h: o.h, r: 6, stroke: ink().line, sw: 1 },
  ]
}

const DOC_ICON = 'M6 3L14 3L18 7L18 21L6 21Z M14 3L14 7L18 7'

export function pageLines(o: Pick<PageObj, 'title' | 'preview' | 'w'>) {
  const title = wrapLines(o.title || 'Untitled page', font(13.5, 600), o.w - 46).slice(0, 2)
  const preview = o.preview ? wrapLines(o.preview, font(12), o.w - 26).slice(0, 3) : []
  return { title, preview }
}

export function pageHeight(o: Pick<PageObj, 'title' | 'preview' | 'w'>): number {
  const { title, preview } = pageLines(o)
  return 14 + title.length * 18 + (preview.length ? 6 + preview.length * 17 : 0) + 28
}

function drawPage(o: PageObj): Prim[] {
  const { title, preview } = pageLines(o)
  const out: Prim[] = [
    { t: 'rect', x: 2, y: 5, w: o.w - 4, h: o.h - 2, r: 10, fill: ink().pageShadow },
    { t: 'rect', x: 0, y: 0, w: o.w, h: o.h, r: 10, fill: ink().surface, stroke: ink().line, sw: 1 },
    // The icon is drawn on a 24-unit grid; this places it at 12,13 and 14px.
    { t: 'path', d: scalePath(DOC_ICON, 14 / 24, 12, 13), stroke: ink().cobalt, sw: 1.8 },
    { t: 'text', x: 34, y: 12, lines: title, size: 13.5, lh: 18, weight: 600, family: FONT.body, color: ink().text },
  ]
  const py = 14 + title.length * 18 + 6
  if (preview.length) out.push({ t: 'text', x: 13, y: py, lines: preview, size: 12, lh: 17, weight: 400, family: FONT.body, color: ink().dim })
  out.push({ t: 'text', x: 13, y: o.h - 24, lines: ['page'], size: 11, lh: 14, weight: 500, family: FONT.body, color: ink().faint })
  return out
}

/** Scale and move a path written only with absolute M, L and Z. */
function scalePath(d: string, s: number, dx: number, dy: number): string {
  let axis = 0
  return d.replace(/([MLZ])|(-?\d*\.?\d+)/g, (m, cmd: string | undefined) => {
    if (cmd) return cmd
    const v = parseFloat(m) * s + (axis === 0 ? dx : dy)
    axis = 1 - axis
    return `${Math.round(v * 100) / 100} `
  })
}

// ---- mind map --------------------------------------------------------------

export interface MindStyle {
  size: number
  weight: number
  family: string
  padX: number
  padY: number
  r: number
}

export function mindStyle(depth: number): MindStyle {
  if (depth === 0) return { size: 17, weight: 600, family: FONT.display, padX: 18, padY: 10, r: 12 }
  if (depth === 1) return { size: 13.5, weight: 600, family: FONT.body, padX: 12, padY: 7, r: 9 }
  return { size: 13, weight: 500, family: FONT.body, padX: 11, padY: 6, r: 9 }
}

const MIND_MAX_W = 220

/** The size a mind node needs for its label and its source line. */
export function mindSize(o: Pick<MindObj, 'text' | 'source' | 'hint'>, depth: number): { w: number; h: number; lines: string[] } {
  const st = mindStyle(depth)
  const f = font(st.size, st.weight, st.family)
  const lines = wrapLines(o.text || ' ', f, MIND_MAX_W)
  let w = Math.max(...lines.map((l) => textWidth(l, f)))
  const sub = o.hint || o.source
  if (sub) w = Math.max(w, textWidth(sub, font(10.5, 600)))
  const lh = Math.round(st.size * 1.3)
  const h = st.padY * 2 + lines.length * lh + (sub ? 14 : 0)
  return { w: Math.ceil(w + st.padX * 2), h: Math.ceil(h), lines }
}

function drawMind(o: MindObj, env: DrawEnv): Prim[] {
  const depth = env.depth(o.id)
  const st = mindStyle(depth)
  const { lines } = mindSize(o, depth)
  const lh = Math.round(st.size * 1.3)
  const out: Prim[] = []
  if (depth === 0) out.push({ t: 'rect', x: 0, y: 0, w: o.w, h: o.h, r: st.r, fill: paint(o.color) })
  else if (depth === 1) out.push({ t: 'rect', x: 0, y: 0, w: o.w, h: o.h, r: st.r, fill: ink().surface, stroke: paint(o.color), sw: 1.5 })
  else out.push({ t: 'rect', x: 0, y: 0, w: o.w, h: o.h, r: st.r, fill: ink().surface, stroke: ink().lineStrong, sw: 1 })
  out.push({
    t: 'text', x: 0, y: st.padY, w: o.w, align: 'center', lines, size: st.size, lh, weight: st.weight, family: st.family,
    color: depth === 0 ? ink().onCourse : depth === 1 ? ink().text : ink().dim,
  })
  const sub = o.hint || o.source
  if (sub) {
    out.push({
      t: 'text', x: 0, y: st.padY + lines.length * lh + 1, w: o.w, align: 'center', lines: [sub], size: 10.5, lh: 13, weight: 600,
      family: FONT.body, color: o.hint ? ink().amberText : depth === 0 ? ink().onCourse : ink().faint, opacity: depth === 0 && !o.hint ? 0.8 : undefined,
    })
  }
  return out
}

/** The curve from a parent to a child, centre to centre, drawn under both. */
export function drawMindLink(child: MindObj, parent: MindObj): Prim[] {
  const a = { x: parent.x + parent.w / 2, y: parent.y + parent.h / 2 }
  const b = { x: child.x + child.w / 2, y: child.y + child.h / 2 }
  const mx = (a.x + b.x) / 2
  return [{ t: 'path', d: `M${a.x} ${a.y}C${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`, stroke: paint(child.color), sw: 2, opacity: 0.55 }]
}

// ---- dispatch --------------------------------------------------------------

/** The primitives for one object in its own space. Connectors are drawn by `drawConnector`. */
export function drawObject(o: BoardObject, env: DrawEnv): Prim[] {
  switch (o.kind) {
    case 'sticky': return drawSticky(o)
    case 'shape': return drawShape(o)
    case 'text': return drawText(o)
    case 'frame': return drawFrame(o)
    case 'image': return drawImage(o)
    case 'page': return drawPage(o)
    case 'mind': return drawMind(o, env)
    case 'connector': return []
  }
}

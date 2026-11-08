/**
 * The board's brain: tools, gestures, selection, editing, undo, the camera,
 * and keeping the render engine in step with the Y.Doc.
 *
 * It is plain TypeScript with one reactive `ui` object, so the Vue chrome
 * (toolbars, minimap, popovers, the text editor) reads and drives it without
 * the canvas ever re-rendering through Vue.
 *
 * Input follows research/vue-stack.md §5:
 *   - a pen draws (with every coalesced point, pressure and time); once a pen
 *     has been seen, fingers never draw, they pan and pinch, which is how the
 *     board sidesteps palm rejection;
 *   - before any pen, a finger or a mouse draws with the pen tool, so a phone
 *     can still scribble;
 *   - two fingers always pan and zoom; space-drag and the middle button pan;
 *     the wheel zooms (a trackpad's two-finger scroll pans, its pinch zooms).
 */
import * as Y from 'yjs'
import { reactive } from 'vue'
import type { BoardParts, BoardObject, ConnectorObj, End, MindObj, ObjKind, PageObj, ShapeKind, Stroke, StrokePoint } from './model'
import {
  LOCAL, addObjects, appendStroke, change, eraseStrokes, maxZ, moveStrokes, newId, packPoints, patchObjects,
  readObject, removeObjects, unpackPoints,
} from './model'
import {
  FRAME_TITLE_H, GRID, MAX_SCALE, MIN_SCALE, center, connectorRect, contains, hitConnector, hitStroke, inRect, intersects,
  normRect, objectRect, snap, strokeRect, toScreen, toWorld, union, type Camera, type Pt, type Rect,
} from './geometry'
import { drawConnector, drawMindLink, drawObject, mindSize, pageHeight, stickyHeight, textHeight, type DrawEnv } from './draw'
import { coalesced, eventTime, predicted, pressureOf, strokePath } from './ink'
import { ink, paint, pen, sticky, type PenColor, type ShapeFill, type StickyColor } from './palette'
import type { LayerName, Scene } from './scene'
import type { BoardPresence } from './presence'
import { depthOf, rootOf, subtreeIds } from './mindmap'
import { addMindChild, addMindSibling, applyMap, attachedConnectors, mindNodes, relayout, withSubtrees, type MapPlan } from './ops'

export type Tool = 'select' | 'sticky' | 'shape' | 'text' | 'connector' | 'frame' | 'pen' | 'image' | 'page' | 'mind'
type Handle = 'nw' | 'ne' | 'sw' | 'se'

export interface Editing {
  id: string
  kind: ObjKind
  text: string
  /** Made a moment ago: committing it empty removes it. */
  fresh: boolean
}

export interface BoardUi {
  tool: Tool
  shape: ShapeKind
  stickyColor: StickyColor
  penColor: PenColor
  /** On-screen pen width in px. */
  penSize: number
  eraser: boolean
  selection: string[]
  strokeSelection: string[]
  camera: Camera
  editing: Editing | null
  /** World rect of a marquee or of a frame/shape being drawn out. */
  box: Rect | null
  /** World line of a connector being drawn. */
  draft: { a: Pt; b: Pt } | null
  /** The object a connector draft would stick to. */
  target: string | null
  penSeen: boolean
  spaceDown: boolean
  canUndo: boolean
  canRedo: boolean
  /** The person has moved the view themselves; automatic framing leaves it alone. */
  moved: boolean
  /** Bumped after every redraw, for the minimap and overlays. */
  version: number
  present: { index: number; frames: string[] } | null
  size: { w: number; h: number }
}

export interface ControllerOptions {
  parts: BoardParts
  scene: Scene
  host: HTMLElement
  wet: HTMLCanvasElement
  me: string
  /** Hex for new mind maps: the course's colour, read when a map is made. */
  color: () => string
  presence: BoardPresence
  onOpenPage?: (itemId: string) => void
  onRequestImage?: (at: Pt) => void
  onRequestPage?: (at: Pt) => void
}

type Gesture =
  | { k: 'pan'; id: number; start: Pt; cam: Camera }
  | { k: 'pinch'; d: number; mid: Pt; cam: Camera }
  | { k: 'move'; id: number; start: Pt; ids: string[]; strokes: string[]; dx: number; dy: number; moved: boolean; base: Rect; click: string | null; wasSelected: boolean }
  | { k: 'resize'; id: number; obj: string; handle: Handle; start: Pt; rect: Rect }
  | { k: 'marquee'; id: number; start: Pt; add: boolean }
  | { k: 'draw'; id: number; points: StrokePoint[]; pen: boolean; size: number }
  | { k: 'erase'; id: number; hit: Set<string> }
  | { k: 'connect'; id: number; from: End; start: Pt }
  | { k: 'create'; id: number; tool: 'frame' | 'shape'; start: Pt }

const RESIZABLE = new Set<ObjKind>(['sticky', 'shape', 'frame', 'image', 'page', 'text'])
const EDITABLE = new Set<ObjKind>(['sticky', 'shape', 'text', 'mind', 'frame'])
const CLIP_MARK = 'bilimind-board/1'

let clipboard: { objects: BoardObject[]; strokes: Stroke[] } | null = null

export class BoardController {
  readonly ui: BoardUi
  readonly parts: BoardParts
  readonly undoManager: Y.UndoManager

  private scene: Scene
  private host: HTMLElement
  private wet: HTMLCanvasElement
  private opts: ControllerOptions
  private cache = new Map<string, BoardObject>()
  private strokes = new Map<string, Stroke>()
  private strokeOrder: string[] = []
  private drawnStrokes = new Map<string, string>()
  private preview = new Map<string, Partial<BoardObject>>()
  private dirty = new Set<string>()
  private strokesDirty = true
  private raf = 0
  private gesture: Gesture | null = null
  private touches = new Map<number, Pt>()
  private lastTap: { id: string | null; at: number; p: Pt } = { id: null, at: 0, p: { x: 0, y: 0 } }
  private lastPointer: Pt | null = null
  private presenceAt = 0
  private camAnim = 0
  private unbind: (() => void)[] = []

  constructor(opts: ControllerOptions) {
    this.opts = opts
    this.parts = opts.parts
    this.scene = opts.scene
    this.host = opts.host
    this.wet = opts.wet
    const rect = opts.host.getBoundingClientRect()
    this.ui = reactive<BoardUi>({
      tool: 'select', shape: 'rect', stickyColor: 'yellow', penColor: 'ink', penSize: 3, eraser: false,
      selection: [], strokeSelection: [], camera: { x: rect.width / 2, y: rect.height / 2, scale: 1 },
      editing: null, box: null, draft: null, target: null, penSeen: false, spaceDown: false,
      canUndo: false, canRedo: false, moved: false, version: 0, present: null, size: { w: rect.width, h: rect.height },
    }) as BoardUi

    this.undoManager = new Y.UndoManager([this.parts.objects, this.parts.strokes, this.parts.erased, this.parts.moved], {
      trackedOrigins: new Set([LOCAL]),
      captureTimeout: 400,
    })
    const syncUndo = () => {
      this.ui.canUndo = this.undoManager.undoStack.length > 0
      this.ui.canRedo = this.undoManager.redoStack.length > 0
    }
    this.undoManager.on('stack-item-added', syncUndo)
    this.undoManager.on('stack-item-popped', syncUndo)

    this.parts.objects.forEach((m, id) => {
      this.cache.set(id, readObject(m))
      this.dirty.add(id)
    })
    const onObjects = (events: Y.YEvent<Y.AbstractType<unknown>>[]) => {
      for (const ev of events) {
        if (ev.target === this.parts.objects) ev.changes.keys.forEach((_c, key) => this.dirty.add(key))
        else if (typeof ev.path[0] === 'string') this.dirty.add(ev.path[0])
      }
      this.schedule()
    }
    const onStrokes = () => {
      this.strokesDirty = true
      this.schedule()
    }
    this.parts.objects.observeDeep(onObjects)
    this.parts.strokes.observe(onStrokes)
    this.parts.erased.observe(onStrokes)
    this.parts.moved.observe(onStrokes)
    this.unbind.push(() => {
      this.parts.objects.unobserveDeep(onObjects)
      this.parts.strokes.unobserve(onStrokes)
      this.parts.erased.unobserve(onStrokes)
      this.parts.moved.unobserve(onStrokes)
    })

    this.bindInput()
    this.resize(rect.width, rect.height)
    this.flush()
  }

  // ---- model access ---------------------------------------------------------

  /** An object as it looks right now, mid-drag included. */
  get(id: string): BoardObject | undefined {
    let o = this.cache.get(id)
    if (!o) {
      // Made this instant, before the next frame has refreshed the cache:
      // read it straight from the doc, or a new note couldn't open for typing.
      const m = this.parts.objects.get(id)
      if (!m) return undefined
      o = readObject(m)
      this.cache.set(id, o)
    }
    const p = this.preview.get(id)
    return p ? ({ ...o, ...p } as BoardObject) : o
  }

  all(): BoardObject[] {
    return [...this.cache.keys()].map((id) => this.get(id)!)
  }

  private env: DrawEnv = {
    resolve: (id) => this.get(id),
    depth: (id) => depthOf(this.mindMap(), id),
  }

  private mindCache: Map<string, MindObj> | null = null
  private mindMap(): Map<string, MindObj> {
    if (!this.mindCache) {
      this.mindCache = new Map()
      for (const id of this.cache.keys()) {
        const o = this.get(id)
        if (o?.kind === 'mind') this.mindCache.set(id, o)
      }
    }
    return this.mindCache
  }

  rectOf(id: string): Rect | null {
    const o = this.get(id)
    if (o) return o.kind === 'connector' ? connectorRect(o, this.env.resolve) : objectRect(o)
    const s = this.strokes.get(id)
    if (s) {
      const m = this.parts.moved.get(id)
      const p = this.preview.get(id) as { x?: number; y?: number } | undefined
      return strokeRect(s, (m?.dx ?? 0) + (p?.x ?? 0), (m?.dy ?? 0) + (p?.y ?? 0))
    }
    return null
  }

  contentBounds(): Rect | null {
    const rects: Rect[] = []
    for (const o of this.all()) {
      if (o.kind === 'connector') continue
      rects.push(o.kind === 'frame' ? { x: o.x, y: o.y - FRAME_TITLE_H, w: o.w, h: o.h + FRAME_TITLE_H } : objectRect(o))
    }
    for (const id of this.strokes.keys()) rects.push(this.rectOf(id)!)
    return union(rects)
  }

  // ---- rendering ------------------------------------------------------------

  /**
   * Draw everything again, in the theme `palette.ts` paints in now: the light
   * or dark theme changed. Objects are marked dirty and ink is put afresh, so
   * the next frame repaints all of it.
   */
  repaint() {
    for (const id of this.cache.keys()) this.dirty.add(id)
    for (const id of this.drawnStrokes.keys()) this.scene.drop('ink', id)
    this.drawnStrokes.clear()
    this.strokesDirty = true
    this.schedule()
  }

  private schedule() {
    if (!this.raf) this.raf = requestAnimationFrame(() => this.flush())
  }

  private flush() {
    this.raf = 0
    this.mindCache = null
    if (this.strokesDirty) this.syncStrokes()
    const ids = new Set(this.dirty)
    this.dirty.clear()
    let mindChanged = false
    for (const id of ids) {
      const m = this.parts.objects.get(id)
      const before = this.cache.get(id)
      if (m) this.cache.set(id, readObject(m))
      else this.cache.delete(id)
      if (before?.kind === 'mind' || this.cache.get(id)?.kind === 'mind') mindChanged = true
    }
    this.mindCache = null
    const redraw = this.dependents(ids)
    // A tree's depths and links shift together, so a change to one node redraws its tree.
    if (mindChanged) for (const o of this.cache.values()) if (o.kind === 'mind') redraw.add(o.id)
    for (const id of redraw) this.drawOne(id)
    if (ids.size) {
      // Drop selection of anything that is gone (someone else deleted it, or undo).
      const sel = this.ui.selection.filter((id) => this.cache.has(id))
      if (sel.length !== this.ui.selection.length) this.ui.selection = sel
      if (this.ui.editing && !this.cache.has(this.ui.editing.id)) this.ui.editing = null
    }
    this.ui.version++
  }

  /** The ids, plus every connector stuck to one of them. */
  private dependents(ids: Set<string>): Set<string> {
    const out = new Set(ids)
    for (const o of this.cache.values()) {
      if (o.kind !== 'connector') continue
      if (('id' in o.from && ids.has(o.from.id)) || ('id' in o.to && ids.has(o.to.id))) out.add(o.id)
    }
    return out
  }

  private layerOf(o: BoardObject): LayerName {
    return o.kind === 'frame' ? 'frames' : o.kind === 'connector' ? 'links' : 'objects'
  }

  private drawOne(id: string) {
    const o = this.get(id)
    if (!o) {
      for (const l of ['frames', 'links', 'objects'] as const) this.scene.drop(l, id)
      this.scene.drop('links', `link:${id}`)
      return
    }
    if (o.kind === 'connector') {
      const selected = this.ui.selection.includes(id)
      this.scene.put('links', id, 0, 0, o.z, drawConnector(o, this.env, selected ? ink().cobalt : undefined))
      return
    }
    this.scene.put(this.layerOf(o), id, o.x, o.y, o.z, drawObject(o, this.env))
    if (o.kind === 'mind') {
      const parent = o.parent ? this.get(o.parent) : undefined
      if (parent?.kind === 'mind') this.scene.put('links', `link:${id}`, 0, 0, -1, drawMindLink(o, parent))
      else this.scene.drop('links', `link:${id}`)
    }
    if (this.ui.editing?.id === id) this.scene.hide(this.layerOf(o), id, true)
  }

  private syncStrokes() {
    this.strokesDirty = false
    const list = this.parts.strokes.toArray()
    const live = new Set<string>()
    this.strokeOrder = []
    list.forEach((s, i) => {
      if (this.parts.erased.has(s.id)) return
      live.add(s.id)
      this.strokeOrder.push(s.id)
      this.strokes.set(s.id, s)
      const m = this.parts.moved.get(s.id) ?? { dx: 0, dy: 0 }
      const key = `${m.dx},${m.dy}`
      if (this.drawnStrokes.get(s.id) === key) return
      if (this.drawnStrokes.has(s.id)) this.scene.move('ink', s.id, m.dx, m.dy)
      else this.scene.put('ink', s.id, m.dx, m.dy, i, [{ t: 'path', d: strokePath(unpackPoints(s), { size: s.size, pen: s.pen }), fill: paint(s.color) }])
      this.drawnStrokes.set(s.id, key)
    })
    for (const id of [...this.drawnStrokes.keys()]) {
      if (live.has(id)) continue
      this.scene.drop('ink', id)
      this.drawnStrokes.delete(id)
      this.strokes.delete(id)
    }
    const sel = this.ui.strokeSelection.filter((id) => live.has(id))
    if (sel.length !== this.ui.strokeSelection.length) this.ui.strokeSelection = sel
  }

  // ---- camera ---------------------------------------------------------------

  setCamera(c: Camera) {
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, c.scale))
    this.ui.camera = { x: c.x, y: c.y, scale }
    this.scene.setCamera(this.ui.camera)
    // The dot grid is the host's CSS background, moved with the camera.
    let step = GRID * scale
    while (step < 12) step *= 2
    this.host.style.backgroundSize = `${step}px ${step}px`
    this.host.style.backgroundPosition = `${c.x}px ${c.y}px`
    this.ui.version++
  }

  /** A camera move the person made (pan, pinch, wheel, zoom buttons, minimap). */
  private userCamera(c: Camera) {
    this.ui.moved = true
    cancelAnimationFrame(this.camAnim)
    this.setCamera(c)
  }

  zoomAround(factor: number, at: Pt = { x: this.ui.size.w / 2, y: this.ui.size.h / 2 }) {
    const cam = this.ui.camera
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, cam.scale * factor))
    const w = toWorld(cam, at)
    this.userCamera({ scale, x: at.x - w.x * scale, y: at.y - w.y * scale })
  }

  /** Glide the camera, for zoom-to-fit, the minimap and present mode. */
  animateTo(target: Camera, ms = 320) {
    cancelAnimationFrame(this.camAnim)
    const from = { ...this.ui.camera }
    const t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      const ls = Math.log(from.scale) + (Math.log(target.scale) - Math.log(from.scale)) * e
      this.setCamera({ scale: Math.exp(ls), x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e })
      if (k < 1) this.camAnim = requestAnimationFrame(step)
    }
    this.camAnim = requestAnimationFrame(step)
  }

  /** The camera that shows `r` inside the padding; never above `maxScale` (100% unless asked). */
  fitRect(r: Rect, pad = { top: 72, right: 40, bottom: 40, left: 40 }, maxScale = 1): Camera {
    const vw = this.ui.size.w - pad.left - pad.right
    const vh = this.ui.size.h - pad.top - pad.bottom
    const scale = Math.min(maxScale, Math.max(MIN_SCALE, Math.min(vw / Math.max(r.w, 1), vh / Math.max(r.h, 1))))
    return {
      scale,
      x: pad.left + vw / 2 - (r.x + r.w / 2) * scale,
      y: pad.top + vh / 2 - (r.y + r.h / 2) * scale,
    }
  }

  zoomToFit(animate = true, pad?: { top: number; right: number; bottom: number; left: number }) {
    const b = this.contentBounds()
    const cam = b ? this.fitRect(b, pad) : { x: this.ui.size.w / 2, y: this.ui.size.h / 2, scale: 1 }
    if (animate) this.animateTo(cam)
    else this.setCamera(cam)
  }

  /**
   * Show `r`, but never below `minScale`: if it doesn't fit at a readable
   * size, centre on `focus` at that size instead and leave the rest a pan
   * away. A phone needs this; the whole of a big map in 390 px is a thumbnail.
   */
  showReadable(r: Rect, focus: Pt, minScale: number, pad?: { top: number; right: number; bottom: number; left: number }, animate = false) {
    let cam = this.fitRect(r, pad, 1)
    if (cam.scale < minScale) {
      const top = pad?.top ?? 0, bottom = pad?.bottom ?? 0
      const cy = top + (this.ui.size.h - top - bottom) / 2
      cam = { scale: minScale, x: this.ui.size.w / 2 - focus.x * minScale, y: cy - focus.y * minScale }
    }
    if (animate) this.animateTo(cam, 480)
    else this.setCamera(cam)
  }

  /**
   * A phone's first view: the whole board when it still reads (40% or more),
   * otherwise the first mind map (or frame) at no less than 70%.
   */
  zoomToFocus(pad?: { top: number; right: number; bottom: number; left: number }) {
    const all = this.contentBounds()
    if (all && this.fitRect(all, pad).scale >= 0.4) return this.setCamera(this.fitRect(all, pad))
    const minds = this.mindMap()
    const root = [...minds.values()].filter((m) => m.parent === null).sort((a, b) => a.z - b.z)[0]
    const frame = this.framesInOrder()[0]
    const r = root ? union(subtreeIds(minds, root.id).map((id) => objectRect(minds.get(id)!))) : frame ? objectRect(frame) : this.contentBounds()
    if (!r) return this.zoomToFit(false, pad)
    this.showReadable(r, root ? center(objectRect(root)) : center(r), 0.7, pad)
  }

  resize(w: number, h: number) {
    this.ui.size = { w, h }
    this.scene.resize(w, h)
    const dpr = window.devicePixelRatio || 1
    this.wet.width = Math.round(w * dpr)
    this.wet.height = Math.round(h * dpr)
    this.setCamera(this.ui.camera)
  }

  toScreen(p: Pt): Pt {
    return toScreen(this.ui.camera, p)
  }

  screenRect(r: Rect): Rect {
    const a = toScreen(this.ui.camera, { x: r.x, y: r.y })
    return { x: a.x, y: a.y, w: r.w * this.ui.camera.scale, h: r.h * this.ui.camera.scale }
  }

  /** The selection's outline on screen, for the overlay and its toolbar. */
  selectionRect(): Rect | null {
    const rects = [...this.ui.selection, ...this.ui.strokeSelection].map((id) => this.rectOf(id)).filter((r): r is Rect => !!r)
    const u = union(rects)
    return u ? this.screenRect(u) : null
  }

  /** The one selected object that can be resized, if exactly one is selected. */
  resizable(): BoardObject | null {
    if (this.ui.selection.length !== 1 || this.ui.strokeSelection.length) return null
    const o = this.get(this.ui.selection[0]!)
    return o && RESIZABLE.has(o.kind) ? o : null
  }

  // ---- tools and styles -----------------------------------------------------

  setTool(t: Tool) {
    this.commitEdit()
    this.ui.tool = t
    if (t !== 'pen') this.ui.eraser = false
    if (t !== 'select') this.select([], [])
  }

  setStickyColor(c: StickyColor) {
    this.ui.stickyColor = c
    const ids = this.ui.selection.filter((id) => this.get(id)?.kind === 'sticky')
    if (ids.length) this.commit(() => patchObjects(this.parts, Object.fromEntries(ids.map((id) => [id, { color: c }]))))
  }

  setShapeFill(f: ShapeFill) {
    const ids = this.ui.selection.filter((id) => this.get(id)?.kind === 'shape')
    if (ids.length) this.commit(() => patchObjects(this.parts, Object.fromEntries(ids.map((id) => [id, { fill: f }]))))
  }

  setShapeKind(s: ShapeKind) {
    this.ui.shape = s
    const ids = this.ui.selection.filter((id) => this.get(id)?.kind === 'shape')
    if (ids.length) this.commit(() => patchObjects(this.parts, Object.fromEntries(ids.map((id) => [id, { shape: s }]))))
  }

  select(ids: string[], strokes: string[] = []) {
    const before = new Set([...this.ui.selection, ...ids])
    this.ui.selection = ids
    this.ui.strokeSelection = strokes
    // Connectors draw themselves blue while selected.
    for (const id of before) if (this.cache.get(id)?.kind === 'connector') this.drawOne(id)
  }

  selectAll() {
    this.select([...this.cache.keys()].filter((id) => this.cache.get(id)!.kind !== 'frame'), [...this.strokes.keys()])
  }

  // ---- writing --------------------------------------------------------------

  /** One gesture, one undo step. */
  private commit(fn: () => void) {
    this.undoManager.stopCapturing()
    change(this.parts, fn)
    this.undoManager.stopCapturing()
  }

  undo() {
    this.commitEdit()
    this.undoManager.undo()
  }

  redo() {
    this.commitEdit()
    this.undoManager.redo()
  }

  private nextZ(): number {
    return maxZ(this.cache.values()) + 1
  }

  deleteSelection() {
    const ids = withSubtrees(this.parts, this.ui.selection)
    const conns = attachedConnectors(this.parts, ids)
    const strokes = [...this.ui.strokeSelection]
    const roots = new Set<string>()
    for (const id of ids) {
      const o = this.cache.get(id)
      if (o?.kind === 'mind' && o.parent && !ids.has(o.parent)) roots.add(o.parent)
    }
    this.commit(() => {
      removeObjects(this.parts, [...ids, ...conns])
      if (strokes.length) eraseStrokes(this.parts, strokes)
      for (const r of roots) relayout(this.parts, r)
    })
    this.select([], [])
  }

  copy() {
    const ids = withSubtrees(this.parts, this.ui.selection)
    for (const c of attachedConnectors(this.parts, ids)) {
      const o = this.cache.get(c) as ConnectorObj
      const ok = (e: End) => !('id' in e) || ids.has(e.id)
      if (ok(o.from) && ok(o.to)) ids.add(c)
    }
    const objects = [...ids].map((id) => this.cache.get(id)).filter((o): o is BoardObject => !!o)
    const strokes = this.ui.strokeSelection.map((id) => {
      const s = this.strokes.get(id)!
      const m = this.parts.moved.get(id)
      if (!m) return s
      // Bake a moved stroke's offset into the copy: the copy is a new stroke.
      return { ...s, pts: s.pts.map((v, i) => (i % 4 === 0 ? v + Math.round(m.dx * 10) : i % 4 === 1 ? v + Math.round(m.dy * 10) : v)) }
    })
    if (!objects.length && !strokes.length) return
    clipboard = { objects, strokes }
    try {
      void navigator.clipboard?.writeText(JSON.stringify({ [CLIP_MARK]: clipboard }))
    } catch {
      // The in-app clipboard above is enough within this tab.
    }
  }

  async paste(at?: Pt) {
    let data = clipboard
    try {
      const text = await navigator.clipboard?.readText()
      const parsed = text ? JSON.parse(text) : null
      if (parsed?.[CLIP_MARK]) data = parsed[CLIP_MARK]
    } catch {
      // Not ours, or no permission: fall back to the in-app clipboard.
    }
    if (data) this.insertCopy(data, at)
  }

  duplicate() {
    this.copy()
    if (clipboard) this.insertCopy(clipboard)
  }

  private insertCopy(data: { objects: BoardObject[]; strokes: Stroke[] }, at?: Pt) {
    const ids = new Map(data.objects.map((o) => [o.id, newId()]))
    const rects = [...data.objects.filter((o) => o.kind !== 'connector').map(objectRect), ...data.strokes.map((s) => strokeRect(s))]
    const box = union(rects)
    let dx = GRID * 2, dy = GRID * 2
    if (at && box) {
      dx = snap(at.x - (box.x + box.w / 2))
      dy = snap(at.y - (box.y + box.h / 2))
    }
    let z = this.nextZ()
    const objects: BoardObject[] = data.objects.map((o) => {
      const copy = { ...o, id: ids.get(o.id)!, z: o.kind === 'frame' ? 0 : z++ } as BoardObject
      if (copy.kind === 'connector') {
        const remap = (e: End): End => ('id' in e ? { id: ids.get(e.id) ?? e.id } : { x: e.x + dx, y: e.y + dy })
        copy.from = remap(copy.from)
        copy.to = remap(copy.to)
      } else {
        copy.x += dx
        copy.y += dy
      }
      if (copy.kind === 'mind') {
        const parent = copy.parent ? ids.get(copy.parent) : undefined
        copy.parent = parent ?? null
        if (!parent) copy.side = null
      }
      return copy
    })
    const strokes = data.strokes.map((s) => ({
      ...s, id: newId(), pts: s.pts.map((v, i) => (i % 4 === 0 ? v + Math.round(dx * 10) : i % 4 === 1 ? v + Math.round(dy * 10) : v)),
    }))
    this.commit(() => {
      addObjects(this.parts, objects)
      for (const s of strokes) appendStroke(this.parts, s)
      for (const o of objects) if (o.kind === 'mind' && !o.parent) relayout(this.parts, o.id)
    })
    this.select(objects.filter((o) => o.kind !== 'connector' || !objects.some((x) => x.kind === 'mind')).map((o) => o.id), strokes.map((s) => s.id))
  }

  nudge(dx: number, dy: number) {
    if (!this.ui.selection.length && !this.ui.strokeSelection.length) return
    const ids = this.movingSet(this.ui.selection)
    this.commit(() => {
      patchObjects(this.parts, Object.fromEntries(ids.filter((id) => this.cache.get(id)?.kind !== 'connector').map((id) => {
        const o = this.cache.get(id)!
        return [id, { x: o.x + dx, y: o.y + dy }]
      })))
      if (this.ui.strokeSelection.length) moveStrokes(this.parts, this.ui.strokeSelection, dx, dy)
    })
  }

  /** The objects that move with these: a mind node's branch, a frame's contents. */
  private movingSet(ids: string[]): string[] {
    const out = new Set<string>()
    const minds = this.mindMap()
    for (const id of ids) {
      const o = this.get(id)
      if (!o) continue
      if (o.kind === 'mind') for (const s of subtreeIds(minds, id)) out.add(s)
      else out.add(id)
      if (o.kind === 'frame') {
        for (const x of this.cache.values()) {
          if (x.kind !== 'frame' && x.kind !== 'connector' && contains(o, objectRect(x))) {
            out.add(x.id)
            if (x.kind === 'mind') for (const s of subtreeIds(minds, x.id)) out.add(s)
          }
        }
      }
    }
    return [...out]
  }

  private strokesIn(ids: string[]): string[] {
    const frames = ids.map((id) => this.get(id)).filter((o): o is BoardObject => o?.kind === 'frame')
    if (!frames.length) return []
    return [...this.strokes.keys()].filter((sid) => frames.some((f) => contains(f, this.rectOf(sid)!)))
  }

  // ---- placing things -------------------------------------------------------

  private placeSticky(at: Pt) {
    const o = { id: newId(), kind: 'sticky' as const, x: snap(at.x - 90), y: snap(at.y - 70), w: 180, h: 140, z: this.nextZ(), text: '', color: this.ui.stickyColor, by: this.opts.me }
    o.h = stickyHeight(o)
    this.commit(() => addObjects(this.parts, [o]))
    this.select([o.id])
    this.startEdit(o.id, '', true)
  }

  private placeShape(r: Rect) {
    const o = { id: newId(), kind: 'shape' as const, shape: this.ui.shape, x: snap(r.x), y: snap(r.y), w: Math.max(GRID * 2, snap(r.w)), h: Math.max(GRID * 2, snap(r.h)), z: this.nextZ(), text: '', fill: 'white' as const, stroke: 'ink' as const }
    this.commit(() => addObjects(this.parts, [o]))
    this.select([o.id])
    this.startEdit(o.id, '', true)
  }

  private placeText(at: Pt) {
    const o = { id: newId(), kind: 'text' as const, x: snap(at.x), y: snap(at.y - 14), w: 280, h: 28, z: this.nextZ(), text: '', size: 22 }
    this.commit(() => addObjects(this.parts, [o]))
    this.select([o.id])
    this.startEdit(o.id, '', true)
  }

  private placeFrame(r: Rect) {
    const n = [...this.cache.values()].filter((o) => o.kind === 'frame').length + 1
    const o = { id: newId(), kind: 'frame' as const, x: snap(r.x), y: snap(r.y), w: Math.max(GRID * 6, snap(r.w)), h: Math.max(GRID * 4, snap(r.h)), z: 0, title: `Frame ${n}` }
    this.commit(() => addObjects(this.parts, [o]))
    this.select([o.id])
    this.startEdit(o.id, o.title, true)
  }

  private placeMindRoot(at: Pt) {
    const s = mindSize({ text: 'Central idea' }, 0)
    const o: MindObj = { id: newId(), kind: 'mind', x: at.x - s.w / 2, y: at.y - s.h / 2, w: s.w, h: s.h, z: this.nextZ(), text: '', parent: null, side: null, order: 0, color: this.opts.color() }
    this.commit(() => addObjects(this.parts, [o]))
    this.select([o.id])
    this.startEdit(o.id, '', true)
  }

  placeImage(src: string, itemId: string | undefined, at: Pt, natural: { w: number; h: number }) {
    const k = Math.min(1, 480 / Math.max(natural.w, natural.h, 1))
    const w = Math.round(natural.w * k), h = Math.round(natural.h * k)
    const o = { id: newId(), kind: 'image' as const, x: snap(at.x - w / 2), y: snap(at.y - h / 2), w, h, z: this.nextZ(), src, item_id: itemId }
    this.commit(() => addObjects(this.parts, [o]))
    this.select([o.id])
    this.setTool('select')
    this.select([o.id])
  }

  placePage(item: { id: string; title: string; preview: string | null }, at: Pt) {
    const o: PageObj = { id: newId(), kind: 'page', x: snap(at.x - 110), y: snap(at.y - 50), w: 220, h: 0, z: this.nextZ(), item_id: item.id, title: item.title, preview: item.preview ?? '' }
    o.h = pageHeight(o)
    this.commit(() => addObjects(this.parts, [o]))
    this.setTool('select')
    this.select([o.id])
  }

  /** Ask for an image or a page to place, from a button rather than a tap on the board. */
  requestImage(at: Pt = this.viewCentre()) {
    this.opts.onRequestImage?.(at)
  }

  requestPage(at: Pt = this.viewCentre()) {
    this.opts.onRequestPage?.(at)
  }

  /** Where new things go when there's no pointer: the middle of the view. */
  viewCentre(): Pt {
    return toWorld(this.ui.camera, { x: this.ui.size.w / 2, y: this.ui.size.h / 2 })
  }

  // ---- mind map -------------------------------------------------------------

  addChild(id = this.ui.selection[0]) {
    const o = id ? this.get(id) : undefined
    if (o?.kind !== 'mind') return
    this.commitEdit()
    this.undoManager.stopCapturing()
    const child = addMindChild(this.parts, o.id)
    if (child) {
      this.select([child])
      this.startEdit(child, '', true)
    }
  }

  addSibling(id = this.ui.selection[0]) {
    const o = id ? this.get(id) : undefined
    if (o?.kind !== 'mind') return
    this.commitEdit()
    this.undoManager.stopCapturing()
    const sib = addMindSibling(this.parts, o.id)
    if (sib) {
      this.select([sib])
      this.startEdit(sib, '', true)
    }
  }

  /**
   * Merge a generated map into the tree with the same root ("Quiz 2" into
   * "Quiz 2"), or else add it as a new tree in the free space to the right of
   * everything, centred on the content. One undo step either way.
   */
  applyMapPlan(plan: MapPlan, preferRoot?: string | null): { rootId: string; added: number } {
    this.commitEdit()
    const minds = this.mindMap()
    const same = (m: MindObj) => m.parent === null && m.text.trim().toLowerCase() === plan.root.text.trim().toLowerCase()
    const into = preferRoot && minds.has(preferRoot) ? preferRoot : [...minds.values()].find(same)?.id ?? null
    const before = this.contentBounds()
    let out = { rootId: '', added: 0 }
    this.commit(() => {
      out = applyMap(this.parts, plan, { intoRoot: into, at: this.viewCentre(), color: this.opts.color() })
      if (into || !before) return
      const nodes = mindNodes(this.parts)
      const tree = union(subtreeIds(nodes, out.rootId).map((id) => nodes.get(id)!).map(objectRect))
      const root = nodes.get(out.rootId)
      if (!tree || !root) return
      const dx = before.x + before.w + 160 - tree.x
      const dy = before.y + before.h / 2 - (tree.y + tree.h / 2)
      patchObjects(this.parts, { [root.id]: { x: root.x + dx, y: root.y + dy } })
      relayout(this.parts, root.id)
    })
    return out
  }

  // ---- text editing ---------------------------------------------------------

  startEdit(id: string, text?: string, fresh = false) {
    const o = this.get(id)
    if (!o || !EDITABLE.has(o.kind)) return
    if (this.ui.editing && this.ui.editing.id !== id) this.commitEdit()
    const current = o.kind === 'frame' ? o.title : 'text' in o ? o.text : ''
    this.ui.editing = { id, kind: o.kind, text: text ?? current, fresh }
    this.scene.hide(this.layerOf(o), id, true)
    this.undoManager.stopCapturing()
  }

  /** Live text while typing: re-measured so the box grows under the caret. */
  editText(text: string) {
    if (this.ui.editing) this.ui.editing.text = text
  }

  /**
   * Finish editing. `then` chains the mind-map keys: Tab commits and adds a
   * child, Enter commits (and adds a sibling when asked from the keyboard).
   */
  commitEdit(then?: 'child' | 'sibling') {
    const ed = this.ui.editing
    if (!ed) return
    this.ui.editing = null
    const o = this.cache.get(ed.id)
    if (!o) return
    this.scene.hide(this.layerOf(o), ed.id, false)
    const text = ed.text.replace(/\s+$/, '')
    const isMind = o.kind === 'mind'
    if (!text && ed.fresh && o.kind !== 'frame' && !(isMind && [...this.cache.values()].some((x) => x.kind === 'mind' && x.parent === o.id))) {
      const parent = isMind ? o.parent : null
      this.commit(() => {
        removeObjects(this.parts, [o.id])
        if (parent) relayout(this.parts, parent)
      })
      this.select(parent ? [parent] : [])
      return
    }
    this.commit(() => {
      if (o.kind === 'frame') patchObjects(this.parts, { [o.id]: { title: text || o.title } })
      else if (o.kind === 'sticky') patchObjects(this.parts, { [o.id]: { text, h: Math.max(stickyHeight({ ...o, text }), Math.min(o.h, stickyHeight({ ...o, text }) + 200)) } })
      else if (o.kind === 'text') patchObjects(this.parts, { [o.id]: { text, h: textHeight({ ...o, text }) } })
      else if (o.kind === 'shape') patchObjects(this.parts, { [o.id]: { text } })
      else if (o.kind === 'mind') {
        patchObjects(this.parts, { [o.id]: { text } })
        relayout(this.parts, o.id)
      }
    })
    this.drawOne(o.id)
    if (isMind && then === 'child') this.addChild(o.id)
    else if (isMind && then === 'sibling') this.addSibling(o.id)
  }

  cancelEdit() {
    const ed = this.ui.editing
    if (!ed) return
    if (ed.fresh) {
      ed.text = ''
      this.commitEdit()
      return
    }
    this.ui.editing = null
    const o = this.cache.get(ed.id)
    if (o) this.scene.hide(this.layerOf(o), ed.id, false)
  }

  // ---- present mode ---------------------------------------------------------

  /** Frames in reading order: rows top to bottom, left to right within a row. */
  framesInOrder(): BoardObject[] {
    const frames = [...this.cache.values()].filter((o) => o.kind === 'frame')
    return frames.sort((a, b) => (Math.abs(a.y - b.y) > Math.min(a.h, b.h) / 2 ? a.y - b.y : a.x - b.x))
  }

  startPresent() {
    this.commitEdit()
    const frames = this.framesInOrder().map((f) => f.id)
    this.select([], [])
    this.ui.present = { index: 0, frames }
    this.presentGo(0)
  }

  presentGo(delta: number) {
    const p = this.ui.present
    if (!p) return
    if (!p.frames.length) {
      this.zoomToFit(true, { top: 40, right: 40, bottom: 40, left: 40 })
      return
    }
    p.index = Math.max(0, Math.min(p.frames.length - 1, p.index + delta))
    const f = this.get(p.frames[p.index]!)
    if (f) this.animateTo(this.fitRect({ x: f.x, y: f.y - FRAME_TITLE_H, w: f.w, h: f.h + FRAME_TITLE_H }, { top: 32, right: 32, bottom: 72, left: 32 }, 3), 420)
  }

  stopPresent() {
    this.ui.present = null
    this.zoomToFit(true)
  }

  // ---- hit testing ----------------------------------------------------------

  private handleAt(screen: Pt): Handle | null {
    const o = this.resizable()
    if (!o) return null
    const r = this.screenRect(objectRect(o))
    const corners: [Handle, Pt][] = [['nw', { x: r.x, y: r.y }], ['ne', { x: r.x + r.w, y: r.y }], ['sw', { x: r.x, y: r.y + r.h }], ['se', { x: r.x + r.w, y: r.y + r.h }]]
    const reach = this.lastPointerType === 'touch' ? 18 : 9
    for (const [h, c] of corners) if (Math.abs(screen.x - c.x) <= reach && Math.abs(screen.y - c.y) <= reach) return h
    return null
  }

  private lastPointerType = 'mouse'

  /** What's under a board point: a stroke, an object, a connector, a frame by its title. */
  hit(p: Pt, opts: { frames?: boolean } = {}): { kind: 'object' | 'stroke'; id: string } | null {
    const s = this.ui.camera.scale
    const tol = (this.lastPointerType === 'touch' ? 10 : 4) / s
    for (let i = this.strokeOrder.length - 1; i >= 0; i--) {
      const id = this.strokeOrder[i]!
      const st = this.strokes.get(id)
      if (!st) continue
      const m = this.parts.moved.get(id)
      if (inRect(p, this.rectOf(id)!, tol) && hitStroke(st, p, tol, m?.dx ?? 0, m?.dy ?? 0)) return { kind: 'stroke', id }
    }
    const objs = [...this.cache.keys()].map((id) => this.get(id)!).filter((o) => o.kind !== 'frame' && o.kind !== 'connector').sort((a, b) => b.z - a.z)
    for (const o of objs) if (inRect(p, objectRect(o), this.lastPointerType === 'touch' ? 4 / s : 0)) return { kind: 'object', id: o.id }
    for (const o of this.cache.values()) {
      if (o.kind === 'connector' && hitConnector(o, p, (this.lastPointerType === 'touch' ? 12 : 6) / s, this.env.resolve)) return { kind: 'object', id: o.id }
    }
    const frames = [...this.cache.values()].filter((o) => o.kind === 'frame').sort((a, b) => b.z - a.z)
    for (const f of frames) {
      if (inRect(p, { x: f.x, y: f.y - FRAME_TITLE_H / s, w: Math.max(f.w * 0.6, 120 / s), h: FRAME_TITLE_H / s })) return { kind: 'object', id: f.id }
      if (opts.frames && inRect(p, objectRect(f))) return { kind: 'object', id: f.id }
    }
    return null
  }

  // ---- input ----------------------------------------------------------------

  private local(e: { clientX: number; clientY: number }): Pt {
    const r = this.host.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private world(e: { clientX: number; clientY: number }): Pt {
    return toWorld(this.ui.camera, this.local(e))
  }

  private bindInput() {
    const h = this.host
    const down = (e: PointerEvent) => this.onDown(e)
    const move = (e: PointerEvent) => this.onMove(e)
    const up = (e: PointerEvent) => this.onUp(e)
    const leave = () => this.opts.presence.move(null)
    const wheel = (e: WheelEvent) => this.onWheel(e)
    const dbl = (e: MouseEvent) => this.onDouble(e)
    // iOS Safari's own pinch-to-zoom of the page; the board does its own.
    const gesture = (e: Event) => e.preventDefault()
    // The browser moves focus on mousedown (also the one a tap synthesises).
    // On the board that would blur a note the same press just opened for
    // typing; inside the editor it must still place the caret.
    const mousedown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement | null)?.closest('textarea, input')) e.preventDefault()
    }
    const key = (e: KeyboardEvent) => this.onKey(e)
    const keyup = (e: KeyboardEvent) => {
      if (e.code === 'Space') this.ui.spaceDown = false
    }
    h.addEventListener('pointerdown', down)
    h.addEventListener('pointermove', move)
    h.addEventListener('pointerup', up)
    h.addEventListener('pointercancel', up)
    h.addEventListener('pointerleave', leave)
    h.addEventListener('wheel', wheel, { passive: false })
    h.addEventListener('dblclick', dbl)
    h.addEventListener('mousedown', mousedown)
    h.addEventListener('gesturestart', gesture)
    h.addEventListener('gesturechange', gesture)
    window.addEventListener('keydown', key)
    window.addEventListener('keyup', keyup)
    this.unbind.push(() => {
      h.removeEventListener('pointerdown', down)
      h.removeEventListener('pointermove', move)
      h.removeEventListener('pointerup', up)
      h.removeEventListener('pointercancel', up)
      h.removeEventListener('pointerleave', leave)
      h.removeEventListener('wheel', wheel)
      h.removeEventListener('dblclick', dbl)
      h.removeEventListener('mousedown', mousedown)
      h.removeEventListener('gesturestart', gesture)
      h.removeEventListener('gesturechange', gesture)
      window.removeEventListener('keydown', key)
      window.removeEventListener('keyup', keyup)
    })
  }

  private onDown(e: PointerEvent) {
    this.lastPointerType = e.pointerType
    if (this.ui.present) {
      this.presentGo(e.clientX > window.innerWidth / 2 ? 1 : -1)
      return
    }
    if (e.pointerType === 'pen') this.ui.penSeen = true
    if (this.ui.editing) this.commitEdit()
    const screen = this.local(e)
    const p = toWorld(this.ui.camera, screen)
    try {
      this.host.setPointerCapture(e.pointerId)
    } catch {
      // A synthetic pointer can't be captured; the gesture still works.
    }

    // Fingers: a second one turns whatever the first was doing into a pinch.
    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, screen)
      if (this.touches.size >= 2) {
        this.cancelGesture()
        const [a, b] = [...this.touches.values()]
        this.gesture = { k: 'pinch', d: Math.hypot(a!.x - b!.x, a!.y - b!.y), mid: { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }, cam: { ...this.ui.camera } }
        return
      }
    }

    const tool = this.ui.tool
    const pan = () => (this.gesture = { k: 'pan', id: e.pointerId, start: screen, cam: { ...this.ui.camera } })
    if (e.button === 1 || this.ui.spaceDown) return void pan()

    // The pen tool: a pen draws (its eraser end erases); fingers draw only until a pen shows up.
    if (tool === 'pen') {
      if (e.pointerType === 'touch' && this.ui.penSeen) return void pan()
      if (this.ui.eraser || (e.buttons & 32) !== 0) {
        this.gesture = { k: 'erase', id: e.pointerId, hit: new Set() }
        this.eraseAt(p)
        return
      }
      this.undoManager.stopCapturing()
      const size = Math.min(40, Math.max(1, this.ui.penSize / this.ui.camera.scale))
      this.gesture = { k: 'draw', id: e.pointerId, points: [{ ...p, p: pressureOf(e), t: eventTime(e) }], pen: e.pointerType === 'pen', size }
      return
    }
    // A pen in any other tool still writes: picking it up means "I want to write".
    if (e.pointerType === 'pen' && tool === 'select' && !this.hit(p)) {
      const size = Math.min(40, Math.max(1, this.ui.penSize / this.ui.camera.scale))
      this.gesture = { k: 'draw', id: e.pointerId, points: [{ ...p, p: pressureOf(e), t: eventTime(e) }], pen: true, size }
      return
    }

    if (tool === 'sticky') return void this.afterPlace(() => this.placeSticky(p), e.shiftKey)
    if (tool === 'text') return void this.afterPlace(() => this.placeText(p), e.shiftKey)
    if (tool === 'mind') return void this.afterPlace(() => this.placeMindRoot(p), e.shiftKey)
    if (tool === 'image') return void this.afterPlace(() => this.opts.onRequestImage?.(p), true)
    if (tool === 'page') return void this.afterPlace(() => this.opts.onRequestPage?.(p), true)
    if (tool === 'frame' || tool === 'shape') {
      this.gesture = { k: 'create', id: e.pointerId, tool, start: p }
      this.ui.box = { x: p.x, y: p.y, w: 0, h: 0 }
      return
    }
    if (tool === 'connector') {
      const hit = this.hit(p)
      const from: End = hit?.kind === 'object' && this.get(hit.id)?.kind !== 'connector' ? { id: hit.id } : { x: p.x, y: p.y }
      this.gesture = { k: 'connect', id: e.pointerId, from, start: p }
      this.ui.draft = { a: 'id' in from ? center(objectRect(this.get(from.id)!)) : p, b: p }
      return
    }

    // Select tool.
    const handle = this.handleAt(screen)
    if (handle) {
      const o = this.resizable()!
      this.gesture = { k: 'resize', id: e.pointerId, obj: o.id, handle, start: p, rect: objectRect(o) }
      return
    }
    const hit = this.hit(p)
    if (!hit) {
      if (e.pointerType === 'touch') return void pan()
      this.gesture = { k: 'marquee', id: e.pointerId, start: p, add: e.shiftKey }
      if (!e.shiftKey) this.select([], [])
      this.ui.box = { x: p.x, y: p.y, w: 0, h: 0 }
      return
    }
    const isStroke = hit.kind === 'stroke'
    const wasSelected = isStroke ? this.ui.strokeSelection.includes(hit.id) : this.ui.selection.includes(hit.id)
    if (e.shiftKey) {
      if (isStroke) this.select(this.ui.selection, wasSelected ? this.ui.strokeSelection.filter((x) => x !== hit.id) : [...this.ui.strokeSelection, hit.id])
      else this.select(wasSelected ? this.ui.selection.filter((x) => x !== hit.id) : [...this.ui.selection, hit.id], this.ui.strokeSelection)
    } else if (!wasSelected) {
      this.select(isStroke ? [] : [hit.id], isStroke ? [hit.id] : [])
    }
    const ids = this.movingSet(this.ui.selection)
    const strokes = [...new Set([...this.ui.strokeSelection, ...this.strokesIn(this.ui.selection)])]
    const base = union([...ids.map((id) => this.rectOf(id)), ...strokes.map((id) => this.rectOf(id))].filter((r): r is Rect => !!r)) ?? { x: p.x, y: p.y, w: 0, h: 0 }
    this.undoManager.stopCapturing()
    this.gesture = { k: 'move', id: e.pointerId, start: p, ids, strokes, dx: 0, dy: 0, moved: false, base, click: isStroke ? null : hit.id, wasSelected }
  }

  /** Placing tools act once, then hand back to select; holding Shift keeps the tool. */
  private afterPlace(fn: () => void, keep: boolean) {
    const tool = this.ui.tool
    fn()
    if (!keep && tool !== 'image' && tool !== 'page') this.ui.tool = 'select'
  }

  private onMove(e: PointerEvent) {
    const screen = this.local(e)
    const p = toWorld(this.ui.camera, screen)
    this.lastPointer = p
    if (e.pointerType !== 'touch' && performance.now() - this.presenceAt > 50) {
      this.presenceAt = performance.now()
      this.opts.presence.move(p)
    }
    const g = this.gesture
    if (e.pointerType === 'touch' && this.touches.has(e.pointerId)) this.touches.set(e.pointerId, screen)
    if (!g) return

    if (g.k === 'pinch') {
      if (this.touches.size < 2) return
      const [a, b] = [...this.touches.values()]
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y)
      const mid = { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, g.cam.scale * (d / Math.max(1, g.d))))
      const w = toWorld(g.cam, g.mid)
      this.userCamera({ scale, x: mid.x - w.x * scale, y: mid.y - w.y * scale })
      return
    }
    if ('id' in g && g.id !== e.pointerId) return

    switch (g.k) {
      case 'pan':
        this.userCamera({ ...g.cam, x: g.cam.x + screen.x - g.start.x, y: g.cam.y + screen.y - g.start.y })
        return
      case 'draw': {
        for (const ev of coalesced(e)) g.points.push({ ...this.world(ev), p: pressureOf(ev), t: eventTime(ev) })
        const extra = predicted(e).map((ev) => ({ ...this.world(ev), p: pressureOf(ev), t: eventTime(ev) }))
        this.drawWet(g.points.concat(extra), g)
        return
      }
      case 'erase':
        for (const ev of coalesced(e)) this.eraseAt(this.world(ev))
        return
      case 'marquee': {
        const r = normRect(g.start, p)
        this.ui.box = r
        const ids = [...this.cache.values()].filter((o) => (o.kind === 'frame' ? contains(r, objectRect(o)) : o.kind === 'connector' ? contains(r, connectorRect(o, this.env.resolve)) : intersects(r, objectRect(o)))).map((o) => o.id)
        const strokes = [...this.strokes.keys()].filter((id) => intersects(r, this.rectOf(id)!))
        this.select(g.add ? [...new Set([...this.ui.selection, ...ids])] : ids, strokes)
        return
      }
      case 'create':
        this.ui.box = normRect(g.start, p)
        return
      case 'connect': {
        const hit = this.hit(p)
        const target = hit?.kind === 'object' && this.get(hit.id)?.kind !== 'connector' && !('id' in g.from && g.from.id === hit.id) ? hit.id : null
        this.ui.target = target
        const a = 'id' in g.from ? center(objectRect(this.get(g.from.id)!)) : g.start
        this.ui.draft = { a, b: target ? center(objectRect(this.get(target)!)) : p }
        return
      }
      case 'resize':
        this.resizePreview(g, p, e.shiftKey)
        return
      case 'move': {
        let dx = p.x - g.start.x, dy = p.y - g.start.y
        const reach = (e.pointerType === 'touch' ? 8 : 3) / this.ui.camera.scale
        if (!g.moved && Math.hypot(dx, dy) < reach) return
        if (!g.moved && g.click && !this.ui.selection.includes(g.click)) this.select([g.click])
        g.moved = true
        // Snap the selection's corner to the dot grid; Alt moves freely.
        if (!e.altKey && !g.ids.every((id) => this.cache.get(id)?.kind === 'mind')) {
          dx = snap(g.base.x + dx) - g.base.x
          dy = snap(g.base.y + dy) - g.base.y
        }
        g.dx = dx
        g.dy = dy
        this.movePreview(g)
        return
      }
    }
  }

  private movePreview(g: Extract<Gesture, { k: 'move' }>) {
    const moved = new Set<string>()
    for (const id of g.ids) {
      const o = this.cache.get(id)
      if (!o || o.kind === 'connector') continue
      this.preview.set(id, { x: o.x + g.dx, y: o.y + g.dy })
      this.scene.move(this.layerOf(o), id, o.x + g.dx, o.y + g.dy)
      moved.add(id)
    }
    for (const id of g.strokes) {
      const m = this.parts.moved.get(id) ?? { dx: 0, dy: 0 }
      this.preview.set(id, { x: g.dx, y: g.dy } as Partial<BoardObject>)
      this.scene.move('ink', id, m.dx + g.dx, m.dy + g.dy)
    }
    // Connectors and mind links bend to follow.
    for (const id of this.dependents(moved)) if (!moved.has(id)) this.drawOne(id)
    for (const id of moved) {
      const o = this.get(id)
      if (o?.kind === 'mind') this.drawOne(id)
    }
    for (const o of this.cache.values()) {
      if (o.kind === 'mind' && o.parent && moved.has(o.parent) && !moved.has(o.id)) this.drawOne(o.id)
    }
    this.ui.version++
  }

  private resizePreview(g: Extract<Gesture, { k: 'resize' }>, p: Pt, keepRatio: boolean) {
    const o = this.cache.get(g.obj)
    if (!o) return
    const r = g.rect
    let x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h
    if (g.handle.includes('w')) x0 = snap(p.x)
    if (g.handle.includes('e')) x1 = snap(p.x)
    if (g.handle.includes('n')) y0 = snap(p.y)
    if (g.handle.includes('s')) y1 = snap(p.y)
    const min = GRID * 2
    if (x1 - x0 < min) g.handle.includes('w') ? (x0 = x1 - min) : (x1 = x0 + min)
    if (y1 - y0 < min) g.handle.includes('n') ? (y0 = y1 - min) : (y1 = y0 + min)
    let w = x1 - x0, h = y1 - y0
    if (keepRatio || o.kind === 'image') {
      const ratio = r.w / r.h
      if (w / h > ratio) w = h * ratio
      else h = w / ratio
      if (g.handle.includes('w')) x0 = x1 - w
      if (g.handle.includes('n')) y0 = y1 - h
    }
    // Text and page cards size their own height from their contents.
    if (o.kind === 'text') h = textHeight({ ...o, w })
    if (o.kind === 'page') h = pageHeight({ ...o, w })
    if (o.kind === 'sticky') h = Math.max(h, stickyHeight({ ...o, w }))
    this.preview.set(g.obj, { x: x0, y: y0, w, h })
    this.drawOne(g.obj)
    for (const id of this.dependents(new Set([g.obj]))) if (id !== g.obj) this.drawOne(id)
    this.ui.version++
  }

  private onUp(e: PointerEvent) {
    if (e.pointerType === 'touch') {
      this.touches.delete(e.pointerId)
      if (this.gesture?.k === 'pinch') {
        if (this.touches.size < 2) this.gesture = null
        return
      }
    }
    const g = this.gesture
    if (!g || ('id' in g && g.id !== e.pointerId)) return
    this.gesture = null
    const p = this.world(e)

    switch (g.k) {
      case 'pan': {
        // A finger that didn't move was a tap on empty board: it clears the selection.
        const s = this.local(e)
        if (e.pointerType === 'touch' && this.ui.tool === 'select' && Math.hypot(s.x - g.start.x, s.y - g.start.y) < 8) this.select([], [])
        return
      }
      case 'draw': {
        for (const ev of coalesced(e)) g.points.push({ ...this.world(ev), p: pressureOf(ev), t: eventTime(ev) })
        if (g.points.length < 2) g.points.push({ ...g.points[0]!, x: g.points[0]!.x + 0.1, t: g.points[0]!.t + 1 })
        const t0 = g.points[0]!.t
        const stroke: Stroke = { id: newId(), by: this.opts.me, color: this.ui.penColor, size: Math.round(g.size * 10) / 10, t0: Math.round(t0), pts: packPoints(g.points, t0), pen: g.pen }
        this.commit(() => appendStroke(this.parts, stroke))
        // Keep the wet ink up until the engine has painted the stroke underneath it.
        requestAnimationFrame(() => requestAnimationFrame(() => this.clearWet()))
        return
      }
      case 'erase':
        if (g.hit.size) this.commit(() => eraseStrokes(this.parts, g.hit))
        return
      case 'marquee':
        this.ui.box = null
        return
      case 'create': {
        this.ui.box = null
        const r = normRect(g.start, p)
        const small = r.w * this.ui.camera.scale < 8 && r.h * this.ui.camera.scale < 8
        if (g.tool === 'frame') this.placeFrame(small ? { x: p.x - 320, y: p.y - 200, w: 640, h: 400 } : r)
        else this.placeShape(small ? { x: p.x - 80, y: p.y - 50, w: 160, h: 100 } : r)
        this.ui.tool = 'select'
        return
      }
      case 'connect': {
        const target = this.ui.target
        this.ui.draft = null
        this.ui.target = null
        const to: End = target ? { id: target } : { x: p.x, y: p.y }
        const len = Math.hypot(p.x - g.start.x, p.y - g.start.y) * this.ui.camera.scale
        if (!target && len < 12) return
        const c: ConnectorObj = { id: newId(), kind: 'connector', x: 0, y: 0, w: 0, h: 0, z: this.nextZ(), from: g.from, to }
        this.commit(() => addObjects(this.parts, [c]))
        this.select([c.id])
        return
      }
      case 'resize': {
        const pv = this.preview.get(g.obj)
        this.preview.delete(g.obj)
        if (pv) this.commit(() => patchObjects(this.parts, { [g.obj]: pv }))
        return
      }
      case 'move':
        this.endMove(g, p, e)
        return
    }
  }

  private endMove(g: Extract<Gesture, { k: 'move' }>, p: Pt, e: PointerEvent) {
    for (const id of [...g.ids, ...g.strokes]) this.preview.delete(id)
    if (!g.moved) {
      const o = g.click ? this.get(g.click) : undefined
      // A tap on a page card opens the page; a drag moves it.
      if (o?.kind === 'page' && !e.shiftKey) {
        this.opts.onOpenPage?.(o.item_id)
        return
      }
      const now = performance.now()
      // A second tap on the same thing edits it (touch has no dblclick worth trusting).
      if (o && this.lastTap.id === o.id && now - this.lastTap.at < 350 && e.pointerType === 'touch') this.startEdit(o.id)
      else if (o && g.wasSelected && e.pointerType === 'touch' && EDITABLE.has(o.kind) && now - this.lastTap.at > 350) {
        // Tapping something already selected on a phone opens it for typing.
        this.startEdit(o.id)
      }
      this.lastTap = { id: o?.id ?? null, at: now, p }
      return
    }
    const minds = this.mindMap()
    const dragged = g.click ? this.cache.get(g.click) : undefined
    // A branch dropped onto another node of a tree moves there.
    if (dragged?.kind === 'mind' && dragged.parent !== null && g.ids.every((id) => this.cache.get(id)?.kind === 'mind')) {
      const sub = new Set(subtreeIds(minds, dragged.id))
      const onto = [...minds.values()].find((m) => !sub.has(m.id) && inRect(p, objectRect(m)))
      this.commit(() => {
        if (onto) {
          const root = rootOf(minds, onto.id)
          const side = onto.parent === null ? (p.x < onto.x + onto.w / 2 ? 'l' : 'r') : onto.side
          patchObjects(this.parts, { [dragged.id]: { parent: onto.id, side, order: Date.now() } })
          for (const s of sub) if (s !== dragged.id) patchObjects(this.parts, { [s]: { side } })
          if (root) relayout(this.parts, root.id)
        }
        relayout(this.parts, dragged.parent!)
      })
      // Without a commit the preview is gone and the tree redraws where it was.
      for (const id of g.ids) this.drawOne(id)
      return
    }
    this.commit(() => {
      const patches: Record<string, Partial<BoardObject>> = {}
      for (const id of g.ids) {
        const o = this.cache.get(id)
        if (o && o.kind !== 'connector') patches[id] = { x: o.x + g.dx, y: o.y + g.dy }
      }
      patchObjects(this.parts, patches)
      if (g.strokes.length) moveStrokes(this.parts, g.strokes, g.dx, g.dy)
      const roots = new Set<string>()
      for (const id of g.ids) {
        const o = this.cache.get(id)
        if (o?.kind === 'mind' && o.parent === null) roots.add(id)
      }
      for (const r of roots) relayout(this.parts, r)
    })
  }

  private cancelGesture() {
    const g = this.gesture
    this.gesture = null
    if (!g) return
    if (g.k === 'move') {
      for (const id of [...g.ids, ...g.strokes]) this.preview.delete(id)
      for (const id of g.ids) this.drawOne(id)
      this.strokesDirty = true
      for (const id of g.strokes) this.drawnStrokes.set(id, '')
      this.schedule()
    }
    if (g.k === 'resize') {
      this.preview.delete(g.obj)
      this.drawOne(g.obj)
    }
    if (g.k === 'draw') this.clearWet()
    this.ui.box = null
    this.ui.draft = null
  }

  private eraseAt(p: Pt) {
    const g = this.gesture
    if (g?.k !== 'erase') return
    const tol = 6 / this.ui.camera.scale
    for (const id of this.strokeOrder) {
      if (g.hit.has(id)) continue
      const s = this.strokes.get(id)!
      const m = this.parts.moved.get(id)
      if (inRect(p, this.rectOf(id)!, tol) && hitStroke(s, p, tol, m?.dx ?? 0, m?.dy ?? 0)) {
        g.hit.add(id)
        this.scene.hide('ink', id, true)
      }
    }
  }

  private drawWet(points: StrokePoint[], g: { pen: boolean; size: number }) {
    const ctx = this.wet.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const cam = this.ui.camera
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, this.ui.size.w, this.ui.size.h)
    ctx.setTransform(dpr * cam.scale, 0, 0, dpr * cam.scale, dpr * cam.x, dpr * cam.y)
    ctx.fillStyle = pen()[this.ui.penColor]
    ctx.fill(new Path2D(strokePath(points, { size: g.size, pen: g.pen }, false)))
  }

  private clearWet() {
    const ctx = this.wet.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, this.wet.width, this.wet.height)
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault()
    if (this.ui.present) return
    const at = this.local(e)
    // A trackpad pinch arrives as a wheel with ctrlKey; a mouse wheel as whole
    // notches with no sideways part; anything else is a two-finger scroll.
    const notch = e.deltaMode === 1 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 40 && Number.isInteger(e.deltaY))
    if (e.ctrlKey || e.metaKey) this.zoomAround(Math.exp(-e.deltaY * (notch ? 0.002 : 0.01)), at)
    else if (notch && !e.shiftKey) this.zoomAround(Math.exp(-e.deltaY * 0.0018), at)
    else {
      const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX
      const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY
      this.userCamera({ ...this.ui.camera, x: this.ui.camera.x - dx, y: this.ui.camera.y - dy })
    }
  }

  private onDouble(e: MouseEvent) {
    if (this.ui.present) return
    const p = this.world(e)
    const hit = this.hit(p, { frames: false })
    if (hit?.kind === 'object') {
      const o = this.get(hit.id)!
      if (o.kind === 'page') this.opts.onOpenPage?.(o.item_id)
      else this.startEdit(o.id)
    } else if (!hit && this.ui.tool === 'select') {
      // Double-click on empty board: a sticky, the commonest thing to want.
      this.placeSticky(p)
    }
  }

  private onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
    if (this.ui.editing) return
    const mod = e.metaKey || e.ctrlKey
    const k = e.key

    if (this.ui.present) {
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ') this.presentGo(1)
      else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') this.presentGo(-1)
      else if (k === 'Escape') this.stopPresent()
      else return
      e.preventDefault()
      return
    }

    if (e.code === 'Space' && !mod) {
      this.ui.spaceDown = true
      e.preventDefault()
      return
    }
    if (mod) {
      const lower = k.toLowerCase()
      if (lower === 'z') this[e.shiftKey ? 'redo' : 'undo']()
      else if (lower === 'y') this.redo()
      else if (lower === 'c') this.copy()
      else if (lower === 'x') {
        this.copy()
        this.deleteSelection()
      } else if (lower === 'v') void this.paste(this.lastPointer ?? undefined)
      else if (lower === 'd') this.duplicate()
      else if (lower === 'a') this.selectAll()
      else if (k === '=' || k === '+') this.zoomAround(1.2)
      else if (k === '-') this.zoomAround(1 / 1.2)
      else if (k === '0') this.zoomAround(1 / this.ui.camera.scale)
      else return
      e.preventDefault()
      return
    }

    const one = this.ui.selection.length === 1 ? this.get(this.ui.selection[0]!) : undefined
    if (one?.kind === 'mind' && (k === 'Tab' || k === 'Enter')) {
      e.preventDefault()
      if (k === 'Tab') this.addChild(one.id)
      else this.addSibling(one.id)
      return
    }
    if (k === 'Enter' && one && EDITABLE.has(one.kind)) {
      e.preventDefault()
      this.startEdit(one.id)
      return
    }
    if (k === 'Delete' || k === 'Backspace') {
      this.deleteSelection()
      e.preventDefault()
      return
    }
    if (k === 'Escape') {
      this.select([], [])
      this.setTool('select')
      return
    }
    if (k.startsWith('Arrow') && (this.ui.selection.length || this.ui.strokeSelection.length)) {
      const step = e.shiftKey ? GRID : 1
      this.nudge(k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0, k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0)
      e.preventDefault()
      return
    }
    if (k === '!' || (e.shiftKey && e.code === 'Digit1')) {
      this.zoomToFit()
      return
    }
    // Typing on a selected note starts editing it with that letter.
    if (one && EDITABLE.has(one.kind) && one.kind !== 'frame' && k.length === 1 && !e.altKey) {
      e.preventDefault()
      this.startEdit(one.id, k)
      return
    }
    const tools: Record<string, Tool> = { v: 'select', s: 'sticky', n: 'sticky', r: 'shape', t: 'text', l: 'connector', f: 'frame', p: 'pen', m: 'mind', i: 'image' }
    const tool = tools[k.toLowerCase()]
    if (tool) this.setTool(tool)
    else if (k.toLowerCase() === 'e') {
      this.setTool('pen')
      this.ui.eraser = true
    } else if (k === '=' || k === '+') this.zoomAround(1.2)
    else if (k === '-') this.zoomAround(1 / 1.2)
  }

  // ---- minimap --------------------------------------------------------------

  /** Everything the minimap draws, in board coordinates. */
  overview(): { bounds: Rect; items: { r: Rect; kind: ObjKind | 'stroke'; color?: string }[]; view: Rect } | null {
    const content = this.contentBounds()
    const view = this.viewRect()
    const bounds = union([content ?? view, view])!
    const items: { r: Rect; kind: ObjKind | 'stroke'; color?: string }[] = []
    for (const o of this.cache.values()) {
      if (o.kind === 'connector') continue
      const v = this.get(o.id)!
      items.push({ r: objectRect(v), kind: o.kind, color: o.kind === 'sticky' ? sticky()[o.color] : o.kind === 'mind' ? paint(o.color) : undefined })
    }
    for (const id of this.strokes.keys()) items.push({ r: this.rectOf(id)!, kind: 'stroke' })
    return { bounds, items, view }
  }

  viewRect(): Rect {
    const a = toWorld(this.ui.camera, { x: 0, y: 0 })
    return { x: a.x, y: a.y, w: this.ui.size.w / this.ui.camera.scale, h: this.ui.size.h / this.ui.camera.scale }
  }

  /** Centre the view on a board point (minimap clicks and drags). */
  centreOn(p: Pt, animate = false) {
    const cam = this.ui.camera
    const target = { scale: cam.scale, x: this.ui.size.w / 2 - p.x * cam.scale, y: this.ui.size.h / 2 - p.y * cam.scale }
    this.ui.moved = true
    if (animate) this.animateTo(target, 240)
    else this.setCamera(target)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    cancelAnimationFrame(this.camAnim)
    for (const u of this.unbind) u()
    this.undoManager.destroy()
  }
}

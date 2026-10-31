/**
 * Edits that touch several objects at once: growing a mind map, laying it
 * out, merging an AI map into one that's already there. Each runs inside one
 * transaction, so it is one step for undo and one update on the wire.
 */
import type { BoardObject, BoardParts, FrameObj, MindObj } from './model'
import { addObjects, change, maxZ, newId, patchObjects, readObject } from './model'
import { balancedSide, childrenOf, layoutTree, rootOf, subtreeIds } from './mindmap'
import { contains, strokeRect, union, type Pt, type Rect } from './geometry'
import { mindSize } from './draw'

export function allObjects(parts: BoardParts): BoardObject[] {
  const out: BoardObject[] = []
  parts.objects.forEach((m) => out.push(readObject(m)))
  return out
}

export function mindNodes(parts: BoardParts): Map<string, MindObj> {
  const out = new Map<string, MindObj>()
  parts.objects.forEach((m, id) => {
    if (m.get('kind') === 'mind') out.set(id, readObject(m) as MindObj)
  })
  return out
}

/** Lay a tree out again from its root, and grow the frame it started in to hold it. */
export function relayout(parts: BoardParts, anyId: string) {
  const nodes = mindNodes(parts)
  const root = rootOf(nodes, anyId)
  if (!root) return
  const pos = layoutTree(nodes, root.id)
  change(parts, () => {
    patchObjects(parts, Object.fromEntries(Object.entries(pos).map(([id, p]) => [id, { x: p.x, y: p.y, w: p.w, h: p.h, side: p.side }])))
    growFrameAround(parts, root, Object.values(pos))
  })
}

/**
 * A tree whose root sits in a frame keeps inside it: the frame grows, never
 * shrinks, and whatever stood beside it moves over by as much as it grew, so
 * a map filling out never ends up under the next frame or a note.
 */
function growFrameAround(parts: BoardParts, root: MindObj, boxes: Rect[]) {
  const tree = union(boxes)
  if (!tree) return
  const frame = allObjects(parts).find((o): o is FrameObj => o.kind === 'frame' && contains(o, { x: root.x, y: root.y, w: root.w, h: root.h }))
  if (!frame) return
  const pad = 36
  const want = { x: tree.x - pad, y: tree.y - pad, w: tree.w + pad * 2, h: tree.h + pad * 2 }
  if (contains(frame, want)) return
  const x0 = Math.min(frame.x, want.x), y0 = Math.min(frame.y, want.y)
  const x1 = Math.max(frame.x + frame.w, want.x + want.w), y1 = Math.max(frame.y + frame.h, want.y + want.h)
  const grow = { l: frame.x - x0, t: frame.y - y0, r: x1 - frame.x - frame.w, b: y1 - frame.y - frame.h }
  patchObjects(parts, { [frame.id]: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } })
  makeRoom(parts, frame, grow, root.id)
}

/** Push everything beside `old` outwards by what it grew on each side. */
function makeRoom(parts: BoardParts, old: Rect, grow: { l: number; t: number; r: number; b: number }, treeRoot: string) {
  const objs = allObjects(parts)
  const minds = mindNodes(parts)
  const own = new Set(subtreeIds(minds, treeRoot))
  const band = { x: old.x - grow.l, y: old.y - grow.t, w: old.w + grow.l + grow.r, h: old.h + grow.t + grow.b }
  const delta = (r: Rect): { dx: number; dy: number } => {
    const v = r.y < band.y + band.h && r.y + r.h > band.y
    const h = r.x < band.x + band.w && r.x + r.w > band.x
    let dx = 0, dy = 0
    if (grow.r > 0 && v && r.x >= old.x + old.w - 1) dx = grow.r
    else if (grow.l > 0 && v && r.x + r.w <= old.x + 1) dx = -grow.l
    if (grow.b > 0 && h && r.y >= old.y + old.h - 1) dy = grow.b
    else if (grow.t > 0 && h && r.y + r.h <= old.y + 1) dy = -grow.t
    return { dx, dy }
  }
  const patches: Record<string, Partial<BoardObject>> = {}
  const done = new Set<string>(own)
  const shift = (o: BoardObject, d: { dx: number; dy: number }) => {
    if (done.has(o.id)) return
    done.add(o.id)
    if (d.dx || d.dy) patches[o.id] = { x: o.x + d.dx, y: o.y + d.dy }
  }
  // Frames first, carrying what's inside them; then whole trees; then the rest.
  for (const f of objs.filter((o) => o.kind === 'frame')) {
    // The grown frame itself (it now contains its old self), or a frame inside it, stays put.
    if (contains(f, old) || contains(old, f)) continue
    const d = delta({ x: f.x, y: f.y - 22, w: f.w, h: f.h + 22 })
    if (!d.dx && !d.dy) continue
    shift(f, d)
    for (const o of objs) if (o.kind !== 'frame' && o.kind !== 'connector' && contains(f, o) && !own.has(o.id)) shift(o, d)
  }
  for (const r of objs.filter((o): o is MindObj => o.kind === 'mind' && o.parent === null && !own.has(o.id))) {
    const ids = subtreeIds(minds, r.id)
    const box = union(ids.map((id) => minds.get(id)!).map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h })))
    if (!box) continue
    const d = delta(box)
    for (const id of ids) shift(minds.get(id)!, d)
  }
  for (const o of objs) {
    if (o.kind === 'connector' || o.kind === 'frame' || done.has(o.id) || contains(old, o)) continue
    shift(o, delta(o))
  }
  if (Object.keys(patches).length) patchObjects(parts, patches)
  parts.strokes.forEach((st) => {
    if (parts.erased.has(st.id)) return
    const m = parts.moved.get(st.id) ?? { dx: 0, dy: 0 }
    const r = strokeRect(st, m.dx, m.dy)
    if (contains(old, r)) return
    const d = delta(r)
    if (d.dx || d.dy) parts.moved.set(st.id, { dx: m.dx + d.dx, dy: m.dy + d.dy })
  })
}

export function newMindRoot(parts: BoardParts, at: Pt, text: string, color: string, extra: Partial<MindObj> = {}): string {
  const id = newId()
  const s = mindSize({ text, source: extra.source, hint: extra.hint }, 0)
  const node: MindObj = {
    id, kind: 'mind', x: at.x - s.w / 2, y: at.y - s.h / 2, w: s.w, h: s.h,
    z: maxZ(allObjects(parts)) + 1, text, parent: null, side: null, order: 0, color, ...extra,
  }
  addObjects(parts, [node])
  return id
}

/** Add a child under `parentId` (after `afterId` among its siblings, if given) and re-lay the tree. */
export function addMindChild(parts: BoardParts, parentId: string, text = '', extra: Partial<MindObj> = {}, afterId?: string): string | null {
  const nodes = mindNodes(parts)
  const parent = nodes.get(parentId)
  if (!parent) return null
  const siblings = childrenOf(nodes, parentId)
  let order = (siblings[siblings.length - 1]?.order ?? 0) + 1
  if (afterId) {
    const i = siblings.findIndex((s) => s.id === afterId)
    if (i >= 0) order = siblings[i + 1] ? (siblings[i]!.order + siblings[i + 1]!.order) / 2 : siblings[i]!.order + 1
  }
  const side = parent.parent === null ? balancedSide(nodes, parentId) : parent.side
  const id = newId()
  const node: MindObj = {
    id, kind: 'mind', x: parent.x, y: parent.y, w: 40, h: 30, z: maxZ(allObjects(parts)) + 1,
    text, parent: parentId, side, order, color: parent.color, ...extra,
  }
  change(parts, () => {
    addObjects(parts, [node])
    relayout(parts, id)
  })
  return id
}

/** A sibling after `id`; under the root, a sibling is just another branch. */
export function addMindSibling(parts: BoardParts, id: string, text = ''): string | null {
  const node = mindNodes(parts).get(id)
  if (!node) return null
  if (node.parent === null) return addMindChild(parts, id, text)
  return addMindChild(parts, node.parent, text, { side: node.side }, id)
}

/** Every node under these ids, and the ids themselves, for deleting a branch whole. */
export function withSubtrees(parts: BoardParts, ids: Iterable<string>): Set<string> {
  const nodes = mindNodes(parts)
  const out = new Set<string>()
  for (const id of ids) {
    if (nodes.has(id)) for (const s of subtreeIds(nodes, id)) out.add(s)
    else out.add(id)
  }
  return out
}

/** Connectors stuck to any of these objects, which go when they go. */
export function attachedConnectors(parts: BoardParts, ids: Set<string>): string[] {
  const out: string[] = []
  parts.objects.forEach((m, id) => {
    if (m.get('kind') !== 'connector') return
    const from = m.get('from') as { id?: string }, to = m.get('to') as { id?: string }
    if ((from.id && ids.has(from.id)) || (to.id && ids.has(to.id))) out.push(id)
  })
  return out
}

// ---- merging a generated map ----------------------------------------------

export interface MapNode {
  text: string
  source?: string
  hint?: string
  children?: MapNode[]
}

export interface MapPlan {
  root: MapNode
  /** "Mapped Lectures 1–7" */
  title: string
  /** "14 ideas from 7 lectures and 9 cards. Each one names its lecture or slide." */
  summary: string
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Merge a map into the board: into `intoRoot` if given (matching branches by
 * their text, so running it twice adds nothing twice), else as a new tree at
 * `at`. Returns the root and how many nodes were added.
 */
export function applyMap(parts: BoardParts, plan: MapPlan, opts: { intoRoot?: string | null; at: Pt; color: string }): { rootId: string; added: number } {
  let added = 0
  let rootId = ''
  change(parts, () => {
    rootId = opts.intoRoot && mindNodes(parts).has(opts.intoRoot)
      ? opts.intoRoot
      : (added++, newMindRoot(parts, opts.at, plan.root.text, opts.color, { source: plan.root.source, hint: plan.root.hint }))
    const merge = (parentId: string, kids: MapNode[] | undefined) => {
      for (const k of kids ?? []) {
        const nodes = mindNodes(parts)
        const existing = childrenOf(nodes, parentId).find((c) => same(c.text, k.text))
        let id: string | null
        if (existing) {
          id = existing.id
          const patch: Partial<MindObj> = {}
          if (!existing.source && k.source) patch.source = k.source
          if (!existing.hint && k.hint) patch.hint = k.hint
          if (Object.keys(patch).length) patchObjects(parts, { [id]: patch })
        } else {
          id = addMindChild(parts, parentId, k.text, { source: k.source, hint: k.hint })
          added++
        }
        if (id) merge(id, k.children)
      }
    }
    merge(rootId, plan.root.children)
    relayout(parts, rootId)
  })
  return { rootId, added }
}

/**
 * A board as one line of plain text, for `items.preview` (lists and search):
 * its mind maps' roots and branches first, then frame titles and notes.
 */
export function boardPreview(parts: BoardParts, max = 220): string {
  const objs = allObjects(parts)
  const minds = mindNodes(parts)
  const parts_: string[] = []
  for (const r of objs.filter((o): o is MindObj => o.kind === 'mind' && o.parent === null)) {
    const kids = childrenOf(minds, r.id).map((k) => k.text).filter(Boolean)
    parts_.push(kids.length ? `${r.text}: ${kids.join(', ')}` : r.text)
  }
  for (const o of objs) {
    if (o.kind === 'frame') parts_.push(o.title)
    else if ((o.kind === 'sticky' || o.kind === 'shape' || o.kind === 'text') && o.text) parts_.push(o.text)
  }
  const text = parts_.filter(Boolean).join(' · ').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

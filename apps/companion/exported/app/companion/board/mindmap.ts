/**
 * Mind-map layout: a root in the middle, first-level branches split left and
 * right so neither side towers over the other, every subtree stacked so
 * siblings never overlap. The shape of Mind Elixir's and Plait's default
 * layout (both MIT), rewritten small: we need the one layout, not their
 * engines.
 *
 * Positions are written into the model, so everyone on the board sees the
 * same tree and the renderer draws it like any other object. Only the root's
 * position is the person's; the rest follows from it.
 */
import type { MindObj } from './model'
import { mindSize } from './draw'

const GAP_X = [64, 44, 36]
const GAP_Y = 14

export function childrenOf(nodes: Map<string, MindObj>, id: string): MindObj[] {
  const out: MindObj[] = []
  for (const n of nodes.values()) if (n.parent === id) out.push(n)
  return out.sort((a, b) => a.order - b.order)
}

export function rootOf(nodes: Map<string, MindObj>, id: string): MindObj | undefined {
  let n = nodes.get(id)
  const seen = new Set<string>()
  while (n?.parent && !seen.has(n.id)) {
    seen.add(n.id)
    n = nodes.get(n.parent)
  }
  return n
}

export function depthOf(nodes: Map<string, MindObj>, id: string): number {
  let d = 0
  let n = nodes.get(id)
  while (n?.parent && d < 64) {
    n = nodes.get(n.parent)
    d++
  }
  return d
}

export function subtreeIds(nodes: Map<string, MindObj>, id: string): string[] {
  const out = [id]
  for (let i = 0; i < out.length; i++) for (const c of childrenOf(nodes, out[i]!)) out.push(c.id)
  return out
}

function leafCount(nodes: Map<string, MindObj>, id: string): number {
  const kids = childrenOf(nodes, id)
  return kids.length ? kids.reduce((n, k) => n + leafCount(nodes, k.id), 0) : 1
}

/** The side a new first-level branch should hang on: the lighter one, right on a tie. */
export function balancedSide(nodes: Map<string, MindObj>, rootId: string): 'l' | 'r' {
  let l = 0, r = 0
  for (const c of childrenOf(nodes, rootId)) {
    if (c.side === 'l') l += leafCount(nodes, c.id)
    else r += leafCount(nodes, c.id)
  }
  return l < r ? 'l' : 'r'
}

/** Each node's size for its text, keyed by id, at its depth in the tree. */
export function measureTree(nodes: Map<string, MindObj>, rootId: string): Record<string, { w: number; h: number }> {
  const out: Record<string, { w: number; h: number }> = {}
  const walk = (id: string, depth: number) => {
    const n = nodes.get(id)
    if (!n) return
    const s = mindSize(n, depth)
    out[id] = { w: s.w, h: s.h }
    for (const c of childrenOf(nodes, id)) walk(c.id, depth + 1)
  }
  walk(rootId, 0)
  return out
}

/**
 * Where every node of a tree goes, given its root's position. Returns
 * `{ x, y, w, h, side }` for the root and each descendant.
 */
export function layoutTree(nodes: Map<string, MindObj>, rootId: string): Record<string, { x: number; y: number; w: number; h: number; side: 'l' | 'r' | null }> {
  const root = nodes.get(rootId)
  if (!root) return {}
  const size = measureTree(nodes, rootId)
  const out: Record<string, { x: number; y: number; w: number; h: number; side: 'l' | 'r' | null }> = {}
  const heights = new Map<string, number>()

  const height = (id: string): number => {
    const kids = childrenOf(nodes, id)
    const own = size[id]?.h ?? 30
    const sum = kids.reduce((s, k) => s + height(k.id), 0) + Math.max(0, kids.length - 1) * GAP_Y
    const h = Math.max(own, sum)
    heights.set(id, h)
    return h
  }

  // Keep the root centred where it was, at its new size.
  const rs = size[rootId]!
  const cx = root.x + root.w / 2, cy = root.y + root.h / 2
  out[rootId] = { x: cx - rs.w / 2, y: cy - rs.h / 2, w: rs.w, h: rs.h, side: null }

  const place = (id: string, side: 'l' | 'r', parentBox: { x: number; w: number }, centreY: number, depth: number) => {
    const s = size[id]!
    const gap = GAP_X[Math.min(depth - 1, GAP_X.length - 1)]!
    const x = side === 'r' ? parentBox.x + parentBox.w + gap : parentBox.x - gap - s.w
    out[id] = { x, y: centreY - s.h / 2, w: s.w, h: s.h, side }
    const kids = childrenOf(nodes, id)
    const total = kids.reduce((t, k) => t + heights.get(k.id)!, 0) + Math.max(0, kids.length - 1) * GAP_Y
    let y = centreY - total / 2
    for (const k of kids) {
      const h = heights.get(k.id)!
      place(k.id, side, { x, w: s.w }, y + h / 2, depth + 1)
      y += h + GAP_Y
    }
  }

  for (const side of ['r', 'l'] as const) {
    const kids = childrenOf(nodes, rootId).filter((k) => (k.side ?? 'r') === side)
    const total = kids.reduce((t, k) => t + height(k.id), 0) + Math.max(0, kids.length - 1) * GAP_Y
    let y = cy - total / 2
    for (const k of kids) {
      const h = heights.get(k.id)!
      place(k.id, side, out[rootId]!, y + h / 2, 1)
      y += h + GAP_Y
    }
  }
  return out
}

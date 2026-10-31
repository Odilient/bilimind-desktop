/**
 * Who else is on a board, and where their pointer is.
 *
 * This is the seam the live transport plugs into. Hocuspocus
 * will carry a Yjs awareness state per person, `{ user: { name, color },
 * cursor: { x, y } | null }` in board coordinates, and an implementation of
 * `BoardPresence` over it replaces `createDemoPresence` without the board
 * changing. Until then a board is either alone (`createLocalPresence`) or, in
 * demo mode, shared with two classmates who drift around the content.
 */
import { shallowRef, type Ref } from 'vue'
import type { Pt, Rect } from './geometry'
import { PEER_COLORS } from './palette'

export interface PeerIdentity {
  id: string
  name: string
  color: string
}

export interface Peer extends PeerIdentity {
  /** In board coordinates; `null` when their pointer is off the board. */
  cursor: Pt | null
  /** Epoch ms of their last movement. */
  at: number
}

export interface BoardPresence {
  readonly self: PeerIdentity
  readonly peers: Readonly<Ref<Peer[]>>
  /** Report this person's pointer, in board coordinates, or `null` when it leaves. */
  move(p: Pt | null): void
  destroy(): void
}

export function createLocalPresence(self: PeerIdentity): BoardPresence {
  return {
    self,
    peers: shallowRef<Peer[]>([]),
    move() {},
    destroy() {},
  }
}

/**
 * Two classmates from the mockup, Aziz and Javohir, reading the board: each
 * glides to a spot on the content, lingers, and moves on. Slow on purpose,
 * the pace of someone reading, not a screensaver.
 */
export function createDemoPresence(self: PeerIdentity, area: () => Rect | null): BoardPresence {
  const peers = shallowRef<Peer[]>([])
  const people = [
    { id: 'demo-aziz', name: 'Aziz', color: PEER_COLORS[0]! },
    { id: 'demo-javohir', name: 'Javohir', color: PEER_COLORS[1]! },
  ]
  const walk = people.map((p, i) => ({ ...p, pos: null as Pt | null, to: null as Pt | null, wait: 600 + i * 900 }))

  const pick = (): Pt | null => {
    const a = area()
    if (!a) return null
    return { x: a.x + a.w * (0.1 + Math.random() * 0.8), y: a.y + a.h * (0.1 + Math.random() * 0.8) }
  }

  const STEP_MS = 50
  // Board units per second; a slow, reading pace.
  const SPEED = 90
  const timer = import.meta.client
    ? setInterval(() => {
      const now = Date.now()
      for (const w of walk) {
        if (!w.pos) {
          w.pos = pick()
          continue
        }
        if (w.wait > 0) {
          w.wait -= STEP_MS
          continue
        }
        if (!w.to) w.to = pick()
        if (!w.to) continue
        const dx = w.to.x - w.pos.x, dy = w.to.y - w.pos.y
        const d = Math.hypot(dx, dy)
        const step = (SPEED * STEP_MS) / 1000
        if (d <= step) {
          w.pos = w.to
          w.to = null
          w.wait = 1500 + Math.random() * 3000
        } else {
          // Ease in and out of each glide so it reads as a hand, not a tween.
          const k = Math.min(1, step / d) * (0.6 + 0.4 * Math.min(1, d / 120))
          w.pos = { x: w.pos.x + dx * k, y: w.pos.y + dy * k }
        }
      }
      peers.value = walk.filter((w) => w.pos).map((w) => ({ id: w.id, name: w.name, color: w.color, cursor: w.pos, at: now }))
    }, STEP_MS)
    : null

  return {
    self,
    peers,
    move() {},
    destroy() {
      if (timer) clearInterval(timer)
    },
  }
}

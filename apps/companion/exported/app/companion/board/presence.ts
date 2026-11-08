/**
 * Who else is on a board, and where their pointer is.
 *
 * This is the seam the live transport plugs into. Hocuspocus
 * will carry a Yjs awareness state per person, `{ user: { name, color },
 * cursor: { x, y } | null }` in board coordinates, and an implementation of
 * `BoardPresence` over it replaces `createLocalPresence` without the board
 * changing. Until then a board is alone.
 */
import { shallowRef, type Ref } from 'vue'
import type { Pt } from './geometry'

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

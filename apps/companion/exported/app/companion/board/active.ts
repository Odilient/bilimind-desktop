/**
 * The whiteboard open right now, if any, so something outside it (an assistant's
 * drawing) can be placed on it. The canvas registers itself while it is mounted.
 */
import { shallowRef } from 'vue'

export interface OpenBoard {
  place: (src: string, natural: { w: number; h: number }) => void
}

export const openBoard = shallowRef<OpenBoard | null>(null)

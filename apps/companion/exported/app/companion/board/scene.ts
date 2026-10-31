/**
 * What the board asks of a render engine, and nothing more.
 *
 * The board owns its model, hit testing and interaction; an engine only
 * keeps a tree of drawn nodes in step with it and paints. Leafer is the
 * engine (research/vue-stack.md §4). Konva implements the same interface in
 * the spike, so the choice between them is a one-line swap backed by numbers
 * from `/app/dev/board-spike`.
 */
import type { Camera } from './geometry'
import type { Prim } from './draw'

/** Bottom to top. Ink sits over objects, the way a pen marks a printed page. */
export const LAYERS = ['frames', 'links', 'objects', 'ink'] as const
export type LayerName = (typeof LAYERS)[number]

export interface Scene {
  readonly engine: 'leafer' | 'konva'
  setCamera(c: Camera): void
  /** Create or redraw a node from primitives, at a world position and stacking order. */
  put(layer: LayerName, id: string, x: number, y: number, z: number, prims: Prim[]): void
  /** Move an existing node without redrawing it: the cheap path for drags. */
  move(layer: LayerName, id: string, x: number, y: number): void
  drop(layer: LayerName, id: string): void
  has(layer: LayerName, id: string): boolean
  /** Hide or show a node without dropping it (the text editor covers its object). */
  hide(layer: LayerName, id: string, hidden: boolean): void
  resize(w: number, h: number): void
  destroy(): void
}

export async function createScene(engine: 'leafer' | 'konva', view: HTMLElement, size: { w: number; h: number }): Promise<Scene> {
  const mod = engine === 'konva' ? await import('./scene-konva') : await import('./scene-leafer')
  return mod.default(view, size)
}

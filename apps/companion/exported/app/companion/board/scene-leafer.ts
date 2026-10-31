/**
 * The board drawn by Leafer UI (MIT; leafer-ui only, no plugins).
 *
 * One Leafer, one `world` group carrying the camera, four layer groups in
 * it. Leafer culls by bounds and repaints only dirty regions, which is why
 * it was picked over Konva (research/vue-stack.md §4); the spike measures it.
 * Hit testing is switched off (`hittable: false`): the board does its own,
 * against the model, so Leafer never builds a hit canvas.
 */
import { Ellipse, Group, Image, Leafer, Path, Rect, Text } from 'leafer-ui'
import type { IUI } from 'leafer-ui'
import type { Prim } from './draw'
import type { Camera } from './geometry'
import { LAYERS, type LayerName, type Scene } from './scene'

function node(p: Prim): IUI {
  switch (p.t) {
    case 'rect':
      return new Rect({
        x: p.x, y: p.y, width: p.w, height: p.h, cornerRadius: p.r, fill: p.fill, stroke: p.stroke,
        strokeWidth: p.sw, strokeAlign: 'center', dashPattern: p.dash, opacity: p.opacity,
      })
    case 'ellipse':
      return new Ellipse({ x: p.x, y: p.y, width: p.w, height: p.h, fill: p.fill, stroke: p.stroke, strokeWidth: p.sw, strokeAlign: 'center' })
    case 'path':
      return new Path({
        path: p.d, fill: p.fill, stroke: p.stroke, strokeWidth: p.sw, opacity: p.opacity,
        strokeCap: 'round', strokeJoin: 'round', strokeAlign: 'center',
      })
    case 'text':
      return new Text({
        x: p.x, y: p.y, text: p.lines.join('\n'), fontSize: p.size, lineHeight: { type: 'px', value: p.lh },
        fontWeight: p.weight as 400, fontFamily: p.family, fill: p.color, opacity: p.opacity,
        // Lines arrive pre-wrapped (geometry.wrapLines); a width is only set to centre them.
        ...(p.w ? { width: p.w, textAlign: p.align ?? 'left' } : {}),
      })
    case 'image':
      return new Image({ x: p.x, y: p.y, width: p.w, height: p.h, url: p.url, cornerRadius: p.r })
  }
}

export default async function createLeaferScene(view: HTMLElement, size: { w: number; h: number }): Promise<Scene> {
  const leafer = new Leafer({
    view,
    width: size.w,
    height: size.h,
    hittable: false,
    // The board handles every pointer and wheel event itself.
    move: { disabled: true },
    zoom: { disabled: true },
    wheel: { disabled: true } as never,
  })
  const world = new Group()
  leafer.add(world)
  const layers = {} as Record<LayerName, Group>
  for (const name of LAYERS) {
    layers[name] = new Group()
    world.add(layers[name])
  }
  const nodes: Record<LayerName, Map<string, Group>> = {
    frames: new Map(), links: new Map(), objects: new Map(), ink: new Map(),
  }

  return {
    engine: 'leafer',
    setCamera(c: Camera) {
      world.set({ x: c.x, y: c.y, scaleX: c.scale, scaleY: c.scale })
    },
    put(layer, id, x, y, z, prims) {
      let g = nodes[layer].get(id)
      if (g) {
        g.clear()
        g.set({ x, y, zIndex: z })
      } else {
        g = new Group({ x, y, zIndex: z })
        nodes[layer].set(id, g)
        layers[layer].add(g)
      }
      g.add(prims.map(node))
    },
    move(layer, id, x, y) {
      nodes[layer].get(id)?.set({ x, y })
    },
    drop(layer, id) {
      const g = nodes[layer].get(id)
      if (!g) return
      g.destroy()
      nodes[layer].delete(id)
    },
    has(layer, id) {
      return nodes[layer].has(id)
    },
    hide(layer, id, hidden) {
      const g = nodes[layer].get(id)
      if (g) g.visible = !hidden
    },
    resize(w, h) {
      leafer.resize({ width: w, height: h })
    },
    destroy() {
      leafer.destroy()
    },
  }
}

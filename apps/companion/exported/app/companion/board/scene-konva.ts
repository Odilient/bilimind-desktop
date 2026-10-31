/**
 * The same board drawn by Konva (MIT), for the spike's comparison only.
 *
 * Kept as plain Konva rather than tuned: no manual culling, no layer
 * caching, `listening: false` and `perfectDrawEnabled: false` because those
 * are what anyone building a board on Konva switches off first. If Leafer
 * ever has to be swapped out, this file is the starting point.
 */
import Konva from 'konva'
import type { Prim } from './draw'
import type { Camera } from './geometry'
import { LAYERS, type LayerName, type Scene } from './scene'

const images = new Map<string, HTMLImageElement>()

function node(p: Prim, redraw: () => void): Konva.Shape {
  const base = { listening: false, perfectDrawEnabled: false }
  switch (p.t) {
    case 'rect':
      return new Konva.Rect({
        ...base, x: p.x, y: p.y, width: p.w, height: p.h, cornerRadius: p.r, fill: p.fill, stroke: p.stroke,
        strokeWidth: p.sw, dash: p.dash, opacity: p.opacity ?? 1,
      })
    case 'ellipse':
      return new Konva.Ellipse({
        ...base, x: p.x + p.w / 2, y: p.y + p.h / 2, radiusX: p.w / 2, radiusY: p.h / 2, fill: p.fill, stroke: p.stroke, strokeWidth: p.sw,
      })
    case 'path':
      return new Konva.Path({
        ...base, data: p.d, fill: p.fill, stroke: p.stroke, strokeWidth: p.sw, opacity: p.opacity ?? 1, lineCap: 'round', lineJoin: 'round',
      })
    case 'text':
      return new Konva.Text({
        ...base, x: p.x, y: p.y, text: p.lines.join('\n'), fontSize: p.size, lineHeight: p.lh / p.size,
        fontStyle: String(p.weight), fontFamily: p.family, fill: p.color, opacity: p.opacity ?? 1,
        ...(p.w ? { width: p.w, align: p.align ?? 'left' } : {}),
      })
    case 'image': {
      let img = images.get(p.url)
      if (!img) {
        img = new window.Image()
        img.src = p.url
        img.onload = redraw
        images.set(p.url, img)
      }
      return new Konva.Image({ ...base, x: p.x, y: p.y, width: p.w, height: p.h, image: img, cornerRadius: p.r })
    }
  }
}

export default async function createKonvaScene(view: HTMLElement, size: { w: number; h: number }): Promise<Scene> {
  const stage = new Konva.Stage({ container: view as HTMLDivElement, width: size.w, height: size.h, listening: false })
  const layer = new Konva.Layer({ listening: false })
  stage.add(layer)
  const world = new Konva.Group()
  layer.add(world)
  const groups = {} as Record<LayerName, Konva.Group>
  for (const name of LAYERS) {
    groups[name] = new Konva.Group()
    world.add(groups[name])
  }
  const nodes: Record<LayerName, Map<string, Konva.Group>> = {
    frames: new Map(), links: new Map(), objects: new Map(), ink: new Map(),
  }
  const redraw = () => layer.batchDraw()

  return {
    engine: 'konva',
    setCamera(c: Camera) {
      world.setAttrs({ x: c.x, y: c.y, scaleX: c.scale, scaleY: c.scale })
      redraw()
    },
    put(name, id, x, y, z, prims) {
      let g = nodes[name].get(id)
      if (g) g.destroyChildren()
      else {
        g = new Konva.Group({ listening: false })
        nodes[name].set(id, g)
        groups[name].add(g)
      }
      g.setAttrs({ x, y })
      g.setAttr('z', z)
      for (const p of prims) g.add(node(p, redraw))
      // Konva has no zIndex attribute that sorts by value, so keep the order by
      // hand, and only when this node broke it (appends in order are the norm).
      const kids = groups[name].getChildren() as Konva.Node[]
      const zOf = (n: Konva.Node | undefined, none: number) => (n ? ((n.getAttr('z') as number | undefined) ?? 0) : none)
      const i = kids.indexOf(g)
      if (z < zOf(kids[i - 1], -Infinity) || z > zOf(kids[i + 1], Infinity)) {
        kids.slice().sort((a, b) => zOf(a, 0) - zOf(b, 0)).forEach((s, j) => s.zIndex(j))
      }
      redraw()
    },
    move(name, id, x, y) {
      nodes[name].get(id)?.setAttrs({ x, y })
      redraw()
    },
    drop(name, id) {
      nodes[name].get(id)?.destroy()
      nodes[name].delete(id)
      redraw()
    },
    has(name, id) {
      return nodes[name].has(id)
    },
    hide(name, id, hidden) {
      nodes[name].get(id)?.visible(!hidden)
      redraw()
    },
    resize(w, h) {
      stage.size({ width: w, height: h })
      redraw()
    },
    destroy() {
      stage.destroy()
    },
  }
}

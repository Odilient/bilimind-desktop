/**
 * A whiteboard as a picture (PNG) or a printable page (PDF): the whole
 * board, everything on it and a margin round it, whatever part is on screen.
 *
 * The board draws by handing a render engine a list of primitives per
 * object (`board/draw.ts`: rectangles, ellipses, paths, lines of text,
 * images); the engine only paints them. This paints the same primitives onto
 * a plain canvas, in the board's own order (frames, then links, then
 * objects, then ink, each by its stacking order), so the export looks like
 * the board without a second drawing of any object, and works for a board
 * that isn't open (a course's zip). Leafer, the live engine, can only
 * export through a plugin the app doesn't carry.
 *
 * Twice the board's size for a sharp picture, capped under what a browser
 * will allocate for one canvas (Safari stops at about 16 million pixels).
 * The PDF is one A4 page, turned to fit the board, with the picture as a
 * JPEG inside it (`formats.ts`).
 */
import { drawConnector, drawMindLink, drawObject, type DrawEnv, type Prim } from '../board/draw'
import { FRAME_TITLE_H, font, objectRect, strokeRect, union, type Rect } from '../board/geometry'
import { strokePath } from '../board/ink'
import { depthOf } from '../board/mindmap'
import { readObject, unpackPoints, type BoardObject, type MindObj } from '../board/model'
import { INK, PEN, withBoardTheme, type PenColor } from '../board/palette'
import { openBoard } from '../board/persistence'
import type { Item } from '../types'
import { useCompanionRepo } from '../use-repo'
import { blobOf, imagePdf } from './formats'

interface Drawn {
  /** 0 frames, 1 links, 2 objects, 3 ink: `board/scene.ts`'s LAYERS. */
  layer: number
  z: number
  x: number
  y: number
  prims: Prim[]
}

interface BoardPicture {
  drawn: Drawn[]
  bounds: Rect | null
}

/**
 * Everything on a board, as the board draws it. Opened the way the board
 * opens (this device's copy, then the server's, `openBoard`), read, closed.
 * A server that doesn't answer is waited for 10 s, then what's on the device
 * is what's drawn.
 */
async function readBoard(item: Item): Promise<BoardPicture> {
  const sync = openBoard(item.id, useCompanionRepo())
  try {
    await Promise.race([sync.ready, new Promise((resolve) => setTimeout(resolve, 10_000))])
    const objects = new Map<string, BoardObject>()
    sync.parts.objects.forEach((m, id) => objects.set(id, readObject(m)))
    const minds = new Map([...objects].filter(([, o]) => o.kind === 'mind')) as Map<string, MindObj>
    const env: DrawEnv = { resolve: (id) => objects.get(id), depth: (id) => depthOf(minds, id) }

    const drawn: Drawn[] = []
    const rects: Rect[] = []
    // An export is always the light board, whatever theme the app is in.
    withBoardTheme('light', () => {
      for (const o of objects.values()) {
        if (o.kind === 'connector') {
          drawn.push({ layer: 1, z: o.z, x: 0, y: 0, prims: drawConnector(o, env) })
          continue
        }
        drawn.push({ layer: o.kind === 'frame' ? 0 : 2, z: o.z, x: o.x, y: o.y, prims: drawObject(o, env) })
        // A frame's title sits above it (as `contentBounds` has it).
        rects.push(o.kind === 'frame' ? { x: o.x, y: o.y - FRAME_TITLE_H, w: o.w, h: o.h + FRAME_TITLE_H } : objectRect(o))
        const parent = o.kind === 'mind' && o.parent ? objects.get(o.parent) : undefined
        if (o.kind === 'mind' && parent?.kind === 'mind') drawn.push({ layer: 1, z: -1, x: 0, y: 0, prims: drawMindLink(o, parent) })
      }
      sync.parts.strokes.toArray().forEach((s, i) => {
        if (sync.parts.erased.has(s.id)) return
        const m = sync.parts.moved.get(s.id) ?? { dx: 0, dy: 0 }
        const ink: Prim = {
          t: 'path',
          d: strokePath(unpackPoints(s), { size: s.size, pen: s.pen }),
          fill: PEN[s.color as PenColor] ?? s.color,
        }
        drawn.push({ layer: 3, z: i, x: m.dx, y: m.dy, prims: [ink] })
        rects.push(strokeRect(s, m.dx, m.dy))
      })
    })
    // Stable, so objects at the same height keep the order they were added in, as Leafer keeps them.
    drawn.sort((a, b) => a.layer - b.layer || a.z - b.z)
    return { drawn, bounds: union(rects) }
  } finally {
    sync.destroy()
  }
}

/* -- Painting ------------------------------------------------------------------ */

/** Images go onto the canvas only if they can be read back: one that can't (no CORS) is left out, not fatal. */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    if (!url.startsWith('data:')) img.crossOrigin = 'anonymous'
    const timer = setTimeout(() => resolve(null), 15_000)
    img.onload = () => {
      clearTimeout(timer)
      resolve(img)
    }
    img.onerror = () => {
      clearTimeout(timer)
      resolve(null)
    }
    img.src = url
  })
}

function paintPrim(ctx: CanvasRenderingContext2D, p: Prim, images: Map<string, HTMLImageElement | null>): void {
  ctx.globalAlpha = 'opacity' in p && p.opacity != null ? p.opacity : 1
  const finish = (fill?: string, stroke?: string, sw?: number, path?: Path2D) => {
    if (fill) {
      ctx.fillStyle = fill
      if (path) ctx.fill(path)
      else ctx.fill()
    }
    if (stroke) {
      ctx.strokeStyle = stroke
      ctx.lineWidth = sw ?? 1
      if (path) ctx.stroke(path)
      else ctx.stroke()
    }
  }
  switch (p.t) {
    case 'rect':
      ctx.setLineDash(p.dash ?? [])
      ctx.beginPath()
      ctx.roundRect(p.x, p.y, p.w, p.h, p.r ?? 0)
      finish(p.fill, p.stroke, p.sw)
      ctx.setLineDash([])
      return
    case 'ellipse':
      ctx.beginPath()
      ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, Math.abs(p.w / 2), Math.abs(p.h / 2), 0, 0, Math.PI * 2)
      finish(p.fill, p.stroke, p.sw)
      return
    case 'path':
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      finish(p.fill, p.stroke, p.sw, new Path2D(p.d))
      return
    case 'text': {
      ctx.font = font(p.size, p.weight, p.family)
      ctx.fillStyle = p.color
      // Each line centred in its line box, as the engine sets text with a line height.
      ctx.textBaseline = 'middle'
      const centred = Boolean(p.w) && p.align === 'center'
      ctx.textAlign = centred ? 'center' : 'left'
      const x = centred ? p.x + p.w! / 2 : p.x
      p.lines.forEach((line, i) => ctx.fillText(line, x, p.y + p.lh * (i + 0.5)))
      return
    }
    case 'image': {
      const img = images.get(p.url)
      if (!img) return
      ctx.save()
      if (p.r) {
        ctx.beginPath()
        ctx.roundRect(p.x, p.y, p.w, p.h, p.r)
        ctx.clip()
      }
      ctx.drawImage(img, p.x, p.y, p.w, p.h)
      ctx.restore()
    }
  }
}

const PAD = 40

async function paint(board: BoardPicture, maxSide: number): Promise<HTMLCanvasElement> {
  const b = board.bounds ?? { x: 0, y: 0, w: 400, h: 300 }
  const box = { x: b.x - PAD, y: b.y - PAD, w: b.w + PAD * 2, h: b.h + PAD * 2 }
  const scale = Math.min(2, maxSide / Math.max(box.w, box.h), Math.sqrt(16_000_000 / (box.w * box.h)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.ceil(box.w * scale))
  canvas.height = Math.max(1, Math.ceil(box.h * scale))
  const ctx = canvas.getContext('2d')!

  const urls = new Set(board.drawn.flatMap((d) => d.prims.flatMap((p) => (p.t === 'image' ? [p.url] : []))))
  const images = new Map(await Promise.all([...urls].map(async (url) => [url, await loadImage(url)] as const)))
  // The board's fonts (Inter, Space Grotesk) are the page's; unloaded, the canvas falls back to Arial.
  await document.fonts?.ready

  ctx.fillStyle = INK.bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  for (const d of board.drawn) {
    ctx.setTransform(scale, 0, 0, scale, (d.x - box.x) * scale, (d.y - box.y) * scale)
    for (const p of d.prims) paintPrim(ctx, p, images)
  }
  return canvas
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The picture could not be made.'))), type, quality),
  )
}

export async function boardToPng(item: Item): Promise<Blob> {
  return canvasBlob(await paint(await readBoard(item), 8192), 'image/png')
}

/** 3,508 px on the long side is A4 at 300 dpi: as sharp as a printer goes. */
export async function boardToPdf(item: Item): Promise<Blob> {
  const canvas = await paint(await readBoard(item), 3508)
  const jpeg = new Uint8Array(await (await canvasBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer())
  return blobOf(imagePdf(jpeg, canvas.width, canvas.height), 'application/pdf')
}

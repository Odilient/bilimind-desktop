/**
 * The board spike: does a canvas engine hold 60 fps
 * with 2,000 pen strokes and 300 objects, in a WebView, on a base iPad and a
 * cheap Android phone?
 *
 * The scene is generated from a fixed seed through the board's own model and
 * `draw.ts`, so what is measured is what the board will actually paint, and
 * both engines get identical content. The run pans and zooms for 10 s along a
 * fixed path that spends about half its time zoomed out far enough to show
 * everything at once, the case culling can't help with.
 */
import type { BoardObject, ConnectorObj, Stroke } from './model'
import { packPoints, unpackPoints, type StrokePoint } from './model'
import { drawConnector, drawObject, stickyHeight, textHeight, type DrawEnv } from './draw'
import { strokeRect, union, type Camera, type Rect } from './geometry'
import { strokePath } from './ink'
import { PEN, type PenColor, type StickyColor } from './palette'
import type { Scene } from './scene'

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const WORDS = 'routing tables converge slowly when a link fails count to infinity split horizon poisoned reverse dijkstra link state flooding next hop metric bellman ford distance vector convergence neighbours hello packets'.split(' ')

export interface SpikeScene {
  objects: BoardObject[]
  strokes: Stroke[]
  bounds: Rect
}

export function generateScene(strokeCount = 2000, objectCount = 300, seed = 7): SpikeScene {
  const r = rng(seed)
  const W = 9000, H = 6000
  const words = (n: number) => Array.from({ length: n }, () => WORDS[Math.floor(r() * WORDS.length)]).join(' ')
  const objects: BoardObject[] = []
  const nConn = Math.round(objectCount / 6)
  const nText = Math.round(objectCount * 0.13)
  const nShape = Math.round(objectCount * 0.3)
  const nSticky = objectCount - nConn - nText - nShape
  const colors: StickyColor[] = ['yellow', 'pink', 'blue', 'green', 'violet', 'orange']
  let z = 1
  for (let i = 0; i < nSticky; i++) {
    const o = { id: `s${i}`, kind: 'sticky' as const, x: r() * W, y: r() * H, w: 160, h: 0, z: z++, text: words(4 + Math.floor(r() * 10)), color: colors[i % colors.length]!, by: r() > 0.5 ? 'Aziz' : undefined }
    o.h = stickyHeight(o)
    objects.push(o)
  }
  const shapes = ['rect', 'ellipse', 'diamond'] as const
  for (let i = 0; i < nShape; i++) {
    const shape = shapes[i % 3]!
    const o = { id: `h${i}`, kind: 'shape' as const, shape, x: r() * W, y: r() * H, w: 140 + r() * 60, h: 90 + r() * 40, z: z++, text: words(2 + Math.floor(r() * 3)), fill: 'white' as const, stroke: 'ink' as const }
    objects.push(o)
  }
  for (let i = 0; i < nText; i++) {
    const o = { id: `t${i}`, kind: 'text' as const, x: r() * W, y: r() * H, w: 260, h: 0, z: z++, text: words(3 + Math.floor(r() * 8)), size: 16 + Math.floor(r() * 3) * 6 }
    o.h = textHeight(o)
    objects.push(o)
  }
  // Connect each object to a near neighbour, the way real maps are wired.
  const linkable = objects.slice().sort((a, b) => a.x - b.x)
  for (let i = 0; i < nConn; i++) {
    const a = linkable[Math.floor(r() * (linkable.length - 1))]!
    const b = linkable[Math.min(linkable.length - 1, linkable.indexOf(a) + 1 + Math.floor(r() * 3))]!
    objects.push({ id: `c${i}`, kind: 'connector', x: 0, y: 0, w: 0, h: 0, z: z++, from: { id: a.id }, to: { id: b.id } } as ConnectorObj)
  }

  // Handwriting: lines of letter-sized squiggles in note-taking clusters,
  // sampled at 240 Hz the way a pen reports.
  const strokes: Stroke[] = []
  const inks: PenColor[] = ['ink', 'ink', 'ink', 'cobalt', 'coral']
  const clusters = Math.max(1, Math.round(strokeCount / 50))
  let made = 0
  let clock = Date.now() - 3600_000
  for (let c = 0; c < clusters && made < strokeCount; c++) {
    const ox = r() * (W - 900), oy = r() * (H - 500)
    const color = inks[c % inks.length]!
    for (let k = 0; k < 50 && made < strokeCount; k++, made++) {
      const line = Math.floor(k / 10), col = k % 10
      let x = ox + col * 72 + r() * 10, y = oy + line * 64 + r() * 8
      const n = 14 + Math.floor(r() * 46)
      const pts: StrokePoint[] = []
      let ang = r() * Math.PI * 2
      const t0 = clock
      for (let j = 0; j < n; j++) {
        ang += (r() - 0.5) * 1.1
        x += Math.cos(ang) * 2.4
        y += Math.sin(ang) * 2.4
        pts.push({ x, y, p: 0.35 + 0.45 * Math.sin((j / n) * Math.PI), t: t0 + j * 4.2 })
      }
      clock += n * 4.2 + 180
      strokes.push({ id: `k${made}`, by: null, color, size: 3.2, t0, pts: packPoints(pts, t0), pen: true })
    }
  }
  const rects = objects.filter((o) => o.kind !== 'connector').map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }))
  const bounds = union([...rects, ...strokes.map((s) => strokeRect(s))])!
  return { objects, strokes, bounds }
}

/** Put a generated scene into an engine, exactly as the board would. */
export function paintScene(scene: Scene, s: SpikeScene) {
  const byId = new Map(s.objects.map((o) => [o.id, o]))
  const env: DrawEnv = { resolve: (id) => byId.get(id), depth: () => 1 }
  for (const o of s.objects) {
    if (o.kind === 'connector') scene.put('links', o.id, 0, 0, o.z, drawConnector(o, env))
    else scene.put(o.kind === 'frame' ? 'frames' : 'objects', o.id, o.x, o.y, o.z, drawObject(o, env))
  }
  s.strokes.forEach((k, i) => {
    const pts = unpackPoints(k)
    scene.put('ink', k.id, 0, 0, i, [{ t: 'path', d: strokePath(pts, { size: k.size, pen: k.pen }), fill: PEN[k.color as PenColor] ?? PEN.ink }])
  })
}

export function fitCamera(b: Rect, vw: number, vh: number, pad = 40): Camera {
  const scale = Math.min((vw - pad * 2) / b.w, (vh - pad * 2) / b.h)
  return { scale, x: vw / 2 - (b.x + b.w / 2) * scale, y: vh / 2 - (b.y + b.h / 2) * scale }
}

/** Where the camera is `t` ms into the run: a Lissajous pan with a zoom that breathes between "everything" and 120%. */
export function cameraAt(t: number, b: Rect, vw: number, vh: number): Camera {
  const fit = fitCamera(b, vw, vh).scale
  const k = (1 - Math.cos((2 * Math.PI * t) / 5000)) / 2
  const scale = Math.exp(Math.log(fit) + (Math.log(1.2) - Math.log(fit)) * k)
  const cx = b.x + b.w * (0.5 + 0.38 * Math.sin((2 * Math.PI * t) / 7000))
  const cy = b.y + b.h * (0.5 + 0.38 * Math.sin((2 * Math.PI * t) / 4300))
  return { scale, x: vw / 2 - cx * scale, y: vh / 2 - cy * scale }
}

export interface BenchResult {
  engine: string
  strokes: number
  objects: number
  points: number
  buildMs: number
  frames: number
  fpsP50: number
  fpsP5: number
  worstFrameMs: number
  /** Share of frames slower than 1.5 × 16.7 ms: what a person sees as a stutter. */
  droppedPct: number
  longTasks: number | null
  longTaskMs: number | null
  heapMB: { before: number | null; built: number | null; after: number | null }
  dpr: number
  viewport: string
}

function heapMB(): number | null {
  const m = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
  return m ? Math.round((m.usedJSHeapSize / 1048576) * 10) / 10 : null
}

function pct(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]!
}

const nextFrame = () => new Promise<number>((res) => requestAnimationFrame(res))

export async function runBench(opts: {
  engine: string
  makeScene: () => Promise<Scene>
  data: SpikeScene
  vw: number
  vh: number
  durationMs?: number
  onFrame?: (cam: Camera) => void
}): Promise<{ result: BenchResult; scene: Scene }> {
  const duration = opts.durationMs ?? 10_000
  const before = heapMB()
  const t0 = performance.now()
  const scene = await opts.makeScene()
  paintScene(scene, opts.data)
  scene.setCamera(fitCamera(opts.data.bounds, opts.vw, opts.vh))
  await nextFrame()
  await nextFrame()
  const buildMs = Math.round(performance.now() - t0)
  const built = heapMB()

  let longTasks: number | null = null
  let longTaskMs: number | null = null
  let observer: PerformanceObserver | null = null
  if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
    longTasks = 0
    longTaskMs = 0
    observer = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        longTasks!++
        longTaskMs! += e.duration
      }
    })
    observer.observe({ type: 'longtask' })
  }

  const dts: number[] = []
  const start = await nextFrame()
  let last = start
  for (;;) {
    const now = await nextFrame()
    const t = now - start
    if (t >= duration) break
    dts.push(now - last)
    last = now
    const cam = cameraAt(t, opts.data.bounds, opts.vw, opts.vh)
    scene.setCamera(cam)
    opts.onFrame?.(cam)
  }
  observer?.disconnect()
  const sorted = dts.slice(2).sort((a, b) => a - b)
  const result: BenchResult = {
    engine: opts.engine,
    strokes: opts.data.strokes.length,
    objects: opts.data.objects.length,
    points: opts.data.strokes.reduce((n, s) => n + s.pts.length / 4, 0),
    buildMs,
    frames: sorted.length,
    fpsP50: Math.round(1000 / pct(sorted, 0.5)),
    fpsP5: Math.round(1000 / pct(sorted, 0.95)),
    worstFrameMs: Math.round(sorted[sorted.length - 1] ?? 0),
    droppedPct: Math.round((sorted.filter((d) => d > 25).length / Math.max(1, sorted.length)) * 1000) / 10,
    longTasks,
    longTaskMs: longTaskMs === null ? null : Math.round(longTaskMs),
    heapMB: { before, built, after: heapMB() },
    dpr: window.devicePixelRatio,
    viewport: `${opts.vw}×${opts.vh}`,
  }
  return { result, scene }
}

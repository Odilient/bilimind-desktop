<script setup lang="ts">
import { getStroke } from 'perfect-freehand'
import type { MarkupTool, Stroke, StrokePoint } from '~/types/api'
import {
  MARKER_OPACITY,
  REFERENCE_WIDTH,
  arrowPath,
  distanceToSegment,
  outlinePath,
  simplifyStroke,
  strokeSizeFor,
  type MarkupSize,
} from '~/utils/markup'

/**
 * MARKUP — the drawing surface over one box: a picture, or a whiteboard.
 *
 * An SVG, sized to the box and laid over it, whose viewBox is the box's
 * current size in px. Strokes are stored 0..1 of the box and multiplied out at
 * draw time, so the same stroke is drawn on a 320px phone and a 1200px board
 * and lands on the same part of the picture both times. There is no canvas
 * element: a vector is what the server stores and what "undo the last stroke"
 * needs, and a few hundred filled paths cost nothing.
 *
 * The one rule about input: this layer only takes the pointer while a drawing
 * tool is armed. The rest of the time it is `pointer-events: none` and the
 * picture underneath keeps its buttons, its long-press, its scroll. That is
 * also when `touch-action: none` comes off — a page that will not scroll under
 * a thumb because a pen *could* be picked up is a broken page.
 *
 * A pen and a hand arrive together on a tablet. While a `pen` pointer is down,
 * `touch` pointers are ignored outright; that is the whole of palm rejection,
 * and it is enough.
 */
const props = defineProps<{
  strokes: Stroke[]
  tool: MarkupTool | null
  color: string
  size: MarkupSize
  armed: boolean
  /** The box's rendered size, in px. The layer draws nothing until it is known. */
  box: { width: number; height: number }
}>()

const emit = defineEmits<{
  add: [stroke: Stroke]
  /** Index into `strokes` of the one the eraser touched. One per event. */
  erase: [index: number]
  /**
   * The eraser touched no stroke here, at this point on the screen. Over a
   * lesson's prose that is the reader rubbing out a highlight, which lives in
   * the text under this layer and is the parent's to find.
   */
  miss: [clientX: number, clientY: number]
}>()

const svg = ref<SVGSVGElement | null>(null)

/** Only these four take the pointer. A highlighter over a picture does nothing. */
const drawingTool = computed(() =>
  props.armed &&
  (props.tool === 'pen' ||
    props.tool === 'marker' ||
    props.tool === 'arrow' ||
    props.tool === 'eraser')
    ? props.tool
    : null,
)

const width = computed(() => Math.max(0, props.box.width))
const height = computed(() => Math.max(0, props.box.height))
const scale = computed(() => width.value / REFERENCE_WIDTH)

/* -- Rendering ------------------------------------------------------------- */

interface Rendered {
  d: string
  fill: string
  opacity: number
  marker: boolean
}

/**
 * Outlines are memoised per stroke object and per box size, because a live
 * stroke re-renders this template on every pointer move and the two hundred
 * strokes already on the picture must not be re-outlined each time.
 */
const cache = new WeakMap<Stroke, { width: number; height: number; rendered: Rendered }>()

function options(stroke: Pick<Stroke, 'tool' | 'size'>, live: boolean) {
  const size = stroke.size * scale.value
  return stroke.tool === 'marker'
    ? {
        size,
        thinning: 0,
        smoothing: 0.6,
        streamline: 0.4,
        simulatePressure: false,
        start: { cap: true, taper: 0 },
        end: { cap: true, taper: 0 },
        last: !live,
      }
    : {
        size,
        thinning: 0.6,
        smoothing: 0.5,
        streamline: 0.45,
        simulatePressure: false,
        start: { cap: true, taper: 0 },
        end: { cap: true, taper: 0 },
        last: !live,
      }
}

function toPixels(points: StrokePoint[]): number[][] {
  const w = width.value
  const h = height.value
  return points.map((point) =>
    point.length === 3 ? [point[0] * w, point[1] * h, point[2]] : [point[0] * w, point[1] * h, 0.5],
  )
}

function render(stroke: Stroke, live = false): Rendered {
  // An arrow is two points and a direction, so it is drawn rather than
  // outlined: perfect-freehand would taper it and put no head on the end.
  if (stroke.tool === 'arrow') {
    const points = toPixels(stroke.points)
    const first = points[0] ?? [0, 0]
    const last = points[points.length - 1] ?? first
    return {
      d: arrowPath(
        first[0] as number,
        first[1] as number,
        last[0] as number,
        last[1] as number,
        stroke.size * scale.value,
      ),
      fill: stroke.color,
      opacity: 1,
      marker: false,
    }
  }

  const outline = getStroke(toPixels(stroke.points), options(stroke, live))
  return {
    d: outlinePath(outline),
    fill: stroke.color,
    opacity: stroke.tool === 'marker' ? MARKER_OPACITY : 1,
    marker: stroke.tool === 'marker',
  }
}

function rendered(stroke: Stroke): Rendered {
  const hit = cache.get(stroke)
  if (hit && hit.width === width.value && hit.height === height.value) return hit.rendered

  const result = render(stroke)
  cache.set(stroke, { width: width.value, height: height.value, rendered: result })
  return result
}

/* -- The stroke being drawn ------------------------------------------------ */

const live = ref<Stroke | null>(null)
const livePath = computed(() => (live.value ? render(live.value, true) : null))

let activePointer: number | null = null
let activeType: string | null = null
let origin: DOMRect | null = null
let hasPressure = false
const erased = new Set<Stroke>()

function normalise(event: PointerEvent): StrokePoint | null {
  if (!origin || origin.width === 0 || origin.height === 0) return null

  const x = Math.min(1, Math.max(0, (event.clientX - origin.left) / origin.width))
  const y = Math.min(1, Math.max(0, (event.clientY - origin.top) / origin.height))

  // Real pressure only comes from a stylus; a mouse reports a flat 0.5 and a
  // finger reports 0 or 1, neither of which is a width anyone chose.
  if (event.pointerType === 'pen' && event.pressure > 0) {
    hasPressure = true
    return [x, y, event.pressure]
  }

  return [x, y]
}

function eraseAt(event: PointerEvent): void {
  if (!origin) return

  const px = event.clientX - origin.left
  const py = event.clientY - origin.top
  const w = width.value
  const h = height.value

  for (let index = 0; index < props.strokes.length; index += 1) {
    const stroke = props.strokes[index] as Stroke
    if (erased.has(stroke)) continue

    const threshold = Math.max(10, (stroke.size * scale.value) / 2 + 6)
    const points = stroke.points
    let hit = false

    if (points.length === 1) {
      const only = points[0] as StrokePoint
      hit = Math.hypot(px - only[0] * w, py - only[1] * h) < threshold
    } else {
      for (let i = 1; i < points.length; i += 1) {
        const a = points[i - 1] as StrokePoint
        const b = points[i] as StrokePoint
        if (distanceToSegment(px, py, a[0] * w, a[1] * h, b[0] * w, b[1] * h) < threshold) {
          hit = true
          break
        }
      }
    }

    if (hit) {
      erased.add(stroke)
      emit('erase', index)
      return
    }
  }

  emit('miss', event.clientX, event.clientY)
}

function onPointerDown(event: PointerEvent): void {
  const tool = drawingTool.value
  if (!tool || !svg.value) return
  if (event.button !== 0 && event.pointerType === 'mouse') return

  // A hand resting on the glass while a stylus is down.
  if (event.pointerType === 'touch' && activeType === 'pen') return

  // A stylus arriving mid-finger-stroke wins; the finger's stroke is dropped.
  if (event.pointerType === 'pen' && activePointer !== null && activeType === 'touch') {
    live.value = null
    activePointer = null
  }

  if (activePointer !== null) return

  event.preventDefault()
  activePointer = event.pointerId
  activeType = event.pointerType
  origin = svg.value.getBoundingClientRect()
  hasPressure = false
  erased.clear()

  try {
    svg.value.setPointerCapture(event.pointerId)
  } catch {
    // Capture is a nicety; the move/up handlers cope without it.
  }

  if (tool === 'eraser') {
    eraseAt(event)
    return
  }

  const first = normalise(event)
  if (!first) return

  live.value = {
    tool,
    color: props.color,
    size: strokeSizeFor(tool, props.size),
    points: [first],
  }
}

function onPointerMove(event: PointerEvent): void {
  if (event.pointerId !== activePointer) return

  if (drawingTool.value === 'eraser') {
    eraseAt(event)
    return
  }

  const current = live.value
  if (!current) return

  if (current.tool === 'arrow') {
    const point = normalise(event)
    if (point) live.value = { ...current, points: [current.points[0] as StrokePoint, point] }
    return
  }

  // Coalesced events carry every sample the hardware took between frames; a
  // stylus at 240Hz on a 60Hz screen is four points per move without them.
  const samples =
    typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [event]
  const points = current.points.slice()

  for (const sample of samples.length > 0 ? samples : [event]) {
    const point = normalise(sample)
    if (point) points.push(point)
  }

  live.value = { ...current, points }
}

function finish(event: PointerEvent): void {
  if (event.pointerId !== activePointer) return

  try {
    svg.value?.releasePointerCapture(event.pointerId)
  } catch {
    // Already released.
  }

  const current = live.value
  activePointer = null
  activeType = null
  origin = null
  live.value = null
  erased.clear()

  if (!current) return

  const points = simplifyStroke(hasPressure ? current.points : current.points.map(flat))
  if (points.length === 0) return

  // A tap is a dot: perfect-freehand needs two points to have a direction.
  if (points.length === 1) {
    const only = points[0] as StrokePoint
    points.push(
      only.length === 3
        ? [only[0] + 0.0001, only[1], only[2]]
        : [only[0] + 0.0001, only[1]],
    )
  }

  emit('add', { ...current, points })
}

function flat(point: StrokePoint): StrokePoint {
  return [point[0], point[1]]
}

function onPointerCancel(event: PointerEvent): void {
  if (event.pointerId !== activePointer) return
  activePointer = null
  activeType = null
  origin = null
  live.value = null
  erased.clear()
}

/* Putting the tool down mid-stroke keeps what was drawn so far. */
watch(drawingTool, (tool) => {
  if (tool === null && live.value && activePointer !== null) {
    const current = live.value
    activePointer = null
    activeType = null
    origin = null
    live.value = null
    const points = simplifyStroke(current.points)
    if (points.length >= 2) emit('add', { ...current, points })
  }
})

const cursor = computed(() => {
  switch (drawingTool.value) {
    case 'eraser':
      return 'cell'
    case 'pen':
    case 'marker':
    case 'arrow':
      return 'crosshair'
    default:
      return undefined
  }
})

/** Nothing to draw and nothing to draw with: no element at all. */
const visible = computed(() => props.strokes.length > 0 || drawingTool.value !== null)
</script>

<template>
  <svg
    v-if="visible && width > 0 && height > 0"
    ref="svg"
    :viewBox="`0 0 ${width} ${height}`"
    :width="width"
    :height="height"
    class="ink-layer block select-none"
    :class="drawingTool ? 'pointer-events-auto' : 'pointer-events-none'"
    :style="{
      touchAction: drawingTool ? 'none' : undefined,
      cursor,
    }"
    aria-hidden="true"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="finish"
    @pointercancel="onPointerCancel"
    @lostpointercapture="onPointerCancel"
    @contextmenu.prevent
  >
    <path
      v-for="(stroke, index) in strokes"
      :key="index"
      :d="rendered(stroke).d"
      :fill="rendered(stroke).fill"
      :fill-opacity="rendered(stroke).opacity"
      :class="rendered(stroke).marker && 'mix-blend-multiply'"
    />
    <path
      v-if="livePath"
      :d="livePath.d"
      :fill="livePath.fill"
      :fill-opacity="livePath.opacity"
      :class="livePath.marker && 'mix-blend-multiply'"
    />
  </svg>
</template>

<style scoped>
.ink-layer {
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
</style>

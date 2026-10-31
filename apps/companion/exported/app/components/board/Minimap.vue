<script setup lang="ts">
/**
 * Bottom right: zoom, zoom-to-fit, and the minimap, as in the mockup. The
 * minimap is a plain 2D canvas redrawn when the board or the view changes,
 * never more than once a frame; a click or a drag on it moves the view.
 * Every control names itself on hover. A phone shows only the fit button:
 * there the map is the screen.
 */
import type { BoardController } from '~/companion/board/controller'

const props = defineProps<{
  ctl: BoardController
  phone: boolean
  fitPad: () => { top: number; right: number; bottom: number; left: number }
}>()

const W = 148
const H = 92
const cv = ref<HTMLCanvasElement>()
const zoom = computed(() => `${Math.round(props.ctl.ui.camera.scale * 100)}%`)
let raf = 0
let frame: { bounds: { x: number; y: number; w: number; h: number }; k: number; ox: number; oy: number } | null = null

function draw() {
  raf = 0
  const c = cv.value
  const data = props.ctl.overview()
  if (!c || !data) return
  const dpr = window.devicePixelRatio || 1
  if (c.width !== W * dpr) {
    c.width = W * dpr
    c.height = H * dpr
  }
  const g = c.getContext('2d')!
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, W, H)
  const pad = 6
  const k = Math.min((W - pad * 2) / data.bounds.w, (H - pad * 2) / data.bounds.h)
  const ox = pad + (W - pad * 2 - data.bounds.w * k) / 2 - data.bounds.x * k
  const oy = pad + (H - pad * 2 - data.bounds.h * k) / 2 - data.bounds.y * k
  frame = { bounds: data.bounds, k, ox, oy }
  for (const it of data.items) {
    const x = ox + it.r.x * k, y = oy + it.r.y * k, w = Math.max(1.5, it.r.w * k), h = Math.max(1.5, it.r.h * k)
    if (it.kind === 'frame') {
      g.fillStyle = '#eef0f4'
      g.fillRect(x, y, w, h)
    } else if (it.kind === 'stroke') {
      g.fillStyle = 'rgba(11,13,16,0.18)'
      g.fillRect(x, y, w, h)
    } else {
      g.fillStyle = it.color ?? '#d9dce3'
      g.fillRect(x, y, w, h)
    }
  }
  const v = data.view
  g.strokeStyle = '#2340e6'
  g.lineWidth = 1.5
  g.strokeRect(ox + v.x * k, oy + v.y * k, v.w * k, v.h * k)
}

watch(() => props.ctl.ui.version, () => {
  if (!raf && !props.phone) raf = requestAnimationFrame(draw)
})
onMounted(() => {
  if (!props.phone) draw()
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
watch(() => props.phone, (p) => {
  if (!p) nextTick(draw)
})

let dragging = false
function toBoard(e: PointerEvent) {
  if (!frame || !cv.value) return null
  const r = cv.value.getBoundingClientRect()
  return { x: (e.clientX - r.left - frame.ox) / frame.k, y: (e.clientY - r.top - frame.oy) / frame.k }
}
function onDown(e: PointerEvent) {
  dragging = true
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  const p = toBoard(e)
  if (p) props.ctl.centreOn(p, true)
}
function onMove(e: PointerEvent) {
  if (!dragging) return
  const p = toBoard(e)
  if (p) props.ctl.centreOn(p)
}
function onUp() {
  dragging = false
}
</script>

<template>
  <div
    class="bnav"
    :class="{ 'bnav--phone': phone }"
  >
    <div class="bzoom">
      <template v-if="!phone">
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          @click="ctl.zoomAround(1 / 1.25)"
        >
          <BoardIcon
            name="minus"
            :size="13"
          />
        </button>
        <span
          class="pct"
          title="Zoom"
        >{{ zoom }}</span>
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          @click="ctl.zoomAround(1.25)"
        >
          <BoardIcon
            name="plus"
            :size="13"
          />
        </button>
      </template>
      <button
        type="button"
        aria-label="Show all of the board"
        title="Show all of the board (Shift+1)"
        data-act="fit"
        @click="ctl.zoomToFit(true, fitPad())"
      >
        <BoardIcon
          name="fit"
          :size="14"
        />
        <span
          v-if="phone"
          class="fit-name"
        >Show all</span>
      </button>
    </div>
    <canvas
      v-if="!phone"
      ref="cv"
      class="bmini"
      :style="{ width: `${W}px`, height: `${H}px` }"
      aria-label="Map of the whole board"
      title="Click or drag to move around the board"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    />
  </div>
</template>

<style scoped>
.bnav { position: absolute; right: 14px; bottom: 14px; z-index: 6; display: flex; align-items: flex-end; gap: 8px; }
.bnav--phone { bottom: calc(74px + env(safe-area-inset-bottom)); right: 12px; }
.bzoom {
  display: flex; align-items: center; gap: 1px; padding: 3px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 9px;
}
.bzoom button { width: 30px; height: 30px; border-radius: 6px; display: grid; place-items: center; color: var(--text-soft); }
.bzoom button:hover { background: var(--surface-sunken); color: var(--text); }
.bnav--phone .bzoom button {
  width: auto; height: 42px; padding: 0 12px; display: inline-flex; gap: 6px;
  font-size: 13.5px; font-weight: 600; color: var(--text);
}
.pct { min-width: 44px; text-align: center; font-size: 12.5px; font-weight: 600; color: var(--text-soft); font-variant-numeric: tabular-nums; }
.bmini {
  display: block; background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
  cursor: pointer; touch-action: none;
}
</style>

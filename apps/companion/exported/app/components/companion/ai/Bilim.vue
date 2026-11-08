<script lang="ts">
export type BilimMood = 'idle' | 'think' | 'happy' | 'listen' | 'sleep'
export type BilimTone = 'yellow' | 'sky' | 'rose' | 'leaf' | 'lilac' | 'apricot'

/* The body: a symmetric ghost with a rounded corner each side of the bottom. The tail
   grows out of whichever corner trails the motion (index 5 right, 9 left). */
const BODY: [number, number][] = [
  [0, -44], [26, -38], [40, -16], [43, 10], [40, 32], [36, 41], [24, 44.5],
  [0, 45], [-24, 44.5], [-36, 41], [-40, 32], [-43, 10], [-40, -16], [-26, -38],
]
const TR = 5
const TL = 9
const TAIL_V = [14, 2] as const
const MAX_STRETCH = 0.4

// The mascot's own illustration colours (light top to deep bottom), not theme tokens.
const TONES: Record<BilimTone, [string, string, string]> = {
  yellow: ['#ffea94', '#ffdb5c', '#ffc93d'],
  sky: ['#cfe6ff', '#97c8ff', '#62a6f2'],
  rose: ['#ffd6e2', '#ffadc6', '#f185a8'],
  leaf: ['#d3f2cf', '#9fdfa3', '#64c27a'],
  lilac: ['#e6defe', '#c4b6ff', '#9d8af4'],
  apricot: ['#ffdcc2', '#ffbb8c', '#f8975c'],
}

/** A closed Catmull-Rom curve through the points, as cubic Béziers. */
function pathOf(p: [number, number][]): string {
  const n = p.length
  let d = `M${p[0]![0].toFixed(2)},${p[0]![1].toFixed(2)}`
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n]!
    const p1 = p[i]!
    const p2 = p[(i + 1) % n]!
    const p3 = p[(i + 2) % n]!
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`
  }
  return `${d}Z`
}

const REST = pathOf(BODY)

/* The resting mark, tail out to the right: the brand mark and anywhere Bili holds still. */
const BASE: [number, number][] = [
  [0, -44], [26, -38], [40, -16], [43, 10], [40, 32], [50, 43], [24, 44.5],
  [0, 45], [-24, 43.5], [-40, 32], [-43, 8], [-40, -16], [-26, -38],
]
const MARK = pathOf(BASE)

/* -- The pointer, shared by every Bili on the page --------------------------------- */

const ptr = { x: 0, y: 0 }
let watchingPointer = false
function watchPointer(): void {
  if (watchingPointer) return
  watchingPointer = true
  ptr.x = window.innerWidth / 2
  ptr.y = window.innerHeight / 3
  window.addEventListener(
    'pointermove',
    (e) => {
      ptr.x = e.clientX
      ptr.y = e.clientY
    },
    { passive: true },
  )
}
</script>

<script setup lang="ts">
/**
 * Bili, the assistant (Uzbek: knowledge): a soft highlighter-yellow ghost,
 * ported from docs/design/daylight2/js/bili.js so the app and the landing
 * draw the same one. It breathes, blinks, leans after the pointer (`follow`),
 * squashes and hops when poked, and can be dragged and let go (`drag`).
 *
 *   <CompanionAiBilim :size="22" />                       // an answer's avatar
 *   <CompanionAiBilim :size="26" :mood="busy ? 'think' : 'idle'" />
 *   <CompanionAiBilim :size="76" mood="happy" follow drag />
 *   ref.poke() · ref.jump()
 *
 * Moods: idle, think (eyes up and to the side, a lean), happy (smiling arcs,
 * cheeks), listen (eyes wide), sleep (closed, slow, a drifting z). Tones are
 * the six course colours. Purely decorative, so it is hidden from assistive
 * tech; the words beside it say what it is doing.
 *
 * `still` is the brand mark (the rail, the sidebar, the sign-in pages): see the prop.
 *
 * The server draws it at rest; the motion starts after mounting, pauses while
 * it is off screen, and never starts under reduced motion (one still frame,
 * which still changes with the mood).
 */
const props = withDefaults(
  defineProps<{
    size?: number
    mood?: BilimMood
    tone?: BilimTone
    /** Eyes and lean follow the pointer anywhere on the page. */
    follow?: boolean
    /** It can be picked up and dropped; it springs back. */
    drag?: boolean
    /**
     * The brand mark: the resting shape, no motion, no shadow, not pokeable, and
     * the box hugs the mark so `size` is its width (it reads at 22–40px). The
     * face still follows `mood`.
     */
    still?: boolean
  }>(),
  { size: 64, mood: 'idle', tone: 'yellow' },
)

const emit = defineEmits<{ poke: [] }>()

const gid = `bilim-${useId()}`
const stops = computed(() => TONES[props.tone] ?? TONES.yellow)

/** What it shows: the mood it was given, or happy for a moment after a poke. */
const shown = ref<BilimMood>(props.mood)
watch(
  () => props.mood,
  (m) => {
    shown.value = m
  },
)

const dragging = ref(false)

const svg = ref<SVGSVGElement | null>(null)
const bodyEl = ref<SVGPathElement | null>(null)
const liftEl = ref<SVGGElement | null>(null)
const faceEl = ref<SVGGElement | null>(null)
const sheenEl = ref<SVGEllipseElement | null>(null)
const shadowEl = ref<SVGEllipseElement | null>(null)
const eyeL = ref<SVGEllipseElement | null>(null)
const eyeR = ref<SVGEllipseElement | null>(null)
const arcL = ref<SVGPathElement | null>(null)
const arcR = ref<SVGPathElement | null>(null)

/* -- Springs -------------------------------------------------------------------------- */

interface Spring {
  x: number
  v: number
}
const spring = (s: Spring, target: number, k: number, d: number, dt: number): void => {
  s.v += (target - s.x) * k * dt
  s.v *= Math.exp(-d * dt)
  s.x += s.v * dt
}
const mk = (x = 0): Spring => ({ x, v: 0 })

const sq = mk() // squash (−) / stretch (+)
const lean = mk()
const lx = mk()
const ly = mk() // eye look
const dx = mk()
const dy = mk() // drag offset, css px
const stx = mk()
const sty = mk() // stretch along the motion (jelly)
const tail = mk(1) // 1 = out, 0 = tucked in while held
const side = mk(1)
let sideTo = 1

let last = 0
let t0 = 0
let nextBlink = 0
let blinkT = 0
let doubleBlink = false
let jumpT = -1
let jumpH = 1
let moved = false
let landing = false
let tx = 0
let ty = 0
let raf = 0
let visible = true
let reduce = false
let pokeT: ReturnType<typeof setTimeout> | undefined
let io: IntersectionObserver | null = null

function frame(now: number): void {
  const body = bodyEl.value
  if (!body || !svg.value) return
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016)
  last = now
  const t = now / 1000 + t0
  const mood = shown.value
  const follow = props.follow || props.drag

  let ex = 0
  let ey = 0
  let L0 = 0
  let cx = 0
  if (follow) {
    const r = svg.value.getBoundingClientRect()
    cx = r.left + r.width / 2
    const cy = r.top + r.height * 0.42
    const ddx = ptr.x - cx
    const ddy = ptr.y - cy
    const dist = Math.hypot(ddx, ddy) || 1
    const k = Math.min(1, dist / 260)
    ex = (ddx / dist) * 5.2 * k
    ey = (ddy / dist) * 4.2 * k
    L0 = Math.max(-1, Math.min(1, ddx / 700)) * 5
  }
  if (mood === 'think') {
    ex = 4.5 + Math.sin(t * 0.9) * 1.2
    ey = -4.5
    L0 = 2.5
  }
  if (mood === 'sleep') {
    ex = 0
    ey = 2
    L0 = 0
  }
  if (mood === 'listen') {
    ex *= 0.4
    ey = -1.5
  }

  if (props.drag) {
    const wasFar = Math.abs(dx.x) + Math.abs(dy.x) > 6
    spring(dx, tx, dragging.value ? 900 : 170, dragging.value ? 38 : 11, dt)
    spring(dy, ty, dragging.value ? 900 : 170, dragging.value ? 38 : 11, dt)
    if (landing && wasFar && Math.abs(dx.x) + Math.abs(dy.x) < 6) {
      landing = false
      sq.v -= 4
    }
    if (!dragging.value) L0 += -dx.v * 0.004
  }
  spring(lean, L0, 60, 9, dt)
  spring(lx, ex, 120, 14, dt)
  spring(ly, ey, 120, 14, dt)
  spring(sq, 0, 190, 9.5, dt)
  spring(stx, dx.v * 0.00017, 240, 11, dt)
  spring(sty, dy.v * 0.00017, 240, 11, dt)
  spring(tail, dragging.value ? 0 : 1, 150, 15, dt)
  if (!dragging.value) {
    const sp = Math.abs(dx.v)
    if (sp > 140) sideTo = dx.v > 0 ? -1 : 1
    else if (follow && mood !== 'sleep' && Math.abs(ptr.x - cx) > 90) sideTo = ptr.x > cx ? -1 : 1
  }
  spring(side, sideTo, 34, 8.5, dt)

  let lift = 0
  if (jumpT > 0) {
    const p = (now - jumpT) / 520
    if (p >= 1) {
      jumpT = -1
      sq.v -= 3.8
    } else if (p > 0.1) {
      const q = (p - 0.1) / 0.9
      lift = -26 * jumpH * 4 * q * (1 - q)
    }
  }
  const b = Math.sin(t * (mood === 'sleep' ? 1.1 : 2.1))
  const bob = mood === 'sleep' ? 0 : Math.sin(t * 1.35) * 2.2
  const s = Math.max(-0.35, Math.min(0.35, sq.x))
  const syk = 1 + 0.022 * b + s
  const sxk = 1 - 0.017 * b - s * 0.55
  const L = lean.x
  let st = Math.hypot(stx.x, sty.x)
  let ux = 1
  let uy = 0
  if (st > 1e-4) {
    ux = stx.x / st
    uy = sty.x / st
  }
  st = Math.min(MAX_STRETCH, st)
  const T = Math.max(0, Math.min(1, tail.x))
  const S = Math.max(-1, Math.min(1, side.x))
  const tR = T * Math.max(0, S)
  const tL = T * Math.max(0, -S)
  const held = dragging.value ? 1 : 0
  const R = 1 - T // tucked tail: held in the air, the flat ghost bottom rounds into a drop
  const pts = BODY.map(([x0, y0], i): [number, number] => {
    let x = x0
    let y = y0
    if (R > 0.001) {
      if (i === TR || i === TL) {
        x *= 1 - 0.03 * R
        y -= 0.5 * R
      } else if (i === 6 || i === 8) {
        x *= 1 - 0.1 * R
        y -= 0.6 * R
      } else if (i === 7) y += 2.4 * R
    }
    if (i === TR && tR > 0.001) {
      x += (TAIL_V[0] + Math.sin(t * 1.8) * 2.6) * tR
      y += (TAIL_V[1] + Math.cos(t * 1.8) * 1.3) * tR
    }
    if (i === TL && tL > 0.001) {
      x += (-TAIL_V[0] - Math.sin(t * 1.8) * 2.6) * tL
      y += (TAIL_V[1] + Math.cos(t * 1.8) * 1.3) * tL
    }
    const up = (45 - y) / 90 // 0 bottom … 1 top
    let nx = x * sxk + L * up * up * 1.4
    let ny = 45 + (y - 45) * syk
    if (st > 0.002) {
      // longer along the motion, a little thinner across it
      const a = nx * ux + (ny - 0.5) * uy
      const bb = -nx * uy + (ny - 0.5) * ux
      const a2 = a * (1 + st)
      const b2 = bb * (1 - st * 0.5)
      nx = a2 * ux - b2 * uy
      ny = 0.5 + a2 * uy + b2 * ux
    }
    const wob = 0.8 + held * 0.45
    nx += Math.sin(t * (1.6 + held * 1.2) + i * 1.7) * wob
    ny += Math.cos(t * (1.3 + held * 1.1) + i * 2.1) * wob * 0.9
    return [nx, ny]
  })
  body.setAttribute('d', pathOf(pts))

  const k = 120 / props.size // css px → svg units, so a drag tracks the pointer exactly
  const oy = lift + bob + dy.x * k
  const ox = dx.x * k
  liftEl.value?.setAttribute('transform', `translate(${ox.toFixed(2)} ${oy.toFixed(2)})`)
  const faceY = 45 + (-7 - 45) * syk + 7
  faceEl.value?.setAttribute('transform', `translate(${(L * 0.55 + lx.x * 0.25).toFixed(2)} ${faceY.toFixed(2)})`)
  sheenEl.value?.setAttribute('transform', `translate(${(L * 0.8).toFixed(2)} ${(faceY * 1.2).toFixed(2)}) rotate(-32 -17 -25)`)
  const air = Math.min(1, -(lift + dy.x * k) / 40)
  const shadow = shadowEl.value
  if (shadow) {
    shadow.setAttribute('rx', (32 * (1 - 0.35 * Math.max(0, air)) * sxk).toFixed(2))
    shadow.setAttribute('cx', (2 + ox).toFixed(2))
    shadow.setAttribute('opacity', ((1 - 0.5 * Math.max(0, air)) * T).toFixed(2))
  }

  if (now > nextBlink && mood !== 'sleep' && mood !== 'happy') {
    blinkT = now
    nextBlink = now + 2200 + Math.random() * 3600
    doubleBlink = Math.random() < 0.22
  }
  let bl = 1
  if (blinkT) {
    const p = (now - blinkT) / 150
    if (p < 1) bl = Math.abs(1 - 2 * p) * 0.92 + 0.08
    else if (doubleBlink && p < 2.3 && p > 1.3) bl = Math.abs(1 - 2 * (p - 1.3)) * 0.92 + 0.08
  }
  paintFace(mood, lx.x, ly.x, bl)
}

/** The eyes, or the closed arcs when it is happy or asleep, looking at (ex, ey). */
function paintFace(mood: BilimMood, ex: number, ey: number, bl = 1): void {
  const arc = mood === 'happy' || mood === 'sleep'
  const ry = (mood === 'think' ? 5.6 : mood === 'listen' ? 6.9 : 6.4) * bl
  ;[eyeL.value, eyeR.value].forEach((e, i) => {
    if (!e) return
    e.setAttribute('cx', ((i ? 11 : -11) + ex).toFixed(2))
    e.setAttribute('cy', (-7 + ey).toFixed(2))
    e.setAttribute('ry', ry.toFixed(2))
    e.style.display = arc ? 'none' : ''
  })
  ;[arcL.value, arcR.value].forEach((a, i) => {
    if (!a) return
    const x = (i ? 11 : -11) + ex * 0.4
    a.setAttribute(
      'd',
      arc ? (mood === 'happy' ? `M${x - 5},-5 Q${x},-12 ${x + 5},-5` : `M${x - 5},-6 Q${x},-3 ${x + 5},-6`) : '',
    )
  })
}

function loop(): void {
  if (reduce) return
  cancelAnimationFrame(raf)
  const tick = (now: number): void => {
    if (!visible || !svg.value) return
    frame(now)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}

/** A hop; `h` is how high, 1 being a full one. */
function jump(h = 1): void {
  jumpT = performance.now()
  jumpH = h
  sq.v -= 2.5
}

/** Squash, hop, and a smile for a moment. */
function poke(): void {
  sq.v -= 5.5
  const was = shown.value
  if (was === 'sleep' || was === 'idle' || was === 'happy') {
    shown.value = 'happy'
    clearTimeout(pokeT)
    pokeT = setTimeout(() => {
      if (shown.value === 'happy') shown.value = was === 'happy' ? props.mood : was
    }, 1400)
  }
  jump(0.9)
  emit('poke')
}

function onClick(): void {
  if (!props.still && !moved) poke()
}

function down(e: PointerEvent): void {
  if (!props.drag || props.still || !svg.value) return
  const el = svg.value
  dragging.value = true
  moved = false
  const sx = e.clientX - dx.x
  const sy = e.clientY - dy.x
  let px = e.clientX
  try {
    el.setPointerCapture(e.pointerId)
  } catch {
    // a synthetic or already-released pointer: the drag still works without capture
  }
  const mv = (ev: PointerEvent): void => {
    if (Math.hypot(ev.clientX - (sx + dx.x), ev.clientY - (sy + dy.x)) > 3) moved = true
    tx = ev.clientX - sx
    ty = ev.clientY - sy
    lean.v -= (ev.clientX - px) * 0.35 // the top lags a touch behind the hand
    px = ev.clientX
  }
  const up = (): void => {
    dragging.value = false
    el.removeEventListener('pointermove', mv)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
    tx = 0
    ty = 0
    landing = true
    setTimeout(() => (moved = false), 0)
  }
  tx = dx.x
  ty = dy.x
  el.addEventListener('pointermove', mv)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
}

// A still Bili still changes face with its mood.
/** Where a still Bili looks for each mood: up and aside while it thinks, down asleep. */
const STILL_LOOK: Record<BilimMood, [number, number]> = { idle: [0, 0], happy: [0, 0], think: [4.5, -4.5], listen: [0, -1.5], sleep: [0, 2] }

watch(shown, (mood) => {
  if (props.still) nextTick(() => paintFace(mood, ...STILL_LOOK[mood]))
  else if (reduce) nextTick(() => frame(performance.now()))
})

onMounted(() => {
  if (props.still) {
    paintFace(shown.value, ...STILL_LOOK[shown.value])
    return
  }
  reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (props.follow || props.drag) watchPointer()
  const now = performance.now()
  t0 = now / 1000 + Math.random() * 10
  last = now
  nextBlink = now + 1800 + Math.random() * 2500
  frame(now)
  if (svg.value && 'IntersectionObserver' in window) {
    io = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting)
      if (visible) loop()
    })
    io.observe(svg.value)
  } else loop()
})

onBeforeUnmount(() => {
  io?.disconnect()
  cancelAnimationFrame(raf)
  clearTimeout(pokeT)
})

defineExpose({ poke, jump })
</script>

<template>
  <span
    :class="['bilim', still ? 'is-still' : drag && 'is-drag', dragging && 'is-dragging']"
    :data-mood="shown"
    aria-hidden="true"
  >
    <svg
      ref="svg"
      :viewBox="still ? '-46 -47 98 94' : '-60 -64 120 128'"
      :style="still ? { width: `${size}px`, height: `${(size * 94) / 98}px` } : { width: `${size}px`, height: `${(size * 128) / 120}px` }"
      @pointerdown="down"
      @click="onClick"
    >
      <defs>
        <linearGradient
          :id="gid"
          x1="0"
          y1="-46"
          x2="0"
          y2="46"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            offset="0"
            :stop-color="stops[0]"
          />
          <stop
            offset=".55"
            :stop-color="stops[1]"
          />
          <stop
            offset="1"
            :stop-color="stops[2]"
          />
        </linearGradient>
      </defs>
      <ellipse
        v-if="!still"
        ref="shadowEl"
        class="bilim-shadow"
        cx="2"
        cy="56"
        rx="32"
        ry="5"
      />
      <g ref="liftEl">
        <path
          ref="bodyEl"
          :d="still ? MARK : REST"
          :fill="`url(#${gid})`"
        />
        <ellipse
          ref="sheenEl"
          cx="-17"
          cy="-25"
          rx="10"
          ry="5.5"
          fill="#fff"
          opacity=".5"
          transform="rotate(-32 -17 -25)"
        />
        <g ref="faceEl">
          <ellipse
            class="bilim-cheek"
            cx="-21"
            cy="6"
            rx="5.5"
            ry="3.2"
          />
          <ellipse
            class="bilim-cheek"
            cx="21"
            cy="6"
            rx="5.5"
            ry="3.2"
          />
          <ellipse
            ref="eyeL"
            class="bilim-ink"
            cx="-11"
            cy="-7"
            rx="4.7"
            ry="6.4"
          />
          <ellipse
            ref="eyeR"
            class="bilim-ink"
            cx="11"
            cy="-7"
            rx="4.7"
            ry="6.4"
          />
          <path
            ref="arcL"
            class="bilim-line"
            d=""
            stroke-width="3.4"
          />
          <path
            ref="arcR"
            class="bilim-line"
            d=""
            stroke-width="3.4"
          />
          <path
            class="bilim-line bilim-mouth"
            d="M-4.5,6 Q0,10.5 4.5,6"
            stroke-width="2.6"
          />
        </g>
        <text
          class="bilim-zz"
          x="30"
          y="-40"
          font-size="15"
          font-weight="700"
        >z</text>
      </g>
    </svg>
  </span>
</template>

<style scoped>
.bilim {
  display: inline-block;
  flex: none;
  line-height: 0;
  -webkit-tap-highlight-color: transparent;
}

.bilim svg {
  overflow: visible;
  cursor: pointer;
}

/* Only a draggable Bili takes the touch; an avatar in a thread must let the thread scroll. */
.bilim.is-drag {
  touch-action: none;
}

.bilim.is-still svg {
  cursor: inherit;
}

.bilim.is-drag svg {
  cursor: grab;
}

.bilim.is-dragging svg {
  cursor: grabbing;
}

/* The face is ink on yellow in both themes: Bili is the same colour in the dark. */
.bilim-ink {
  fill: #2a2418;
}

.bilim-line {
  fill: none;
  stroke: #2a2418;
  stroke-linecap: round;
}

.bilim-shadow {
  fill: var(--blob-shadow, rgb(80 55 10 / 0.16));
}

.bilim-cheek {
  fill: #f58a77;
  opacity: 0;
  transition: opacity 0.4s;
}

.bilim[data-mood='happy'] .bilim-cheek,
.bilim:hover .bilim-cheek {
  opacity: 0.55;
}

.bilim-mouth {
  opacity: 0;
  transition: opacity 0.25s;
}

.bilim[data-mood='happy'] .bilim-mouth {
  opacity: 1;
}

.bilim-zz {
  fill: var(--text-faint);
  font-family: var(--font-body);
  opacity: 0;
  transition: opacity 0.5s;
}

.bilim[data-mood='sleep'] .bilim-zz {
  opacity: 1;
  animation: bilim-zz 2.6s ease-in-out infinite;
}

@keyframes bilim-zz {
  0% {
    transform: translate(0, 0);
    opacity: 0;
  }
  30% {
    opacity: 1;
  }
  100% {
    transform: translate(8px, -14px);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bilim[data-mood='sleep'] .bilim-zz {
    animation: none;
  }
}
</style>

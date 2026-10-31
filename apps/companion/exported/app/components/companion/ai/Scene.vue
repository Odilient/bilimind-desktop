<script lang="ts">
/** Where each scene's camera was, so the card that replaces the live one doesn't jump. */
const views = new Map<string, [number, number, number]>()
</script>

<script setup lang="ts">
/**
 * A 3D teaching scene: our renderer over parts the model listed (see Drawing.php).
 * Parts appear as they are written. It turns slowly until touched, and can be dragged.
 * Labels are HTML over the canvas, so they stay sharp and readable at any size.
 */
import type * as Three from 'three'
import type { ScenePart } from '~/companion/ai/graphic'

const props = defineProps<{
  parts: ScenePart[]
  /** Still being written: parts pop in. Afterwards they are simply there. */
  live?: boolean
  /** Whose camera to remember. */
  viewKey: string
  /** The enlarged view has room to scroll-zoom; in a chat the wheel must keep scrolling. */
  zoom?: boolean
  title?: string
}>()

const COLORS: Record<string, number> = {
  cobalt: 0x2740e0, lime: 0xc8f04b, ink: 0x1a1d23, grey: 0xb9bfca, white: 0xf7f8fa,
  red: 0xe5484d, amber: 0xf5a524, green: 0x30a46c, sky: 0x5cb8f0,
}

const host = shallowRef<HTMLElement | null>(null)
const canvas = shallowRef<HTMLCanvasElement | null>(null)
const failed = ref(false)
const labels = ref<{ text: string }[]>([])
const labelEls: HTMLElement[] = []

let THREE: typeof Three
let renderer: Three.WebGLRenderer | null = null
let scene: Three.Scene
let camera: Three.PerspectiveCamera
let controls: { update: () => void; enableZoom: boolean; autoRotate: boolean; target: Three.Vector3; dispose: () => void } | null = null
let frame = 0
let built = 0
let touched = false
let framed = false
let floor: Three.Object3D | null = null
const anchors: Three.Vector3[] = []
const popping: { object: Three.Object3D; started: number }[] = []
const still = import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function solid(part: ScenePart): Three.Object3D {
  const material = new THREE.MeshStandardMaterial({
    color: COLORS[part.color] ?? COLORS.grey,
    roughness: 0.55,
    metalness: 0.05,
    transparent: (part.opacity ?? 1) < 1,
    opacity: part.opacity ?? 1,
    depthWrite: (part.opacity ?? 1) >= 1,
  })

  if (part.shape === 'arrow') {
    const from = new THREE.Vector3(...part.at)
    const to = new THREE.Vector3(...part.to!)
    const length = Math.max(0.01, from.distanceTo(to))
    const head = Math.min(0.6, length * 0.4)
    const group = new THREE.Group()
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, length - head, 12), material)
    shaft.position.y = (length - head) / 2
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, head, 16), material)
    tip.position.y = length - head / 2
    group.add(shaft, tip)
    group.position.copy(from)
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize())
    return group
  }

  const s = part.size ?? [1, 1, 1]
  const geometry = {
    box: () => new THREE.BoxGeometry(s[0], s[1], s[2]),
    sphere: () => new THREE.SphereGeometry(s[0]! / 2, 32, 20),
    cylinder: () => new THREE.CylinderGeometry(s[0]! / 2, s[0]! / 2, s[1], 32),
    cone: () => new THREE.ConeGeometry(s[0]! / 2, s[1], 32),
    torus: () => new THREE.TorusGeometry(s[0]! / 2, s[1]! / 2, 16, 48),
  }[part.shape]()

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...part.at)
  if (part.rotate) mesh.rotation.set(...(part.rotate.map(THREE.MathUtils.degToRad) as [number, number, number]))

  // A hairline on the edges: reads as a drawing rather than as plastic.
  if (part.shape === 'box' || part.shape === 'cylinder' || part.shape === 'cone') {
    mesh.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 30),
      new THREE.LineBasicMaterial({ color: 0x0b0d10, transparent: true, opacity: 0.22 }),
    ))
  }
  return mesh
}

function addNew(): void {
  if (!renderer) return
  for (; built < props.parts.length; built++) {
    const part = props.parts[built]!
    const object = solid(part)
    scene.add(object)
    if (props.live && !still) {
      object.scale.setScalar(0.001)
      popping.push({ object, started: performance.now() })
    }
    if (part.label) {
      // Above the part, wherever it points.
      const box = new THREE.Box3().setFromObject(object)
      const middle = box.getCenter(new THREE.Vector3())
      const top = props.live && !still ? part.at[1] + (part.size?.[1] ?? part.size?.[0] ?? 1) / 2 : box.max.y
      anchors.push(new THREE.Vector3(middle.x, top + 0.25, middle.z))
      labels.value.push({ text: part.label })
    }
  }
  frameAll()
}

/** Look at everything so far, from the same corner. A saved view wins. */
function frameAll(): void {
  if (!renderer || !controls) return
  const box = new THREE.Box3()
  for (const part of props.parts) {
    box.expandByPoint(new THREE.Vector3(...part.at))
    if (part.to) box.expandByPoint(new THREE.Vector3(...part.to))
    const r = Math.max(...(part.size ?? [0])) / 2
    box.expandByPoint(new THREE.Vector3(part.at[0] + r, part.at[1] + r, part.at[2] + r))
    box.expandByPoint(new THREE.Vector3(part.at[0] - r, part.at[1] - r, part.at[2] - r))
  }
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  const radius = Math.max(2.5, sphere.radius)
  const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.8
  controls.target.copy(sphere.center)
  // The floor is about as big as what stands on it, whatever the model's scale.
  floor?.scale.setScalar(radius * 2.4 / 40)
  if (touched) return
  const saved = views.get(props.viewKey)
  if (saved && !framed && !props.live) {
    framed = true
    camera.position.set(...saved)
    return
  }
  // From the same corner above the floor, then keeping whatever angle it has turned to.
  const direction = framed ? camera.position.clone().sub(sphere.center) : new THREE.Vector3(1, 0.72, 1.15)
  framed = true
  camera.position.copy(sphere.center).add(direction.normalize().multiplyScalar(distance))
}

function resize(): void {
  if (!renderer || !host.value) return
  const { clientWidth: w, clientHeight: h } = host.value
  if (!w || !h) return
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

function tick(now: number): void {
  frame = requestAnimationFrame(tick)
  if (!renderer || !controls) return

  for (let i = popping.length - 1; i >= 0; i--) {
    const p = popping[i]!
    const t = Math.min(1, (now - p.started) / 320)
    p.object.scale.setScalar(Math.max(0.001, 1 - (1 - t) ** 3))
    if (t >= 1) popping.splice(i, 1)
  }

  controls.update()
  renderer.render(scene, camera)
  placeLabels()
}

/** Where each label goes: over its part, nudged up clear of the others, nearest the viewer first. */
function labelSpots(width: number, height: number): { x: number; y: number }[] {
  const v = new THREE.Vector3()
  const spots: { x: number; y: number }[] = []
  const placed: { x: number; y: number; w: number }[] = []
  anchors
    .map((anchor, i) => ({ anchor, i, away: anchor.distanceToSquared(camera.position) }))
    .sort((a, b) => a.away - b.away)
    .forEach(({ anchor, i }) => {
      v.copy(anchor).project(camera)
      const x = (v.x + 1) / 2 * width
      let y = (1 - v.y) / 2 * height
      const w = labelEls[i]?.offsetWidth ?? 60
      for (const other of placed) {
        if (Math.abs(other.x - x) < (other.w + w) / 2 + 2 && Math.abs(other.y - y) < 21) y = other.y - 21
      }
      placed.push({ x, y, w })
      spots[i] = { x, y }
    })
  return spots
}

function placeLabels(): void {
  const el = host.value
  if (!el) return
  labelSpots(el.clientWidth, el.clientHeight).forEach((spot, i) => {
    const label = labelEls[i]
    if (label) label.style.transform = `translate(-50%, -100%) translate(${spot.x}px, ${spot.y}px)`
  })
}

let observer: ResizeObserver | null = null

onMounted(async () => {
  try {
    THREE = await import('three')
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js')
    if (!canvas.value) return

    renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio))
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(35, 1.6, 0.1, 400)
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc4cad6, 1.7))
    const sun = new THREE.DirectionalLight(0xffffff, 1.9)
    sun.position.set(7, 14, 9)
    scene.add(sun)
    floor = new THREE.GridHelper(40, 40, 0xdfe3ea, 0xeceef3)
    floor.position.y = -0.001
    scene.add(floor)

    const orbit = new OrbitControls(camera, canvas.value)
    orbit.enablePan = false
    orbit.enableDamping = true
    orbit.enableZoom = Boolean(props.zoom)
    orbit.autoRotate = !still
    orbit.autoRotateSpeed = 0.9
    orbit.addEventListener('start', () => {
      touched = true
      orbit.autoRotate = false
    })
    controls = orbit

    resize()
    observer = new ResizeObserver(resize)
    if (host.value) observer.observe(host.value)
    addNew()
    frame = requestAnimationFrame(tick)
  } catch {
    failed.value = true
  }
})

watch(() => props.parts.length, addNew)
watch(() => props.zoom, (on) => {
  if (controls) controls.enableZoom = Boolean(on)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  observer?.disconnect()
  if (renderer) views.set(props.viewKey, [camera.position.x, camera.position.y, camera.position.z])
  controls?.dispose()
  scene?.traverse((o) => {
    const mesh = o as Three.Mesh
    mesh.geometry?.dispose()
    ;(mesh.material as Three.Material | undefined)?.dispose?.()
  })
  renderer?.dispose()
  renderer = null
})

/** The view as a picture, labels and all: for keeping it in a note or on a board. */
function snapshot(): { src: string; w: number; h: number } | null {
  if (!renderer || !canvas.value || !host.value) return null
  renderer.render(scene, camera)
  const { clientWidth: w, clientHeight: h } = host.value
  const out = document.createElement('canvas')
  out.width = w * 2
  out.height = h * 2
  const ctx = out.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(canvas.value, 0, 0, out.width, out.height)
  ctx.scale(2, 2)
  ctx.font = '600 12px system-ui, sans-serif'
  ctx.textAlign = 'center'
  labelSpots(w, h).forEach(({ x, y }, i) => {
    const text = labels.value[i]?.text ?? ''
    const width = ctx.measureText(text).width + 12
    ctx.fillStyle = 'rgba(255,255,255,.92)'
    ctx.fillRect(x - width / 2, y - 18, width, 18)
    ctx.fillStyle = '#0b0d10'
    ctx.fillText(text, x, y - 5)
  })
  return { src: out.toDataURL('image/jpeg', 0.85), w, h }
}

defineExpose({ snapshot })
</script>

<template>
  <div
    ref="host"
    class="relative size-full overflow-hidden"
    role="img"
    :aria-label="title || 'A 3D drawing'"
  >
    <p
      v-if="failed"
      class="grid size-full place-items-center p-4 text-center text-[14px] text-text-muted"
    >
      This device can't show 3D drawings.
    </p>
    <canvas
      v-else
      ref="canvas"
      class="block size-full cursor-grab touch-none active:cursor-grabbing"
    />
    <span
      v-for="(label, i) in labels"
      :key="i"
      :ref="(el) => { if (el) labelEls[i] = el as HTMLElement }"
      class="pointer-events-none absolute top-0 left-0 rounded-[6px] bg-surface/90 px-1.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap text-text"
    >{{ label.text }}</span>
  </div>
</template>

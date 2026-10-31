<script setup lang="ts">
/**
 * A board on screen: the canvas, and the chrome the mockup puts around it
 * (study-companion.html, "Quiz 2 revision map"): the way back and the title
 * at the top left, people, Present and Share at the top right, tools down
 * the left, the AI popover bottom-left, zoom and the minimap bottom-right. On
 * a phone the tools move to a bottom bar and the board takes the whole
 * screen, as in the mockup's phone board.
 *
 * The top-left pill reads "‹ ● Databases / 3NF decomposition": the course
 * (or the Notebook) is a link back to it, the title is a button that renames.
 * On a phone, where the course name won't fit, the chevron and dot alone are
 * the way back. As a tab in the course workspace (`embedded`) the tab is the
 * way back, so the pill is the dot and the name, and the board fills its
 * pane instead of taking over a phone's screen.
 *
 * The tools are the old app's ink tray: a dark pill, the tool in hand the one
 * lime thing on it, as the pen tray over a lesson and its whiteboard have it.
 *
 * The canvas itself never renders through Vue. `BoardController` owns it;
 * this component mounts it, and draws only the HTML that sits on top:
 * selection outlines, the text being typed, other people's cursors.
 */
import { openBoard } from '~/companion/board/active'
import type { BoardSync } from '~/companion/board/persistence'
import type { BoardPresence } from '~/companion/board/presence'
import type { BoardContext } from '~/companion/board/context'
import { BoardController } from '~/companion/board/controller'
import { createScene, type Scene } from '~/companion/board/scene'
import { courseHex, INK } from '~/companion/board/palette'
import type { Camera, Pt } from '~/companion/board/geometry'
import type * as Y from 'yjs'
import { LOCAL } from '~/companion/board/model'
import type { Item } from '~/companion/types'

const props = defineProps<{
  sync: BoardSync
  itemId: string
  title: string
  subject: { id: string; title: string; color: string } | null
  /** The doc's own course colour, for before the course has loaded (or offline). */
  fallbackColor?: string | null
  me: string
  presence: BoardPresence
  demo: boolean
  context: () => BoardContext
  pages: Item[]
  /** A tab in the course workspace: it fills its pane, and the tab is the way back. */
  embedded?: boolean
  /** Under Notes' doc header, which carries the way back and the name: no pill. */
  bare?: boolean
}>()

const emit = defineEmits<{
  rename: [title: string]
  upload: [file: File, done: (src: string | null, itemId?: string) => void]
  openPage: [id: string]
}>()

const root = ref<HTMLDivElement>()
const host = ref<HTMLDivElement>()
const view = ref<HTMLDivElement>()
const wet = ref<HTMLCanvasElement>()
const fileInput = ref<HTMLInputElement>()
const ctl = shallowRef<BoardController | null>(null)
const phone = ref(false)
const aiOpen = ref(false)
const pickPageAt = ref<Pt | null>(null)
const failed = ref<string | null>(null)
let imageAt: Pt | null = null
let scene: Scene | null = null
let ro: ResizeObserver | null = null
let mq: MediaQueryList | null = null

const color = computed(() => courseHex(props.subject?.color ?? props.fallbackColor))
const ui = computed(() => ctl.value?.ui ?? null)
const presenting = computed(() => !!ui.value?.present)

function onPhone(e: MediaQueryList | MediaQueryListEvent) {
  phone.value = e.matches
}

onMounted(async () => {
  mq = window.matchMedia('(max-width: 639.98px)')
  onPhone(mq)
  mq.addEventListener('change', onPhone)
  await props.sync.local
  await document.fonts?.ready
  const r = host.value!.getBoundingClientRect()
  try {
    scene = await createScene('leafer', view.value!, { w: r.width, h: r.height })
  } catch (e) {
    failed.value = (e as Error).message || 'The board could not start.'
    return
  }
  const wasEmpty = props.sync.parts.objects.size === 0 && props.sync.parts.strokes.length === 0
  ctl.value = new BoardController({
    parts: props.sync.parts,
    scene,
    host: host.value!,
    wet: wet.value!,
    me: props.me,
    color: () => color.value,
    presence: props.presence,
    onOpenPage: (id) => emit('openPage', id),
    onRequestImage: (at) => {
      imageAt = at
      fileInput.value?.click()
    },
    onRequestPage: (at) => (pickPageAt.value = at),
  })
  const saved = wasEmpty ? null : savedView()
  if (saved) ctl.value.setCamera(saved)
  else frameFirstView()
  // So an assistant's drawing can be put on this board.
  openBoard.value = {
    place: (src, natural) => {
      const c = ctl.value
      if (c) c.placeImage(src, undefined, c.viewCentre(), natural)
    },
  }
  // For headless checks in development: what the board holds right now.
  if (import.meta.dev) (window as unknown as { __board?: BoardController }).__board = ctl.value
  ro = new ResizeObserver(() => {
    const b = host.value?.getBoundingClientRect()
    if (b && ctl.value) ctl.value.resize(b.width, b.height)
  })
  ro.observe(host.value!)
  // An empty board can fill a moment later: the server's copy arrives, or the
  // page sets out a board that was never opened. Frame that first content,
  // unless the person has already moved the view or started on it themselves.
  if (wasEmpty) {
    const objects = props.sync.parts.objects
    const onFirst = (_events: unknown, txn: Y.Transaction) => {
      objects.unobserveDeep(onFirst)
      if (txn.origin === LOCAL || ctl.value?.ui.moved) return
      // After the controller's next redraw, so the content's bounds are known.
      requestAnimationFrame(() => requestAnimationFrame(frameFirstView))
    }
    objects.observeDeep(onFirst)
    stopFirst = () => objects.unobserveDeep(onFirst)
  }
  watch(() => ctl.value?.ui.camera, saveViewSoon)
})

onBeforeUnmount(() => {
  openBoard.value = null
  stopFirst?.()
  saveView()
  if (saveTimer) clearTimeout(saveTimer)
  mq?.removeEventListener('change', onPhone)
  ro?.disconnect()
  ctl.value?.destroy()
  scene?.destroy()
})

/*
 * Where this board was last looked at, per board and per screen shape (a
 * phone's view is no use on a desktop), so it reopens where it was left.
 * A board with no saved view is framed instead.
 */
const viewKey = () => `bm:board-view:${props.itemId}:${phone.value ? 'phone' : 'wide'}`
let saveTimer: ReturnType<typeof setTimeout> | null = null
let stopFirst: (() => void) | null = null

function savedView(): Camera | null {
  try {
    const v = JSON.parse(localStorage.getItem(viewKey()) ?? 'null') as Camera | null
    return v && [v.x, v.y, v.scale].every((n) => Number.isFinite(n)) && v.scale > 0 ? v : null
  } catch {
    return null
  }
}

function saveView() {
  const c = ctl.value
  if (!c || c.ui.present || (!props.sync.parts.objects.size && !props.sync.parts.strokes.length)) return
  try {
    localStorage.setItem(viewKey(), JSON.stringify(c.ui.camera))
  } catch {
    // Private mode: the board is framed afresh next time.
  }
}

function saveViewSoon() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveView, 400)
}

function frameFirstView() {
  if (phone.value) ctl.value?.zoomToFocus(fitPad())
  else ctl.value?.zoomToFit(false, fitPad())
}

/** Room for the chrome when framing the board. */
function fitPad() {
  return phone.value ? { top: 64, right: 20, bottom: 96, left: 20 } : { top: 72, right: 48, bottom: 64, left: 80 }
}

// ---- overlays --------------------------------------------------------------

const selRect = computed(() => {
  const c = ctl.value
  if (!c || presenting.value || c.ui.editing) return null
  void c.ui.version
  return c.selectionRect()
})

const handles = computed(() => {
  const c = ctl.value
  if (!c || !selRect.value) return []
  void c.ui.version
  const o = c.resizable()
  if (!o) return []
  const r = c.screenRect({ x: o.x, y: o.y, w: o.w, h: o.h })
  return [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x, y: r.y + r.h }, { x: r.x + r.w, y: r.y + r.h }]
})

const box = computed(() => {
  const c = ctl.value
  if (!c?.ui.box) return null
  void c.ui.version
  return c.screenRect(c.ui.box)
})

const draft = computed(() => {
  const c = ctl.value
  if (!c?.ui.draft) return null
  void c.ui.version
  return { a: c.toScreen(c.ui.draft.a), b: c.toScreen(c.ui.draft.b) }
})

const targetRect = computed(() => {
  const c = ctl.value
  if (!c?.ui.target) return null
  void c.ui.version
  const r = c.rectOf(c.ui.target)
  return r ? c.screenRect(r) : null
})

const cursors = computed(() => {
  const c = ctl.value
  if (!c) return []
  void c.ui.version
  const { w, h } = c.ui.size
  return props.presence.peers.value
    .filter((p) => p.cursor)
    .map((p) => ({ ...p, at: c.toScreen(p.cursor!) }))
    .filter((p) => p.at.x > -40 && p.at.y > -40 && p.at.x < w + 40 && p.at.y < h + 40)
})

const people = computed(() => [
  { id: 'me', name: props.me, color: INK.cobalt },
  ...props.presence.peers.value.map((p) => ({ id: p.id, name: p.name, color: p.color })),
])

const cursorStyle = computed(() => {
  const u = ui.value
  if (!u) return 'default'
  if (u.spaceDown) return 'grab'
  if (u.present) return 'pointer'
  if (u.tool === 'select') return 'default'
  if (u.tool === 'text') return 'text'
  return 'crosshair'
})

// ---- images and pages ------------------------------------------------------

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  const at = imageAt ?? ctl.value?.viewCentre()
  if (!file || !at || !ctl.value) return
  emit('upload', file, (src, itemId) => {
    if (!src || !ctl.value) return
    const img = new Image()
    img.onload = () => ctl.value?.placeImage(src, itemId, at, { w: img.naturalWidth, h: img.naturalHeight })
    img.src = src
  })
}

function placePage(item: Item) {
  const at = pickPageAt.value ?? ctl.value?.viewCentre()
  pickPageAt.value = null
  if (at) ctl.value?.placePage(item, at)
}

// ---- title -----------------------------------------------------------------

/** Where the top bar's back link goes: the board's course, or the Notebook. */
const back = computed(() =>
  props.subject
    ? { to: `/app/courses/${props.subject.id}`, label: props.subject.title }
    : { to: '/app/notes', label: 'Notes' },
)

const renaming = ref(false)
const draftTitle = ref('')
function startRename() {
  draftTitle.value = props.title
  renaming.value = true
  nextTick(() => (document.getElementById('board-title-input') as HTMLInputElement | null)?.select())
}
function finishRename() {
  if (!renaming.value) return
  renaming.value = false
  const t = draftTitle.value.trim()
  if (t && t !== props.title) emit('rename', t)
}

const shared = ref(false)
async function share() {
  try {
    // The board's own address, also when it's open as a tab in its course.
    await navigator.clipboard.writeText(`${location.origin}/app/b/${props.itemId}`)
    shared.value = true
    setTimeout(() => (shared.value = false), 1800)
  } catch {
    shared.value = false
  }
}

const presentTitle = computed(() => {
  const p = ui.value?.present
  if (!p || !ctl.value) return ''
  const f = ctl.value.get(p.frames[p.index] ?? '')
  return f?.kind === 'frame' ? f.title : ''
})

defineExpose({ ctl })
</script>

<template>
  <div
    ref="root"
    class="board"
    :class="{ 'board--phone': phone && !embedded, 'board--embedded': embedded, 'board--present': presenting }"
  >
    <div
      ref="host"
      class="board-host"
      :style="{ cursor: cursorStyle }"
      data-board-host
    >
      <div
        ref="view"
        class="board-view"
      />
      <canvas
        ref="wet"
        class="board-wet"
      />

      <svg
        class="board-overlay"
        aria-hidden="true"
      >
        <rect
          v-if="targetRect"
          :x="targetRect.x - 4"
          :y="targetRect.y - 4"
          :width="targetRect.w + 8"
          :height="targetRect.h + 8"
          rx="8"
          class="ov-target"
        />
        <line
          v-if="draft"
          :x1="draft.a.x"
          :y1="draft.a.y"
          :x2="draft.b.x"
          :y2="draft.b.y"
          class="ov-draft"
        />
        <rect
          v-if="box"
          :x="box.x"
          :y="box.y"
          :width="box.w"
          :height="box.h"
          class="ov-box"
          :class="{ 'ov-box--make': ui?.tool !== 'select' }"
        />
        <rect
          v-if="selRect"
          :x="selRect.x - 3"
          :y="selRect.y - 3"
          :width="selRect.w + 6"
          :height="selRect.h + 6"
          rx="4"
          class="ov-sel"
        />
        <rect
          v-for="(h, i) in handles"
          :key="i"
          :x="h.x - 5"
          :y="h.y - 5"
          width="10"
          height="10"
          rx="2.5"
          class="ov-handle"
        />
      </svg>

      <div
        v-for="p in cursors"
        :key="p.id"
        class="board-cursor"
        :style="{ transform: `translate(${p.at.x}px, ${p.at.y}px)`, color: p.color }"
      >
        <BoardIcon
          name="cursor"
          :size="15"
        />
        <b :style="{ background: p.color }">{{ p.name }}</b>
      </div>

      <BoardTextEditor
        v-if="ctl && ui?.editing"
        :ctl="ctl"
      />
    </div>

    <p
      v-if="failed"
      class="absolute inset-0 grid place-items-center text-[14px] text-text-muted"
    >
      {{ failed }}
    </p>

    <template v-if="ctl && ui && !presenting">
      <!-- Top: the way back and the title; who's here, Present and Share. -->
      <div
        class="board-top"
        :class="{ 'board-top--bare': bare }"
      >
        <div
          v-if="!bare"
          class="bpill"
        >
          <NuxtLink
            v-if="!embedded"
            :to="back.to"
            class="bback"
            :aria-label="`Back to ${back.label}`"
            :title="`Back to ${back.label}`"
          >
            <BoardIcon
              name="chevron"
              :size="15"
              class="shrink-0 rotate-180 text-text-faint"
            />
            <i
              class="bdot"
              :style="{ background: color }"
            />
            <span
              v-if="!phone"
              class="bcourse"
            >{{ back.label }}</span>
          </NuxtLink>
          <span
            v-if="!phone && !embedded"
            class="bslash"
            aria-hidden="true"
          >/</span>
          <i
            v-else-if="embedded"
            class="bdot bdot--alone"
            :style="{ background: color }"
            aria-hidden="true"
          />
          <input
            v-if="renaming"
            id="board-title-input"
            v-model="draftTitle"
            class="btitle-input"
            maxlength="120"
            aria-label="Board name"
            @keydown.enter.prevent="finishRename"
            @keydown.esc.prevent="renaming = false"
            @blur="finishRename"
          >
          <button
            v-else
            type="button"
            class="btitle"
            title="Rename this board"
            @click="startRename"
          >
            {{ title }}
          </button>
          <span
            v-if="sync.state.value === 'offline'"
            class="bsync"
            title="It goes up when you're back online."
          >Saved on this device</span>
        </div>
        <div class="flex items-center gap-2">
          <div
            class="avs"
            :title="`On this board: ${people.map((p) => p.name).join(', ')}`"
          >
            <span
              v-for="p in phone ? people.slice(1) : people"
              :key="p.id"
              class="av"
              :style="{ background: p.color }"
            >{{ p.name.slice(0, 1) }}</span>
          </div>
          <template v-if="!phone">
            <UiBtn
              variant="secondary"
              class="!h-10"
              title="Show the board frame by frame, as slides"
              @click="ctl.startPresent()"
            >
              <BoardIcon
                name="play"
                :size="13"
              />
              Present
            </UiBtn>
            <UiBtn
              variant="primary"
              class="!h-10"
              title="Copy a link to this board"
              @click="share"
            >
              {{ shared ? 'Link copied' : 'Share' }}
            </UiBtn>
          </template>
        </div>
      </div>

      <BoardToolbar
        :ctl="ctl"
        :phone="phone"
        :ai-open="aiOpen"
        @ai="aiOpen = !aiOpen"
        @present="ctl.startPresent()"
      />

      <BoardSelectionBar
        :ctl="ctl"
        :phone="phone"
      />

      <BoardAiPopover
        v-if="aiOpen"
        :ctl="ctl"
        :item-id="itemId"
        :demo="demo"
        :context="context"
        :phone="phone"
        @close="aiOpen = false"
      />

      <BoardMinimap
        :ctl="ctl"
        :phone="phone"
        :fit-pad="fitPad"
      />
    </template>

    <!-- Present: frames become slides; arrows, a tap on either half, or the buttons. -->
    <div
      v-if="ctl && ui?.present"
      class="board-present"
    >
      <button
        type="button"
        class="bp-btn"
        aria-label="Previous"
        :disabled="ui.present.index === 0"
        @click="ctl.presentGo(-1)"
      >
        <BoardIcon
          name="chevron"
          :size="16"
          class="rotate-180"
        />
      </button>
      <span class="bp-label">
        <b>{{ ui.present.frames.length ? ui.present.index + 1 : 0 }} / {{ ui.present.frames.length }}</b>
        {{ presentTitle || 'No frames yet: add a frame to make a slide' }}
      </span>
      <button
        type="button"
        class="bp-btn"
        aria-label="Next"
        :disabled="ui.present.index >= ui.present.frames.length - 1"
        @click="ctl.presentGo(1)"
      >
        <BoardIcon
          name="chevron"
          :size="16"
        />
      </button>
      <button
        type="button"
        class="bp-exit"
        @click="ctl.stopPresent()"
      >
        Exit
      </button>
    </div>

    <BoardPagePicker
      v-if="pickPageAt"
      :pages="pages"
      :subject-title="subject?.title ?? null"
      @pick="placePage"
      @close="pickPageAt = null; ctl?.setTool('select')"
    />

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onFile"
    >
  </div>
</template>

<style scoped>
.board {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--surface-canvas);
  color: var(--text);
  user-select: none;
  -webkit-user-select: none;
}
/* A phone gets the whole screen, the way the mockup's phone board does. */
.board--phone { position: fixed; inset: 0; z-index: 40; }
.board-host {
  position: absolute;
  inset: 0;
  touch-action: none;
  overflow: hidden;
  -webkit-touch-callout: none;
  background-image: radial-gradient(rgb(11 13 16 / 0.11) 1.2px, transparent 1.3px);
}
.board--present .board-host { background-image: none; background-color: var(--surface-canvas); }
.board-view, .board-wet { position: absolute; inset: 0; }
.board-wet { width: 100%; height: 100%; pointer-events: none; }
.board-overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
.ov-sel { fill: none; stroke: var(--cobalt); stroke-width: 1.5; }
.ov-handle { fill: #fff; stroke: var(--cobalt); stroke-width: 1.5; }
.ov-box { fill: rgb(35 64 230 / 0.06); stroke: var(--cobalt); stroke-width: 1; stroke-dasharray: 4 3; }
.ov-box--make { fill: rgb(35 64 230 / 0.04); stroke-dasharray: none; }
.ov-draft { stroke: var(--cobalt); stroke-width: 2; stroke-dasharray: 5 4; }
.ov-target { fill: none; stroke: var(--cobalt); stroke-width: 2; }

.board-cursor {
  position: absolute; left: 0; top: 0; z-index: 5; pointer-events: none;
  display: grid; grid-template-columns: auto auto; align-items: start;
  transition: transform 60ms linear;
}
.board-cursor b {
  font-size: 10.5px; font-weight: 600; color: #fff; padding: 2px 7px; border-radius: 6px;
  margin-top: 12px; white-space: nowrap;
}

.board-top {
  position: absolute; left: 14px; right: 14px; top: 12px; z-index: 6;
  display: flex; justify-content: space-between; align-items: center; gap: 10px; pointer-events: none;
}
.board-top > * { pointer-events: auto; }
.board-top--bare { justify-content: flex-end; }
.bpill {
  display: inline-flex; gap: 2px; align-items: center; min-width: 0; max-width: 100%; height: 40px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
  padding: 0 4px; font-size: 14px; font-weight: 600;
  box-shadow: 0 6px 16px -10px rgb(13 22 96 / 0.3);
}
/* "‹ ● Databases": the way back, a link that lights up under the pointer. */
.bback {
  display: inline-flex; flex: none; align-items: center; gap: 7px; height: 32px; padding: 0 8px 0 4px;
  border-radius: 8px; color: var(--text-soft); text-decoration: none; transition: background-color 120ms, color 120ms;
}
.bback:hover { background: var(--surface-mute); color: var(--text); }
.bcourse { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bslash { flex: none; font-weight: 400; color: var(--text-ghost); }
.bdot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.bdot--alone { margin: 0 2px 0 8px; }
.btitle {
  min-width: 0; height: 32px; padding: 0 8px; border-radius: 8px;
  font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: text;
  transition: background-color 120ms;
}
.btitle:hover { background: var(--surface-mute); }
.btitle-input {
  font: inherit; font-weight: 600; height: 32px; padding: 0 8px; border: 0; border-radius: 8px;
  outline: 2px solid var(--cobalt); outline-offset: -2px; min-width: 160px; background: transparent;
}
.bsync { flex: none; padding: 0 8px; font-size: 13px; font-weight: 500; color: var(--warn-text); white-space: nowrap; }
.avs { display: flex; padding-left: 6px; }
.av {
  width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--surface); margin-left: -6px;
  display: grid; place-items: center; font-size: 10.5px; font-weight: 700; color: #fff;
}

.board-present {
  position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 8;
  display: flex; align-items: center; gap: 6px; padding: 6px; max-width: calc(100% - 24px);
  background: var(--ink); color: #fff; border-radius: 999px; box-shadow: var(--shadow-pop);
}
.bp-btn { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: #fff; }
.bp-btn:disabled { opacity: 0.35; }
.bp-btn:not(:disabled):hover { background: rgb(255 255 255 / 0.12); }
.bp-label { font-size: 13px; color: rgb(255 255 255 / 0.78); padding: 0 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bp-label b { color: #fff; margin-right: 6px; font-variant-numeric: tabular-nums; }
.bp-exit { height: 34px; padding: 0 14px; border-radius: 999px; background: var(--lime); color: var(--ink); font-size: 13px; font-weight: 600; }

@media (max-width: 639.98px) {
  .board-top { top: max(12px, env(safe-area-inset-top)); left: 12px; right: 12px; }
  .bpill { height: 46px; font-size: 14.5px; }
  .bback { width: 44px; height: 38px; justify-content: center; gap: 5px; padding: 0; }
  .btitle { height: 38px; }
}
</style>

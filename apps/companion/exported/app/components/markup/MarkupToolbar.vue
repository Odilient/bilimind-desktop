<script setup lang="ts">
import type { MarkupTool } from '~/types/api'
import { INK_COLORS, type MarkupSize } from '~/utils/markup'
import InkMixer from '~/components/markup/InkMixer.vue'

/**
 * MARKUP — the pen tray. One floating pill: tools, inks, a size, undo, Done.
 *
 * It is a pill and not a sidebar because it must never be mistaken for the
 * lesson's own chrome. The app has one lime accent and it means "you do
 * something here"; the armed tool is the one place in this pill that wears it.
 *
 * Every tool is a toggle — picking the armed tool puts it down — and there is
 * a Done button anyway, because the reader who cannot find their way back to
 * scrolling will not go looking for a keyboard shortcut. The shortcuts exist
 * for the reader who will: H, P, M, A, E, N pick a tool, ⌘Z/⌃Z undo while one
 * is armed, Escape puts it down (that one lives in `useMarkupTool`).
 *
 * The glyphs are drawn inline at the same 1.8 stroke as the app's icon set,
 * because that set has no highlighter, no marker and no eraser, and a pill
 * that mixes two icon weights looks assembled rather than designed.
 *
 * Nine glyphs in a row is nine guesses, so every one of them says what it is
 * on hover and on focus: its name, its shortcut, and a line on what it does.
 * The label is drawn here rather than left to the browser's `title` so the
 * tray can decide when it appears — after a pause on the way in, instantly
 * once the reader is plainly asking (see `showHint`). It sits outside the
 * scrolling pill — that pill clips what overflows it — and is positioned from
 * the button's live box, so a tray scrolled sideways still labels the right
 * thing.
 *
 * The same goes for its two menus — the whiteboards and the ink mixer. They
 * used to open inside the pill, and a box that scrolls sideways clips in both
 * directions, so the whiteboard menu opened somewhere nobody could see and the
 * button looked dead. Both now hang off the tray's root, beside the label.
 *
 * Inks: the four the product ships, then up to four the reader saved, then a
 * rainbow button that opens the mixer (saved and recent colours live there
 * too). A custom colour that is not on the tray shows inside that button, so
 * the tray always says what the pen is holding.
 */
const props = withDefaults(
  defineProps<{
    tool: MarkupTool | null
    color: string
    size: MarkupSize
    canUndo?: boolean
    canRedo?: boolean
    /** Which tools to offer. A whiteboard has no prose, so no highlighter or note. */
    tools?: MarkupTool[]
    /**
     * `floating` sits at the bottom centre of a `relative` parent; `inline`
     * leaves placement to whoever mounts it.
     */
    placement?: 'floating' | 'inline'
    /** The lesson's whiteboards, for the board menu. Omit to hide the menu. */
    boards?: Array<{ uuid: string; title: string }> | null
  }>(),
  {
    canUndo: false,
    canRedo: false,
    tools: () => ['highlight', 'pen', 'marker', 'arrow', 'text', 'eraser'],
    placement: 'floating',
    boards: null,
  },
)

const emit = defineEmits<{
  'update:tool': [tool: MarkupTool | null]
  'update:color': [color: string]
  'update:size': [size: MarkupSize]
  undo: []
  redo: []
  done: []
  newBoard: []
  openBoard: [uuid: string]
}>()

/* -- The two menus: whiteboards and the ink mixer ------------------------- */

const menu = ref<{ kind: 'boards' | 'mixer'; x: number } | null>(null)
const menuEl = ref<HTMLElement | null>(null)

/** Open `kind` under (or over) the button that asked, or close it if it is open. */
async function toggleMenu(kind: 'boards' | 'mixer', event: Event): Promise<void> {
  hideHint()

  if (menu.value?.kind === kind) {
    menu.value = null
    return
  }

  const button = event.currentTarget
  const box = root.value
  if (!(button instanceof HTMLElement) || !box) return

  const rect = button.getBoundingClientRect()
  const outer = box.getBoundingClientRect()
  menu.value = { kind, x: rect.left - outer.left + rect.width / 2 }

  // Centred on its button, kept inside the tray like the label is.
  await nextTick()
  const current = menu.value
  const panel = menuEl.value
  if (!current || !panel) return
  const half = panel.offsetWidth / 2
  const x = Math.min(Math.max(current.x, half), Math.max(half, box.offsetWidth - half))
  if (x !== current.x) menu.value = { ...current, x }
}

function onDocumentPointerDown(event: PointerEvent): void {
  const target = event.target as Element | null
  if (menuEl.value?.contains(target)) return
  // The button that opened it toggles it itself.
  if (target?.closest?.('[data-tray-menu]')) return
  menu.value = null
  // A click away from the menu only closes it. With the pen armed, letting it
  // through would also leave a dot wherever the reader clicked to dismiss.
  if (!root.value?.contains(target)) event.stopPropagation()
}

/* Capture, on the document: it runs before the window listener in
   useMarkupTool, so Escape closes the menu without also putting the pen down. */
function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !menu.value) return
  event.preventDefault()
  menu.value = null
}

watch(
  () => menu.value !== null,
  (open) => {
    if (!import.meta.client) return
    if (open) {
      document.addEventListener('pointerdown', onDocumentPointerDown, true)
      document.addEventListener('keydown', onDocumentKeydown, true)
    } else {
      document.removeEventListener('pointerdown', onDocumentPointerDown, true)
      document.removeEventListener('keydown', onDocumentKeydown, true)
    }
  },
)

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onDocumentKeydown, true)
})

function chooseNewBoard(): void {
  menu.value = null
  emit('newBoard')
}

function chooseBoard(uuid: string): void {
  menu.value = null
  emit('openBoard', uuid)
}

/* -- Inks ------------------------------------------------------------------ */

const palette = useInkPalette()

/** On the tray itself; the rest of the reader's colours are one click away in the mixer. */
const TRAY_SAVED = 4

const trayInks = computed(() => [
  ...INK_COLORS.map((ink) => ({ name: `${ink.name} ink`, value: ink.value as string })),
  ...palette.saved.value.slice(0, TRAY_SAVED).map((value) => ({ name: 'Your colour', value })),
])

/** The pen holds a colour the tray has no swatch for: show it in the mixer button. */
const offTray = computed(() =>
  trayInks.value.some((ink) => ink.value === props.color) ? null : props.color,
)

const TOOL_META: Record<MarkupTool, { label: string; key: string; hint: string }> = {
  highlight: { label: 'Highlight', key: 'h', hint: 'Drag across words to tint them' },
  pen: { label: 'Pen', key: 'p', hint: 'Draw freehand on a picture or the page' },
  marker: { label: 'Marker', key: 'm', hint: 'A wide, see-through stroke for circling things' },
  arrow: { label: 'Arrow', key: 'a', hint: 'Drag from anywhere to point at something' },
  eraser: { label: 'Eraser', key: 'e', hint: 'Drag over anything you drew, wrote or highlighted' },
  note: { label: 'Note', key: 'n', hint: 'Attach a note to the words you pick' },
  text: { label: 'Text', key: 't', hint: 'Click to drop a few words, then drag them about' },
}

/** 24×24, stroke 1.8, round caps — the house icon grammar, drawn here. */
const GLYPHS: Record<string, string> = {
  highlight:
    '<path d="m14 5.5 4.5 4.5-7.5 7.5H6.5v-4.5Z"/><path d="M6.5 13 11 17.5"/><path d="M3.5 20.5h17"/>',
  pen: '<path d="M4 20h4L20 8a2.1 2.1 0 0 0-3-3L5 17Z"/><path d="m15.5 6.5 3 3"/>',
  marker:
    '<path d="m5.5 15.5 9.5-9.5a2.8 2.8 0 0 1 4 4L9.5 19.5H5.5Z"/><path d="M12.5 8.5 15.5 11.5"/><path d="M4 21.5h7"/>',
  eraser:
    '<path d="m5.5 14.5 8-8a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8l-6.5 6.5H9.5Z"/><path d="M9.5 19 5.5 14.5"/><path d="m9.5 10.5 6 6"/><path d="M4 21h16"/>',
  note: '<path d="M5.5 4.5h13A1.5 1.5 0 0 1 20 6v9a1.5 1.5 0 0 1-1.5 1.5h-7L7 20.5v-4H5.5A1.5 1.5 0 0 1 4 15V6a1.5 1.5 0 0 1 1.5-1.5Z"/><path d="M8.5 9h7M8.5 12.5h4"/>',
  arrow: '<path d="M4.5 19.5 19 5"/><path d="M11.5 5H19v7.5"/>',
  text: '<path d="M5 6.5h14"/><path d="M12 6.5V19"/><path d="M9 19h6"/>',
  board: '<rect x="3" y="4.5" width="18" height="13" rx="2"/><path d="M12 17.5v3M8.5 20.5h7"/><path d="m7 13 3-3.5 2.5 2 3.5-4"/>',
  undo: '<path d="M9 7 5 11l4 4"/><path d="M5 11h9.5a4.5 4.5 0 0 1 0 9H12"/>',
  redo: '<path d="m15 7 4 4-4 4"/><path d="M19 11H9.5a4.5 4.5 0 0 0 0 9H12"/>',
  check: '<path d="m20 6.5-11 11L4 12.5"/>',
}

const shown = computed(() => props.tools.filter((tool) => tool in TOOL_META))

/* -- What is this button? --------------------------------------------------- */

const root = ref<HTMLElement | null>(null)
const hintEl = ref<HTMLElement | null>(null)
const hint = ref<{ label: string; detail: string; key: string | null; x: number } | null>(null)

/** How long the pointer has to rest on a glyph before it is named. */
const HINT_DELAY_MS = 450
/** Once one has been read, the next is instant — this is how long that lasts. */
const HINT_WARM_MS = 600

let hintTimer: ReturnType<typeof setTimeout> | undefined
let hiddenAt = 0

/**
 * The label waits. A tray you already know is a tray you sweep across on the
 * way to the tool you want, and labels that pop up under every glyph on the
 * way there are noise — so the pointer has to stop. Once one label has been
 * read the reader is asking rather than passing through, and the rest come up
 * at once until they leave the tray for a moment. Keyboard focus never waits:
 * arriving on a button by Tab is already deliberate.
 */
function showHint(event: Event, label: string, detail: string, key: string | null = null): void {
  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) return

  if (hintTimer) clearTimeout(hintTimer)
  hintTimer = undefined

  const now = hint.value !== null || event.type === 'focus' || Date.now() - hiddenAt < HINT_WARM_MS

  if (now) {
    void place(target, label, detail, key)
    return
  }

  hintTimer = setTimeout(() => void place(target, label, detail, key), HINT_DELAY_MS)
}

async function place(
  button: HTMLElement,
  label: string,
  detail: string,
  key: string | null,
): Promise<void> {
  const box = root.value
  if (!box) return

  const rect = button.getBoundingClientRect()
  const outer = box.getBoundingClientRect()

  hint.value = { label, detail, key, x: rect.left - outer.left + rect.width / 2 }

  // Centred on its button, but never hanging off the tray: the first and last
  // glyphs are the ones a narrow phone would push off the screen.
  await nextTick()

  const current = hint.value
  const panel = hintEl.value
  if (!current || !panel) return

  const half = panel.offsetWidth / 2
  const min = half + 2
  const max = box.offsetWidth - half - 2
  const x = max < min ? box.offsetWidth / 2 : Math.min(Math.max(current.x, min), max)

  if (x !== current.x) hint.value = { ...current, x }
}

function hideHint(): void {
  if (hintTimer) clearTimeout(hintTimer)
  hintTimer = undefined
  if (hint.value !== null) hiddenAt = Date.now()
  hint.value = null
}

/** ⌘ on a Mac, Ctrl everywhere else — the tray names the key the reader has. */
const modKey = computed(() =>
  import.meta.client && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl',
)

function pick(tool: MarkupTool): void {
  emit('update:tool', props.tool === tool ? null : tool)
}

function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') !==
    null
  )
}

function onKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || typing(event.target)) return

  const meta = event.metaKey || event.ctrlKey

  if (meta && !event.altKey && event.key.toLowerCase() === 'z') {
    if (props.tool === null) return
    event.preventDefault()
    if (event.shiftKey) {
      if (props.canRedo) emit('redo')
    } else if (props.canUndo) {
      emit('undo')
    }
    return
  }

  if (meta || event.altKey) return

  const key = event.key.toLowerCase()
  const tool = shown.value.find((candidate) => TOOL_META[candidate].key === key)
  if (!tool) return

  event.preventDefault()
  pick(tool)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (hintTimer) clearTimeout(hintTimer)
})
</script>

<template>
  <div
    ref="root"
    :class="[
      'max-w-[calc(100vw-1.5rem)]',
      placement === 'floating' ? 'absolute bottom-4 left-1/2 z-40 -translate-x-1/2' : 'relative',
    ]"
  >
    <!-- What the hovered button is, and what it does. -->
    <Transition
      enter-active-class="duration-120 ease-out"
      enter-from-class="opacity-0 translate-y-0.5"
      leave-active-class="duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="hint && !menu"
        ref="hintEl"
        class="pointer-events-none absolute bottom-full z-50 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-[10px] bg-chip px-2.5 py-1.5 text-center text-white shadow-pop"
        :style="{ left: `${hint.x}px` }"
        aria-hidden="true"
      >
        <p class="text-[12.5px] leading-none font-semibold text-white">
          {{ hint.label }}
          <kbd
            v-if="hint.key"
            class="ml-1 rounded-[5px] bg-white/12 px-1 py-px text-[10.5px] font-normal text-white/70"
            >{{ hint.key }}</kbd
          >
        </p>
        <p
          v-if="hint.detail"
          class="mt-1 text-[11.5px] leading-snug text-white/60"
        >
          {{ hint.detail }}
        </p>
      </div>
    </Transition>

    <!-- The whiteboards menu, or the ink mixer: outside the pill, which clips. -->
    <div
      v-if="menu"
      ref="menuEl"
      :class="[
        'pop-in absolute bottom-full z-50 mb-2 -translate-x-1/2 rounded-[16px] bg-surface shadow-pop ring-1 ring-border',
        menu.kind === 'mixer' ? 'p-3' : 'w-[220px] p-1.5',
      ]"
      :style="{ left: `${menu.x}px` }"
      :role="menu.kind === 'boards' ? 'menu' : 'dialog'"
      :aria-label="menu.kind === 'boards' ? 'Whiteboards' : 'Mix an ink'"
    >
      <InkMixer
        v-if="menu.kind === 'mixer'"
        :color="color"
        @pick="emit('update:color', $event)"
      />

      <template v-else-if="boards !== null">
        <button
          type="button"
          role="menuitem"
          class="flex w-full cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-semibold text-brand hover:bg-brand-soft"
          @click="chooseNewBoard()"
        >
          <UiIcon
            name="plus"
            :size="13"
            :stroke="2.2"
          />
          New whiteboard
        </button>
        <p
          v-if="boards.length"
          class="eyebrow px-2.5 pt-2 pb-1"
        >
          Yours
        </p>
        <button
          v-for="board in boards"
          :key="board.uuid"
          type="button"
          role="menuitem"
          class="block w-full cursor-pointer truncate rounded-[10px] px-2.5 py-2 text-left text-[13px] text-text-dim hover:bg-surface-mute"
          @click="chooseBoard(board.uuid)"
        >
          {{ board.title }}
        </button>
      </template>
    </div>

    <div
      role="toolbar"
      aria-label="Pen and highlighter"
      class="pop-in flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-chip px-1.5 py-1.5 text-white shadow-[0_20px_40px_-14px_rgb(11_13_16/0.55)] dark:ring-1 dark:ring-border-strong no-bar"
    >
      <!-- Tools -->
      <button
        v-for="candidate in shown"
        :key="candidate"
        type="button"
        :aria-label="`${TOOL_META[candidate].label} — ${TOOL_META[candidate].hint}`"
        :aria-pressed="tool === candidate"
        :class="[
          'grid size-8 shrink-0 cursor-pointer place-items-center rounded-full transition-colors',
          // The ink tray, like the course player's listening bar: the armed
          // tool is the one lime thing on it.
          tool === candidate
            ? 'bg-lime text-ink'
            : 'text-white/60 hover:bg-white/10 hover:text-white',
        ]"
        @pointerenter="
          showHint(
            $event,
            TOOL_META[candidate].label,
            TOOL_META[candidate].hint,
            TOOL_META[candidate].key.toUpperCase(),
          )
        "
        @pointerleave="hideHint()"
        @focus="
          showHint(
            $event,
            TOOL_META[candidate].label,
            TOOL_META[candidate].hint,
            TOOL_META[candidate].key.toUpperCase(),
          )
        "
        @blur="hideHint()"
        @click="pick(candidate)"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-[17px]"
          aria-hidden="true"
          v-html="GLYPHS[candidate]"
        />
      </button>

      <span class="mx-1 h-5 w-px shrink-0 bg-white/15" />

      <!-- Inks: the four, then the reader's own -->
      <button
        v-for="ink in trayInks"
        :key="ink.value"
        type="button"
        :aria-label="ink.name"
        :aria-pressed="color === ink.value"
        class="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full"
        @pointerenter="showHint($event, ink.name, 'The colour every tool draws with')"
        @pointerleave="hideHint()"
        @focus="showHint($event, ink.name, 'The colour every tool draws with')"
        @blur="hideHint()"
        @click="emit('update:color', ink.value)"
      >
        <span
          class="block rounded-full transition-[width,height,box-shadow]"
          :class="
            color === ink.value ? 'size-4 ring-2 ring-offset-2 ring-offset-chip' : 'size-3.5'
          "
          :style="{ backgroundColor: ink.value, color: ink.value }"
        />
      </button>

      <!-- Any other colour: the mixer, with saved and recent ones inside. -->
      <button
        type="button"
        data-tray-menu
        aria-label="More colours"
        :aria-expanded="menu?.kind === 'mixer'"
        :class="[
          'grid size-7 shrink-0 cursor-pointer place-items-center rounded-full transition-colors',
          menu?.kind === 'mixer' ? 'bg-white/14' : 'hover:bg-white/10',
        ]"
        @pointerenter="showHint($event, 'More colours', 'Mix any colour, save the ones you keep using')"
        @pointerleave="hideHint()"
        @focus="showHint($event, 'More colours', 'Mix any colour, save the ones you keep using')"
        @blur="hideHint()"
        @click="toggleMenu('mixer', $event)"
      >
        <span
          :class="[
            'ink-wheel grid place-items-center rounded-full transition-[width,height]',
            offTray ? 'size-[18px]' : 'size-4',
          ]"
        >
          <span
            v-if="offTray"
            class="block size-2.5 rounded-full ring-2 ring-chip"
            :style="{ backgroundColor: offTray }"
          />
          <UiIcon
            v-else
            name="plus"
            :size="9"
            :stroke="3.2"
            class="text-chip"
          />
        </span>
      </button>

      <span class="mx-1 h-5 w-px shrink-0 bg-white/15" />

      <!-- Size: one button, two states. Shows the width it will draw with. -->
      <button
        type="button"
        :aria-label="size === 'thin' ? 'Thin — click for thick' : 'Thick — click for thin'"
        class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10"
        @pointerenter="showHint($event, 'Stroke width', 'Switches between thin and thick')"
        @pointerleave="hideHint()"
        @focus="showHint($event, 'Stroke width', 'Switches between thin and thick')"
        @blur="hideHint()"
        @click="emit('update:size', size === 'thin' ? 'thick' : 'thin')"
      >
        <span
          class="block rounded-full bg-current transition-[width,height]"
          :class="size === 'thin' ? 'size-[5px]' : 'size-[11px]'"
        />
      </button>

      <span class="mx-1 h-5 w-px shrink-0 bg-white/15" />

      <!-- Whiteboards: open one, or start a new one. -->
      <button
        v-if="boards !== null"
        type="button"
        data-tray-menu
        aria-label="Whiteboards"
        aria-haspopup="menu"
        :aria-expanded="menu?.kind === 'boards'"
        :class="[
          'grid size-8 shrink-0 cursor-pointer place-items-center rounded-full transition-colors',
          menu?.kind === 'boards'
            ? 'bg-white/14 text-white'
            : 'text-white/60 hover:bg-white/10 hover:text-white',
        ]"
        @pointerenter="showHint($event, 'Whiteboards', 'A blank canvas for this lesson — open one, or start another')"
        @pointerleave="hideHint()"
        @focus="showHint($event, 'Whiteboards', 'A blank canvas for this lesson — open one, or start another')"
        @blur="hideHint()"
        @click="toggleMenu('boards', $event)"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-[17px]"
          aria-hidden="true"
          v-html="GLYPHS.board"
        />
      </button>

      <span
        v-if="boards !== null"
        class="mx-1 h-5 w-px shrink-0 bg-white/15"
      />

      <button
        type="button"
        aria-label="Undo"
        :disabled="!canUndo"
        class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
        @pointerenter="showHint($event, 'Undo', 'Takes back the last stroke', `${modKey}Z`)"
        @pointerleave="hideHint()"
        @focus="showHint($event, 'Undo', 'Takes back the last stroke', `${modKey}Z`)"
        @blur="hideHint()"
        @click="emit('undo')"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-[17px]"
          aria-hidden="true"
          v-html="GLYPHS.undo"
        />
      </button>
      <button
        type="button"
        aria-label="Redo"
        :disabled="!canRedo"
        class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
        @pointerenter="showHint($event, 'Redo', 'Puts back what you just undid', `${modKey}⇧Z`)"
        @pointerleave="hideHint()"
        @focus="showHint($event, 'Redo', 'Puts back what you just undid', `${modKey}⇧Z`)"
        @blur="hideHint()"
        @click="emit('redo')"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-[17px]"
          aria-hidden="true"
          v-html="GLYPHS.redo"
        />
      </button>

      <span class="mx-1 h-5 w-px shrink-0 bg-white/15" />

      <button
        type="button"
        class="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-lime pr-3.5 pl-2.5 text-[12.5px] font-semibold text-ink transition-colors hover:bg-[#d2f86a]"
        @pointerenter="showHint($event, 'Done', 'Puts the tools away and goes back to reading', 'Esc')"
        @pointerleave="hideHint()"
        @focus="showHint($event, 'Done', 'Puts the tools away and goes back to reading', 'Esc')"
        @blur="hideHint()"
        @click="emit('done')"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-[15px]"
          aria-hidden="true"
          v-html="GLYPHS.check"
        />
        Done
      </button>
    </div>
  </div>
</template>

<style scoped>
/* The mixer's button: every hue, so it reads as "other colours" at a glance. */
.ink-wheel {
  background: conic-gradient(#f43f5e, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #f43f5e);
}
</style>


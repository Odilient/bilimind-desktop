<script setup lang="ts">
import type { BoardLabel, LabelSize, MarkupTool } from '~/types/api'

/** A label as this layer draws it; `ref` is the box width it was placed at, when it has its own. */
export type LabelItem = BoardLabel & { ref?: number }

/**
 * MARKUP — the Text tool's surface over one box: a part, a picture, or a
 * whiteboard.
 *
 * A label is a few words at a point, in one of three sizes and the four inks,
 * bold or not, with or without a paper backing for busy pictures. Positions
 * are normalised to the box and the font scales with it (`referenceWidth` is
 * the box's width when the label was placed), so text sits where it was put
 * at any pane width — the same rule as ink.
 *
 * The layer takes the pointer only while the Text tool is armed (to place and
 * to drag) or a label is open. The eraser does NOT make it take the pointer:
 * this layer sits over the ink layer in the same box, so a whole-box surface
 * here swallowed every eraser stroke before it reached the ink, and the eraser
 * erased nothing. The labels themselves are always clickable — with the eraser
 * armed a tap on one removes it, and with nothing armed it reopens it. Storage is
 * the parent's business: this emits `place`, `update` and `remove` and never
 * knows whether a label lives in its own record or inside a whiteboard.
 */
const props = withDefaults(
  defineProps<{
    items: LabelItem[]
    tool: MarkupTool | null
    armed: boolean
    color: string
    box: { width: number; height: number }
    referenceWidth: number
    editable?: boolean
  }>(),
  { editable: false },
)

const emit = defineEmits<{
  place: [x: number, y: number]
  update: [item: LabelItem]
  remove: [id: string]
}>()

/* The label's inks are the tray's: the four, and the first few the reader saved. */
const palette = useInkPalette()
const inks = computed(() => palette.inks.value.slice(0, 8))

const root = ref<HTMLElement | null>(null)
const editing = ref<string | null>(null)
const area = ref<HTMLTextAreaElement[]>([])

const placing = computed(() => props.editable && props.armed && props.tool === 'text')
const erasing = computed(() => props.editable && props.armed && props.tool === 'eraser')

const takesPointer = computed(() => placing.value || editing.value !== null)

const BASE_PX: Record<LabelSize, number> = { sm: 13, md: 17, lg: 24 }

/** The font, scaled with the box against the width the label was placed at. */
function fontPx(size: LabelSize, ref?: number): number {
  const reference = ref && ref > 0 ? ref : props.referenceWidth
  const ratio = reference > 0 ? props.box.width / reference : 1
  return Math.max(9, Math.round(BASE_PX[size] * ratio * 10) / 10)
}

/* -- Dragging ------------------------------------------------------------- */

interface Drag {
  id: string
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  moved: boolean
}

const drag = ref<Drag | null>(null)
const dragged = ref<{ id: string; x: number; y: number } | null>(null)

function positionOf(item: LabelItem): { x: number; y: number } {
  return dragged.value?.id === item.id ? dragged.value : { x: item.x, y: item.y }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function onRootPointerDown(event: PointerEvent): void {
  if (!placing.value || event.target !== root.value || !root.value) return
  if (editing.value) {
    editing.value = null
    return
  }

  const rect = root.value.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return

  event.preventDefault()
  emit('place', clamp01((event.clientX - rect.left) / rect.width), clamp01((event.clientY - rect.top) / rect.height))
}

function onLabelPointerDown(item: LabelItem, event: PointerEvent): void {
  if (erasing.value) {
    event.preventDefault()
    emit('remove', item.id)
    return
  }

  if (!placing.value || editing.value === item.id) return

  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  drag.value = {
    id: item.id,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: item.x,
    originY: item.y,
    moved: false,
  }
}

function onLabelPointerMove(event: PointerEvent): void {
  const current = drag.value
  if (!current || current.pointerId !== event.pointerId || !root.value) return

  const rect = root.value.getBoundingClientRect()
  const dx = (event.clientX - current.startX) / rect.width
  const dy = (event.clientY - current.startY) / rect.height

  if (!current.moved && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 3) return

  current.moved = true
  dragged.value = { id: current.id, x: clamp01(current.originX + dx), y: clamp01(current.originY + dy) }
}

function onLabelPointerUp(item: LabelItem, event: PointerEvent): void {
  const current = drag.value
  if (!current || current.pointerId !== event.pointerId) return

  drag.value = null

  if (current.moved && dragged.value) {
    emit('update', { ...item, x: round4(dragged.value.x), y: round4(dragged.value.y) })
    dragged.value = null
    return
  }

  dragged.value = null
  if (props.editable) open(item.id)
}

function onLabelClick(item: LabelItem): void {
  // A plain click with no tool armed: reopen the label.
  if (!props.editable || placing.value || erasing.value) return
  open(item.id)
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

/* -- Editing --------------------------------------------------------------- */

function open(id: string): void {
  editing.value = id
  void nextTick(() => {
    const el = area.value.find((candidate) => candidate.dataset.label === id)
    el?.focus()
    el?.setSelectionRange(el.value.length, el.value.length)
  })
}

/** A label that has just been placed has nothing in it yet: open it. */
watch(
  () => props.items,
  (items) => {
    if (editing.value !== null) return
    const fresh = items.find((item) => item.text === '')
    if (fresh) open(fresh.id)
  },
  { deep: true },
)

function current(): LabelItem | undefined {
  return props.items.find((item) => item.id === editing.value)
}

function look(patch: Partial<LabelItem>): void {
  const item = current()
  if (item) emit('update', { ...item, ...patch })
}

function onInput(item: LabelItem, event: Event): void {
  emit('update', { ...item, text: (event.target as HTMLTextAreaElement).value.slice(0, 500) })
}

function done(): void {
  const item = current()
  editing.value = null
  if (item && item.text.trim() === '') emit('remove', item.id)
}

function removeCurrent(): void {
  const item = current()
  editing.value = null
  if (item) emit('remove', item.id)
}

function onAreaKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' || (event.key === 'Enter' && !event.shiftKey)) {
    event.preventDefault()
    done()
  }
}

function onAreaBlur(event: FocusEvent): void {
  // Moving to the mini toolbar is not leaving.
  const next = event.relatedTarget as HTMLElement | null
  if (next?.closest('[data-label-tools]')) return
  done()
}

const SIZES: Array<{ value: LabelSize; label: string }> = [
  { value: 'sm', label: 'S' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
]
</script>

<template>
  <div
    ref="root"
    :class="[
      'absolute inset-0 select-none',
      takesPointer ? 'pointer-events-auto' : 'pointer-events-none',
      placing && 'cursor-text',
    ]"
    :style="{ touchAction: placing ? 'none' : undefined }"
    @pointerdown="onRootPointerDown"
  >
    <div
      v-for="item in items"
      :key="item.id"
      class="pointer-events-auto absolute max-w-[62%]"
      :style="{
        left: `${positionOf(item).x * box.width}px`,
        top: `${positionOf(item).y * box.height}px`,
        zIndex: editing === item.id ? 2 : 1,
      }"
      @pointerdown="onLabelPointerDown(item, $event)"
      @pointermove="onLabelPointerMove"
      @pointerup="onLabelPointerUp(item, $event)"
      @pointercancel="drag = null"
      @click.stop="onLabelClick(item)"
    >
      <!-- Looks, shown while editing -->
      <div
        v-if="editing === item.id"
        data-label-tools
        class="pop-in absolute bottom-full left-0 mb-1.5 flex items-center gap-0.5 rounded-full border border-border-strong bg-surface px-1.5 py-1 shadow-lift whitespace-nowrap"
        @pointerdown.stop
        @click.stop
      >
        <button
          v-for="size in SIZES"
          :key="size.value"
          type="button"
          :aria-pressed="item.size === size.value"
          :class="[
            'grid size-7 cursor-pointer place-items-center rounded-full text-[12px] font-semibold',
            item.size === size.value ? 'bg-chip text-lime' : 'text-text-soft hover:bg-surface-mute',
          ]"
          :title="size.value === 'sm' ? 'Small' : size.value === 'md' ? 'Medium' : 'Large'"
          @click="look({ size: size.value })"
        >
          {{ size.label }}
        </button>
        <span class="mx-0.5 h-4 w-px bg-border-strong" />
        <button
          v-for="ink in inks"
          :key="ink.value"
          type="button"
          :title="ink.name"
          :aria-pressed="item.color === ink.value"
          class="grid size-6 cursor-pointer place-items-center rounded-full"
          @click="look({ color: ink.value })"
        >
          <span
            class="block rounded-full"
            :class="item.color === ink.value ? 'size-3.5 ring-2 ring-offset-1 ring-offset-surface' : 'size-3'"
            :style="{ backgroundColor: ink.value, color: ink.value }"
          />
        </button>
        <span class="mx-0.5 h-4 w-px bg-border-strong" />
        <button
          type="button"
          title="Bold"
          :aria-pressed="item.weight === 'bold'"
          :class="[
            'grid size-7 cursor-pointer place-items-center rounded-full text-[12.5px] font-bold',
            item.weight === 'bold' ? 'bg-chip text-lime' : 'text-text-soft hover:bg-surface-mute',
          ]"
          @click="look({ weight: item.weight === 'bold' ? 'normal' : 'bold' })"
        >
          B
        </button>
        <button
          type="button"
          title="Paper backing"
          :aria-pressed="!!item.background"
          :class="[
            'grid size-7 cursor-pointer place-items-center rounded-full',
            item.background ? 'bg-chip text-lime' : 'text-text-soft hover:bg-surface-mute',
          ]"
          @click="look({ background: !item.background })"
        >
          <span class="block h-3 w-4 rounded-[2px] border border-current bg-surface" />
        </button>
        <span class="mx-0.5 h-4 w-px bg-border-strong" />
        <button
          type="button"
          title="Remove"
          aria-label="Remove"
          class="grid size-7 cursor-pointer place-items-center rounded-full text-text-faint hover:bg-danger-soft hover:text-danger"
          @click="removeCurrent()"
        >
          <UiIcon
            name="trash"
            :size="13"
          />
        </button>
        <button
          type="button"
          title="Done"
          aria-label="Done"
          class="grid size-7 cursor-pointer place-items-center rounded-full text-brand hover:bg-brand-soft"
          @click="done()"
        >
          <UiIcon
            name="check"
            :size="14"
            :stroke="2.2"
          />
        </button>
      </div>

      <textarea
        v-if="editing === item.id"
        ref="area"
        :data-label="item.id"
        :value="item.text"
        rows="1"
        placeholder="Type…"
        :class="['label-text label-area', item.background && 'has-paper']"
        :style="{
          color: item.color,
          fontSize: `${fontPx(item.size, item.ref)}px`,
          fontWeight: item.weight === 'bold' ? 700 : 500,
        }"
        @input="onInput(item, $event)"
        @keydown="onAreaKeydown"
        @blur="onAreaBlur"
        @pointerdown.stop
      />
      <div
        v-else
        :class="[
          'label-text',
          item.background && 'has-paper',
          placing && 'cursor-move',
          erasing && 'cursor-pointer',
        ]"
        :style="{
          color: item.color,
          fontSize: `${fontPx(item.size, item.ref)}px`,
          fontWeight: item.weight === 'bold' ? 700 : 500,
        }"
      >
        {{ item.text }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.label-text {
  display: block;
  line-height: 1.25;
  letter-spacing: -0.01em;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  padding: 0.1em 0.2em;
  border-radius: 0.3em;
  text-shadow:
    0 0 2px var(--color-surface),
    0 0 6px var(--color-surface);
}

.label-text.has-paper {
  background: color-mix(in oklab, var(--color-surface) 94%, transparent);
  border: 1px solid var(--color-border-strong);
  box-shadow: var(--shadow-card);
  text-shadow: none;
}

.label-area {
  min-width: 6ch;
  max-width: 100%;
  border: 1px dashed var(--cobalt);
  background: color-mix(in oklab, var(--color-surface) 92%, transparent);
  outline: none;
  resize: none;
  font-family: inherit;
  field-sizing: content;
}
</style>

<script setup lang="ts">
import type { BoardAnnotation, BoardLabel, Stroke, StrokePoint } from '~/types/api'
import { MAX_ANNOTATION_BYTES, MAX_STROKES, annotationBytes, newUuid } from '~/utils/markup'
import InkLayer from '~/components/markup/InkLayer.vue'
import TextLayer from '~/components/markup/TextLayer.vue'
import MarkupToolbar from '~/components/markup/MarkupToolbar.vue'

/**
 * MARKUP — a whiteboard: a blank sheet opened beside a lesson to work
 * something out on.
 *
 * It is a fixed sheet, not an infinite canvas. 1200 × 800 logical units,
 * scaled to whatever width the tab has, so a diagram drawn on a laptop is the
 * same diagram on a tablet rather than a corner of one. When the sheet runs
 * out, "Add space" makes it taller by a screen's worth — and re-normalises
 * every stroke to the new height, because points are stored 0..1 of the
 * sheet and a taller sheet would otherwise stretch the drawing down with it.
 *
 * The board owns its own tool and its own undo. The tool, because it opens
 * with the pen already in hand — a blank sheet you have to arm before it will
 * take a mark is a sheet that asks why you came. The undo, because the lesson
 * pane's Undo must not reach in here and erase a stroke the reader cannot
 * see; a board's history is a plain stack of what its strokes were.
 *
 * Fills its parent and scrolls on its own, so it can be a whole tab.
 */
const props = defineProps<{ annotation: BoardAnnotation }>()

const emit = defineEmits<{ update: [annotation: BoardAnnotation] }>()

const toast = useToast()
const { tool, color, size, armed, arm, disarm } = useMarkupTool()

const MAX_HEIGHT = 8000
const SPACE_STEP = 400

const frame = ref<HTMLElement | null>(null)
const scroller = ref<HTMLElement | null>(null)
const box = ref({ width: 0, height: 0 })

const strokes = computed(() => props.annotation.data.strokes)
const labels = computed<BoardLabel[]>(() => props.annotation.data.labels ?? [])
const logicalWidth = computed(() => props.annotation.anchor.logical_width)
const logicalHeight = computed(() => props.annotation.anchor.logical_height)
const canGrow = computed(() => logicalHeight.value < MAX_HEIGHT)

let observer: ResizeObserver | null = null

function measure(): void {
  const el = frame.value
  if (!el) return
  box.value = { width: el.clientWidth, height: el.clientHeight }
}

onMounted(() => {
  arm('pen')
  measure()
  if (frame.value) {
    observer = new ResizeObserver(measure)
    observer.observe(frame.value)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

/* -- History: what the strokes were, one step back each -------------------- */

const past = ref<Stroke[][]>([])
const future = ref<Stroke[][]>([])
const canUndo = computed(() => past.value.length > 0)
const canRedo = computed(() => future.value.length > 0)

function publish(next: Stroke[], anchor = props.annotation.anchor): void {
  emit('update', {
    ...props.annotation,
    anchor,
    data: { ...props.annotation.data, strokes: next },
  })
}

function commit(next: Stroke[]): void {
  past.value = [...past.value.slice(-99), strokes.value]
  future.value = []
  publish(next)
}

function undo(): void {
  const previous = past.value[past.value.length - 1]
  if (!previous) return
  past.value = past.value.slice(0, -1)
  future.value = [...future.value, strokes.value]
  publish(previous)
}

function redo(): void {
  const next = future.value[future.value.length - 1]
  if (!next) return
  future.value = future.value.slice(0, -1)
  past.value = [...past.value, strokes.value]
  publish(next)
}

function onAdd(stroke: Stroke): void {
  if (strokes.value.length >= MAX_STROKES) {
    toast.warn({
      title: 'This whiteboard is full',
      body: `A board holds up to ${MAX_STROKES} strokes. Erase some, or open another.`,
    })
    return
  }

  const next = [...strokes.value, stroke]
  const grown = { ...props.annotation, data: { ...props.annotation.data, strokes: next } }

  if (annotationBytes(grown) > MAX_ANNOTATION_BYTES) {
    toast.warn({
      title: 'This whiteboard is as large as it can be',
      body: 'Erase a few strokes, or open another board for the rest.',
    })
    return
  }

  commit(next)
}

function onErase(index: number): void {
  commit(strokes.value.filter((_, i) => i !== index))
}

/* -- Text ------------------------------------------------------------------- */

/*
 * Labels live inside the board record beside the strokes. They stay out of
 * the stroke history on purpose: undo is for a line that went wrong, and a
 * label has its own Done / Remove.
 */
function publishLabels(next: BoardLabel[]): void {
  emit('update', {
    ...props.annotation,
    data: { ...props.annotation.data, labels: next },
  })
}

function onPlaceLabel(x: number, y: number): void {
  publishLabels([
    ...labels.value,
    { id: newUuid(), x, y, text: '', color: color.value, size: 'md' },
  ])
}

function onUpdateLabel(item: BoardLabel): void {
  publishLabels(labels.value.map((label) => (label.id === item.id ? { ...label, ...item } : label)))
}

function onRemoveLabel(id: string): void {
  publishLabels(labels.value.filter((label) => label.id !== id))
}

/* -- More room ------------------------------------------------------------- */

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

function rescaled(list: Stroke[], ratio: number): Stroke[] {
  return list.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point): StrokePoint =>
      point.length === 3
        ? [point[0], round4(point[1] * ratio), point[2]]
        : [point[0], round4(point[1] * ratio)],
    ),
  }))
}

function addSpace(): void {
  const before = logicalHeight.value
  const after = Math.min(MAX_HEIGHT, before + SPACE_STEP)
  if (after === before) return

  const ratio = before / after

  // History has to move with the sheet, or an undo after growing it would
  // put back strokes normalised to a height that no longer exists.
  past.value = past.value.map((list) => rescaled(list, ratio))
  future.value = future.value.map((list) => rescaled(list, ratio))

  publish(rescaled(strokes.value, ratio), { ...props.annotation.anchor, logical_height: after })

  void nextTick(() => {
    scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' })
  })
}
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col bg-surface-sunken">
    <div
      ref="scroller"
      class="om-scroll min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-24 sm:px-6"
    >
      <div
        ref="frame"
        class="board relative mx-auto w-full max-w-[1200px] overflow-hidden rounded-[18px] bg-surface shadow-[0_0_0_1px_var(--border),0_24px_50px_-30px_rgb(11_13_16/0.3)]"
        :style="{ aspectRatio: `${logicalWidth} / ${logicalHeight}` }"
      >
        <InkLayer
          v-if="box.width > 0"
          class="absolute inset-0"
          :strokes="strokes"
          :tool="tool"
          :color="color"
          :size="size"
          :armed="armed"
          :box="box"
          @add="onAdd"
          @erase="onErase"
        />
        <TextLayer
          :items="labels"
          :tool="tool"
          :armed="armed"
          :color="color"
          :box="box"
          :reference-width="logicalWidth"
          editable
          class="z-10"
          @place="onPlaceLabel"
          @update="onUpdateLabel"
          @remove="onRemoveLabel"
        />
      </div>

      <div class="mx-auto mt-3 flex w-full max-w-[1200px] justify-end">
        <UiBtn
          variant="ghost"
          size="sm"
          icon="plus"
          :disabled="!canGrow"
          @click="addSpace"
        >
          Add space
        </UiBtn>
      </div>
    </div>

    <MarkupToolbar
      :tool="tool"
      :color="color"
      :size="size"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :tools="['pen', 'marker', 'arrow', 'text', 'eraser']"
      @update:tool="tool = $event"
      @update:color="color = $event"
      @update:size="size = $event"
      @undo="undo"
      @redo="redo"
      @done="disarm"
    />
  </div>
</template>

<style scoped>
/* A faint dot grid: enough to line a sketch up against, too light to read as a table. */
.board {
  background-image: radial-gradient(var(--border-dashed) 0.9px, transparent 1px);
  background-size: 24px 24px;
  background-position: 12px 12px;
}
</style>

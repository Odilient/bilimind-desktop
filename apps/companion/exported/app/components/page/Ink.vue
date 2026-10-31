<script setup lang="ts">
import type { MarkupTool, Stroke } from '~/types/api'
import type { MarkupSize } from '~/utils/markup'
import { newUuid } from '~/utils/markup'
import InkLayer from '~/components/markup/InkLayer.vue'
import TextLayer, { type LabelItem } from '~/components/markup/TextLayer.vue'
import {
  labelFromBox,
  labelToBox,
  strokeFromBox,
  strokeToBox,
  type NoteInk,
  type NoteLabel,
} from '~/companion/doc/ink'

/**
 * The lesson's drawing surface, laid over a whole note: the same `InkLayer`
 * and `TextLayer` a lesson puts over each of its parts, here once over the
 * page column (title, details and text), so a circle round a word or an
 * arrow into the margin lands where it was drawn.
 *
 * It takes the pointer only while the tray has a drawing tool, the Text tool
 * or the eraser armed; the rest of the time the note underneath is typed in
 * and clicked as if this weren't here. Labels stay clickable, to reopen them.
 *
 * Storage is `useNoteInk`'s (inside the note's Y.Doc). This measures the
 * column and converts between the note's own frame and the layers' 0..1 box.
 * A label just placed lives here as a draft until its first word, as a
 * lesson's does, so an empty click leaves nothing behind.
 */
const props = defineProps<{
  ink: NoteInk
  tool: MarkupTool | null
  color: string
  size: MarkupSize
  armed: boolean
}>()

const root = ref<HTMLElement | null>(null)
const box = shallowRef({ width: 0, height: 0 })
let ro: ResizeObserver | null = null

onMounted(() => {
  const el = root.value
  if (!el) return
  const measure = () => {
    const width = el.offsetWidth
    const height = el.offsetHeight
    if (width !== box.value.width || height !== box.value.height) box.value = { width, height }
  }
  measure()
  ro = new ResizeObserver(measure)
  ro.observe(el)
})

onBeforeUnmount(() => ro?.disconnect())

/* Converted once per change of the strokes or the box, so the layer's
   per-stroke cache holds while a new stroke is being drawn. */
const strokes = computed(() =>
  props.ink.strokes.value.map((s) => strokeToBox(s, box.value.width, box.value.height)),
)

function add(stroke: Stroke): void {
  props.ink.add(strokeFromBox(stroke, box.value.width, box.value.height))
}

/* -- Labels ------------------------------------------------------------------ */

const draft = ref<NoteLabel | null>(null)

const labels = computed<LabelItem[]>(() => {
  const { width, height } = box.value
  const saved = props.ink.labels.value.map((l) => labelToBox(l, width, height))
  return draft.value ? [...saved, labelToBox(draft.value, width, height)] : saved
})

function place(x: number, y: number): void {
  const { width, height } = box.value
  draft.value = labelFromBox<NoteLabel>(
    { id: newUuid(), x: Math.round(x * 10_000) / 10_000, y, text: '', color: props.color, size: 'md', ref: Math.round(width) },
    width,
    height,
  )
}

function update(item: LabelItem): void {
  const { width, height } = box.value
  const label = labelFromBox(item, width, height) as NoteLabel
  if (draft.value?.id === label.id) {
    // Not kept until it says something.
    if (!label.text.trim()) {
      draft.value = label
      return
    }
    draft.value = null
  }
  props.ink.setLabel(label)
}

function remove(id: string): void {
  if (draft.value?.id === id) draft.value = null
  else props.ink.removeLabel(id)
}

/* Putting the Text tool down drops a label that was never written in. */
watch(
  () => props.armed && props.tool === 'text',
  (on) => {
    if (!on && draft.value && !draft.value.text.trim()) draft.value = null
  },
)
</script>

<template>
  <div
    ref="root"
    class="pg-ink"
  >
    <InkLayer
      v-if="box.width > 0"
      :strokes="strokes"
      :tool="tool"
      :color="color"
      :size="size"
      :armed="armed"
      :box="box"
      @add="add"
      @erase="ink.erase"
    />
    <TextLayer
      v-if="box.width > 0"
      :items="labels"
      :tool="tool"
      :armed="armed"
      :color="color"
      :box="box"
      :reference-width="box.width"
      editable
      @place="place"
      @update="update"
      @remove="remove"
    />
  </div>
</template>

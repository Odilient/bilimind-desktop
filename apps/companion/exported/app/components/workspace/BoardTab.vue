<script setup lang="ts">
import type { BoardAnnotation } from '~/types/api'
import MarkupWhiteboard from '~/components/markup/Whiteboard.vue'

/**
 * A whiteboard opened as a workspace tab.
 *
 * The board is one of the reader's private marks on a lesson, so this pane
 * owns its own copy of that lesson's marks and saves through it. The lesson
 * pane that opened the board hands over the freshly created record as
 * `initial`, which is what is drawn on until the server copy arrives — a board
 * made a second ago may not be in the first fetch yet, and a blank tab while
 * it lands would read as "it did not work".
 */
const props = defineProps<{
  nodeId: number
  uuid: string
  initial?: BoardAnnotation | null
}>()

const marks = useAnnotations(() => props.nodeId)

const local = ref<BoardAnnotation | null>(props.initial ?? null)

const board = computed<BoardAnnotation | null>(
  () => marks.boards.value.find((item) => item.uuid === props.uuid) ?? local.value,
)

function update(annotation: BoardAnnotation): void {
  local.value = annotation
  void marks.upsert(annotation)
}

onMounted(() => {
  void marks.load()
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <MarkupWhiteboard
      v-if="board"
      :annotation="board"
      class="min-h-0 flex-1"
      @update="update"
    />
    <UiEmptyState
      v-else-if="marks.loaded.value"
      icon="alert"
      title="This whiteboard is gone"
      description="It was removed, or it belongs to a lesson you can no longer open."
      class="mx-auto max-w-[420px] px-8 py-24"
    />
    <div
      v-else
      class="grid flex-1 place-items-center text-[13px] text-text-faint"
    >
      Opening the whiteboard…
    </div>
  </div>
</template>

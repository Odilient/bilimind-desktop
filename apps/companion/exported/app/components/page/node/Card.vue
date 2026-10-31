<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import type { Card } from '~/companion/types'
import { usePageEnv } from '~/companion/doc/editor/env'
import { findCard, reviewLabel, saveCard } from '~/companion/doc/cards'
import { autosize } from '~/companion/doc/editor/viewport'

/**
 * A flashcard written into the notes. The question and answer live in the
 * page; the `cards` row it keeps in step holds the FSRS schedule, which is
 * where "next review Fri" comes from. It's saved once both sides say
 * something, and only the first save sets the schedule.
 */
const props = defineProps(nodeViewProps)
const env = usePageEnv()

const front = ref(String(props.node.attrs.front ?? ''))
const back = ref(String(props.node.attrs.back ?? ''))
/** The row as last fetched; the store's copy wins once it has one (a review moves `due_at`). */
const fetched = ref<Card | null>(null)
/** Whether we know if the row exists. Until then a save must not start a new schedule. */
const known = ref(false)
const saving = ref(false)
const failed = ref(false)
const frontEl = ref<HTMLTextAreaElement | null>(null)
const backEl = ref<HTMLTextAreaElement | null>(null)

const cardId = computed(() => (props.node.attrs.card_id as string | null) ?? null)
const row = computed(() => (cardId.value ? env.store.get('cards', cardId.value) : null) ?? fetched.value)
const complete = computed(() => front.value.trim() !== '' && back.value.trim() !== '')

const status = computed(() => {
  if (failed.value) return 'not saved yet'
  if (saving.value && !row.value) return 'saving'
  if (row.value) return `next review ${reviewLabel(row.value.due_at)}`
  return complete.value ? 'saving' : 'needs both sides'
})

// Someone else (or another tab) edited the card: follow, unless we're typing.
watch(
  () => [props.node.attrs.front, props.node.attrs.back] as const,
  ([f, b]) => {
    if (document.activeElement !== frontEl.value) front.value = String(f ?? '')
    if (document.activeElement !== backEl.value) back.value = String(b ?? '')
  },
)

function write(side: 'front' | 'back', value: string): void {
  if (side === 'front') front.value = value
  else back.value = value
  props.updateAttributes({ [side]: value })
  schedule()
}

let timer: ReturnType<typeof setTimeout> | null = null
let lastSaved = ''

async function lookUp(id: string): Promise<void> {
  const found = await findCard(env.store, env.repo, id)
  if (!found.known) return
  known.value = true
  fetched.value = found.row
  if (found.row) lastSaved = `${found.row.front}\u0000${found.row.back}`
}

function schedule(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void persist(), 700)
}

async function persist(): Promise<void> {
  if (!complete.value) return
  // Cards are made with an id (slash menu, "Make a card", templates). One
  // pasted in without one gets it here, on its first save. Never on mount:
  // a transaction sent while the view is still drawing, or before the
  // collaboration binding's first render, is lost.
  let id = cardId.value
  if (!id) {
    id = crypto.randomUUID()
    props.updateAttributes({ card_id: id })
    known.value = true
  }
  if (!known.value) await lookUp(id)
  if (!known.value) {
    // Offline and the row unknown: wait for the next edit rather than guess.
    failed.value = true
    return
  }
  const words = `${front.value}\u0000${back.value}`
  if (words === lastSaved) return
  saving.value = true
  try {
    const saved = await saveCard(
      env.store,
      env.page.value,
      { id, front: front.value.trim(), back: back.value.trim(), quote: props.node.attrs.quote ?? null },
      !row.value,
    )
    if (saved) fetched.value = { ...(fetched.value ?? ({} as Card)), ...saved }
    lastSaved = words
    failed.value = false
  } catch {
    failed.value = true
  } finally {
    saving.value = false
  }
}

watch([front, back], () => nextTick(() => {
  autosize(frontEl.value)
  autosize(backEl.value)
}))

onMounted(async () => {
  autosize(frontEl.value)
  autosize(backEl.value)
  // A card just made (from "/", or from a selection with no question in it)
  // starts with the cursor in its question. The editor focuses itself a frame
  // after inserting, so this waits a frame more, or the editor takes focus
  // back and the next key replaces the card. Opening a page never moves focus.
  if (!front.value && props.editor.isEditable && props.editor.isFocused) {
    requestAnimationFrame(() => setTimeout(() => frontEl.value?.focus(), 0))
  }
  if (cardId.value) await lookUp(cardId.value)
  if (complete.value) await persist()
})

onBeforeUnmount(() => {
  if (timer) {
    clearTimeout(timer)
    void persist()
  }
})
</script>

<template>
  <NodeViewWrapper
    class="pg-card"
  >
    <span
      class="pg-kind"
      contenteditable="false"
      data-drag-handle
    >Card</span>
    <div class="pg-card-sides">
      <textarea
        ref="frontEl"
        :value="front"
        class="pg-card-front"
        rows="1"
        placeholder="Question, or the word"
        aria-label="Front of the card"
        :readonly="!editor.isEditable"
        @input="write('front', ($event.target as HTMLTextAreaElement).value)"
      />
      <textarea
        ref="backEl"
        :value="back"
        class="pg-card-back"
        rows="1"
        placeholder="Answer"
        aria-label="Back of the card"
        :readonly="!editor.isEditable"
        @input="write('back', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>
    <span
      class="pg-pill"
      :class="{ 'is-warn': failed }"
      contenteditable="false"
    >{{ status }}</span>
  </NodeViewWrapper>
</template>

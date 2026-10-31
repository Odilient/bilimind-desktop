<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { splitForCard } from '~/companion/doc/cards'
import { useAi } from '~/companion/ai/state'
import { useQuietAi } from '~/companion/quiet-ai'

/**
 * What a selection can become: bold, italic, code, a link, a highlight, or a
 * flashcard. "Make a card" turns "Atomicity: all or nothing" into a card with
 * that front and back, placed right under the paragraph it came from.
 */
const props = defineProps<{ editor: Editor }>()

const linking = ref(false)
const href = ref('')
const input = ref<HTMLInputElement | null>(null)

const marks = [
  { name: 'bold', label: 'Bold', glyph: 'B', run: () => props.editor.chain().focus().toggleBold().run() },
  { name: 'italic', label: 'Italic', glyph: 'I', run: () => props.editor.chain().focus().toggleItalic().run() },
  { name: 'code', label: 'Code', glyph: '</>', run: () => props.editor.chain().focus().toggleCode().run() },
] as const

function startLink(): void {
  href.value = String(props.editor.getAttributes('link').href ?? '')
  linking.value = true
  nextTick(() => input.value?.focus())
}

function applyLink(): void {
  const url = href.value.trim()
  const chain = props.editor.chain().focus().extendMarkRange('link')
  if (!url) chain.unsetLink().run()
  else chain.setLink({ href: /^[a-z]+:/i.test(url) ? url : `https://${url}` }).run()
  linking.value = false
}

function makeCard(): void {
  const { state } = props.editor
  const { from, to } = state.selection
  const text = state.doc.textBetween(from, to, ' ').trim()
  if (!text) return
  const { front, back } = splitForCard(text)
  const $to = state.doc.resolve(to)
  const after = $to.depth >= 1 ? $to.after(1) : to
  props.editor
    .chain()
    .focus()
    .insertContentAt(after, { type: 'card', attrs: { card_id: crypto.randomUUID(), front, back, quote: text } })
    .run()
}

/*
 * "Ask": the selection goes to the companion as a quote chip. Only under
 * `/app`, where the companion lives, and never with Quiet AI on.
 */
const route = useRoute()
const { quiet } = useQuietAi()
const canAsk = computed(() => route.path.startsWith('/app') && !quiet.value)

function ask(): void {
  const { state } = props.editor
  const { from, to } = state.selection
  const text = state.doc.textBetween(from, to, ' ').trim()
  if (text) useAi().show({ quote: text })
}

watch(
  () => props.editor.state.selection,
  () => {
    linking.value = false
  },
)
</script>

<template>
  <div
    class="pg-bubble"
    role="toolbar"
    aria-label="Format the selection"
  >
    <template v-if="!linking">
      <button
        v-for="m in marks"
        :key="m.name"
        type="button"
        class="pg-bubble-btn"
        :class="[{ on: editor.isActive(m.name) }, `is-${m.name}`]"
        :aria-label="m.label"
        :aria-pressed="editor.isActive(m.name)"
        @click="m.run()"
      >
        {{ m.glyph }}
      </button>
      <button
        type="button"
        class="pg-bubble-btn"
        :class="{ on: editor.isActive('link') }"
        aria-label="Link"
        @click="startLink"
      >
        <UiIcon
          name="link"
          :size="14"
        />
      </button>
      <button
        type="button"
        class="pg-bubble-btn"
        :class="{ on: editor.isActive('highlight') }"
        aria-label="Highlight"
        :aria-pressed="editor.isActive('highlight')"
        @click="editor.chain().focus().toggleHighlight().run()"
      >
        <PageIcon
          name="highlight"
          :size="14"
        />
      </button>
      <span
        class="pg-bubble-sep"
        aria-hidden="true"
      />
      <button
        type="button"
        class="pg-bubble-btn is-card"
        @click="makeCard"
      >
        <PageIcon
          name="make-card"
          :size="14"
        />
        Make a card
      </button>
      <button
        v-if="canAsk"
        type="button"
        class="pg-bubble-btn"
        title="Ask BiliMind about this"
        @click="ask"
      >
        <UiIcon
          name="spark"
          :size="12"
          class="text-lime"
        />
        Ask
      </button>
    </template>
    <form
      v-else
      class="pg-bubble-link"
      @submit.prevent="applyLink"
    >
      <input
        ref="input"
        v-model="href"
        placeholder="Paste a link"
        aria-label="Link address"
        @keydown.esc.prevent="linking = false"
      >
      <button
        type="submit"
        class="pg-bubble-btn"
      >
        {{ href.trim() ? 'Apply' : 'Remove' }}
      </button>
    </form>
  </div>
</template>

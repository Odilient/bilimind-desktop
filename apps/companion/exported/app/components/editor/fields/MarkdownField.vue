<script setup lang="ts">
import Markdown from '~/components/blocks/Markdown.vue'
import { GHOST, INPUT } from './classes'

/**
 * A markdown source box with the four things a person reaches for — bold,
 * italic, a list, a link — and a preview through the same renderer the lesson
 * uses, so what they see is exactly what readers will.
 *
 * Source, not a rich-text editor: the renderer (`useMarkdown`) escapes
 * everything and emits only its own tags, which is what keeps model-written
 * and person-written prose equally safe. A contenteditable would have to
 * round-trip HTML back into that grammar, and lose on every edge.
 */
const props = defineProps<{
  id?: string
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const area = ref<HTMLTextAreaElement | null>(null)
const preview = ref(false)

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}

/** Wrap the selection (or a placeholder) and keep it selected. */
function wrap(before: string, after = before, placeholder = 'text'): void {
  const el = area.value
  if (!el) return

  const start = el.selectionStart
  const end = el.selectionEnd
  const value = props.modelValue
  const selected = value.slice(start, end) || placeholder

  emit('update:modelValue', value.slice(0, start) + before + selected + after + value.slice(end))

  void nextTick(() => {
    el.focus()
    el.setSelectionRange(start + before.length, start + before.length + selected.length)
  })
}

/** Put a prefix on every line the selection touches. */
function prefixLines(prefix: string): void {
  const el = area.value
  if (!el) return

  const value = props.modelValue
  const from = value.lastIndexOf('\n', el.selectionStart - 1) + 1
  const toBreak = value.indexOf('\n', el.selectionEnd)
  const to = toBreak === -1 ? value.length : toBreak

  const lines = value
    .slice(from, to)
    .split('\n')
    .map((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : prefix + line))
    .join('\n')

  emit('update:modelValue', value.slice(0, from) + lines + value.slice(to))

  void nextTick(() => {
    el.focus()
    el.setSelectionRange(from, from + lines.length)
  })
}

const tools = [
  { label: 'B', title: 'Bold', className: 'font-bold', run: () => wrap('**') },
  { label: 'I', title: 'Italic', className: 'italic', run: () => wrap('_') },
  { label: 'H', title: 'Heading', className: 'font-semibold', run: () => prefixLines('## ') },
  { label: '•', title: 'Bulleted list', className: '', run: () => prefixLines('- ') },
  { label: '1.', title: 'Numbered list', className: '', run: () => prefixLines('1. ') },
  { label: '</>', title: 'Code', className: 'font-mono text-[11px]', run: () => wrap('`', '`', 'code') },
  { label: 'Link', title: 'Link', className: 'underline', run: () => wrap('[', '](https://)', 'link text') },
]
</script>

<template>
  <div class="overflow-hidden rounded-[10px] border border-border-field bg-surface focus-within:border-lime-2">
    <div class="flex items-center gap-0.5 border-b border-border bg-surface-chrome px-1.5 py-1">
      <button
        v-for="tool in tools"
        :key="tool.title"
        type="button"
        :title="tool.title"
        :aria-label="tool.title"
        :disabled="preview"
        :class="[GHOST, 'min-w-7 justify-center px-1.5', tool.className]"
        @mousedown.prevent
        @click="tool.run"
      >
        {{ tool.label }}
      </button>

      <span class="flex-1" />

      <button
        type="button"
        :class="[GHOST, preview && 'bg-surface-sunken text-text-dim']"
        :aria-pressed="preview"
        @click="preview = !preview"
      >
        {{ preview ? 'Edit' : 'Preview' }}
      </button>
    </div>

    <div
      v-if="preview"
      class="min-h-[6rem] px-3.5 py-3"
    >
      <Markdown
        v-if="modelValue.trim()"
        :source="modelValue"
        size="sm"
      />
      <p
        v-else
        class="text-[13px] text-text-faint italic"
      >
        Nothing to show yet.
      </p>
    </div>

    <textarea
      v-else
      :id="id"
      ref="area"
      :value="modelValue"
      :placeholder="placeholder ?? 'Write in plain text. **bold**, _italic_, - lists, [links](https://…)'"
      :class="[INPUT, 'grow rounded-none border-0 focus:border-0']"
      rows="5"
      @input="onInput"
    />
  </div>
</template>

<style scoped>
textarea.grow {
  field-sizing: content;
  min-height: 7rem;
  max-height: 70vh;
  resize: vertical;
}
</style>

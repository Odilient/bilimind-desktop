<script setup lang="ts">
import type * as Y from 'yjs'
import { autosize } from '~/companion/doc/editor/viewport'

/**
 * The page's title, kept in the Y.Doc so it merges like the body does and is
 * there offline. Typing sends only what changed (the shared prefix and suffix
 * are left alone), so two people renaming at once don't erase each other.
 */
const props = defineProps<{ text: Y.Text; readonly?: boolean }>()
const emit = defineEmits<{ enter: [] }>()

const value = ref(props.text.toString())
const el = ref<HTMLTextAreaElement | null>(null)

function sync(): void {
  const next = props.text.toString()
  if (next !== value.value) {
    value.value = next
    nextTick(() => autosize(el.value))
  }
}

function apply(next: string): void {
  const prev = props.text.toString()
  let start = 0
  while (start < prev.length && start < next.length && prev[start] === next[start]) start++
  let end = 0
  while (
    end < prev.length - start &&
    end < next.length - start &&
    prev[prev.length - 1 - end] === next[next.length - 1 - end]
  ) end++
  const removed = prev.length - start - end
  const inserted = next.slice(start, next.length - end)
  props.text.doc?.transact(() => {
    if (removed > 0) props.text.delete(start, removed)
    if (inserted) props.text.insert(start, inserted)
  })
}

function onInput(event: Event): void {
  // A title is one line: a pasted newline becomes a space.
  const next = (event.target as HTMLTextAreaElement).value.replace(/\n+/g, ' ')
  value.value = next
  apply(next)
  autosize(el.value)
}

onMounted(() => {
  props.text.observe(sync)
  autosize(el.value)
})
onBeforeUnmount(() => props.text.unobserve(sync))

defineExpose({ focus: () => el.value?.focus() })
</script>

<template>
  <textarea
    ref="el"
    :value="value"
    class="pg-title"
    rows="1"
    placeholder="Untitled"
    aria-label="Page title"
    :readonly="readonly"
    @input="onInput"
    @keydown.enter.prevent="emit('enter')"
  />
</template>

<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { usePageEnv } from '~/companion/doc/editor/env'

/**
 * A page or board nested in this one. The item row is the truth for its
 * title; the node keeps a copy so Markdown export and an offline open still
 * have something to say.
 */
const props = defineProps(nodeViewProps)
const env = usePageEnv()

const kind = computed<'page' | 'board'>(() => (props.node.attrs.kind === 'board' ? 'board' : 'page'))
const itemId = computed(() => (props.node.attrs.item_id as string | null) ?? null)
/** Live from the store: renaming the child page renames its link here. */
const live = computed(() => env.store.get('items', itemId.value)?.title ?? null)
const title = computed(() => live.value || String(props.node.attrs.title || '') || 'Untitled')

// Keep the copy in the node current, for Markdown export and offline opens.
watch(live, (value) => {
  if (value && value !== props.node.attrs.title && props.editor.isEditable) {
    setTimeout(() => props.updateAttributes({ title: value }))
  }
})

function open(): void {
  if (itemId.value) env.open({ id: itemId.value, kind: kind.value })
}
</script>

<template>
  <NodeViewWrapper
    class="pg-pagelink"
    contenteditable="false"
  >
    <button
      type="button"
      class="pg-pagelink-btn"
      data-drag-handle
      @click="open"
    >
      <PageIcon
        :name="kind"
        :size="16"
      />
      <span class="pg-pagelink-title">{{ title }}</span>
      <span class="pg-pagelink-kind">{{ kind === 'board' ? 'board' : 'page' }}</span>
      <UiIcon
        name="chevron-right"
        :size="14"
      />
    </button>
  </NodeViewWrapper>
</template>

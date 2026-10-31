<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { usePageEnv } from '~/companion/doc/editor/env'
import { useFileUrl } from '~/companion/doc/editor/fileUrl'

/** A file dropped into the notes: slides, a PDF, a dataset. */
const props = defineProps(nodeViewProps)
const env = usePageEnv()
const url = useFileUrl(env.store, () => props.node.attrs.item_id ?? null, () => props.node.attrs.url ?? null)

const size = computed(() => {
  const bytes = Number(props.node.attrs.size ?? 0)
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
})

const kind = computed(() => {
  const mime = String(props.node.attrs.mime ?? '')
  const name = String(props.node.attrs.name ?? '')
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'PDF'
  if (/presentation|powerpoint/.test(mime) || /\.(pptx?|key)$/.test(name)) return 'Slides'
  if (/sheet|excel|csv/.test(mime) || /\.(xlsx?|csv)$/.test(name)) return 'Sheet'
  return 'File'
})
</script>

<template>
  <NodeViewWrapper
    class="pg-file"
    contenteditable="false"
    data-drag-handle
  >
    <span class="pg-file-icon"><UiIcon
      name="file"
      :size="17"
    /></span>
    <span class="pg-file-text">
      <span class="pg-file-name">{{ node.attrs.name }}</span>
      <span class="pg-file-meta">{{ kind }}<template v-if="size"> · {{ size }}</template></span>
    </span>
    <a
      v-if="url"
      :href="url"
      :download="node.attrs.name"
      target="_blank"
      rel="noopener"
      class="pg-icon-btn"
      aria-label="Download"
    >
      <UiIcon
        name="download"
        :size="15"
      />
    </a>
  </NodeViewWrapper>
</template>

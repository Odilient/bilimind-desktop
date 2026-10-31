<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { usePageEnv } from '~/companion/doc/editor/env'
import { useFileUrl } from '~/companion/doc/editor/fileUrl'

/** An image or a photo of the whiteboard, stored as an item of its own. */
const props = defineProps(nodeViewProps)
const env = usePageEnv()
const src = useFileUrl(env.store, () => props.node.attrs.item_id ?? null, () => props.node.attrs.src ?? null)
const broken = ref(false)
watch(src, () => {
  broken.value = false
})
</script>

<template>
  <NodeViewWrapper
    class="pg-image"
    data-drag-handle
  >
    <img
      v-if="src && !broken"
      :src="src"
      :alt="node.attrs.alt || ''"
      loading="lazy"
      draggable="false"
      @error="broken = true"
    >
    <div
      v-else
      class="pg-image-missing"
    >
      <UiIcon
        name="image"
        :size="18"
      />
      <span>{{ node.attrs.alt || 'Image' }} isn't available offline</span>
    </div>
  </NodeViewWrapper>
</template>

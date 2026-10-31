<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { usePageEnv } from '~/companion/doc/editor/env'

/**
 * Where a line came from: "slides 18–20", or a second of the recording that
 * moves the player there when pressed. It never plays anything by itself.
 */
const props = defineProps(nodeViewProps)
const env = usePageEnv()

const seconds = computed(() => {
  const value = props.node.attrs.at_seconds
  return value == null || Number.isNaN(Number(value)) ? null : Number(value)
})

function seek(): void {
  if (seconds.value == null) return
  env.seek(props.node.attrs.item_id ?? null, seconds.value)
}
</script>

<template>
  <NodeViewWrapper
    as="span"
    class="pg-cite-wrap"
  >
    <button
      v-if="seconds != null"
      type="button"
      class="pg-cite"
      contenteditable="false"
      :aria-label="`Go to ${node.attrs.label} in the recording`"
      @click="seek"
    >
      <UiIcon
        name="play"
        :size="9"
        :stroke="2.4"
      />{{ node.attrs.label }}
    </button>
    <span
      v-else
      class="pg-cite is-static"
      contenteditable="false"
    >{{ node.attrs.label }}</span>
  </NodeViewWrapper>
</template>

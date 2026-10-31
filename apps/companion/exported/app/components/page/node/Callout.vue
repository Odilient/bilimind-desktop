<script setup lang="ts">
import { NodeViewContent, NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

/**
 * A callout: an icon and a few lines that stand out. The icon also sets the
 * tone (an exam hint is amber, a gap filled from the material is cobalt), and
 * clicking it steps to the next one.
 */
const props = defineProps(nodeViewProps)

const ICONS = ['bulb', 'flag', 'sparkles', 'alert', 'clock', 'pencil'] as const
const TONES: Record<string, string> = { flag: 'warn', clock: 'warn', sparkles: 'brand', alert: 'danger' }

const icon = computed(() => String(props.node.attrs.icon || 'bulb'))
const tone = computed(() => TONES[icon.value] ?? 'plain')

function cycle(): void {
  if (!props.editor.isEditable) return
  const i = ICONS.indexOf(icon.value as (typeof ICONS)[number])
  props.updateAttributes({ icon: ICONS[(i + 1) % ICONS.length] })
}
</script>

<template>
  <NodeViewWrapper
    class="pg-callout"
    :data-tone="tone"
  >
    <button
      type="button"
      class="pg-callout-icon"
      contenteditable="false"
      aria-label="Change the callout's icon"
      @click="cycle"
    >
      <PageIcon
        :name="icon"
        :size="15"
      />
    </button>
    <NodeViewContent class="pg-callout-body" />
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import type { NodeStatus } from '~/types/api'

/**
 * The 8px dot that carries a node's state everywhere it appears.
 * See `useNodeStatus` for what each colour claims.
 */
const props = withDefaults(
  defineProps<{
    status: NodeStatus | null | undefined
    size?: number
    /** Suppress the pulse where motion would be noisy, e.g. a long list. */
    still?: boolean
  }>(),
  { size: 8 },
)

const style = computed(() => nodeStatusStyle(props.status))
</script>

<template>
  <span
    :class="['block shrink-0 rounded-full', style.dot, style.pulsing && !still && 'animate-pulse-dot']"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :title="style.label"
  />
</template>

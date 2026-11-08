<script setup lang="ts">
/**
 * A card's column as a tracker draws it, so its state reads at a glance:
 * an empty ring is to do, a half-filled one is started, a filled check is
 * done (adgen-new's to-do, after Linear). Drawn in the text's colour, so
 * the host sets the tint.
 */
import type { TaskColumn } from '~/companion/tasks'

withDefaults(defineProps<{ s: TaskColumn; size?: number }>(), { size: 15 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 14 14"
    aria-hidden="true"
    :class="[
      'block shrink-0',
      s === 'todo' ? 'text-text-faint' : s === 'doing' ? 'text-butter-ink' : 'text-leaf',
    ]"
  >
    <circle
      v-if="s === 'todo'"
      cx="7"
      cy="7"
      r="6"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
    />
    <template v-else-if="s === 'doing'">
      <circle
        cx="7"
        cy="7"
        r="6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      />
      <path
        d="M7 3.4a3.6 3.6 0 0 1 0 7.2z"
        fill="currentColor"
      />
    </template>
    <template v-else>
      <circle
        cx="7"
        cy="7"
        r="6.75"
        fill="currentColor"
      />
      <path
        d="m4.3 7.2 1.9 1.85L9.8 5.3"
        fill="none"
        stroke="var(--surface)"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>
  </svg>
</template>

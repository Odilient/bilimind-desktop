<script setup lang="ts">
/**
 * Priority the way trackers draw it: three dashes for none, signal bars for
 * low to high, a filled "!" square for urgent (adgen-new's to-do).
 */
import type { Priority } from '~/companion/types'

withDefaults(defineProps<{ p?: Priority; size?: number }>(), { p: 0, size: 14 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 14 14"
    aria-hidden="true"
    :class="['block shrink-0', p === 4 ? 'text-danger' : p ? 'text-text-soft' : 'text-text-ghost']"
  >
    <template v-if="p === 4">
      <rect
        x="1"
        y="1"
        width="12"
        height="12"
        rx="3"
        fill="currentColor"
      />
      <path
        d="M7 3.7v4.1"
        stroke="var(--surface)"
        stroke-width="1.7"
        stroke-linecap="round"
      />
      <circle
        cx="7"
        cy="10.2"
        r="0.95"
        fill="var(--surface)"
      />
    </template>
    <template v-else-if="p">
      <rect
        x="1.5"
        y="8.2"
        width="2.6"
        height="4.3"
        rx="0.8"
        fill="currentColor"
      />
      <rect
        x="5.7"
        y="5.2"
        width="2.6"
        height="7.3"
        rx="0.8"
        fill="currentColor"
        :opacity="p >= 2 ? 1 : 0.28"
      />
      <rect
        x="9.9"
        y="2"
        width="2.6"
        height="10.5"
        rx="0.8"
        fill="currentColor"
        :opacity="p >= 3 ? 1 : 0.28"
      />
    </template>
    <template v-else>
      <rect
        v-for="x in [1.4, 5.7, 10]"
        :key="x"
        :x="x"
        y="6.3"
        width="2.6"
        height="1.4"
        rx="0.7"
        fill="currentColor"
      />
    </template>
  </svg>
</template>

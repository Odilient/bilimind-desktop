<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** CSS width, e.g. `100%`, `8rem`, `120px`. */
    w?: string
    /** CSS height. */
    h?: string
    rounded?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
    /** Render N stacked bars with a ragged last line. */
    lines?: number
  }>(),
  { w: '100%', h: '0.75rem', rounded: 'sm' },
)

const radii: Record<NonNullable<typeof props.rounded>, string> = {
  xs: 'rounded-xs',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
}

const count = computed(() => Math.max(1, props.lines ?? 1))
</script>

<template>
  <div
    v-if="count > 1"
    class="flex flex-col gap-2"
    aria-hidden="true"
  >
    <span
      v-for="i in count"
      :key="i"
      :class="['animate-shimmer block bg-surface-track', radii[rounded]]"
      :style="{ width: i === count ? '62%' : w, height: h, animationDelay: `${i * 90}ms` }"
    />
  </div>
  <span
    v-else
    :class="['animate-shimmer block bg-surface-track', radii[rounded]]"
    :style="{ width: w, height: h }"
    aria-hidden="true"
  />
</template>

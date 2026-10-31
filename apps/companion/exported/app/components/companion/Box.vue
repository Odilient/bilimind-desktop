<script setup lang="ts">
/**
 * A section of a page: a heading in the display face, an optional aside on
 * its right (a figure, or a link through the `aside` slot), then the content.
 * It used to be a white card with a small uppercase label, and a page of them
 * read as a dashboard of boxes; now the heading and the space around it do
 * the grouping, and a list inside sets its own hairlines.
 */
defineProps<{ label?: string; aside?: string; tag?: string }>()
</script>

<template>
  <component
    :is="tag ?? 'section'"
    class="grid content-start gap-2"
  >
    <header
      v-if="label || aside || $slots.aside"
      class="flex items-baseline justify-between gap-3"
    >
      <h2
        v-if="label"
        class="t-head text-[19px]"
      >
        {{ label }}
      </h2>
      <slot name="aside">
        <span
          v-if="aside"
          class="text-[14px] font-medium text-text-muted"
        >{{ aside }}</span>
      </slot>
    </header>
    <slot />
  </component>
</template>

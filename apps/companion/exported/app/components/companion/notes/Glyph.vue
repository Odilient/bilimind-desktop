<script setup lang="ts">
/**
 * The two glyphs Notes needs that neither `UiIcon` nor `CompanionIcon` draws
 * (a pin, and "move to"), in the same 24px stroke hand. Any other name falls
 * through to `CompanionIcon`, and from there to `UiIcon`, so a menu names
 * its icons from one vocabulary.
 */
const props = withDefaults(defineProps<{ name: string; size?: number; stroke?: number }>(), {
  size: 16,
  stroke: 1.8,
})

const extra: Record<string, string> = {
  pin: '<path d="M9 3.5h6l-.8 5.2 3.3 3.3v1.5H6.5V12l3.3-3.3Z"/><path d="M12 13.5V21"/>',
  move: '<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z"/><path d="M10 13.5h5.5M13.5 11l2.2 2.5-2.2 2.5"/>',
}

const own = computed(() => extra[props.name])
</script>

<template>
  <svg
    v-if="own"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="own"
  />
  <CompanionIcon
    v-else
    :name="name"
    :size="size"
    :stroke="stroke"
  />
</template>

<script setup lang="ts">
/**
 * The page editor's glyphs: block types (headings, lists, toggle, quote,
 * divider, math), the learning blocks, and the phone toolbar. Same 24px grid
 * and stroke as `UiIcon`; anything not drawn here falls through to it, so the
 * app keeps one visual vocabulary.
 */
const props = withDefaults(defineProps<{ name: string; size?: number | string }>(), { size: 16 })

const own: Record<string, string> = {
  text: '<path d="M5 6.5V5h14v1.5M12 5v14M9.5 19h5"/>',
  h1: '<path d="M4 6v12M12 6v12M4 12h8"/><path d="M16.5 9.5 19 8v10"/>',
  h2: '<path d="M3.5 6v12M11 6v12M3.5 12H11"/><path d="M14.5 10a2.6 2.6 0 0 1 5 1c0 2.2-5 4.2-5 7h5.2"/>',
  h3: '<path d="M3.5 6v12M11 6v12M3.5 12H11"/><path d="M14.6 8.6a2.4 2.4 0 0 1 4.6.9 2.3 2.3 0 0 1-2.4 2.3 2.4 2.4 0 1 1-2.4 3.6"/>',
  bullets: '<circle cx="5" cy="7" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="17" r="1"/><path d="M9.5 7H20M9.5 12H20M9.5 17H20"/>',
  numbers: '<path d="M4 5.5 5.5 4.8V10M4 10h3M4 14.4a1.5 1.5 0 0 1 2.8.5c0 1.3-2.8 2-2.8 3.6h3"/><path d="M10.5 7H20M10.5 12H20M10.5 17H20"/>',
  todo: '<rect x="3.5" y="4.5" width="6" height="6" rx="1.5"/><path d="m4.8 15.7 1.6 1.6 2.9-3.1"/><path d="M13 7.5h7.5M13 16h7.5"/>',
  toggle: '<path d="m5 6.5 3 2.5-3 2.5"/><path d="M11.5 9H20M8 15h12M8 19h9"/>',
  quote: '<path d="M5 5v14"/><path d="M9.5 8H19M9.5 12H19M9.5 16h6"/>',
  divider: '<path d="M3.5 12h17"/><path d="M7 7.5h10M7 16.5h10" opacity=".35"/>',
  math: '<path d="M18 5H7l5.5 7L7 19h11"/>',
  question: '<path d="M9.1 9a3 3 0 1 1 4.3 2.7c-.9.5-1.4 1.2-1.4 2.2v.6"/><path d="M12 18h.01"/>',
  page: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>',
  board: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21l4-4 4 4"/><path d="M7 13.5l3-3 2.2 2.2L16 9"/>',
  camera: '<path d="M4.5 7.5h3l1.6-2.2h5.8l1.6 2.2h3a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V9a1.5 1.5 0 0 1 1.5-1.5Z"/><circle cx="12" cy="13" r="3.4"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4.5h11.5l-2.4 4 2.4 4H5"/>',
  card: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="m8.4 12.2 2.4 2.4 4.8-5"/>',
  grip: '<circle cx="9" cy="6" r="1.1"/><circle cx="15" cy="6" r="1.1"/><circle cx="9" cy="12" r="1.1"/><circle cx="15" cy="12" r="1.1"/><circle cx="9" cy="18" r="1.1"/><circle cx="15" cy="18" r="1.1"/>',
  highlight: '<path d="m9 15 7.5-7.5a2.1 2.1 0 0 0-3-3L6 12l-.8 3.8Z"/><path d="M4 20h16"/>',
  pen: '<path d="m11 10 3 3"/><path d="M6.5 21A3.5 3.5 0 1 0 3 17.5a2.62 2.62 0 0 1-.708 1.792A1 1 0 0 0 3 21z"/><path d="M9.969 17.031 21.378 5.624a1 1 0 0 0-3.002-3.002L6.967 14.031"/>',
  printer: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7Z"/>',
  'make-card': '<rect x="3.5" y="6" width="13" height="12" rx="2"/><path d="M19.5 9v9a2 2 0 0 1-2 2H8"/><path d="M10 9.5v5M7.5 12h5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
}

const paths = computed(() => own[props.name])
const dimension = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))
</script>

<template>
  <svg
    v-if="paths"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    class="shrink-0"
    :style="{ width: dimension, height: dimension }"
    v-html="paths"
  />
  <UiIcon
    v-else
    :name="name"
    :size="size"
    :stroke="1.7"
  />
</template>

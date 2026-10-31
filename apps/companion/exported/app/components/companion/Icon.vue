<script setup lang="ts">
/**
 * The companion's few glyphs the product's `UiIcon` doesn't draw (camera,
 * board, paste, ear, flag, cap…), in the same 24px stroke hand. Any other
 * name falls through to `UiIcon`, so screens use one component for both.
 */
const props = withDefaults(defineProps<{ name: string; size?: number; stroke?: number }>(), {
  size: 18,
  stroke: 1.7,
})

const extra: Record<string, string> = {
  camera:
    '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.4-2h5.8l1.4 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z"/><circle cx="12" cy="12.8" r="3.3"/>',
  board:
    '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v3.5M8 20.5h8"/><path d="M7 8.5h4M7 11.5h7"/>',
  page: '<path d="M7 3h7l5 5v11.5A1.5 1.5 0 0 1 17.5 21h-10A1.5 1.5 0 0 1 6 19.5v-15A1.5 1.5 0 0 1 7.5 3"/><path d="M14 3v5h5M9 13h6M9 16.5h4"/>',
  paste:
    '<rect x="6" y="4.5" width="12" height="16" rx="2"/><path d="M9.5 4.5V3.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1"/><path d="M9.5 11h5M9.5 14.5h3.5"/>',
  ear: '<path d="M7 9.5a5 5 0 0 1 10 0c0 3-2.6 3.8-3.4 5.6-.6 1.4-.7 4.4-3.3 4.4A2.6 2.6 0 0 1 7.6 17"/><path d="M10 9.8a2 2 0 0 1 4 0c0 1.2-1 1.6-1.4 2.2"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  cap: '<path d="m2.5 9 9.5-4.5L21.5 9 12 13.5Z"/><path d="M6.5 11v4.5c1.5 1.6 3.4 2.3 5.5 2.3s4-.7 5.5-2.3V11M21.5 9v5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
  shared: '<path d="M8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 11a2.5 2.5 0 1 0 0-5M17.5 20h4a4.5 4.5 0 0 0-5.5-4.4"/>',
  official: '<path d="M12 3 4.5 6v5.5c0 4.4 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5.1 7.5-9.5V6Z"/><path d="m8.8 12 2.2 2.2 4.3-4.6"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2.5"/>',
  record: '<circle cx="12" cy="12" r="6"/>',
  notebook: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M12 8h4M12 11.5h4"/>',
  plug: '<path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0Z"/><path d="M12 16v5"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7.5 14h9"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  puzzle: '<path d="M10 4.5a2 2 0 0 1 4 0V6h4v4h-1.5a2 2 0 0 0 0 4H18v4h-4v-1.5a2 2 0 0 0-4 0V18H6v-4h1.5a2 2 0 0 0 0-4H6V6h4Z"/>',
}

const paths = computed(() => extra[props.name])
</script>

<template>
  <svg
    v-if="paths"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    class="shrink-0"
    :style="{ width: `${size}px`, height: `${size}px` }"
    v-html="paths"
  />
  <UiIcon
    v-else
    :name="name"
    :size="size"
    :stroke="stroke"
  />
</template>

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

  // A course's cover picture (`companion/course-icons.ts`), with book, globe,
  // code, scales and bulb from UiIcon and cap, camera and puzzle from above.
  brain:
    '<path d="M12 5.5a3 3 0 0 0-5.6-1.4A3 3 0 0 0 4 8.5a3 3 0 0 0 .3 4.6A3.2 3.2 0 0 0 7 18.5a2.8 2.8 0 0 0 5 1Z"/><path d="M12 5.5a3 3 0 0 1 5.6-1.4A3 3 0 0 1 20 8.5a3 3 0 0 1-.3 4.6 3.2 3.2 0 0 1-2.7 5.4 2.8 2.8 0 0 1-5 1"/><path d="M8 9.5a2.2 2.2 0 0 1 2 2.2M16 9.5a2.2 2.2 0 0 0-2 2.2M8.5 15.5h1M14.5 15.5h1"/>',
  flask: '<path d="M9.5 3h5M10 3v6.2L4.8 18.3A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.7L14 9.2V3"/><path d="M7.3 15h9.4"/>',
  atom:
    '<circle cx="12" cy="12" r="1.2"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(120 12 12)"/>',
  dna: '<path d="M7 2.5c0 4.8 10 4.8 10 9.5S7 16.7 7 21.5"/><path d="M17 2.5c0 4.8-10 4.8-10 9.5s10 4.7 10 9.5"/><path d="M9 5.5h6M9 18.5h6"/>',
  'heart-pulse':
    '<path d="M19.6 13.5c.9-1.2 1.4-2.5 1.4-4A4.5 4.5 0 0 0 12 7.3a4.5 4.5 0 0 0-9 2.2c0 1.5.5 2.8 1.4 4L12 21Z"/><path d="M3.5 12.5H8l1.5-2.5 3 5 1.5-2.5h6.5"/>',
  sigma: '<path d="M17.5 5h-11l6 7-6 7h11"/>',
  chart: '<path d="M4 20h16"/><rect x="5.5" y="11" width="3" height="6" rx=".8"/><rect x="10.5" y="5" width="3" height="12" rx=".8"/><rect x="15.5" y="8" width="3" height="9" rx=".8"/>',
  calculator:
    '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 7h7M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M8.5 18h.01M12 18h.01M15.5 15v3"/>',
  coins:
    '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M15 11.1c3.3.2 6 1.5 6 2.9 0 1.7-2.7 3-6 3s-6-1.3-6-3"/><path d="M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-3"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m7.5 9.5 3 2.5-3 2.5M13 15h4"/>',
  briefcase:
    '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"/>',
  quill: '<path d="M20 4C13 4.5 8.5 9 7.5 15L5 20.5"/><path d="M20 4c-.5 6.5-4.5 10.5-11 11.5"/><path d="M9.5 10.5h5"/>',
  speech:
    '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h9A1.5 1.5 0 0 1 16 5.5v6a1.5 1.5 0 0 1-1.5 1.5H9.5l-4 3v-3A1.5 1.5 0 0 1 4 11.5Z"/><path d="M18.5 9h.5a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 19 18h-.5v2.5L15 18h-4.5A1.5 1.5 0 0 1 9 16.5V16"/>',
  landmark: '<path d="M12 3 3.5 8h17Z"/><path d="M3 21h18M5 18h14M6.5 11v4.5M10 11v4.5M14 11v4.5M17.5 11v4.5"/>',
  leaf: '<path d="M5 19c0-8 5-14 15-15-.5 10-6.5 15-14 15"/><path d="m5 19 8-8"/>',
  building:
    '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h.01M12 7h.01M15 7h.01M9 11h.01M12 11h.01M15 11h.01M9 15h.01M15 15h.01M10.5 21v-3.5h3V21"/>',
  rocket:
    '<path d="M12 15.5 8.5 12C10 7 13.5 3.8 20 4c.2 6.5-3 10-8 11.5Z"/><path d="M8.5 12H5l2.5-3.5H11M12 15.5V19l3.5-2.5V13"/><path d="M6 16.5c-1.5 1-2 3.5-2 3.5s2.5-.5 3.5-2"/><circle cx="15" cy="9" r="1.3"/>',
  palette:
    '<path d="M12 3a9 9 0 0 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7h2A4.5 4.5 0 0 0 21 10.7C21 6.4 17 3 12 3Z"/><path d="M7.5 11h.01M10 7h.01M14.5 7h.01"/>',
  music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7.5 4v16M16.5 4v16M3 9h4.5M3 15h4.5M16.5 9H21M16.5 15H21"/>',
  chef: '<path d="M7 20.5h10M7 17h10v-3.2a3.8 3.8 0 1 0-1.4-7.4 3.8 3.8 0 0 0-7.2 0A3.8 3.8 0 1 0 7 13.8Z"/>',
  dumbbell: '<path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9Z"/>',
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

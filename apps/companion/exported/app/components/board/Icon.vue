<script setup lang="ts">
/**
 * The board's tool glyphs, drawn as in the mockup (study-companion.html's
 * `i-*` symbols) so the toolbar reads the same. 24×24, `currentColor`.
 */
const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 16 })

const glyphs: Record<string, string> = {
  cursor: '<path fill="currentColor" d="M5 3l14 7-6.2 1.8L11 18 5 3z"/>',
  sticky: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 4h16v10l-6 6H4V4zm10 16v-6h6"/>',
  shape: '<g fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="10" height="10" rx="1.5"/><circle cx="16" cy="16" r="5"/></g>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="8.5" ry="6.5" fill="none" stroke="currentColor" stroke-width="2"/>',
  diamond: '<path d="M12 3.5 20.5 12 12 20.5 3.5 12Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  arrow: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 12h13M13 6l6 6-6 6"/>',
  pen: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 20l1-4L16 5l3 3L8 19l-4 1z"/>',
  eraser: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M15.5 4.5 20 9l-9.5 9.5H6L3.5 16a1.6 1.6 0 0 1 0-2.3Z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M9 10l5 5M13 19.5h7"/>',
  frame: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M7 3v18M17 3v18M3 7h18M3 17h18"/>',
  doc: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6V3z"/><path d="M14 3v4h4"/></g>',
  image: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m21 15.5-5-5-9 9"/></g>',
  mind: '<g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><circle cx="4.5" cy="5.5" r="2"/><circle cx="19.5" cy="5.5" r="2"/><circle cx="4.5" cy="18.5" r="2"/><circle cx="19.5" cy="18.5" r="2"/><path d="M9.8 10L6 7m8.2 3L18 7m-8.2 7L6 17m8.2-3L18 17"/></g>',
  spark: '<path fill="currentColor" d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7L12 2zM19 15l1 2.8 2.8 1-2.8 1L19 22.6l-1-2.8-2.8-1 2.8-1L19 15z"/>',
  play: '<path fill="currentColor" d="M8 5l11 7-11 7V5z"/>',
  undo: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2"/>',
  redo: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m15 7 5 5-5 5M20 12H9a5 5 0 0 0 0 10h2"/>',
  fit: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  plus: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M12 5v14M5 12h14"/>',
  minus: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M5 12h14"/>',
  trash: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M9.5 7V4.8h5V7M6.5 7l.9 12.4a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/>',
  copy: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/></g>',
  child: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="7" height="6" rx="1.5"/><rect x="15" y="15" width="6" height="5" rx="1.5"/><path d="M10 12h2.5v5.5H15"/></g>',
  sibling: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="4" width="11" height="6" rx="1.5"/><rect x="9" y="14" width="11" height="6" rx="1.5"/><path d="M4 7h5M4 7v10h5"/></g>',
  close: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="m6 6 12 12M18 6 6 18"/>',
  chevron: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m9 6 6 6-6 6"/>',
  more: '<g fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></g>',
  share: '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5"/></g>',
  open: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M7 17 17 7M8.5 7H17v8.5"/>',
}

const svg = computed(() => glyphs[props.name] ?? '')
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    aria-hidden="true"
    v-html="svg"
  />
</template>

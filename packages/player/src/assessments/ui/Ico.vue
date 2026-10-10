<script setup lang="ts">
// Inline icons for the interactive blocks (paths from the landing sprite, player-proto.html). Self-contained,
// so a block never shows an empty glyph if the shell's sprite is missing a symbol.
const props = defineProps<{ name: string }>();
const S = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
const ICONS: Record<string, string> = {
  check: `<path d="M5 12.5l4.5 4.5L19 7.5" ${S} stroke-width="2.8"/>`,
  x: `<path d="M6 6l12 12M18 6L6 18" ${S} stroke-width="2.6"/>`,
  play: '<path d="M6 3.8v16.4a1 1 0 0 0 1.5.86l13.6-8.2a1 1 0 0 0 0-1.72L7.5 2.94A1 1 0 0 0 6 3.8z" fill="currentColor"/>',
  pause: '<g fill="currentColor"><rect x="6" y="4" width="4.2" height="16" rx="1.3"/><rect x="13.8" y="4" width="4.2" height="16" rx="1.3"/></g>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/>',
  mic: `<g ${S} stroke-width="2"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></g>`,
  speaker: `<g ${S} stroke-width="2"><path d="M4 9.5h3.5L12.5 5v14l-5-4.5H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></g>`,
  user: `<g ${S} stroke-width="2"><circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/></g>`,
  quiz: `<g ${S} stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .8-1 1.5v.6"/></g><circle cx="12" cy="17" r="1.2" fill="currentColor"/>`,
  code: `<path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15" ${S} stroke-width="2.1"/>`,
  cards: `<g ${S} stroke-width="2"><rect x="7" y="3.5" width="13" height="16" rx="2.5" transform="rotate(8 13.5 11.5)"/><rect x="4" y="5" width="12" height="15.5" rx="2.5"/></g>`,
  steps: `<g ${S} stroke-width="2"><path d="M9 6h11M9 12h11M9 18h11"/></g><g fill="currentColor"><circle cx="4.5" cy="6" r="1.6"/><circle cx="4.5" cy="12" r="1.6"/><circle cx="4.5" cy="18" r="1.6"/></g>`,
  list: `<g ${S} stroke-width="2"><path d="M3.5 6.5l1.6 1.6 3-3M3.5 13.5l1.6 1.6 3-3M11 7h9.5M11 14h9.5M11 20h9.5"/></g>`,
  target: `<g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/></g><circle cx="12" cy="12" r="1.6" fill="currentColor"/>`,
  rocket: `<path d="M12 3c3.5 2 5 5.5 5 9.5L15 15H9l-2-2.5C7 8.5 8.5 5 12 3zM9 15l-2.5 4M15 15l2.5 4M12 15v5" ${S} stroke-width="2"/><circle cx="12" cy="9.5" r="1.7" fill="currentColor"/>`,
  chat: `<path d="M4 5.5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zM19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v2.5L15.5 18" ${S} stroke-width="1.9"/>`,
  file: `<g ${S} stroke-width="2"><path d="M6 2.8h8l4.5 4.5v13a1.2 1.2 0 0 1-1.2 1.2H6a1.2 1.2 0 0 1-1.2-1.2V4A1.2 1.2 0 0 1 6 2.8z"/><path d="M14 2.8v4.5h4.5"/></g>`,
  ext: `<g ${S} stroke-width="2"><path d="M13 4h7v7M20 4l-9 9"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/></g>`,
  spark: '<path d="M12 2.5l2.2 6.3 6.3 2.2-6.3 2.2L12 19.5l-2.2-6.3L3.5 11l6.3-2.2z" fill="currentColor"/>',
  bulb: `<g ${S} stroke-width="2"><path d="M9 17.5h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V17.5h5.2V15.8c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></g>`,
  warning: `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5" stroke-linecap="round"/></g><circle cx="12" cy="17.3" r="1.2" fill="currentColor"/>`,
  up: `<path d="M6 15l6-6 6 6" ${S} stroke-width="2.4"/>`,
  down: `<path d="M6 9l6 6 6-6" ${S} stroke-width="2.4"/>`,
  arrow: `<path d="M4 12h15M13 6l6 6-6 6" ${S} stroke-width="2.4"/>`,
  back: `<path d="M15 6l-6 6 6 6" ${S} stroke-width="2.4"/>`,
  refresh: `<g ${S} stroke-width="2.2"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4.5V11h-6.5"/></g>`,
  lock: `<g ${S} stroke-width="2"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/></g>`,
  shield: `<g ${S} stroke-width="2"><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.3-4.6"/></g>`,
  copy: `<g ${S} stroke-width="2"><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/></g>`,
  pencil: `<path d="M15.5 4.5l4 4L8 20H4v-4zM13 7l4 4" ${S} stroke-width="2"/>`,
  flag: `<g ${S} stroke-width="2"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></g>`,
};
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <svg class="bm-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false" v-html="ICONS[props.name] ?? ''" />
</template>

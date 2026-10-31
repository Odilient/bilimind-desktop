<script setup lang="ts">
/**
 * The whole icon vocabulary, inline. No icon fonts, no emoji, no network.
 * Every glyph is a 24x24 stroke drawing that inherits `currentColor`.
 *
 *   <UiIcon name="calendar" :size="16" />
 */
const icons: Record<string, string> = {
  // Navigation
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  file: '<path d="M14 2H6.5A2.5 2.5 0 0 0 4 4.5v15A2.5 2.5 0 0 0 6.5 22h11a2.5 2.5 0 0 0 2.5-2.5V8Z"/><path d="M14 2v6h6"/><path d="M8.5 13.5h7M8.5 17.5h4.5"/>',
  graph:
    '<circle cx="5" cy="6" r="2.3"/><circle cx="5" cy="18" r="2.3"/><circle cx="19" cy="12" r="2.3"/><path d="m7.2 7.1 9.6 3.9M7.2 16.9l9.6-3.9"/>',
  layers:
    '<path d="M12 2.5 21 7l-9 4.5L3 7Z"/><path d="m3 12 9 4.5L21 12"/><path d="m3 16.8 9 4.5 9-4.5"/>',
  home: '<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/>',
  /** The workspace itself: a page with its structure panel down the left. */
  workspace: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 4v16"/>',
  /** Distinct from `graph`: three nodes in a triangle, the shape of a DAG tier. */
  map: '<circle cx="6" cy="7" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="12" cy="18" r="2.2"/><path d="M8 8 16 6.6M7 9l4 7M17 8l-4 8.5"/>',
  /** Mobile roadmap: the same DAG collapsed to a single spine. */
  spine: '<path d="M12 3v18"/><circle cx="12" cy="5" r="2.1"/><circle cx="12" cy="12" r="2.1"/><circle cx="12" cy="19" r="2.1"/>',
  inbox:
    '<path d="M5.6 4.5h12.8l2.6 7.2V19a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 19v-7.3Z"/><path d="M3 11.7h5l1.5 3h5l1.5-3h5"/>',
  /** A lidded box: a course put away, distinct from `trash`, which throws it out. */
  archive:
    '<rect x="3" y="4" width="18" height="4.2" rx="1.2"/><path d="M5.2 8.2V19a1.5 1.5 0 0 0 1.5 1.5h10.6a1.5 1.5 0 0 0 1.5-1.5V8.2"/><path d="M10 12h4"/>',
  /** Things shown as tiles: the Courses shelf's card view (its list view is `steps`). */
  grid:
    '<rect x="4" y="4" width="6.8" height="6.8" rx="1.6"/><rect x="13.2" y="4" width="6.8" height="6.8" rx="1.6"/><rect x="4" y="13.2" width="6.8" height="6.8" rx="1.6"/><rect x="13.2" y="13.2" width="6.8" height="6.8" rx="1.6"/>',

  // Actions
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m20 6.5-11 11L4 12.5"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8.4 12.4 2.5 2.5 4.7-5.2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-3.9-3.9"/>',
  trash: '<path d="M4 7h16M9.5 7V4.8h5V7M6.5 7l.9 12.4a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/>',
  refresh:
    '<path d="M3.6 12A8.4 8.4 0 0 1 18 6.1"/><path d="M18.6 3.2v3.6H15"/><path d="M20.4 12A8.4 8.4 0 0 1 6 17.9"/><path d="M5.4 20.8v-3.6H9"/>',
  play: '<path d="M8.4 5.4 19 12 8.4 18.6Z"/>',
  pause: '<path d="M9.5 5v14M14.5 5v14"/>',
  pencil:
    '<path d="M4 20h4L20 8a2.1 2.1 0 0 0-3-3L5 17Z"/><path d="m15.5 6.5 3 3"/>',
  upload: '<path d="M12 16.5V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3.5"/>',
  /** `upload` turned round: the arrow lands in the tray. */
  download:
    '<path d="M12 4v12.5M7.5 12 12 16.5l4.5-4.5"/><path d="M4 15.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3.5"/>',
  link: '<path d="M10.5 13.5a4.5 4.5 0 0 0 6.4 0l2.2-2.2a4.5 4.5 0 0 0-6.4-6.4l-1.1 1.1"/><path d="M13.5 10.5a4.5 4.5 0 0 0-6.4 0l-2.2 2.2a4.5 4.5 0 0 0 6.4 6.4l1.1-1.1"/>',
  external: '<path d="M7 17 17 7"/><path d="M8.5 7H17v8.5"/>',

  // Panels
  /** Toggle the assistant dock: a frame with a right-hand column. */
  'panel-right': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
  /** The lesson list on the left of the workspace, shown or tucked away. */
  'panel-left': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  /** Pop the assistant out of the dock and let it float. */
  'pop-out': '<path d="M14 4h6v6"/><path d="M20 4l-8 8"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  /** Put a floating assistant back into the dock. */
  dock: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M14 5v14"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',

  // Direction
  'chevron-right': '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  'chevron-left': '<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>',
  'chevron-down': '<path d="m5.5 9 6.5 6.5L18.5 9"/>',
  'chevron-up': '<path d="m5.5 15 6.5-6.5L18.5 15"/>',
  'arrow-right': '<path d="M4.5 12h14"/><path d="m13 6.5 5.5 5.5-5.5 5.5"/>',
  'arrow-up-right': '<path d="M7 17 17 7"/><path d="M8.5 7H17v8.5"/>',

  // State
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6.8V12l3.4 2"/>',
  alert: '<path d="M12 3.6 2.7 20h18.6Z"/><path d="M12 10v4"/><path d="M12 17.2h.01"/>',
  flame:
    '<path d="M12 22c3.9 0 6.6-2.5 6.6-6.1 0-4.2-3.4-6.3-4.7-9.8-.3-.9-1.5-1-2-.2-1 1.9-.6 3.6-1.9 5.1-.7.8-1.9.4-2.1-.7-.1-.7-1-1-1.4-.4C5.5 11.2 5.4 13.2 5.4 15c0 3.9 2.6 7 6.6 7Z"/>',
  sparkles:
    '<path d="m12 3 1.7 4.7L18.4 9.4l-4.7 1.7L12 15.8l-1.7-4.7L5.6 9.4l4.7-1.7Z"/><path d="m18.6 15.4.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z"/>',
  target:
    '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1"/>',
  globe:
    '<circle cx="12" cy="12" r="8.8"/><path d="M3.2 12h17.6"/><path d="M12 3.2c2.4 2.4 3.6 5.4 3.6 8.8s-1.2 6.4-3.6 8.8c-2.4-2.4-3.6-5.4-3.6-8.8S9.6 5.6 12 3.2Z"/>',
  bell: '<path d="M18 8.5a6 6 0 1 0-12 0c0 6.5-2.6 8.5-2.6 8.5h17.2S18 15 18 8.5"/><path d="M13.8 20.5a2.1 2.1 0 0 1-3.6 0"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2"/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9"/>',

  // Theme
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.5 1.5M18.3 18.3l1.5 1.5M2.5 12h2M19.5 12h2M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5"/>',
  moon: '<path d="M20.8 13.2A8.7 8.7 0 1 1 10.8 3.2a7 7 0 0 0 10 10Z"/>',
  monitor: '<rect x="2.5" y="4" width="19" height="13" rx="2.5"/><path d="M8.5 21h7M12 17v4"/>',

  // Account
  user: '<circle cx="12" cy="8.5" r="3.7"/><path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5"/>',
  users:
    '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c0-3.2 2.7-5 6-5s6 1.8 6 5"/><path d="M16 5.3a3.3 3.3 0 0 1 0 6.4"/><path d="M17.6 14.8c2.2.5 3.8 1.9 3.8 4.2"/>',
  key: '<circle cx="8" cy="15" r="4.2"/><path d="m11 12 8-8M17 6l2 2M14.5 8.5l2 2"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10.5h18M6.5 14.5h4"/>',
  logout:
    '<path d="M9.5 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.5"/><path d="M15.5 12H9M13 8.5 16.5 12 13 15.5"/>',

  /**
   * One picture, for the illustration meter. An outlined frame with a horizon and
   * a sun in it — deliberately a PICTURE and not a camera or a paperclip, because
   * what the meter counts is a drawing that gets made, not a file that gets
   * attached.
   */
  image:
    '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="10" r="1.6"/><path d="m3.5 17.5 5-4.5 4 3.5 3-2.5 5 4"/>',

  // Kinds of lesson block, from cobalt's sprite (`design/hero-v7/11/sprite.html`).
  // Drawn at stroke 2 there; they read the same at the registry's 1.6.
  steps:
    '<path d="M9 6h11M9 12h11M9 18h11"/><circle fill="currentColor" stroke="none" cx="4.5" cy="6" r="1.6"/><circle fill="currentColor" stroke="none" cx="4.5" cy="12" r="1.6"/><circle fill="currentColor" stroke="none" cx="4.5" cy="18" r="1.6"/>',
  list: '<path d="M3.5 6.5l1.6 1.6 3-3M3.5 13.5l1.6 1.6 3-3M11 7h9.5M11 14h9.5M11 20h9.5"/>',
  quiz:
    '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .8-1 1.5v.6"/><circle cx="12" cy="17" r="1.2" fill="currentColor" stroke="none"/>',
  cards:
    '<rect x="7" y="3.5" width="13" height="16" rx="2.5" transform="rotate(8 13.5 11.5)"/><rect x="4" y="5" width="12" height="15.5" rx="2.5"/>',
  code: '<path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15"/>',
  scales:
    '<path d="M12 4v16M7 20h10M5 7h14M5 7l-2.5 6a2.8 2.8 0 0 0 5 0zM19 7l-2.5 6a2.8 2.8 0 0 0 5 0z"/>',
  warning:
    '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5"/><circle cx="12" cy="17.3" r="1.2" fill="currentColor" stroke="none"/>',
  bulb: '<path d="M9 17.5h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V17.5h5.2V15.8c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  table: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M3 10h18M3 15h18M9.5 4.5v15"/>',
  video: '<rect x="2.5" y="6" width="13.5" height="12" rx="2.5"/><path d="M16 10.5l5.5-3v9l-5.5-3z"/>',
  flow: '<rect x="3" y="3.5" width="7" height="5" rx="1.5"/><rect x="14" y="15.5" width="7" height="5" rx="1.5"/><path d="M6.5 8.5v4.5h11v2.5"/>',
  sliders:
    '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  chat: '<path d="M4 5.5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zM19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v2.5L15.5 18"/>',
  speaker: '<path d="M4 9.5h3.5L12.5 5v14l-5-4.5H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wand: '<path d="M4 20L15 9M13 7l2-2 4 4-2 2z"/><path d="M7 3.5l.7 1.8 1.8.7-1.8.7L7 8.5l-.7-1.8L4.5 6l1.8-.7zM19 14.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill="currentColor" stroke="none"/>',
  sign: '<path d="M12 3v18M5 6h11l3 2.5-3 2.5H5zM19 13H8l-3 2.5L8 18h11z"/>',
  tree: '<rect x="8.5" y="3" width="7" height="5" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/><rect x="14" y="16" width="7" height="5" rx="1.5"/><path d="M12 8v4M6.5 16v-4h11v4"/>',
  path: '<path d="M5 19c0-4 4-4 7-7s7-3 7-7"/><circle cx="5" cy="19" r="2.4" fill="currentColor" stroke="none"/><circle cx="19" cy="5" r="2.4" fill="currentColor" stroke="none"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M9.5 2.5h5M18.5 6.5l1.5-1.5"/>',

  // Misc
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  dots: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/>',
  send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z"/>',
  loader: '<path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.8 2.8M15.2 15.2 18 18M18 6l-2.8 2.8M8.8 15.2 6 18"/>',
}

/**
 * Filled rather than stroked, because these stand for THINGS rather than for
 * actions.
 */
const filledIcons: Record<string, string> = {
  /** The assistant's mark. */
  spark: '<path d="M12 3l1.4 7.6L21 12l-7.6 1.4L12 21l-1.4-7.6L3 12l7.6-1.4Z"/>',

  /**
   * One lesson: the roadmap's own node, at icon scale.
   *
   * The allowance meter needed a unit glyph and the two obvious answers were
   * both wrong. A STAR is already a rating and a bookmark everywhere on the web,
   * so a number beside one reads as a score. A COIN says money at the exact
   * moment somebody is deciding whether to study, and worse, it implies these
   * can be EARNED — which they cannot, so the icon would be making a promise the
   * product does not keep.
   *
   * The node is what a lesson actually looks like in this app. A row of them
   * emptying out is progress along a path, which is the one visual idea the whole
   * product is built on. Nothing borrowed, nothing to explain.
   */
  node: '<rect x="5" y="5" width="14" height="14" rx="4.5"/>',
}

const props = withDefaults(
  defineProps<{
    name: string
    size?: number | string
    stroke?: number
  }>(),
  { size: 18, stroke: 1.6 },
)

const isFilled = computed(() => props.name in filledIcons)
const paths = computed(() => filledIcons[props.name] ?? icons[props.name] ?? icons.dots!)
const dimension = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    :fill="isFilled ? 'currentColor' : 'none'"
    :stroke-width="isFilled ? undefined : stroke"
    :stroke="isFilled ? undefined : 'currentColor'"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    :style="{ width: dimension, height: dimension }"
    class="shrink-0"
    v-html="paths"
  />
</template>

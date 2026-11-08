/**
 * The board's colours and type, as plain values.
 *
 * The board draws on a canvas, and a canvas can't read a CSS variable, so
 * every colour it paints has to arrive here as a string. Since Daylight 2
 * (2026-11-07) the values are `docs/design/daylight2/css/tokens.css`: warm
 * paper and ink, sky for "you", the course.html sticky fills, and Caveat for
 * what a hand wrote; a `--c-<token>` variable on :root wins
 * when the app defines one, so the board follows the course palette if it
 * ever moves.
 */
import { ref } from 'vue'
import type { CourseColor } from '../types'

export const INK = {
  // The board's ground (`--surface-mute`): connector labels cut the line out with it.
  bg: '#faf8f2',
  surface: '#fffefb',
  sunken: '#efeadf',
  line: 'rgba(31,28,23,0.09)',
  lineStrong: 'rgba(31,28,23,0.15)',
  text: '#1f1c17',
  dim: '#615a50',
  faint: '#958e82',
  // The names stay (they're read across the board's code); the values are Daylight's sky and highlighter.
  cobalt: '#2d64b8',
  cobaltSoft: 'rgba(91,156,240,0.12)',
  lime: '#ffe27a',
  coral: '#d4553f',
  amberText: '#6b5200',
  /** A sticky's words and its shadow; a frame's wash; words on a course colour. */
  stickyText: '#3b3220',
  stickyShadow: 'rgba(80,60,10,0.16)',
  frameFill: 'rgba(255,255,255,0.72)',
  pageShadow: 'rgba(70,50,20,0.07)',
  onCourse: '#ffffff',
}

/** The course colours as `assets/css/companion.css` has them, light. Keep the two in step. */
const COURSE: Record<string, string> = {
  db: '#5bb276',
  net: '#f59a62',
  prg: '#9d8cf2',
  mth: '#ec85a6',
  seg: '#4fae9e',
  eng: '#5b9cf0',
  ita: '#e9b93a',
  c8: '#a39a8c',
}

/**
 * A course colour token (or hex) as a hex string the canvas can paint. Always
 * the light value: it is stored on the board (a mind map's root), and a stored
 * colour must not depend on the theme it was made in. `paint()` gives the
 * dark one at draw time.
 */
export function courseHex(color: CourseColor | null | undefined): string {
  if (!color) return INK.cobalt
  if (color.startsWith('#')) return color
  return COURSE[color] ?? INK.cobalt
}

/** Sticky fills. Pastels that keep ink legible; the names are what's stored. */
export const STICKY = {
  yellow: '#fff1a8',
  pink: '#ffd9e2',
  blue: '#d6e6ff',
  green: '#d9f0d2',
  violet: '#e6e0fc',
  orange: '#fde2cf',
} as const
export type StickyColor = keyof typeof STICKY

/** Ink colours for the pen and for shape outlines. */
export const PEN = {
  ink: '#1f1c17',
  cobalt: '#5b9cf0',
  coral: '#ec85a6',
  green: '#5bb276',
} as const
export type PenColor = keyof typeof PEN

/** Shape fills: white, or a tint of the outline. */
export const SHAPE_FILL = {
  white: '#fffefb',
  blue: '#e1ebfb',
  lime: '#e2f0dc',
  amber: '#fff1c7',
  coral: '#fbe4eb',
} as const
export type ShapeFill = keyof typeof SHAPE_FILL

/** The people on a board, in the order they join. Never cobalt: that's you. */
export const PEER_COLORS = ['#5bb276', '#9d8cf2', '#ec85a6', '#f59a62', '#5b9cf0', '#f2c84b']

export const FONT = {
  body: 'Figtree, "Figtree Fallback", -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  display: '"Bricolage Grotesque", Figtree, Arial, sans-serif',
  hand: 'Caveat, "Bradley Hand", "Segoe Print", cursive',
}

/* -- The dark board ------------------------------------------------------------ */

/*
 * The same palette on a dark ground (main.css's dark tokens): warm dark cards
 * a step above the board's ground, light ink, the course colours' dark values.
 * Nothing stored on a board is a dark colour: stickies, shapes and pens store a
 * key, a mind map its course colour's light hex, and the draw code asks for the
 * hex of the theme it is painting in (`ink()`, `sticky()`, `pen()`, `fills()`,
 * `paint()`). Exports paint in light (`withBoardTheme`).
 */
export type BoardTheme = 'light' | 'dark'

const DARK_INK: typeof INK = {
  bg: '#25221d',
  surface: '#2f2b25',
  sunken: '#1f1c18',
  line: 'rgba(243,238,228,0.1)',
  lineStrong: 'rgba(243,238,228,0.2)',
  text: '#f3eee4',
  dim: '#cdc5b8',
  faint: '#9a9387',
  cobalt: '#8fb6f7',
  cobaltSoft: 'rgba(111,169,245,0.16)',
  lime: '#f4d265',
  coral: '#f07a62',
  amberText: '#f2cd5c',
  stickyText: '#f6f1e6',
  stickyShadow: 'rgba(0,0,0,0.35)',
  frameFill: 'rgba(47,43,37,0.6)',
  pageShadow: 'rgba(0,0,0,0.3)',
  onCourse: '#1a1814',
}

/** Each sticky's colour at about a third over the dark ground, so it still reads as a note. */
const DARK_STICKY: Record<StickyColor, string> = {
  yellow: '#67572c',
  pink: '#654249',
  blue: '#364960',
  green: '#36503a',
  violet: '#4b4461',
  orange: '#684833',
}

const DARK_PEN: Record<PenColor, string> = {
  ink: '#f3eee4',
  cobalt: '#6fa9f5',
  coral: '#f095b2',
  green: '#6cc287',
}

const DARK_SHAPE_FILL: Record<ShapeFill, string> = {
  white: '#2f2b25',
  blue: '#2b3442',
  lime: '#2c3a2d',
  amber: '#3d3522',
  coral: '#3e2b30',
}

/** Light course hex → dark: today's Daylight set, and the cobalt-era set older boards stored. */
const DARK_COURSE: Record<string, string> = {
  '#5bb276': '#6cc287', '#f59a62': '#f5a674', '#9d8cf2': '#ab9cf5', '#ec85a6': '#f095b2',
  '#4fae9e': '#62c2b2', '#5b9cf0': '#6fa9f5', '#e9b93a': '#f2cd5c', '#a39a8c': '#b3aa9c',
  '#0f9488': '#2cc3b4', '#e07a1f': '#f59a45', '#7357e8': '#9d86ff', '#d9466f': '#f06b91',
  '#3a9a3f': '#5cc062', '#2f86d6': '#5aa8ef', '#a86f08': '#e3ad45', '#5b6472': '#8fa0b8',
  '#5b6b82': '#8fa0b8', '#2340e6': '#8fb6f7', '#2d64b8': '#8fb6f7',
}

/** What the live board paints in. A ref, so the board's toolbars (their swatches) follow it too. */
export const boardTheme = ref<BoardTheme>('light')
// Set for a moment by `withBoardTheme`, without the toolbars noticing.
let override: BoardTheme | null = null

export function setBoardTheme(theme: BoardTheme): void {
  boardTheme.value = theme
}

/** Run `fn` painting in `theme` (an export: always light), then go back. Synchronous only. */
export function withBoardTheme<T>(theme: BoardTheme, fn: () => T): T {
  const before = override
  override = theme
  try {
    return fn()
  } finally {
    override = before
  }
}

const dark = () => (override ?? boardTheme.value) === 'dark'
export const ink = (): typeof INK => (dark() ? DARK_INK : INK)
export const sticky = (): Record<StickyColor, string> => (dark() ? DARK_STICKY : STICKY)
export const pen = (): Record<PenColor, string> => (dark() ? DARK_PEN : PEN)
export const fills = (): Record<ShapeFill, string> => (dark() ? DARK_SHAPE_FILL : SHAPE_FILL)

/** A stored colour (a pen key, or a hex such as a mind map's course colour) in the theme being painted. */
export function paint(color: string): string {
  if (color in PEN) return pen()[color as PenColor]
  return dark() ? (DARK_COURSE[color.toLowerCase()] ?? color) : color
}

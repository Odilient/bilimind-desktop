/**
 * The board's colours and type, as plain values.
 *
 * The board draws on a canvas, and a canvas can't read a CSS variable, so
 * every colour it paints has to arrive here as a string. The values are the
 * mockup's (`the design notes`, `--a-*` and `--c-*`),
 * which are the app's cobalt tokens; a `--c-<token>` variable on :root wins
 * when the app defines one, so the board follows the course palette if it
 * ever moves.
 */
import type { CourseColor } from '../types'

export const INK = {
  bg: '#f6f7fa',
  surface: '#ffffff',
  sunken: '#eef0f4',
  line: 'rgba(11,13,16,0.09)',
  lineStrong: 'rgba(11,13,16,0.16)',
  text: '#0b0d10',
  dim: '#565b68',
  faint: '#8b909c',
  cobalt: '#2340e6',
  cobaltSoft: 'rgba(35,64,230,0.08)',
  lime: '#c6f24e',
  coral: '#ff5a3c',
  amberText: '#8a650d',
}

const COURSE: Record<string, string> = {
  db: '#0f9488',
  net: '#e07a1f',
  prg: '#7357e8',
  mth: '#d9466f',
  seg: '#3a9a3f',
  eng: '#2f86d6',
  ita: '#a86f08',
  c8: '#5b6472',
}

/** A course colour token (or hex) as a hex string the canvas can paint. */
export function courseHex(color: CourseColor | null | undefined): string {
  if (!color) return INK.cobalt
  if (color.startsWith('#')) return color
  if (import.meta.client) {
    const css = getComputedStyle(document.documentElement).getPropertyValue(`--c-${color}`).trim()
    if (css) return css
  }
  return COURSE[color] ?? INK.cobalt
}

/** Sticky fills. Pastels that keep ink legible; the names are what's stored. */
export const STICKY = {
  yellow: '#fde68a',
  pink: '#fbcfe8',
  blue: '#bfdbfe',
  green: '#c7f0c2',
  violet: '#ddd6fe',
  orange: '#fed7aa',
} as const
export type StickyColor = keyof typeof STICKY

/** Ink colours for the pen and for shape outlines. */
export const PEN = {
  ink: '#0b0d10',
  cobalt: '#2340e6',
  coral: '#ff5a3c',
  green: '#12a150',
} as const
export type PenColor = keyof typeof PEN

/** Shape fills: white, or a tint of the outline. */
export const SHAPE_FILL = {
  white: '#ffffff',
  blue: '#eef1fe',
  lime: '#eef9cf',
  amber: '#fff6da',
  coral: '#ffe8df',
} as const
export type ShapeFill = keyof typeof SHAPE_FILL

/** The people on a board, in the order they join. Never cobalt: that's you. */
export const PEER_COLORS = ['#0f9488', '#7357e8', '#d9466f', '#e07a1f', '#2f86d6', '#3a9a3f']

export const FONT = {
  body: 'Inter, "Inter Fallback", -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  display: '"Space Grotesk", "Space Grotesk Fallback", Inter, Arial, sans-serif',
  hand: '"Bradley Hand", "Segoe Print", "Comic Sans MS", cursive',
}

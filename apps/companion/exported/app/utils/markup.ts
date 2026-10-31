import type { Stroke, StrokePoint } from '~/types/api'

/**
 * MARKUP — the pure parts of the pen and highlighter.
 *
 * Everything here is a function of its arguments: no DOM, no network, no
 * component state. The composables and the overlay components lean on these so
 * that the geometry (what a stroke *is*, how it is thinned, how it becomes a
 * path) is decided once and cannot drift between a picture, a board and the
 * toolbar's preview.
 */

/**
 * The product's own spectrum, not a paint box. Violet is the brand; amber,
 * mint and sky are the three other lights the landing page attaches meaning
 * to. Four is enough to tell "this" from "that" and few enough that picking
 * one is not a decision.
 */
export const INK_COLORS = [
  { name: 'Violet', value: '#7c5cff' },
  { name: 'Amber', value: '#f5a524' },
  { name: 'Mint', value: '#22c58b' },
  { name: 'Sky', value: '#3ea6ff' },
] as const

export type MarkupSize = 'thin' | 'thick'

/**
 * A stroke's `size` is stored in px at this width and scaled with the box it
 * is drawn on, so a line that covers a fifth of a diagram on a laptop covers a
 * fifth of it on a phone. The backend accepts 0.5..64; these sit well inside.
 */
export const REFERENCE_WIDTH = 1000

const SIZES: Record<Stroke['tool'], Record<MarkupSize, number>> = {
  pen: { thin: 4, thick: 8 },
  marker: { thin: 14, thick: 24 },
  arrow: { thin: 5, thick: 10 },
}

export function strokeSizeFor(tool: Stroke['tool'], size: MarkupSize): number {
  return SIZES[tool][size]
}

/** A marker is a wash, not a line: wide, and light enough to read through. */
export const MARKER_OPACITY = 0.4

/** How much of the page a highlight tints. Lighter than the marker; it sits on prose. */
export const HIGHLIGHT_OPACITY = 0.34

/**
 * A note marks words to point at them, not to make them louder, so it tints
 * at half a highlight's strength and leans on its underline and its number
 * instead. At highlight strength a note on a sentence the reader had already
 * highlighted read as a second, darker highlight in a colour they never chose.
 */
export const NOTE_OPACITY = 0.14

/**
 * Every new note is amber — the sticky-note colour — whatever ink the pen is
 * holding. Notes used to take the pen's ink, so the same gesture made a violet
 * note one minute and a mint one the next, which read as a mistake. A note
 * added to an existing highlight keeps that highlight's colour.
 */
export const NOTE_COLOR = '#f5a524'

/** `#RGB` or `#rrggbb` (with or without the hash) as lower-case `#rrggbb`; anything else is null. */
export function normaliseHex(value: string): string | null {
  const hex = value.trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`
  if (/^[0-9a-f]{3}$/.test(hex)) return `#${hex.split('').map((c) => c + c).join('')}`
  return null
}

/** Hue 0..360, saturation and value 0..1 — the picker's own coordinates. */
export interface Hsv {
  h: number
  s: number
  v: number
}

export function hexToHsv(color: string): Hsv {
  const hex = normaliseHex(color) ?? '#000000'
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const delta = max - Math.min(r, g, b)

  let h = 0
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }

  return { h, s: max === 0 ? 0 : delta / max, v: max }
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c

  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]

  const byte = (channel: number): string =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, '0')

  return `#${byte(r)}${byte(g)}${byte(b)}`
}

/** `#rrggbb` (or `#rgb`) with an alpha, as `rgba()`. Anything else is passed through. */
export function tint(color: string, alpha: number): string {
  const hex = color.trim().replace(/^#/, '')

  const digits =
    hex.length === 3
      ? hex.split('').map((c) => c + c)
      : hex.length === 6
        ? [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)]
        : null

  if (!digits || digits.some((pair) => !/^[0-9a-f]{2}$/i.test(pair))) return color

  const [r, g, b] = digits.map((pair) => Number.parseInt(pair, 16)) as [number, number, number]

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * A v4 uuid. `crypto.randomUUID` needs a secure context, and the one place
 * this app runs without one is exactly the place a pen matters most: a tablet
 * on the LAN pointed at a dev box over plain http.
 */
export function newUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-')
}

/** The backend's caps, mirrored so a stroke is refused before it is sent. */
export const MAX_POINTS_PER_STROKE = 2000
export const MAX_STROKES = 500
export const MAX_ANNOTATION_BYTES = 256 * 1024

function round(value: number, places: number): number {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

/**
 * Ramer–Douglas–Peucker over a normalised stroke.
 *
 * A pointer reports a point every few milliseconds, so a single scribble is a
 * thousand points before it is a shape. At 0.0015 of the box (about 2px on a
 * 1200px board) the tolerance is under the width of the thinnest pen, so what
 * comes out draws identically and is a tenth of the size. Coordinates are
 * rounded to four places — a ten-thousandth of the box is a fraction of a
 * pixel anywhere — and pressure to two.
 *
 * Iterative rather than recursive: the worst case is a stroke that never
 * settles, and that is a stack depth we do not want to find out about on a
 * phone.
 */
export function simplifyStroke(points: StrokePoint[], tolerance = 0.0015): StrokePoint[] {
  const cleaned: StrokePoint[] = []

  for (const point of points) {
    const last = cleaned[cleaned.length - 1]
    if (last && last[0] === point[0] && last[1] === point[1]) continue
    cleaned.push(point)
  }

  const count = cleaned.length
  let kept: StrokePoint[]

  if (count <= 2) {
    kept = cleaned
  } else {
    const keep = new Uint8Array(count)
    keep[0] = 1
    keep[count - 1] = 1

    const stack: Array<[number, number]> = [[0, count - 1]]

    while (stack.length > 0) {
      const [a, b] = stack.pop() as [number, number]
      if (b - a < 2) continue

      const [ax, ay] = cleaned[a] as StrokePoint
      const [bx, by] = cleaned[b] as StrokePoint
      const dx = bx - ax
      const dy = by - ay
      const length = dx * dx + dy * dy

      let farthest = -1
      let farthestAt = -1

      for (let i = a + 1; i < b; i += 1) {
        const [px, py] = cleaned[i] as StrokePoint
        let distance: number

        if (length === 0) {
          distance = Math.hypot(px - ax, py - ay)
        } else {
          const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length))
          distance = Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
        }

        if (distance > farthest) {
          farthest = distance
          farthestAt = i
        }
      }

      if (farthest > tolerance && farthestAt > 0) {
        keep[farthestAt] = 1
        stack.push([a, farthestAt], [farthestAt, b])
      }
    }

    kept = cleaned.filter((_, index) => keep[index] === 1)
  }

  // The cap is the server's, and a stroke that is still over it after RDP is a
  // pointer that never stopped moving. Thin it evenly rather than cut it off.
  if (kept.length > MAX_POINTS_PER_STROKE) {
    const step = kept.length / MAX_POINTS_PER_STROKE
    const thinned: StrokePoint[] = []
    for (let i = 0; i < MAX_POINTS_PER_STROKE; i += 1) {
      thinned.push(kept[Math.floor(i * step)] as StrokePoint)
    }
    const last = kept[kept.length - 1] as StrokePoint
    thinned[thinned.length - 1] = last
    kept = thinned
  }

  return kept.map((point) =>
    point.length === 3
      ? [round(point[0], 4), round(point[1], 4), round(point[2], 2)]
      : [round(point[0], 4), round(point[1], 4)],
  )
}

/**
 * perfect-freehand hands back the outline of a stroke as a polygon; this turns
 * it into one closed path of quadratic curves through the midpoints, which is
 * the standard trick for a smooth fill without a control point per vertex.
 * Coordinates are rounded to a tenth of a pixel to keep the `d` short.
 */
export function outlinePath(outline: number[][]): string {
  const count = outline.length
  if (count === 0) return ''

  const first = outline[0] as number[]
  const parts: string[] = [`M${round(first[0] ?? 0, 1)} ${round(first[1] ?? 0, 1)}Q`]

  for (let i = 0; i < count; i += 1) {
    const current = outline[i] as number[]
    const next = outline[(i + 1) % count] as number[]
    const x0 = current[0] ?? 0
    const y0 = current[1] ?? 0
    const x1 = next[0] ?? 0
    const y1 = next[1] ?? 0

    parts.push(
      `${round(x0, 1)} ${round(y0, 1)} ${round((x0 + x1) / 2, 1)} ${round((y0 + y1) / 2, 1)}`,
    )
  }

  parts.push('Z')

  return parts.join(' ')
}

/**
 * The outline of an arrow, in px, from its first point to its last.
 *
 * An arrow is not a freehand line with a decoration on the end: it is drawn by
 * dragging, so the shaft is straight by construction and the head has to keep
 * its proportions at any length. The head is 3.6 shaft-widths long and capped
 * at 45% of the arrow; below that the shaft thins with the length, so a short
 * arrow is a small arrow rather than a head with a stub behind it.
 *
 * One filled path — a shaft box, then the head's three points — because
 * everything else on this layer is a filled path too, and a `stroke` here
 * would scale differently under the same viewBox.
 */
export function arrowPath(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  width: number,
): string {
  const length = Math.hypot(bx - ax, by - ay)

  // A tap with the arrow tool is a dot, not a division by zero.
  if (length < 0.5) {
    const radius = width / 2
    return `M${round(ax - radius, 1)} ${round(ay, 1)}a${round(radius, 1)} ${round(radius, 1)} 0 1 0 ${round(width, 1)} 0a${round(radius, 1)} ${round(radius, 1)} 0 1 0 ${round(-width, 1)} 0Z`
  }

  // A short drag thins the whole arrow rather than putting a full-size head on
  // a stub: below about four and a half widths the head would be narrower than
  // the shaft it sits on, which reads as an arrow drawn backwards.
  const weight = Math.min(width, length / 4.5)
  const half = weight / 2

  const ux = (bx - ax) / length
  const uy = (by - ay) / length
  const nx = -uy
  const ny = ux

  const head = Math.min(weight * 3.6, length * 0.45)
  const wing = head * 0.62

  // Where the head meets the shaft.
  const cx = bx - ux * head
  const cy = by - uy * head

  const at = (x: number, y: number): string => `${round(x, 1)} ${round(y, 1)}`

  return [
    `M${at(ax + nx * half, ay + ny * half)}`,
    `L${at(cx + nx * half, cy + ny * half)}`,
    `L${at(cx + nx * wing, cy + ny * wing)}`,
    `L${at(bx, by)}`,
    `L${at(cx - nx * wing, cy - ny * wing)}`,
    `L${at(cx - nx * half, cy - ny * half)}`,
    `L${at(ax - nx * half, ay - ny * half)}`,
    'Z',
  ].join('')
}

/** Distance from a point to a segment, all in the same units. */
export function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const length = dx * dx + dy * dy

  if (length === 0) return Math.hypot(px - ax, py - ay)

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length))

  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Roughly what the server will measure: the JSON length of one mark. */
export function annotationBytes(value: unknown): number {
  return JSON.stringify(value).length
}

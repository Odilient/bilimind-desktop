/**
 * A course's colour as CSS. `subjects.color` is a token name (`db`, `net`, …,
 * see assets/css/companion.css) or a raw hex; screens never care which.
 */
const TOKENS = new Set(['db', 'net', 'prg', 'mth', 'seg', 'eng', 'ita', 'c8'])

export function courseColor(color: string | null | undefined): string {
  if (!color) return 'var(--c-c8)'
  return TOKENS.has(color) ? `var(--c-${color})` : color
}

/** The same colour washed into the page, for fills behind ink text. */
export function courseTint(color: string | null | undefined, amount = 12): string {
  return `color-mix(in srgb, ${courseColor(color)} ${amount}%, white)`
}

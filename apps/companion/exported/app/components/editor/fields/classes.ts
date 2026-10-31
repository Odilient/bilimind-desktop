/**
 * EDIT — the one set of field styles, so twenty inputs look like one form.
 * Tailwind classes as strings rather than a component per input: a field is a
 * native `<input>` or `<textarea>` with the app's border and focus ring, and a
 * wrapper component would only add a prop for every attribute it forwards.
 */
export const INPUT =
  'w-full rounded-[10px] border border-border-field bg-surface px-3 py-2 text-[13.5px] leading-snug text-text-body outline-none transition-colors placeholder:text-text-faint focus:border-lime-2 focus:shadow-[0_0_0_3px_rgb(198_242_78/0.35)]'

export const LABEL = 'mb-1 block text-[11.5px] font-medium tracking-[0.02em] text-text-muted'

export const HINT = 'mt-1 text-[11.5px] leading-snug text-text-faint'

export const GHOST =
  'inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium text-text-soft transition-colors hover:bg-surface-mute hover:text-text disabled:cursor-not-allowed disabled:opacity-40'

export const ICON_BTN =
  'grid size-7 shrink-0 cursor-pointer place-items-center rounded-[8px] text-text-faint transition-colors hover:bg-surface-mute hover:text-text disabled:cursor-not-allowed disabled:opacity-40'

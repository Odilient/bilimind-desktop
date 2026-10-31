import type { MaterialFormat } from '~/types/api'

/**
 * The one glyph table for materials, shared by the library row, the picker and
 * the workspace panel.
 *
 * Only the GLYPH is chosen here. The word beside it is always the server's
 * `format_label`: this panel used to guess a badge out of `title.split('.')`,
 * which was wrong for every file whose name lost its extension and could never
 * know that a .vtt is a transcript rather than a text file.
 *
 * There is no picture glyph in the icon set, so an image reads as the generic
 * file it is rather than borrowing one that means something else.
 */
export const FORMAT_ICON: Record<MaterialFormat, string> = {
  pdf: 'file',
  docx: 'file',
  slides: 'layers',
  book: 'book',
  transcript: 'mic',
  sheet: 'graph',
  markup: 'link',
  note: 'pencil',
  web: 'link',
  image: 'file',
  video: 'play',
  unknown: 'file',
}

/** Tolerant of a format this build has not heard of yet. */
export function formatIcon(format: MaterialFormat): string {
  return FORMAT_ICON[format] ?? 'file'
}

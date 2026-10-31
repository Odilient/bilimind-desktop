/**
 * Search snippets, split into runs the template can render.
 *
 * The API wraps every match in two private-use codepoints instead of returning
 * `<mark>`. That is not decoration: block prose is written by a model, and a
 * snippet that arrived as HTML would be a stored-XSS delivery path the moment
 * anything rendered it with `v-html`. Private-use codepoints cannot occur in
 * real prose, the server strips them out of indexed text so a payload cannot
 * counterfeit one, and the split happens here so the marks come out as real DOM
 * elements built by Vue.
 *
 * If a later change ever "simplifies" this away in favour of interpolating the
 * snippet as HTML, every generated lesson in the product becomes an injection
 * surface. Keep the split.
 */

/** U+E000 — opens a match. Must equal CourseSearch::HIGHLIGHT_OPEN. */
export const HL_OPEN = '\u{E000}'

/** U+E001 — closes a match. Must equal CourseSearch::HIGHLIGHT_CLOSE. */
export const HL_CLOSE = '\u{E001}'

export interface HighlightPart {
  text: string
  hit: boolean
}

/**
 * One snippet -> alternating runs of plain and matched text.
 *
 * Unbalanced markers are ignored rather than trusted. FTS5 builds a snippet by
 * cutting a window out of the stored text, so a match that straddles the edge
 * can arrive with only half its pair — and a stray marker rendered literally is
 * an invisible glyph in the middle of a word.
 */
export function splitHighlights(snippet: string): HighlightPart[] {
  const parts: HighlightPart[] = []
  let buffer = ''
  let hit = false

  for (const char of snippet) {
    if (char !== HL_OPEN && char !== HL_CLOSE) {
      buffer += char
      continue
    }

    const opens = char === HL_OPEN

    // An open inside a match, or a close outside one: the other half was cut
    // off by the snippet window. Drop the marker, keep the words.
    if (opens === hit) continue

    if (buffer !== '') {
      parts.push({ text: buffer, hit })
      buffer = ''
    }

    hit = opens
  }

  if (buffer !== '') parts.push({ text: buffer, hit })

  return parts
}

/**
 * The same snippet with the markers gone.
 *
 * For the places that need one flat string rather than runs — an accessible
 * name, a `title` attribute, a toast. Rendering the raw snippet there would
 * paint two invisible glyphs around every match.
 */
export function stripHighlights(snippet: string): string {
  return snippet.replaceAll(HL_OPEN, '').replaceAll(HL_CLOSE, '')
}

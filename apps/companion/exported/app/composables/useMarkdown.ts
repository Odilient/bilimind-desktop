/**
 * A deliberately small, deliberately safe Markdown renderer.
 *
 * Lesson content is written by an LLM, so it is untrusted input: nothing here
 * ever injects raw HTML from the source. Everything is escaped *first*, and the
 * only tags that survive are the ones this file emits.
 *
 * Supported: ATX headings, paragraphs, bold / italic / strikethrough, inline
 * code, links (http/https/mailto/relative only), bullet + ordered lists with one
 * level of nesting, blockquotes, horizontal rules, pipe tables and fenced code
 * blocks. Fenced code is returned as a token rather than HTML so the renderer
 * can hang a copy button off it.
 *
 *   const { parse } = useMarkdown()
 *   const tokens = parse(block.payload.markdown)
 */

export type MdHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export type MdAlign = 'left' | 'center' | 'right'

export interface MdListItem {
  /** Inline HTML — already escaped, safe for `v-html`. */
  html: string
  /** Nesting level, 0 for a top-level item. */
  depth: number
}

export type MdToken =
  | { kind: 'heading'; level: MdHeadingLevel; html: string; text: string }
  | { kind: 'paragraph'; html: string }
  | { kind: 'list'; ordered: boolean; start: number; items: MdListItem[] }
  | { kind: 'code'; language: string; code: string }
  | { kind: 'quote'; tokens: MdToken[] }
  | { kind: 'rule' }
  | { kind: 'table'; head: string[]; rows: string[][]; align: MdAlign[] }

/** Placeholder sentinel. Stripped from the source so it can never be forged. */
const SENTINEL = '\u0000'

/** Schemes we are willing to link to. Everything else renders as plain text. */
const SAFE_HREF = /^(?:https?:\/\/|mailto:|\/|#)/i

const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([A-Za-z0-9_+#.-]*)\s*$/
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/
const RULE = /^\s{0,3}([-*_])\s*(?:\1\s*){2,}$/
const QUOTE = /^\s{0,3}>\s?(.*)$/
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/
const TABLE_DIVIDER = /^\s*\|?(?:\s*:?-{1,}:?\s*\|)+\s*:?-{1,}:?\s*\|?\s*$/

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Render one line of inline Markdown to safe HTML.
 *
 * Order matters: code spans and links are lifted out into placeholders before
 * emphasis runs, so a `*` inside a code span or a URL is never mistaken for
 * markup.
 */
export function renderInline(source: string): string {
  const slots: string[] = []

  const hold = (html: string): string => {
    slots.push(html)
    return `${SENTINEL}${slots.length - 1}${SENTINEL}`
  }

  let text = escapeHtml(source.split(SENTINEL).join(''))

  // Inline code — escaped already, so the content is inert.
  text = text.replace(/`([^`\n]+)`/g, (_match, code: string) => hold(`<code>${code}</code>`))

  // Images are never loaded (the model may have invented the URL); they degrade
  // to a labelled link so the learner can still decide to follow it.
  text = text.replace(
    /!\[([^\]\n]*)\]\(\s*([^)\s]+)[^)]*\)/g,
    (match: string, alt: string, href: string) =>
      SAFE_HREF.test(href) ? hold(anchor(href, alt.trim() || 'image')) : match,
  )

  // [label](href "title")
  text = text.replace(
    /\[([^\]\n]*)\]\(\s*([^)\s]+)(?:\s+&quot;([^)]*)&quot;)?\s*\)/g,
    (match: string, label: string, href: string, title?: string) =>
      SAFE_HREF.test(href) ? hold(anchor(href, label.trim() || href, title)) : match,
  )

  // Bare URLs, so a pasted link is still clickable.
  text = text.replace(
    /(^|[\s(])(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g,
    (_match, lead: string, href: string) => `${lead}${hold(anchor(href, href))}`,
  )

  text = text
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/(^|[^\w\\])_([^_\n]+)_(?=[^\w]|$)/g, '$1<em>$2</em>')

  // Placeholders can nest (a link label may hold a code span), so restore until
  // the string stops changing.
  for (let pass = 0; pass < 5 && text.includes(SENTINEL); pass += 1) {
    text = text.replace(
      new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, 'g'),
      (_match, index: string) => slots[Number(index)] ?? '',
    )
  }

  return text.split(SENTINEL).join('')
}

function anchor(href: string, label: string, title?: string): string {
  const attrs = title ? ` title="${title}"` : ''

  return `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow"${attrs}>${label}</a>`
}

/** Parse a Markdown document into renderable tokens. */
export function parseMarkdown(source: string): MdToken[] {
  const lines = String(source ?? '')
    .split(SENTINEL)
    .join('')
    .replace(/\r\n?/g, '\n')
    .split('\n')

  const tokens: MdToken[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''

    if (line.trim() === '') {
      index += 1
      continue
    }

    const fence = FENCE.exec(line)
    if (fence) {
      const marker = fence[1] ?? '```'
      const body: string[] = []
      index += 1

      while (index < lines.length) {
        const current = lines[index] ?? ''
        if (current.trimStart().startsWith(marker)) {
          index += 1
          break
        }
        body.push(current)
        index += 1
      }

      tokens.push({ kind: 'code', language: (fence[2] ?? '').toLowerCase(), code: body.join('\n') })
      continue
    }

    if (RULE.test(line)) {
      tokens.push({ kind: 'rule' })
      index += 1
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      const level = Math.min(6, (heading[1] ?? '#').length) as MdHeadingLevel
      const text = heading[2] ?? ''
      tokens.push({ kind: 'heading', level, html: renderInline(text), text })
      index += 1
      continue
    }

    if (QUOTE.test(line)) {
      const body: string[] = []

      while (index < lines.length) {
        const current = lines[index] ?? ''
        const quoted = QUOTE.exec(current)
        if (!quoted) {
          if (current.trim() === '') break
          body.push(current)
        } else {
          body.push(quoted[1] ?? '')
        }
        index += 1
      }

      tokens.push({ kind: 'quote', tokens: parseMarkdown(body.join('\n')) })
      continue
    }

    if (LIST_ITEM.test(line)) {
      const items: MdListItem[] = []
      const first = LIST_ITEM.exec(line)
      const marker = first?.[2] ?? '-'
      const ordered = /\d/.test(marker)
      const start = ordered ? Number.parseInt(marker, 10) || 1 : 1

      while (index < lines.length) {
        const current = lines[index] ?? ''
        const item = LIST_ITEM.exec(current)

        if (!item) {
          // A wrapped continuation line belongs to the previous item.
          const previous = items[items.length - 1]
          if (previous && current.trim() !== '' && /^\s+\S/.test(current)) {
            previous.html += ` ${renderInline(current.trim())}`
            index += 1
            continue
          }
          break
        }

        const indent = (item[1] ?? '').replace(/\t/g, '  ').length
        items.push({
          html: renderInline(item[3] ?? ''),
          depth: Math.min(3, Math.floor(indent / 2)),
        })
        index += 1
      }

      tokens.push({ kind: 'list', ordered, start, items })
      continue
    }

    const next = lines[index + 1] ?? ''
    if (line.includes('|') && TABLE_DIVIDER.test(next)) {
      const head = splitRow(line)
      const align = splitRow(next).map<MdAlign>((cell) => {
        const left = cell.startsWith(':')
        const right = cell.endsWith(':')
        return left && right ? 'center' : right ? 'right' : 'left'
      })

      index += 2
      const rows: string[][] = []

      while (index < lines.length) {
        const current = lines[index] ?? ''
        if (current.trim() === '' || !current.includes('|')) break
        rows.push(splitRow(current).map((cell) => renderInline(cell)))
        index += 1
      }

      tokens.push({
        kind: 'table',
        head: head.map((cell) => renderInline(cell)),
        rows,
        align,
      })
      continue
    }

    // Paragraph: everything up to a blank line or the start of another block.
    const paragraph: string[] = []

    while (index < lines.length) {
      const current = lines[index] ?? ''

      if (
        current.trim() === '' ||
        FENCE.test(current) ||
        HEADING.test(current) ||
        RULE.test(current) ||
        QUOTE.test(current) ||
        LIST_ITEM.test(current)
      ) {
        break
      }

      paragraph.push(current.trim())
      index += 1
    }

    if (paragraph.length > 0) {
      tokens.push({ kind: 'paragraph', html: renderInline(paragraph.join(' ')) })
    }
  }

  return tokens
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

/** Plain-text preview of a Markdown string (cards, meta descriptions, titles). */
export function markdownToText(source: string, limit = 240): string {
  const text = String(source ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text
}

export function useMarkdown() {
  return {
    parse: parseMarkdown,
    renderInline,
    escapeHtml,
    toText: markdownToText,
    /** Reactive helper: `const tokens = md.tokens(() => block.payload.markdown)`. */
    tokens: (source: MaybeRefOrGetter<string | null | undefined>) =>
      computed<MdToken[]>(() => parseMarkdown(toValue(source) ?? '')),
  }
}

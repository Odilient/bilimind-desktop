/**
 * The maths in a chat answer. The model writes LaTeX (`$x^2$`, `$$...$$`,
 * `\(...\)`, `\[...\]`); `useMarkdown` would escape it and run emphasis over
 * the `*` and `_` inside, so it is lifted out before parsing and comes back as
 * KaTeX afterwards. KaTeX's output is its own, so nothing the model wrote
 * reaches the page as markup (`trust` stays off, so no `\href` either).
 *
 * A single `$` follows Pandoc's rule, which is what keeps money out of it:
 * the opening one has text straight after it, the closing one has text straight
 * before it and no digit after. "$5 and $15" and "$5-$15" stay prices. Code is
 * skipped, and an unclosed `$` while an answer streams stays text until it closes.
 */
import katex from 'katex'

// Not U+E000: Message.vue's streaming caret is that one.
const OPEN = '\uE0F0'
const CLOSE = '\uE0F1'

const FIND = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)|\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<![\\\w$])\$(?=[^\s$])([^$\n]*?[^\s\\$])\$(?!\d)/g

const SLOT = new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g')

export function liftMath(source: string): { text: string; restore: (html: string) => string } {
  const slots: string[] = []
  const text = source
    .replace(new RegExp(`[${OPEN}${CLOSE}]`, 'g'), '')
    .replace(FIND, (match, code: string | undefined, block: string | undefined, square: string | undefined, round: string | undefined, inline: string | undefined) => {
      if (code !== undefined) return match
      const display = block !== undefined || square !== undefined
      const tex = block ?? square ?? round ?? inline ?? ''
      slots.push(katex.renderToString(tex.trim(), { displayMode: display, throwOnError: false, output: 'html' }))
      return `${OPEN}${slots.length - 1}${CLOSE}`
    })

  return { text, restore: (html) => html.replace(SLOT, (_m, n: string) => slots[Number(n)] ?? '') }
}

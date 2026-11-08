import type { JSONContent } from '@tiptap/vue-3'
import { timecode } from '../time'

/**
 * A page as plain text: what's left when the page is pasted somewhere that
 * takes no formatting (an email, a form, a plain .txt).
 *
 * It follows `doc/markdown.ts` block for block, minus the syntax: a list
 * keeps its "- " or "1. " because the structure is the content, a to-do its
 * [ ] or [x], a table its rows with the cells tab-separated (so it pastes
 * into a spreadsheet as a table), and the app's own blocks become the words
 * they hold ("Q: … / A: …", a moment's timecode and quote). Nothing here
 * needs an editor, so a page that isn't open exports the same way.
 */

type Node = JSONContent

function inline(nodes: Node[] | undefined): string {
  return (nodes ?? [])
    .map((n) => {
      switch (n.type) {
        case 'text':
          return n.text ?? ''
        case 'hardBreak':
          return '\n'
        case 'mention':
          return `@${String(n.attrs?.label ?? '')}`
        case 'cite':
          return `(${String(n.attrs?.label ?? '')})`
        case 'inlineMath':
          return String(n.attrs?.latex ?? '')
        default:
          return inline(n.content)
      }
    })
    .join('')
}

function indent(text: string, pad: string): string {
  return text
    .split('\n')
    .map((line) => (line ? pad + line : ''))
    .join('\n')
}

function list(node: Node, marker: (i: number, item: Node) => string): string {
  return (node.content ?? [])
    .map((item, i) => {
      const lead = marker(i, item)
      const [first = '', ...rest] = blocks(item.content).split('\n')
      return lead + first + (rest.length ? '\n' + indent(rest.join('\n'), ' '.repeat(lead.length)) : '')
    })
    .join('\n')
}

function block(node: Node): string {
  const a = node.attrs ?? {}
  switch (node.type) {
    case 'paragraph':
    case 'heading':
      return inline(node.content)
    case 'bulletList':
      return list(node, () => '- ')
    case 'orderedList':
      return list(node, (i) => `${Number(a.start ?? 1) + i}. `)
    case 'taskList':
      return list(node, (_, item) => (item.attrs?.checked ? '[x] ' : '[ ] '))
    case 'blockquote':
    case 'callout':
      return indent(blocks(node.content), '  ')
    case 'codeBlock':
      return (node.content ?? []).map((n) => n.text ?? '').join('')
    case 'horizontalRule':
      return '* * *'
    case 'table':
      return (node.content ?? [])
        .map((row) => (row.content ?? []).map((cell) => blocks(cell.content).replace(/\s+/g, ' ').trim()).join('\t'))
        .join('\n')
    case 'blockMath':
      return String(a.latex ?? '')
    case 'image':
      return a.alt ? `[Image: ${String(a.alt)}]` : '[Image]'
    case 'fileBlock':
      return `${String(a.name ?? 'File')}${a.url ? ` (${String(a.url)})` : ''}`
    case 'card':
      return `Q: ${String(a.front ?? '')}\nA: ${String(a.back ?? '')}`
    case 'moment':
      return `${a.at_seconds != null ? `[${timecode(Number(a.at_seconds))}] ` : ''}"${String(a.quote ?? '')}"`
    case 'question': {
      const head = `Question: ${String(a.prompt ?? '')}`
      if (a.mode === 'short') return `${head}\nAnswer: ${String(a.answer ?? '')}`
      const options = Array.isArray(a.options) ? (a.options as string[]) : []
      return [head, ...options.map((o, i) => `${Number(a.answer) === i ? '[x]' : '[ ]'} ${o}`)].join('\n')
    }
    // A live view is filled in by the app at the time it's read; on paper it would be stale.
    case 'objectView':
      return ''
    case 'pageLink':
      return String(a.title || 'Untitled')
    default:
      return blocks(node.content)
  }
}

function blocks(nodes: Node[] | undefined): string {
  return (nodes ?? [])
    .map(block)
    .filter((out) => out !== '')
    .join('\n\n')
}

export function toText(title: string, doc: JSONContent): string {
  const body = blocks(doc.content)
  return (title ? `${title}\n\n` : '') + body + '\n'
}

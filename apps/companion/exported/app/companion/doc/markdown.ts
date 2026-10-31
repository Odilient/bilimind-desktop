import type { JSONContent } from '@tiptap/vue-3'
import { timecode } from '../time'

/**
 * A page as Markdown, so notes are never locked in.
 *
 * Plain GitHub-flavoured Markdown for everything a notes app has (headings,
 * lists, to-dos, tables, code, math), and readable text for the blocks only
 * this app has: a card becomes "Q / A", a moment its timecode and quote, a
 * live view a line saying what it showed. Toggles use `<details>`, which
 * GitHub, Obsidian and most renderers understand.
 */

type Node = JSONContent

function inline(nodes: Node[] | undefined): string {
  if (!nodes) return ''
  return nodes.map(inlineNode).join('')
}

function escapeText(value: string): string {
  return value.replace(/([\\`*_[\]<>|])/g, '\\$1')
}

function inlineNode(node: Node): string {
  switch (node.type) {
    case 'text': {
      const marks = node.marks ?? []
      const isCode = marks.some((m) => m.type === 'code')
      let out = isCode ? '`' + (node.text ?? '') + '`' : escapeText(node.text ?? '')
      for (const mark of marks) {
        if (mark.type === 'bold') out = `**${out}**`
        else if (mark.type === 'italic') out = `*${out}*`
        else if (mark.type === 'strike') out = `~~${out}~~`
        else if (mark.type === 'highlight') out = `==${out}==`
        else if (mark.type === 'link') out = `[${out}](${String(mark.attrs?.href ?? '')})`
      }
      return out
    }
    case 'hardBreak':
      return '  \n'
    case 'mention':
      return `@${String(node.attrs?.label ?? '')}`
    case 'cite':
      return `(${String(node.attrs?.label ?? '')})`
    case 'inlineMath':
      return `$${String(node.attrs?.latex ?? '')}$`
    default:
      return inline(node.content)
  }
}

function indent(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((line) => (line ? prefix + line : prefix.trimEnd()))
    .join('\n')
}

function list(node: Node, marker: (i: number, child: Node) => string): string {
  return (node.content ?? [])
    .map((item, i) => {
      const lead = marker(i, item)
      const body = blocks(item.content).trim()
      const [first = '', ...rest] = body.split('\n')
      const pad = ' '.repeat(lead.length)
      return lead + first + (rest.length ? '\n' + rest.map((l) => (l ? pad + l : '')).join('\n') : '')
    })
    .join('\n')
}

function tableToMarkdown(node: Node): string {
  const rows = (node.content ?? []).map((row) =>
    (row.content ?? []).map((cell) => blocks(cell.content).trim().replace(/\n+/g, ' ').replace(/\|/g, '\\|')),
  )
  if (!rows.length) return ''
  const width = Math.max(...rows.map((r) => r.length))
  const line = (cells: string[]) =>
    '| ' + Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ') + ' |'
  return [line(rows[0]!), line(Array.from({ length: width }, () => '---')), ...rows.slice(1).map(line)].join('\n')
}

function block(node: Node): string {
  const a = node.attrs ?? {}
  switch (node.type) {
    case 'paragraph':
      return inline(node.content)
    case 'heading':
      return '#'.repeat(Number(a.level ?? 1)) + ' ' + inline(node.content)
    case 'bulletList':
      return list(node, () => '- ')
    case 'orderedList':
      return list(node, (i) => `${Number(a.start ?? 1) + i}. `)
    case 'taskList':
      return list(node, (_, item) => (item.attrs?.checked ? '- [x] ' : '- [ ] '))
    case 'blockquote':
      return indent(blocks(node.content), '> ')
    case 'callout':
      return indent('[!NOTE]\n' + blocks(node.content), '> ')
    case 'codeBlock':
      return '```' + String(a.language ?? '') + '\n' + (node.content ?? []).map((n) => n.text ?? '').join('') + '\n```'
    case 'horizontalRule':
      return '---'
    case 'details': {
      const [summary, ...rest] = node.content ?? []
      return `<details>\n<summary>${inline(summary?.content)}</summary>\n\n${blocks(rest)}\n\n</details>`
    }
    case 'detailsContent':
      return blocks(node.content)
    case 'table':
      return tableToMarkdown(node)
    case 'blockMath':
      return '$$\n' + String(a.latex ?? '') + '\n$$'
    case 'image':
      return `![${String(a.alt ?? '')}](${String(a.src ?? '')})`
    case 'fileBlock':
      return `[${String(a.name ?? 'File')}](${String(a.url ?? '')})`
    case 'card':
      return `**Q:** ${String(a.front ?? '')}  \n**A:** ${String(a.back ?? '')}`
    case 'moment':
      return `> ${a.at_seconds != null ? `[${timecode(Number(a.at_seconds))}] ` : ''}"${String(a.quote ?? '')}"`
    case 'question': {
      const options = Array.isArray(a.options) ? (a.options as string[]) : []
      const head = `**Question:** ${String(a.prompt ?? '')}`
      if (a.mode === 'short') return `${head}  \n*Answer:* ${String(a.answer ?? '')}`
      return head + '\n\n' + options.map((o, i) => `- [${Number(a.answer) === i ? 'x' : ' '}] ${o}`).join('\n')
    }
    case 'objectView':
      return a.source === 'sessions'
        ? '*Next classes, filled in by BiliMind.*'
        : a.source === 'topics'
          ? '*The course\'s topics, filled in by BiliMind.*'
          : '*Coming up: the next deadlines, filled in by BiliMind.*'
    case 'pageLink':
      return `[${String(a.title || 'Untitled')}](${a.kind === 'board' ? '/app/b/' : '/app/p/'}${String(a.item_id ?? '')})`
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

export function toMarkdown(title: string, doc: JSONContent): string {
  const body = blocks(doc.content)
  return (title ? `# ${title}\n\n` : '') + body + '\n'
}

/** Save a Markdown file the browser way. */
export function downloadMarkdown(title: string, doc: JSONContent): void {
  const blob = new Blob([toMarkdown(title, doc)], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(title || 'page').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'page'}.md`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

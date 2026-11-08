/**
 * A page as a Word document (.docx), so notes go wherever a school wants a
 * file: a hand-in, a shared drive, Google Docs (the google workstream uploads
 * `pageToDocx` with conversion, so this is also what a Doc looks like).
 *
 * Built from the page's own document (the Tiptap JSON), not from its HTML:
 * headings are Word's headings, so the navigation pane and a table of
 * contents work; lists are real lists; a table is a table. The blocks only
 * BiliMind has become what they say, as in the Markdown export
 * (`doc/markdown.ts`): a card is "Q: … A: …", a moment its timecode and
 * quote, a question its options with the answer ticked. Formulas stay as
 * their LaTeX in a fixed-width face: Word's own equation format is a
 * different language, and a wrong conversion is worse than the source.
 *
 * Images are fetched and embedded, at most a text column wide. One that
 * can't be fetched (offline, gone) becomes "[Image: its alt text]" rather
 * than failing the whole page. The `docx` library is loaded on first use,
 * so it costs nothing until someone downloads.
 */
import type { JSONContent } from '@tiptap/vue-3'
import type { IRunOptions, Paragraph, ParagraphChild, Table } from 'docx'
import * as Y from 'yjs'
import { yXmlFragmentToProsemirrorJSON } from 'y-prosemirror'
import { attachDocPersistence } from '../doc/persistence'
import { fetchFileUrl } from '../files'
import { useCompanion } from '../store'
import { timecode } from '../time'
import type { Item } from '../types'
import { useCompanionRepo } from '../use-repo'

export interface PageContent {
  title: string
  doc: JSONContent
}

/**
 * A page's title and document, whether or not it's open: the server's copy
 * merged with this device's (`attachDocPersistence`, as opening it would, so
 * anything typed offline is in the export too), read, and closed again.
 *
 * A page nobody has opened yet has an empty document: the editor sets it out
 * on first open (`usePageEditor`'s seed). Its text is then where the seed
 * reads it from: the server's `meta.seed_html` (a Moodle page, the starter
 * kit), else its `preview` line.
 */
export async function readPage(item: Item): Promise<PageContent> {
  const ydoc = new Y.Doc()
  const persistence = attachDocPersistence(useCompanionRepo(), item.id, ydoc)
  try {
    await persistence.ready
    const title = ydoc.getText('title').toString() || item.title
    const doc = yXmlFragmentToProsemirrorJSON(ydoc.getXmlFragment('default')) as JSONContent
    return { title, doc: doc.content?.length ? doc : await unopened(item) }
  } finally {
    persistence.destroy()
    ydoc.destroy()
  }
}

async function unopened(item: Item): Promise<JSONContent> {
  const html = item.meta.seed_html?.trim()
  if (html) {
    const [{ generateJSON }, { pageExtensions }] = await Promise.all([
      import('@tiptap/vue-3'),
      import('../doc/editor/extensions'),
    ])
    return generateJSON(html, pageExtensions()) as JSONContent
  }
  const text = item.preview?.trim()
  return { type: 'doc', content: text ? [{ type: 'paragraph', content: [{ type: 'text', text }] }] : [] }
}

/** The one the google workstream uploads to Docs: any page, open or not. */
export async function pageToDocx(item: Item): Promise<Blob> {
  const page = await readPage(item)
  return docToDocx(page.title, page.doc)
}

/* -- Images ------------------------------------------------------------------ */

interface Picture {
  data: Uint8Array
  type: 'png' | 'jpg' | 'gif' | 'bmp'
  width: number
  height: number
}

/** Pixels at Word's 96 dpi: A4's text column inside the default margins. */
const COLUMN = 600

const WORD_TYPES: Record<string, Picture['type']> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
}

async function picture(src: string): Promise<Picture> {
  const res = await fetch(src, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`${res.status}`)
  let blob = await res.blob()
  const bitmap = await createImageBitmap(blob)
  try {
    let type = WORD_TYPES[blob.type]
    if (!type) {
      // WebP and AVIF (most phone screenshots now) are images Word can't open: they go in as PNG.
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
      blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'),
      )
      type = 'png'
    }
    const k = Math.min(1, COLUMN / bitmap.width)
    return {
      data: new Uint8Array(await blob.arrayBuffer()),
      type,
      width: Math.round(bitmap.width * k),
      height: Math.round(bitmap.height * k),
    }
  } finally {
    bitmap.close()
  }
}

/**
 * Every image on the page, fetched at once before the document is built. The
 * link in the page can be a signed one that has since run out, so an image
 * that's also an item of theirs is asked for again under a fresh link.
 */
async function pictures(doc: JSONContent): Promise<Map<string, Picture | null>> {
  const found = new Map<string, string | null>()
  const walk = (n: JSONContent) => {
    if (n.type === 'image' && n.attrs?.src) found.set(String(n.attrs.src), (n.attrs.item_id as string | null) ?? null)
    n.content?.forEach(walk)
  }
  walk(doc)
  const store = useCompanion()
  const out = new Map<string, Picture | null>()
  await Promise.all(
    [...found].map(async ([src, itemId]) => {
      try {
        out.set(src, await picture(src))
      } catch {
        const item = itemId ? store.get('items', itemId) : null
        const fresh = item ? await fetchFileUrl(item) : null
        out.set(src, fresh && fresh !== src ? await picture(fresh).catch(() => null) : null)
      }
    }),
  )
  return out
}

/* -- The document ------------------------------------------------------------ */

const MONO = 'Consolas'
/** Twips (1/20 pt): how far a quote, a callout or an item's second paragraph steps in. */
const STEP = 567

interface Ctx {
  /** List depth, 0 outside any list. */
  level: number
  /** Left indent in twips for plain paragraphs. */
  indent: number
  quote?: boolean
  shade?: string
  run?: IRunOptions
}

export async function docToDocx(title: string, doc: JSONContent): Promise<Blob> {
  const d = await import('docx')
  const images = await pictures(doc)
  let lists = 0

  const HEADINGS = [d.HeadingLevel.HEADING_1, d.HeadingLevel.HEADING_2, d.HeadingLevel.HEADING_3]

  /** Text with its own line breaks kept: a run per line, a break before each after the first. */
  function lines(text: string, opts: IRunOptions = {}): ParagraphChild[] {
    return text.split('\n').map((line, i) => new d.TextRun({ ...opts, text: line, break: i ? 1 : 0 }))
  }

  function link(text: string, href: string, opts: IRunOptions = {}): ParagraphChild {
    const run = new d.TextRun({ ...opts, text, style: 'Hyperlink' })
    // Only addresses that open from a file; an app path like /app/p/… goes nowhere outside the app.
    return /^(https?:|mailto:)/i.test(href) ? new d.ExternalHyperlink({ link: href, children: [run] }) : run
  }

  function runs(nodes: JSONContent[] | undefined, base: IRunOptions = {}): ParagraphChild[] {
    return (nodes ?? []).flatMap((n): ParagraphChild[] => {
      switch (n.type) {
        case 'text': {
          const marks = new Map((n.marks ?? []).map((m) => [m.type, m.attrs ?? {}]))
          const opts: IRunOptions = {
            ...base,
            bold: base.bold || marks.has('bold'),
            italics: base.italics || marks.has('italic'),
            strike: marks.has('strike'),
            ...(marks.has('underline') ? { underline: {} } : {}),
            ...(marks.has('highlight') ? { highlight: d.HighlightColor.YELLOW } : {}),
            ...(marks.has('code') ? { font: MONO } : {}),
            ...(marks.has('subscript') ? { subScript: true } : {}),
            ...(marks.has('superscript') ? { superScript: true } : {}),
          }
          const href = marks.get('link')?.href
          return href ? [link(n.text ?? '', String(href), opts)] : [new d.TextRun({ ...opts, text: n.text ?? '' })]
        }
        case 'hardBreak':
          return [new d.TextRun({ break: 1 })]
        case 'mention':
          return [new d.TextRun({ ...base, text: `@${String(n.attrs?.label ?? '')}` })]
        case 'cite':
          return [new d.TextRun({ ...base, text: `(${String(n.attrs?.label ?? '')})`, color: '6B7280' })]
        case 'inlineMath':
          return [new d.TextRun({ ...base, text: String(n.attrs?.latex ?? ''), font: MONO })]
        default:
          return runs(n.content, base)
      }
    })
  }

  /** A plain paragraph in its surroundings: stepped in, and ruled or shaded inside a quote or a callout. */
  function para(children: ParagraphChild[], ctx: Ctx): Paragraph {
    return new d.Paragraph({
      children,
      ...(ctx.indent ? { indent: { left: ctx.indent } } : {}),
      ...(ctx.quote ? { border: { left: { style: d.BorderStyle.SINGLE, size: 12, color: 'C7CBD3', space: 8 } } } : {}),
      ...(ctx.shade ? { shading: { type: d.ShadingType.CLEAR, color: 'auto', fill: ctx.shade } } : {}),
    })
  }

  function list(node: JSONContent, ctx: Ctx, kind: 'bullet' | 'ordered' | 'task'): (Paragraph | Table)[] {
    // Each ordered list counts from 1 again: a numbering instance of its own.
    const instance = kind === 'ordered' ? ++lists : 0
    const level = Math.min(ctx.level, 8)
    return (node.content ?? []).flatMap((item) => {
      const [first, ...rest] = item.content ?? []
      const lead = first?.type === 'paragraph' ? runs(first.content, ctx.run) : []
      const head =
        kind === 'task'
          ? new d.Paragraph({
            children: [new d.TextRun(item.attrs?.checked ? '☑ ' : '☐ '), ...lead],
            ...(ctx.indent ? { indent: { left: ctx.indent } } : {}),
          })
          : new d.Paragraph({
            children: lead,
            ...(kind === 'bullet' ? { bullet: { level } } : { numbering: { reference: 'ordered', level, instance } }),
          })
      const inner = blocks(first?.type === 'paragraph' ? rest : item.content, {
        ...ctx,
        level: ctx.level + 1,
        // What follows an item's first line sits under its text; a list inside it steps in again from there.
        indent: ctx.indent + STEP,
      })
      return [head, ...inner]
    })
  }

  function table(node: JSONContent): Table {
    const rows = node.content ?? []
    const width = Math.max(1, ...rows.map((r) => (r.content ?? []).reduce((n, c) => n + Number(c.attrs?.colspan ?? 1), 0)))
    return new d.Table({
      width: { size: 100, type: d.WidthType.PERCENTAGE },
      // LibreOffice and Google Docs need the grid spelled out; Word fits it either way.
      columnWidths: Array.from({ length: width }, () => Math.floor(9000 / width)),
      rows: rows.map((row) => {
        const head = (row.content ?? []).every((c) => c.type === 'tableHeader')
        return new d.TableRow({
          tableHeader: head,
          children: (row.content ?? []).map((cell) => {
            const inside = blocks(cell.content, { level: 0, indent: 0, run: head ? { bold: true } : undefined })
            const across = Number(cell.attrs?.colspan ?? 1)
            const down = Number(cell.attrs?.rowspan ?? 1)
            return new d.TableCell({
              // A cell must hold a paragraph, even an empty one, or Word calls the file damaged.
              children: inside.length ? inside : [new d.Paragraph('')],
              ...(across > 1 ? { columnSpan: across } : {}),
              ...(down > 1 ? { rowSpan: down } : {}),
            })
          }),
        })
      }),
    })
  }

  function block(node: JSONContent, ctx: Ctx): (Paragraph | Table)[] {
    const a = node.attrs ?? {}
    switch (node.type) {
      case 'paragraph':
        return [para(runs(node.content, ctx.run), ctx)]
      case 'heading':
        return [new d.Paragraph({ heading: HEADINGS[Math.min(3, Math.max(1, Number(a.level ?? 1))) - 1], children: runs(node.content) })]
      case 'bulletList':
        return list(node, ctx, 'bullet')
      case 'orderedList':
        return list(node, ctx, 'ordered')
      case 'taskList':
        return list(node, ctx, 'task')
      case 'blockquote':
        return blocks(node.content, { ...ctx, indent: ctx.indent + STEP, quote: true })
      case 'callout':
        return blocks(node.content, { ...ctx, indent: ctx.indent + STEP / 2, shade: 'F1F3F7' })
      case 'codeBlock':
        return [
          para(lines((node.content ?? []).map((n) => n.text ?? '').join(''), { font: MONO, size: 20 }), {
            ...ctx,
            shade: 'F4F5F7',
          }),
        ]
      case 'horizontalRule':
        return [new d.Paragraph({ border: { bottom: { style: d.BorderStyle.SINGLE, size: 6, color: 'C7CBD3', space: 1 } } })]
      case 'details': {
        const [summary, ...rest] = node.content ?? []
        return [para(runs(summary?.content, { bold: true }), ctx), ...blocks(rest, ctx)]
      }
      case 'table':
        return [table(node)]
      case 'blockMath':
        return [para([new d.TextRun({ text: String(a.latex ?? ''), font: MONO })], ctx)]
      case 'image': {
        const pic = images.get(String(a.src ?? ''))
        if (!pic) return [para([new d.TextRun({ text: a.alt ? `[Image: ${String(a.alt)}]` : '[Image]', italics: true })], ctx)]
        return [para([new d.ImageRun({ type: pic.type, data: pic.data, transformation: { width: pic.width, height: pic.height } })], ctx)]
      }
      case 'fileBlock':
        return [para([link(String(a.name ?? 'File'), String(a.url ?? ''))], ctx)]
      case 'card':
        return [
          para([new d.TextRun({ text: 'Q: ', bold: true }), ...lines(String(a.front ?? ''))], ctx),
          para([new d.TextRun({ text: 'A: ', bold: true }), ...lines(String(a.back ?? ''))], ctx),
        ]
      case 'moment':
        return [
          para(
            [
              ...(a.at_seconds != null ? [new d.TextRun({ text: `[${timecode(Number(a.at_seconds))}] `, color: '6B7280' })] : []),
              ...lines(`“${String(a.quote ?? '')}”`, { italics: true }),
            ],
            ctx,
          ),
        ]
      case 'question': {
        const head = para([new d.TextRun({ text: 'Question: ', bold: true }), ...lines(String(a.prompt ?? ''))], ctx)
        if (a.mode === 'short') {
          return [head, para([new d.TextRun({ text: 'Answer: ', italics: true }), ...lines(String(a.answer ?? ''))], ctx)]
        }
        const options = Array.isArray(a.options) ? (a.options as string[]) : []
        return [
          head,
          ...options.map((o, i) =>
            para([new d.TextRun(`${Number(a.answer) === i ? '☑' : '☐'} ${o}`)], { ...ctx, indent: ctx.indent + STEP / 2 }),
          ),
        ]
      }
      // A live view is filled in by the app when it's read; in a file it would be stale.
      case 'objectView':
        return []
      case 'pageLink':
        return [para([new d.TextRun({ text: String(a.title || 'Untitled'), underline: {} })], ctx)]
      default:
        return blocks(node.content, ctx)
    }
  }

  function blocks(nodes: JSONContent[] | undefined, ctx: Ctx): (Paragraph | Table)[] {
    return (nodes ?? []).flatMap((n) => block(n, ctx))
  }

  const body = blocks(doc.content, { level: 0, indent: 0 })
  const file = new d.Document({
    creator: 'BiliMind',
    title: title || 'Untitled',
    numbering: {
      config: [
        {
          reference: 'ordered',
          levels: Array.from({ length: 9 }, (_, level) => ({
            level,
            format: d.LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: d.AlignmentType.START,
            style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
          })),
        },
      ],
    },
    sections: [{ children: [new d.Paragraph({ heading: d.HeadingLevel.TITLE, text: title || 'Untitled' }), ...body] }],
  })
  return d.Packer.toBlob(file)
}

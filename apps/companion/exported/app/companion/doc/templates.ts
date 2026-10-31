import type { JSONContent } from '@tiptap/vue-3'
import type { Deadline } from '../types'
import type { PageContext } from './context'

/**
 * Templates made for learning, filled from where the page lives.
 *
 * A template is a starting shape, not a form: headings to write under, a table
 * with the right columns, and the parts the app already knows filled in (the
 * class, the lab that's due, a live list of what's coming up). Everything is
 * plain ProseMirror JSON, so the same output seeds a new page's Y.Doc and can
 * be inserted into an existing one.
 */

export type TemplateKey = 'blank' | 'lecture' | 'cornell' | 'lab' | 'reading' | 'vocab'

export interface TemplateInfo {
  key: TemplateKey
  label: string
  hint: string
  icon: string
}

export const TEMPLATES: TemplateInfo[] = [
  { key: 'lecture', label: 'Lecture notes', hint: 'Filed under the class, recording linked', icon: 'pencil' },
  { key: 'cornell', label: 'Cornell notes', hint: 'Cues, notes, then a summary', icon: 'table' },
  { key: 'lab', label: 'Lab report', hint: 'Aim, method, results, conclusion', icon: 'flow' },
  { key: 'reading', label: 'Reading notes', hint: 'Source, your words, quotes', icon: 'book' },
  { key: 'vocab', label: 'Vocabulary list', hint: 'Every row becomes a card', icon: 'cards' },
  { key: 'blank', label: 'Empty page', hint: 'Start from nothing', icon: 'file' },
]

export function isTemplateKey(value: unknown): value is TemplateKey {
  return TEMPLATES.some((t) => t.key === value)
}

/** Older keys the server seed used, so no row carrying one opens blank. */
const ALIASES: Record<string, TemplateKey> = { 'lecture-notes': 'lecture', lesson: 'vocab', report: 'lab' }

export function resolveTemplateKey(value: unknown): TemplateKey | null {
  if (isTemplateKey(value)) return value
  return typeof value === 'string' ? ALIASES[value] ?? null : null
}

/**
 * The first content of a page that only has a `preview` (a seeded page whose
 * text lives in its row): that line, then the template's sections under it.
 */
export function previewDoc(preview: string, key: TemplateKey | null, ctx: PageContext): JSONContent {
  const body = key && key !== 'blank' ? templateDoc(key, ctx).content ?? [] : []
  return { type: 'doc', content: [para(preview), ...body] }
}

/* -- Little builders ------------------------------------------------------- */

const text = (value: string, marks?: JSONContent['marks']): JSONContent =>
  marks ? { type: 'text', text: value, marks } : { type: 'text', text: value }
const bold = (value: string) => text(value, [{ type: 'bold' }])

function para(...inline: (JSONContent | string)[]): JSONContent {
  const content = inline.filter((i) => i !== '').map((i) => (typeof i === 'string' ? text(i) : i))
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}

const heading = (level: 1 | 2 | 3, value: string): JSONContent => ({
  type: 'heading',
  attrs: { level },
  content: value ? [text(value)] : undefined,
})

const bullets = (...items: JSONContent[][]): JSONContent => ({
  type: 'bulletList',
  content: items.map((inline) => ({ type: 'listItem', content: [para(...inline)] })),
})

const ordered = (count: number): JSONContent => ({
  type: 'orderedList',
  attrs: { start: 1 },
  content: Array.from({ length: count }, () => ({ type: 'listItem', content: [para()] })),
})

const tasks = (...labels: string[]): JSONContent => ({
  type: 'taskList',
  content: labels.map((label) => ({ type: 'taskItem', attrs: { checked: false }, content: [para(label)] })),
})

const callout = (icon: string, ...inline: (JSONContent | string)[]): JSONContent => ({
  type: 'callout',
  attrs: { icon },
  content: [para(...inline)],
})

/** A table; `firstWidth` narrows the first column (Cornell's cue column). */
function table(header: string[], rows: number, firstWidth?: number): JSONContent {
  const cell = (type: 'tableHeader' | 'tableCell', i: number, value = ''): JSONContent => ({
    type,
    ...(i === 0 && firstWidth ? { attrs: { colwidth: [firstWidth] } } : {}),
    content: [para(value)],
  })
  return {
    type: 'table',
    content: [
      { type: 'tableRow', content: header.map((h, i) => cell('tableHeader', i, h)) },
      ...Array.from({ length: rows }, () => ({
        type: 'tableRow',
        content: header.map((_, i) => cell('tableCell', i)),
      })),
    ],
  }
}

const mention = (kind: 'deadline' | 'topic' | 'date', id: string, label: string): JSONContent => ({
  type: 'mention',
  attrs: { kind, id, label },
})

const deadlinesView = (subjectId: string | null): JSONContent => ({
  type: 'objectView',
  attrs: { source: 'deadlines', subject_id: subjectId, scope: 'course' },
})

function nextOf(ctx: PageContext, kinds: Deadline['kind'][]): Deadline | null {
  const now = Date.now()
  return (
    ctx.deadlines.find(
      (d) => kinds.includes(d.kind) && d.status === 'upcoming' && (!d.due_at || Date.parse(d.due_at) > now),
    ) ?? null
  )
}

/* -- Titles ---------------------------------------------------------------- */

export function templateTitle(key: TemplateKey, ctx: PageContext): string {
  const topic = ctx.topic?.title
  const session = ctx.session?.title
  switch (key) {
    case 'lecture':
      return [session, topic].filter(Boolean).join(' · ') || 'Lecture notes'
    case 'cornell':
      return `Cornell notes${topic || session ? ` · ${topic ?? session}` : ''}`
    case 'lab':
      return nextOf(ctx, ['lab'])?.title ?? (session ? `${session} report` : 'Lab report')
    case 'reading':
      return `Reading${topic ? ` · ${topic}` : ''}`
    case 'vocab':
      return `Vocabulary${topic ? ` · ${topic}` : ''}`
    default:
      return ''
  }
}

/* -- Bodies ---------------------------------------------------------------- */

export function templateDoc(key: TemplateKey, ctx: PageContext): JSONContent {
  const subjectId = ctx.subject?.id ?? null
  const upcoming = ctx.deadlines.some((d) => d.status === 'upcoming')

  switch (key) {
    case 'lecture':
      return {
        type: 'doc',
        content: [
          heading(2, 'Main ideas'),
          bullets([]),
          heading(2, 'Worked example'),
          para(),
          heading(2, 'Exam hints'),
          callout('flag'),
          heading(2, 'Still unclear'),
          tasks(''),
          // The block titles itself ("Coming up · Databases").
          ...(upcoming ? [deadlinesView(subjectId)] : []),
        ],
      }

    case 'cornell':
      return {
        type: 'doc',
        content: [table(['Cues and questions', 'Notes'], 4, 220), heading(2, 'Summary'), para()],
      }

    case 'lab': {
      const due = nextOf(ctx, ['lab', 'assignment'])
      return {
        type: 'doc',
        content: [
          ...(due ? [callout('clock', 'Due ', mention('deadline', due.id, due.title))] : []),
          heading(2, 'Aim'),
          para(),
          heading(2, 'Hypothesis'),
          para(),
          heading(2, 'Method'),
          ordered(3),
          heading(2, 'Results'),
          table(['Trial', 'Measurement', 'Notes'], 3),
          heading(2, 'Analysis'),
          para(),
          heading(2, 'Conclusion'),
          para(),
        ],
      }
    }

    case 'reading':
      return {
        type: 'doc',
        content: [
          bullets([bold('Source: ')], [bold('Pages: ')]),
          heading(2, 'In my own words'),
          para(),
          heading(2, 'Quotes worth keeping'),
          { type: 'blockquote', content: [para()] },
          heading(2, 'Questions it raises'),
          tasks(''),
          ...(ctx.topic
            ? [heading(2, 'Where it fits'), para('Part of ', mention('topic', ctx.topic.id, ctx.topic.title), '.')]
            : []),
        ],
      }

    case 'vocab':
      return {
        type: 'doc',
        content: [
          para('Every row with a word and a meaning becomes a card.'),
          table(['Word', 'Meaning', 'Example'], 4),
        ],
      }

    default:
      return { type: 'doc', content: [para()] }
  }
}

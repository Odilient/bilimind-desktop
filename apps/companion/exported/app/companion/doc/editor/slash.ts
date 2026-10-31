import { Extension } from '@tiptap/vue-3'
import type { Editor, Range } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import type { Item } from '../../types'
import { timecode } from '../../time'
import { knownFileUrl } from '../../files'
import { menuRenderer, type MenuState } from './menu'

/**
 * The "/" menu. Four groups: the blocks every notes app has, the ones only a
 * learning app has, media, and embeds. Each entry is a label a student would
 * use, a one-line hint, and what it does.
 */

export type SlashGroup = 'Basic' | 'Learning' | 'Media' | 'Embeds'

export interface SlashItem {
  id: string
  label: string
  hint: string
  group: SlashGroup
  icon: string
  keywords?: string[]
  /** Hidden where it can't work, e.g. a moment on a page with no recording. */
  available?: () => boolean
  /** Chains return a boolean, uploads a promise; neither is used. */
  run: (editor: Editor, range: Range) => unknown
}

/** What the "/" menu needs from the page that hosts the editor. */
export interface PageActions {
  createChild(kind: 'page' | 'board'): Promise<Item>
  pickFile(accept: string, capture?: boolean): Promise<File | null>
  upload(file: File): Promise<Item | null>
  /** The recording's latest second and what was said there, for a new moment. */
  momentNow(): { item_id: string | null; at_seconds: number; quote: string; live: boolean } | null
  /** The course decides: SQL for Databases, Python otherwise. */
  codeLanguage(): string
  subjectId(): string | null
}

export const SLASH_GROUPS: SlashGroup[] = ['Basic', 'Learning', 'Media', 'Embeds']

export async function insertUpload(editor: Editor, actions: PageActions, file: File): Promise<void> {
  const item = await actions.upload(file)
  if (!item) return
  // Kept in the node as a fallback only; the block resolves a fresh link from
  // the item each time it's drawn (signed links expire).
  const url = knownFileUrl(item)
  if (item.kind === 'photo' || file.type.startsWith('image/')) {
    editor.chain().focus().insertContent({ type: 'image', attrs: { src: url, alt: item.title, item_id: item.id } }).run()
  } else {
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'fileBlock',
        attrs: { item_id: item.id, name: item.title, url, mime: item.meta.mime ?? file.type, size: item.meta.size ?? file.size },
      })
      .run()
  }
}

export function slashItems(actions: PageActions): SlashItem[] {
  const del = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range)

  async function child(editor: Editor, range: Range, kind: 'page' | 'board') {
    del(editor, range).run()
    const item = await actions.createChild(kind)
    editor
      .chain()
      .focus()
      .insertContent({ type: 'pageLink', attrs: { item_id: item.id, kind, title: item.title } })
      .run()
  }

  async function media(editor: Editor, range: Range, accept: string, capture = false) {
    del(editor, range).run()
    const file = await actions.pickFile(accept, capture)
    if (file) await insertUpload(editor, actions, file)
  }

  const view = (source: string) => (editor: Editor, range: Range) =>
    del(editor, range)
      .insertContent({
        type: 'objectView',
        attrs: { source, subject_id: actions.subjectId(), scope: actions.subjectId() ? 'course' : 'all' },
      })
      .run()

  const moment = actions.momentNow()

  return [
    // Basic
    { id: 'text', label: 'Text', hint: 'Just start writing', group: 'Basic', icon: 'text', keywords: ['paragraph'],
      run: (e, r) => del(e, r).setParagraph().run() },
    { id: 'h1', label: 'Heading 1', hint: 'Big section', group: 'Basic', icon: 'h1', keywords: ['title', '#'],
      run: (e, r) => del(e, r).setNode('heading', { level: 1 }).run() },
    { id: 'h2', label: 'Heading 2', hint: 'Medium section', group: 'Basic', icon: 'h2', keywords: ['subtitle', '##'],
      run: (e, r) => del(e, r).setNode('heading', { level: 2 }).run() },
    { id: 'h3', label: 'Heading 3', hint: 'Small section', group: 'Basic', icon: 'h3', keywords: ['###'],
      run: (e, r) => del(e, r).setNode('heading', { level: 3 }).run() },
    { id: 'bullets', label: 'Bulleted list', hint: 'A simple list', group: 'Basic', icon: 'bullets', keywords: ['ul', 'unordered'],
      run: (e, r) => del(e, r).toggleBulletList().run() },
    { id: 'numbers', label: 'Numbered list', hint: 'Steps in order', group: 'Basic', icon: 'numbers', keywords: ['ol', 'ordered'],
      run: (e, r) => del(e, r).toggleOrderedList().run() },
    { id: 'todo', label: 'To-do list', hint: 'Tick things off', group: 'Basic', icon: 'todo', keywords: ['task', 'checkbox', 'check'],
      run: (e, r) => del(e, r).toggleTaskList().run() },
    { id: 'toggle', label: 'Toggle', hint: 'Hide the details inside', group: 'Basic', icon: 'toggle', keywords: ['details', 'collapse', 'fold'],
      run: (e, r) => del(e, r).setDetails().run() },
    { id: 'callout', label: 'Callout', hint: 'Make it stand out', group: 'Basic', icon: 'bulb', keywords: ['note', 'tip', 'warning', 'hint'],
      run: (e, r) => del(e, r).setCallout('bulb').run() },
    { id: 'quote', label: 'Quote', hint: 'Somebody else\'s words', group: 'Basic', icon: 'quote', keywords: ['blockquote', 'citation'],
      run: (e, r) => del(e, r).toggleBlockquote().run() },
    { id: 'divider', label: 'Divider', hint: 'A line across', group: 'Basic', icon: 'divider', keywords: ['hr', 'rule', 'line', '---'],
      run: (e, r) => del(e, r).setHorizontalRule().run() },
    { id: 'table', label: 'Table', hint: 'Rows and columns', group: 'Basic', icon: 'table', keywords: ['grid'],
      run: (e, r) => del(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { id: 'code', label: 'Code', hint: 'Runs here: Python, JavaScript, SQL', group: 'Basic', icon: 'code',
      keywords: ['python', 'javascript', 'sql', 'snippet', 'program'],
      run: (e, r) => del(e, r).setCodeBlock({ language: actions.codeLanguage() }).run() },

    // Learning
    { id: 'moment', label: 'Moment from the recording', group: 'Learning', icon: 'play',
      hint: moment ? (moment.live ? `${timecode(moment.at_seconds)}, what was just said` : 'A second of the class, with its words') : 'Needs a class recording',
      keywords: ['recording', 'audio', 'timestamp', 'transcript', 'lecture'],
      available: () => actions.momentNow() !== null,
      run: (e, r) => {
        const m = actions.momentNow()
        if (!m) return
        del(e, r).insertContent({ type: 'moment', attrs: { item_id: m.item_id, at_seconds: m.at_seconds, quote: m.quote } }).run()
      } },
    { id: 'card', label: 'Card', hint: 'Becomes a flashcard', group: 'Learning', icon: 'card', keywords: ['flashcard', 'anki', 'remember', 'fsrs'],
      run: (e, r) => del(e, r).insertContent({ type: 'card', attrs: { card_id: crypto.randomUUID(), front: '', back: '' } }).run() },
    { id: 'question', label: 'Question', hint: 'Practice, checked on the spot', group: 'Learning', icon: 'question',
      keywords: ['quiz', 'multiple choice', 'mcq', 'test', 'practice'],
      run: (e, r) => del(e, r).insertContent({ type: 'question', attrs: { mode: 'choice', options: ['', '', ''] } }).run() },
    { id: 'short', label: 'Short answer', hint: 'Type the answer, checked here', group: 'Learning', icon: 'pencil',
      keywords: ['quiz', 'question', 'recall', 'practice'],
      run: (e, r) => del(e, r).insertContent({ type: 'question', attrs: { mode: 'short', options: [] } }).run() },
    { id: 'view-deadlines', label: 'Coming up', hint: "What's due next, filled in for you", group: 'Learning', icon: 'calendar',
      keywords: ['deadlines', 'tracker', 'assignments', 'database', 'due'], run: view('deadlines') },
    { id: 'view-sessions', label: 'Next classes', hint: 'The classes coming up, filled in for you', group: 'Learning', icon: 'calendar',
      keywords: ['classes', 'lectures', 'timetable', 'schedule'], run: view('sessions') },
    { id: 'view-topics', label: 'Topics', hint: 'What the course covers, and what tests it', group: 'Learning', icon: 'list',
      keywords: ['syllabus', 'units', 'scope'], run: view('topics') },

    // Media
    { id: 'image', label: 'Image', hint: 'From your files', group: 'Media', icon: 'image', keywords: ['picture', 'png', 'jpg', 'upload'],
      run: (e, r) => media(e, r, 'image/*') },
    { id: 'photo', label: 'Photo', hint: 'The whiteboard, a page', group: 'Media', icon: 'camera', keywords: ['camera', 'whiteboard', 'snap'],
      run: (e, r) => media(e, r, 'image/*', true) },
    { id: 'file', label: 'File', hint: 'Slides, a PDF, anything', group: 'Media', icon: 'file', keywords: ['pdf', 'attachment', 'upload', 'slides'],
      run: (e, r) => media(e, r, '*/*') },

    // Embeds
    { id: 'page', label: 'Page', hint: 'A page inside this one', group: 'Embeds', icon: 'page', keywords: ['subpage', 'nested', 'child', 'link'],
      run: (e, r) => child(e, r, 'page') },
    { id: 'board', label: 'Board', hint: 'Draw it out', group: 'Embeds', icon: 'board', keywords: ['whiteboard', 'canvas', 'mind map', 'miro'],
      run: (e, r) => child(e, r, 'board') },
    { id: 'math', label: 'Math', hint: 'A formula on its own line', group: 'Embeds', icon: 'math', keywords: ['latex', 'equation', 'katex', 'formula'],
      // insertContent, not insertBlockMath: that one reads the selection from
      // before this chain's deleteRange, which points past the shorter doc.
      run: (e, r) => del(e, r).insertContent({ type: 'blockMath', attrs: { latex: 'E = mc^2' } }).run() },
    { id: 'inline-math', label: 'Inline formula', hint: 'Math inside a sentence', group: 'Embeds', icon: 'math', keywords: ['latex', 'equation'],
      run: (e, r) => del(e, r).insertContent({ type: 'inlineMath', attrs: { latex: 'x^2' } }).run() },
    { id: 'diagram', label: 'Diagram', hint: 'Flowchart from text (Mermaid)', group: 'Embeds', icon: 'flow', keywords: ['mermaid', 'flowchart', 'graph', 'chart'],
      run: (e, r) => del(e, r).insertContent({ type: 'codeBlock', attrs: { language: 'mermaid' }, content: [{ type: 'text', text: 'graph LR\n  A[Begin] --> B[Update]\n  B --> C{OK?}\n  C -->|yes| D[Commit]\n  C -->|no| E[Rollback]' }] }).run() },
  ]
}

/** Matches "/h2", "/todo", "/flash" against labels and keywords, best first. */
export function filterSlash(items: SlashItem[], query: string): SlashItem[] {
  const q = query.trim().toLowerCase()
  const usable = items.filter((item) => item.available?.() ?? true)
  if (!q) return usable
  const scored = usable
    .map((item) => {
      const label = item.label.toLowerCase()
      let score = -1
      if (label.startsWith(q)) score = 3
      else if (label.split(/\s+/).some((w) => w.startsWith(q))) score = 2
      else if (item.keywords?.some((k) => k.startsWith(q)) || item.id.startsWith(q)) score = 1
      else if (label.includes(q) || item.hint.toLowerCase().includes(q)) score = 0
      return { item, score }
    })
    .filter((row) => row.score >= 0)
  return scored.sort((a, b) => b.score - a.score).map((row) => row.item)
}

export const slashKey = new PluginKey('page-slash')

export const SlashCommand = Extension.create<{ state: MenuState<SlashItem> | null; items: () => SlashItem[] }>({
  name: 'slashCommand',

  addOptions() {
    return { state: null, items: () => [] }
  },

  addProseMirrorPlugins() {
    const state = this.options.state
    if (!state) return []
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        pluginKey: slashKey,
        char: '/',
        allowSpaces: false,
        // Start of a line, or after a space: "and/or" is not a command.
        allowedPrefixes: [' ', ' '],
        allow: ({ state: s, range }) => {
          const $from = s.doc.resolve(range.from)
          return $from.parent.type.name !== 'codeBlock'
        },
        items: ({ query }) => filterSlash(this.options.items(), query),
        command: ({ editor, range, props }) => {
          void props.run(editor, range)
        },
        render: menuRenderer(state, slashKey),
      }),
    ]
  },
})

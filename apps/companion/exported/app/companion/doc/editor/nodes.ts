import { Mark, Node, mergeAttributes, VueNodeViewRenderer } from '@tiptap/vue-3'
import CalloutView from '~/components/page/node/Callout.vue'
import CardView from '~/components/page/node/Card.vue'
import MomentView from '~/components/page/node/Moment.vue'
import QuestionView from '~/components/page/node/Question.vue'
import ObjectViewView from '~/components/page/node/View.vue'
import PageLinkView from '~/components/page/node/PageLink.vue'
import MentionView from '~/components/page/node/Mention.vue'
import CiteView from '~/components/page/node/Cite.vue'
import ImageView from '~/components/page/node/Image.vue'
import FileView from '~/components/page/node/File.vue'

/**
 * The blocks a notes app has that TipTap's free set doesn't (callout, image,
 * file, highlight), and the ones only a learning app has (card, moment,
 * question, live view, page link, mention, source chip).
 *
 * Every attribute round-trips through `data-*` HTML so copy and paste between
 * pages keeps the block whole. In the Y.Doc they're plain attributes.
 */

/** Reads a `data-*` attribute that holds JSON, tolerating plain strings. */
function jsonAttr(name: string, fallback: unknown) {
  return {
    default: fallback,
    parseHTML: (el: HTMLElement) => {
      const raw = el.getAttribute(`data-${name}`)
      if (raw == null) return fallback
      try {
        return JSON.parse(raw)
      } catch {
        return raw
      }
    },
    renderHTML: (attrs: Record<string, unknown>) =>
      attrs[name] == null ? {} : { [`data-${name}`]: JSON.stringify(attrs[name]) },
  }
}

/** A scalar `data-*` attribute. Numbers come back as numbers. */
function dataAttr(name: string, fallback: string | number | boolean | null = null, numeric = false) {
  return {
    default: fallback,
    parseHTML: (el: HTMLElement) => {
      const raw = el.getAttribute(`data-${name.replace(/_/g, '-')}`)
      if (raw == null) return fallback
      return numeric ? Number(raw) : raw
    },
    renderHTML: (attrs: Record<string, unknown>) =>
      attrs[name] == null ? {} : { [`data-${name.replace(/_/g, '-')}`]: String(attrs[name]) },
  }
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: { setCallout: (icon?: string) => ReturnType }
    highlight: { toggleHighlight: () => ReturnType }
  }
}

/* -- Marks ----------------------------------------------------------------- */

export const Highlight = Mark.create({
  name: 'highlight',
  parseHTML: () => [{ tag: 'mark' }],
  renderHTML: ({ HTMLAttributes }) => ['mark', mergeAttributes(HTMLAttributes, { class: 'pg-mark' }), 0],
  addCommands() {
    return { toggleHighlight: () => ({ commands }) => commands.toggleMark(this.name) }
  },
  addKeyboardShortcuts() {
    return { 'Mod-Shift-h': () => this.editor.commands.toggleHighlight() }
  },
})

/* -- Notes-app blocks ------------------------------------------------------ */

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'paragraph+',
  defining: true,
  draggable: true,
  addAttributes: () => ({
    icon: dataAttr('icon', 'bulb'),
    /** Set when the callout came from "What did I miss?", so it's offered once. */
    gap_id: dataAttr('gap_id'),
  }),
  parseHTML: () => [{ tag: 'div[data-type="callout"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout' }), 0],
  addNodeView: () => VueNodeViewRenderer(CalloutView),
  addCommands() {
    return { setCallout: (icon = 'bulb') => ({ commands }) => commands.wrapIn(this.name, { icon }) }
  },
})

export const Image = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes: () => ({
    src: { default: null },
    alt: { default: null },
    item_id: dataAttr('item_id'),
  }),
  parseHTML: () => [{ tag: 'img[src]' }],
  renderHTML: ({ HTMLAttributes }) => ['img', mergeAttributes(HTMLAttributes)],
  addNodeView: () => VueNodeViewRenderer(ImageView),
})

export const FileBlock = Node.create({
  name: 'fileBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes: () => ({
    item_id: dataAttr('item_id'),
    name: dataAttr('name', 'File'),
    url: dataAttr('url'),
    mime: dataAttr('mime'),
    size: dataAttr('size', null, true),
  }),
  parseHTML: () => [{ tag: 'div[data-type="file"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'file' })],
  addNodeView: () => VueNodeViewRenderer(FileView),
})

/* -- Learning blocks ------------------------------------------------------- */

/** A flashcard. The node holds the text; the `cards` row holds the schedule. */
export const Card = Node.create({
  name: 'card',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes: () => ({
    card_id: dataAttr('card_id'),
    front: dataAttr('front', ''),
    back: dataAttr('back', ''),
    /** The sentence it was made from, when it came from a selection. */
    quote: dataAttr('quote'),
  }),
  parseHTML: () => [{ tag: 'div[data-type="card"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'card' })],
  addNodeView: () => VueNodeViewRenderer(CardView),
})

/** A second of a recording, with what was said there. */
export const Moment = Node.create({
  name: 'moment',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes: () => ({
    item_id: dataAttr('item_id'),
    at_seconds: dataAttr('at_seconds', 0, true),
    quote: dataAttr('quote', ''),
  }),
  parseHTML: () => [{ tag: 'div[data-type="moment"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'moment' })],
  addNodeView: () => VueNodeViewRenderer(MomentView),
})

/** Practice, checked on the spot: multiple choice or a short answer. */
export const Question = Node.create({
  name: 'question',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes: () => ({
    mode: dataAttr('mode', 'choice'),
    prompt: dataAttr('prompt', ''),
    options: jsonAttr('options', ['', '']),
    /** The right option's index (choice) or the accepted answers, `|`-separated (short). */
    answer: jsonAttr('answer', null),
    explanation: dataAttr('explanation', ''),
  }),
  parseHTML: () => [{ tag: 'div[data-type="question"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'question' })],
  addNodeView: () => VueNodeViewRenderer(QuestionView),
})

/**
 * "Coming up": the app's own block over its rows (a course's deadlines, or
 * its classes or topics), drawn by `page/node/View.vue`. It stores which
 * rows, never the rows, so it fills itself. `layout` is kept only so views
 * saved with it still parse; nothing reads it.
 */
export const ObjectView = Node.create({
  name: 'objectView',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes: () => ({
    source: dataAttr('source', 'deadlines'),
    layout: dataAttr('layout', 'table'),
    subject_id: dataAttr('subject_id'),
    scope: dataAttr('scope', 'course'),
  }),
  parseHTML: () => [{ tag: 'div[data-type="view"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'view' })],
  addNodeView: () => VueNodeViewRenderer(ObjectViewView),
})

/** A nested page or board. The title is cached for export; the row is the truth. */
export const PageLink = Node.create({
  name: 'pageLink',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes: () => ({
    item_id: dataAttr('item_id'),
    kind: dataAttr('kind', 'page'),
    title: dataAttr('title', ''),
  }),
  parseHTML: () => [{ tag: 'div[data-type="page-link"]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'page-link' })],
  addNodeView: () => VueNodeViewRenderer(PageLinkView),
})

/** An @mention of a topic, a deadline or a date. */
export const Mention = Node.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addAttributes: () => ({
    kind: dataAttr('kind', 'topic'),
    id: dataAttr('id'),
    label: dataAttr('label', ''),
  }),
  parseHTML: () => [{ tag: 'span[data-type="mention"]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'span',
    mergeAttributes(HTMLAttributes, { 'data-type': 'mention' }),
    `@${String(node.attrs.label)}`,
  ],
  renderText: ({ node }) => `@${String(node.attrs.label)}`,
  addNodeView: () => VueNodeViewRenderer(MentionView),
})

/** Where something came from: a slide, a second of audio, a photo. */
export const Cite = Node.create({
  name: 'cite',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,
  addAttributes: () => ({
    label: dataAttr('label', ''),
    item_id: dataAttr('item_id'),
    at_seconds: dataAttr('at_seconds', null, true),
  }),
  parseHTML: () => [{ tag: 'span[data-type="cite"]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'span',
    mergeAttributes(HTMLAttributes, { 'data-type': 'cite' }),
    String(node.attrs.label),
  ],
  renderText: ({ node }) => `(${String(node.attrs.label)})`,
  addNodeView: () => VueNodeViewRenderer(CiteView),
})

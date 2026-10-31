import type * as Y from 'yjs'
import { Extension, type AnyExtension } from '@tiptap/vue-3'
import { Plugin } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details'
import { Table, TableCell, TableHeader } from '@tiptap/extension-table'
import { Mathematics } from '@tiptap/extension-mathematics'
import { Placeholder } from '@tiptap/extensions'
import Collaboration from '@tiptap/extension-collaboration'
import type { PageContext } from '../context'
import type { MenuState } from './menu'
import { SlashCommand, type SlashItem } from './slash'
import { MentionSuggest, type MentionItem } from './mention'
import { VocabCards, VocabRow, type VocabCard } from './vocab'
import { PageCodeBlock } from './code'
import {
  Callout,
  Card,
  Cite,
  FileBlock,
  Highlight,
  Image,
  Mention,
  Moment,
  ObjectView,
  PageLink,
  Question,
} from './nodes'

/**
 * Everything a page's editor is made of, in one list.
 *
 * TipTap's free extensions for the blocks every notes app has, our own nodes
 * for the learning blocks, and Collaboration binding it all to the page's
 * Y.Doc. With a Y.Doc, undo comes from Yjs (so it only ever undoes your own
 * edits), which is why StarterKit's history is switched off.
 */

export type MathClick = (kind: 'block' | 'inline', node: PMNode, pos: number) => void

/**
 * A link into the app (`/app/…`, as the starter kit's welcome page has) opens
 * on a click, in this tab. Any other link stays text to edit, as StarterKit's
 * `openOnClick: false` leaves it, so writing a page is never one misclick
 * away from leaving it.
 */
const AppLinks = Extension.create({
  name: 'appLinks',
  addProseMirrorPlugins: () => [
    new Plugin({
      props: {
        handleClick: (_view, _pos, event) => {
          const href = (event.target as HTMLElement | null)?.closest('a')?.getAttribute('href')
          if (!href?.startsWith('/app')) return false
          void navigateTo(href)
          return true
        },
      },
    }),
  ],
})

export interface PageExtensionOptions {
  ydoc?: Y.Doc
  slash?: { state: MenuState<SlashItem>; items: () => SlashItem[] }
  mention?: { state: MenuState<MentionItem>; ctx: () => PageContext | null }
  vocab?: (card: VocabCard) => void
  onMath?: MathClick
}

/**
 * The hint in an empty line. It only sees the node, not where it sits (the
 * position it's given can belong to a newer document than `editor.state`), so
 * the wording for lines inside callouts, lists and tables is set in page.css.
 */
function placeholder({ node }: { node: PMNode }): string {
  if (node.type.name === 'heading') return `Heading ${node.attrs.level}`
  if (node.type.name === 'detailsSummary') return 'Toggle'
  if (node.type.name === 'paragraph') return 'Write, or type / for blocks and @ to mention'
  return ''
}

export function pageExtensions(options: PageExtensionOptions = {}): AnyExtension[] {
  const list: AnyExtension[] = [
    StarterKit.configure({
      codeBlock: false,
      undoRedo: options.ydoc ? false : undefined,
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      dropcursor: { color: 'var(--brand)', width: 2 },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Details.configure({ persist: true, HTMLAttributes: { class: 'pg-details' } }),
    DetailsSummary,
    DetailsContent,
    Table.configure({ resizable: false, HTMLAttributes: { class: 'pg-table' } }),
    VocabRow,
    TableHeader,
    TableCell,
    Mathematics.configure({
      katexOptions: { throwOnError: false },
      blockOptions: { onClick: (node, pos) => options.onMath?.('block', node, pos) },
      inlineOptions: { onClick: (node, pos) => options.onMath?.('inline', node, pos) },
    }),
    Placeholder.configure({
      placeholder,
      includeChildren: true,
      // Every empty line is marked, and the one with the cursor says so;
      // page.css decides which hints show without the cursor in them.
      showOnlyCurrent: false,
      emptyNodeClass: ({ hasAnchor }) => (hasAnchor ? 'is-empty is-current' : 'is-empty'),
    }),
    Highlight,
    PageCodeBlock,
    Callout,
    Image,
    FileBlock,
    Card,
    Moment,
    Question,
    ObjectView,
    PageLink,
    Mention,
    Cite,
    AppLinks,
  ]

  if (options.slash) list.push(SlashCommand.configure(options.slash))
  if (options.mention) list.push(MentionSuggest.configure(options.mention))
  if (options.vocab) list.push(VocabCards.configure({ save: options.vocab }))
  if (options.ydoc) list.push(Collaboration.configure({ document: options.ydoc, field: 'default' }))

  return list
}

import type * as Y from 'yjs'
import { Editor, type JSONContent } from '@tiptap/vue-3'
import type { Item } from '../../types'
import { saveCard } from '../cards'
import { previewDoc, resolveTemplateKey, templateDoc } from '../templates'
import { demoNotes } from '../demo'
import { PAGE_ENV, type PageEnv } from './env'
import { pageExtensions } from './extensions'
import { createMenuState } from './menu'
import { slashItems, type PageActions, type SlashItem } from './slash'
import type { MentionItem } from './mention'

/**
 * One page's editor, built and wired.
 *
 * Call it from the component that owns the page's layout: it provides the
 * page environment to every block, creates the TipTap editor bound to the
 * Y.Doc, and keeps the item row's `title` and `preview` in step with what's
 * typed, so lists and search show the page as it is.
 */

export interface MathEdit {
  open: boolean
  kind: 'block' | 'inline'
  pos: number
  latex: string
}

/** The page's title lives in the Y.Doc too, so it merges and survives offline. */
export function titleText(ydoc: Y.Doc): Y.Text {
  return ydoc.getText('title')
}

/** Set once a page has had its template (or demo notes) poured in. */
function seededFlag(ydoc: Y.Doc): Y.Map<unknown> {
  return ydoc.getMap('page')
}

/** A plain-text excerpt for `items.preview`. */
export function previewOf(editor: Editor): string {
  return editor
    .getText({ blockSeparator: ' ' })
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240)
}

/**
 * `reachedServer`: whether the server's copy of the document loaded. A page is
 * only ever set out (template, seed text, title) on top of the server's copy;
 * set out offline on an empty local copy, it would merge into the real
 * content once the device is back online and the page would read twice.
 */
export function usePageEditor(ydoc: Y.Doc, env: PageEnv, actions: PageActions, reachedServer: boolean) {
  provide(PAGE_ENV, env)

  const slash = createMenuState<SlashItem>()
  const mention = createMenuState<MentionItem>()
  const math = reactive<MathEdit>({ open: false, kind: 'block', pos: 0, latex: '' })

  // Decided before the editor binds, which may write an empty paragraph.
  const fragmentEmpty = ydoc.getXmlFragment('default').length === 0

  const editor = new Editor({
    extensions: pageExtensions({
      ydoc,
      slash: { state: slash, items: () => slashItems(actions) },
      mention: { state: mention, ctx: () => env.ctx.value },
      vocab: (card) => {
        void saveCard(
          env.store,
          env.page.value,
          {
            id: card.id,
            front: card.word,
            back: card.example ? `${card.meaning}\n\n${card.example}` : card.meaning,
            quote: card.example || null,
          },
          card.isNew,
        ).catch(() => undefined)
      },
      onMath: (kind, node, pos) => {
        math.kind = kind
        math.pos = pos
        math.latex = String(node.attrs.latex ?? '')
        math.open = true
      },
    }),
    editorProps: {
      attributes: { class: 'pg-prose', spellcheck: 'true', 'aria-label': 'Page' },
    },
  })

  /* -- First open: pour the template in ------------------------------------- */

  const title = titleText(ydoc)
  const flags = seededFlag(ydoc)

  /**
   * Set an empty page out, once. What it starts from, first match wins:
   * the server seed's HTML (`meta.seed_html`); the demo's written-up notes for
   * its lecture pages; a seeded page's `preview` line over its template; the
   * template alone. A page started here (`meta.props.fresh`) takes only its
   * template. The `seeded` flag lives in the document, so it syncs: no device,
   * and no reload, sets a page out twice, even after it's emptied by hand.
   */
  function seed(): void {
    if (!reachedServer) return
    const page = env.page.value
    if (!title.length && page.title) title.insert(0, page.title)
    if (flags.get('seeded') || !fragmentEmpty) return
    const meta = page.meta as Item['meta'] & { seed_html?: string }
    const key = resolveTemplateKey(meta.template)
    const fresh = Boolean(meta.props?.fresh)
    const ctx = env.ctx.value
    let content: string | JSONContent | null = null
    if (meta.seed_html?.trim()) content = meta.seed_html
    else if (!fresh && env.repo.mode === 'demo' && key === 'lecture') content = demoNotes(ctx)
    if (!content && !fresh && page.preview?.trim()) content = previewDoc(page.preview.trim(), key, ctx)
    if (!content && key && key !== 'blank') content = templateDoc(key, ctx)
    if (content) editor.commands.setContent(content)
    flags.set('seeded', true)
  }

  /* -- Keep the row in step ------------------------------------------------- */

  let titleTimer: ReturnType<typeof setTimeout> | null = null
  let previewTimer: ReturnType<typeof setTimeout> | null = null
  let lastPreview = env.page.value.preview ?? ''

  /** Through the store: lists and the rail show the new title or preview at once. */
  function saveRow(patch: Partial<Item>): void {
    void env.store.upsert<Item>('items', { id: env.page.value.id, ...patch }).catch(() => undefined)
  }

  /** The title as typed, for the crumbs and the tab, ahead of the debounced save. */
  const titleValue = ref(title.toString() || env.page.value.title)

  function onTitle(): void {
    const value = title.toString()
    titleValue.value = value
    if (titleTimer) clearTimeout(titleTimer)
    titleTimer = setTimeout(() => saveRow({ title: value }), 600)
  }

  function onUpdate(): void {
    if (previewTimer) clearTimeout(previewTimer)
    previewTimer = setTimeout(() => {
      const preview = previewOf(editor)
      if (preview === lastPreview) return
      lastPreview = preview
      saveRow({ preview })
    }, 1500)
  }

  title.observe(onTitle)
  editor.on('update', onUpdate)

  let vocabTimer: ReturnType<typeof setTimeout> | null = null

  onMounted(() => {
    seed()
    // The first look at vocabulary tables waits for the collaboration
    // binding's first render: ids stamped before it would be dropped, then
    // stamped again, and each row would make two cards.
    vocabTimer = setTimeout(() => editor.commands.syncVocabCards(), 600)
  })

  onBeforeUnmount(() => {
    if (vocabTimer) clearTimeout(vocabTimer)
    title.unobserve(onTitle)
    editor.off('update', onUpdate)
    // Say the last word before going: a pending title or preview still lands.
    if (titleTimer) {
      clearTimeout(titleTimer)
      saveRow({ title: title.toString() })
    }
    if (previewTimer) {
      clearTimeout(previewTimer)
      const preview = previewOf(editor)
      if (preview !== lastPreview) saveRow({ preview })
    }
    editor.destroy()
  })

  /* -- Math ------------------------------------------------------------------ */

  function saveMath(latex: string): void {
    const { pos, kind } = math
    math.open = false
    const c = editor.commands
    if (kind === 'block') {
      if (latex.trim()) c.updateBlockMath({ latex, pos })
      else c.deleteBlockMath({ pos })
    } else if (latex.trim()) c.updateInlineMath({ latex, pos })
    else c.deleteInlineMath({ pos })
  }

  return { editor, slash, mention, math, saveMath, title, titleValue }
}

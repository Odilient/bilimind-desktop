<script setup lang="ts">
import type * as Y from 'yjs'
import { EditorContent } from '@tiptap/vue-3'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { DragHandle } from '@tiptap/extension-drag-handle-vue-3'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { Editor as CoreEditor } from '@tiptap/core'
import type { Item } from '~/companion/types'
import type { DocStatus } from '~/companion/doc/persistence'
import type { MenuAction } from '~/components/ui/Menu.vue'
import { usePagesRepo } from '~/companion/doc/repo'
import { useCompanion } from '~/companion/store'
import { useQuietAi } from '~/companion/quiet-ai'
import { openCompanionTab, renameCompanionTab } from '~/companion/tabs'
import { contextFrom } from '~/companion/doc/context'
import { findGaps, type GapResult } from '~/companion/doc/gap'
import { dispatchSeek, type PageEnv } from '~/companion/doc/editor/env'
import { usePageEditor } from '~/companion/doc/editor/usePageEditor'
import { insertUpload, type PageActions } from '~/companion/doc/editor/slash'
import { momentNow } from '~/companion/doc/transcript'
import { useCoarsePointer, useKeyboardInset, usePhoneWidth } from '~/companion/doc/editor/viewport'
import { downloadMarkdown } from '~/companion/doc/markdown'
import { timecode } from '~/companion/time'
import { useNoteInk } from '~/companion/doc/ink'
import { makeBoard } from '~/companion/board/make'
import { templateDoc, templateTitle, type TemplateKey } from '~/companion/doc/templates'
import { useAi } from '~/companion/ai/state'
import { useAiThread } from '~/companion/ai/thread'
import { noteTo, useNoteActions, type NoteMenuItem } from '~/companion/notes/actions'
import { takeJustMade } from '~/companion/notes/make'
import type { Note } from '~/companion/notes/tree'
import MarkupToolbar from '~/components/markup/MarkupToolbar.vue'
import 'katex/dist/katex.min.css'
import './page.css'

/**
 * A page, open, read as a document on white: one column, top to bottom.
 *
 * In Notes (not `embedded`) the bar above it is Notes' 48px doc bar, full
 * width: where the page is, as a path you can click back up ("Notes /
 * ● Databases / Lecture 8 notes / Worked examples"), then the page's actions:
 * whether it's saved, "What did I miss?", Draw and Whiteboard in plain sight,
 * "…" (rename, pin, move, open in its course, download, print, copy link,
 * delete) and the companion's Ask at the right end. On a phone the path is a
 * back arrow and the course. As a tab in its course (`embedded`) the tab is
 * the way back, so the bar keeps only the actions, in the page's column.
 * Then the title, one muted line saying which class it's from, and the text.
 *
 * An empty page offers how to start, quietly, under its first line: a few
 * templates (filled from where the page is filed) and "Ask BiliMind to draft
 * it". They go as soon as there's anything on the page. A page made a moment
 * ago opens with the cursor in its title.
 *
 * Draw opens the lesson's own pen tray at the foot of the page, as a lesson
 * has it: pen, highlighter, marker, arrow, text labels and the eraser, the
 * inks, undo. The ink sits over the text and lives in the page's own doc.
 * Whiteboard opens this page's board (making it, filed with the page, the
 * first time); the tray's board menu starts another.
 *
 * "What did I miss?" opens only when asked, as a panel beside the page (a
 * sheet on the phone), and not at all with Quiet AI on. A page that isn't
 * from a class (no session) has no slides or recording to compare with, so
 * it doesn't offer it. On the phone the
 * page goes full screen with a toolbar on the keyboard.
 *
 * The route above finds the item and its document; this component reads
 * everything else live from the companion store, and owns the editor while
 * the page is open.
 */
const props = defineProps<{
  page: Item
  ydoc: Y.Doc
  status: DocStatus
  reachedServer: boolean
  /** A tab in the course workspace: the tab is the way back, and links open beside it. */
  embedded?: boolean
}>()

const emit = defineEmits<{ open: [item: { id: string; kind: 'page' | 'board' }] }>()

const repo = usePagesRepo()
const store = useCompanion()
const toast = useToast()
const phone = usePhoneWidth()
const coarse = useCoarsePointer()
const keyboard = useKeyboardInset()
const { quiet } = useQuietAi()

/** The row as the store has it now (renamed, refiled), else as the route found it. */
const page = computed<Item>(() => store.get('items', props.page.id) ?? props.page)
const ctx = computed(() => contextFrom(store, page.value))

const env: PageEnv = {
  repo,
  store,
  page,
  ctx,
  seek(itemId, seconds) {
    // Moves the app's player when there is one; it never starts playback.
    dispatchSeek(itemId, seconds)
    const rec = itemId ? store.get('items', itemId) : null
    toast.info({ title: `${rec?.title ?? 'Recording'}, ${timecode(seconds)}`, duration: 2200 })
  },
  open(item) {
    const kind = item.kind === 'board' ? 'board' : 'page'
    if (props.embedded) emit('open', { id: item.id, kind })
    else void navigateTo(noteTo(item.id))
  },
}

/* -- What blocks ask of the page --------------------------------------------- */

function pickFile(accept: string, capture = false): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    if (capture) input.setAttribute('capture', 'environment')
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true })
    input.addEventListener('cancel', () => resolve(null), { once: true })
    input.click()
  })
}

const actions: PageActions = {
  async createChild(kind) {
    const item: Item = {
      id: crypto.randomUUID(),
      subject_id: page.value.subject_id,
      session_id: page.value.session_id,
      topic_id: page.value.topic_id,
      parent_id: page.value.id,
      kind,
      title: kind === 'board' ? 'Untitled board' : 'Untitled',
      preview: null,
      meta: kind === 'page' ? { template: 'blank' } : {},
      source: 'made',
      source_ref: null,
      position: 0,
      pinned: false,
    }
    return store.upsert<Item>('items', item).catch(() => item)
  },
  pickFile,
  async upload(file) {
    try {
      return await repo.upload(file, {
        subject_id: page.value.subject_id ?? undefined,
        session_id: page.value.session_id ?? undefined,
      })
    } catch {
      toast.error({ title: `Couldn't add ${file.name}`, body: 'Check the connection and try again.' })
      return null
    }
  },
  momentNow: () => momentNow(ctx.value, repo.mode === 'demo'),
  codeLanguage: () => (ctx.value.subject?.color === 'db' ? 'sql' : 'python'),
  subjectId: () => page.value.subject_id,
}

const { editor, slash, mention, math, saveMath, title, titleValue } = usePageEditor(
  props.ydoc,
  env,
  actions,
  props.reachedServer,
)

// Scripted checks in development (headless Chrome) read the document through this.
if (import.meta.dev && import.meta.client) {
  ;(window as unknown as { __pageEditor?: typeof editor }).__pageEditor = editor
}

/* -- The pen ----------------------------------------------------------------- */

/*
 * The tray is the mode, as in a lesson: Draw opens it armed with the pen
 * (what a pencil promises); Done, Escape or Draw again puts it away. The
 * highlighter is the one tool that works on the words rather than over
 * them: with it armed, a drag across text marks the text, as the bubble's
 * Highlight does, and the mark travels with the words when they're edited.
 */
const ink = useNoteInk(props.ydoc)
const pen = useMarkupTool()
const markupOpen = ref(false)

function openMarkup(): void {
  markupOpen.value = true
  pen.arm('pen')
}

function closeMarkup(): void {
  pen.disarm()
  markupOpen.value = false
}

function onArticlePointerUp(): void {
  if (pen.tool.value !== 'highlight') return
  // After the editor has taken the drag as its selection.
  requestAnimationFrame(() => {
    const { to, empty } = editor.state.selection
    if (empty || !editor.isEditable) return
    editor.chain().setMark('highlight').setTextSelection(to).run()
  })
}

/* -- Whiteboards ------------------------------------------------------------- */

/** Boards made from this page, newest first: the tray's board menu lists them. */
const boards = computed(() =>
  store.items.value
    .filter((i) => i.kind === 'board' && !i.deleted_at && i.parent_id === page.value.id)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .map((i) => ({ uuid: i.id, title: i.title || 'Whiteboard' })),
)

const makingBoard = ref(false)

/** A board filed with this page: its course, its class and its topic. */
async function newBoard(): Promise<void> {
  if (makingBoard.value) return
  makingBoard.value = true
  try {
    const board = await makeBoard(store, 'blank', {
      subject_id: page.value.subject_id,
      session_id: page.value.session_id,
      topic_id: page.value.topic_id,
      parent_id: page.value.id,
      title: titleValue.value ? `${titleValue.value} whiteboard` : null,
    })
    env.open({ id: board.id, kind: 'board' })
  } catch {
    toast.error({ title: "Couldn't make the whiteboard", body: 'Check the connection and try again.' })
  } finally {
    makingBoard.value = false
  }
}

/** The bar's button: this page's board if it has one, else a new one. */
function whiteboard(): void {
  const last = boards.value[0]
  if (last) env.open({ id: last.uuid, kind: 'board' })
  else void newBoard()
}

/* -- Layout ------------------------------------------------------------------ */

const titleRef = ref<{ focus: () => void } | null>(null)

onMounted(() => {
  // An empty page (or one just made) starts with the cursor in the title;
  // anything else, in the text.
  if (takeJustMade(props.page.id) || !title.length) titleRef.value?.focus()
})

/* The desktop tab strip shows this page, under the title it has right now. */
let tabKey: string | null = null
onMounted(() => {
  if (props.embedded) return
  tabKey = openCompanionTab({
    kind: 'page',
    id: page.value.id,
    title: titleValue.value || 'Untitled',
    to: noteTo(page.value.id),
    color: ctx.value.subject?.color ?? null,
  })
})
watch(titleValue, (value) => {
  if (tabKey) renameCompanionTab(tabKey, value || 'Untitled')
})

/* -- "What did I miss?", on request ------------------------------------------ */

const panelOpen = ref(false)
const gapSheet = ref(false)
const gaps = reactive<{ result: GapResult | null; loading: boolean }>({ result: null, loading: false })

/** Opening it is the request: the comparison runs then, once, until asked again. */
async function compare(): Promise<void> {
  if (gaps.loading) return
  gaps.loading = true
  try {
    gaps.result = await findGaps(repo, page.value, ctx.value, editor.getText({ blockSeparator: '\n' }))
  } finally {
    gaps.loading = false
  }
}

function toggleGaps(): void {
  if (phone.value) gapSheet.value = true
  else panelOpen.value = !panelOpen.value
  if ((phone.value || panelOpen.value) && !gaps.result) void compare()
}

// Quiet AI switched on with the panel open: it goes.
watch(quiet, (on) => {
  if (on) {
    panelOpen.value = false
    gapSheet.value = false
  }
})

const statusLabel = computed(() => {
  switch (props.status) {
    case 'saving':
      return 'Saving…'
    case 'saved':
      return 'Saved'
    case 'offline':
      return 'Offline, kept on this device'
    default:
      return ''
  }
})

function focusEditor(): void {
  editor.chain().focus('start').run()
}

function focusTitle(): void {
  titleRef.value?.focus()
}

/* -- How an empty page starts ------------------------------------------------ */

const ai = useAi()
const aiThread = useAiThread()
/* Read once the document has been drawn into the editor (the collaboration
   binding fills it a tick after it mounts), so a page with words on it never
   flashes the starters on its way in. */
const empty = ref(false)

function onEditorUpdate(): void {
  empty.value = editor.isEmpty
}
editor.on('update', onEditorUpdate)
let emptyTimer: ReturnType<typeof setTimeout> | undefined
onMounted(() => {
  emptyTimer = setTimeout(onEditorUpdate, 80)
})
onBeforeUnmount(() => {
  clearTimeout(emptyTimer)
  editor.off('update', onEditorUpdate)
})

const STARTERS: { key: TemplateKey; label: string }[] = [
  { key: 'lecture', label: 'Lecture notes' },
  { key: 'cornell', label: 'Cornell' },
  { key: 'reading', label: 'Reading notes' },
]

/** A template poured into this empty page, named by it when it has no name yet. */
function start(key: TemplateKey): void {
  editor.commands.setContent(templateDoc(key, ctx.value))
  const named = templateTitle(key, ctx.value)
  if (!title.length && named) title.insert(0, named)
  void store.upsert<Item>('items', { id: page.value.id, meta: { ...page.value.meta, template: key } }).catch(() => undefined)
  editor.chain().focus('end').run()
}

/** The companion, with this page as what it sees, waiting for the learner's own words. */
function askAboutPage(): void {
  ai.show()
  // After the flush: a dock that was closed has no box to focus until it mounts.
  void nextTick(() => aiThread.focus())
}

/* -- The doc's "…" in Notes -------------------------------------------------- */

const noteActions = useNoteActions()

const docMenu = computed<NoteMenuItem[]>(() => {
  const all = noteActions.menuFor(page.value as Note, { rename: focusTitle })
  const remove = all.filter((a) => a.destructive)
  return [
    ...all.filter((a) => !a.destructive),
    { label: 'Download as Markdown', icon: 'download', run: () => downloadMarkdown(titleValue.value, editor.getJSON()) },
    { label: 'Print or save as PDF', icon: 'file', run: () => window.print() },
    ...remove,
  ]
})

/* -- Export ------------------------------------------------------------------ */

const menu = computed<MenuAction[]>(() => [
  { label: 'Download as Markdown', icon: 'download', run: () => downloadMarkdown(titleValue.value, editor.getJSON()) },
  { label: 'Print or save as PDF', icon: 'file', run: () => window.print() },
  {
    label: 'Copy link',
    icon: 'link',
    run: () => {
      void navigator.clipboard?.writeText(location.href.split('?')[0]!).then(() => toast.success('Link copied'))
    },
  },
])

/**
 * Printing (and "save as PDF") shows the page alone: a copy of it is put at
 * the top of the body for the print, and page.css hides everything else.
 * Textareas copy their attribute, not what was typed, so their text is
 * carried across by hand.
 */
const article = ref<HTMLElement | null>(null)

function beforePrint(): void {
  if (!article.value) return
  const copy = article.value.cloneNode(true) as HTMLElement
  const from = article.value.querySelectorAll('textarea, input')
  copy.querySelectorAll('textarea, input').forEach((field, i) => {
    const value = (from[i] as HTMLTextAreaElement | HTMLInputElement | undefined)?.value ?? ''
    if (field.tagName === 'TEXTAREA') field.textContent = value
    else field.setAttribute('value', value)
  })
  const root = document.createElement('div')
  root.className = 'pg-printroot'
  root.appendChild(copy)
  document.body.appendChild(root)
}

function afterPrint(): void {
  document.querySelectorAll('.pg-printroot').forEach((node) => node.remove())
}

onMounted(() => {
  window.addEventListener('beforeprint', beforePrint)
  window.addEventListener('afterprint', afterPrint)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeprint', beforePrint)
  window.removeEventListener('afterprint', afterPrint)
})

/* -- Phone ------------------------------------------------------------------- */

async function camera(): Promise<void> {
  const file = await pickFile('image/*', true)
  if (file) await insertUpload(editor, actions, file)
}

function moment(): void {
  const m = actions.momentNow()
  if (!m) return
  editor
    .chain()
    .focus()
    .insertContent({ type: 'moment', attrs: { item_id: m.item_id, at_seconds: m.at_seconds, quote: m.quote } })
    .run()
}

/** Where the keyboard toolbar sits: on the keyboard when it's up, else on the bottom edge. */
const barBottom = computed(() => keyboard.value)

/**
 * The keyboard toolbar: always on a phone; on a touch tablet (an iPad is
 * desktop-wide) only while the on-screen keyboard is up. As a tab in a
 * course, only while the keyboard is up there too: the rest of the time the
 * app's own bar is at the foot of the screen.
 */
const showBar = computed(() =>
  props.embedded
    ? (phone.value || coarse.value) && keyboard.value > 0
    : phone.value || (coarse.value && keyboard.value > 0),
)

/**
 * Where the caret may sit when ProseMirror scrolls it into view. It doesn't
 * know about the sticky crumbs bar or the on-screen keyboard, which on iOS
 * covers the page without resizing it: left alone, the caret lands under one
 * of them and the page jumps to find it.
 */
watch(
  [keyboard, showBar],
  ([inset, bar]) => {
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        scrollMargin: { top: 72, bottom: inset + (bar ? 72 : 24), left: 0, right: 0 },
        scrollThreshold: { top: 72, bottom: inset + (bar ? 72 : 24), left: 0, right: 0 },
      },
    })
  },
  { immediate: true },
)

/* -- Selection bubble -------------------------------------------------------- */

const ATOMS = new Set(['card', 'moment', 'question', 'objectView', 'pageLink', 'image', 'fileBlock', 'blockMath'])

function showBubble({ editor: e, from, to }: { editor: CoreEditor; from: number; to: number }): boolean {
  if (from === to || !e.isEditable) return false
  // The highlighter marks the drag itself; a menu over it would be in the way.
  if (pen.tool.value === 'highlight') return false
  if (e.isActive('codeBlock')) return false
  const sel = e.state.selection as { node?: PMNode }
  if (sel.node && ATOMS.has(sel.node.type.name)) return false
  return e.state.doc.textBetween(from, to, ' ').trim().length > 0
}

/* -- Drag handle ------------------------------------------------------------- */

const hovered = ref<{ pos: number } | null>(null)

function onNodeChange(data: { node: PMNode | null; pos: number }): void {
  hovered.value = data.node ? { pos: data.pos } : null
}

/** "+" beside a block: a fresh line under it with the "/" menu open. */
function addBelow(): void {
  const at = hovered.value
  if (!at) return
  const node = editor.state.doc.nodeAt(at.pos)
  if (!node) return
  const end = at.pos + node.nodeSize
  editor.chain().insertContentAt(end, { type: 'paragraph', content: [{ type: 'text', text: '/' }] }).focus(end + 2).run()
}
</script>

<template>
  <div
    class="pg-shell"
    :class="{
      'has-panel': panelOpen && !phone && !quiet,
      'is-phone': phone,
      'has-bar': showBar,
      'is-embedded': embedded,
    }"
  >
    <div class="pg-main">
      <header
        class="pg-top"
        :class="{ 'is-doc': !embedded }"
      >
        <template v-if="!embedded">
          <CompanionNotesCrumbs
            class="lg:hidden"
            :item="page"
            :title="titleValue"
            phone
          />
          <CompanionNotesCrumbs
            class="max-lg:hidden"
            :item="page"
            :title="titleValue"
            @title="focusTitle"
          />
        </template>
        <span
          v-else
          aria-hidden="true"
        />
        <div class="pg-top-actions">
          <span
            class="pg-status"
            :class="`is-${status}`"
            role="status"
            :title="status === 'saved' ? 'Everything you type is saved as you go' : undefined"
          >{{ statusLabel }}</span>
          <UiBtn
            v-if="!quiet && page.session_id"
            variant="secondary"
            size="sm"
            class="shrink-0"
            :class="{ '!border-transparent !bg-cobalt-soft !text-cobalt !shadow-none': panelOpen && !phone }"
            :aria-pressed="phone ? undefined : panelOpen"
            title="Compare these notes with the class's slides and recording"
            @click="toggleGaps"
          >
            <UiIcon
              name="spark"
              :size="14"
              class="text-cobalt"
            />
            What did I miss?
          </UiBtn>
          <UiBtn
            variant="secondary"
            size="sm"
            class="pg-tool shrink-0"
            :class="{ '!border-transparent !bg-ink !text-white !shadow-none': markupOpen }"
            :aria-pressed="markupOpen"
            aria-label="Draw"
            title="Draw, write and highlight on this page"
            @click="markupOpen ? closeMarkup() : openMarkup()"
          >
            <PageIcon
              name="pen"
              :size="15"
            />
            <span class="pg-tool-label">Draw</span>
          </UiBtn>
          <UiBtn
            variant="secondary"
            size="sm"
            class="pg-tool shrink-0"
            :loading="makingBoard"
            aria-label="Whiteboard"
            :title="boards.length ? 'Open this page’s whiteboard' : 'Start a whiteboard for this page'"
            @click="whiteboard"
          >
            <PageIcon
              name="board"
              :size="15"
            />
            <span class="pg-tool-label">Whiteboard</span>
          </UiBtn>
          <UiMenu
            v-if="embedded"
            :actions="menu"
            label="More for this page"
            title="This page"
          />
          <template v-else>
            <CompanionNotesMenu
              :items="docMenu"
              align="end"
              label="More for this page"
              :title="titleValue || 'This page'"
            >
              <template #default="{ toggle, open }">
                <button
                  type="button"
                  aria-label="More for this page"
                  title="Rename, pin, move, download, delete"
                  aria-haspopup="menu"
                  :aria-expanded="open"
                  :class="[
                    'grid size-9 shrink-0 cursor-pointer place-items-center rounded-full transition-colors lg:size-8',
                    open ? 'bg-surface-track text-text' : 'text-text-faint hover:bg-surface-track hover:text-text-soft',
                  ]"
                  @click="toggle"
                >
                  <UiIcon
                    name="dots"
                    :size="18"
                  />
                </button>
              </template>
            </CompanionNotesMenu>
            <CompanionAiToggle class="max-lg:hidden" />
            <CompanionAiToggle
              compact
              class="lg:hidden"
            />
          </template>
        </div>
      </header>

      <article
        ref="article"
        class="pg-page"
        @pointerup="onArticlePointerUp"
      >
        <PageTitle
          ref="titleRef"
          :text="title"
          @enter="focusEditor"
        />
        <PageProps
          :page="page"
          :ctx="ctx"
          @seek="env.seek"
        />
        <EditorContent
          :editor="editor"
          class="pg-body"
        />
        <!-- How to start, while there's nothing on the page. Under the first
             line, so typing into it moves nothing. -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0"
          leave-active-class="transition duration-100 ease-in"
          leave-to-class="opacity-0"
        >
          <div
            v-if="empty && editor.isEditable && !pen.armed.value"
            class="pg-starters"
            role="group"
            aria-label="Start this page with"
          >
            <span class="pg-starters-lead">Start with</span>
            <template
              v-for="(s, i) in STARTERS"
              :key="s.key"
            >
              <span
                v-if="i"
                class="pg-starters-dot"
                aria-hidden="true"
              >·</span>
              <button
                type="button"
                class="pg-starter"
                @click="start(s.key)"
              >
                {{ s.label }}
              </button>
            </template>
            <template v-if="!quiet">
              <span
                class="pg-starters-dot"
                aria-hidden="true"
              >·</span>
              <button
                type="button"
                class="pg-starter is-ai"
                title="Opens the companion beside the page (Ctrl+J)"
                @click="askAboutPage"
              >
                <UiIcon
                  name="spark"
                  :size="12"
                />
                Ask BiliMind
              </button>
            </template>
          </div>
        </Transition>
        <PageInk
          :ink="ink"
          :tool="pen.tool.value"
          :color="pen.color.value"
          :size="pen.size.value"
          :armed="pen.armed.value"
        />
      </article>

      <!-- The pen tray, where a lesson has it: sticky to the foot of the
           scrolling page, centred, the page clickable either side of it. -->
      <div
        v-if="markupOpen"
        class="pg-pen"
        :style="showBar ? { bottom: `${barBottom + 70}px` } : undefined"
      >
        <MarkupToolbar
          v-model:tool="pen.tool.value"
          v-model:color="pen.color.value"
          v-model:size="pen.size.value"
          :can-undo="ink.canUndo.value"
          :can-redo="ink.canRedo.value"
          :boards="boards"
          placement="inline"
          @undo="ink.undo()"
          @redo="ink.redo()"
          @new-board="newBoard()"
          @open-board="env.open({ id: $event, kind: 'board' })"
          @done="closeMarkup()"
        />
      </div>

      <!-- Not on touch screens: it follows the mouse, and a handle that jumps
           to wherever a finger lands is one more thing moving while typing. -->
      <DragHandle
        v-if="!phone && !coarse"
        :editor="editor"
        :on-node-change="onNodeChange"
        class="pg-drag"
      >
        <div class="pg-drag-inner">
          <button
            type="button"
            class="pg-drag-add"
            aria-label="Add a block below"
            @click="addBelow"
          >
            <UiIcon
              name="plus"
              :size="14"
            />
          </button>
          <span
            class="pg-drag-grip"
            aria-label="Drag to move"
          >
            <PageIcon
              name="grip"
              :size="14"
            />
          </span>
        </div>
      </DragHandle>

      <BubbleMenu
        class="pg-bubble-wrap"
        :editor="editor"
        :should-show="showBubble"
        :options="{ placement: 'top', offset: 8 }"
      >
        <PageBubbleBar :editor="editor" />
      </BubbleMenu>

      <PageSlashMenu
        :state="slash"
        :phone="phone"
        :bottom="barBottom + 58"
      />
      <PageMentionMenu :state="mention" />
      <PageMathEdit
        v-if="math.open"
        :math="math"
        :editor="editor"
        @save="saveMath"
        @close="math.open = false"
      />
    </div>

    <aside
      v-if="panelOpen && !phone && !quiet"
      class="pg-side"
    >
      <PageGapPanel
        :editor="editor"
        :page="page"
        :ctx="ctx"
        :store="store"
        :state="gaps"
        @compare="compare"
        @close="panelOpen = false"
        @open="env.open({ id: $event.id, kind: $event.kind === 'board' ? 'board' : 'page' })"
      />
    </aside>

    <UiSheet
      v-if="phone && !quiet"
      v-model:open="gapSheet"
      title="What did I miss?"
    >
      <PageGapPanel
        :editor="editor"
        :page="page"
        :ctx="ctx"
        :store="store"
        :state="gaps"
        sheet
        @compare="compare"
        @open="env.open({ id: $event.id, kind: $event.kind === 'board' ? 'board' : 'page' })"
      />
    </UiSheet>

    <PagePhoneBar
      v-if="showBar"
      :editor="editor"
      :bottom="barBottom"
      :slash-open="slash.open"
      :can-moment="Boolean(ctx.recording)"
      @camera="camera"
      @moment="moment"
    />
  </div>
</template>

<style scoped>
/* Notes' doc bar: the full width of the doc, 48px, the path on the left and
   the page's actions on the right, sticky over the page as it scrolls. */
.pg-top.is-doc {
  max-width: none;
  min-height: 48px;
  height: 48px;
  padding: 0 10px 0 12px;
  gap: 8px;
  border-bottom: 1px solid var(--border);
}

.pg-top.is-doc .pg-top-actions {
  gap: 6px;
}

@media (max-width: 1023.98px) {
  .pg-top.is-doc {
    height: auto;
    min-height: 52px;
    padding: env(safe-area-inset-top, 0px) 6px 0 2px;
  }
}

/* "Start with Lecture notes · Cornell · Reading notes · Ask BiliMind":
   quiet text buttons, faint until pointed at. */
.pg-starters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
  margin-top: 4px;
  font-size: 14px;
  color: var(--text-faint);
}

.pg-starters-lead {
  margin-right: 2px;
}

.pg-starters-dot {
  color: var(--text-ghost);
}

.pg-starter {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 30px;
  padding: 0 6px;
  margin: 0 -6px;
  border-radius: 7px;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color 120ms, color 120ms;
}

.pg-starter:hover,
.pg-starter:focus-visible {
  background: var(--surface-mute);
  color: var(--text);
  outline: none;
}

.pg-starter.is-ai {
  color: var(--cobalt);
}

.pg-starter.is-ai:hover {
  background: var(--cobalt-soft);
}

@media (max-width: 899.98px) {
  .pg-starter {
    min-height: 44px;
  }
}
</style>

/**
 * Notes, the place: what its sidebar remembers, and every change made to a
 * note from outside the note itself (renamed from its row, pinned, moved,
 * dragged under another page, deleted with an undo, several at once).
 *
 * Filing is the learner's, never ours. A note is made in My notes unless the
 * control pressed named a course (`make.ts`); when there was an obvious
 * course, the note carries it as a suggestion and its header asks "Add to
 * Databases?" (`suggestionOf`, `acceptSuggestion`, `dismissSuggestion`).
 * Every move says where it went and can be undone from its toast.
 *
 * The tree is built once for every screen that shows it (`useNotesTree`), so
 * the sidebar, the course's Notes list and the breadcrumbs never disagree.
 * Writes go through the store like any edit: on screen first, then to the
 * server, and offline into the outbox.
 *
 * Two things here are not obvious from the rows:
 *
 *  - A page's title lives in its Y.Doc (`usePageEditor`), not in the row; the
 *    row only follows it. Renaming from the sidebar writes the doc: the open
 *    one when the page is on screen (`registerLiveDoc`), else the doc opened
 *    quietly, renamed and closed, and only on top of the server's copy, for
 *    the reason `usePageEditor` gives (an empty local copy merged with the
 *    real one would read twice).
 *  - Deleting takes a moment to happen. The note (and everything under it)
 *    leaves every screen at once (the store's `leave`: lists drop it, and
 *    wherever it is open closes, `store.onGone`) and a toast offers Undo; the
 *    delete is sent when the toast goes, or when the tab is closed,
 *    whichever is first.
 */
import * as Y from 'yjs'
import { computed, effectScope, onBeforeUnmount, ref, type ComputedRef } from 'vue'
import { useToast } from '~/composables/useToast'
import { translate } from '~/utils/i18n'
import { useCompanion, type CompanionStore } from '../store'
import { attachDocPersistence } from '../doc/persistence'
import type { Item, Session, Subject } from '../types'
import { makeBoard, makePage, type MakeBoardInput, type MakePageInput } from './make'
import {
  ancestors,
  buildTree,
  descendants,
  isDoc,
  isNote,
  placeKey,
  siblingsOf,
  type Note,
  type NotesTree,
} from './tree'

/* -- What the sidebar remembers (per device) --------------------------------- */

const TREE_KEY = 'bm:notes-tree'
const SIDEBAR_KEY = 'bm:notes-sidebar'

function readJson<T>(key: string, fallback: T): T {
  if (!import.meta.client) return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Private mode: the tree just forgets what was open, which is harmless.
  }
}

/**
 * What is unfolded: a note's id, `f:<course id>` (`f:` alone for My notes) or
 * `s:recent` / `s:pinned`. Only what was set by hand is kept; the rest falls
 * back to each row's own default.
 */
const expanded = ref<Record<string, boolean>>(readJson(TREE_KEY, {}))

export function isExpanded(key: string, fallback = false): boolean {
  return expanded.value[key] ?? fallback
}

export function setExpanded(key: string, open: boolean): void {
  if (expanded.value[key] === open) return
  expanded.value = { ...expanded.value, [key]: open }
  writeJson(TREE_KEY, expanded.value)
}

export function folderKey(subjectId: string | null): string {
  return `f:${placeKey(subjectId)}`
}

/* Shown until the device's own choice is read on mount (`restore`): the
   server draws it shown, and the first client render has to agree. */
const sidebarOpen = ref(true)

/** The desktop sidebar, shown or folded away (Ctrl/⌘ + \), remembered per device. */
export function useNotesSidebar() {
  return {
    open: sidebarOpen,
    restore() {
      sidebarOpen.value = readJson(SIDEBAR_KEY, true)
    },
    set(value: boolean) {
      sidebarOpen.value = value
      writeJson(SIDEBAR_KEY, value)
    },
    toggle() {
      sidebarOpen.value = !sidebarOpen.value
      writeJson(SIDEBAR_KEY, sidebarOpen.value)
    },
  }
}

/** The row that is a name field right now: `<note id>:<row>`, as the row sets it. */
export const renamingId = ref<string | null>(null)
/** The note "Move to…" was asked for: the dialog shows while set. */
export const movingId = ref<string | null>(null)
/** Several notes "Move to…" was asked for at once (the selection's bar). */
export const movingIds = ref<string[] | null>(null)

/* -- Several at once ---------------------------------------------------------- */

/**
 * The notes picked in the sidebar with ⌘/Ctrl-click (one more) or
 * Shift-click (everything between), as in Finder and Notion. Plain clicks
 * still open a note and drop the selection. A selected row drags the whole
 * selection with it, and the bar over the list moves or deletes them all.
 */
export const selection = ref<ReadonlySet<string>>(new Set())
let anchor: string | null = null

export function isSelected(id: string): boolean {
  return selection.value.has(id)
}

export function toggleSelected(id: string): void {
  const next = new Set(selection.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selection.value = next
  anchor = id
}

/**
 * Shift-click: every row between the last one picked and this one, in the
 * order they are on screen (`order`, the visible rows' ids, top to bottom).
 */
export function selectRange(id: string, order: string[]): void {
  const from = anchor ? order.indexOf(anchor) : -1
  const to = order.indexOf(id)
  if (from < 0 || to < 0) return toggleSelected(id)
  const [a, b] = from < to ? [from, to] : [to, from]
  selection.value = new Set([...selection.value, ...order.slice(a, b + 1)])
}

export function clearSelection(): void {
  if (selection.value.size) selection.value = new Set()
  anchor = null
}

/**
 * One of a kind on screen: the first mounted copy of a dialog draws it, the
 * rest stand by. "Move to…" is mounted by Notes and by every course Notes
 * list (a course draws its list twice, desk and phone), and must open once.
 */
const singletons = ref<Record<string, number[]>>({})
let nextSingleton = 0

export function useSingleton(name: string) {
  const token = ++nextSingleton
  singletons.value = { ...singletons.value, [name]: [...(singletons.value[name] ?? []), token] }
  onBeforeUnmount(() => {
    singletons.value = { ...singletons.value, [name]: (singletons.value[name] ?? []).filter((t) => t !== token) }
  })
  return computed(() => singletons.value[name]?.[0] === token)
}

/* -- The tree, shared -------------------------------------------------------- */

interface SharedTree {
  notes: ComputedRef<Note[]>
  tree: ComputedRef<NotesTree>
  everything: ComputedRef<Note[]>
  full: ComputedRef<NotesTree>
}

let shared: SharedTree | null = null

/**
 * The notes, and the trees they make. Built once, in a scope of its own, so
 * screens coming and going don't rebuild them.
 *
 *  - `notes` / `tree`: pages and boards only, the course workspace's Notes
 *    list (its files and recordings are listed as its materials there).
 *  - `everything` / `full`: every note, uploads, links, recordings and photos
 *    too: Notes itself, the picker, and every move (so a file inside a page
 *    moves with it).
 */
export function useNotesTree(store: CompanionStore = useCompanion()) {
  if (!shared) {
    const scope = effectScope(true)
    shared = scope.run(() => {
      const everything = computed(() => store.items.value.filter(isNote))
      const notes = computed(() => everything.value.filter(isDoc))
      return {
        notes,
        tree: computed(() => buildTree(notes.value)),
        everything,
        full: computed(() => buildTree(everything.value)),
      }
    })!
  }
  return shared
}

/* -- The pages open right now ------------------------------------------------ */

const live = new Map<string, Y.Doc>()

/** The open page's Y.Doc, so a rename from its row lands in the editor too. */
export function registerLiveDoc(id: string, doc: Y.Doc): () => void {
  live.set(id, doc)
  return () => {
    if (live.get(id) === doc) live.delete(id)
  }
}

function writeTitle(doc: Y.Doc, value: string): void {
  // `titleText()` in usePageEditor: the page's title is the doc's `title` text.
  const text = doc.getText('title')
  if (text.toString() === value) return
  doc.transact(() => {
    text.delete(0, text.length)
    text.insert(0, value)
  })
}

/* -- Addresses --------------------------------------------------------------- */

export function noteTo(id: string): string {
  return `/app/notes/${id}`
}

/** The note as a tab in its course's workspace. */
export function courseTo(note: Pick<Item, 'id' | 'kind' | 'subject_id'>): string | null {
  if (!note.subject_id) return null
  if (note.kind !== 'page' && note.kind !== 'board') return `/app/courses/${note.subject_id}`
  return `/app/courses/${note.subject_id}?open=${note.kind === 'board' ? 'board' : 'note'}:${note.id}`
}

/* -- Deletes waiting on their Undo ------------------------------------------- */

const pending = new Set<() => void>()

if (import.meta.client) {
  // Closing the tab with an Undo still up means the delete stands.
  window.addEventListener('pagehide', () => {
    for (const commit of [...pending]) commit()
  })
}

/* -- Changes ----------------------------------------------------------------- */

export interface NoteMenuItem {
  label: string
  icon: string
  run: () => void
  destructive?: boolean
  /** A shortcut, faint on the right ("F2"). */
  hint?: string
  /** A second line under the label: where a new one will be filed. */
  caption?: string
  /** A course's colour: the menu draws its dot in place of the icon. */
  color?: string | null
  /** The one that's chosen now: a check on the right. */
  checked?: boolean
  /** A thin rule above it, starting a new group. */
  divider?: boolean
  disabled?: boolean
}

/** What a note suggests it belongs to, once its course still exists. */
export interface Suggestion {
  subject: Subject
  session: Session | null
}

/**
 * "Add to Databases?": the course a note in My notes was probably made for,
 * kept on its row when it was made. Nothing once it's filed, dismissed, or
 * the course is gone.
 */
export function suggestionOf(store: CompanionStore, item: Item | null | undefined): Suggestion | null {
  if (!item || item.subject_id) return null
  const subject = store.get('subjects', item.meta?.suggested_subject_id ?? null)
  if (!subject || subject.deleted_at) return null
  const session = store.get('sessions', item.meta?.suggested_session_id ?? null)
  return { subject, session: session && session.subject_id === subject.id ? session : null }
}

/**
 * The changes, bound to the store, the toasts and the router of the calling
 * component. Call it in `setup`.
 */
export function useNoteActions() {
  const store = useCompanion()
  const toast = useToast()
  const { full: tree } = useNotesTree(store)

  function placeLabel(subjectId: string | null): string {
    return subjectId ? (store.get('subjects', subjectId)?.title ?? translate('notes.theCourse')) : translate('notes.myNotes')
  }

  /** Rows to write when a note (and what's under it) changes course. */
  function refile(group: Note[], subjectId: string | null): Map<string, Partial<Item>> {
    const patches = new Map<string, Partial<Item>>()
    for (const n of group) {
      if (n.subject_id === subjectId) continue
      // The class and topic were the old course's: they don't come along.
      patches.set(n.id, { subject_id: subjectId, session_id: null, topic_id: null })
    }
    return patches
  }

  async function write(patches: Map<string, Partial<Item>>): Promise<void> {
    await Promise.all(
      [...patches].map(([id, patch]) => store.upsert<Item>('items', { id, ...patch }).catch(() => undefined)),
    )
  }

  function merge(into: Map<string, Partial<Item>>, id: string, patch: Partial<Item>): void {
    into.set(id, { ...(into.get(id) ?? {}), ...patch })
  }

  /** The rows as they are now, for the fields a change is about to write: its Undo. */
  function before(patches: Map<string, Partial<Item>>): Map<string, Partial<Item>> {
    const out = new Map<string, Partial<Item>>()
    for (const [id, patch] of patches) {
      const row = store.get('items', id)
      if (!row) continue
      const was: Record<string, unknown> = {}
      for (const key of Object.keys(patch)) was[key] = (row as unknown as Record<string, unknown>)[key]
      out.set(id, was as Partial<Item>)
    }
    return out
  }

  /** The suggestion, dropped: filed (or moved on purpose) means decided. */
  function settled(note: Note): Partial<Item> | null {
    if (!note.meta?.suggested_subject_id && !note.meta?.suggested_session_id) return null
    return { meta: { ...note.meta, suggested_subject_id: null, suggested_session_id: null } }
  }

  async function rename(note: Note, title: string): Promise<void> {
    const value = title.replace(/\s+/g, ' ').trim()
    if (!value || value === note.title) return
    await store.upsert<Item>('items', { id: note.id, title: value }).catch(() => undefined)
    if (note.kind !== 'page') return
    const open = live.get(note.id)
    if (open) return writeTitle(open, value)
    const doc = new Y.Doc()
    const persistence = attachDocPersistence(store.repo(), note.id, doc)
    try {
      await persistence.ready
      if (persistence.reachedServer.value) {
        writeTitle(doc, value)
        await persistence.flush()
      }
    } finally {
      persistence.destroy()
      doc.destroy()
    }
  }

  async function togglePin(note: Note): Promise<void> {
    await store.upsert<Item>('items', { id: note.id, pinned: !note.pinned }).catch(() => undefined)
  }

  /**
   * To the top level of a course, or of My notes, with everything under them.
   * Several at once keep their order; one inside another that's also moving
   * just comes along with it. `sessionId` files a single note under that
   * class too (a suggestion made in class). The toast says where, with Undo.
   */
  async function moveMany(
    list: Note[],
    subjectId: string | null,
    opts: { sessionId?: string | null; quiet?: boolean } = {},
  ): Promise<void> {
    const t = tree.value
    const ids = new Set(list.map((n) => n.id))
    const tops = list.filter((n) => !ancestors(t, n.id).some((a) => ids.has(a.id)))
    if (!tops.length) return
    const patches = new Map<string, Partial<Item>>()
    const top = (t.roots.get(placeKey(subjectId)) ?? []).filter((n) => !ids.has(n.id))
    let position = top.reduce((max, n) => Math.max(max, n.position + 1), 0)
    for (const note of tops) {
      const done = settled(note)
      if (done) merge(patches, note.id, done)
      const atTop = !t.parent.get(note.id)
      if (atTop && placeKey(note.subject_id) === placeKey(subjectId)) continue
      for (const [id, patch] of refile([note, ...descendants(t, note.id)], subjectId)) merge(patches, id, patch)
      merge(patches, note.id, { parent_id: null, position: position++ })
    }
    const session = opts.sessionId ? store.get('sessions', opts.sessionId) : null
    if (session && session.subject_id === subjectId && tops.length === 1) {
      merge(patches, tops[0]!.id, { session_id: session.id, topic_id: session.topic_id })
    }
    if (!patches.size) return
    const undo = before(patches)
    // Only a suggestion cleared (it was already there): nothing to announce.
    const moved = [...patches.values()].some((patch) => Object.keys(patch).some((key) => key !== 'meta'))
    if (moved) setExpanded(folderKey(subjectId), true)
    await write(patches)
    if (opts.quiet || !moved) return
    const where = placeLabel(subjectId)
    toast.success({
      title: tops.length > 1 ? translate('notes.movedMany', { n: tops.length, where }) : translate('notes.movedTo', { where }),
      duration: 5000,
      action: { label: translate('notes.undo'), handler: () => void write(undo) },
    })
  }

  async function moveTo(note: Note, subjectId: string | null): Promise<void> {
    await moveMany([note], subjectId)
  }

  /** "Add to Databases?" pressed: filed under that course (and its class), said in a toast. */
  async function acceptSuggestion(note: Note): Promise<void> {
    const s = suggestionOf(store, note)
    if (!s) return
    await moveMany([note], s.subject.id, { sessionId: s.session?.id ?? null })
  }

  /** ✕ on the suggestion: gone for good on this note. */
  async function dismissSuggestion(note: Note): Promise<void> {
    const done = settled(note)
    if (done) await store.upsert<Item>('items', { id: note.id, ...done }).catch(() => undefined)
  }

  /** Under another page (or board): they join the end of that one's list. */
  async function nestMany(list: Note[], parent: Note): Promise<boolean> {
    const t = tree.value
    if (!isDoc(parent)) return false
    const ids = new Set(list.map((n) => n.id))
    const tops = list.filter(
      (n) =>
        n.id !== parent.id &&
        !ancestors(t, n.id).some((a) => ids.has(a.id)) &&
        !descendants(t, n.id).some((d) => d.id === parent.id) &&
        t.parent.get(n.id)?.id !== parent.id,
    )
    if (!tops.length) return false
    const patches = new Map<string, Partial<Item>>()
    const kids = t.children.get(parent.id) ?? []
    let position = kids.reduce((max, n) => Math.max(max, n.position + 1), 0)
    for (const note of tops) {
      for (const [id, patch] of refile([note, ...descendants(t, note.id)], parent.subject_id)) merge(patches, id, patch)
      const done = note.subject_id !== parent.subject_id ? settled(note) : null
      if (done) merge(patches, note.id, done)
      merge(patches, note.id, { parent_id: parent.id, position: position++ })
    }
    setExpanded(parent.id, true)
    const undo = before(patches)
    await write(patches)
    if (tops.some((n) => n.subject_id !== parent.subject_id)) {
      toast.success({
        title: translate('notes.movedInto', { title: parent.title || translate('notes.untitled') }),
        body: parent.subject_id ? translate('notes.nowIn', { where: placeLabel(parent.subject_id) }) : translate('notes.nowInMine'),
        duration: 5000,
        action: { label: translate('notes.undo'), handler: () => void write(undo) },
      })
    }
    return true
  }

  async function nestUnder(note: Note, parent: Note): Promise<boolean> {
    return nestMany([note], parent)
  }

  /** Just before or after another row: same list as it, and that list renumbered. */
  async function placeMany(list: Note[], target: Note, side: 'before' | 'after'): Promise<void> {
    const t = tree.value
    const ids = new Set(list.map((n) => n.id))
    if (ids.has(target.id)) return
    const tops = list.filter(
      (n) =>
        !ancestors(t, n.id).some((a) => ids.has(a.id)) && !descendants(t, n.id).some((d) => d.id === target.id),
    )
    if (!tops.length) return
    const parent = t.parent.get(target.id) ?? null
    const order = siblingsOf(t, target).filter((n) => !ids.has(n.id))
    const at = order.findIndex((n) => n.id === target.id) + (side === 'after' ? 1 : 0)
    order.splice(at, 0, ...tops)
    const patches = new Map<string, Partial<Item>>()
    for (const note of tops) {
      for (const [id, patch] of refile([note, ...descendants(t, note.id)], target.subject_id)) merge(patches, id, patch)
      const done = note.subject_id !== target.subject_id ? settled(note) : null
      if (done) merge(patches, note.id, done)
      if ((note.parent_id ?? null) !== (parent?.id ?? null)) merge(patches, note.id, { parent_id: parent?.id ?? null })
    }
    order.forEach((n, index) => {
      if (n.position !== index) merge(patches, n.id, { position: index })
    })
    const moved = tops.some((n) => n.subject_id !== target.subject_id)
    const undo = before(patches)
    await write(patches)
    if (moved) {
      toast.success({
        title: translate('notes.movedTo', { where: placeLabel(target.subject_id) }),
        duration: 5000,
        action: { label: translate('notes.undo'), handler: () => void write(undo) },
      })
    }
  }

  async function place(note: Note, target: Note, side: 'before' | 'after'): Promise<void> {
    await placeMany([note], target, side)
  }

  /** Gone from every screen now, deleted when the Undo goes. */
  function removeMany(list: Note[]): void {
    const t = tree.value
    const ids = new Set(list.map((n) => n.id))
    const tops = list.filter((n) => !ancestors(t, n.id).some((a) => ids.has(a.id)))
    if (!tops.length) return
    const group = tops.flatMap((n) => [n, ...descendants(t, n.id)])
    const gone = group.map((n) => n.id)
    store.leave(gone, true)
    let done = false
    const commit = (): void => {
      if (done) return
      done = true
      pending.delete(commit)
      clearTimeout(timer)
      void Promise.all(gone.map((id) => store.remove('items', id)))
        .catch(() => toast.error({ title: translate('notes.couldntDelete'), body: translate('notes.backWhere') }))
        .finally(() => store.leave(gone, false))
    }
    const timer = setTimeout(commit, 6500)
    pending.add(commit)
    const inside = group.length - tops.length
    toast.push({
      title: tops.length > 1 ? translate('notes.deletedMany', { n: tops.length }) : translate('notes.deletedOne', { title: tops[0]!.title || translate('notes.untitled') }),
      body: inside ? translate('notes.insidePages', inside) : undefined,
      duration: 6000,
      action: {
        label: translate('notes.undo'),
        handler: () => {
          if (done) return
          done = true
          pending.delete(commit)
          clearTimeout(timer)
          store.leave(gone, false)
        },
      },
    })
  }

  function remove(note: Note): void {
    removeMany([note])
  }

  /** A row's "…": the same few things wherever a note is listed or open. */
  function menuFor(
    note: Note,
    opts: { rename?: () => void; addInside?: () => void; inCourse?: boolean } = {},
  ): NoteMenuItem[] {
    const inCourse = opts.inCourse ? null : courseTo(note)
    const items: NoteMenuItem[] = [
      { label: translate('notes.rename'), icon: 'pencil', hint: 'F2', run: opts.rename ?? (() => (renamingId.value = `${note.id}:`)) },
    ]
    if (opts.addInside && note.kind === 'page') items.push({ label: translate('notes.addPageInsideShort'), icon: 'plus', run: opts.addInside })
    items.push(
      { label: note.pinned ? translate('notes.unpin') : translate('notes.pinTop'), icon: 'pin', run: () => void togglePin(note) },
      {
        label: translate('notes.moveTo'),
        icon: 'move',
        caption: note.subject_id ? translate('notes.inPlace', { where: placeLabel(note.subject_id) }) : translate('notes.inMine'),
        run: () => (movingId.value = note.id),
      },
    )
    if (inCourse) items.push({ label: translate('notes.openInCourse'), icon: 'workspace', run: () => void navigateTo(inCourse) })
    items.push({
      label: translate('notes.copyLink'),
      icon: 'link',
      run: () => {
        void navigator.clipboard
          ?.writeText(`${location.origin}${noteTo(note.id)}`)
          .then(() => toast.success({ title: translate('notes.linkCopied'), duration: 1800 }))
      },
    })
    items.push({ label: translate('notes.delete'), icon: 'trash', destructive: true, run: () => remove(note) })
    return items
  }

  return {
    tree,
    rename,
    togglePin,
    moveTo,
    moveMany,
    acceptSuggestion,
    dismissSuggestion,
    nestUnder,
    nestMany,
    place,
    placeMany,
    remove,
    removeMany,
    menuFor,
    placeLabel,
  }
}

/* -- Make and open ----------------------------------------------------------- */

/**
 * A new page or board, made and opened in Notes: the New menu, the tiles, a
 * folder's "+", a row's "+". One at a time, so a double click makes one.
 */
export function useNoteCreate() {
  const toast = useToast()
  const busy = ref(false)

  async function run(make: () => Promise<string>, what: string, replace: boolean): Promise<string | null> {
    if (busy.value) return null
    busy.value = true
    try {
      const id = await make()
      await navigateTo(noteTo(id), { replace })
      return id
    } catch {
      toast.error({ title: translate(`notes.couldntMake_${what}`), body: translate('notes.couldntMakeBody') })
      return null
    } finally {
      busy.value = false
    }
  }

  return {
    busy,
    page: (input: MakePageInput = {}, replace = false) => run(() => makePage(input), 'page', replace),
    board: (input: MakeBoardInput = {}, replace = false) => run(() => makeBoard(input), 'whiteboard', replace),
  }
}

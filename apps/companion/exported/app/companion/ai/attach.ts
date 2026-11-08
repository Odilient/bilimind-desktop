/**
 * What the learner hands the chat besides a sentence: the composer's tray.
 *
 * The chat takes material the way ChatGPT does, and more of it: files
 * (dropped anywhere, pasted, picked), notes from Notes, links, a calendar
 * link, pasted text, one of their Moodle courses. All of it sits in the box
 * as chips until the message goes, and goes with it as `attachments`, which
 * the server reads before it answers and hands to the course proposer as is
 * when a course is asked for.
 *
 *   const tray = useAiAttachments()
 *   tray.addFiles(files)          // uploads at once, progress on the chip
 *   tray.addNotes(['<item id>'])
 *   tray.uploading.value          // the send button waits while true
 *   tray.take()                   // AiAttachment[] for the message; empties the tray
 *
 * One tray for the whole app, like the draft in thread.ts: the dock, the
 * drawer, the phone's sheet and the chat page draw the same chips, so a file
 * dropped beside a lesson is still in the box when the learner opens the
 * chat full screen.
 *
 * Files upload the moment they are attached, not when the message is sent:
 * by the time the learner has finished typing, a 20 MB deck is usually up,
 * and the answer starts at once. An upload has no course, so the file lands
 * in My notes (nothing is filed by prediction); taking a chip back out
 * before sending deletes what it uploaded, because the learner's × said
 * they didn't mean to give it. The chip types are the course maker's
 * (`~/companion/create`), plus a note, so the same chip draws both.
 */
import { computed, ref } from 'vue'
import { AUTH_COOKIE, authCookieOptions, useApi } from '~/composables/useApi'
import { useToast } from '~/composables/useToast'
import type { Attachment, FileAttachment } from '../create'
import {
  domainOf,
  fileAttachment,
  FILE_LOOK,
  fileKind,
  linkAttachment,
  moodleAttachment,
  textAttachment,
  uploadWithProgress,
} from '../create'
import { useCompanion } from '../store'
import type { Item, ItemKind, Subject, Uuid } from '../types'
import type { AiAttachment } from './types'
// imports
import { importPlaylist, playlistId } from '../imports/links'

/** A page, board or file already in Notes, attached by picking it. */
export interface NoteAttachment {
  id: string
  kind: 'note'
  itemId: Uuid
  title: string
  itemKind: ItemKind
  /** "Page · My notes", "Whiteboard · Databases". */
  detail: string
}

export type TrayAttachment = Attachment | NoteAttachment

/** The server's limits (`AiAskBody`): items, links, characters of pasted text. */
export const MAX_ITEMS = 12
export const MAX_LINKS = 8
export const MAX_TEXT = 100_000
/** Longer than this, a paste is material, not a question. */
export const LONG_PASTE = 1_500

const KIND_WORD: Record<ItemKind, string> = {
  page: 'Page',
  board: 'Whiteboard',
  file: 'File',
  recording: 'Recording',
  photo: 'Photo',
  link: 'Link',
}

export const NOTE_ICON: Record<ItemKind, string> = {
  page: 'page',
  board: 'board',
  file: 'file',
  recording: 'mic',
  photo: 'camera',
  link: 'link',
}

/* -- State, module-level so every composer shares it ------------------------- */

const tray = ref<TrayAttachment[]>([])
const controllers = new Map<string, AbortController>()
/** Files this tray uploaded, so taking the chip out can take the upload back too. */
const uploadedHere = new Set<Uuid>()

function token(): string | null {
  try {
    return useCookie<string | null>(AUTH_COOKIE, authCookieOptions()).value ?? null
  } catch {
    return null
  }
}

/** The live (reactive) chip for an id: what an upload in flight writes its progress to. */
function live(id: string): FileAttachment | null {
  const found = tray.value.find((a) => a.id === id)
  return found?.kind === 'file' ? found : null
}

/* -- Uploading ----------------------------------------------------------------- */

const queue: string[] = []
let lanes = 0

/** Three at a time, each with its own bar; the rest wait their turn. */
function pumpUploads(): void {
  while (lanes < 3 && queue.length) {
    const id = queue.shift()!
    lanes += 1
    void uploadOne(id).finally(() => {
      lanes -= 1
      pumpUploads()
    })
  }
}

async function uploadOne(id: string): Promise<void> {
  const a = live(id)
  if (!a || !a.file || a.refused) return
  const c = useCompanion()
  const controller = new AbortController()
  controllers.set(id, controller)
  a.state = 'uploading'
  a.progress = 0
  a.error = null
  try {
    const item: Item = await uploadWithProgress({
      url: useApi().url('/companion/items/upload'),
      token: token(),
      file: a.file,
      onProgress: (p) => {
        const now = live(id)
        if (now) now.progress = p
      },
      signal: controller.signal,
    })
    c.rows.items[item.id] = item
    uploadedHere.add(item.id)
    const now = live(id)
    if (!now) {
      // Taken out while it was going up: it isn't wanted.
      void forget(item.id)
      return
    }
    now.itemId = item.id
    now.progress = 100
    now.state = 'done'
  } catch (error) {
    const now = live(id)
    if (!now) return
    if ((error as Error).name === 'AbortError') {
      now.state = 'ready'
      now.progress = 0
      return
    }
    now.state = 'error'
    now.error = error instanceof Error && error.message ? error.message : 'Didn\'t upload'
  } finally {
    controllers.delete(id)
  }
}

/** An upload the learner took back before sending: out of Notes again, quietly. */
async function forget(itemId: Uuid): Promise<void> {
  if (!uploadedHere.has(itemId)) return
  uploadedHere.delete(itemId)
  try {
    await useCompanion().remove('items', itemId)
  } catch {
    // It stays in My notes; harmless.
  }
}

/* -- Adding ---------------------------------------------------------------------- */

function itemsIn(list: TrayAttachment[]): number {
  return list.filter((a) => (a.kind === 'file' && !a.refused) || a.kind === 'note').length
}

function linksIn(list: TrayAttachment[]): number {
  return list.filter((a) => a.kind === 'link' || a.kind === 'calendar').length
}

function textIn(list: TrayAttachment[]): number {
  return list.reduce((n, a) => n + (a.kind === 'text' ? a.text.length : 0), 0)
}

function addFiles(files: File[]): number {
  const have = tray.value.filter((a): a is FileAttachment => a.kind === 'file')
  const fresh = files.filter((f) => !have.some((a) => a.name === f.name && a.size === f.size))
  const room = Math.max(0, MAX_ITEMS - itemsIn(tray.value))
  if (fresh.length > room) {
    useToast().push({
      title: room ? `The first ${room} are in` : 'That\'s as many as one message takes',
      body: `A message takes up to ${MAX_ITEMS} files and notes. Send these, then add the rest.`,
    })
  }
  const added = fresh.slice(0, room).map(fileAttachment)
  tray.value = [...tray.value, ...added]
  for (const a of added) if (!a.refused) queue.push(a.id)
  pumpUploads()
  return added.length
}

function addUrls(urls: string[], moodleSites: string[] = []): number {
  const have = new Set(tray.value.flatMap((a) => (a.kind === 'link' || a.kind === 'calendar' ? [a.url] : [])))
  const fresh = [...new Set(urls)].filter((u) => !have.has(u))
  const room = Math.max(0, MAX_LINKS - linksIn(tray.value))
  if (fresh.length > room) useToast().push({ title: `A message takes up to ${MAX_LINKS} links` })
  const added = fresh.slice(0, room).map((u) => linkAttachment(u, moodleSites))
  tray.value = [...tray.value, ...added]
  // imports: a YouTube playlist comes in as material.
  for (const a of added) if (a.kind === 'link' && playlistId(a.url)) void playlistChip(a.id, a.url)
  return added.length
}

/**
 * Imports: a playlist's chip, once its videos are in My notes (a page
 * listing them, one link each under it), becomes that page, so the chat reads
 * every video's title in order rather than YouTube's consent wall. Without
 * the server's YouTube key it stays the link it was. Like an upload, what
 * came in stays in My notes if the chip is taken out.
 */
async function playlistChip(chipId: string, url: string): Promise<void> {
  const page = await importPlaylist(useCompanion(), url, null)
  if (!page || !tray.value.some((a) => a.id === chipId)) return
  tray.value = tray.value.map((a) => (a.id === chipId ? noteAttachment(page) : a))
}

function addCalendar(url: string): void {
  if (tray.value.some((a) => (a.kind === 'calendar' || a.kind === 'link') && a.url === url)) return
  if (linksIn(tray.value) >= MAX_LINKS) {
    useToast().push({ title: `A message takes up to ${MAX_LINKS} links` })
    return
  }
  tray.value = [...tray.value, { id: crypto.randomUUID(), kind: 'calendar', url, domain: domainOf(url) }]
}

function addText(text: string, replace?: string): void {
  const trimmed = text.trim()
  if (!trimmed) return
  const others = tray.value.filter((a) => a.id !== replace)
  if (textIn(others) + trimmed.length > MAX_TEXT) {
    useToast().push({
      title: 'That\'s more text than one message takes',
      body: `About ${MAX_TEXT.toLocaleString('en')} characters at most. Attach it as a file instead.`,
    })
    return
  }
  if (replace) tray.value = tray.value.map((a) => (a.id === replace ? textAttachment(trimmed, replace) : a))
  else tray.value = [...tray.value, textAttachment(trimmed)]
}

function noteAttachment(item: Item): NoteAttachment {
  const c = useCompanion()
  const course = item.subject_id ? c.get('subjects', item.subject_id)?.title : null
  return {
    id: crypto.randomUUID(),
    kind: 'note',
    itemId: item.id,
    title: item.title || 'Untitled',
    itemKind: item.kind,
    detail: `${KIND_WORD[item.kind]} · ${course ?? 'My notes'}`,
  }
}

function addNotes(ids: string[]): number {
  const c = useCompanion()
  const have = new Set(tray.value.flatMap((a) => (a.kind === 'note' ? [a.itemId] : a.kind === 'file' && a.itemId ? [a.itemId] : [])))
  const rows = ids
    .filter((id) => !have.has(id))
    .map((id) => c.get('items', id))
    .filter((i): i is Item => Boolean(i))
  const room = Math.max(0, MAX_ITEMS - itemsIn(tray.value))
  if (rows.length > room) useToast().push({ title: `A message takes up to ${MAX_ITEMS} files and notes` })
  const added = rows.slice(0, room).map(noteAttachment)
  tray.value = [...tray.value, ...added]
  return added.length
}

function addMoodle(subject: Subject): void {
  if (tray.value.some((a) => a.kind === 'moodle' && a.subjectId === subject.id)) return
  tray.value = [...tray.value, moodleAttachment(useCompanion(), subject)]
}

function remove(id: string): void {
  const a = tray.value.find((x) => x.id === id)
  if (!a) return
  controllers.get(id)?.abort()
  const at = queue.indexOf(id)
  if (at >= 0) queue.splice(at, 1)
  tray.value = tray.value.filter((x) => x.id !== id)
  if (a.kind === 'file' && a.itemId) void forget(a.itemId)
}

/** A file that didn't go up, sent again. */
function retry(id: string): void {
  const a = live(id)
  if (!a || a.refused || !a.file) return
  a.state = 'ready'
  a.error = null
  queue.push(id)
  pumpUploads()
}

/* -- Sending ------------------------------------------------------------------------ */

/** One chip as the wire's `AiAttachment`, or null when there's nothing to send (a file that never went up). */
export function toAiAttachment(a: TrayAttachment): AiAttachment | null {
  switch (a.kind) {
    case 'file':
      return a.state === 'done' && a.itemId ? { kind: 'file', label: a.name, item_id: a.itemId, mime: a.mime || null } : null
    case 'note':
      return { kind: 'note', label: a.title, item_id: a.itemId }
    case 'link':
      return { kind: 'link', label: a.title ?? a.domain, url: a.url }
    case 'calendar':
      return { kind: 'calendar', label: `Calendar · ${a.domain}`, url: a.url }
    case 'text':
      return {
        kind: 'text',
        label: a.title === 'Pasted text' ? `Pasted text · ${a.words.toLocaleString('en')} words` : a.title,
        text: a.text,
      }
    case 'moodle':
      return { kind: 'moodle', label: a.title, subject_id: a.subjectId }
  }
}

const uploading = computed(() =>
  tray.value.some((a) => a.kind === 'file' && !a.refused && (a.state === 'uploading' || a.state === 'ready')),
)
const sendable = computed(() => tray.value.map(toAiAttachment).filter((a): a is AiAttachment => Boolean(a)))

/**
 * What goes with the message, and the tray emptied of it. Uploads still in
 * flight stay behind (the composer waits for them, so this only happens
 * when something else sends); a file that failed goes, since it was never
 * going to.
 */
function take(): AiAttachment[] {
  const out = sendable.value
  const sent = new Set(tray.value.filter((a) => toAiAttachment(a)).map((a) => a.id))
  tray.value = tray.value.filter((a) => !sent.has(a.id) && a.kind === 'file' && a.state !== 'error' && !a.refused)
  for (const a of out) if (a.item_id) uploadedHere.delete(a.item_id)
  return out
}

/** Start over: the chips go, and what they uploaded stays in Notes. */
function clear(): void {
  for (const c of controllers.values()) c.abort()
  queue.length = 0
  uploadedHere.clear()
  tray.value = []
}

export function useAiAttachments() {
  return {
    tray,
    uploading,
    sendable,
    addFiles,
    addUrls,
    addCalendar,
    addText,
    addNotes,
    addMoodle,
    remove,
    retry,
    take,
    clear,
  }
}

export type AiAttachments = ReturnType<typeof useAiAttachments>

/* -- How a sent attachment is drawn ------------------------------------------------- */

/** The glyph and its tint for a chip above a sent message. */
export function attachmentLook(a: AiAttachment): { icon: string; tone: string } {
  switch (a.kind) {
    case 'file': {
      const look = FILE_LOOK[fileKind(a.label, a.mime ?? '')]
      return { icon: look.icon, tone: look.tone }
    }
    case 'note': {
      const item = a.item_id ? useCompanion().get('items', a.item_id) : null
      return { icon: item ? NOTE_ICON[item.kind] : 'page', tone: 'text-text-soft' }
    }
    case 'link':
      return { icon: 'link', tone: 'text-sky-ink' }
    case 'calendar':
      return { icon: 'calendar', tone: 'text-sky-ink' }
    case 'text':
      return { icon: 'paste', tone: 'text-text-soft' }
    case 'moodle':
      return { icon: 'cap', tone: 'text-sky-ink' }
  }
}

/* -- Files dragged over a surface ---------------------------------------------------- */

export function draggingFiles(event: DragEvent): boolean {
  return Boolean(event.dataTransfer && Array.from(event.dataTransfer.types).includes('Files'))
}

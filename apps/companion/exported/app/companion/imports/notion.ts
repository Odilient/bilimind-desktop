/**
 * Imports and links: bringing a learner's Notion in, by either door
 * (`/app/notion` draws both):
 *
 *  - the export zip (Notion → Settings → Export, Markdown & CSV), read on the
 *    server: `importNotionZip(file, subjectId)`;
 *  - Notion's own page picker (only when the server has NOTION_CLIENT_ID):
 *    `connectNotion` leaves for Notion and comes back to /app/notion with
 *    `?connected=1`, then `notionPages()` lists what was shared and
 *    `importNotionPages(picked, subjectId)` brings those in.
 *
 * Either way pages land where the learner said (a course, or My notes), and
 * an assignments table arrives as deadlines waiting in the Inbox, added only
 * when they press for it. The server answers with the new rows, which go
 * into the store at once so Notes shows them before the next sync.
 */
import { useApi } from '~/composables/useApi'
import type { CompanionStore } from '../store'
import type { Item, Signal, Uuid } from '../types'

export interface NotionStatus {
  /** The server has a Notion integration, so the picker can be offered. */
  available: boolean
  connected: boolean
  workspace: string | null
}

export interface NotionPage {
  id: string
  title: string
  parent_id: string | null
  edited_at: string | null
  /** An emoji, when the page has one. */
  icon: string | null
}

export interface NotionImport {
  items: Item[]
  signals: Signal[]
  /** Pages made now. */
  pages: number
  /** Pages already brought in before (or deleted since), left as they are. */
  unchanged: number
  /** Deadlines proposed, waiting in the Inbox. */
  deadlines: number
  /** Tables that weren't assignments, left out. */
  tables_left: number
}

/** At most this many pages in one press of "Bring in" (the server's limit). */
export const MAX_PICKED = 25

function keep(store: CompanionStore, result: NotionImport): NotionImport {
  for (const item of result.items) store.rows.items[item.id] = item
  for (const signal of result.signals) store.rows.signals[signal.id] = signal
  return result
}

export async function notionStatus(): Promise<NotionStatus> {
  return useApi().get<NotionStatus>('/companion/imports/notion')
}

/** Off to Notion's picker; it sends the learner back to /app/notion. */
export async function connectNotion(subjectId: Uuid | null): Promise<void> {
  const { url } = await useApi().post<{ url: string }>('/companion/imports/notion/connect', { subject_id: subjectId })
  window.location.assign(url)
}

export function notionPages(): Promise<NotionPage[]> {
  return useApi().get<NotionPage[]>('/companion/imports/notion/pages')
}

export async function importNotionPages(store: CompanionStore, pages: NotionPage[], subjectId: Uuid | null): Promise<NotionImport> {
  const result = await useApi().post<NotionImport>(
    '/companion/imports/notion/pages',
    { pages: pages.map((p) => ({ id: p.id, title: p.title, parent_id: p.parent_id })), subject_id: subjectId },
    // About three pages a second is Notion's pace.
    { timeout: 120_000 },
  )
  return keep(store, result)
}

export async function importNotionZip(store: CompanionStore, file: File, subjectId: Uuid | null): Promise<NotionImport> {
  const form = new FormData()
  form.append('file', file)
  if (subjectId) form.append('subject_id', subjectId)
  return keep(store, await useApi().post<NotionImport>('/companion/imports/notion', form, { timeout: 180_000 }))
}

/** "12 pages are in Databases. 3 deadlines are waiting on Today." */
export function importWords(result: NotionImport, place: string): string {
  const said: string[] = []
  if (result.pages) said.push(result.pages === 1 ? `1 page is in ${place}.` : `${result.pages} pages are in ${place}.`)
  else if (result.unchanged) said.push('Those pages were already here.')
  if (result.deadlines) {
    said.push(result.deadlines === 1
      ? '1 deadline is waiting on Today.'
      : `${result.deadlines} deadlines are waiting on Today.`)
  }
  return said.join(' ') || 'There was nothing in it to bring in.'
}

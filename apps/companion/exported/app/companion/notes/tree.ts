/**
 * Notes as a tree: every page and whiteboard, filed under its course (or in
 * My notes, `subject_id` null) and under the page it was made from
 * (`parent_id`). The rows already carry both; this is the one place that
 * reads them as a tree, so the sidebar, the course's Notes list, the
 * breadcrumbs and drag and drop all agree on what sits under what.
 *
 * Notes are more than pages and boards: an upload, a link, a recording and a
 * photo made from Notes' "+" are notes too, and live in the same tree
 * (`isNote`). Only a page or a board holds other notes, though (`isDoc`): a
 * file can sit inside a page, never the other way round. What the school
 * sent (Moodle's PDFs, a Canvas file) is the course's material, not the
 * learner's notes, and stays out.
 *
 * A parent only counts when it is a page or board in the same course and
 * doesn't lead back round to the row itself. Anything else (a parent that
 * was deleted, moved to another course, or a loop two devices made at once)
 * puts the row at the top of its course instead of hiding it. Pure: safe in
 * a `computed`.
 */
import type { Item } from '../types'

/**
 * A note: any page, whiteboard, upload, link, recording or photo the learner
 * made. Its `kind` is the item's; `isDoc` narrows it to the two that open in
 * an editor and can hold other notes.
 */
export type Note = Item

/** The two kinds that open in an editor and can hold other notes. */
export type Doc = Item & { kind: 'page' | 'board' }

export function isDoc(item: Item): item is Doc {
  return (item.kind === 'page' || item.kind === 'board') && !item.deleted_at
}

/** Where a school's own files come from: course material, not a learner's notes. */
const SCHOOL = new Set<Item['source']>(['moodle', 'canvas', 'ics', 'email'])

/** Shown in Notes: a page or board, or something the learner captured themselves. */
export function isNote(item: Item): boolean {
  if (item.deleted_at) return false
  if (item.kind === 'page' || item.kind === 'board') return true
  return !SCHOOL.has(item.source)
}

/** The glyph a note wears everywhere it is listed (a name `CompanionNotesGlyph` draws). */
export function noteIcon(item: Pick<Item, 'kind'>): string {
  switch (item.kind) {
    case 'board': return 'board'
    case 'recording': return 'mic'
    case 'photo': return 'camera'
    case 'link': return 'link'
    case 'file': return 'file'
    default: return 'page'
  }
}

/** "page", "whiteboard", "recording": the kind in a sentence ("More for this whiteboard"). */
export function noteWord(item: Pick<Item, 'kind'>): string {
  switch (item.kind) {
    case 'board': return 'whiteboard'
    case 'recording': return 'recording'
    case 'photo': return 'photo'
    case 'link': return 'link'
    case 'file': return 'file'
    default: return 'page'
  }
}

/** The name a note shows when it has none. */
export function untitled(item: Pick<Item, 'kind'>): string {
  return item.kind === 'board' ? 'Untitled board' : 'Untitled'
}

/** My notes' key among the courses. */
export const MINE = ''

export function placeKey(subjectId: string | null | undefined): string {
  return subjectId ?? MINE
}

/** The order a list is in: by position, then oldest first, so a new one lands at the bottom. */
export function byPlace(a: Item, b: Item): number {
  return a.position - b.position || (a.created_at ?? '').localeCompare(b.created_at ?? '')
}

/** Newest edit first. */
export function byEdited(a: Item, b: Item): number {
  return Date.parse(b.updated_at ?? b.created_at ?? '') - Date.parse(a.updated_at ?? a.created_at ?? '') || 0
}

export interface NotesTree {
  byId: Map<string, Note>
  /** A note's id → what sits under it, in order. */
  children: Map<string, Note[]>
  /** A course's id (`MINE` for My notes) → its top level, in order. */
  roots: Map<string, Note[]>
  /** A note's id → the note it sits under, when it really does. */
  parent: Map<string, Note>
}

export function buildTree(notes: Note[]): NotesTree {
  const byId = new Map(notes.map((n) => [n.id, n]))
  const parent = new Map<string, Note>()

  for (const n of notes) {
    const p = n.parent_id ? byId.get(n.parent_id) : undefined
    if (!p || p.id === n.id || p.subject_id !== n.subject_id || !isDoc(p)) continue
    // Walk up from the parent: meeting this row again is a loop.
    let at: Note | undefined = p
    let loop = false
    for (let depth = 0; at && depth < 64; depth++) {
      if (at.id === n.id) {
        loop = true
        break
      }
      const up: Note | undefined = at.parent_id ? byId.get(at.parent_id) : undefined
      at = up && up.subject_id === at.subject_id ? up : undefined
    }
    if (!loop) parent.set(n.id, p)
  }

  const children = new Map<string, Note[]>()
  const roots = new Map<string, Note[]>()
  for (const n of notes) {
    const p = parent.get(n.id)
    const list = p ? children : roots
    const key = p ? p.id : placeKey(n.subject_id)
    const bucket = list.get(key)
    if (bucket) bucket.push(n)
    else list.set(key, [n])
  }
  for (const list of children.values()) list.sort(byPlace)
  for (const list of roots.values()) list.sort(byPlace)
  return { byId, children, roots, parent }
}

/** The notes above this one, the top first: the breadcrumb's middle. */
export function ancestors(tree: NotesTree, id: string): Note[] {
  const out: Note[] = []
  let at = tree.parent.get(id)
  while (at && out.length < 64) {
    out.unshift(at)
    at = tree.parent.get(at.id)
  }
  return out
}

/** Everything under this note, at any depth. */
export function descendants(tree: NotesTree, id: string): Note[] {
  const out: Note[] = []
  const walk = (key: string): void => {
    for (const child of tree.children.get(key) ?? []) {
      out.push(child)
      walk(child.id)
    }
  }
  walk(id)
  return out
}

/** The list this note sits in right now: its parent's children, or its course's top level. */
export function siblingsOf(tree: NotesTree, note: Note): Note[] {
  const p = tree.parent.get(note.id)
  return (p ? tree.children.get(p.id) : tree.roots.get(placeKey(note.subject_id))) ?? []
}

/* -- Search ------------------------------------------------------------------ */

export interface Piece {
  text: string
  hit: boolean
}

function words(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean)
}

/**
 * Notes whose title or text holds every word typed, the title matches first.
 * A filter, not a search engine: instant, on what the device already has.
 */
export function matchNotes(notes: Note[], query: string): Note[] {
  const ws = words(query)
  if (!ws.length) return []
  const scored: { note: Note; score: number }[] = []
  for (const note of notes) {
    const title = (note.title || 'Untitled').toLowerCase()
    const body = `${title} ${(note.preview ?? '').toLowerCase()}`
    if (!ws.every((w) => body.includes(w))) continue
    const inTitle = ws.filter((w) => title.includes(w)).length
    scored.push({ note, score: inTitle * 10 + (title.startsWith(ws[0]!) ? 5 : 0) })
  }
  return scored.sort((a, b) => b.score - a.score || byEdited(a.note, b.note)).map((s) => s.note)
}

/** A string cut into the parts that match the query and the parts that don't. */
export function highlight(text: string, query: string): Piece[] {
  const ws = words(query).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!ws.length || !text) return [{ text, hit: false }]
  const re = new RegExp(`(${ws.join('|')})`, 'gi')
  return text
    .split(re)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, hit: ws.some((w) => new RegExp(`^${w}$`, 'i').test(part)) }))
}

/** The stretch of a long text around the first match, so the match is in view. */
export function snippet(text: string | null | undefined, query: string, room = 90): string {
  if (!text) return ''
  const ws = words(query)
  const lower = text.toLowerCase()
  const at = ws.map((w) => lower.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0]
  if (at === undefined || at < room / 3) return text.slice(0, room)
  const start = Math.max(0, at - Math.round(room / 3))
  return `…${text.slice(start, start + room).trimStart()}`
}

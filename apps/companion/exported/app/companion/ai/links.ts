/**
 * Where a thing the AI names lives on screen: a citation chip, a done
 * action's "Open", a source in the Ask page's side column. One function per
 * kind of row, so every surface opens the same lesson in the same place.
 *
 * Inside a course, a page, a board, a lesson or a topic opens as a tab of
 * that course's workspace (`?open=`), which keeps the docked companion
 * beside it. A page or board in My notes has no course, so it opens in
 * Notes (`/app/notes/<id>`).
 */
import type { CompanionStore } from '../store'
import type { Item } from '../types'
import type { AiCitation } from './types'

export function itemRoute(item: Pick<Item, 'id' | 'kind' | 'subject_id'>): string | null {
  if (item.kind !== 'page' && item.kind !== 'board') {
    return item.subject_id ? `/app/courses/${item.subject_id}` : null
  }
  if (item.subject_id) return `/app/courses/${item.subject_id}?open=${item.kind === 'page' ? 'note' : 'board'}:${item.id}`
  return `/app/notes/${item.id}`
}

export function lessonRoute(store: CompanionStore, nodeId: number | string, subjectId?: string | null): string | null {
  const id = Number(nodeId)
  if (!Number.isInteger(id) || id === 0) return null
  const sid = subjectId ?? store.topics.value.find((t) => t.node_id === id)?.subject_id ?? null
  return sid ? `/app/courses/${sid}?open=lesson:${id}` : null
}

export function topicRoute(store: CompanionStore, topicId: string): string | null {
  const topic = store.get('topics', topicId)
  if (!topic) return null
  return topic.node_id
    ? `/app/courses/${topic.subject_id}?open=lesson:${topic.node_id}`
    : `/app/courses/${topic.subject_id}?open=topic:${topic.id}`
}

/**
 * A citation's destination, or `{ item }` when it is a file to fetch (the
 * caller opens its signed link), `{ href }` when it is a web page the
 * learner attached (opened in a new tab), or null when it points at
 * nothing we hold (pasted text: the chip's quote is all there is).
 */
export function citationTarget(
  store: CompanionStore,
  cite: AiCitation,
): { to: string } | { item: Item } | { href: string } | null {
  switch (cite.kind) {
    case 'attachment': {
      if (cite.url) return { href: cite.url.replace(/^webcal:/i, 'https:') }
      if (cite.subject_id && store.get('subjects', cite.subject_id)) return { to: `/app/courses/${cite.subject_id}` }
      return null
    }
    case 'item': {
      const item = store.get('items', cite.id)
      if (!item) return null
      if (item.kind === 'file' || item.kind === 'photo' || item.kind === 'link') return { item }
      const to = itemRoute(item)
      return to ? { to } : null
    }
    case 'lesson': {
      const to = lessonRoute(store, cite.id, cite.subject_id)
      return to ? { to } : null
    }
    case 'topic': {
      const to = topicRoute(store, cite.id)
      return to ? { to } : null
    }
    case 'deadline':
      return store.get('deadlines', cite.id) ? { to: `/app/d/${cite.id}` } : null
    case 'session': {
      const session = store.get('sessions', cite.id)
      const sid = session?.subject_id ?? cite.subject_id
      return sid ? { to: `/app/courses/${sid}?tab=weeks` } : null
    }
    default:
      return null
  }
}

/** The glyph a citation chip and a source row draw before their words. */
export function citationIcon(store: CompanionStore, cite: AiCitation): string {
  if (cite.kind === 'attachment') {
    if (cite.url) return /^webcal:|\.ics(\?|$)/i.test(cite.url) ? 'calendar' : 'link'
    return cite.subject_id ? 'cap' : 'paste'
  }
  if (cite.kind === 'lesson' || cite.kind === 'topic') return 'book'
  if (cite.kind === 'deadline') return 'flag'
  if (cite.kind === 'session') return cite.at_seconds != null ? 'mic' : 'calendar'
  const item = store.get('items', cite.id)
  if (!item) return 'file'
  if (item.kind === 'board') return 'board'
  if (item.kind === 'page') return 'page'
  if (item.kind === 'recording') return 'mic'
  if (item.kind === 'photo') return 'camera'
  if (item.kind === 'link') return 'link'
  return 'file'
}

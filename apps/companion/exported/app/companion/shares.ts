/**
 * A course shared by one link (Daylight 2, gaps; landing 08 Together):
 * "Invite coursemates or friends with one link. Everyone gets the same path,
 * files and dates, and studies at their own pace. Their notes stay their own."
 *
 * The server does the sharing (backend `Shares\CourseShares`, `ShareFanOut`):
 * a member gets a course of their OWN, a copy, and what anyone adds (a file
 * under a class, a date, a link) is copied into everyone's, with who added it
 * in the class feed. So nothing here is a second data model: the copies arrive
 * through sync like any other row, and `subject.share_id` says a course is
 * part of a class. This module only speaks the few calls that aren't rows:
 *
 *   shareCourse(subjectId)      the link (made on first ask) and the view
 *   shareView(shareId)          members, the feed, the owner's class numbers
 *   joinShare(code)             /join/{code}: in, with a course of one's own
 *   leaveShare(shareId)         out; the course stays theirs
 *   newShareLink(shareId)       the owner's "new link"; the old one stops
 *   shareWithClass(id, itemId)  a board, page, photo or recording, on purpose
 *                               (files and links go by themselves)
 *   shareCardsWithClass(...)    cards, merged into everyone's
 *   publicShareCard(code)       what the link shows before joining (no sign-in)
 */
import { useApi } from '~/composables/useApi'
import type { CompanionStore } from './store'
import type { CourseColor, IsoDateTime, Uuid } from './types'

export interface ShareFace {
  name: string
  initials: string
  /** 0–5: one of the six course colours, the same for a person everywhere (leaf sky apricot lilac rose butter). */
  hue: number
}

export interface ShareMember extends ShareFace {
  you: boolean
  role: 'owner' | 'member'
  /**
   * Friends only (a share of up to 8): the share of the course's topics this
   * person has passed a check on, 0–100; null when they don't share results
   * or the class is bigger.
   */
  progress: number | null
}

export interface ShareEvent {
  id: Uuid
  kind: 'file' | 'date' | 'moved' | 'firm' | 'board' | 'page' | 'cards' | 'session' | 'joined'
  /** "Aziz added Seminar 5 reading.pdf" */
  title: string
  /** "Under Seminar 5", "From an email · on everyone's week" */
  detail: string | null
  at: IsoDateTime
  who: ShareFace
}

/** The owner's view of a class of five or more who share results: counts only, never names. */
export interface ShareClassNumbers {
  of: number
  deadline: { id: Uuid; title: string; due_at: IsoDateTime | null } | null
  ready: number
  getting_there: number
  not_started: number
  /** The weakest three topics: how many passed a check on each ("9 of 26 passed a check"). */
  topics: { topic_id: Uuid; title: string; passed: number }[]
}

export interface CourseShareView {
  id: Uuid
  code: string
  /** "https://bilimind.com/join/psy101-k7q" */
  url: string
  title: string
  /** The caller's own copy of the course. */
  subject_id: Uuid
  role: 'owner' | 'member'
  members_count: number
  /** How many it may hold on the sharer's plan (6 on Free); null for no limit. */
  limit: number | null
  /** Up to 8 people: progress shows beside each name. */
  friends: boolean
  /** The first 12, in the order they joined. */
  members: ShareMember[]
  /** Newest first, at most 20. */
  feed: ShareEvent[]
  class: ShareClassNumbers | null
}

/** The link's card: the page `/join/{code}` and a chat app's preview read it. */
export interface ShareCard {
  code: string
  title: string
  course_code: string | null
  color: CourseColor
  /** The sharer's first name. */
  by: string
  topics: number
  files: number
  dates: number
  members: number
  url: string
}

export function shareCourse(subjectId: Uuid): Promise<CourseShareView> {
  return useApi().post<CourseShareView>(`/companion/subjects/${subjectId}/share`)
}

export function shareView(shareId: Uuid): Promise<CourseShareView> {
  return useApi().get<CourseShareView>(`/companion/shares/${shareId}`)
}

/** Joins and brings the new course into the store; resolves with the class, whose `subject_id` is now theirs. */
export async function joinShare(store: CompanionStore, code: string): Promise<CourseShareView> {
  const view = await useApi().post<CourseShareView>(`/companion/shares/join/${encodeURIComponent(code)}`)
  // Opened straight from a chat, the app hasn't loaded yet; the course page loads it with the new course in.
  if (store.status.ready) await store.sync()
  return view
}

export async function leaveShare(store: CompanionStore, shareId: Uuid): Promise<void> {
  await useApi().del(`/companion/shares/${shareId}/membership`)
  if (store.status.ready) await store.sync()
}

export function newShareLink(shareId: Uuid): Promise<CourseShareView> {
  return useApi().post<CourseShareView>(`/companion/shares/${shareId}/code`)
}

export function shareWithClass(shareId: Uuid, itemId: Uuid): Promise<CourseShareView> {
  return useApi().post<CourseShareView>(`/companion/shares/${shareId}/items`, { item_id: itemId })
}

export async function shareCardsWithClass(shareId: Uuid, cardIds: Uuid[], label?: string): Promise<number> {
  const { shared } = await useApi().post<{ shared: number }>(`/companion/shares/${shareId}/cards`, { card_ids: cardIds, label })
  return shared
}

/** No sign-in: the card behind a link, or null when the link has stopped working. */
export async function publicShareCard(code: string): Promise<ShareCard | null> {
  try {
    return await useApi().get<ShareCard>(`/public/shares/${encodeURIComponent(code)}`)
  } catch {
    return null
  }
}

/** "14 topics · 9 files · 4 dates", the line under a link's title. */
export function cardLine(card: Pick<ShareCard, 'topics' | 'files' | 'dates'>): string {
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
  return [n(card.topics, 'topic', 'topics'), n(card.files, 'file', 'files'), n(card.dates, 'date', 'dates')].join(' · ')
}

/** "26 people on Psychology 101", "You and Sara". */
export function membersLine(view: Pick<CourseShareView, 'members' | 'members_count' | 'title'>): string {
  if (view.members_count <= 1) return 'Only you so far'
  if (view.members_count === 2) {
    const other = view.members.find((m) => !m.you)
    return other ? `You and ${other.name}` : '2 people'
  }
  return `${view.members_count} people on ${view.title}`
}

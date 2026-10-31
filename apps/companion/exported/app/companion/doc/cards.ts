import { createEmptyCard } from 'ts-fsrs'
import type { CompanionRepo } from '../repo'
import type { CompanionStore } from '../store'
import type { Card, Item, Uuid } from '../types'
import { dayKey, isoWithOffset, relativeDay } from '../time'

/**
 * Cards made on a page. The block (or the vocabulary row) holds the words; the
 * `cards` row holds the schedule, and only the first save sets it. Later saves
 * send the words alone, so editing a typo never resets a card's history.
 */

/** A new card's first review: tomorrow morning. Class was today's exposure. */
function firstReview(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(8, 0, 0, 0)
  return d
}

export interface CardWords {
  id: Uuid
  front: string
  back: string
  quote?: string | null
}

export async function saveCard(
  store: CompanionStore,
  page: Item,
  words: CardWords,
  isNew: boolean,
): Promise<Card | null> {
  const base: Partial<Card> & { id: Uuid } = {
    id: words.id,
    front: words.front,
    back: words.back,
    source_quote: words.quote ?? null,
  }
  if (!isNew) return store.upsert<Card>('cards', base)

  const due = firstReview()
  const fsrs = JSON.parse(JSON.stringify(createEmptyCard(due))) as Record<string, unknown>
  return store.upsert<Card>('cards', {
    ...base,
    // Null on a Notebook page: still reviewed, never counted toward a course.
    subject_id: page.subject_id,
    topic_id: page.topic_id,
    item_id: page.id,
    kind: 'basic',
    fsrs,
    due_at: isoWithOffset(due),
    last_review_at: null,
    suspended: false,
  })
}

/**
 * A card's row, and whether we know. The store only holds cards that are due
 * (bootstrap sends those), so a miss there asks the repo. `known: false`
 * means the lookup failed (offline): the caller must not treat the card as
 * new, or its first save would reset a schedule that exists.
 */
export async function findCard(
  store: CompanionStore,
  repo: CompanionRepo,
  id: Uuid,
): Promise<{ row: Card | null; known: boolean }> {
  const held = store.get('cards', id)
  if (held) return { row: held, known: true }
  try {
    const rows = await repo.list<Card>('cards', { id })
    return { row: rows.find((row) => row.id === id && !row.deleted_at) ?? null, known: true }
  } catch {
    return { row: null, known: false }
  }
}

/** "today", "tomorrow", "Fri", "Thu 5 Nov". */
export function reviewLabel(dueAt: string | null | undefined): string {
  if (!dueAt) return ''
  const key = dayKey(dueAt)
  return Date.parse(dueAt) <= Date.now() ? 'today' : relativeDay(key)
}

/**
 * "What can a dirty read return?" from a highlighted sentence: split a
 * "term: definition" or "term — definition" line into front and back, else the
 * whole selection is the back and the front is left for the learner to ask.
 */
export function splitForCard(text: string): { front: string; back: string } {
  const clean = text.replace(/\s+/g, ' ').trim()
  const m = clean.match(/^(.{2,80}?)\s*(?::|\s[—–-]\s)\s*(.+)$/)
  if (m) return { front: m[1]!.trim(), back: m[2]!.trim() }
  const is = clean.match(/^(.{2,60}?)\s+(?:is|are|means)\s+(.+)$/i)
  if (is) return { front: `What ${/\sare\s/i.test(clean) ? 'are' : 'is'} ${is[1]!.trim()}?`, back: is[2]!.trim() }
  return { front: '', back: clean }
}

/**
 * Spaced repetition on the client. The contract has the client run ts-fsrs
 * and send the server the result (`POST /cards/{id}/review`), so a review on
 * a bus with no signal is still a review.
 */
import { createEmptyCard, fsrs, Rating, type Card as FsrsCard, type Grade } from 'ts-fsrs'
import type { Card } from './types'
import { isoWithOffset } from './time'

const scheduler = fsrs()

export type RatingValue = 1 | 2 | 3 | 4

export const RATINGS: { value: RatingValue; label: string; key: string }[] = [
  { value: 1, label: 'Again', key: '1' },
  { value: 2, label: 'Hard', key: '2' },
  { value: 3, label: 'Good', key: '3' },
  { value: 4, label: 'Easy', key: '4' },
]

/** The stored JSON back into a ts-fsrs card; a row with no state yet is new. */
export function toFsrs(card: Card): FsrsCard {
  const raw = card.fsrs as Partial<Record<keyof FsrsCard, unknown>>
  if (!raw || raw.due === undefined || raw.stability === undefined) {
    return createEmptyCard(new Date(card.created_at ?? Date.now()))
  }
  return {
    ...(raw as unknown as FsrsCard),
    due: new Date(raw.due as string),
    last_review: raw.last_review ? new Date(raw.last_review as string) : undefined,
  }
}

export interface ReviewResult {
  rating: RatingValue
  fsrs: Record<string, unknown>
  due_at: string
  reviewed_at: string
}

export function schedule(card: Card, rating: RatingValue, now = new Date()): ReviewResult {
  const next = scheduler.next(toFsrs(card), now, rating as unknown as Grade).card
  return {
    rating,
    fsrs: JSON.parse(JSON.stringify(next)) as Record<string, unknown>,
    due_at: isoWithOffset(next.due),
    reviewed_at: isoWithOffset(now),
  }
}

/** "10 min", "1 d", "4 d", "2 mo": when each answer would bring the card back. */
export function intervals(card: Card, now = new Date()): Record<RatingValue, string> {
  const preview = scheduler.repeat(toFsrs(card), now)
  const out = {} as Record<RatingValue, string>
  for (const r of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[]) {
    const due = preview[r].card.due.getTime()
    out[r as unknown as RatingValue] = span(due - now.getTime())
  }
  return out
}

function span(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h`
  const d = Math.round(h / 24)
  if (d < 31) return `${d} d`
  const mo = Math.round(d / 30)
  return mo < 12 ? `${mo} mo` : `${Math.round(d / 365)} y`
}

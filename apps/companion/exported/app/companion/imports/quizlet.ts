/**
 * Quizlet sets as flashcards (Daylight 2, gaps; landing 10 Connections:
 * "Your sets come in as flashcards, ready for spaced review").
 *
 * Quizlet has no public API any more, so there is nothing to connect: the
 * learner opens the set, picks "Export" (⋯ → Export), copies the text and
 * pastes it here. Quizlet's export puts a TAB between term and definition and
 * a NEW LINE between cards by default; a learner who changed those to a comma
 * and a semicolon, or pasted from Anki or a spreadsheet, is read too.
 *
 *   parseCardList(text)   → [{ front, back }], duplicates and blanks dropped
 *   importCards(store, cards, { subjectId, topicId? })
 *                         → the number added, skipping any front the course
 *                           already has ("merged into your cards")
 *
 * Works offline: cards are ordinary rows, due now (pasting a
 * set is asking to practise it). In a course shared with a class, the screen
 * may then offer `shareCardsWithClass` (companion/shares.ts).
 */
import { createEmptyCard } from 'ts-fsrs'
import type { CompanionStore } from '../store'
import type { Card, Uuid } from '../types'
import { isoWithOffset } from '../time'

export interface CardWords {
  front: string
  back: string
}

/** The most a paste brings in at once; a Quizlet set rarely passes a few hundred. */
export const MAX_CARDS = 1000

/** How the two halves of a line are split: the first of these the text actually uses. */
const SPLITS: RegExp[] = [/\t/, / +[-–—] +/, /,/]

/**
 * Lines of "term<TAB>definition" (Quizlet's default), "term - definition", or
 * "term,definition"; cards split by new lines, or by semicolons when the text
 * is one long line. A term with no definition is dropped, and so is a second
 * card with the same front.
 */
export function parseCardList(text: string): CardWords[] {
  const clean = text.replace(/\r\n?/g, '\n').trim()
  if (!clean) return []
  const rows = clean.includes('\n') ? clean.split(/\n+/) : clean.split(/;\s*/)
  const split = SPLITS.find((re) => rows.filter((r) => re.test(r)).length >= Math.ceil(rows.length / 2)) ?? SPLITS[0]!
  const seen = new Set<string>()
  const cards: CardWords[] = []
  for (const row of rows) {
    const at = row.search(split)
    if (at <= 0) continue
    const front = row.slice(0, at).trim()
    const back = row.slice(at).replace(split, '').trim()
    const key = front.toLowerCase()
    if (!front || !back || seen.has(key)) continue
    seen.add(key)
    cards.push({ front: front.slice(0, 500), back: back.slice(0, 2000) })
    if (cards.length >= MAX_CARDS) break
  }
  return cards
}

/** Into the course as new cards, due now; a front the course already has is kept as it is. */
export async function importCards(
  store: CompanionStore,
  cards: CardWords[],
  where: { subjectId: Uuid | null; topicId?: Uuid | null },
): Promise<{ added: number; skipped: number; ids: Uuid[] }> {
  const have = new Set(
    store.cards.value
      .filter((c) => !c.deleted_at && c.subject_id === where.subjectId)
      .map((c) => c.front.trim().toLowerCase()),
  )
  const now = new Date()
  const fsrs = JSON.parse(JSON.stringify(createEmptyCard(now))) as Record<string, unknown>
  const fresh = cards.filter((c) => !have.has(c.front.trim().toLowerCase()))
  const ids: Uuid[] = []
  for (const c of fresh) {
    const id = crypto.randomUUID()
    ids.push(id)
    await store.upsert<Card>('cards', {
      id,
      subject_id: where.subjectId,
      topic_id: where.topicId ?? null,
      item_id: null,
      kind: 'basic',
      front: c.front,
      back: c.back,
      source_quote: null,
      fsrs,
      due_at: isoWithOffset(now),
      last_review_at: null,
      suspended: false,
    })
  }
  return { added: fresh.length, skipped: cards.length - fresh.length, ids }
}

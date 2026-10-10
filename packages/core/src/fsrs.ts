// Thin wrapper over ts-fsrs (5.4.2): one serialisable card state (FsrsState, dates as ISO strings) used by
// review/state.json, the .ics export and the player's "Due today" list (localStorage bm:<courseId>:fsrs).
// Plus reviewDatesBackwardsFromExam(): the plan's first review dates, counted back from the exam.
import { createEmptyCard, fsrs, generatorParameters, Rating as FsrsRating } from 'ts-fsrs';
import type { Card, Grade } from 'ts-fsrs';
import type { FsrsState, Rating } from './types.ts';

const scheduler = fsrs(generatorParameters({ enable_fuzz: false, enable_short_term: true }));

const RATING: Record<Rating, Grade> = {
  again: FsrsRating.Again, hard: FsrsRating.Hard, good: FsrsRating.Good, easy: FsrsRating.Easy,
};
const toDate = (d: Date | string | number) => (d instanceof Date ? d : new Date(d));

export function toFsrsState(card: Card): FsrsState {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as FsrsState['state'],
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}
export function fromFsrsState(s: FsrsState): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    learning_steps: s.learning_steps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  } as Card;
}

/** A new card, first due at `due` (the plan's first review date), created at `now`. */
export function newCard(due: Date | string, now: Date | string = new Date()): FsrsState {
  const card = createEmptyCard(toDate(now));
  card.due = toDate(due);
  return toFsrsState(card);
}

/**
 * Rate a card. `notAfter` (e.g. the exam datetime) caps the next due date so a review never lands after
 * the exam: a later due is pulled back to `notAfter` minus 12 hours (the evening before a morning exam).
 */
export function rateCard(state: FsrsState, rating: Rating, now: Date | string = new Date(), opts: { notAfter?: Date | string | null } = {}): FsrsState {
  const next = scheduler.next(fromFsrsState(state), toDate(now), RATING[rating]).card;
  const out = toFsrsState(next);
  if (opts.notAfter) {
    const cap = toDate(opts.notAfter).getTime() - 12 * 3600_000;
    const t = toDate(now).getTime();
    if (new Date(out.due).getTime() > cap && cap > t) out.due = new Date(cap).toISOString();
  }
  return out;
}

export const isDue = (state: FsrsState, now: Date | string = new Date()): boolean =>
  new Date(state.due).getTime() <= toDate(now).getTime();

/** Cards due at `now`, most overdue first. */
export function dueCards<T extends { fsrs: FsrsState }>(cards: readonly T[], now: Date | string = new Date(), limit = Infinity): T[] {
  return cards.filter(c => isDue(c.fsrs, now))
    .sort((a, b) => new Date(a.fsrs.due).getTime() - new Date(b.fsrs.due).getTime())
    .slice(0, limit);
}

/** Card ids: quiz items "<lesson>/<item>", flashcards "<lesson>/<block>/c<n>". */
export const cardId = (lesson: string, itemOrBlock: string, card?: number): string =>
  card === undefined ? `${lesson}/${itemOrBlock}` : `${lesson}/${itemOrBlock}/c${card}`;

// ---------- review dates backwards from the exam ----------
const DAY = 86_400_000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const dayNum = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));

/** Gaps (days before the exam) for spaced reviews, last review the day before the exam. */
export const REVIEW_OFFSETS_DAYS = [1, 3, 7, 14, 30] as const;

/**
 * Review dates for a lesson studied on `learned` (YYYY-MM-DD) before an exam on `exam` (YYYY-MM-DD or an
 * ISO datetime; only the date counts). Dates are counted BACKWARDS from the exam (exam-1, exam-3, exam-7,
 * exam-14, exam-30), kept only when strictly after the study day and strictly before the exam day; the
 * day after studying is added when it fits (first retrieval soon after learning). Sorted ascending, at most
 * `max` dates (the latest ones win). No exam -> forward fallback: learned+1, +3, +7.
 */
export function reviewDatesBackwardsFromExam(learned: string, exam: string | null | undefined, max = 4): string[] {
  const l = dayNum(learned);
  if (!exam) return [1, 3, 7].slice(0, max).map(n => isoDay(l + n * DAY));
  const e = dayNum(exam.slice(0, 10));
  const set = new Set<number>();
  for (const off of REVIEW_OFFSETS_DAYS) {
    const d = e - off * DAY;
    if (d > l && d < e) set.add(d);
  }
  if (l + DAY < e) set.add(l + DAY);
  return [...set].sort((a, b) => a - b).slice(-max).map(isoDay);
}

/** Every calendar day from `start` to `end` inclusive (YYYY-MM-DD). */
export function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let t = dayNum(start); t <= dayNum(end.slice(0, 10)); t += DAY) out.push(isoDay(t));
  return out;
}

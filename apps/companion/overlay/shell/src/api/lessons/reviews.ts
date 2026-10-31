// Spaced review of finished lessons: seeded for tomorrow when a lesson is completed, rescheduled by how well it was recalled.
import { dayKey, shiftDay, daysBetween } from '../../../../app/companion/time.ts'
import { Invalid } from '../rules.ts'
import type { Raw, Rec, Store } from '../store.ts'

const MIN_EASE = 1.3
const DEFAULT_EASE = 2.5
const PASS = 3

/** Once per lesson: a lesson finished again keeps the schedule it has. */
export function seedReview(store: Store, node: Rec): void {
  if (store.recs('review', node.id).length) return
  store.add('review', node.id, {
    node_id: node.id,
    course_id: node.course_id,
    ease_factor: DEFAULT_EASE,
    interval_days: 0,
    repetitions: 0,
    lapses: 0,
    state: 'new',
    due_on: shiftDay(dayKey(Date.now()), 1),
    last_reviewed_at: null,
  })
}

function reviewWire(store: Store, item: Rec): Raw {
  const today = dayKey(Date.now())
  const node = store.rec('node', item.node_id)
  const course = store.rec('course', item.course_id)
  const until = item.due_on ? daysBetween(today, item.due_on) : 0
  return {
    id: item.id,
    user_id: 1,
    course_id: item.course_id,
    node_id: item.node_id,
    state: item.state,
    ease_factor: item.ease_factor,
    interval_days: item.interval_days,
    repetitions: item.repetitions,
    lapses: item.lapses,
    due_on: item.due_on,
    is_due: until <= 0,
    is_overdue: until < 0,
    days_late: Math.max(0, -until),
    days_until: Math.max(0, until),
    last_reviewed_at: item.last_reviewed_at,
    node: node ? { id: node.id, key: node.key, title: node.title, summary: node.summary ?? null, layer: node.layer, position: node.position, estimated_minutes: node.estimated_minutes, status: node.status, status_label: node.status === 'ready' ? 'Ready' : node.status } : null,
    course: course ? { id: course.id, title: course.title, language: course.language, status: course.status, status_label: course.status } : null,
  }
}

const dueItems = (store: Store) => {
  const today = dayKey(Date.now())
  const shelved = new Set(store.live('subjects').filter((s) => s.archived_at).map((s) => s.generated_course_id))
  return store.recs('review').filter((r) => r.due_on && r.due_on <= today && !shelved.has(r.course_id) && store.rec('node', r.node_id))
    .sort((a, b) => a.due_on.localeCompare(b.due_on) || a.id - b.id)
}

export function reviewsToday(store: Store): Raw {
  const due = dueItems(store)
  return {
    data: due.map((r) => reviewWire(store, r)),
    meta: { date: dayKey(Date.now()), due: due.length, minutes: due.reduce((n, r) => n + (store.rec('node', r.node_id)?.estimated_minutes ?? 0), 0) },
  }
}

export function reviewStats(store: Store): Raw {
  const today = dayKey(Date.now())
  const all = store.recs('review')
  const overdue = all.filter((r) => r.due_on && r.due_on < today).length
  const dueToday = all.filter((r) => r.due_on === today).length
  const days = new Set(all.map((r) => r.last_reviewed_on).filter(Boolean))
  let current = 0
  for (let day = days.has(today) ? today : shiftDay(today, -1); days.has(day); day = shiftDay(day, -1)) current++
  return {
    date: today,
    total: all.length,
    due: overdue + dueToday,
    due_today: dueToday,
    overdue,
    upcoming: all.filter((r) => r.due_on && r.due_on > today).length,
    learning: all.filter((r) => r.state === 'learning').length,
    mastering: all.filter((r) => r.state === 'review').length,
    streak: { current, active_today: days.has(today), last_reviewed_on: [...days].sort().at(-1) ?? null },
  }
}

export function submitReview(store: Store, input: Raw): Raw {
  const node = Number.isInteger(input.node_id) ? store.rec('node', input.node_id) : null
  if (!node) throw new Invalid({ node_id: ['The selected node_id is invalid.'] })
  if (!('quality' in input) && !('correct' in input)) throw new Invalid({ quality: ['Provide either a quality grade (0-5) or a correct flag.'] })
  if ('quality' in input && (!Number.isInteger(input.quality) || input.quality < 0 || input.quality > 5)) throw new Invalid({ quality: ['The quality must be between 0 and 5.'] })
  const quality: number = 'quality' in input ? input.quality : input.correct ? 5 : 2
  seedReview(store, node)
  const item = store.recs('review', node.id)[0]!
  const passed = quality >= PASS
  const repetitions = passed ? item.repetitions + 1 : 0
  const interval = !passed ? 1 : repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.max(1, Math.round(item.interval_days * item.ease_factor))
  const today = dayKey(Date.now())
  const saved = store.save('review', {
    ...item,
    repetitions,
    interval_days: interval,
    lapses: passed ? item.lapses : item.lapses + 1,
    state: passed ? 'review' : 'learning',
    ease_factor: Math.max(MIN_EASE, item.ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
    due_on: shiftDay(today, interval),
    last_reviewed_at: new Date().toISOString(),
    last_reviewed_on: today,
  })
  return { data: reviewWire(store, saved), meta: { quality, next_due_on: saved.due_on, interval_days: interval, remaining_due: dueItems(store).length } }
}

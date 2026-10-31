import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setZone } from '../merged/app/companion/time.ts'
import { ensure, rebuild } from '../merged/shell/src/api/planner.ts'
import { paceFor, todayView } from '../merged/shell/src/api/today.ts'
import { testApi, uuid } from './helpers.ts'

// Wednesday 4 November 2026, 10:00 in Lisbon.
const NOW = Date.parse('2026-11-04T10:00:00Z')
const DATE = '2026-11-04'
const days = (n: number) => new Date(NOW + n * 86_400_000).toISOString()

let t: ReturnType<typeof testApi>
beforeEach(() => {
  t = testApi()
  setZone('Europe/Lisbon')
})
afterEach(() => t.done())

const rows = (c: string, data: Record<string, unknown>) => t.post(`/companion/${c}`, { id: uuid(), ...data }).then((r) => {
  expect(r.status, JSON.stringify(r.json)).toBe(201)
  return r.data
})
const plan = () => {
  setZone('Europe/Lisbon')
  return rebuild(t.store, DATE, NOW)
}
const titles = () => plan().map((p) => p.title)

async function course(title = 'Databases', extra: Record<string, unknown> = {}) {
  return rows('subjects', { title, ...extra })
}

describe('reviews for what is close', () => {
  it('one task per close quiz with a named scope; the rest go last', async () => {
    const s = await course()
    const a = await rows('topics', { subject_id: s.id, title: 'A' })
    const b = await rows('topics', { subject_id: s.id, title: 'B' })
    await rows('deadlines', { subject_id: s.id, kind: 'quiz', title: 'Quiz 2', due_at: days(2), topic_ids: [a.id] })
    await rows('cards', { subject_id: s.id, topic_id: a.id, front: '1', due_at: days(-1) })
    await rows('cards', { subject_id: s.id, topic_id: a.id, front: '2', due_at: days(-1) })
    await rows('cards', { subject_id: s.id, topic_id: b.id, front: '3', due_at: days(-1) })
    await rows('cards', { subject_id: s.id, topic_id: b.id, front: 'question', kind: 'question', due_at: days(-1) })

    const tasks = plan()
    expect(tasks.map((p) => p.title)).toEqual(['Review 2 flashcards for Quiz 2', 'Review 1 flashcard'])
    expect(tasks[0]).toMatchObject({ kind: 'review', minutes: 2 })
    expect(tasks[0]!.detail).toBe('quiz Fri 10:00')
    expect(tasks[1]).toMatchObject({ subject_id: s.id, detail: null })
  })

  it('a card in two scopes goes to the sooner, and a final with no scope claims nothing', async () => {
    const s = await course()
    const a = await rows('topics', { subject_id: s.id, title: 'A' })
    await rows('deadlines', { subject_id: s.id, kind: 'quiz', title: 'Later', due_at: days(5), topic_ids: [a.id] })
    await rows('deadlines', { subject_id: s.id, kind: 'quiz', title: 'Sooner', due_at: days(2), topic_ids: [a.id] })
    await rows('deadlines', { subject_id: s.id, kind: 'final', title: 'Final', due_at: days(3) })
    await rows('cards', { subject_id: s.id, topic_id: a.id, front: '1', due_at: days(-1) })
    const out = titles()
    expect(out).toContain('Review 1 flashcard for Sooner')
    expect(out).toContain('Prepare for Later')
    expect(out).toContain('Prepare for Final')
  })
})

describe('deadline work', () => {
  it('scores weight x need / days left, and says the words the hosted plan says', async () => {
    const s = await course()
    await rows('deadlines', { subject_id: s.id, kind: 'assignment', title: 'Light', due_at: days(6), weight_pct: 5 })
    await rows('deadlines', { subject_id: s.id, kind: 'lab', title: 'Heavy', due_at: days(3), weight_pct: 30 })
    await rows('deadlines', { subject_id: s.id, kind: 'midterm', title: 'Mid', due_at: days(30) })
    const tasks = plan()
    expect(tasks.map((p) => p.title)).toEqual(['Work on Heavy', 'Work on Light'])
    expect(tasks[0]).toMatchObject({ kind: 'work', minutes: 25, detail: 'due Sat 10:00 · 30% of the grade' })
  })

  it('a quiz nobody checked says so', async () => {
    const s = await course()
    await rows('deadlines', { subject_id: s.id, kind: 'quiz', title: 'Quiz', due_at: days(1), weight_pct: 12.5 })
    expect(plan()[0]).toMatchObject({ kind: 'prepare', title: 'Prepare for Quiz', detail: 'quiz tomorrow 10:00 · 12.5% of the grade · not checked yet' })
  })
})

describe('the budget', () => {
  it('caps the day at 60 minutes, shrinking what can shrink and dropping below its floor', async () => {
    const s = await course()
    for (const [title, n] of [['A', 1], ['B', 2], ['C', 3], ['D', 4]] as const) {
      await rows('deadlines', { subject_id: s.id, kind: 'lab', title, due_at: days(n), weight_pct: 10 })
    }
    // 60 - 25 - 25 leaves 10, under the 15-minute floor: C and D drop, whole sessions rather than scraps.
    expect(plan().map((p) => [p.title, p.minutes])).toEqual([['Work on A', 25], ['Work on B', 25]])
  })

  it('takes done and own tasks out of the day', async () => {
    const s = await course()
    await rows('plan-tasks', { date: DATE, kind: 'own', title: 'Read ch. 3', minutes: 40 })
    await rows('deadlines', { subject_id: s.id, kind: 'lab', title: 'Lab', due_at: days(1) })
    const tasks = plan()
    expect(tasks.map((p) => [p.title, p.minutes]).sort()).toEqual([['Read ch. 3', 40], ['Work on Lab', 20]].sort())
  })

  it('reads the budget from preferences', async () => {
    await t.patch('/auth/profile', { preferences: { daily_minutes: 15 } })
    const s = await course()
    await rows('deadlines', { subject_id: s.id, kind: 'lab', title: 'Lab', due_at: days(1) })
    expect(plan()[0]!.minutes).toBe(15)
  })
})

describe('self-study pace', () => {
  async function selfCourse(perWeek: number) {
    const goal = await rows('goals', { title: 'Italian', kind: 'self', sessions_per_week: perWeek, minutes_per_session: 20, starts_on: '2026-10-01', ends_on: '2027-03-01', timezone: 'Europe/Lisbon' })
    const s = await course('Italian', { goal_id: goal.id, format: 'path' })
    return { goal, s }
  }

  it('plans the next topic on a study day, numbered by its place on the path', async () => {
    // 4 November is a Wednesday, which three sessions a week study on.
    const { s } = await selfCourse(3)
    const unit = await rows('topics', { subject_id: s.id, title: 'Unit', position: 0 })
    await rows('topics', { subject_id: s.id, title: 'Greetings', parent_id: unit.id, position: 0 })
    await rows('topics', { subject_id: s.id, title: 'Numbers', parent_id: unit.id, position: 1 })
    expect(plan()[0]).toMatchObject({ kind: 'lesson', title: 'Lesson 1: Greetings', minutes: 20, detail: null })
  })

  it('plans nothing on a day that is not a study day, and uses a slot when there is one', async () => {
    const { s } = await selfCourse(2)
    await rows('topics', { subject_id: s.id, title: 'Greetings' })
    expect(plan()).toEqual([])
    await rows('slots', { subject_id: s.id, kind: 'study', weekday: 3, starts_at: '20:00', ends_at: '20:30' })
    expect(plan()[0]).toMatchObject({ title: 'Lesson 1: Greetings', detail: '20:00' })
  })

  it('a done lesson moves the path on, and a goal worked on today gets no second session', async () => {
    const { s } = await selfCourse(3)
    const a = await rows('topics', { subject_id: s.id, title: 'Greetings', position: 0 })
    await rows('topics', { subject_id: s.id, title: 'Numbers', position: 1 })
    const first = plan()[0]!
    expect(first.topic_id).toBe(a.id)
    await t.patch(`/companion/plan-tasks/${first.id}`, { done_at: new Date(NOW).toISOString() })
    expect(titles()).toEqual(['Lesson 1: Greetings'])
    t.store.put('plan-tasks', { ...t.store.get('plan-tasks', first.id)!, date: '2026-11-02' })
    expect(titles()).toEqual(['Lesson 2: Numbers'])
  })

  it('reports pace in whole weeks', async () => {
    const { goal, s } = await selfCourse(3)
    // Four whole weeks since 1 October at 3 a week is 12 sessions, one day worked: 11 short, three whole weeks.
    await rows('plan-tasks', { date: '2026-10-20', subject_id: s.id, kind: 'lesson', title: 'L', minutes: 20, done_at: '2026-10-20T20:00:00Z' })
    expect(paceFor(t.store, t.store.get('goals', goal.id)!, NOW)).toMatchObject({ goal_id: goal.id, status: 'behind', weeks_behind: 3, sessions_per_week_actual: 0 })
  })
})

describe('an archived course', () => {
  it('is planned for in none of it', async () => {
    const s = await course('Old', { archived_at: days(-30) })
    const a = await rows('topics', { subject_id: s.id, title: 'A' })
    await rows('deadlines', { subject_id: s.id, kind: 'lab', title: 'Lab', due_at: days(1) })
    await rows('cards', { subject_id: s.id, topic_id: a.id, front: '1', due_at: days(-1) })
    expect(plan()).toEqual([])
  })
})

describe('stable on re-run', () => {
  it('same inputs, same rows, nothing rewritten', async () => {
    const s = await course()
    await rows('deadlines', { subject_id: s.id, kind: 'lab', title: 'Lab', due_at: days(2) })
    const first = plan()
    const stamp = () => t.store.db.prepare(`SELECT updated_ms FROM rows WHERE collection = 'plan-tasks' AND id = ?`).get(first[0]!.id)
    const before = stamp()
    await new Promise((r) => setTimeout(r, 5))
    expect(plan().map((p) => p.id)).toEqual(first.map((p) => p.id))
    expect(stamp()).toEqual(before)
  })

  it('a done task satisfies its key and an own task survives; what is no longer wanted is tombstoned', async () => {
    const s = await course()
    const lab = await rows('deadlines', { subject_id: s.id, kind: 'lab', title: 'Lab', due_at: days(2) })
    const quiz = await rows('deadlines', { subject_id: s.id, kind: 'lab', title: 'Essay', due_at: days(3) })
    await rows('plan-tasks', { date: DATE, kind: 'own', title: 'Mine', minutes: 5 })
    const tasks = plan()
    const done = tasks.find((p) => p.deadline_id === lab.id)!
    const dropped = tasks.find((p) => p.deadline_id === quiz.id)!
    await t.patch(`/companion/plan-tasks/${done.id}`, { done_at: new Date(NOW).toISOString() })
    await t.del(`/companion/deadlines/${quiz.id}`)

    const next = plan()
    expect(next.filter((p) => p.deadline_id === lab.id)).toHaveLength(1)
    expect(next.some((p) => p.title === 'Mine')).toBe(true)
    expect(t.store.find('plan-tasks', dropped.id)!.deleted_at).toBeTruthy()
  })

  it('ensure builds a day once, and leaves it alone even when emptied', async () => {
    const s = await course()
    await rows('deadlines', { subject_id: s.id, kind: 'lab', title: 'Lab', due_at: days(2) })
    const [only] = ensure(t.store, DATE, NOW)
    await t.del(`/companion/plan-tasks/${only!.id}`)
    expect(ensure(t.store, DATE, NOW)).toEqual([])
    expect(plan()).toHaveLength(1)
  })
})

describe('Today', () => {
  it('assembles the day from the rows', async () => {
    const s = await course()
    await rows('sessions', { subject_id: s.id, title: 'Now', starts_at: days(-0.01), ends_at: days(0.02) })
    await rows('sessions', { subject_id: s.id, title: 'Next', starts_at: days(1), ends_at: days(1.05) })
    await rows('sessions', { subject_id: s.id, title: 'Off', starts_at: days(0.5), ends_at: days(0.55), cancelled: true })
    await rows('deadlines', { subject_id: s.id, kind: 'quiz', title: 'Soon', due_at: days(2) })
    await rows('deadlines', { subject_id: s.id, kind: 'quiz', title: 'Far', due_at: days(20) })
    await rows('cards', { subject_id: s.id, front: 'c', due_at: days(-1) })
    await rows('signals', { channel: 'manual', raw_excerpt: 'x', confidence: 'own' })

    const today = todayView(t.store, DATE, 'Europe/Lisbon', NOW)
    expect(today.now_session?.title).toBe('Now')
    expect(today.next_session?.title).toBe('Next')
    expect(today.due_soon.map((d) => [d.deadline.title, d.readiness])).toEqual([['Soon', 0]])
    expect(today.reviews_due).toBe(1)
    expect(today.inbox_count).toBe(1)
    expect(today.plan.minutes).toBe(today.plan.tasks.reduce((n, p) => n + p.minutes, 0))
    expect(today.pace).toEqual([])
  })
})

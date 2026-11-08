/**
 * Today's guesses, shared with the ⌘K palette: the class on now, the lesson
 * the learner was on, the deadline that matters, where a task or a note
 * opens. Plain functions of the store and the clock, so the page and the
 * palette always agree.
 *
 * Today itself has no settings any more. It used to let sections be hidden
 * ("Customize"), but the page is now one question, one card and a quiet
 * list, and a page that reads the same way every day is what makes a glance
 * enough. The old keys (`bm:today-sections`, `bm:today-layout`) are left
 * alone in storage; nothing reads them.
 */
import { ref } from 'vue'
import type { Deadline, Item, PlanTask, Session, Subject, Topic } from './types'
import type { CompanionStore } from './store'
import { dayKey, dayLabel, daysBetween, shortDate, weekdayLong, weekdayOf, weekdayShort } from './time'
import { checkHref } from './checks'
import { translate } from '~/utils/i18n'

/* -- The clock ------------------------------------------------------------ */

const now = ref(Date.now())
let ticking = false

/**
 * The time, moved on every 30 seconds. One interval for the whole app, so
 * the hero, the classes and the palette turn over together: a class that
 * starts while Today is open becomes the hero without a reload.
 */
export function useNow() {
  // The server renders one request at a time and a module's ref would keep
  // the time it first loaded: it gets the time now, and nothing ticks there.
  if (!import.meta.client) return ref(Date.now())
  if (!ticking) {
    ticking = true
    now.value = Date.now()
    setInterval(() => (now.value = Date.now()), 30_000)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') now.value = Date.now()
    })
  }
  return now
}

/* -- Where things open ---------------------------------------------------- */

/** A page or a whiteboard: both live in Notes now. */
export function itemHref(item: Pick<Item, 'id'>): string {
  return `/app/notes/${item.id}`
}

/** A class, opened in its course (its week, its notes and recordings). */
export function classHref(session: Pick<Session, 'id' | 'subject_id'>): string {
  return `/app/courses/${session.subject_id}?open=${encodeURIComponent(`class:${session.id}`)}`
}

/** A topic's lesson, opened in its course: the written lesson, or its brief. */
export function topicHref(topic: Pick<Topic, 'id' | 'subject_id' | 'node_id'>): string {
  const open = topic.node_id ? `lesson:${topic.node_id}` : `topic:${topic.id}`
  return `/app/courses/${topic.subject_id}?open=${encodeURIComponent(open)}`
}

/**
 * Where a task on Today opens: practice for flashcards and questions, the
 * deadline for work toward it, the lesson for a lesson, otherwise the
 * course. A line the learner typed opens nothing. The hero, the plan and the
 * palette all ask, so they always agree.
 */
export function taskHref(t: PlanTask, store?: CompanionStore): string | null {
  if (t.kind === 'own') return null
  // A check opens the sitting on the task's deadline (or what's due today),
  // which is what the server's planner picked it from: the same topics.
  if (t.kind === 'check') return checkHref({ deadlineId: t.deadline_id ?? undefined })
  if (t.kind === 'review' || t.kind === 'practice') {
    if (t.deadline_id) return `/app/practice?deadline=${t.deadline_id}`
    return `/app/practice${t.subject_id ? `?subject=${t.subject_id}` : ''}`
  }
  if ((t.kind === 'work' || t.kind === 'prepare') && t.deadline_id) return `/app/d/${t.deadline_id}`
  const topic = store?.get('topics', t.topic_id) ?? null
  if (topic) return topicHref(topic)
  if (t.item_id) return itemHref({ id: t.item_id })
  if (t.subject_id) return `/app/courses/${t.subject_id}`
  return null
}

/* -- What comes next ------------------------------------------------------ */

const SOON = 15 * 60_000

/**
 * The class to take notes in: the one on now, or the one starting in the
 * next quarter of an hour (people open their notes on the way in).
 */
export function classNow(store: CompanionStore, at: number): Session | null {
  return (
    store.sessions.value.find(
      (s) => !s.cancelled && Date.parse(s.starts_at) - SOON <= at && Date.parse(s.ends_at) > at,
    ) ?? null
  )
}

/** The next class today after `at`, not counting one already on. */
export function nextClassToday(store: CompanionStore, at: number): Session | null {
  const today = dayKey(at)
  return (
    store.sessions.value.find(
      (s) => !s.cancelled && Date.parse(s.starts_at) > at && dayKey(s.starts_at) === today,
    ) ?? null
  )
}

/** A study slot, or a class in a course learned on one's own: no lecture to take notes in. */
export function isStudy(store: CompanionStore, session: Session): boolean {
  const slot = store.get('slots', session.slot_id)
  return slot?.kind === 'study' || store.subjectOf(session)?.format === 'path'
}

/** The page already written in this class, if there is one. */
export function notesOf(store: CompanionStore, session: Pick<Session, 'id'>): Item | null {
  return store.items.value.find((i) => i.kind === 'page' && i.session_id === session.id) ?? null
}

/**
 * "Take notes" on a class: the page already started in it, or a new lecture
 * page filed under it (`notes/make.ts`, loaded on first use so the screens
 * that only read this file don't carry the page maker).
 */
export async function takeNotes(store: CompanionStore, session: Session): Promise<void> {
  const page = notesOf(store, session)
  if (page) {
    await navigateTo(itemHref(page))
    return
  }
  try {
    const { makePage } = await import('./notes/make')
    const id = await makePage({ subjectId: session.subject_id, sessionId: session.id, template: 'lecture' })
    await navigateTo(itemHref({ id }))
  } catch {
    useToast().error({ title: translate('today.startPage.title'), body: translate('today.startPage.body') })
  }
}

export interface LessonNow {
  topic: Topic
  subject: Subject
  /** It was on today's plan (rather than only next on its path). */
  planned: boolean
}

/**
 * The lesson the learner was on: today's first unfinished lesson on the
 * plan, or else the first lesson not done on the path of a course they learn
 * on their own.
 */
export function lessonNow(store: CompanionStore, today = dayKey()): LessonNow | null {
  const task = store.planTasks.value
    .filter((t) => t.date === today && !t.done_at && t.topic_id && (t.kind === 'lesson' || t.kind === 'read'))
    .sort((a, b) => a.position - b.position)[0]
  const planned = store.get('topics', task?.topic_id ?? null)
  const plannedSubject = store.subjectOf(planned)
  if (planned && plannedSubject) return { topic: planned, subject: plannedSubject, planned: true }
  for (const subject of store.selfSubjects.value) {
    const step = store.pathOf(subject.id).find((s) => s.state === 'now')
    if (step) return { topic: step.topic, subject, planned: false }
  }
  return null
}

/** Upcoming deadlines inside `days`, soonest first. */
export function deadlinesWithin(store: CompanionStore, at: number, days: number): Deadline[] {
  return store.deadlines.value.filter(
    (d) =>
      d.status === 'upcoming' &&
      d.due_at &&
      Date.parse(d.due_at) > at &&
      Date.parse(d.due_at) - at < days * 86_400_000,
  )
}

/** "Thursday", "tomorrow", "today": the day something falls, as said in a sentence. */
export function dayWord(iso: string, at = Date.now()): string {
  const key = dayKey(iso)
  const diff = daysBetween(dayKey(at), key)
  if (diff === 0) return translate('today.day.today')
  if (diff === 1) return translate('today.day.tomorrow')
  if (diff === -1) return translate('today.day.yesterday')
  return Math.abs(diff) < 7 ? weekdayLong(weekdayOf(key)) : dayLabel(key)
}

/** "Thu", "today", "6 Nov": the same day, for a chip. */
export function dayShort(iso: string, at = Date.now()): string {
  const key = dayKey(iso)
  const diff = daysBetween(dayKey(at), key)
  if (diff === 0) return translate('today.day.today')
  if (diff === 1) return translate('today.day.tomorrow')
  return Math.abs(diff) < 7 ? weekdayShort(key) : shortDate(key)
}

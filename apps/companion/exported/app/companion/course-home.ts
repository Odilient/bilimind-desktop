/**
 * What a course says about itself before anything is opened: the line under
 * its name, how far along it is in words, and the one thing to press next.
 * The course library's cards (`pages/app/courses/index.vue`) and the course's
 * own home (`CompanionCourseHead`) read the same three answers from here, so
 * the "Continue" on a card and the one inside the course always agree.
 *
 * It also remembers, per course and per device, where the learner was: the
 * view in front, the documents open beside it and the last lesson read. A
 * course reopened tomorrow opens on that lesson, and its Continue names it.
 * The memory is a convenience in `localStorage`; losing it costs one click.
 *
 * The Continue, in order of what matters most right now:
 *
 *  1. a class of this course on now: take notes in it (filed under the class);
 *  2. the lesson read last, while it isn't done: pick it up where it was left;
 *  3. on a path, the step the path says is next;
 *  4. at school, the topic just taught while it is shaky, then the topic of
 *     the next class, then the first topic not done yet.
 *
 * Every answer is a value for the course page's `?open=` (`lesson:<id>`,
 * `topic:<uuid>`, `class:<uuid>`), so a card links straight into it and the
 * course page opens it the same way it opens any other link.
 */
import type { Item, Session, Subject, Topic } from './types'
import { COLLECTION_KEY, type CompanionStore } from './store'
import { pathOrder } from './readiness'
import { clock, dayKey, daysBetween, durationLabel, shortDate, untilLabel, weekdayName, weekdayShort } from './time'
import { readyWords, sizeLabel } from './words'

/* -- The views of a course's home ----------------------------------------- */

/** What the course's home can show under its header; `?tab=` names one. `grades`: tasks and grades. */
export type CourseView = 'map' | 'weeks' | 'path' | 'deadlines' | 'notes' | 'materials' | 'practice' | 'grades'

/* -- Memory ----------------------------------------------------------------- */

export interface CourseMemory {
  /** The home's view in front last time. */
  view?: CourseView
  /** Open documents as `?open=` values, in strip order. */
  docs?: string[]
  /** The document in front, or null for the course's home. */
  front?: string | null
  /** The last lesson read here, to continue from. */
  lesson?: { id: number; title: string } | null
}

const KEY = 'bm:course:'

export function recallCourse(subjectId: string): CourseMemory {
  if (!import.meta.client) return {}
  try {
    const raw = localStorage.getItem(KEY + subjectId)
    return raw ? (JSON.parse(raw) as CourseMemory) : {}
  } catch {
    return {}
  }
}

export function rememberCourse(subjectId: string, patch: CourseMemory): void {
  if (!import.meta.client) return
  try {
    localStorage.setItem(KEY + subjectId, JSON.stringify({ ...recallCourse(subjectId), ...patch }))
  } catch {
    // Private mode or a full disk: the course just opens on its home next time.
  }
}

/* -- The line under the name ----------------------------------------------- */

const TERM_WEEKS = 14

/** "Tue/Thu 10:00": the course's own weekly classes, lectures first. */
function rhythm(store: CompanionStore, subject: Subject): string {
  const slots = store.slots.value.filter((s) => s.subject_id === subject.id)
  if (!slots.length) return ''
  const main = slots.filter((s) => s.kind === 'lecture')
  const pick = main.length ? main : slots
  const days = [...new Set(pick.map((s) => s.weekday))].sort((a, b) => a - b).map(weekdayName)
  const times = new Set(pick.map((s) => s.starts_at.slice(0, 5)))
  return times.size === 1 ? `${days.join('/')} ${[...times][0]}` : days.join('/')
}

/** "about 1 h 40 min a week", from the goal's sessions and their length. */
function weekly(minutes: number): string {
  if (minutes < 60) return `${minutes} min a week`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `about ${h} h ${m} min a week` : `${h} h a week`
}

/**
 * "Week 8 of 14 · Dr. Karimov · Tue/Thu 10:00" for a school course;
 * "Italian · B1 by 1 June · on pace, 1 h 40 min a week" for one of your own.
 */
export function courseStateLine(store: CompanionStore, subject: Subject): string {
  if (subject.format === 'path') {
    const goal = store.goalOf(subject)
    const pace = store.today.value?.pace.find((p) => p.goal_id === goal?.id) ?? null
    const pacing = !pace
      ? ''
      : pace.status === 'behind'
        ? pace.weeks_behind === 1
          ? 'a week behind'
          : `${pace.weeks_behind} weeks behind`
        : pace.status === 'ahead'
          ? 'ahead of plan'
          : 'on pace'
    const minutes = goal?.sessions_per_week && goal.minutes_per_session
      ? goal.sessions_per_week * goal.minutes_per_session
      : 0
    const effort = minutes ? weekly(minutes) : ''
    const goalWords = goal && goal.title !== subject.title ? goal.title : 'On your own'
    return [goalWords, [pacing, effort].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
  }
  const week = store.currentWeek.value
  const when =
    week && week >= 1 && week <= TERM_WEEKS
      ? `Week ${week} of ${TERM_WEEKS}`
      : week && week > TERM_WEEKS
        ? 'Exam weeks'
        : ''
  return [when, subject.lecturer ?? subject.code, rhythm(store, subject)].filter(Boolean).join(' · ')
}

/* -- How far along ---------------------------------------------------------- */

export interface CourseProgress {
  done: number
  total: number
  /** "7 of 13 topics covered", "12 of 30 lessons done", or "" with nothing to count. */
  words: string
}

/** Topics heard in class at school; lessons done on a path. */
export function courseProgress(store: CompanionStore, subject: Subject, now = Date.now()): CourseProgress {
  if (subject.format === 'path') {
    const steps = store.pathOf(subject.id)
    const done = steps.filter((s) => s.state === 'done').length
    return {
      done,
      total: steps.length,
      words: steps.length ? `${done} of ${steps.length} lessons done` : 'Not started yet',
    }
  }
  const topics = pathOrder(store.topics.value.filter((t) => t.subject_id === subject.id))
  const held = new Set(
    store.sessions.value
      .filter((s) => s.subject_id === subject.id && !s.cancelled && Date.parse(s.starts_at) <= now)
      .map((s) => s.topic_id),
  )
  const done = topics.filter((t) => held.has(t.id)).length
  return {
    done,
    total: topics.length,
    words: topics.length ? `${done} of ${topics.length} topics covered` : '',
  }
}

/* -- The one thing to press -------------------------------------------------- */

export interface ContinueTarget {
  /** The button's verb: Continue, Start, Take notes, Catch up, Prepare. */
  verb: string
  /** What it opens: "Lesson 3 · SQL joins", "Lecture 8". */
  label: string
  /** A value for the course page's `?open=`. */
  open: string
  /** Why this one, in a few words: "where you left off", "in class now". */
  why: string
}

/** "Lesson 3 · SQL joins", numbered by the course's own order. */
function lessonLabel(topic: Topic, order: Topic[]): string {
  const n = order.findIndex((t) => t.id === topic.id)
  return n >= 0 ? `Lesson ${n + 1} · ${topic.title}` : topic.title
}

function openTopic(topic: Topic): string {
  return topic.node_id ? `lesson:${topic.node_id}` : `topic:${topic.id}`
}

export function continueTarget(
  store: CompanionStore,
  subject: Subject,
  memory: CourseMemory = recallCourse(subject.id),
  now = Date.now(),
): ContinueTarget | null {
  const topics = store.topics.value.filter((t) => t.subject_id === subject.id)
  const order = pathOrder(topics)
  const classes = store.sessions.value.filter((s) => s.subject_id === subject.id && !s.cancelled)
  const isPath = subject.format === 'path'

  // 1. In class right now: notes for it, filed under it.
  const live = isPath
    ? null
    : classes.find((s) => Date.parse(s.starts_at) <= now && Date.parse(s.ends_at) > now)
  if (live) {
    return { verb: 'Take notes', label: live.title, open: `class:${live.id}`, why: 'in class now' }
  }

  const doneTopic = (t: Topic): boolean => {
    const signal = store.topicSignalOf(t)
    return isPath ? signal.seen >= 1 : signal.seen > 0 && signal.practiced > 0 && signal.percent >= 85
  }

  // 2. Where they left off, while it isn't finished.
  const last = memory.lesson
  if (last) {
    const topic = topics.find((t) => t.node_id === last.id)
    if (!topic || !doneTopic(topic)) {
      return {
        verb: 'Continue',
        label: topic ? lessonLabel(topic, order) : last.title,
        open: `lesson:${last.id}`,
        why: 'where you left off',
      }
    }
  }

  // 3. A path knows its next step.
  if (isPath) {
    const step = store.pathOf(subject.id).find((s) => s.state === 'now')
    if (!step) return null
    return {
      verb: step.topic.node_id ? 'Continue' : 'Start',
      label: lessonLabel(step.topic, order),
      open: openTopic(step.topic),
      why: 'next on your path',
    }
  }

  // 4. School: what was just taught, if it's shaky; else what's taught next.
  const held = [...classes].reverse().find((s) => Date.parse(s.ends_at) <= now && s.topic_id)
  const heldTopic = held ? store.get('topics', held.topic_id) : null
  if (heldTopic && held && store.topicSignalOf(heldTopic).percent < 85) {
    return {
      verb: heldTopic.node_id ? 'Catch up' : 'Start',
      label: lessonLabel(heldTopic, order),
      open: openTopic(heldTopic),
      why: `from ${held.title}`,
    }
  }
  const coming: Session | undefined = classes.find((s) => Date.parse(s.starts_at) > now && s.topic_id)
  const comingTopic = coming ? store.get('topics', coming.topic_id) : null
  if (comingTopic && coming) {
    const day = dayKey(coming.starts_at) === dayKey(now) ? `today ${clock(coming.starts_at)}` : weekdayShort(dayKey(coming.starts_at))
    return {
      verb: 'Prepare',
      label: lessonLabel(comingTopic, order),
      open: openTopic(comingTopic),
      why: `before ${coming.title}, ${day}`,
    }
  }
  const first = order.find((t) => !doneTopic(t))
  return first
    ? { verb: first.node_id ? 'Continue' : 'Start', label: lessonLabel(first, order), open: openTopic(first), why: 'next topic' }
    : null
}

/* -- What the school gave ---------------------------------------------------- */

const MATERIAL_KINDS = new Set(['file', 'photo', 'recording', 'link'])
const KIND_ORDER = ['recording', 'file', 'link', 'photo']

export function isMaterial(item: Item): boolean {
  return MATERIAL_KINDS.has(item.kind)
}

export interface MaterialGroup {
  key: string
  /** "Week 8 · Transactions", "For the whole course". */
  label: string
  current: boolean
  items: Item[]
}

/**
 * A course's files, links, recordings and photos, by the week of the class
 * they're filed under (newest week first, the way a learner looks for "the
 * slides from Tuesday"), then whatever belongs to the whole course. A course
 * of one's own has no weeks, so its groups are its topics.
 */
export function materialGroups(store: CompanionStore, subject: Subject): MaterialGroup[] {
  const items = store.items.value.filter((i) => i.subject_id === subject.id && isMaterial(i))
  const current = store.currentWeek.value
  const groups = new Map<string, MaterialGroup & { order: number }>()
  const loose: Item[] = []
  for (const item of items) {
    const session = store.get('sessions', item.session_id)
    if (subject.format !== 'path' && session) {
      const n = session.week ?? store.weekOf(session.starts_at)
      if (n) {
        const key = `week:${n}`
        if (!groups.has(key)) {
          const topic = store.get('topics', session.topic_id)
          const name = n > TERM_WEEKS ? `Exams, week ${n - TERM_WEEKS}` : `Week ${n}`
          groups.set(key, { key, label: topic ? `${name} · ${topic.title}` : name, current: n === current, items: [], order: -n })
        }
        groups.get(key)!.items.push(item)
        continue
      }
    }
    const topic = store.get('topics', item.topic_id ?? session?.topic_id)
    if (subject.format === 'path' && topic) {
      const key = `topic:${topic.id}`
      if (!groups.has(key)) groups.set(key, { key, label: topic.title, current: false, items: [], order: topic.position })
      groups.get(key)!.items.push(item)
      continue
    }
    loose.push(item)
  }
  const out = [...groups.values()].sort((a, b) => a.order - b.order)
  if (loose.length) out.push({ key: 'course', label: 'For the whole course', current: false, items: loose, order: 0 })
  const rank = (i: Item): number => KIND_ORDER.indexOf(i.kind)
  for (const g of out) g.items.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title))
  return out.map(({ key, label, current: now, items: list }) => ({ key, label, current: now, items: list }))
}

/** "Moodle · 840 KB", "Recording · 1 h 48 m", "Link", "Your upload · 2.1 MB". */
export function materialMeta(item: Item): string {
  const from = item.source === 'moodle' ? 'Moodle' : item.source === 'made' ? '' : item.source === 'email' ? 'Email' : ''
  if (item.kind === 'recording') {
    return ['Recording', item.meta.duration_s ? durationLabel(item.meta.duration_s) : ''].filter(Boolean).join(' · ')
  }
  if (item.kind === 'link') return [from, 'Link'].filter(Boolean).join(' · ')
  const size = sizeLabel(item.meta.size)
  if (item.kind === 'photo') return ['Photo', size].filter(Boolean).join(' · ')
  return [from || 'Your upload', size].filter(Boolean).join(' · ')
}

/* -- The card on the shelf ---------------------------------------------------- */

/**
 * What a course's card on the Courses page draws (`CompanionCourseCard`).
 * The card is the course as a thing the learner owns and a path they walk,
 * so it answers four questions in this order: which course (its colour and
 * initials on a cover), how far along the path (a row of beads), where on it
 * right now ("Lesson 4 of 12 · SQL joins"), and the next date that counts,
 * with how ready they are for it. The Continue on it is `continueTarget`'s,
 * the same one the course's own home shows.
 */

/** A bead on the card's path: one topic, or a run of them on a long course. */
export type BeadState = 'done' | 'now' | 'ahead'

export interface Bead {
  state: BeadState
  /** "4 · SQL joins", or "12–14 · Joins … Views" for a run. */
  title: string
  /** Its topics' own titles in order: one, or each in the run (the card's bead tooltip lists them). */
  names: string[]
  /** The first topic's number along the path, from 1. */
  number: number
  /** A value for the course page's `?open=`: a click on a bead opens that lesson. */
  open: string
  /** Every topic's `?open=` value in the run, to find the bead a Continue starts from. */
  covers: string[]
}

/**
 * The most beads a card draws. Twenty fit a phone's card (16px apiece) and
 * still read as single stations; a longer course folds runs of topics into
 * one bead, so a 40-topic term is twenty beads, never a smear.
 */
export const MAX_BEADS = 20

interface Station {
  topic: Topic
  state: BeadState
}

/**
 * The path in order: done, then the one being walked to, then what's ahead.
 * On a course of one's own that is the path itself (`pathOf`). At school,
 * done is a topic whose class has ended, and "now" is the topic of the class
 * that's on, else of the next class, else the first one not taught yet, so
 * the bead under the Continue is the one the week is about.
 */
function stations(store: CompanionStore, subject: Subject, now: number): Station[] {
  if (subject.format === 'path') {
    return store.pathOf(subject.id).map((step) => ({
      topic: step.topic,
      state: step.state === 'done' ? 'done' : step.state === 'now' ? 'now' : 'ahead',
    }))
  }
  const order = pathOrder(store.topics.value.filter((t) => t.subject_id === subject.id))
  const classes = store.sessions.value.filter((s) => s.subject_id === subject.id && !s.cancelled && s.topic_id)
  const taught = new Set(classes.filter((s) => Date.parse(s.ends_at) <= now).map((s) => s.topic_id))
  const live = classes.find((s) => Date.parse(s.starts_at) <= now && Date.parse(s.ends_at) > now)
  const coming = classes.find((s) => Date.parse(s.starts_at) > now && !taught.has(s.topic_id))
  const current = live?.topic_id ?? coming?.topic_id ?? order.find((t) => !taught.has(t.id))?.id ?? null
  return order.map((topic) => ({
    topic,
    state: topic.id === current ? 'now' : taught.has(topic.id) ? 'done' : 'ahead',
  }))
}

/** The card's path, folded to `max` beads when the course is longer. */
export function courseBeads(store: CompanionStore, subject: Subject, now = Date.now(), max = MAX_BEADS): Bead[] {
  const line = stations(store, subject, now)
  const runs = Math.min(max, line.length)
  const out: Bead[] = []
  for (let b = 0; b < runs; b++) {
    const from = Math.floor((b * line.length) / runs)
    const to = Math.floor(((b + 1) * line.length) / runs)
    const run = line.slice(from, to)
    const first = run[0]!
    const last = run[run.length - 1]!
    const state: BeadState = run.some((s) => s.state === 'now')
      ? 'now'
      : run.filter((s) => s.state === 'done').length * 2 >= run.length
        ? 'done'
        : 'ahead'
    // A run opens at its first step not done: that's the one to pick up.
    const target = run.find((s) => s.state !== 'done') ?? first
    out.push({
      state,
      title:
        run.length === 1
          ? `${from + 1} · ${first.topic.title}`
          : `${from + 1}–${to} · ${first.topic.title} … ${last.topic.title}`,
      names: run.map((s) => s.topic.title),
      number: from + 1,
      open: openTopic(target.topic),
      covers: run.map((s) => openTopic(s.topic)),
    })
  }
  return out
}

/**
 * The one line under the title: where on the path the learner is.
 * "Lesson 4 of 12 · SQL joins" on a course of one's own; at school, the
 * week, the lecturer and the rhythm (`courseStateLine`), because a school
 * course is walked a week at a time.
 */
export function courseWhere(store: CompanionStore, subject: Subject): string {
  if (subject.format !== 'path') return courseStateLine(store, subject)
  const steps = store.pathOf(subject.id)
  if (!steps.length) return 'The path is being laid out'
  const at = steps.findIndex((s) => s.state === 'now')
  if (at < 0) return `All ${steps.length} lessons done`
  return `Lesson ${at + 1} of ${steps.length} · ${steps[at]!.topic.title}`
}

/** How the next date reads: ready, getting there, behind, or no reading yet. */
export type DateTone = 'good' | 'mid' | 'low' | 'calm'

export interface CourseDate {
  /** "Midterm", "B1 mock exam". */
  title: string
  /** "in 5 days · 62% ready", "1 Jun · on pace". */
  words: string
  tone: DateTone
  /** The deadline's own page, or nothing for a path's finish line. */
  to: string | null
}

/** "in 5 days" while it's close; "12 Dec" once it's further than two weeks. */
function when(iso: string, now: number): string {
  const days = daysBetween(dayKey(now), dayKey(iso))
  return days > 14 ? shortDate(dayKey(iso)) : untilLabel(iso, now)
}

/**
 * The next date that counts for this course: its next deadline with how
 * ready the learner is for it, or, on a course of one's own with nothing
 * due, its finish line and whether they're on pace for it.
 */
export function courseNextDate(store: CompanionStore, subject: Subject, now = Date.now()): CourseDate | null {
  const due = store.deadlines.value.find(
    (d) => d.subject_id === subject.id && d.status === 'upcoming' && d.due_at && Date.parse(d.due_at) > now,
  )
  if (due?.due_at) {
    const scope = store.readinessOf(due)
    const r = scope.total ? scope : null
    // Nothing checked yet is no verdict, so it keeps the calm tone.
    const percent = r?.checked ? r.percent : null
    return {
      title: due.title,
      words: [when(due.due_at, now), r ? readyWords(percent) : null].filter(Boolean).join(' · '),
      tone: percent === null ? 'calm' : percent >= 85 ? 'good' : percent >= 50 ? 'mid' : 'low',
      to: `/app/d/${due.id}`,
    }
  }
  if (subject.format !== 'path') return null
  const goal = store.goalOf(subject)
  if (!goal?.ends_on) return null
  const pace = store.today.value?.pace.find((p) => p.goal_id === goal.id) ?? null
  const pacing = !pace
    ? ''
    : pace.status === 'behind'
      ? pace.weeks_behind === 1
        ? 'a week behind'
        : `${pace.weeks_behind} weeks behind`
      : pace.status === 'ahead'
        ? 'ahead of plan'
        : 'on pace'
  return {
    title: goal.finish_label || 'Finish',
    words: [shortDate(goal.ends_on), pacing].filter(Boolean).join(' · '),
    tone: !pace ? 'calm' : pace.status === 'behind' ? 'low' : 'good',
    to: null,
  }
}

const SMALL_WORDS = new Set(['a', 'an', 'and', 'by', 'for', 'in', 'of', 'on', 'the', 'to', 'with', '&', '·', '-'])

/**
 * The cover's initials: "CN" for Computer Networks, "P2" for Programming 2,
 * "D" for Databases. One word gets one letter, never a stray second one
 * ("Da") that reads as a typo.
 */
export function courseInitials(title: string): string {
  const words = title
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((w) => w && !SMALL_WORDS.has(w.toLowerCase()))
  if (!words.length) return '·'
  const picked = words.slice(0, 2).map((w) => (/^\p{N}+$/u.test(w) ? w.slice(0, 2) : w[0]!.toUpperCase()))
  return picked.join('').slice(0, 2)
}

/* -- Letting a course go ------------------------------------------------------- */

/** What the learner made or brought, as against what the school sent. */
const OWN_SOURCES = new Set<Item['source']>(['made', 'share', 'email', 'import'])

/** Rows that hang off a course and go when it goes. */
const UNDER_A_COURSE = ['slots', 'sessions', 'topics', 'deadlines', 'cards', 'plan-tasks', 'items'] as const

/**
 * Delete a course, keeping what the learner made. Their own pages, boards,
 * uploads and recordings move to My notes first (top level, nothing lost);
 * then the course goes, and the server tombstones its weeks, topics,
 * deadlines, cards and the school's files with it (the API's rule 11). A
 * course of one's own takes its goal along when nothing else follows it.
 *
 * The screen doesn't wait for the server's tombstones: the rows under the
 * course are marked gone here at once, and a sync settles the rest.
 *
 * Returns how many of the learner's things were moved to My notes.
 */
export async function deleteCourse(store: CompanionStore, subject: Subject): Promise<number> {
  const mine = store.items.value.filter((i) => i.subject_id === subject.id && OWN_SOURCES.has(i.source))
  const moving = new Set(mine.map((i) => i.id))
  await Promise.all(
    mine.map((i) =>
      store.upsert<Item>('items', {
        id: i.id,
        subject_id: null,
        session_id: null,
        topic_id: null,
        // Under one of the school's files, which is about to go: up to the top.
        ...(i.parent_id && !moving.has(i.parent_id) ? { parent_id: null } : {}),
      }),
    ),
  )
  await store.remove('subjects', subject.id)

  const gone: Promise<void>[] = []
  for (const collection of UNDER_A_COURSE) {
    const table = store.rows[COLLECTION_KEY[collection]] as Record<string, { subject_id?: string | null; deleted_at?: string | null }>
    for (const [id, row] of Object.entries(table)) {
      if (row.subject_id !== subject.id || row.deleted_at) continue
      table[id] = { ...row, deleted_at: new Date().toISOString() }
    }
  }
  const goal = store.goalOf(subject)
  if (goal && goal.kind === 'self' && !store.subjects.value.some((s) => s.goal_id === goal.id)) {
    gone.push(store.remove('goals', goal.id).catch(() => undefined))
  }
  await Promise.all(gone)
  void store.sync().catch(() => undefined)
  forgetCourse(subject.id)
  return mine.length
}

/** Drop the per-device memory of a course that no longer exists. */
function forgetCourse(subjectId: string): void {
  if (!import.meta.client) return
  try {
    localStorage.removeItem(KEY + subjectId)
  } catch {
    // Nothing to forget in private mode.
  }
}

/**
 * What the learner most likely wants to ask, for exactly what is on screen:
 * three or four one-tap questions in an empty thread, on Today, and in the
 * palette. They are built from the store, so they name real things ("Get
 * ready for Quiz 2 · Databases", "Summarise Lecture 7") and never a placeholder. A chip's
 * words are short; the question it sends can say more ("…in Computer
 * Networks"), because the model reads it and the learner doesn't have to.
 */
import { computed, type ComputedRef } from 'vue'
import { useCompanion, type CompanionStore } from '../store'
import type { Deadline, Session, Subject, Topic } from '../types'
import { clock, dayKey, dayMonthLong, daysBetween } from '../time'
import { KIND_WORD } from '../words'
import { useAi } from './state'
import type { AiContext } from './types'

export interface AiSuggestion {
  /** The chip's words. */
  label: string
  /** What is sent. */
  prompt: string
  icon: string
}

function clip(text: string, n = 34): string {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > n ? `${one.slice(0, n - 1).trimEnd()}…` : one
}

function s(label: string, icon: string, prompt = label): AiSuggestion {
  return { label, prompt, icon }
}

/**
 * The chip that gets the learner ready for a deadline. It used to read "Quiz
 * me for Quiz 2": quiz twice, and not a word on which course. Now it says
 * what it is for and where the thing is from ("Get ready for Quiz 2 ·
 * Databases"), and the question asks for what a test needs: what it covers,
 * in two lines, then questions on exactly that, one at a time. `when` ("on
 * Friday") goes in the question only; the chip has no room for it.
 */
export function prepFor(deadline: Deadline, course: string | null, when: string | null = null): AiSuggestion {
  const label = course
    ? `Get ready for ${clip(deadline.title, 20)} · ${clip(course, 16)}`
    : `Get ready for ${clip(deadline.title, 26)}`
  const prompt =
    `Help me get ready for ${deadline.title}${course ? ` in ${course}` : ''}${when ? `, ${when}` : ''}. ` +
    'Say in two lines what it covers, then quiz me on exactly that, one question at a time, ' +
    'starting with what I know least.'
  return { label, prompt, icon: 'quiz' }
}

/** The next deadline that hasn't passed, in one course or anywhere. */
export function nextDeadline(store: CompanionStore, subjectId?: string | null, now = Date.now()): Deadline | null {
  return (
    store.deadlines.value.find(
      (d) =>
        d.status === 'upcoming' &&
        d.due_at != null &&
        Date.parse(d.due_at) > now &&
        (!subjectId || d.subject_id === subjectId),
    ) ?? null
  )
}

/** The last class that has happened and had a topic, in one course or anywhere. */
export function lastClass(store: CompanionStore, subjectId?: string | null, now = Date.now()): Session | null {
  const past = store.sessions.value.filter(
    (x) => !x.cancelled && x.topic_id && Date.parse(x.ends_at) < now && (!subjectId || x.subject_id === subjectId),
  )
  return past[past.length - 1] ?? null
}

/** The taught topic the learner holds least well, or the first one when nothing is taught yet. */
export function weakestTopic(store: CompanionStore, subjectId: string, now = Date.now()): Topic | null {
  const topics = store.topics.value.filter((t) => t.subject_id === subjectId && !t.parent_id)
  if (!topics.length) return null
  const taught = new Set(
    store.sessions.value
      .filter((x) => x.subject_id === subjectId && x.topic_id && Date.parse(x.starts_at) < now)
      .map((x) => x.topic_id!),
  )
  // What the next deadline covers comes first: that's where weak matters.
  const next = nextDeadline(store, subjectId, now)
  const due = new Set(next?.topic_ids ?? [])
  const taughtPool = topics.filter((t) => taught.has(t.id))
  const duePool = taughtPool.filter((t) => due.has(t.id))
  const pool = duePool.length ? duePool : taughtPool
  if (!pool.length) return topics[0]!
  let best = pool[0]!
  let score = store.topicSignalOf(best).percent
  for (const t of pool.slice(1)) {
    const p = store.topicSignalOf(t).percent
    if (p < score) {
      best = t
      score = p
    }
  }
  return best
}

export function suggestionsFor(ctx: AiContext, store: CompanionStore, now = Date.now()): AiSuggestion[] {
  const subject = ctx.subjectId ? store.get('subjects', ctx.subjectId) : null

  switch (ctx.kind) {
    case 'lesson':
      return [
        s('Explain this more simply', 'bulb'),
        s('Quiz me on this lesson', 'quiz'),
        s('Make flashcards from this', 'cards'),
        s('Give me a real example', 'target'),
      ]

    case 'page': {
      const item = ctx.itemId ? store.get('items', ctx.itemId) : null
      const out = [s('Summarise into key points', 'list'), s('Turn this into flashcards', 'cards')]
      if (item?.session_id) {
        const session = store.get('sessions', item.session_id)
        out.push(s('What did I miss?', 'search', `What did I miss from ${session?.title ?? 'this class'}? Compare my notes with the class materials.`))
      }
      out.push(s('Continue writing', 'pencil', 'Continue writing this page in the same style.'))
      return out
    }

    case 'board': {
      const out: AiSuggestion[] = []
      if (subject) out.push(s(`Map ${clip(subject.title, 22)}'s topics`, 'map', `Map ${subject.title}'s topics so far as a mind map.`))
      out.push(s('Turn this board into notes', 'page'))
      out.push(s('What\'s missing from this map?', 'search'))
      return out
    }

    case 'deadline': {
      const deadline = ctx.deadlineId ? store.get('deadlines', ctx.deadlineId) : null
      const name = deadline?.title ?? ctx.label
      const full = subject ? `${name} in ${subject.title}` : name
      return [
        s(`What's on ${clip(name, 22)}?`, 'list', `What's on ${full}?`),
        // On the deadline's own page, "it" is plain.
        s('Quiz me on what it covers', 'quiz', `Quiz me on what ${full} covers, one question at a time.`),
        s('Plan my revision', 'calendar', `Plan my revision for ${full}, day by day until it's due.`),
        s('Map what\'s on it', 'map', `Map the topics on ${full} as a mind map.`),
      ]
    }

    case 'course': {
      if (!subject) break
      const out: AiSuggestion[] = []
      const next = nextDeadline(store, subject.id, now)
      if (next) out.push(s(`What's on ${clip(next.title, 22)}?`, 'list', `What's on ${next.title} in ${subject.title}?`))
      out.push(s(`Plan my week for ${clip(subject.title, 18)}`, 'calendar', `Plan my week for ${subject.title}.`))
      const weak = weakestTopic(store, subject.id, now)
      if (weak) out.push(s(`Quiz me on ${clip(weak.title, 22)}`, 'quiz', `Quiz me on ${weak.title} (${subject.title}).`))
      const last = lastClass(store, subject.id, now)
      if (last) out.push(s(`Summarise ${clip(last.title, 22)}`, 'list', `Summarise ${last.title} of ${subject.title}.`))
      return out.slice(0, 4)
    }

    case 'notes': {
      const latest = [...store.items.value]
        .filter((i) => i.kind === 'page')
        .sort((a, b) => Date.parse(b.updated_at ?? '') - Date.parse(a.updated_at ?? ''))[0]
      const out = [s('Summarise this week\'s notes', 'list', 'Summarise my notes from this week.')]
      if (latest) out.push(s(`Flashcards from ${clip(latest.title, 20)}`, 'cards', `Turn "${latest.title}" into flashcards.`))
      const last = lastClass(store, null, now)
      const topic = last?.topic_id ? store.get('topics', last.topic_id) : null
      if (topic) out.push(s(`My notes on ${clip(topic.title, 22)}`, 'search', `What do my notes say about ${topic.title}?`))
      return out
    }

    default:
      break
  }

  // Today and everything else: the day, the next deadline, the week, the last class.
  const out: AiSuggestion[] = [s('What should I focus on today?', 'target')]
  const next = nextDeadline(store, null, now)
  if (next) {
    out.push(prepFor(next, store.get('subjects', next.subject_id)?.title ?? null))
  }
  out.push(s('Plan my week', 'calendar'))
  const last = lastClass(store, null, now)
  const topic = last?.topic_id ? store.get('topics', last.topic_id) : null
  if (topic) out.push(s(`Explain ${clip(topic.title, 26)}`, 'bulb', `Explain ${topic.title} from my last class.`))
  return out.slice(0, 4)
}

/** The suggestions for whatever is on screen now, kept current as it changes. */
export function useAiSuggestions(): ComputedRef<AiSuggestion[]> {
  const ai = useAi()
  const store = useCompanion()
  return computed(() => (store.status.ready ? suggestionsFor(ai.context.value, store) : []))
}

/* -- A new chat's starters ----------------------------------------------------------- */

/**
 * What a new chat offers first, read off the learner's week: the class
 * coming up today (what to go over before it), or the one that just ended
 * (a recap); the next deadline (a quiz for it); then the day and the week.
 * Three of them; the chat page adds "Make a course" as the fourth, always.
 */
export function chatStarters(store: CompanionStore, now = Date.now()): AiSuggestion[] {
  const out: AiSuggestion[] = []
  const today = dayKey(now)
  const course = (id: string) => store.get('subjects', id)?.title ?? ''

  const upcoming = store.sessions.value.find(
    (x) => !x.cancelled && dayKey(x.starts_at) === today && Date.parse(x.starts_at) > now,
  )
  const last = lastClass(store, null, now)
  if (upcoming) {
    const topic = upcoming.topic_id ? store.get('topics', upcoming.topic_id) : null
    out.push(
      s(
        `Before ${clip(upcoming.title, 18)} at ${clock(upcoming.starts_at)}`,
        'calendar',
        `I have ${upcoming.title} of ${course(upcoming.subject_id)} at ${clock(upcoming.starts_at)}${topic ? ` on ${topic.title}` : ''}. What should I go over before it?`,
      ),
    )
  } else if (last && now - Date.parse(last.ends_at) < 36 * 3_600_000) {
    const topic = last.topic_id ? store.get('topics', last.topic_id) : null
    if (topic) out.push(s(`Recap ${clip(topic.title, 24)}`, 'list', `Recap ${topic.title} from ${last.title} in ${course(last.subject_id)}.`))
  }

  const next = nextDeadline(store, null, now)
  if (next) out.push(prepFor(next, course(next.subject_id) || null))

  out.push(s('What should I focus on today?', 'target'))
  out.push(s('Plan my week', 'calendar'))
  return out.slice(0, 3)
}

/** Sentences that make good courses, cycled in the empty box and offered as starters. */
export const COURSE_EXAMPLES = [
  'Italian to B1 by June',
  'Databases, 2nd-year CS with Prof. Karimov',
  'Become a backend developer by March',
  'IELTS 7.0 on 14 December',
]

/**
 * The exam three days to ten weeks away, if there is one: the course the
 * learner most likely wants next is revising for it, and the sentence is
 * already written ("Revise for the Databases final on 12 December").
 */
export function nextExam(
  store: CompanionStore,
  now = Date.now(),
): { deadline: Deadline; subject: Subject; word: string; sentence: string } | null {
  const today = dayKey(now)
  const deadline = store.deadlines.value.find((d) => {
    if (d.status !== 'upcoming' || !d.due_at || !['final', 'exam', 'midterm'].includes(d.kind)) return false
    const days = daysBetween(today, dayKey(d.due_at))
    return days >= 3 && days <= 70
  })
  const subject = deadline ? store.subjectOf(deadline) : null
  if (!deadline || !subject) return null
  const word = KIND_WORD[deadline.kind].toLowerCase()
  return {
    deadline,
    subject,
    word,
    sentence: `Revise for the ${subject.title} ${word} on ${dayMonthLong(dayKey(deadline.due_at!))}`,
  }
}

/** `nextExam`'s sentence alone: the first course sentence a new course chat offers. */
export function predictedCourse(store: CompanionStore, now = Date.now()): string | null {
  return nextExam(store, now)?.sentence ?? null
}

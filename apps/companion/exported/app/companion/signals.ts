/**
 * A signal, said in words: the question it asks, what changes from what to
 * what, and where it came from. The Inbox, Today's "Waiting for your OK" and
 * the paste flow all show signals the same way, so the wording lives here
 * once. None of the words are ours: a date that isn't official yet is "not
 * confirmed", never "tentative", and the button says what it does ("Move
 * it"), not "Apply".
 */
import type { Deadline, FactType, Session, Signal, SignalFact, Subject } from './types'
import type { CompanionStore } from './store'
import { clock, dayKey, dayLabel, relativeDay, timecode } from './time'
import { fmtDate, translate } from '~/utils/i18n'

/** The address forwarded mail lands on: `<alias>@` this. */
export const FORWARD_DOMAIN = 'in.bilimind.com'

export interface SignalView {
  subject: Subject | null
  /** "Lab 4 report", the thing it is about. */
  subjectLine: string
  headline: string
  before: string | null
  after: string | null
  /** The quoted words, and who or what said them. */
  quote: string
  quoteBy: string | null
  source: string
  /** The same, said after a name: "in a shared message". */
  sourceIn: string
  /** One sentence on what applying does, at this confidence. */
  consequence: string
  applyLabel: string
  canApply: boolean
}

function when(iso: unknown): string | null {
  if (typeof iso !== 'string' || !iso) return null
  return `${dayLabel(dayKey(iso))} ${clock(iso)}`
}

const tr = (key: string, named?: Record<string, unknown>): string => translate(`today.sig.${key}`, named)

// Channels: share, telegram, email, transcript, moodle, ics, photo, pdf, manual, import
//, assistant.
// Each has `today.sig.from.<channel>` ("From an email") and `today.sig.in.<channel>` ("in an email").

/**
 * Planner and inbox: the course a fact is for, found the way the
 * server's SignalApplier::subjectFor finds it: the guess by id, the signal's
 * own course, then the one course with exactly that code, then that title.
 * Null means the learner has to say ("Add to a course" in the Inbox).
 */
export function factCourse(store: CompanionStore, signal: Signal, fact: SignalFact | undefined): Subject | null {
  const byId = store.get('subjects', fact?.subject_guess?.id ?? null) ?? store.get('subjects', signal.subject_id)
  if (byId) return byId
  for (const field of ['code', 'title'] as const) {
    const value = fact?.subject_guess?.[field]?.toLowerCase()
    if (!value?.trim()) continue
    const found = store.subjects.value.filter((s) => s[field]?.toLowerCase() === value)
    if (found.length === 1) return found[0]!
  }
  return null
}

/** The deadlines a signal proposes that name no course of the learner's: what "Add to a course" answers. */
export function uncoursedFacts(store: CompanionStore, signal: Signal): number[] {
  return signal.facts.flatMap((f, i) => (f.type === 'deadline.create' && !factCourse(store, signal, f) ? [i] : []))
}

export function describeSignal(signal: Signal, store: CompanionStore): SignalView {
  const fact: SignalFact | undefined = signal.facts[0]
  const subject = factCourse(store, signal, fact)
  const deadline: Deadline | null = fact?.target_id ? store.get('deadlines', fact.target_id) : null
  const session: Session | null = fact?.target_id ? store.get('sessions', fact.target_id) : null
  const payload = (fact?.payload ?? {}) as Record<string, unknown>
  const creates = signal.facts.filter((f) => f.type === 'deadline.create').length

  // The words that matter are the fact's evidence; the excerpt around them is
  // the chat. A chat line is "Name · 21:05" alone above the message, or
  // "Name · 21:05: message" on one line; either way the sender is kept apart.
  const lines = signal.raw_excerpt.split('\n')
  const evidence = fact?.evidence?.trim()
  let quote = signal.raw_excerpt
  let header: string | null = null
  const at = evidence ? lines.findIndex((l) => l.includes(evidence)) : -1
  if (at >= 0) {
    quote = evidence!
    const inline = lines[at]!.match(/^(.{1,40}?·\s*\d{1,2}:\d{2}):\s/)
    if (inline) header = inline[1]!
    else if (at > 0 && /·\s*\d{1,2}:\d{2}\s*$/.test(lines[at - 1]!)) header = lines[at - 1]!.trim()
  } else if (lines.length > 1 && /·\s*\d{1,2}:\d{2}$/.test(lines[0]!)) {
    header = lines[0]!
    quote = lines.slice(1).join('\n')
  }

  let headline = tr('keep')
  let before: string | null = null
  let after: string | null = null
  let subjectLine = subject?.title ?? fact?.subject_guess.title ?? tr('noCourse')

  switch (fact?.type) {
    case 'deadline.update': {
      const title = deadline?.title ?? String(payload.title ?? tr('deadline'))
      subjectLine = `${subject?.title ?? ''}${subject ? ' · ' : ''}${title}`
      if (payload.due_at) {
        headline = tr('moveDeadline')
        before = when(deadline?.due_at) ?? tr('noDateYet')
        after = when(payload.due_at)
      } else if (payload.confirmed) {
        headline = tr('confirm', { title })
      } else headline = tr('update', { title })
      break
    }
    case 'deadline.create': {
      const title = String(payload.title ?? tr('aDeadline'))
      if (subject) subjectLine = `${subject.title} · ${deadline?.title ?? title}`
      headline = subject ? tr('addTo', { title, course: subject.title }) : tr('add', { title })
      after = when(payload.due_at) ?? tr('dateTbc')
      // Planner and inbox: an imported table proposes its rows in one
      // signal, and the one button adds them all, so the card says so.
      if (creates > 1) {
        const titles = signal.facts.filter((f) => f.type === 'deadline.create').map((f) => String(f.payload.title ?? ''))
        if (subject) subjectLine = subject.title
        headline = subject ? tr('addManyTo', { n: creates, course: subject.title }) : tr('addMany', { n: creates })
        after = creates > 3 ? tr('andMore', { list: titles.slice(0, 3).join(', '), n: creates - 3 }) : titles.join(', ')
      }
      break
    }
    case 'deadline.cancel': {
      headline = tr('cancelled', { title: deadline?.title ?? tr('it') })
      before = when(deadline?.due_at)
      after = tr('cancelledAfter')
      break
    }
    case 'session.cancel': {
      headline = tr('cancelled', { title: session?.title ?? tr('theClass') })
      before = session ? `${relativeDay(dayKey(session.starts_at))} ${clock(session.starts_at)}` : null
      after = tr('noClass')
      break
    }
    case 'session.move': {
      headline = tr('moveClass', { title: session?.title ?? tr('theClass') })
      before = when(session?.starts_at)
      after = when(payload.starts_at)
      break
    }
    case 'slot.create': {
      const weekday = Number(payload.weekday ?? 1)
      headline = tr('weekly')
      // 2024-01-01 is a Monday, so weekday 1 is Monday.
      after = `${fmtDate(new Date(Date.UTC(2024, 0, weekday)), { weekday: 'short', timeZone: 'UTC' })} ${payload.starts_at ?? ''}–${payload.ends_at ?? ''}${payload.location ? ` · ${payload.location}` : ''}`
      break
    }
    case 'note':
      headline = tr('note')
      break
  }

  let source = tr(`from.${signal.channel}`)
  let sourceIn = tr(`in.${signal.channel}`)
  if (signal.channel === 'transcript' && signal.at_seconds != null) {
    source = tr('saidInLecture', { time: timecode(signal.at_seconds) })
    sourceIn = tr('saidInLectureIn', { time: timecode(signal.at_seconds) })
  }

  const tentative = signal.confidence === 'heard' || signal.confidence === 'shared'
  const consequence = tentative
    ? tr('consequenceTentative')
    : signal.confidence === 'own'
      ? tr('consequenceOwn')
      : tr('consequenceOfficial')

  // What the button does, said as the change itself; "Confirm it" needs no
  // "not confirmed yet" after it.
  const verbs: Partial<Record<FactType, string>> = {
    'deadline.update': tr(payload.due_at ? 'vMove' : payload.confirmed ? 'vConfirm' : 'vUpdate'),
    'deadline.create': tr(creates > 1 ? 'vAddThem' : 'vAddIt'),
    'deadline.cancel': tr('vCancelled'),
    'session.cancel': tr('vCancelled'),
    'session.move': tr('vMoveClass'),
    'slot.create': tr('vAddClass'),
  }
  const verb = (fact && verbs[fact.type]) ?? tr('vSave')
  const confirming = fact?.type === 'deadline.update' && !payload.due_at && Boolean(payload.confirmed)
  const applyLabel = fact?.type === 'note'
    ? tr('vKeep')
    : tentative && !confirming ? tr('notConfirmedYet', { verb }) : verb

  return {
    subject,
    subjectLine,
    headline,
    before,
    after,
    quote,
    quoteBy: header,
    source,
    sourceIn,
    consequence,
    applyLabel,
    canApply: Boolean(fact) && (fact!.type === 'note' || !!subject),
  }
}

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
  /** One sentence on what applying does, at this confidence. */
  consequence: string
  applyLabel: string
  canApply: boolean
}

function when(iso: unknown): string | null {
  if (typeof iso !== 'string' || !iso) return null
  return `${dayLabel(dayKey(iso))} ${clock(iso)}`
}

const SOURCES: Record<Signal['channel'], string> = {
  share: 'a shared message',
  telegram: 'a forwarded Telegram message',
  email: 'an email',
  transcript: 'the lecture recording',
  moodle: 'Moodle',
  ics: 'your timetable link',
  photo: 'a photo',
  pdf: 'a PDF',
  manual: 'something you pasted',
}

export function describeSignal(signal: Signal, store: CompanionStore): SignalView {
  const fact: SignalFact | undefined = signal.facts[0]
  const subject =
    store.get('subjects', signal.subject_id) ?? store.get('subjects', fact?.subject_guess.id ?? null)
  const deadline: Deadline | null = fact?.target_id ? store.get('deadlines', fact.target_id) : null
  const session: Session | null = fact?.target_id ? store.get('sessions', fact.target_id) : null
  const payload = (fact?.payload ?? {}) as Record<string, unknown>

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

  let headline = 'Keep this?'
  let before: string | null = null
  let after: string | null = null
  let subjectLine = subject?.title ?? fact?.subject_guess.title ?? 'Not sure which course'

  switch (fact?.type) {
    case 'deadline.update': {
      const title = deadline?.title ?? String(payload.title ?? 'Deadline')
      subjectLine = `${subject?.title ?? ''}${subject ? ' · ' : ''}${title}`
      if (payload.due_at) {
        headline = 'Move the deadline?'
        before = when(deadline?.due_at) ?? 'no date yet'
        after = when(payload.due_at)
      } else if (payload.confirmed) {
        headline = `Confirm ${title}?`
      } else headline = `Update ${title}?`
      break
    }
    case 'deadline.create': {
      const title = String(payload.title ?? 'a deadline')
      if (subject) subjectLine = `${subject.title} · ${deadline?.title ?? title}`
      headline = `Add ${title}${subject ? ` to ${subject.title}` : ''}?`
      after = when(payload.due_at) ?? 'date to be confirmed'
      break
    }
    case 'deadline.cancel': {
      headline = `Is ${deadline?.title ?? 'it'} cancelled?`
      before = when(deadline?.due_at)
      after = 'Cancelled'
      break
    }
    case 'session.cancel': {
      headline = `Is ${session?.title ?? 'the class'} cancelled?`
      before = session ? `${relativeDay(dayKey(session.starts_at))} ${clock(session.starts_at)}` : null
      after = 'No class'
      break
    }
    case 'session.move': {
      headline = `Move ${session?.title ?? 'the class'}?`
      before = when(session?.starts_at)
      after = when(payload.starts_at)
      break
    }
    case 'slot.create': {
      const weekday = Number(payload.weekday ?? 1)
      headline = 'Add a weekly class?'
      after = `${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][weekday - 1]} ${payload.starts_at ?? ''}–${payload.ends_at ?? ''}${payload.location ? ` · ${payload.location}` : ''}`
      break
    }
    case 'note':
      headline = 'Nothing to change, but worth keeping?'
      break
  }

  let source = `From ${SOURCES[signal.channel]}`
  if (signal.channel === 'transcript' && signal.at_seconds != null) {
    source = `Said in the lecture recording at ${timecode(signal.at_seconds)}`
  }

  const tentative = signal.confidence === 'heard' || signal.confidence === 'shared'
  const consequence = tentative
    ? 'It goes on your calendar marked "not confirmed" until Moodle or Teams says the same. If they say something else, we\'ll tell you.'
    : signal.confidence === 'own'
      ? 'It goes in as yours, and you can change it any time.'
      : 'It comes from an official source, so it goes straight in.'

  // What the button does, said as the change itself; "Confirm it" needs no
  // "not confirmed yet" after it.
  const verbs: Partial<Record<FactType, string>> = {
    'deadline.update': payload.due_at ? 'Move it' : payload.confirmed ? 'Confirm it' : 'Update it',
    'deadline.create': 'Add it',
    'deadline.cancel': 'Mark it cancelled',
    'session.cancel': 'Mark it cancelled',
    'session.move': 'Move the class',
    'slot.create': 'Add the class',
  }
  const verb = (fact && verbs[fact.type]) ?? 'Save it'
  const applyLabel = fact?.type === 'note'
    ? 'Keep it'
    : tentative && verb !== 'Confirm it' ? `${verb} (not confirmed yet)` : verb

  return {
    subject,
    subjectLine,
    headline,
    before,
    after,
    quote,
    quoteBy: header,
    source,
    consequence,
    applyLabel,
    canApply: Boolean(fact) && (fact!.type === 'note' || !!subject),
  }
}

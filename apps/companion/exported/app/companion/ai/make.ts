/**
 * "Choose what to make": the chat's starting points, as tiles under the
 * box on a new chat (and a row of small ones in the dock). Claude Design's
 * home, in BiliMind's words: one box for anything, and under it the things
 * a learner most often makes, the first few predicted from their own week.
 *
 *   Just ask · Revise for Databases midterm · Flashcards · Normal forms ·
 *   Course · Check my attempt · Lecture notes · Flashcards · Quiz ·
 *   Mind map · Study plan · Summary · Exam revision
 *
 * A tile writes words: picking one puts its request in the box ("Create a
 * quiz on ", ready to finish; a personal tile's whole sentence), and the
 * learner sends it as typed. The bubble then says exactly what was asked,
 * and the server's model and the demo both already know what "Create
 * flashcards on…" means. "Create a course on…" and "Create a revision
 * course…" go with `intent: 'course'` (COURSE_WORDS), so they draft a course
 * whatever follows.
 *
 * "Check my attempt" is the one tile that is also a mode:
 * the answer has to know the message is the learner's own working, so it
 * comes back as feedback on it and never as a rewrite. Its words go in the
 * box like any tile's, and the chip "Checking your attempt" says so too;
 * words alone ("Check my attempt: …", typed or sent from Today) still go
 * with `intent: 'attempt'` (ATTEMPT_WORDS), the way COURSE_WORDS does.
 */
import type { CompanionStore } from '../store'
import { courseColor } from '../colors'
import { dayKey, shortDate, weekdayShort } from '../time'
import { lastClass, nextDeadline, nextExam, prepFor, weakestTopic } from './suggest'

export type MakeThumb = 'blank' | 'course' | 'attempt' | 'notes' | 'cards' | 'quiz' | 'map' | 'plan' | 'summary' | 'exam'

/** The composer's modes: what the next message is, whatever its words. */
export type AiMode = 'course' | 'attempt'

export interface MakeTile {
  key: string
  label: string
  /** A personal tile's course (and date): its second line. */
  sub?: string | null
  thumb: MakeThumb
  /** A personal tile's course colour, as a CSS colour. */
  color?: string | null
  /** What the box says in this tile's mode (the course and attempt modes have one). */
  placeholder?: string
  intent?: AiMode | null
  /** The words picking it writes: a kind's lead ("Create a quiz on ") or a personal tile's whole request. */
  prompt?: string | null
  predicted?: boolean
}

/**
 * A course colour washed into the surface, for a thumbnail behind ink: mixed
 * with the surface token rather than white, so it stays a wash in dark mode.
 */
export function wash(color: string | null | undefined, amount = 16): string {
  return `color-mix(in srgb, ${color ?? 'var(--c-c8)'} ${amount}%, var(--surface))`
}

export const ASK_PLACEHOLDER = 'Ask anything, attach your files, or say what you want to learn'

export const JUST_ASK: MakeTile = { key: 'ask', label: 'Just ask', thumb: 'blank', placeholder: ASK_PLACEHOLDER }

export const COURSE_TILE: MakeTile = {
  key: 'course',
  label: 'Course',
  thumb: 'course',
  intent: 'course',
  placeholder: 'What do you want to learn? Add anything you have…',
}

/** "Check my attempt": from the tiles, or from an answer that asked for the learner's attempt first. */
export const ATTEMPT_TILE: MakeTile = {
  key: 'attempt',
  label: 'Check my attempt',
  thumb: 'attempt',
  intent: 'attempt',
  placeholder: 'Paste your working, or add a photo of it',
}

const GENERIC: MakeTile[] = [
  { ...COURSE_TILE, prompt: 'Create a course on ' },
  { ...ATTEMPT_TILE, prompt: 'Check my attempt: ' },
  { key: 'notes', label: 'Lecture notes', thumb: 'notes', prompt: 'Create lecture notes on ' },
  { key: 'cards', label: 'Flashcards', thumb: 'cards', prompt: 'Create flashcards on ' },
  { key: 'quiz', label: 'Quiz', thumb: 'quiz', prompt: 'Create a quiz on ' },
  { key: 'draw', label: 'Drawing', thumb: 'map', prompt: 'Draw me ' },
  { key: 'map', label: 'Mind map', thumb: 'map', prompt: 'Create a mind map of ' },
  { key: 'plan', label: 'Study plan', thumb: 'plan', prompt: 'Create a study plan for ' },
  { key: 'summary', label: 'Summary', thumb: 'summary', prompt: 'Create a summary of ' },
  { key: 'exam', label: 'Exam revision', thumb: 'exam', prompt: 'Create a revision course for my exam on ' },
]

/** A message that asks for a course in a tile's words: it goes with `intent: 'course'`. */
export const COURSE_WORDS = /^create an? (revision )?course\b/i

/** A message in the attempt tile's words: it goes with `intent: 'attempt'`. */
export const ATTEMPT_WORDS = /^check my attempt\b/i

/** A kind's lead at the start of the box, so picking another kind swaps it rather than stacking. */
const LEAD = new RegExp(`^(${GENERIC.map((t) => t.prompt!.trim()).join('|')})\\s*`, 'i')

/**
 * The box after picking `tile`: a kind's lead goes in front of what the
 * learner typed (another kind's lead swapped out), a personal tile's
 * request replaces it, and "Just ask" leaves only their own words.
 */
export function withWords(tile: MakeTile, text: string): string {
  const rest = text.replace(LEAD, '')
  if (tile.predicted) return tile.prompt ?? rest
  return `${tile.prompt ?? ''}${rest}`
}

function when(iso: string | null): string {
  if (!iso) return ''
  const key = dayKey(iso)
  return `${weekdayShort(key)} ${shortDate(key)}`
}

/**
 * The few tiles only this learner gets, read off their week: the exam
 * coming up as a revision course, flashcards on the topic they hold least
 * well, a quiz for the next deadline, a recap of the class just gone. Up
 * to `max`, in that order of weight.
 */
export function personalTiles(store: CompanionStore, max = 3, now = Date.now()): MakeTile[] {
  const out: MakeTile[] = []
  const course = (id: string) => store.get('subjects', id)

  const exam = nextExam(store, now)
  if (exam) {
    out.push({
      key: `p-exam-${exam.deadline.id}`,
      label: `Revise for ${exam.subject.title} ${exam.word}`,
      sub: `${exam.subject.title} · ${when(exam.deadline.due_at)}`,
      thumb: 'exam',
      color: courseColor(exam.subject.color),
      prompt: exam.sentence.replace(/^Revise for/, 'Create a revision course for'),
      predicted: true,
    })
  }

  const next = nextDeadline(store, null, now)
  const focus = next ? course(next.subject_id) : null
  const weak = focus ? weakestTopic(store, focus.id, now) : null
  if (weak && focus) {
    out.push({
      key: `p-cards-${weak.id}`,
      label: `Flashcards · ${weak.title}`,
      sub: focus.title,
      thumb: 'cards',
      color: courseColor(focus.color),
      prompt: `Make flashcards on ${weak.title} (${focus.title})`,
      predicted: true,
    })
  }

  if (next && focus && (!exam || exam.deadline.id !== next.id)) {
    out.push({
      key: `p-quiz-${next.id}`,
      label: `Get ready for ${next.title}`,
      sub: `${focus.title} · ${when(next.due_at)}`,
      thumb: 'quiz',
      color: courseColor(focus.color),
      prompt: prepFor(next, focus.title).prompt,
      predicted: true,
    })
  }

  const last = lastClass(store, null, now)
  const lastCourse = last ? course(last.subject_id) : null
  if (last && lastCourse && now - Date.parse(last.ends_at) < 48 * 3_600_000) {
    const topic = last.topic_id ? store.get('topics', last.topic_id) : null
    out.push({
      key: `p-recap-${last.id}`,
      label: `Notes from ${last.title}`,
      sub: topic ? `${lastCourse.title} · ${topic.title}` : lastCourse.title,
      thumb: 'notes',
      color: courseColor(lastCourse.color),
      prompt: `Summarise ${last.title} of ${lastCourse.title} as lecture notes.`,
      predicted: true,
    })
  }

  return out.slice(0, max)
}

/** Every tile, in the tray's order: Just ask, the personal ones, then the kinds. */
export function makeTiles(store: CompanionStore | null, personal = 3, now = Date.now()): MakeTile[] {
  const mine = store?.status.ready ? personalTiles(store, personal, now) : []
  return [JUST_ASK, ...mine, ...GENERIC]
}

// How names of courses and deadlines compare: "lab4" and "Lab 4" are one name, "Programming 1" is not Programming 2.
import type { Row } from '../store.ts'

const NUMBERS: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12', thirteen: '13', fourteen: '14', fifteen: '15', sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19', twenty: '20', first: '1', second: '2', third: '3', fourth: '4', fifth: '5', sixth: '6', seventh: '7', eighth: '8', ninth: '9', tenth: '10' }
const STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'to', 'for', 'in', 'on', 'my', 'our', 'is', 'introduction', 'intro'])
const AROUND = ['course', 'class', 'classes', 'module', 'lecture', 'lectures', 'lesson', 'lessons', 'seminar', 'tutorial', 'subject', 'group', 'chat', 'prof', 'professor']
const NOT_CODES = new Set(['WEEK', 'ROOM', 'HALL', 'LAB', 'UNIT', 'PART', 'PAGE', 'TERM', 'YEAR', 'LEVEL', 'GROUP', 'BLOCK', 'GATE', 'FLOOR'])

export function normalise(text: string): string {
  const flat = text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2')
  return flat.trim().split(/\s+/).filter(Boolean).map((w) => NUMBERS[w] ?? w).join(' ')
}

export const tokens = (text: string) => [...new Set(normalise(text).split(' ').filter((w) => w && !/^\d+$/.test(w) && !STOPWORDS.has(w)))]
export const numbers = (text: string) => normalise(text).split(' ').filter((w) => /^\d+$/.test(w)).map((w) => w.replace(/^0+(?=\d)/, ''))
export const code = (value: string) => value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()

export function codesIn(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/(?<![A-Za-z0-9])([A-Z]{2,5})[ -]?(\d{2,4}[A-Z]?)(?![A-Za-z0-9])/g)) if (!NOT_CODES.has(m[1]!)) out.push(code(m[1]! + m[2]!))
  return [...new Set(out)]
}

function sameWord(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length >= 3 && b.length >= 3 && a.replace(/s+$/, '') === b.replace(/s+$/, '')) return true
  const shorter = Math.min(a.length, b.length)
  if (shorter < 5) return false
  let common = 0
  while (common < shorter && a[common] === b[common]) common++
  return common >= 4 && common / shorter >= 0.75
}

const covers = (long: string[], short: string[]) => short.length > 0 && short.every((w) => long.some((c) => sameWord(w, c)))

/** Levenshtein as a share of the longer: close enough to catch a typo, not a different course. */
function similar(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let last = row[0]!
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const was = row[j]!
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1))
      last = was
    }
  }
  return 100 * (1 - row[b.length]! / Math.max(a.length, b.length, 1))
}

export function courseScore(name: string, subject: Row): number {
  const a = normalise(name)
  const b = normalise(subject.title)
  if (!a || !b) return 0
  if (a === b) return 1
  if (subject.code && code(name) === code(subject.code)) return 0.9
  const nums = numbers(name)
  if (nums.length && nums.join() !== numbers(subject.title).join()) return 0
  const nameTokens = tokens(name).filter((t) => !AROUND.includes(t))
  if (nameTokens.length && tokens(subject.title).length && covers(tokens(subject.title), nameTokens)) return 0.85
  return similar(a, b) >= 88 ? 0.75 : 0
}

export function matchCourse(codeIn: string | null, title: string | null, subjects: Row[]): Row | null {
  const wanted = codeIn ? code(codeIn) : ''
  if (wanted) {
    const byCode = subjects.filter((s) => s.code && code(s.code) === wanted)
    if (byCode.length === 1) return byCode[0]!
  }
  if (!title?.trim()) return null
  if (/^\s*[A-Za-z]{2,5}[ -]?\d{2,4}[A-Za-z]?\s*$/.test(title)) return matchCourse(title, null, subjects)
  let best: Row | null = null
  let bestScore = 0
  let tied = false
  for (const subject of subjects) {
    const score = courseScore(title, subject)
    if (score > bestScore + 1e-9) { best = subject; bestScore = score; tied = false }
    else if (score >= 0.7 && Math.abs(score - bestScore) <= 1e-9) tied = true
  }
  return bestScore >= 0.7 && !tied ? best : null
}

function one(candidates: Row[], now: number): Row | null {
  if (candidates.length === 1) return candidates[0]!
  const upcoming = candidates.filter((d) => d.status === 'upcoming' && (!d.due_at || Date.parse(d.due_at) >= now - 86_400_000))
  return upcoming.length === 1 ? upcoming[0]! : null
}

function loosely(a: string, b: string): boolean {
  if (numbers(a).join() !== numbers(b).join()) return false
  const ta = tokens(a)
  const tb = tokens(b)
  if (!ta.length || !tb.length) return false
  return ta.length <= tb.length ? covers(tb, ta) : covers(ta, tb)
}

const GENERIC = /^\s*(the\s+)?(mid[\s-]?term|final|exam|examination)(\s+(exam|examination|test))?\s*$/i

export function matchDeadline(deadlines: Row[], subjectId: string | null, kindIn: string | null, title: string | null, now: number): Row | null {
  const pool = deadlines.filter((d) => d.status !== 'cancelled' && (subjectId === null || d.subject_id === subjectId))
  if (!pool.length) return null
  const name = title?.trim() ?? ''
  if (name) {
    let same = pool.filter((d) => normalise(d.title) === normalise(name))
    if (same.length > 1 && kindIn !== null) same = same.filter((d) => d.kind === kindIn)
    const found = same.length ? one(same, now) : null
    if (found) return found
    if (same.length) return null
    if (!GENERIC.test(name)) return one(pool.filter((d) => loosely(name, d.title) && (kindIn === null || kindIn === 'other' || d.kind === kindIn)), now)
  }
  const kind = kindIn ?? (name ? deadlineKind(name, null) : null)
  return subjectId !== null && (kind === 'midterm' || kind === 'final') ? one(pool.filter((d) => d.kind === kind), now) : null
}

const DEADLINE_RULES: [RegExp, string][] = [
  [/\b(mid[\s-]?term|mid[\s-]?semester|midsem)\b/i, 'midterm'],
  [/\bfinal\s+(exam|examination|test|assessment)\b|\b(exam|examination)\s*[:\-·–]?\s*final\b/i, 'final'],
  [/\b(exam|examination|exams|resit|viva|oral)\b/i, 'exam'],
  [/\b(quiz|quizzes|test|kahoot)\b/i, 'quiz'],
  [/\b(presentation|demo|pitch|poster)\b/i, 'presentation'],
  [/\b(project|capstone|prototype)\b/i, 'project'],
  [/\bmilestone\b/i, 'milestone'],
  [/\b(lab|labs|practical|lab\s+work)\b/i, 'lab'],
  [/\b(essay|report|assignment|homework|coursework|problem\s+set|worksheet|submission|paper|portfolio|reflection)\b/i, 'assignment'],
  [/\bfinal\b/i, 'final'],
]
const DEADLINE_WORDS = /\b(due|deadline|submit|submission|hand[\s-]?in|assignment|coursework|homework|quiz|test|exam|examination|mid[\s-]?term|final\s+(exam|examination|test)|essay|report|problem\s+set|project|presentation|milestone|opens|closes)\b/i

export function deadlineKind(title: string, fallback: string | null = 'other'): string | null {
  return DEADLINE_RULES.find(([re]) => re.test(title))?.[1] ?? fallback
}
export const looksLikeDeadline = (text: string) => DEADLINE_WORDS.test(text)

const CLASS_RULES: [RegExp, string][] = [
  [/\b(tutorial|tut|recitation|exercise\s+class|problem\s+class)\b/i, 'tutorial'],
  [/\b(lab|labs|laboratory|practical|practicum|workshop)\b/i, 'lab'],
  [/\b(seminar|discussion|colloquium)\b/i, 'seminar'],
  [/\b(lesson|class\s+with|tutor|private)\b/i, 'lesson'],
  [/\b(study|revision|self[\s-]?study|study\s+group)\b/i, 'study'],
]
export const sessionKind = (title: string) => CLASS_RULES.find(([re]) => re.test(title))?.[1] ?? 'lecture'

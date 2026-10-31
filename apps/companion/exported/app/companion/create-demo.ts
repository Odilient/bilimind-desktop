/**
 * The demo's stand-in for the model behind `POST /companion/courses/propose`.
 *
 * The sample account has no server, yet "Build my course" has to come back
 * with something a visitor believes: the course named the way they would
 * name it, the right kind (a class at school, or something on their own),
 * a finish date read out of "by June" or "on 14 December", a path that is
 * about the subject, and the deadlines their material implies. So: a small
 * reading of the sentence and the file names, and a few hand-written paths
 * for the subjects people try first (a language, IELTS, databases, backend,
 * frontend, programming), with a general one for anything else.
 *
 * Nothing here pretends to have read a PDF: deadlines come from pasted
 * text that has dates in it, or from a file that is plainly a syllabus.
 */
import type { Attachment, CourseProposal, ProposalDeadline, ProposalUnit } from './create'
import { dueIso, freeColor } from './create'
import { daysBetween, shiftDay } from './time'

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)'
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const COUNT: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
}

function monthOf(word: string): number {
  return MONTHS.indexOf(word.toLowerCase().slice(0, 3))
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/** A day and month with no year: this year's, unless that has passed. */
function nextOccurrence(today: string, month: number, day: number, year?: number): string {
  let y = year ?? +today.slice(0, 4)
  const key = (yy: number) => `${yy}-${pad(month + 1)}-${pad(Math.min(day, lastDay(yy, month)))}`
  if (!year && key(y) <= today) y += 1
  return key(y)
}

/**
 * The first date a sentence names, and the words that named it (so the
 * course's name can drop them): "on 14 December", "by June", "December 14",
 * "by the end of March 2027", "in 3 months", "2026-12-14".
 */
export function parseWhen(text: string, today: string): { date: string | null; phrase: string | null } {
  const iso = text.match(/\b(?:on|by|before|until)?\s*(20\d\d)-(\d\d)-(\d\d)\b/i)
  if (iso) return { date: `${iso[1]}-${iso[2]}-${iso[3]}`, phrase: iso[0] }

  const dm = text.match(new RegExp(`\\b(?:on|by|before|until)?\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON}\\.?(?:,?\\s+(20\\d\\d))?\\b`, 'i'))
  if (dm && +dm[1]! >= 1 && +dm[1]! <= 31) {
    return { date: nextOccurrence(today, monthOf(dm[2]!), +dm[1]!, dm[3] ? +dm[3] : undefined), phrase: dm[0] }
  }

  const md = text.match(new RegExp(`\\b(?:on|by|before|until)?\\s*${MON}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d\\d))?\\b`, 'i'))
  if (md && +md[2]! >= 1 && +md[2]! <= 31) {
    return { date: nextOccurrence(today, monthOf(md[1]!), +md[2]!, md[3] ? +md[3] : undefined), phrase: md[0] }
  }

  const m = text.match(new RegExp(`\\b(by|in|before|until|for)\\s+(?:the\\s+)?(end\\s+of\\s+)?${MON}(?:\\s+(20\\d\\d))?\\b`, 'i'))
  if (m) {
    const month = monthOf(m[3]!)
    const date = nextOccurrence(today, month, 1, m[4] ? +m[4] : undefined)
    const end = m[2] ? `${date.slice(0, 8)}${pad(lastDay(+date.slice(0, 4), month))}` : date
    return { date: end, phrase: m[0] }
  }

  const rel = text.match(/\bin\s+(\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(day|week|month|year)s?\b/i)
  if (rel) {
    const n = /^\d+$/.test(rel[1]!) ? +rel[1]! : (COUNT[rel[1]!.toLowerCase()] ?? 1)
    const days = { day: 1, week: 7, month: 30, year: 365 }[rel[2]!.toLowerCase() as 'day'] * n
    return { date: shiftDay(today, days), phrase: rel[0] }
  }

  if (/\bnext month\b/i.test(text)) return { date: shiftDay(today, 30), phrase: 'next month' }
  if (/\b(by|before)?\s*(the\s+)?end of (the|this) year\b/i.test(text)) {
    return { date: `${today.slice(0, 4)}-12-31`, phrase: text.match(/\b(by|before)?\s*(the\s+)?end of (the|this) year\b/i)![0] }
  }
  if (/\b(by|before)?\s*(this\s+|the\s+)?summer\b/i.test(text)) {
    return { date: nextOccurrence(today, 5, 30), phrase: text.match(/\b(by|before)?\s*(this\s+|the\s+)?summer\b/i)![0] }
  }
  return { date: null, phrase: null }
}

/* -------------------------------------------------------------------------- */
/* Reading the sentence                                                       */
/* -------------------------------------------------------------------------- */

const LANGUAGES = [
  'Italian', 'Spanish', 'French', 'German', 'English', 'Portuguese', 'Japanese', 'Korean', 'Chinese',
  'Mandarin', 'Arabic', 'Turkish', 'Russian', 'Uzbek', 'Dutch', 'Polish', 'Greek', 'Hindi', 'Swedish',
]

function capitalise(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s
}

/** "Databases, 2nd-year CS with Prof. Karimov" → "Databases". */
function headOf(text: string, drop: string | null): string {
  let s = text.split('\n')[0] ?? ''
  if (drop) s = s.replace(drop, ' ')
  s = s
    .replace(/^\s*(i\s+(want|need|have|'d like|would like)\s+to\s+|i'm\s+|help me\s+|teach me\s+)/i, '')
    .replace(/^\s*(learn(ing)?|study(ing)?|get better at|master|understand|revise for|prepare for|pass)\s+/i, '')
    .replace(/\s+(with|taught by)\s+(prof\.?|professor|dr\.?|mr\.?|ms\.?|mrs\.?)\s*\S+.*$/i, '')
    .split(/[,.;:(]|\s[-–—]\s/)[0]!
    .replace(/\s+/g, ' ')
    .trim()
  return capitalise(s).slice(0, 56)
}

const SCHOOL_WORDS = /\b(prof\.?|professor|dr\.|lecturer|lectures?|semester|module|syllabus|university|uni|college|faculty|tutor|seminar|coursework|freshman|sophomore|\d(?:st|nd|rd|th)[- ]year)\b/i
const COURSE_CODE = /\b[A-Z]{2,4}\s?\d{3,4}\b/
const SYLLABUS_FILE = /syllab|outline|handbook|schedule|assessment|course[ _-]?info|module[ _-]?guide/i
const LECTURE_FILE = /\b(lecture|lec|week|wk|chapter|ch|unit|topic|session|class|l)[\s_-]*0*(\d{1,2})\b/i

/** "Lecture 2 - ER diagrams.pdf" → { n: 2, title: "ER diagrams" }. */
function lectureOf(name: string): { n: number; title: string } | null {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, '')
  const m = base.match(LECTURE_FILE)
  if (!m) return null
  const rest = base
    .replace(m[0], ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/^[\s\-–—:.]+|[\s\-–—:.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const word = capitalise(m[1]!.toLowerCase().replace(/^(lec|l)$/, 'lecture').replace(/^wk$/, 'week').replace(/^ch$/, 'chapter'))
  return { n: +m[2]!, title: rest && !/^\d+$/.test(rest) ? capitalise(rest) : `${word} ${+m[2]!}` }
}

/* -------------------------------------------------------------------------- */
/* The paths                                                                  */
/* -------------------------------------------------------------------------- */

interface Reading {
  text: string
  school: boolean
  language: string | null
  level: string | null
  band: string | null
}

interface Template {
  test: (r: Reading) => boolean
  title: (r: Reading, head: string) => string
  summary: (r: Reading, title: string) => string
  units: (r: Reading, title: string) => [string, string[]][]
  finish?: (r: Reading) => { kind: 'exam' | 'project'; label: string }
}

const TEMPLATES: Template[] = [
  {
    test: (r) => /\b(ielts|toefl)\b/i.test(r.text),
    title: (r) => (/toefl/i.test(r.text) ? 'TOEFL' : 'IELTS') + (r.band ? ` ${r.band}` : ''),
    summary: (r) => `Reach ${r.band ? `band ${r.band}` : 'your band'} in all four papers, with two full mock tests behind you.`,
    finish: (r) => ({ kind: 'exam', label: /toefl/i.test(r.text) ? 'TOEFL exam' : 'IELTS exam' }),
    units: () => [
      ['Know the test', ['How the bands are scored', 'Timing and strategy']],
      ['Listening', ['Form and note completion', 'Maps and plans', 'Multiple choice at speed']],
      ['Reading', ['Skimming and scanning', 'True, false, not given', 'Matching headings']],
      ['Writing', ['Task 1: describing a chart', 'Task 1: processes and maps', 'Task 2: opinion essays', 'Task 2: discussion essays', 'Linking ideas and range']],
      ['Speaking', ['Part 1: everyday questions', 'Part 2: the long turn', 'Part 3: discussion', 'Fluency and pronunciation']],
      ['Mock tests', ['Full mock test 1', 'Full mock test 2', 'The last week']],
    ],
  },
  {
    test: (r) => Boolean(r.language),
    title: (r) => `${r.language}${r.level ? ` ${r.level}` : ''}`,
    summary: (r) =>
      `Hold everyday conversations in ${r.language}, follow real speech, and write a clear email${r.level ? `: everything the ${r.level} exam asks for` : ''}.`,
    finish: (r) => (r.level ? { kind: 'exam', label: `${r.level} exam` } : { kind: 'project', label: 'A real conversation' }),
    units: (r) => [
      ['First conversations', ['Greetings and introductions', 'Numbers, dates and time', 'The present tense', 'Asking questions', 'Ordering food and drinks']],
      ['Everyday life', ['Your daily routine', 'Reflexive verbs', 'Describing people and places', 'Shopping and prices', 'Getting around']],
      ['Telling stories', ['The past tense', 'Irregular past forms', 'Time expressions', 'Telling what happened']],
      ['Plans and opinions', ['The future', 'The conditional', 'Giving an opinion', 'Agreeing and disagreeing', 'Making plans']],
      ...(r.level
        ? ([[`${r.level} exam skills`, ['Reading longer texts', 'Listening to real speech', 'A formal email', 'Speaking for two minutes', 'Mock exam']]] as [string, string[]][])
        : []),
    ],
  },
  {
    test: (r) => /\b(databases?|sql|postgres|mysql|dbms)\b/i.test(r.text),
    title: (_r, head) => (/^databases?$/i.test(head) || !head ? 'Databases' : head),
    summary: () => 'Design a database, query it in SQL and explain what happens inside the engine, ready for the exam.',
    units: () => [
      ['The relational model', ['Relations, keys and schemas', 'Relational algebra']],
      ['SQL', ['SELECT and filtering', 'Joins', 'Aggregation and GROUP BY', 'Subqueries and views']],
      ['Design', ['ER diagrams', 'Functional dependencies', 'Normal forms, 1NF to BCNF']],
      ['Inside the engine', ['Indexes and B-trees', 'Query processing', 'Transactions and ACID', 'Concurrency control']],
      ['Exam review', ['Past papers', 'The topics that come up most']],
    ],
  },
  {
    test: (r) => /\b(back-?end|server-side|apis?\b|node\.?js|django|laravel|spring)\b/i.test(r.text),
    title: (_r, head) => (/developer|engineer/i.test(head) ? head.replace(/^(become|be|get hired as)\s+(an?\s+)?/i, '').replace(/^./, (c) => c.toUpperCase()) : 'Backend development'),
    summary: () => 'Build, test and deploy a real API, with a portfolio project to show for it.',
    finish: () => ({ kind: 'project', label: 'A deployed portfolio API' }),
    units: () => [
      ['Foundations', ['How the web works: HTTP', 'The command line and Git', 'One language, properly']],
      ['Data', ['SQL basics', 'Joins and indexes', 'Modelling your data', 'Using an ORM']],
      ['APIs', ['Designing a REST API', 'Authentication and sessions', 'Validation and errors', 'Background jobs']],
      ['Shipping', ['Testing', 'Docker', 'Deploying to a server', 'Logs and monitoring']],
      ['Portfolio', ['Build a real API', 'Write it up', 'Interview practice']],
    ],
  },
  {
    test: (r) => /\b(front-?end|web dev(elopment)?|react|vue|javascript|typescript|html|css)\b/i.test(r.text),
    title: (_r, head) => (/developer|engineer/i.test(head) ? head.replace(/^(become|be)\s+(an?\s+)?/i, '').replace(/^./, (c) => c.toUpperCase()) : 'Frontend development'),
    summary: () => 'Build and ship fast, accessible web apps with a modern framework.',
    finish: () => ({ kind: 'project', label: 'A shipped web app' }),
    units: () => [
      ['The web page', ['HTML that means something', 'CSS layout: flexbox and grid', 'Responsive design']],
      ['JavaScript', ['Values, functions and objects', 'The DOM and events', 'Async code and fetch']],
      ['A framework', ['Components and props', 'State', 'Routing', 'Forms']],
      ['Shipping', ['Accessibility', 'Performance', 'Testing', 'Deploying']],
      ['Portfolio', ['Build a project', 'Polish and share it']],
    ],
  },
  {
    test: (r) => /\b(python|programming|coding|java|c\+\+|c#|rust|golang|kotlin|swift)\b/i.test(r.text),
    title: (r, head) => {
      const lang = r.text.match(/\b(python|java|c\+\+|c#|rust|golang|kotlin|swift)\b/i)?.[1]
      return lang ? capitalise(lang.toLowerCase()).replace('Golang', 'Go') : head || 'Programming'
    },
    summary: (_r, title) => `Write real programs in ${title} and finish a small project of your own.`,
    finish: () => ({ kind: 'project', label: 'A finished project' }),
    units: () => [
      ['First programs', ['Variables and types', 'Conditions', 'Loops', 'Functions']],
      ['Working with data', ['Lists and dictionaries', 'Strings', 'Files', 'Errors and exceptions']],
      ['Structure', ['Modules and packages', 'Classes and objects', 'Testing your code']],
      ['Real tasks', ['Talking to an API', 'Working with data tables', 'Automating a chore']],
      ['Project', ['Plan it', 'Build it', 'Polish and share it']],
    ],
  },
]

const GENERAL: Template = {
  test: () => true,
  title: (_r, head) => head || 'New course',
  summary: (r, title) =>
    r.school
      ? `Everything ${title} covers, week by week, with its deadlines in one place.`
      : `Understand ${title} well enough to explain it, use it and be tested on it.`,
  units: (r, title) => [
    ['Getting oriented', [`What ${title} is about`, 'The key words', 'A first worked example']],
    ['The core', ['The main ideas, one by one', 'Practising the basics', 'Where people get stuck']],
    ['Going deeper', ['The harder cases', 'Connecting the ideas', 'Using it on a real problem']],
    ['Making it stick', ['Review and spaced practice', r.school ? 'Past papers' : 'A self-test', r.school ? 'Exam review' : 'Show what you can do']],
  ],
}

/* -------------------------------------------------------------------------- */
/* Deadlines in pasted text                                                   */
/* -------------------------------------------------------------------------- */

const DEADLINE_WORDS: [RegExp, string][] = [
  [/\bmid-?term\b/i, 'midterm'],
  [/\bfinal\b/i, 'final'],
  [/\bexam\b/i, 'exam'],
  [/\bquiz\b/i, 'quiz'],
  [/\blab\b/i, 'lab'],
  [/\bpresentation\b/i, 'presentation'],
  [/\bproject\b/i, 'project'],
  [/\b(assignment|coursework|homework|essay|report|submission|due|deadline)\b/i, 'assignment'],
]

/** Lines like "Coursework 1 due 14 November (20%)" turned into deadlines. */
function deadlinesInText(text: string, today: string): ProposalDeadline[] {
  const out: ProposalDeadline[] = []
  for (const raw of text.split(/\n|;/)) {
    const line = raw.trim()
    if (line.length < 6 || line.length > 200) continue
    const kind = DEADLINE_WORDS.find(([re]) => re.test(line))?.[1]
    if (!kind) continue
    const when = parseWhen(line, today)
    if (!when.date || !when.phrase) continue
    const weight = line.match(/(\d{1,3})\s?%/)?.[1]
    const title = line
      .replace(when.phrase, ' ')
      .replace(/\(?\d{1,3}\s?%\)?/, ' ')
      .replace(/\b(is\s+)?(due|deadline)(\s+(on|by))?\b:?/gi, ' ')
      .replace(/^[\s\-–—•*:.]+|[\s\-–—•*:,.]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!title) continue
    out.push({ title: capitalise(title).slice(0, 64), kind, due_at: dueIso(when.date, kind === 'exam' || kind === 'final' || kind === 'midterm' ? '09:00' : '23:59'), weight_pct: weight ? +weight : null })
  }
  return out
}

/* -------------------------------------------------------------------------- */
/* The proposal                                                               */
/* -------------------------------------------------------------------------- */

export function demoProposal(input: {
  text: string
  attachments: Attachment[]
  colors: (string | null | undefined)[]
  today: string
  /** The term's end (its exam period, or its last day), for a school course's final. */
  termEnd: string | null
}): CourseProposal {
  const { attachments, today } = input
  const files = attachments.filter((a) => a.kind === 'file' && !a.refused) as Extract<Attachment, { kind: 'file' }>[]
  const texts = attachments.filter((a) => a.kind === 'text') as Extract<Attachment, { kind: 'text' }>[]
  const moodle = attachments.filter((a) => a.kind === 'moodle') as Extract<Attachment, { kind: 'moodle' }>[]
  const everything = [input.text, ...files.map((f) => f.name), ...texts.map((t) => t.text.slice(0, 2000)), ...moodle.map((m) => m.title)].join('\n')

  const when = parseWhen(input.text, today)
  const lectures = files.map((f) => lectureOf(f.name)).filter((x): x is { n: number; title: string } => Boolean(x)).sort((a, b) => a.n - b.n)
  const syllabus = files.some((f) => SYLLABUS_FILE.test(f.name)) || texts.some((t) => SYLLABUS_FILE.test(t.title))
  const school =
    SCHOOL_WORDS.test(input.text) ||
    COURSE_CODE.test(input.text) ||
    syllabus ||
    lectures.length >= 2 ||
    attachments.some((a) => a.kind === 'moodle' || a.kind === 'calendar' || (a.kind === 'link' && a.moodle))

  const language = LANGUAGES.find((l) => new RegExp(`\\b${l}\\b`, 'i').test(everything)) ?? null
  const reading: Reading = {
    text: everything,
    school,
    language,
    level: everything.match(/\b([ABC][12])\b/i)?.[1]?.toUpperCase() ?? null,
    band: everything.match(/\b(?:ielts|toefl|band)\s*(?:band\s*)?(\d(?:\.[05])?)\b/i)?.[1] ?? null,
  }
  const template = TEMPLATES.find((t) => t.test(reading)) ?? GENERAL
  // A pasted "Databases syllabus" names the course Databases: the document's kind isn't its subject.
  const named = (t: string) => t.replace(/\s*[-–—:]?\s*(course\s+)?(syllabus|outline|handbook|schedule|notes|module guide|course info(rmation)?)\s*$/i, '').trim()
  const head =
    headOf(input.text, when.phrase) ||
    moodle[0]?.title ||
    (texts[0] && texts[0].title !== 'Pasted text' ? named(texts[0].title) : '') ||
    (files[0] && !lectureOf(files[0].name) ? headOf(files[0].name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' '), null) : '')
  const title = template.title(reading, head)

  // Dated lines in pasted text ("Final exam 15 January (50%)") are deadlines,
  // and a final among them is the finish line.
  const found = texts.flatMap((t) => deadlinesInText(t.text, today))
  const final = found.find((d) => (d.kind === 'final' || d.kind === 'exam') && d.due_at)

  // The finish line: the date the sentence named, else that final, else the
  // term's end for a school course; a goal of your own may have none.
  const date = when.date ?? final?.due_at?.slice(0, 10) ?? (school ? input.termEnd ?? shiftDay(today, 77) : null)
  const finishDefault = school
    ? { kind: 'exam' as const, label: !when.date && final ? final.title : 'Final exam' }
    : (template.finish?.(reading) ?? { kind: 'date' as const, label: 'Finish line' })
  const finish: CourseProposal['finish'] = {
    ...finishDefault,
    date: date ?? (finishDefault.kind === 'exam' ? shiftDay(today, 90) : null),
  }
  // A goal with no date and nothing to finish on has no finish line yet.
  if (!finish.date && finish.kind === 'date') Object.assign(finish, { kind: 'none', label: '' })

  // Time a week: said in the sentence ("30 minutes a day", "3 hours a week"),
  // else more when the finish line is close.
  let minutes: number | null = null
  if (!school) {
    const said = input.text.match(/(\d+(?:\.\d)?)\s*(min(?:ute)?s?|h(?:ours?|rs?)?)\s*(?:a|per|each)\s*(day|week)/i)
    if (said) {
      const n = +said[1]! * (/^h/i.test(said[2]!) ? 60 : 1)
      minutes = Math.round(said[3]!.toLowerCase() === 'day' ? n * 5 : n)
    } else {
      const weeks = finish.date ? daysBetween(today, finish.date) / 7 : 16
      minutes = weeks <= 4 ? 300 : weeks <= 8 ? 210 : 120
    }
  }

  const units: ProposalUnit[] = []
  if (lectures.length) {
    units.push({
      title: school ? 'From your lectures' : 'From your files',
      topics: lectures.map((l) => ({ title: l.title })),
    })
  }
  const seen = new Set(units.flatMap((u) => u.topics.map((t) => t.title.toLowerCase())))
  for (const [unit, topics] of template.units(reading, title)) {
    const fresh = topics.filter((t) => !seen.has(t.toLowerCase()))
    if (fresh.length) units.push({ title: unit, topics: fresh.map((t) => ({ title: t })) })
  }

  // Deadlines: the dated lines first; a syllabus implies the usual assessment
  // set; the finish line is always one.
  const deadlines: ProposalDeadline[] = [...found]
  const before = (d: string) => !finish.date || d <= finish.date
  if (syllabus && school && !deadlines.length) {
    const set: [string, string, number, number][] = [
      ['Coursework 1', 'assignment', 21, 15],
      ['Midterm', 'midterm', 35, 25],
      ['Coursework 2', 'assignment', 56, 15],
    ]
    for (const [t, kind, days, weight] of set) {
      const d = shiftDay(today, days)
      if (before(d)) deadlines.push({ title: t, kind, due_at: dueIso(d, kind === 'midterm' ? '09:00' : '23:59'), weight_pct: weight })
    }
  }
  if (finish.date && !deadlines.some((d) => d.kind === 'final' || d.kind === 'exam' || d.kind === 'project')) {
    if (finish.kind === 'exam' && !school && daysBetween(today, finish.date) > 21) {
      deadlines.push({ title: 'Mock exam', kind: 'quiz', due_at: dueIso(shiftDay(finish.date, -14), '10:00'), weight_pct: null })
    }
    if (finish.kind === 'project' && daysBetween(today, finish.date) > 28) {
      const at = shiftDay(today, Math.round(daysBetween(today, finish.date) * 0.6))
      deadlines.push({ title: 'First working version', kind: 'milestone', due_at: dueIso(at), weight_pct: null })
    }
    if (finish.kind === 'date' && daysBetween(today, finish.date) > 28) {
      const at = shiftDay(today, Math.round(daysBetween(today, finish.date) / 2))
      deadlines.push({ title: 'Halfway check', kind: 'milestone', due_at: dueIso(at), weight_pct: null })
    }
    deadlines.push({
      title: finish.label,
      kind: finish.kind === 'exam' ? (school ? 'final' : 'exam') : finish.kind === 'project' ? 'project' : 'milestone',
      due_at: dueIso(finish.date, finish.kind === 'exam' ? '09:00' : '23:59'),
      weight_pct: school && syllabus ? 45 : null,
    })
  }
  deadlines.sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))

  // Sources: everything sent, except the formats the demo pretends it can't
  // open, so the review's "couldn't read" line has something to show.
  const sources: CourseProposal['sources'] = []
  for (const a of attachments) {
    if (a.kind === 'file' && !a.refused && !/\.(pages|key|heic)$/i.test(a.name)) {
      sources.push({ label: a.name, kind: 'file', item_id: a.itemId })
    } else if (a.kind === 'link' || a.kind === 'calendar') sources.push({ label: a.url, kind: 'link' })
    else if (a.kind === 'text') sources.push({ label: a.title, kind: 'text' })
    else if (a.kind === 'moodle') sources.push({ label: `Moodle: ${a.title}`, kind: 'text' })
  }

  return {
    title,
    kind: school ? 'school' : 'self',
    summary: template.summary(reading, title),
    finish,
    minutes_per_week: minutes,
    color: freeColor(input.colors),
    units,
    deadlines,
    sources,
  }
}

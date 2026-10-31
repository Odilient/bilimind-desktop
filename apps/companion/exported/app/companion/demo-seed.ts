/**
 * The mockup's semester, computed fresh from today's date.
 *
 * The term began seven weeks before this week's Monday, so whenever the demo
 * is opened it is week 8: Lecture 8 is this week, Quiz 2 is a few days out,
 * the midterms are next week and the finals sit in the two exam weeks after
 * week 14. Kamila also teaches herself Italian, one week behind for B1 by
 * 1 June, and one fact from the class group chat waits in her inbox.
 *
 * Everything that has to land on a *particular* day relative to today (the
 * three things due soon, the pending change) is placed by days from today
 * rather than by weekday, so Today never opens empty — not on a Friday, not
 * on a Sunday. Everything else follows the weekly timetable, because time is
 * the filing system and the demo should file like the product.
 *
 * Ids are derived from names, so a reload builds the same world with the same
 * ids and a link to `/app/d/<id>` keeps working.
 */
import { createEmptyCard, fsrs, Rating, type Card as FsrsCard, type Grade } from 'ts-fsrs'
import type {
  Card,
  Check,
  CheckConfidence,
  CheckResult,
  Connection,
  Deadline,
  DeadlineKind,
  DeadlineSource,
  Goal,
  Item,
  Session,
  Signal,
  Slot,
  Snapshot,
  Subject,
  Topic,
} from './types'
import { browserZone, isoWithOffset, mondayOf, shiftDay, weekdayOf } from './time'
import { companionDemoKind } from '~/utils/companionDemo'
import { markAnswer, neighbourOf, writeQuestions } from './checks-demo'
import { computeReadiness } from './readiness'

/** Who the demo is: Kamila (`?demo=1`), or the brand-new learner of `?demo=new`. */
export const DEMO_USER = {
  get name(): string {
    return companionDemoKind() === 'new' ? 'Alex' : 'Kamila'
  },
  email: 'kamila@demo.bilimind.com',
}

/** The address forwarded mail lands on. The domain is the lead's call; see the report. */
export const FORWARD_DOMAIN = 'in.bilimind.com'

/* -------------------------------------------------------------------------- */
/* Stable ids                                                                 */
/* -------------------------------------------------------------------------- */

/** A v4-shaped uuid hashed from a name (FNV-1a, four lanes), so reloads agree. */
export function sid(name: string): string {
  let hex = ''
  for (let lane = 0; lane < 4; lane++) {
    let h = (0x811c9dc5 ^ Math.imul(lane + 1, 0x9e3779b9)) >>> 0
    const s = `${name}#${lane}`
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    hex += h.toString(16).padStart(8, '0')
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/* -------------------------------------------------------------------------- */
/* The courses                                                                */
/* -------------------------------------------------------------------------- */

type SlotSpec = [Slot['kind'], Slot['weekday'], string, string, string]

interface CourseSpec {
  key: string
  title: string
  code: string
  lecturer: string
  slots: SlotSpec[]
  /** One title per teaching week; `null` is a revision week with no topic of its own. */
  weeks: (string | null)[]
  /** Topics that should weigh more in an exam. Defaults to 1. */
  weights?: Record<string, number>
}

const SCHOOL: CourseSpec[] = [
  {
    key: 'db',
    title: 'Databases',
    code: 'CSC2104',
    lecturer: 'Dr. Rahimova',
    slots: [
      ['lecture', 2, '10:00', '12:00', 'B-302'],
      ['tutorial', 4, '14:00', '15:30', 'B-214'],
    ],
    weeks: [
      'What a database is', 'The relational model', 'SQL basics', 'Joins and subqueries',
      'ER modelling', 'Functional dependencies', 'Normalisation', 'Transactions',
      'Concurrency control', 'Recovery', 'Indexing', 'Query processing', 'NoSQL', null,
    ],
  },
  {
    key: 'net',
    title: 'Computer Networks',
    code: 'NET2201',
    lecturer: 'Dr. Karimov',
    slots: [
      ['lab', 1, '10:00', '12:00', 'Lab A-12'],
      ['lecture', 3, '10:00', '11:30', 'A-105'],
    ],
    weeks: [
      'Layers and the internet', 'Physical and link layers', 'Ethernet and switching',
      'IP addressing and subnets', 'IP addressing and subnets', 'Routing tables',
      'Distance-vector vs link-state', 'Transport and TCP', 'Congestion control',
      'DNS and HTTP', 'Network security', 'Wireless networks', 'Network management', null,
    ],
    weights: {
      'IP addressing and subnets': 1.6,
      'Routing tables': 1.4,
      'Distance-vector vs link-state': 1,
    },
  },
  {
    key: 'prg',
    title: 'Programming 2',
    code: 'PRG2102',
    lecturer: 'Mr. Tursunov',
    slots: [
      ['lecture', 1, '14:00', '15:30', 'C-201'],
      ['lab', 4, '10:00', '12:00', 'Lab C-105'],
    ],
    weeks: [
      'Classes and objects', 'Encapsulation', 'Inheritance', 'Interfaces and polymorphism',
      'Exceptions', 'Generics', 'Linked lists', 'Stacks and queues', 'Recursion', 'Trees',
      'Binary search trees', 'Hash tables', 'Sorting', null,
    ],
  },
  {
    key: 'mth',
    title: 'Discrete Maths',
    code: 'MTH2003',
    lecturer: 'Dr. Saidova',
    slots: [
      ['lecture', 2, '14:00', '15:30', 'A-210'],
      ['tutorial', 5, '10:00', '11:30', 'A-214'],
    ],
    weeks: [
      'Propositional logic', 'Predicates and quantifiers', 'Proofs', 'Sets', 'Functions',
      'Relations', 'Induction', 'Recurrences', 'Counting', 'Permutations and combinations',
      'Graphs', 'Trees and spanning trees', 'Boolean algebra', null,
    ],
  },
  {
    key: 'seg',
    title: 'Software Engineering',
    code: 'SEG2101',
    lecturer: 'Ms. Nazarova',
    slots: [
      ['lecture', 3, '14:00', '15:30', 'B-101'],
      ['seminar', 5, '14:00', '15:00', 'B-108'],
    ],
    weeks: [
      'What software engineering is', 'Requirements', 'User stories', 'Use cases',
      'Class diagrams', 'Agile and Scrum', 'Version control', 'Testing', 'Design patterns',
      'Architecture', 'Code review', 'Continuous integration', 'Maintenance', null,
    ],
  },
  {
    key: 'eng',
    title: 'Academic Writing',
    code: 'ENG1102',
    lecturer: 'Mr. Ellis',
    slots: [['seminar', 4, '16:00', '17:30', 'D-004']],
    weeks: [
      'Academic register', 'Reading critically', 'Thesis statements', 'Paragraphs',
      'Using sources', 'Citing in APA', 'Argument and counter-argument', 'Hedging',
      'Introductions and conclusions', 'Editing your own work', 'Peer review',
      'Writing workshop', 'Writing workshop', null,
    ],
  },
]

/**
 * One line on each topic taught so far, as a course outline gives it. The
 * topic brief shows it, and a check on a topic with no cards of its own is
 * written from it (`checks-demo.ts`), so its answer reads like the slides.
 */
const SUMMARY: Record<string, string> = {
  'db:What a database is': 'An organised, shared collection of data, kept consistent, safe and quick to query by a database management system.',
  'db:The relational model': 'Data as relations: tables of rows with named columns, each row told apart by a key.',
  'db:SQL basics': 'SELECT picks the columns, FROM names the tables and WHERE filters the rows; INSERT, UPDATE and DELETE change them.',
  'db:Joins and subqueries': 'A join combines rows of two tables on a matching column; a subquery is a query inside another, used as a value or a set.',
  'db:ER modelling': 'Entities, their attributes and the relationships between them, with cardinalities, drawn before any table is built.',
  'db:Transactions': 'A unit of work that happens completely or not at all. ACID: atomic, consistent, isolated, durable.',
  'net:Physical and link layers': 'The physical layer sends bits over a medium; the link layer puts them in frames and moves them between neighbours on one network.',
  'net:Transport and TCP': 'The transport layer carries data between programs; TCP makes it reliable and in order with sequence numbers, acknowledgements and resending.',
  'prg:Classes and objects': 'A class is a blueprint of fields and methods; an object is one instance of it, with its own state.',
  'prg:Encapsulation': 'Fields kept private and reached through methods, so an object decides how its own state may change.',
  'prg:Inheritance': 'A subclass extends a class: it reuses its fields and methods and overrides what it does differently.',
  'prg:Interfaces and polymorphism': 'An interface names methods without code; polymorphism lets one call run whichever implementation the object has.',
  'prg:Exceptions': 'Errors as objects, thrown where something goes wrong and caught where the caller can decide what to do.',
  'prg:Stacks and queues': 'A stack is last in, first out (push and pop); a queue is first in, first out (enqueue and dequeue).',
  'mth:Propositional logic': 'Statements that are true or false, joined by and, or, not and implies, and checked with truth tables.',
  'mth:Predicates and quantifiers': 'Statements about variables, made true or false by "for all" and "there exists".',
  'mth:Proofs': 'Getting from definitions to a conclusion step by step: directly, by the contrapositive, or by contradiction.',
  'mth:Sets': 'Collections of distinct elements, combined by union, intersection and difference.',
  'mth:Functions': 'A rule giving every element of the domain exactly one element of the codomain; one-to-one, onto, or both.',
  'mth:Relations': 'Sets of ordered pairs. Reflexive, symmetric and transitive together make an equivalence relation.',
  'mth:Recurrences': 'A sequence defined from its earlier terms, like a(n) = 2a(n-1) + 1, solved for a closed form.',
  'seg:What software engineering is': 'Building software that works and keeps working, as a team, with a process rather than heroics.',
  'seg:Requirements': 'What the system must do (functional) and how well it must do it (non-functional), agreed before it is built.',
  'seg:User stories': '"As a user, I want a goal, so that a reason", with acceptance criteria that say when it is done.',
  'seg:Use cases': 'How an actor reaches a goal with the system, step by step: the main flow and its alternatives.',
  'seg:Class diagrams': 'Classes with their attributes and methods, and the associations, inheritance and multiplicities between them.',
  'seg:Agile and Scrum': 'Short sprints that each deliver working software, run from a backlog with a daily stand-up, a review and a retrospective.',
  'seg:Version control': 'A history of every change to the code, so a team can work on branches, merge them, and go back to any version.',
  'seg:Testing': 'Checking the code does what it should: unit tests for the parts, integration tests for the parts together, run on every change.',
  'eng:Academic register': 'Formal, precise and impersonal: no contractions or slang, and claims no stronger than the evidence.',
  'eng:Reading critically': 'Asking what a text claims, on what evidence, and what it leaves out, not only what it says.',
  'eng:Thesis statements': 'One arguable sentence saying what the essay will show, usually at the end of the introduction.',
  'eng:Paragraphs': 'One idea each: a topic sentence, the evidence and what it means, and a link to the next.',
  'eng:Using sources': 'Quoting, paraphrasing and summarising others to support your argument, always saying whose words they are.',
  'eng:Citing in APA': 'Author and year in the text, as (Smith, 2020), and the full reference in an alphabetical list at the end.',
  'eng:Argument and counter-argument': 'Making your case, then facing the strongest objection to it and answering it.',
  'eng:Hedging': 'Softening a claim to match the evidence: "may", "suggests", "it is likely that".',
}

/** Italian, six units, 46 topics. The first unit was placed out of at A2. */
const ITALIAN_UNITS: [string, string[]][] = [
  ['Getting started', [
    'Greetings and introductions', 'Essere and avere in the present', 'Articles',
    'Nouns and gender', 'Numbers and telling the time', 'Regular -are verbs',
    'Asking questions', 'Prepositions of place',
  ]],
  ['Everyday present', [
    '-ere and -ire verbs', 'Irregular present: andare, fare, venire', 'Reflexive verbs',
    'Possessives', 'Modal verbs', 'Direct object pronouns', 'Daily routine', 'Ci and ne',
  ]],
  ['The past', [
    'Passato prossimo with avere', 'Passato prossimo with essere', 'Irregular participles',
    'Imperfetto', 'Passato prossimo or imperfetto', 'Indirect object pronouns',
    'Telling a story', 'Time expressions for the past',
  ]],
  ['Plans and wishes', [
    'Futuro semplice', 'Condizionale presente', 'Making plans', 'Polite requests',
    'Comparatives', 'Superlatives', 'Travel',
  ]],
  ['Opinions', [
    'Congiuntivo presente', 'Giving an opinion', 'Agreeing and disagreeing',
    'Relative pronouns', 'Combined pronouns', 'Si impersonale', 'Work and study',
  ]],
  ['B1 exam skills', [
    'Reading longer texts', 'Listening: radio and interviews', 'Writing a formal email',
    'Writing an opinion piece', 'Describing an experience', 'Arguing a point',
    'Mock: reading and listening', 'Mock: writing and speaking',
  ]],
]

/* -------------------------------------------------------------------------- */
/* Cards                                                                      */
/* -------------------------------------------------------------------------- */

type CardSpec = [front: string, back: string]

const CARDS: Record<string, Record<string, CardSpec[]>> = {
  net: {
    'Layers and the internet': [
      ['The five layers of the Internet model?', 'Application, transport, network, link, physical.'],
      ['Which layer moves packets between networks?', 'The network layer: IP.'],
      ['What is encapsulation?', 'Each layer wraps the data from the layer above in its own header.'],
      ['The unit of data at the link layer?', 'A frame.'],
    ],
    'Ethernet and switching': [
      ['What does a switch learn, and from what?', 'Which MAC address sits behind which port, from the source address of every frame it sees.'],
      ['What is a MAC address?', 'A 48-bit hardware address that belongs to the network card.'],
      ['What does ARP do?', 'Finds the MAC address that goes with an IP address on the local network.'],
    ],
    'IP addressing and subnets': [
      ['How many usable hosts does a /26 have?', '62: 64 addresses, minus the network and the broadcast address.'],
      ['The subnet mask for /27?', '255.255.255.224'],
      ['Network address of 192.168.10.77/26?', '192.168.10.64'],
      ['Broadcast address of 10.0.5.0/24?', '10.0.5.255'],
      ['The three private IPv4 ranges?', '10.0.0.0/8, 172.16.0.0/12 and 192.168.0.0/16.'],
      ['What did CIDR replace, and why?', 'Classful addressing. A prefix can be any length, so blocks fit the network instead of wasting addresses.'],
      ['Why does a host need a mask as well as an address?', 'To tell which part is the network, so it knows whether a destination is local or goes to the router.'],
      ['Split 192.168.1.0/24 into four equal subnets: the new prefix?', '/26, with 64 addresses each.'],
    ],
    'Routing tables': [
      ['What does a routing table entry hold?', 'A destination prefix, the next hop or interface, and a metric.'],
      ['What is longest prefix match?', 'When several entries match, the router takes the most specific one: the longest prefix.'],
      ['What is the default route?', '0.0.0.0/0: where a packet goes when nothing else matches.'],
      ['Static or dynamic routes: the difference?', 'Static routes are typed in by hand. Dynamic ones are learned from a routing protocol and follow the network as it changes.'],
      ['10.1.2.5 matches 10.0.0.0/8 and 10.1.0.0/16. Which entry wins?', '10.1.0.0/16, the longer prefix.'],
      ['What does a route\'s metric mean?', 'Its cost (hops, bandwidth or delay). Among routes to the same prefix, the lowest wins.'],
    ],
    'Distance-vector vs link-state': [
      ['What does a distance-vector router send its neighbours?', 'Its whole table: its distance to every destination.'],
      ['What does a link-state router flood?', 'The state of its own links, to every router, so each one builds the full map.'],
      ['Which algorithm computes link-state routes?', 'Dijkstra\'s shortest path.'],
      ['What is count to infinity?', 'In distance-vector, a dead route\'s cost keeps climbing because routers believe each other\'s stale paths.'],
      ['One fix for count to infinity?', 'Split horizon with poison reverse, or a hop limit like RIP\'s 16.'],
      ['One protocol of each kind?', 'Distance-vector: RIP. Link-state: OSPF.'],
    ],
  },
  db: {
    'Functional dependencies': [
      ['What does A → B mean?', 'Any two rows that agree on A also agree on B.'],
      ['What is a candidate key?', 'A minimal set of attributes that determines every other attribute.'],
      ['What is the closure of an attribute set?', 'Everything it determines, found by applying the dependencies until nothing new appears.'],
    ],
    Normalisation: [
      ['When is a relation in 1NF?', 'Every attribute holds one atomic value: no repeating groups.'],
      ['2NF, in one line?', '1NF, and no non-key attribute depends on only part of a composite key.'],
      ['3NF, in one line?', '2NF, and no non-key attribute depends on another non-key attribute.'],
      ['What is BCNF?', 'For every dependency X → Y, X is a superkey.'],
      ['Why normalise at all?', 'To remove redundancy, so an update, insert or delete can\'t leave the data contradicting itself.'],
    ],
  },
  prg: {
    Generics: [
      ['Why generics instead of Object?', 'Type errors are caught when compiling, and no casts are needed.'],
      ['What does <T extends Comparable<T>> promise?', 'T can be compared with itself, so the method may call compareTo.'],
      ['What is type erasure?', 'Generic types are checked at compile time and removed at run time.'],
    ],
    'Linked lists': [
      ['What does a node in a singly linked list hold?', 'A value and a reference to the next node.'],
      ['The cost of inserting at the head?', 'O(1).'],
      ['The cost of finding a value?', 'O(n): you walk from the head.'],
      ['Why does deleteByValue need a special case?', 'If the value is in the head there is no previous node, so the head itself has to move.'],
      ['What does a doubly linked list buy you?', 'You can walk backwards, and delete a node you hold in O(1).'],
    ],
  },
  mth: {
    Induction: [
      ['The two parts of a proof by induction?', 'The base case, and the step: if it holds for k, it holds for k + 1.'],
      ['What is the inductive hypothesis?', 'The assumption that the statement holds for k.'],
      ['How is strong induction different?', 'The step may assume the statement for every value up to k, not only k.'],
      ['The step in proving 1 + 2 + … + n = n(n+1)/2?', 'Add n + 1 to both sides: n(n+1)/2 + (n+1) = (n+1)(n+2)/2.'],
    ],
  },
  ita: {
    'Greetings and introductions': [['"Nice to meet you"', 'Piacere.'], ['"How are you?", formally', 'Come sta?']],
    'Essere and avere in the present': [['Io ___ (essere) studentessa.', 'sono'], ['Noi ___ (avere) fame.', 'abbiamo']],
    Articles: [['The article for "studente"?', 'lo studente'], ['The plural of "il libro"?', 'i libri']],
    'Nouns and gender': [['The gender of "mano"?', 'Feminine: la mano.'], ['The plural of "la città"?', 'le città']],
    'Numbers and telling the time': [['Che ore sono? (14:30)', 'Sono le due e mezza.'], ['Seventeen?', 'diciassette']],
    'Regular -are verbs': [['Tu ___ (parlare) italiano?', 'parli'], ['Loro ___ (mangiare).', 'mangiano']],
    'Asking questions': [['"Where are you from?"', 'Di dove sei?'], ['"How much is it?"', 'Quanto costa?']],
    'Prepositions of place': [['"The book is on the table."', 'Il libro è sul tavolo.'], ['"I live in Rome."', 'Abito a Roma.']],
    '-ere and -ire verbs': [['Io ___ (leggere).', 'leggo'], ['Voi ___ (dormire).', 'dormite']],
    'Irregular present: andare, fare, venire': [['Noi ___ (andare) al mare.', 'andiamo'], ['Cosa ___ (fare) tu stasera?', 'fai']],
    'Reflexive verbs': [['Mi ___ (svegliare) alle sette.', 'sveglio'], ['"A che ora vi alzate?"', 'What time do you all get up?']],
    Possessives: [['"my mother"', 'mia madre (no article with one family member)'], ['"our friends"', 'i nostri amici']],
    'Modal verbs': [['"I have to study."', 'Devo studiare.'], ['"Can you help me?"', 'Puoi aiutarmi?']],
    'Direct object pronouns': [['Vedi Marco? Sì, ___ vedo.', 'lo'], ['Compri le mele? Sì, ___ compro.', 'le']],
    'Daily routine': [['"to have breakfast"', 'fare colazione'], ['"to get dressed"', 'vestirsi']],
    'Ci and ne': [['Vai a Milano? Sì, ___ vado.', 'ci'], ['Quanti caffè bevi? ___ bevo due.', 'Ne']],
    'Passato prossimo with avere': [
      ['Ieri io ___ (mangiare) la pizza.', 'ho mangiato'],
      ['Voi ___ (finire) il libro?', 'avete finito'],
      ['Which auxiliary do most verbs with an object take?', 'avere'],
    ],
  },
}

/* -------------------------------------------------------------------------- */
/* Building                                                                   */
/* -------------------------------------------------------------------------- */

export interface DemoWorld extends Snapshot {
  /** Day the world was built for; a new day builds a new world. */
  seed_day: string
  /** The Italian finish line as first set, so the pace can tell when it moved. */
  ita_original_end: string
  /** `new`: the brand-new account of `?demo=new` (starter-demo.ts); absent, Kamila's semester. */
  kind?: 'new'
  /**
   * The demo server's own columns, never sent to a screen: each open check's
   * model answer (`expected`, copied into `revealed` when it is marked), and
   * each sitting's scope, so an unfinished one resumes (`repo.demo.ts`).
   */
  check_keys?: Record<string, string>
  check_batches?: Record<string, string>
}

export function buildDemoSeed(now = new Date()): DemoWorld {
  const tz = browserZone()
  const today = localKey(now)
  const week1 = shiftDay(mondayOf(today), -49)
  const termEnd = shiftDay(week1, 7 * 14 - 3)
  const examStart = shiftDay(week1, 7 * 14)
  const examEnd = shiftDay(examStart, 11)
  const created = isoWithOffset(at(shiftDay(week1, -10), '12:00'))

  const scheduler = fsrs()

  const goals: Goal[] = []
  const subjects: Subject[] = []
  const slots: Slot[] = []
  const sessions: Session[] = []
  const topics: Topic[] = []
  const deadlines: Deadline[] = []
  const items: Item[] = []
  const cards: Card[] = []
  const signals: Signal[] = []

  const stamp = { created_at: created, updated_at: created, deleted_at: null }

  /* -- The semester ------------------------------------------------------ */

  const termId = sid('goal:term')
  const term = autumnOrSpring(week1)
  goals.push({
    id: termId,
    ...stamp,
    title: term,
    kind: 'term',
    starts_on: week1,
    ends_on: examEnd,
    weeks: Array.from({ length: 14 }, (_, i) => ({ n: i + 1, starts_on: shiftDay(week1, 7 * i) })),
    breaks: null,
    exam_period: { starts_on: examStart, ends_on: examEnd },
    finish_kind: 'exam',
    finish_label: 'Finals',
    sessions_per_week: null,
    minutes_per_session: null,
    timezone: tz,
    status: 'active',
  })

  const weekOf = (key: string) => Math.floor((Date.parse(key) - Date.parse(week1)) / (7 * 86_400_000)) + 1
  const dayIn = (week: number, weekday: number) => shiftDay(week1, 7 * (week - 1) + weekday - 1)

  const topicId = (course: string, title: string) => sid(`topic:${course}:${title}`)

  SCHOOL.forEach((course, position) => {
    const subjectId = sid(`subject:${course.key}`)
    subjects.push({
      id: subjectId,
      ...stamp,
      goal_id: termId,
      title: course.title,
      code: course.code,
      color: course.key,
      lecturer: course.lecturer,
      source: 'moodle',
      source_ref: `moodle:https://moodle.university.edu:${4100 + position}`,
      source_url: `https://moodle.university.edu/course/view.php?id=${4100 + position}`,
      format: 'weeks',
      generated_course_id: null,
      recording_allowed: course.key !== 'eng',
      position,
      archived_at: null,
      group_name: null,
      try_first: false,
    })

    const seen = new Set<string>()
    let tPos = 0
    for (const title of course.weeks) {
      if (!title || seen.has(title)) continue
      seen.add(title)
      topics.push({
        id: topicId(course.key, title),
        ...stamp,
        subject_id: subjectId,
        parent_id: null,
        title,
        position: tPos++,
        summary: SUMMARY[`${course.key}:${title}`] ?? null,
        source: 'extracted',
        weight: course.weights?.[title] ?? 1,
        node_id: null,
      })
    }

    for (const [kind, weekday, from, to, location] of course.slots) {
      const slotId = sid(`slot:${course.key}:${kind}:${weekday}`)
      slots.push({
        id: slotId,
        ...stamp,
        subject_id: subjectId,
        kind,
        weekday,
        starts_at: from,
        ends_at: to,
        location,
        valid_from: week1,
        valid_until: termEnd,
        source_ref: `ics:${course.code}:${kind}:${weekday}`,
      })

      // Lectures run from week 1; tutorials, labs and seminars from week 2,
      // which is why Tutorial 6 falls in week 7 and covers Lecture 6's topic.
      const first = kind === 'lecture' || course.slots.length === 1 ? 1 : 2
      let number = 0
      for (let week = first; week <= 14; week++) {
        number++
        const day = dayIn(week, weekday)
        const lectureWeek = kind === 'lecture' || first === 1 ? week : week - 1
        const title = course.weeks[lectureWeek - 1]
        sessions.push({
          id: sid(`session:${course.key}:${kind}:${week}`),
          ...stamp,
          subject_id: subjectId,
          slot_id: slotId,
          title: `${KIND_TITLE[kind]} ${number}`,
          number,
          starts_at: isoWithOffset(at(day, from)),
          ends_at: isoWithOffset(at(day, to)),
          location,
          week,
          topic_id: title ? topicId(course.key, title) : null,
          cancelled: false,
          source_ref: `ics:${course.code}:${kind}:${week}`,
        })
      }
    }
  })

  /* -- Files from Moodle, filed under the session they belong to --------- */

  const sessionAt = (course: string, kind: string, week: number) =>
    sessions.find((s) => s.id === sid(`session:${course}:${kind}:${week}`))

  const nowMs = now.getTime()
  let itemPos = 0
  const addItem = (item: Omit<Item, 'position' | 'pinned' | 'created_at' | 'updated_at' | 'deleted_at' | 'parent_id' | 'topic_id' | 'source_ref'> & Partial<Item>): Item => {
    const row: Item = {
      parent_id: null,
      topic_id: null,
      source_ref: null,
      pinned: false,
      position: itemPos++,
      ...item,
      created_at: item.created_at ?? created,
      updated_at: item.updated_at ?? item.created_at ?? created,
      deleted_at: null,
    }
    items.push(row)
    return row
  }

  for (const s of sessions) {
    const subject = subjects.find((x) => x.id === s.subject_id)!
    const key = String(subject.color)
    const week = s.week ?? 0
    const kind = s.title.split(' ')[0]!.toLowerCase()
    // Slides go up before the lecture, so this week's are already there:
    // "slides are ready" on Today.
    const published = Date.parse(s.starts_at) - 2 * 86_400_000
    if (published > nowMs) continue
    const topic = topics.find((t) => t.id === s.topic_id)
    const slug = (topic?.title ?? 'Revision').replace(/ · .*/, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/-$/, '')
    let name: string | null = null
    if (kind === 'lecture') name = `L${s.number}-${slug}.pdf`
    else if (kind === 'tutorial') name = `T${s.number}-sheet.pdf`
    else if (kind === 'lab' && key !== 'net') name = `Lab${s.number}-brief.pdf`
    else if (kind === 'lab') name = `Lab${s.number}-${slug}.pdf`
    else if (kind === 'seminar' && key === 'eng') name = `S${s.number}-${slug}.pdf`
    if (!name) continue
    addItem({
      id: sid(`item:moodle:${s.id}`),
      subject_id: s.subject_id,
      session_id: s.id,
      topic_id: s.topic_id,
      kind: 'file',
      title: name,
      preview: null,
      meta: { mime: 'application/pdf', size: 380_000 + ((week * 7919 + s.number! * 104_729) % 2_400_000) },
      source: 'moodle',
      source_ref: `moodle:resource:${s.id.slice(0, 8)}`,
      created_at: isoWithOffset(new Date(published)),
    })
  }

  /* -- What Kamila made herself ----------------------------------------- */

  const made = (
    course: string, kind: string, week: number,
    rows: { key: string; kind: Item['kind']; title: string; preview?: string; meta?: Item['meta']; offsetMin?: number }[],
    always = false,
  ) => {
    const session = sessionAt(course, kind, week)
    if (!session || (!always && Date.parse(session.starts_at) > nowMs)) return
    for (const r of rows) {
      const when = new Date(Date.parse(session.starts_at) + (r.offsetMin ?? 5) * 60_000)
      addItem({
        id: sid(`item:${course}:${r.key}`),
        subject_id: session.subject_id,
        session_id: session.id,
        topic_id: session.topic_id,
        kind: r.kind,
        title: r.title,
        preview: r.preview ?? null,
        meta: r.meta ?? (r.kind === 'page' ? { template: 'lecture' } : {}),
        source: 'made',
        created_at: isoWithOffset(when),
      })
    }
  }

  made('db', 'lecture', 6, [
    { key: 'l6-rec', kind: 'recording', title: 'Lecture 6 recording', meta: { duration_s: 6480, segments: 214 } },
    { key: 'l6-notes', kind: 'page', title: 'Lecture 6 notes', preview: 'A → B: rows that agree on A agree on B. Closure: keep applying until nothing new appears.' },
  ])
  made('db', 'lecture', 7, [
    { key: 'l7-rec', kind: 'recording', title: 'Lecture 7 recording', meta: { duration_s: 6720, segments: 231 } },
    { key: 'l7-notes', kind: 'page', title: 'Lecture 7 notes', preview: '1NF: atomic values. 2NF: no partial dependency. 3NF: no transitive dependency.' },
    { key: 'l7-cheat', kind: 'page', title: 'Normal forms cheat sheet', preview: 'One line per normal form, with the example from slide 14.', offsetMin: 70 },
    { key: 'l7-ph1', kind: 'photo', title: 'Whiteboard: the 2NF example', meta: { mime: 'image/jpeg', size: 2_100_000 }, offsetMin: 40 },
    { key: 'l7-ph2', kind: 'photo', title: 'Whiteboard: decomposing R(A,B,C,D)', meta: { mime: 'image/jpeg', size: 1_900_000 }, offsetMin: 62 },
    { key: 'l7-ph3', kind: 'photo', title: 'Slide 22, with her circles', meta: { mime: 'image/jpeg', size: 1_700_000 }, offsetMin: 88 },
  ])
  made('db', 'tutorial', 7, [
    { key: 't6-board', kind: 'board', title: '3NF decomposition', preview: 'Six relations, the dependencies between them, and where the key moved.' },
  ])
  // Lecture 8 · Transactions is the page the pages work is shown on, opened
  // by its fixed id (sid('item:db:l8-page') = 75f39404-6d1a-4c3e-a82e-c260c119547e),
  // so it and its recording exist on every day of the week, even before
  // Tuesday's lecture. An empty page with the lecture template is filled by
  // the editor on first open.
  made('db', 'lecture', 8, [
    { key: 'l8-rec', kind: 'recording', title: 'Lecture 8 recording', meta: { duration_s: 6480, segments: 222 } },
    { key: 'l8-page', kind: 'page', title: 'Lecture 8 · Transactions', preview: 'ACID. Atomicity: all or nothing. A dirty read is reading a row another transaction hasn\'t committed yet.', meta: { template: 'lecture' }, offsetMin: 2 },
  ], true)
  made('net', 'lecture', 4, [
    { key: 'l4-notes', kind: 'page', title: 'Subnetting notes', preview: '/26 = 64 addresses, 62 hosts. Always draw the subnet first.' },
    { key: 'l4-rec', kind: 'recording', title: 'Lecture 4 recording', meta: { duration_s: 5340, segments: 180 } },
  ])
  made('net', 'lecture', 5, [
    { key: 'l5-rec', kind: 'recording', title: 'Lecture 5 recording', meta: { duration_s: 5280, segments: 176 } },
  ])
  made('net', 'lecture', 7, [
    { key: 'l7-rec', kind: 'recording', title: 'Lecture 7 recording', meta: { duration_s: 5460, segments: 188 } },
    { key: 'l7-notes', kind: 'page', title: 'Lecture 7 notes', preview: 'Distance-vector: tell your neighbours everything you know. Link-state: tell everyone about your neighbours.' },
    { key: 'l7-board', kind: 'board', title: 'Routing board', preview: 'Routing in the middle; distance-vector, link-state, tables and convergence around it.', offsetMin: 50 },
  ])
  made('prg', 'lecture', 7, [
    { key: 'l7-notes', kind: 'page', title: 'Linked lists notes', preview: 'insertAtHead is O(1). deleteByValue: check the head first.' },
    { key: 'l7-rec', kind: 'recording', title: 'Lecture 7 recording', meta: { duration_s: 4800, segments: 160 } },
  ])
  made('mth', 'lecture', 7, [
    { key: 'l7-ph', kind: 'photo', title: 'Whiteboard: the induction step', meta: { mime: 'image/jpeg', size: 2_300_000 } },
  ])
  made('seg', 'seminar', 7, [
    { key: 's6-board', kind: 'board', title: 'Sprint 2 retro', preview: 'Went well, didn\'t, try next: the team\'s stickies.' },
  ])
  made('eng', 'seminar', 6, [
    { key: 's6-page', kind: 'page', title: 'Essay outline', preview: 'Thesis: universities should record every lecture. Three reasons, one counter-argument.' },
  ])

  // Not filed under a session: a past paper for the whole course.
  const netId = sid('subject:net')
  addItem({
    id: sid('item:net:past-paper'),
    subject_id: netId,
    session_id: null,
    topic_id: topicId('net', 'Routing tables'),
    kind: 'file',
    title: 'Past paper 2025.pdf',
    preview: null,
    meta: { mime: 'application/pdf', size: 840_000 },
    source: 'moodle',
  })

  /* -- Italian, on her own ---------------------------------------------- */

  const itaStart = shiftDay(mondayOf(today), -21)
  const itaEnd = nextJuneFirst(today)
  const itaGoalId = sid('goal:ita')
  const itaId = sid('subject:ita')
  goals.push({
    id: itaGoalId,
    ...stamp,
    title: `Italian · B1 by ${dayMonth(itaEnd)}`,
    kind: 'self',
    starts_on: itaStart,
    ends_on: itaEnd,
    weeks: null,
    breaks: null,
    exam_period: null,
    finish_kind: 'exam',
    finish_label: 'B1 mock exam',
    sessions_per_week: 4,
    minutes_per_session: 25,
    timezone: tz,
    status: 'active',
  })
  subjects.push({
    id: itaId,
    ...stamp,
    goal_id: itaGoalId,
    title: 'Italian',
    code: null,
    color: 'ita',
    lecturer: null,
    source: 'generated',
    source_ref: null,
    source_url: null,
    format: 'path',
    generated_course_id: null,
    recording_allowed: true,
    position: SCHOOL.length,
    archived_at: null,
    group_name: null,
    try_first: false,
  })

  const itaTopics: Topic[] = []
  ITALIAN_UNITS.forEach(([unit, list], u) => {
    const unitId = sid(`topic:ita:unit:${u + 1}`)
    topics.push({
      id: unitId,
      ...stamp,
      subject_id: itaId,
      parent_id: null,
      title: unit,
      position: u * 100,
      summary: `Unit ${u + 1}`,
      source: 'generated',
      weight: null,
      node_id: null,
    })
    list.forEach((title, i) => {
      const t: Topic = {
        id: topicId('ita', title),
        ...stamp,
        subject_id: itaId,
        parent_id: unitId,
        title,
        position: u * 100 + i + 1,
        summary: null,
        source: 'generated',
        weight: 1,
        node_id: null,
      }
      topics.push(t)
      itaTopics.push(t)
    })
  })

  // Four 25-minute sessions a week, around the timetable: Mon, Wed, Thu, Sat
  // at 20:00. Lately one a week has been skipped, which is the week behind.
  const itaSlotDays: Slot['weekday'][] = [1, 3, 4, 6]
  for (const weekday of itaSlotDays) {
    slots.push({
      id: sid(`slot:ita:${weekday}`),
      ...stamp,
      subject_id: itaId,
      kind: 'study',
      weekday,
      starts_at: '20:00',
      ends_at: '20:25',
      location: null,
      valid_from: itaStart,
      valid_until: itaEnd,
      source_ref: null,
    })
  }

  // The first unit was placed out of; lessons start at unit 2.
  let next = 8
  let lesson = 0
  const skipped = new Set([1, 6, 9])
  let slotIndex = 0
  const horizon = shiftDay(today, 7 * 16)
  for (let day = itaStart; day <= horizon && day <= itaEnd; day = shiftDay(day, 1)) {
    const weekday = weekdayOf(day)
    if (!itaSlotDays.includes(weekday as Slot['weekday'])) continue
    const startsAt = at(day, '20:00')
    const past = startsAt.getTime() + 25 * 60_000 < nowMs
    const skip = past && skipped.has(slotIndex)
    slotIndex++
    const topic = skip ? null : itaTopics[next]
    if (!skip && topic) next++
    if (!skip) lesson++
    sessions.push({
      id: sid(`session:ita:${day}`),
      ...stamp,
      subject_id: itaId,
      slot_id: sid(`slot:ita:${weekday}`),
      title: skip ? 'Italian' : `Lesson ${lesson}`,
      number: skip ? null : lesson,
      starts_at: isoWithOffset(startsAt),
      ends_at: isoWithOffset(at(day, '20:25')),
      location: null,
      week: weekOf(day),
      topic_id: topic?.id ?? null,
      cancelled: skip,
      source_ref: null,
    })
    if (past && !skip && topic) {
      addItem({
        id: sid(`item:ita:lesson:${topic.id}`),
        subject_id: itaId,
        session_id: sid(`session:ita:${day}`),
        topic_id: topic.id,
        kind: 'page',
        title: `Lesson ${lesson} · ${topic.title}`,
        preview: 'Written for you when you reached it: the rule, six examples, and a short dialogue.',
        meta: { template: 'lesson', icon: 'ita' },
        source: 'generated',
        created_at: isoWithOffset(new Date(startsAt.getTime() - 86_400_000)),
      })
    }
  }

  /* -- The Notebook: pages that belong to no course ---------------------- */

  addItem({ id: sid('item:nb:journal'), subject_id: null, session_id: null, kind: 'page', title: 'Journal', preview: 'Week 8. A quiz and a lab before the weekend. Italian every evening, even if it\'s short.', meta: { template: 'blank' }, source: 'made', pinned: true , created_at: isoWithOffset(new Date(nowMs - 1 * 86_400_000)) })
  addItem({ id: sid('item:nb:hack'), subject_id: null, session_id: null, kind: 'board', title: 'Hackathon ideas', preview: 'Three ideas, one arrow each to the person who\'d use it.', meta: {}, source: 'made' , created_at: isoWithOffset(new Date(nowMs - 6 * 86_400_000)) })
  addItem({ id: sid('item:nb:books'), subject_id: null, session_id: null, kind: 'page', title: 'Books to read', preview: 'Designing Data-Intensive Applications; Il barone rampante (slowly).', meta: { template: 'blank' }, source: 'made' , created_at: isoWithOffset(new Date(nowMs - 13 * 86_400_000)) })

  /* -- Deadlines --------------------------------------------------------- */

  const moodle = (url: string, evidence: string, observed: string): Omit<DeadlineSource, 'id' | 'deadline_id'> => ({
    kind: 'moodle', confidence: 'official', evidence, url, item_id: null, at_seconds: null,
    observed_at: observed, change: null,
  })

  const addDeadline = (
    key: string,
    spec: {
      course: string; kind: DeadlineKind; title: string; due: Date; allDay?: boolean
      weight?: number | null; location?: string | null; status?: Deadline['status']
      confidence?: Deadline['confidence']; confirmed?: boolean; scope?: string | null
      grade?: number | null; topics?: string[]
      sources?: Omit<DeadlineSource, 'id' | 'deadline_id'>[]
    },
  ) => {
    const id = sid(`deadline:${key}`)
    const subjectId = sid(`subject:${spec.course}`)
    const confidence = spec.confidence ?? 'official'
    const confirmed = spec.confirmed ?? false
    const due = isoWithOffset(spec.due)
    const sources = (spec.sources ?? [
      spec.course === 'ita'
        ? { kind: 'user', confidence: 'own', evidence: 'Set by you when the course was built.', url: null, item_id: null, at_seconds: null, observed_at: isoWithOffset(at(itaStart, '19:00')), change: null }
        : moodle(
            `https://moodle.university.edu/mod/assign/view.php?id=${7000 + deadlines.length}`,
            `${spec.title}: due ${due.slice(0, 10)} on the course page.`,
            created,
          ),
    ]) as Omit<DeadlineSource, 'id' | 'deadline_id'>[]
    deadlines.push({
      id,
      ...stamp,
      subject_id: subjectId,
      kind: spec.kind,
      title: spec.title,
      due_at: due,
      all_day: spec.allDay ?? false,
      weight_pct: spec.weight ?? null,
      location: spec.location ?? null,
      status: spec.status ?? (Date.parse(due) < nowMs ? 'done' : 'upcoming'),
      confidence,
      confirmed,
      scope_note: spec.scope ?? null,
      grade: spec.grade ?? null,
      // Set below, once the checks exist: what they said on the day.
      readiness_said: null,
      source_ref: spec.course === 'ita' ? null : `moodle:${key}`,
      tentative: (confidence === 'heard' || confidence === 'shared') && !confirmed,
      topic_ids: (spec.topics ?? []).map((t) => topicId(spec.course, t)),
      sources: sources.map((s, i) => ({
        id: sid(`source:${key}:${i}`),
        deadline_id: id,
        created_at: s.observed_at,
        updated_at: s.observed_at,
        deleted_at: null,
        ...s,
      })),
    })
    return id
  }

  const w = (week: number, weekday: number, time: string) => at(dayIn(week, weekday), time)
  const plus = (days: number, time: string) => at(shiftDay(today, days), time)

  // Behind her.
  addDeadline('mth-ps1', { course: 'mth', kind: 'assignment', title: 'Problem set 1', due: w(3, 5, '23:59'), weight: 5, grade: 90, topics: ['Propositional logic', 'Predicates and quantifiers'] })
  addDeadline('net-quiz1', { course: 'net', kind: 'quiz', title: 'Quiz 1', due: w(4, 4, '09:00'), weight: 10, grade: 70, scope: 'chapters 1–3', topics: ['Layers and the internet', 'Physical and link layers', 'Ethernet and switching'] })
  addDeadline('db-lab2', { course: 'db', kind: 'lab', title: 'Lab 2', due: w(4, 5, '23:59'), weight: 10, grade: 85, topics: ['SQL basics'] })
  addDeadline('prg-lab3', { course: 'prg', kind: 'lab', title: 'Lab 3 · Inheritance', due: w(5, 4, '23:59'), weight: 10, grade: 90, topics: ['Inheritance'] })
  addDeadline('mth-ps2', { course: 'mth', kind: 'assignment', title: 'Problem set 2', due: w(6, 5, '23:59'), weight: 5, grade: 80, topics: ['Sets', 'Functions'] })
  addDeadline('eng-outline', { course: 'eng', kind: 'assignment', title: 'Essay outline', due: w(6, 1, '09:00'), weight: 10, grade: 80, status: 'done' })
  addDeadline('ita-u2', { course: 'ita', kind: 'milestone', title: 'Unit 2 check', due: w(7, 7, '20:00'), status: 'done', confidence: 'own', topics: ITALIAN_UNITS[1]![1] })
  addDeadline('db-lab3', { course: 'db', kind: 'lab', title: 'Lab 3', due: w(7, 5, '23:59'), weight: 10, grade: 90, topics: ['ER modelling'] })

  // Due soon. Placed by days from today so Today is never empty.
  const lecture7 = sessionAt('net', 'lecture', 7)!
  const quizDay = WEEKDAY_NAMES[weekdayOf(shiftDay(today, 2)) - 1]
  const quizHeard = `Oh, and the quiz on ${quizDay}, chapters four and five, it opens at nine.`
  const netRec = sid('item:net:l7-rec')
  addDeadline('net-quiz2', {
    course: 'net', kind: 'quiz', title: 'Quiz 2', due: plus(2, '09:00'), weight: 10, location: 'A-105',
    scope: 'chapters 4–5', confirmed: true,
    topics: ['IP addressing and subnets', 'Routing tables', 'Distance-vector vs link-state'],
    sources: [
      {
        kind: 'transcript', confidence: 'heard',
        evidence: quizHeard,
        url: null, item_id: netRec, at_seconds: 2820,
        observed_at: isoWithOffset(new Date(Date.parse(lecture7.starts_at) + 47 * 60_000)), change: null,
      },
      moodle(
        'https://moodle.university.edu/mod/quiz/view.php?id=7311',
        'Quiz 2 opens at 09:00, chapters 4–5. 20 minutes, one attempt.',
        isoWithOffset(at(shiftDay(today, -1), '15:02')),
      ),
    ],
  })
  addDeadline('prg-lab5', { course: 'prg', kind: 'lab', title: 'Lab 5 · Linked lists', due: plus(3, '23:59'), weight: 10, scope: 'the Node class and three methods', topics: ['Linked lists'] })
  const lab4Due = plus(3, '23:59')
  const lab4Id = addDeadline('db-lab4', { course: 'db', kind: 'lab', title: 'Lab 4 report', due: lab4Due, weight: 10, scope: 'Normalise the library schema to 3NF', topics: ['Normalisation', 'Functional dependencies'] })

  // Further out, by the week strip.
  addDeadline('net-mid', { course: 'net', kind: 'midterm', title: 'Midterm', due: w(9, 3, '14:00'), weight: 25, location: 'Hall C', scope: 'chapters 1–6', topics: ['Layers and the internet', 'Physical and link layers', 'Ethernet and switching', 'IP addressing and subnets', 'Routing tables', 'Distance-vector vs link-state'] })
  addDeadline('mth-ps3', { course: 'mth', kind: 'assignment', title: 'Problem set 3', due: w(9, 5, '23:59'), weight: 5, topics: ['Induction', 'Recurrences'] })
  addDeadline('seg-m2', { course: 'seg', kind: 'milestone', title: 'Milestone 2', due: w(9, 4, '23:59'), weight: 10, scope: 'Working prototype and test plan', topics: ['Testing', 'Version control'] })
  addDeadline('mth-mid', { course: 'mth', kind: 'midterm', title: 'Midterm', due: w(10, 2, '14:00'), weight: 25, location: 'Hall B', scope: 'logic to induction', topics: ['Propositional logic', 'Predicates and quantifiers', 'Proofs', 'Sets', 'Functions', 'Relations', 'Induction'] })
  addDeadline('eng-draft', { course: 'eng', kind: 'assignment', title: 'Essay draft', due: w(10, 1, '09:00'), weight: 15, topics: ['Argument and counter-argument', 'Using sources'] })
  addDeadline('prg-lab6', { course: 'prg', kind: 'lab', title: 'Lab 6 · Stacks', due: w(11, 4, '23:59'), weight: 10, topics: ['Stacks and queues'] })
  addDeadline('ita-u3', { course: 'ita', kind: 'milestone', title: 'Unit 3 check', due: w(11, 7, '20:00'), confidence: 'own', scope: '15 questions', topics: ITALIAN_UNITS[2]![1] })
  addDeadline('db-project', { course: 'db', kind: 'project', title: 'Group project', due: w(12, 5, '23:59'), weight: 30, scope: 'Design and build a small library database', topics: ['ER modelling', 'Normalisation', 'SQL basics'] })
  addDeadline('net-project', { course: 'net', kind: 'project', title: 'Packet Tracer project', due: w(12, 5, '23:59'), weight: 20, scope: 'groups of 3', topics: ['IP addressing and subnets', 'Routing tables'] })
  addDeadline('seg-demo', { course: 'seg', kind: 'presentation', title: 'Demo day', due: w(13, 3, '14:00'), weight: 15, location: 'B-101' })
  addDeadline('eng-essay', { course: 'eng', kind: 'assignment', title: 'Final essay', due: w(13, 5, '23:59'), weight: 30 })
  addDeadline('prg-lab7', { course: 'prg', kind: 'lab', title: 'Lab 7 · Trees', due: w(14, 4, '23:59'), weight: 10, topics: ['Trees', 'Binary search trees'] })
  addDeadline('ita-speak', { course: 'ita', kind: 'milestone', title: 'Speaking practice', due: w(14, 6, '20:00'), confidence: 'own' })

  // The finals, in the exam weeks.
  const finals: [string, number, number][] = [['db', 15, 1], ['net', 15, 3], ['mth', 15, 5], ['prg', 16, 2], ['seg', 16, 4]]
  for (const [course, week, weekday] of finals) {
    const spec = SCHOOL.find((c) => c.key === course)!
    addDeadline(`${course}-final`, {
      course, kind: 'final', title: 'Final exam', due: w(week, weekday, '09:00'), weight: course === 'net' ? 35 : 40,
      location: 'Main hall', topics: spec.weeks.filter((t): t is string => !!t).filter((t, i, a) => a.indexOf(t) === i),
    })
  }

  // The finish line for Italian.
  addDeadline('ita-finish', { course: 'ita', kind: 'exam', title: 'B1 mock exam', due: at(itaEnd, '10:00'), confidence: 'own', topics: itaTopics.map((t) => t.title) })

  /* -- Signals ------------------------------------------------------------ */

  // "Extended to Monday 9am": the Monday after the date it had.
  const lab4Day = shiftDay(today, 3)
  const lab4NewDue = isoWithOffset(at(shiftDay(lab4Day, 8 - weekdayOf(lab4Day)), '09:00'))
  const chatAt = isoWithOffset(at(shiftDay(today, -1), '21:05'))
  signals.push({
    id: sid('signal:lab4'),
    created_at: chatAt,
    updated_at: chatAt,
    deleted_at: null,
    channel: 'share',
    raw_excerpt: 'Javohir · 21:05\nguys lab 4 deadline is extended to monday 9am, prof said in teams',
    item_id: null,
    at_seconds: null,
    subject_id: sid('subject:db'),
    facts: [{
      type: 'deadline.update',
      subject_guess: { id: sid('subject:db'), title: 'Databases', code: 'CSC2104' },
      target_id: lab4Id,
      payload: { title: 'Lab 4 report', due_at: lab4NewDue },
      evidence: 'guys lab 4 deadline is extended to monday 9am, prof said in teams',
    }],
    confidence: 'shared',
    status: 'pending',
    applied_at: null,
  })
  const heardAt = isoWithOffset(new Date(Date.parse(lecture7.starts_at) + 47 * 60_000))
  signals.push({
    id: sid('signal:quiz2-heard'),
    created_at: heardAt,
    updated_at: heardAt,
    deleted_at: null,
    channel: 'transcript',
    raw_excerpt: quizHeard,
    item_id: netRec,
    at_seconds: 2820,
    subject_id: netId,
    facts: [{
      type: 'deadline.create',
      subject_guess: { id: netId, title: 'Computer Networks', code: 'NET2201' },
      target_id: sid('deadline:net-quiz2'),
      payload: { kind: 'quiz', title: 'Quiz 2', scope_note: 'chapters 4–5' },
      evidence: quizHeard,
      at_seconds: 2820,
    }],
    confidence: 'heard',
    status: 'applied',
    applied_at: heardAt,
  })
  const moodleAt = isoWithOffset(at(shiftDay(today, -1), '15:02'))
  signals.push({
    id: sid('signal:quiz2-moodle'),
    created_at: moodleAt,
    updated_at: moodleAt,
    deleted_at: null,
    channel: 'moodle',
    raw_excerpt: 'Quiz 2 opens at 09:00, chapters 4–5. 20 minutes, one attempt.',
    item_id: null,
    at_seconds: null,
    subject_id: netId,
    facts: [{
      type: 'deadline.update',
      subject_guess: { id: netId, title: 'Computer Networks', code: 'NET2201' },
      target_id: sid('deadline:net-quiz2'),
      payload: { confirmed: true },
      evidence: 'Quiz 2 opens at 09:00, chapters 4–5.',
    }],
    confidence: 'official',
    status: 'auto',
    applied_at: moodleAt,
  })

  /* -- Cards ------------------------------------------------------------- */

  // How each topic's cards have been practised: [reviewed, of which due now].
  // Quiz 2's scope is mostly unpractised. That's the work; what she knows is
  // what the checks below have shown.
  const practice: Record<string, [number, number, number]> = {
    // topic: [cards reviewed, reviewed ones due now, stability in days]
    'net:Layers and the internet': [4, 0, 24],
    'net:Ethernet and switching': [3, 1, 9],
    'net:IP addressing and subnets': [5, 3, 5],
    'net:Routing tables': [1, 1, 1.2],
    'net:Distance-vector vs link-state': [2, 2, 2.4],
    'db:Functional dependencies': [3, 1, 8],
    'db:Normalisation': [3, 2, 4],
    'prg:Generics': [3, 0, 14],
    'prg:Linked lists': [2, 1, 3],
    'mth:Induction': [4, 1, 6],
    'ita:Passato prossimo with avere': [3, 2, 2],
  }

  for (const [course, byTopic] of Object.entries(CARDS)) {
    const subjectId = sid(`subject:${course}`)
    for (const [title, list] of Object.entries(byTopic)) {
      const isItalian = course === 'ita'
      const [reviewed, dueNow, stability] = practice[`${course}:${title}`] ?? (isItalian ? [list.length, 0, 30] : [0, 0, 0])
      list.forEach(([front, back], i) => {
        const id = sid(`card:${course}:${title}:${i}`)
        const createdAt = new Date(nowMs - 45 * 86_400_000)
        let state: FsrsCard
        let lastReview: string | null = null
        if (i < reviewed) {
          // A believable history, then the due date pinned where the demo
          // needs it: the scheduler's own maths still drives recall.
          const elapsed = i < dueNow ? stability * 2.5 + 1 : Math.max(0.5, stability * 0.4)
          const reviewAt = new Date(nowMs - elapsed * 86_400_000)
          state = reviewOnce(scheduler, createdAt, reviewAt, stability)
          lastReview = isoWithOffset(reviewAt)
          state.due = i < dueNow
            ? new Date(nowMs - 3_600_000 * (1 + i))
            : new Date(reviewAt.getTime() + stability * 86_400_000)
          // Italian's first unit was placed out of, so every card in it
          // reads as long known; a few in unit 2 come back round anyway.
          if (isItalian && title !== 'Passato prossimo with avere') {
            const u2 = ITALIAN_UNITS[1]![1].includes(title)
            if (u2 && i === 1 && ['Possessives', 'Ci and ne', 'Direct object pronouns'].includes(title)) {
              state.due = new Date(nowMs - 7_200_000)
            }
          }
        } else {
          state = createEmptyCard(createdAt)
        }
        cards.push({
          id,
          created_at: isoWithOffset(createdAt),
          updated_at: lastReview ?? isoWithOffset(createdAt),
          deleted_at: null,
          subject_id: subjectId,
          topic_id: topicId(course, title),
          item_id: null,
          kind: back.length < 30 && /___|\?$/.test(front) ? 'basic' : 'question',
          front,
          back,
          source_quote: isItalian ? null : sourceQuote(course, title),
          fsrs: JSON.parse(JSON.stringify(state)) as Record<string, unknown>,
          due_at: isoWithOffset(state.due),
          last_review_at: lastReview,
          suspended: false,
        })
      })
    }
  }

  /* -- Checks ------------------------------------------------------------- */

  // Kamila has checked herself four times this term: cold, a few days after
  // each topic, in her own words, with no notes. Most of it stuck. Routing
  // tables didn't, two days ago: it's back in her plan and due again before
  // Quiz 2. So Quiz 2 reads about 49% ready: subnets proven, routing missed,
  // distance-vector not checked yet. The first sitting came before Quiz 1,
  // which is why Quiz 1 can say "Readiness said 58%. You got 70%."
  const checks: Check[] = []
  const material = { topics, items, cards }
  const asked = new Map<string, number>()
  type Said = [course: string, topic: string, confidence: CheckConfidence, result: CheckResult, answer: string]
  const sitting = (key: string, daysAgo: number, answers: Said[]) => {
    const start = nowMs - daysAgo * 86_400_000 - 30 * 60_000
    const batch = sid(`check-batch:${key}`)
    answers.forEach(([course, title, confidence, result, answer], i) => {
      const topic = topics.find((t) => t.id === topicId(course, title))!
      // Each topic's next card, across sittings, so no question is asked twice.
      const n = asked.get(topic.id) ?? 0
      asked.set(topic.id, n + 1)
      const q = writeQuestions(material, topic, 1, undefined, n)[0]!
      const mark = markAnswer(q, answer, confidence, topic, neighbourOf(material, topic), result)
      const at = isoWithOffset(new Date(start + (i + 1) * 100_000))
      checks.push({
        id: sid(`check:${key}:${i}`),
        created_at: isoWithOffset(new Date(start)),
        updated_at: at,
        deleted_at: null,
        batch_id: batch,
        purpose: 'cold',
        subject_id: topic.subject_id,
        topic_id: topic.id,
        deadline_id: null,
        kind: q.kind,
        prompt: q.prompt,
        source: q.source,
        cold: true,
        studied_days_ago: 4,
        confidence,
        answer,
        follow_up: null,
        follow_up_answer: null,
        result,
        feedback: mark.feedback,
        revealed: q.expected,
        tempting: mark.tempting,
        asked_at: isoWithOffset(new Date(start)),
        answered_at: at,
        graded_at: at,
      })
    })
  }
  sitting('quiz1', 33, [
    ['net', 'Layers and the internet', 'sure', 'right', 'Application, transport, network, link and physical'],
    ['net', 'Ethernet and switching', 'think', 'partly', 'Which port each MAC address is on'],
    ['net', 'Layers and the internet', 'sure', 'right', 'The network layer, so IP'],
    ['net', 'Ethernet and switching', 'guess', 'right', 'A 48-bit hardware address on the network card. Frames on the local network are delivered to it'],
  ])
  sitting('week7', 9, [
    ['net', 'Layers and the internet', 'sure', 'right', 'Each layer wraps what it gets from the layer above in its own header before it goes down'],
    ['ita', 'Possessives', 'sure', 'right', 'Mia madre, with no article, because it is one family member'],
    ['net', 'Ethernet and switching', 'think', 'right', 'It finds the MAC address for an IP address on the local network, because frames are delivered by MAC'],
    ['ita', 'Possessives', 'think', 'right', 'I nostri amici'],
  ])
  sitting('subnets', 5, [
    ['net', 'IP addressing and subnets', 'sure', 'right', '64 addresses, minus the network and the broadcast address, so 62'],
    ['prg', 'Generics', 'think', 'partly', 'You don\'t have to cast'],
    ['net', 'IP addressing and subnets', 'think', 'right', '255.255.255.224'],
    ['prg', 'Generics', 'sure', 'right', 'That T can be compared with another T, so the method is allowed to call compareTo'],
  ])
  sitting('routing', 2, [
    ['net', 'Routing tables', 'sure', 'wrong', 'The MAC address of the next router and the port it is on'],
    ['db', 'Functional dependencies', 'think', 'right', 'If two rows agree on A, they agree on B too'],
    ['net', 'Routing tables', 'guess', 'partly', 'When more than one route matches, the router picks one of them'],
    ['db', 'Functional dependencies', 'sure', 'right', 'A minimal set of attributes that determines every other attribute, so it identifies a row'],
  ])

  /* -- Connections -------------------------------------------------------- */

  const synced = (hoursAgo: number) => isoWithOffset(new Date(nowMs - hoursAgo * 3_600_000))
  const connections: Connection[] = [
    {
      id: sid('conn:moodle'), ...stamp, kind: 'moodle', label: 'Moodle', url: null,
      site_url: 'https://moodle.university.edu', status: 'ok', last_synced_at: synced(2), error: null,
      meta: { courses: 6, files: items.filter((i) => i.source === 'moodle').length },
    },
    {
      id: sid('conn:ics'), ...stamp, kind: 'ics', label: 'Timetable feed',
      url: 'https://timetable.university.edu/ical/k.yusupova.ics', site_url: null, status: 'ok',
      last_synced_at: synced(9), error: null, meta: { classes_per_week: 11 },
    },
    {
      id: sid('conn:email'), ...stamp, kind: 'email', label: 'Forwarding address', url: null,
      site_url: null, status: 'ok', last_synced_at: synced(30), error: null, meta: { alias: 'kamila.k7f3' },
    },
    {
      id: sid('conn:teams'), ...stamp, kind: 'teams', label: 'Microsoft Teams', url: null,
      site_url: null, status: 'ok', last_synced_at: synced(3), error: null, meta: {},
    },
  ]

  bridgeLessons(subjects, topics)

  const world: DemoWorld = {
    goals,
    subjects,
    slots,
    sessions,
    topics,
    deadlines,
    items,
    cards,
    plan_tasks: [],
    signals,
    connections,
    checks,
    server_time: isoWithOffset(now),
    seed_day: today,
    ita_original_end: itaEnd,
    check_keys: {},
    check_batches: {},
  }

  // What readiness said on each graded deadline's day, as the server stores
  // it when the grade comes in: nothing when nothing in scope was checked yet.
  for (const d of deadlines) {
    if (d.grade === null || !d.due_at) continue
    const said = computeReadiness(d, world, Date.parse(d.due_at))
    d.readiness_said = said.checked ? said.percent : null
  }
  return world
}

/* -------------------------------------------------------------------------- */
/* Written lessons                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The demo courses with the old product's lessons behind them, and the old
 * course id each stands for: Kamila's two, and the starter kit's sample course
 * (`?demo=new`). Negative on purpose: no database row has one, so `useApi` can
 * hand any request naming one to the in-memory demo (`demo-lessons.ts`)
 * without ever mistaking a real course for it.
 */
export const DEMO_LESSON_COURSES: Record<string, number> = { ita: -1, net: -2, learn: -3 }

/**
 * A course's topics in the order the server's mirror lays them out
 * (LessonBridge): each top-level topic, then the ones inside it. A topic whose
 * unit is gone stands on its own.
 */
export function mirrorOrder(topics: Topic[]): Topic[] {
  const live = topics.filter((topic) => !topic.deleted_at)
  const ids = new Set(live.map((topic) => topic.id))
  const byPosition = [...live].sort((a, b) => a.position - b.position)
  const out: Topic[] = []
  const place = (topic: Topic, depth: number): void => {
    out.push(topic)
    if (depth >= 2) return
    for (const child of byPosition) if (child.parent_id === topic.id) place(child, depth + 1)
  }
  for (const topic of byPosition) {
    if (!topic.parent_id || !ids.has(topic.parent_id)) place(topic, 0)
  }
  return out
}

/**
 * Point Italian, Networks and the sample course (whichever the world has) at
 * their old courses, and every topic of theirs at its node. A course already
 * bridged is left alone, so a world saved in the tab before lessons existed
 * is caught up without renumbering anybody's nodes.
 */
export function bridgeLessons(subjects: Subject[], topics: Topic[]): void {
  for (const [key, courseId] of Object.entries(DEMO_LESSON_COURSES)) {
    const subject = subjects.find((row) => row.id === sid(`subject:${key}`))
    if (!subject || subject.generated_course_id) continue
    subject.generated_course_id = courseId
    mirrorOrder(topics.filter((topic) => topic.subject_id === subject.id)).forEach((topic, k) => {
      topic.node_id = courseId * 1000 - (k + 1)
    })
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const KIND_TITLE: Record<Slot['kind'], string> = {
  lecture: 'Lecture',
  tutorial: 'Tutorial',
  lab: 'Lab',
  seminar: 'Seminar',
  lesson: 'Lesson',
  study: 'Study',
}

/** The device-local day key; the seed lives in the browser's own zone. */
function localKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** A local Date at `HH:MM` on a day key. */
function at(key: string, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  return new Date(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10), h ?? 0, m ?? 0)
}

function autumnOrSpring(week1: string): string {
  const month = +week1.slice(5, 7)
  const year = +week1.slice(0, 4)
  return month >= 8 || month <= 1 ? `Autumn semester ${month <= 1 ? year - 1 : year}` : `Spring semester ${year}`
}

/** The next 1 June at least twenty weeks away, so the finish line is always ahead. */
function nextJuneFirst(today: string): string {
  let year = +today.slice(0, 4)
  let key = `${year}-06-01`
  while (Date.parse(key) - Date.parse(today) < 140 * 86_400_000) {
    year++
    key = `${year}-06-01`
  }
  return key
}

function dayMonth(key: string): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${+key.slice(8, 10)} ${months[+key.slice(5, 7) - 1]}`
}

/** One review whose resulting stability is close to the one asked for. */
function reviewOnce(scheduler: ReturnType<typeof fsrs>, created: Date, at: Date, stability: number): FsrsCard {
  const grade: Grade = stability >= 8 ? Rating.Easy : stability >= 3 ? Rating.Good : Rating.Hard
  const first = scheduler.next(createEmptyCard(created), new Date(created.getTime() + 3_600_000), grade).card
  const card = scheduler.next(first, at, Rating.Good).card
  card.stability = stability
  card.last_review = at
  return card
}

function sourceQuote(course: string, topic: string): string {
  const quotes: Record<string, string> = {
    'net:IP addressing and subnets': 'Lecture 4, slide 12 · "always draw the subnet first"',
    'net:Routing tables': 'Lecture 6, slides 8–15',
    'net:Distance-vector vs link-state': 'Lecture 7 recording, 47:05',
    'db:Normalisation': 'Lecture 7, slides 14–22',
    'db:Functional dependencies': 'Lecture 6, slides 4–11',
    'prg:Linked lists': 'Lab 5 brief, page 2',
  }
  return quotes[`${course}:${topic}`] ?? 'From your course material'
}

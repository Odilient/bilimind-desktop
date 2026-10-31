/**
 * The companion's answers in the sample account, which has no server.
 *
 * Nothing here pretends to be a model. It reads the question for what kind
 * of help it asks for (a quiz, a summary, a plan, a map, cards, "what's on
 * Quiz 2"), finds what it is about in Kamila's own rows (the course on
 * screen, a topic or deadline the question names, the class that just
 * happened), and writes the answer from them: her cards become quiz
 * questions, her deadlines and readiness become the plan, the topics a
 * lecture covered become the map. Every claim cites the row it came from,
 * and every answer offers the one thing worth making from it, exactly as
 * the real answers do.
 *
 * For the week's topics there is a little real teaching written in (what a
 * transaction is, why a /26 has 62 hosts), because "explain this" with
 * nothing to say would be the one answer that gives the demo away.
 *
 * What the learner attached is read the same way: a pasted text or a
 * note's words become what the answer is about, the files and notes are
 * cited, and the answer says in its first line what it read. Material given
 * without asking for a course gets the offer to make one ("Make a course
 * from these"), as the real answers do.
 *
 * Asking for a course (the composer's "Make a course", "I want to learn…",
 * "make it 6 weeks" to a waiting draft) drafts one through the proposal
 * agent's stand-in for the proposer (`demoProposeFromAsk` in proposal.ts),
 * in the server's order: the draft starts, its work list fills, the draft
 * lands, then the sentence about it.
 *
 * Graded work is attempt first, as on the server: "solve
 * question 3", "write my essay", anything about an assignment or homework
 * gets what to try and where to look, with the guard naming the task (the
 * one asked about, else the next one due). "Check my attempt" gets
 * feedback on the shape of what was sent, and "I'm stuck" one next step;
 * both keep the guard of the answer before them.
 *
 * Answers stream in word by word with small pauses, through the same
 * handlers as the server's, so the thread can't tell the two apart. Threads
 * live in memory for the tab's life, like the rest of the sample.
 */
import { splitForCard } from '../doc/cards'
import { planTopicMap } from '../board/ai'
import { boardContext } from '../board/context'
import type { MapNode } from '../board/ops'
import { useCompanion, type CompanionStore } from '../store'
import type { Deadline, Item, Readiness, Session, Subject, Topic } from '../types'
import { dayKey, greeting, relativeDay, shiftDay, timecode, whenLabel } from '../time'
import { dueLong, readyWords } from '../words'
import { domainOf, moodleAttachment } from '../create'
import type { AskHandlers } from './client'
import { lastClass, nextDeadline, weakestTopic } from './suggest'
import type { AiAction, AiAskBody, AiAttachment, AiCitation, AiGuard, AiMapBranch, AiMessage, AiThread } from './types'

/* -- A little real teaching, for the week's topics ----------------------------- */

interface Know {
  simple: string
  example: string
  points: string[]
  /** Questions for topics the sample has no cards on. */
  qa?: [string, string][]
}

const KNOW: Record<string, Know> = {
  transactions: {
    simple:
      'A transaction is a group of database steps that must happen together or not at all. Think of a bank transfer: taking 100 out of one account and putting it into another is one transaction. If the second half fails, the first is undone, so no money vanishes.',
    points: [
      '**Atomicity**: all of it happens, or none of it does. A failure halfway rolls everything back.',
      '**Consistency**: a transaction moves the database from one valid state to another, so rules like "balance ≥ 0" still hold after it.',
      '**Isolation**: transactions running at the same time don\'t see each other\'s half-finished work.',
      '**Durability**: once a transaction commits, its changes survive a crash.',
      'A **dirty read** is reading a row another transaction changed but hasn\'t committed. If that one rolls back, you read data that never existed.',
    ],
    example:
      'You and a friend both book the last seat on a flight at 10:00:00. Both transactions read "seats left: 1". Without isolation, both write "seats left: 0" and both get a ticket: a **lost update**. With a lock (or the serialisable isolation level) the second booking waits, re-reads "seats left: 0", and is told the flight is full.',
    qa: [
      ['What does atomicity guarantee?', 'All of a transaction happens, or none of it: a failure halfway rolls it back.'],
      ['What is a dirty read?', 'Reading a row another transaction changed but has not committed yet.'],
      ['What does durability promise?', 'Once a transaction commits, its changes survive a crash.'],
      ['What does isolation prevent?', 'Transactions running at the same time seeing each other\'s unfinished changes.'],
      ['COMMIT or ROLLBACK: which undoes the transaction?', 'ROLLBACK undoes everything since the transaction began; COMMIT makes it permanent.'],
      ['What is a lost update?', 'Two transactions read the same value and both write, so the first write is silently overwritten.'],
    ],
  },
  normalisation: {
    simple:
      'Normalising is splitting one big table into smaller ones so every fact is stored exactly once. When a fact lives in two places, sooner or later someone updates one copy and not the other, and the database contradicts itself.',
    points: [
      '**1NF**: one value per cell, no repeating groups.',
      '**2NF**: no column depends on only *part* of a composite key.',
      '**3NF**: no column depends on another non-key column.',
      'Each step removes one kind of redundancy, and with it an **update anomaly**.',
    ],
    example:
      'Take the library schema from Lab 4: `Loan(member_id, book_id, member_name, book_title, due)`. `member_name` depends only on `member_id`, which is part of the key, so the table breaks 2NF. Split it into `Member(member_id, member_name)`, `Book(book_id, book_title)` and `Loan(member_id, book_id, due)`. Renaming a member now changes one row, not every loan they ever made.',
  },
  'functional dependencies': {
    simple:
      'A functional dependency A → B says: if you know A, you know B. Any two rows with the same A must have the same B. Student ID → name is one: the same ID never comes with two different names.',
    points: [
      '**A → B**: rows that agree on A agree on B.',
      'A **candidate key** determines every other column, and nothing smaller does.',
      'The **closure** of a set is everything it determines: keep applying the dependencies until nothing new appears.',
      'The normal forms are defined by which dependencies a table may have.',
    ],
    example:
      'In `R(A, B, C, D)` with A → B and B → C, the closure of {A} is {A, B, C}. D isn\'t in it, so A alone isn\'t a key. {A, D} is: its closure is every column.',
  },
  'ip addressing and subnets': {
    simple:
      'An IP address has two parts: the network it\'s on and the host within that network. The /number (the prefix) says how many of the 32 bits are the network part. A bigger prefix means smaller subnets with fewer hosts.',
    points: [
      'A /n leaves 32 − n bits for hosts: 2^(32−n) addresses.',
      'Two of them are taken: the **network address** (host bits all 0) and the **broadcast** (all 1).',
      'So a /26 has 64 addresses and **62 usable hosts**.',
      'The mask is the prefix written out: /26 = 255.255.255.192.',
    ],
    example:
      'Your lab gets 192.168.10.0/24 and needs four rooms. Borrow 2 bits to make /26: four subnets of 64, starting at .0, .64, .128 and .192. Room 2 is 192.168.10.64/26: hosts .65 to .126, broadcast .127. A laptop at .77 is in room 2.',
  },
  'routing tables': {
    simple:
      'A routing table is a router\'s list of directions: "to reach this network, send the packet to that next hop". When several entries match, the router picks the most specific one.',
    points: [
      'An entry is a destination prefix, a next hop (or interface) and a metric.',
      '**Longest prefix match**: when several entries match, the longest prefix wins.',
      'The **default route**, 0.0.0.0/0, catches everything else.',
      'Static routes are typed in by hand; dynamic ones are learned from a protocol.',
    ],
    example:
      'A packet for 10.1.2.5 arrives. The table has 10.0.0.0/8 → R1 and 10.1.0.0/16 → R2. Both match, but /16 is longer, so it goes to R2. A packet for 8.8.8.8 matches neither and leaves by the default route.',
  },
  'distance-vector vs link-state': {
    simple:
      'Two ways routers learn the map. Distance-vector: each router tells its neighbours everything it knows ("I can reach X in 3 hops"). Link-state: each router tells everyone about its own links, then every router draws the whole map itself and runs Dijkstra.',
    points: [
      'Distance-vector shares its whole table, only with its neighbours (RIP).',
      'Link-state floods the state of its own links to every router (OSPF).',
      'Link-state converges faster; distance-vector is simpler and lighter.',
      'Distance-vector can **count to infinity**; split horizon and poison reverse help.',
    ],
    example:
      'Router C\'s link to D dies. In distance-vector, B still tells C "I can reach D in 2" (through C itself), so C believes it and the cost climbs 3, 4, 5…: count to infinity. In link-state, C floods "my link to D is down", every router reruns Dijkstra, and the network agrees in one round.',
  },
  'linked lists': {
    simple:
      'A linked list is a chain of nodes. Each node holds a value and a pointer to the next one, and the list only remembers the first node, the head. Adding at the front is instant; finding something means walking the chain.',
    points: [
      'A node is a value plus a reference to the next node.',
      '`insertAtHead` is O(1): the new node points at the old head.',
      'Search and `deleteByValue` are O(n): you walk from the head.',
      'Deleting the head is a special case: there is no previous node to re-link.',
    ],
    example:
      'For Lab 5\'s `deleteByValue(7)` on 3 → 7 → 9: walk with `prev` and `cur`; when `cur.value == 7`, set `prev.next = cur.next`, giving 3 → 9. If the list were 7 → 9 there is no `prev`, so move the head instead: `head = head.next`.',
  },
  'stacks and queues': {
    simple:
      'A stack is a pile of plates: you add and take from the top (last in, first out). A queue is the line at the canteen: you join at the back and leave from the front (first in, first out).',
    points: [
      'Stack: `push` and `pop` at the top, LIFO.',
      'Queue: `enqueue` at the back, `dequeue` at the front, FIFO.',
      'Both are O(1) per operation on a linked list or a circular array.',
      'Undo and the call stack are stacks; print jobs and breadth-first search use queues.',
    ],
    example:
      'Checking the brackets in `(a[b]c)`: push every opener; on a closer, pop and check it matches. `(` and `[` go on, `]` pops `[`, `)` pops `(`, and the stack is empty at the end, so it\'s balanced.',
    qa: [
      ['LIFO or FIFO: which is a stack?', 'LIFO: last in, first out.'],
      ['Where does a queue add and remove?', 'It adds at the back and removes from the front.'],
      ['Which structure checks balanced brackets?', 'A stack: push openers, pop on each closer.'],
    ],
  },
  induction: {
    simple:
      'Induction proves something for every n by climbing a ladder: show you can stand on the first rung (the base case), then show that from any rung k you can reach rung k + 1 (the step). Then you can reach them all.',
    points: [
      '**Base case**: prove it for the smallest n.',
      '**Hypothesis**: assume it holds for k.',
      '**Step**: use the hypothesis to prove it for k + 1.',
      'Strong induction may assume it for every value up to k.',
    ],
    example:
      'Claim: 1 + 2 + … + n = n(n+1)/2. Base: n = 1 gives 1 = 1·2/2. Step: assume it for k, then add k + 1 to both sides: k(k+1)/2 + (k+1) = (k+1)(k+2)/2, which is the formula for k + 1.',
  },
}

/* -- Small tools ------------------------------------------------------------------ */

const STOP = new Set(
  'a an the and or but of to in on at for with from by is are was were be been it its this that these those as if then than so not no do does did can could will would should may might must i you we they he she them our your my me us what which who how why when where there here into out up down over under about'.split(' '),
)

function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-zà-ú0-9]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w))
}

function sentencesOf(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 280)
}

/** The few sentences that carry a text: scored by how much of its vocabulary they hold. */
function keySentences(text: string, n = 4): string[] {
  const all = sentencesOf(text)
  if (!all.length) return []
  const freq = new Map<string, number>()
  for (const w of words(text)) freq.set(w, (freq.get(w) ?? 0) + 1)
  return all
    .map((s, i) => {
      const ws = words(s)
      return { s, i, score: ws.reduce((a, w) => a + (freq.get(w) ?? 0), 0) / Math.sqrt(ws.length + 1) }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s)
}

function clip(text: string, n = 60): string {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > n ? `${one.slice(0, n - 1).trimEnd()}…` : one
}

function has(text: string, re: RegExp): boolean {
  return re.test(text)
}

/** Stable "random" from a string, so the same question picks the same cards. */
function seedOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

function pick<T>(list: T[], n: number, seed: number): T[] {
  const copy = [...list]
  let s = seed || 1
  for (let i = copy.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0
    const j = s % (i + 1)
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy.slice(0, n)
}

class Cites {
  list: AiCitation[] = []
  /** " [n]" for a row, numbering it the first time it is cited. */
  ref(cite: AiCitation | null): string {
    if (!cite) return ''
    let i = this.list.findIndex((c) => c.kind === cite.kind && c.id === cite.id)
    if (i < 0) {
      this.list.push(cite)
      i = this.list.length - 1
    }
    return ` [${i + 1}]`
  }
}

/* -- What the question is about ---------------------------------------------------- */

/** One thing the learner attached, as the answer reads it. */
interface Given {
  att: AiAttachment
  /** A file or note it can point back at. */
  cite: AiCitation | null
  /** The words in it the sample can read: pasted text, a note's preview, a Moodle outline. */
  text: string
}

interface Ground {
  store: CompanionStore
  text: string
  lower: string
  body: AiAskBody
  subject: Subject | null
  topic: Topic | null
  deadline: Deadline | null
  item: Item | null
  excerpt: string
  /** What came with the message. */
  given: Given[]
  /** What the answer is about when that's the material: "lecture-4.pdf", "what you added". */
  about: string | null
  now: number
}

function givenOf(body: AiAskBody, store: CompanionStore): Given[] {
  return (body.attachments ?? []).map((att) => {
    if ((att.kind === 'file' || att.kind === 'note') && att.item_id) {
      const item = store.get('items', att.item_id)
      return {
        att,
        cite: item ? itemCite(item) : { kind: 'item', id: att.item_id, label: att.label },
        text: item?.preview ?? '',
      }
    }
    if (att.kind === 'text') return { att, cite: null, text: att.text ?? '' }
    if (att.kind === 'moodle' && att.subject_id) {
      const subject = store.get('subjects', att.subject_id)
      return { att, cite: null, text: subject ? moodleAttachment(store, subject).outline : '' }
    }
    return { att, cite: null, text: '' }
  })
}

function mentions(lower: string, phrase: string | null | undefined): boolean {
  if (!phrase) return false
  const p = phrase.toLowerCase().trim()
  return p.length > 2 && lower.includes(p)
}

function resolve(body: AiAskBody, store: CompanionStore): Ground {
  const text = `${body.message}`
  const lower = text.toLowerCase()
  const ctx = body.context
  const now = Date.now()
  const everything = body.scope === 'everything'

  let subject = ctx.subject_id && !everything ? store.get('subjects', ctx.subject_id) : null
  // A course the question names outright beats the screen's.
  // "Networks" for Computer Networks; not "writing" for Academic Writing,
  // which "continue writing" would otherwise name.
  const short = (s: Subject) => {
    const last = s.title.split(' ').slice(-1)[0] ?? ''
    return s.title.includes(' ') && last.length >= 5 && !['writing', 'skills', 'basics'].includes(last.toLowerCase()) ? last : null
  }
  const named = store.subjects.value.find(
    (s) => mentions(lower, s.title) || mentions(lower, s.code) || mentions(lower, short(s)),
  )
  if (named) subject = named

  let deadline = ctx.deadline_id ? store.get('deadlines', ctx.deadline_id) : null
  const dl = store.deadlines.value.filter((d) => d.status === 'upcoming' || Date.parse(d.due_at ?? '') > now)
  const namedDeadline =
    dl.find((d) => mentions(lower, d.title) && (!subject || d.subject_id === subject.id)) ??
    dl.find((d) => mentions(lower, d.title))
  if (namedDeadline) deadline = namedDeadline
  if (!subject && deadline) subject = store.get('subjects', deadline.subject_id)

  const item = ctx.item_id ? store.get('items', ctx.item_id) : null
  let topic = ctx.topic_id ? store.get('topics', ctx.topic_id) : null
  const pool = store.topics.value.filter((t) => !subject || t.subject_id === subject.id)
  const namedTopic =
    pool.find((t) => mentions(lower, t.title)) ?? store.topics.value.find((t) => mentions(lower, t.title))
  if (namedTopic) topic = namedTopic
  if (!topic && ctx.label) {
    const label = ctx.label.toLowerCase()
    topic = pool.find((t) => label.includes(t.title.toLowerCase())) ?? null
  }
  if (!topic && ctx.node_id) topic = store.topics.value.find((t) => t.node_id === ctx.node_id) ?? null
  if (!topic && item?.topic_id) topic = store.get('topics', item.topic_id)
  if (!topic && item?.session_id) {
    const session = store.get('sessions', item.session_id)
    if (session?.topic_id) topic = store.get('topics', session.topic_id)
  }
  // "Lecture 7" in the question: that lecture's topic.
  const lecture = lower.match(/\b(lecture|class|tutorial|lab|seminar|lesson) (\d{1,2})\b/)
  if (!namedTopic && lecture && subject) {
    const session = store.sessions.value.find(
      (x) => x.subject_id === subject!.id && x.title.toLowerCase() === `${lecture[1]} ${lecture[2]}`,
    )
    if (session?.topic_id) topic = store.get('topics', session.topic_id)
  }
  if (topic && !subject) subject = store.get('subjects', topic.subject_id)

  // What came with the message: its words are what the answer reads first,
  // and a note or a Moodle course says which course and topic it's about.
  const given = givenOf(body, store)
  for (const g of given) {
    const row = g.att.item_id ? store.get('items', g.att.item_id) : null
    if (!topic && row?.topic_id) topic = store.get('topics', row.topic_id)
    if (!topic) topic = store.topics.value.find((t) => mentions(g.att.label.toLowerCase(), t.title)) ?? null
    if (!subject && row?.subject_id) subject = store.get('subjects', row.subject_id)
    if (!subject && g.att.kind === 'moodle' && g.att.subject_id) subject = store.get('subjects', g.att.subject_id)
  }
  if (topic && !subject) subject = store.get('subjects', topic.subject_id)
  const about = given.length === 1 ? given[0]!.att.label : given.length ? 'what you added' : null

  const excerpt = [body.quote ?? '', body.scope === 'here' ? ctx.excerpt ?? '' : '', ...given.map((g) => g.text)]
    .join('\n\n')
    .trim()
  return { store, text, lower, body, subject, topic, deadline, item, excerpt, given, about, now }
}

/* -- Citations for rows ------------------------------------------------------------ */

function sessionsOf(g: Ground, topic: Topic): Session[] {
  return g.store.sessions.value.filter((x) => x.topic_id === topic.id && Date.parse(x.starts_at) < g.now && !x.cancelled)
}

function lectureCite(g: Ground, topic: Topic | null): AiCitation | null {
  if (!topic) return null
  const sessions = sessionsOf(g, topic)
  const session = sessions.find((x) => x.title.startsWith('Lecture')) ?? sessions[0]
  if (!session) return { kind: 'topic', id: topic.id, label: topic.title, subject_id: topic.subject_id }
  // The pages and recordings filed under that class are the better source.
  const items = g.store.items.value.filter((i) => i.session_id === session.id)
  const page = items.find((i) => i.kind === 'page')
  if (page) return { kind: 'item', id: page.id, label: page.title, subject_id: page.subject_id }
  const recording = items.find((i) => i.kind === 'recording')
  if (recording) {
    const at = 600 + (seedOf(topic.title) % 3600)
    return {
      kind: 'item',
      id: recording.id,
      label: `${recording.title} · ${timecode(at)}`,
      at_seconds: at,
      subject_id: recording.subject_id,
    }
  }
  return { kind: 'session', id: session.id, label: `${session.title} · ${topic.title}`, subject_id: session.subject_id }
}

function deadlineCite(d: Deadline): AiCitation {
  return { kind: 'deadline', id: d.id, label: `${d.title} · ${d.due_at ? whenLabel(d.due_at, d.all_day) : 'no date'}`, subject_id: d.subject_id }
}

function itemCite(item: Item): AiCitation {
  return { kind: 'item', id: item.id, label: item.title, subject_id: item.subject_id }
}

function hereCite(g: Ground): AiCitation | null {
  const ctx = g.body.context
  const given = g.given.find((x) => x.cite)?.cite
  if (given) return given
  if (g.item) return itemCite(g.item)
  if (ctx.kind === 'lesson' && ctx.node_id) {
    return { kind: 'lesson', id: String(ctx.node_id), label: ctx.label ?? 'This lesson', subject_id: ctx.subject_id ?? null }
  }
  return null
}

/* -- Material ------------------------------------------------------------------------ */

function know(topic: Topic | null): Know | null {
  return topic ? KNOW[topic.title.toLowerCase()] ?? null : null
}

/** Question-and-answer pairs on some topics: her cards first, then the written-in ones. */
function qaFor(g: Ground, topics: Topic[], n: number): { q: string; a: string; topic: Topic }[] {
  const out: { q: string; a: string; topic: Topic }[] = []
  for (const t of topics) {
    for (const c of g.store.cards.value.filter((c) => c.topic_id === t.id && !c.suspended)) {
      out.push({ q: c.front, a: c.back, topic: t })
    }
    if (!out.some((x) => x.topic.id === t.id)) {
      for (const [q, a] of know(t)?.qa ?? []) out.push({ q, a, topic: t })
    }
  }
  return pick(out, n, seedOf(g.text))
}

/** Cards from a passage: its "X is Y" sentences, as a person would write them. */
function cardsFromText(text: string, n: number): { front: string; back: string }[] {
  const out: { front: string; back: string }[] = []
  for (const sentence of sentencesOf(text)) {
    const card = splitForCard(sentence.replace(/[.!]$/, ''))
    if (card.front && card.back.length > 8) out.push({ front: card.front, back: card.back })
    if (out.length >= n) break
  }
  return out
}

function taughtTopics(g: Ground, subjectId: string): Topic[] {
  const ids = new Set(
    g.store.sessions.value
      .filter((x) => x.subject_id === subjectId && x.topic_id && Date.parse(x.starts_at) < g.now)
      .map((x) => x.topic_id!),
  )
  return g.store.topics.value.filter((t) => ids.has(t.id))
}

/* -- The answers ----------------------------------------------------------------------- */

interface Reply {
  status: string[]
  text: string
  citations: AiCitation[]
  actions: AiAction[]
  /** It asked for an attempt instead of doing the work. */
  guard?: AiGuard | null
}

function reply(status: string[], text: string, cites: Cites, actions: AiAction[] = []): Reply {
  return { status, text: text.trim(), citations: cites.list, actions }
}

function readingStatus(g: Ground): string[] {
  const ctx = g.body.context
  if (g.given.length) return g.given.slice(0, 3).map((x) => `Reading ${x.att.label}…`)
  if (g.body.scope === 'here' && ctx.label) return [`Reading ${ctx.label}…`]
  if (g.topic) return [`Looking through ${g.topic.title}…`]
  if (g.subject) return [`Looking through ${g.subject.title}…`]
  return ['Looking through your courses…']
}

function explain(g: Ground, simply: boolean): Reply {
  const cites = new Cites()
  const k = know(g.topic)
  const here = hereCite(g)
  const name = g.topic?.title ?? g.body.context.label ?? 'this'
  const lines: string[] = []

  if (k) {
    lines.push(`${simply ? 'Here it is in plain words.' : `**${name}**, from the start.`}${cites.ref(here ?? lectureCite(g, g.topic))}`)
    lines.push('', k.simple, '', '**The parts to hold on to**', '')
    k.points.forEach((p, i) => lines.push(`- ${p}${i === 0 ? cites.ref(lectureCite(g, g.topic)) : ''}`))
    lines.push('', 'Ask me for a real example, or a quick quiz, when it starts to click.')
  } else if (g.excerpt) {
    const key = keySentences(g.excerpt, 4)
    lines.push(`The short version of ${name}:${cites.ref(here)}`, '')
    key.forEach((s) => lines.push(`- ${s}`))
    lines.push('', 'Tell me which line still feels foggy and I\'ll take just that one apart.')
  } else if (g.topic) {
    const qa = qaFor(g, [g.topic], 4)
    lines.push(`**${g.topic.title}**, from what your course has covered:${cites.ref(lectureCite(g, g.topic))}`, '')
    qa.forEach((x) => lines.push(`- **${x.q.replace(/\?$/, '')}?** ${x.a}`))
    if (!qa.length) lines.push(`- It's on the course map but hasn't had a class yet. Once it does, I'll explain it from the slides and the recording.`)
  } else {
    return general(g)
  }

  const actions: AiAction[] = []
  const deck = k?.qa?.length ? k.qa.map(([front, back]) => ({ front, back })) : g.excerpt ? cardsFromText(g.excerpt, 5) : []
  if (deck.length) actions.push({ type: 'create_cards', subject_id: g.subject?.id ?? null, topic_id: g.topic?.id ?? null, cards: deck.slice(0, 6) })
  actions.push({
    type: 'create_page',
    title: `${name}, ${simply ? 'simply' : 'explained'}`,
    subject_id: g.subject?.id ?? null,
    markdown: lines.join('\n').replace(/ \[\d+\]/g, ''),
  })
  return reply(readingStatus(g), lines.join('\n'), cites, actions)
}

function example(g: Ground): Reply {
  const cites = new Cites()
  const k = know(g.topic)
  if (!k) return explain(g, false)
  const qa = qaFor(g, [g.topic!], 2)
  const text = [
    `A real one${g.subject ? `, the kind ${g.subject.title} asks about` : ''}:${cites.ref(lectureCite(g, g.topic))}`,
    '',
    k.example,
    '',
    qa.length ? 'Now try two on your own before you look:' : '',
  ].join('\n')
  const actions: AiAction[] = qa.length
    ? [{ type: 'quiz', subject_id: g.subject?.id ?? null, questions: qa.map((x) => ({ q: x.q, a: x.a })) }]
    : []
  return reply(readingStatus(g), text, cites, actions)
}

function quiz(g: Ground): Reply {
  const cites = new Cites()
  let topics: Topic[] = []
  let about = ''
  if (g.deadline) {
    topics = g.deadline.topic_ids.map((id) => g.store.get('topics', id)).filter((t): t is Topic => !!t)
    about = g.deadline.title
  }
  if (!topics.length && g.topic) {
    topics = [g.topic]
    about = g.topic.title
  }
  if (!topics.length && g.subject) {
    const weak = weakestTopic(g.store, g.subject.id, g.now)
    topics = weak ? [weak] : []
    about = weak?.title ?? g.subject.title
  }
  if (!topics.length) {
    const next = nextDeadline(g.store, null, g.now)
    if (next) {
      g.deadline = next
      topics = next.topic_ids.map((id) => g.store.get('topics', id)).filter((t): t is Topic => !!t)
      about = next.title
    }
  }

  let questions = qaFor(g, topics, 5).map((x) => ({ q: x.q, a: x.a }))
  if (!questions.length && g.excerpt) questions = cardsFromText(g.excerpt, 5).map((c) => ({ q: c.front, a: c.back }))
  if (!questions.length) {
    return reply(
      readingStatus(g),
      `I couldn't find anything to quiz you on for ${about || 'that'} yet: no cards, and no class has covered it. Make a few cards from a lesson or your notes, and I'll quiz you from those.`,
      cites,
    )
  }

  const sources = topics.slice(0, 3).map((t) => cites.ref(lectureCite(g, t))).join('')
  const lines = [
    `${questions.length} questions on **${about}**, from your own cards and classes.${sources}${g.deadline ? cites.ref(deadlineCite(g.deadline)) : ''}`,
    '',
    'Say each answer out loud (or in your head) before you reveal it. That\'s the part that makes it stick.',
  ]
  if (g.deadline?.due_at) lines.push('', `${g.deadline.title} is ${relativeDay(dayKey(g.deadline.due_at)) === 'today' ? 'today' : `on ${dueLong(g.deadline)}`}.`)
  return reply(readingStatus(g), lines.join('\n'), cites, [
    { type: 'quiz', subject_id: g.subject?.id ?? null, questions },
  ])
}

function cards(g: Ground): Reply {
  const cites = new Cites()
  const k = know(g.topic)
  let deck = g.excerpt ? cardsFromText(g.excerpt, 6) : []
  if (deck.length < 3 && k?.qa) deck = k.qa.map(([front, back]) => ({ front, back }))
  if (deck.length < 3 && k) {
    deck = k.points.map((p) => splitForCard(p.replace(/\*\*/g, '').replace(/`/g, ''))).filter((c) => c.front)
  }
  if (deck.length < 3 && g.topic) {
    deck = qaFor(g, [g.topic], 6).map((x) => ({ front: x.q, back: x.a }))
  }
  if (!deck.length) {
    return reply(readingStatus(g), 'There isn\'t enough here to make good cards from yet. Open a lesson or a page with a few definitions on it and ask again.', cites)
  }
  deck = deck.slice(0, 6)
  const from = hereCite(g) ?? lectureCite(g, g.topic)
  const text = [
    `${deck.length} cards from ${g.about ?? (g.body.scope === 'here' && g.body.context.label ? g.body.context.label : g.topic?.title ?? 'this')}.${cites.ref(from)} One idea each, worded the way a question on the exam would be.`,
    '',
    'They\'ll be due straight away, so your next practice starts with them.',
  ].join('\n')
  return reply(readingStatus(g), text, cites, [
    { type: 'create_cards', subject_id: g.subject?.id ?? null, topic_id: g.topic?.id ?? null, cards: deck },
  ])
}

function summarise(g: Ground): Reply {
  const cites = new Cites()
  const ctx = g.body.context

  // "Summarise my notes from this week."
  if (has(g.lower, /notes from this week|this week'?s notes|my notes/) && ctx.kind !== 'page') {
    const since = g.now - 7 * 86_400_000
    const pages = g.store.items.value
      .filter((i) => i.kind === 'page' && i.preview && Date.parse(i.updated_at ?? i.created_at ?? '') >= since)
      .slice(0, 6)
    if (!pages.length) return general(g)
    const lines = ['What you wrote this week, a line each:', '']
    for (const p of pages) {
      const course = g.store.subjectOf(p)
      lines.push(`- **${p.title}**${course ? ` (${course.title})` : ''}: ${clip(p.preview ?? '', 120)}${cites.ref(itemCite(p))}`)
    }
    return reply(['Reading your notes from this week…'], lines.join('\n'), cites, [
      { type: 'create_page', title: 'This week, in short', subject_id: null, markdown: lines.join('\n').replace(/ \[\d+\]/g, '') },
    ])
  }

  const k = know(g.topic)
  const here = hereCite(g)
  const name =
    g.about ??
    (ctx.kind === 'page' || ctx.kind === 'lesson' || ctx.kind === 'board' ? ctx.label ?? 'this' : g.topic?.title ?? ctx.label ?? 'this')
  const lines: string[] = []
  const fromText = g.excerpt ? keySentences(g.excerpt, 5) : []

  if (ctx.kind === 'board' && g.excerpt) {
    // A board's text arrives as its map, a line per idea.
    const rows = g.excerpt.split(/\n|·/).map((r) => r.trim()).filter((r) => r.length > 2).slice(0, 14)
    lines.push(`**${name}** as notes:${cites.ref(here)}`, '')
    rows.forEach((r) => lines.push(`- ${r}`))
  } else if (fromText.length >= 2) {
    lines.push(`The key points of ${name}:${cites.ref(here)}`, '')
    fromText.forEach((s) => lines.push(`- ${s}`))
    if (k) lines.push('', `In one line: ${k.simple.split('. ')[0]}.`)
  } else if (k) {
    lines.push(`The key points of **${g.topic!.title}**:${cites.ref(here ?? lectureCite(g, g.topic))}`, '')
    k.points.forEach((p) => lines.push(`- ${p}`))
  } else if (g.item?.preview) {
    lines.push(`The key points of ${name}:${cites.ref(here)}`, '', `- ${g.item.preview}`)
  } else if (g.topic) {
    const qa = qaFor(g, [g.topic], 5)
    if (!qa.length) return general(g)
    lines.push(`The key points of **${g.topic.title}**:${cites.ref(lectureCite(g, g.topic))}`, '')
    qa.forEach((x) => lines.push(`- ${x.a}`))
  } else {
    return general(g)
  }

  // Which lecture this was, and what's next for it.
  const session = g.topic ? sessionsOf(g, g.topic).find((x) => x.title.startsWith('Lecture')) : null
  const next = g.subject ? nextDeadline(g.store, g.subject.id, g.now) : null
  if (next && g.topic && next.topic_ids.includes(g.topic.id)) {
    lines.push('', `This is on **${next.title}**, ${next.due_at ? whenLabel(next.due_at, next.all_day) : 'date to be set'}.${cites.ref(deadlineCite(next))}`)
  } else if (session) {
    lines.push('', `From ${session.title}${g.subject ? `, ${g.subject.title}` : ''}.`)
  }

  const markdown = lines.join('\n').replace(/ \[\d+\]/g, '')
  return reply(readingStatus(g), lines.join('\n'), cites, [
    { type: 'create_page', title: `${clip(name, 48)}: key points`, subject_id: g.subject?.id ?? null, markdown },
  ])
}

function missed(g: Ground): Reply {
  const cites = new Cites()
  const k = know(g.topic)
  if (!k) return summarise(g)
  const have = new Set(words(g.excerpt))
  const gaps = k.points.filter((p) => {
    const ws = words(p.replace(/\*\*/g, ''))
    const hit = ws.filter((w) => have.has(w)).length
    return hit / Math.max(1, ws.length) < 0.45
  })
  const covered = k.points.length - gaps.length
  const from = lectureCite(g, g.topic)
  const lines = [
    covered
      ? `Your notes cover ${covered} of the ${k.points.length} main ideas from the class.${cites.ref(hereCite(g))} What's missing:`
      : `Your notes are still thin next to the class.${cites.ref(hereCite(g))} The main ideas it covered:`,
    '',
  ]
  ;(gaps.length ? gaps : k.points).forEach((p) => lines.push(`- ${p}${cites.ref(from)}`))
  lines.push('', 'Add them below what you wrote, or keep them as a separate page.')
  return reply(readingStatus(g), lines.join('\n'), cites, [
    {
      type: 'create_page',
      title: `${clip(g.body.context.label ?? g.topic!.title, 40)}: what I missed`,
      subject_id: g.subject?.id ?? null,
      markdown: (gaps.length ? gaps : k.points).map((p) => `- ${p}`).join('\n'),
    },
  ])
}

function continueWriting(g: Ground): Reply {
  const cites = new Cites()
  const k = know(g.topic)
  const have = new Set(words(g.excerpt))
  const next = k?.points.find((p) => words(p).filter((w) => have.has(w)).length < 2)
  const body = k
    ? [
        next ? next.replace(/^\*\*(.+?)\*\*:?/, '$1:') : k.simple,
        '',
        `For example: ${k.example.split('. ').slice(0, 2).join('. ')}.`,
      ].join('\n')
    : `${keySentences(g.excerpt, 1)[0] ?? 'Pick up where you left off'}, and the next step follows from it: write down the one example the lecturer used, then the question it answers.`
  const text = [`Here's a next paragraph in your page's style:${cites.ref(hereCite(g))}`, '', body, '', 'Copy what fits, or save it as its own page.'].join('\n')
  return reply(readingStatus(g), text, cites, [
    { type: 'create_page', title: `${clip(g.body.context.label ?? 'Notes', 40)} (continued)`, subject_id: g.subject?.id ?? null, markdown: body },
  ])
}

/**
 * Readiness counts only what a check proved, so a deadline with nothing
 * checked says so rather than "you're 0% ready" (wave3-ux.md, Words).
 */
function readyLine(r: Readiness): string {
  return r.checked ? `you're **${readyWords(r.percent)}**` : 'nothing in it is checked yet'
}

type TopicReadiness = Readiness['topics'][number]

/**
 * The weakest first: a topic missed in a check, then one nothing has
 * checked yet, then the lowest proven percent.
 */
function weakFirst(a: TopicReadiness, b: TopicReadiness): number {
  const rank = (t: TopicReadiness) => (t.state === 'missed' ? 0 : t.percent === null ? 1 : 2)
  return rank(a) - rank(b) || (a.percent ?? -1) - (b.percent ?? -1)
}

function due(g: Ground): Reply {
  const cites = new Cites()
  const d = g.deadline
  if (!d) {
    const upcoming = g.store.deadlines.value
      .filter((x) => x.status === 'upcoming' && x.due_at && Date.parse(x.due_at) > g.now && (!g.subject || x.subject_id === g.subject.id))
      .slice(0, 5)
    if (!upcoming.length) return reply(readingStatus(g), 'Nothing is due in the weeks ahead. A good week to get ahead on reading.', cites)
    const lines = [`What's coming up${g.subject ? ` in ${g.subject.title}` : ''}:`, '']
    for (const x of upcoming) {
      const course = g.store.get('subjects', x.subject_id)
      const r = g.store.readinessOf(x)
      lines.push(`- **${x.title}**${!g.subject && course ? ` · ${course.title}` : ''}: ${dueLong(x)}, ${readyWords(r.checked ? r.percent : null)}${cites.ref(deadlineCite(x))}`)
    }
    const first = upcoming[0]!
    const qa = qaFor(g, first.topic_ids.map((id) => g.store.get('topics', id)).filter((t): t is Topic => !!t), 5)
    lines.push('', `${first.title} comes first. Want a quick round on it?`)
    return reply(readingStatus(g), lines.join('\n'), cites, qa.length ? [{ type: 'quiz', subject_id: first.subject_id, questions: qa.map((x) => ({ q: x.q, a: x.a })) }] : [])
  }

  const course = g.store.get('subjects', d.subject_id)
  const readiness = g.store.readinessOf(d)
  const lines = [
    `**${d.title}**${course ? ` (${course.title})` : ''} is ${dueLong(d)}${d.location ? ` in ${d.location}` : ''}${d.weight_pct ? `, worth ${d.weight_pct}% of the grade` : ''}.${cites.ref(deadlineCite(d))}`,
  ]
  if (d.scope_note) {
    const said = d.sources.find((x) => x.kind === 'transcript')
    const rec = said?.item_id ? g.store.get('items', said.item_id) : null
    const ref = rec
      ? cites.ref({ kind: 'item', id: rec.id, label: `${rec.title} · ${timecode(said!.at_seconds ?? 0)}`, at_seconds: said!.at_seconds ?? null, quote: said!.evidence, subject_id: rec.subject_id })
      : ''
    lines.push('', `It covers ${d.scope_note}.${ref}`)
  }
  if (readiness.topics.length) {
    const said = readyLine(readiness)
    lines.push('', `${said[0]!.toUpperCase()}${said.slice(1)}. Topic by topic:`, '')
    for (const t of [...readiness.topics].sort(weakFirst)) {
      const topic = g.store.get('topics', t.topic_id)
      lines.push(`- ${t.title}: ${readyWords(t.percent)}${cites.ref(lectureCite(g, topic))}`)
    }
    const weakest = [...readiness.topics].sort(weakFirst)[0]
    if (weakest) lines.push('', `**${weakest.title}** is where 20 minutes moves you most.`)
  }
  const topics = d.topic_ids.map((id) => g.store.get('topics', id)).filter((t): t is Topic => !!t)
  const qa = qaFor(g, topics, 5)
  const actions: AiAction[] = []
  if (qa.length) actions.push({ type: 'quiz', subject_id: d.subject_id, questions: qa.map((x) => ({ q: x.q, a: x.a })) })
  if (topics.length) {
    actions.push({
      type: 'create_board',
      title: `${d.title} revision map`,
      subject_id: d.subject_id,
      root: d.title,
      branches: topics.map((t) => ({ title: t.title, children: qaFor(g, [t], 2).map((x) => ({ title: clip(x.q, 42) })) })),
    })
  }
  return reply(readingStatus(g), lines.join('\n'), cites, actions)
}

function plan(g: Ground, today: boolean): Reply {
  const cites = new Cites()
  const store = g.store
  const name = store.userName.value || 'there'
  const todayKey = dayKey(g.now)
  const dueCards = store.cards.value.filter((c) => !c.suspended && Date.parse(c.due_at) <= g.now && (!g.subject || c.subject_id === g.subject.id))
  const upcoming = store.deadlines.value
    .filter((d) => d.status === 'upcoming' && d.due_at && Date.parse(d.due_at) > g.now && Date.parse(d.due_at) < g.now + 10 * 86_400_000 && (!g.subject || d.subject_id === g.subject.id))
    .slice(0, 3)
  const classes = store.sessions.value.filter((x) => dayKey(x.starts_at) === todayKey && !x.cancelled && Date.parse(x.ends_at) > g.now && (!g.subject || x.subject_id === g.subject.id))

  const tasks: { title: string; minutes: number; subject_id?: string | null }[] = []
  const lines: string[] = []

  if (today) {
    lines.push(`${greeting(g.now)}, ${name}. ${upcoming.length + (classes.length ? 1 : 0) > 1 ? 'Here\'s what matters today, in order:' : 'Here\'s what matters today:'}`, '')
    let n = 1
    for (const d of upcoming.slice(0, 2)) {
      const r = store.readinessOf(d)
      const weak = [...r.topics].sort(weakFirst)[0]
      const course = store.get('subjects', d.subject_id)
      lines.push(
        `${n++}. **${d.title}** (${course?.title ?? 'a course'}) is ${d.due_at ? whenLabel(d.due_at, d.all_day) : 'coming up'}, and ${readyLine(r)}.${cites.ref(deadlineCite(d))}${weak ? ` The weakest part is ${weak.title}: start there.` : ''}`,
      )
      tasks.push({ title: weak ? `${weak.title} for ${d.title}` : `Prepare for ${d.title}`, minutes: d.kind === 'lab' || d.kind === 'project' ? 45 : 25, subject_id: d.subject_id })
    }
    if (classes.length) {
      const c = classes[0]!
      const course = store.get('subjects', c.subject_id)
      const topic = c.topic_id ? store.get('topics', c.topic_id) : null
      lines.push(`${n++}. **${course?.title ?? ''} ${c.title.toLowerCase()}** at ${whenLabel(c.starts_at).split(' ').pop()}${c.location ? ` in ${c.location}` : ''}${topic ? `: ${topic.title}` : ''}. Five minutes with the slides before you go makes the class twice as useful.`)
    }
    if (dueCards.length) {
      lines.push(`${n++}. **${dueCards.length} cards** are due. A quick round keeps last week from fading.`)
      tasks.unshift({ title: `Review the ${dueCards.length} cards due`, minutes: Math.min(30, Math.max(10, Math.round(dueCards.length * 0.8))) })
    }
    if (n === 1) lines.push('Nothing is pressing. A good day to read ahead or write up last week\'s notes.')
    const minutes = tasks.reduce((a, t) => a + t.minutes, 0)
    if (tasks.length) lines.push('', `That's about ${minutes} minutes. I can put it on today's plan.`)
  } else {
    const course = g.subject?.title
    lines.push(`A week${course ? ` for ${course}` : ''} that gets you to ${upcoming[0]?.title ?? 'the end of the week'} ready, without cramming:`, '')
    const topics = g.subject
      ? taughtTopics(g, g.subject.id).sort((a, b) => store.topicSignalOf(a).percent - store.topicSignalOf(b).percent)
      : upcoming.flatMap((d) => d.topic_ids.map((id) => store.get('topics', id)).filter((t): t is Topic => !!t))
    for (let i = 0; i < 5; i++) {
      const key = shiftDay(todayKey, i)
      const day = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : relativeDay(key)
      const d = upcoming.find((x) => dayKey(x.due_at!) === key)
      const t = topics[i % Math.max(1, topics.length)]
      if (d) {
        lines.push(`- **${day}**: ${d.title} is due. Last look at ${t?.title ?? 'your notes'}, then hand it in.${cites.ref(deadlineCite(d))}`)
      } else if (t) {
        lines.push(`- **${day}** · 25 min: ${t.title}, cards then two practice questions.${cites.ref(lectureCite(g, t))}`)
        if (i === 0) tasks.push({ title: `${t.title}: cards and two questions`, minutes: 25, subject_id: t.subject_id })
      } else {
        lines.push(`- **${day}** · 20 min: review the cards that come due.`)
      }
    }
    if (dueCards.length && !tasks.some((t) => t.title.startsWith('Review'))) {
      tasks.unshift({ title: `Review the ${dueCards.length} cards due`, minutes: 15, subject_id: g.subject?.id ?? null })
    }
    lines.push('', 'Each day is short on purpose: four 25-minute days beat one four-hour night.')
  }

  const actions: AiAction[] = []
  if (tasks.length) actions.push({ type: 'add_tasks', date: todayKey, tasks: tasks.slice(0, 4) })
  if (today && upcoming[0]) {
    const topics = upcoming[0].topic_ids.map((id) => store.get('topics', id)).filter((t): t is Topic => !!t)
    const qa = qaFor(g, topics, 4)
    if (qa.length) actions.push({ type: 'quiz', subject_id: upcoming[0].subject_id, questions: qa.map((x) => ({ q: x.q, a: x.a })) })
  }
  return reply(today ? ['Checking today\'s classes and deadlines…'] : ['Looking at the week ahead…'], lines.join('\n'), cites, actions)
}

function toBranch(node: MapNode): AiMapBranch {
  return { title: node.text, children: node.children?.map(toBranch) }
}

function mapIt(g: Ground): Reply {
  const cites = new Cites()
  const ctx = boardContext(g.store, g.subject?.id ?? null, g.deadline?.id ?? null)
  const plan = g.subject ? planTopicMap(ctx, g.deadline ? 'deadline' : 'course') : null
  if (!plan) {
    if (g.topic && know(g.topic)) {
      const k = know(g.topic)!
      return reply(readingStatus(g), `**${g.topic.title}** as a map: the idea in the middle, its parts around it.${cites.ref(lectureCite(g, g.topic))}`, cites, [
        {
          type: 'create_board',
          title: `${g.topic.title} map`,
          subject_id: g.subject?.id ?? null,
          root: g.topic.title,
          branches: k.points.map((p) => ({ title: clip(p.replace(/\*\*/g, '').replace(/`/g, '').split(':')[0]!, 40) })),
        },
      ])
    }
    return reply(readingStatus(g), 'There\'s nothing to map yet: no classes have happened in this course. Once one has, I can lay out what it covered.', cites)
  }
  const branches = plan.root.children ?? []
  const lines = [
    `${plan.title}: ${plan.summary}`,
    '',
    ...branches.slice(0, 8).map((b) => {
      const topic = g.store.topics.value.find((t) => t.title === b.text && t.subject_id === g.subject!.id) ?? null
      return `- **${b.text}**${b.source ? ` (${b.source})` : ''}${b.hint ? `, ${b.hint}` : ''}${cites.ref(lectureCite(g, topic))}`
    }),
    '',
    'It goes on a new whiteboard, laid out as a mind map you can keep adding to.',
  ]
  return reply(readingStatus(g), lines.join('\n'), cites, [
    { type: 'create_board', title: plan.title, subject_id: g.subject?.id ?? null, root: plan.root.text, branches: branches.map(toBranch) },
  ])
}

/** A board next to its course: the taught topics that aren't on it yet. */
function boardGaps(g: Ground): Reply {
  const cites = new Cites()
  if (!g.subject) return summarise(g)
  const on = g.excerpt.toLowerCase()
  const gaps = taughtTopics(g, g.subject.id).filter((t) => !on.includes(t.title.toLowerCase()))
  if (!gaps.length) {
    return reply(readingStatus(g), `Every topic ${g.subject.title} has covered so far is on this board.${cites.ref(hereCite(g))} Nothing missing: the next thing worth adding is an example under each one.`, cites)
  }
  const lines = [
    `This board has most of ${g.subject.title}, but not these yet:${cites.ref(hereCite(g))}`,
    '',
    ...gaps.slice(0, 6).map((t) => `- **${t.title}**${cites.ref(lectureCite(g, t))}`),
    '',
    'I can put them on a map of their own, with what your cards say about each.',
  ]
  return reply(readingStatus(g), lines.join('\n'), cites, [
    {
      type: 'create_board',
      title: `${g.subject.title}: the rest`,
      subject_id: g.subject.id,
      root: g.subject.title,
      branches: gaps.slice(0, 6).map((t) => ({ title: t.title, children: qaFor(g, [t], 2).map((x) => ({ title: clip(x.q, 42) })) })),
    },
  ])
}

const PATHS: [RegExp, string[]][] = [
  [/python/, ['Variables and types', 'Conditions and loops', 'Functions', 'Lists and dictionaries', 'Files and errors', 'A small project']],
  [/sql|database/, ['Tables and keys', 'SELECT and WHERE', 'Joins', 'Grouping and aggregates', 'Designing a schema', 'A small project']],
  [/spanish|italian|french|german|english|japanese|korean|language/, ['Sounds and greetings', 'Present tense', 'Everyday words', 'Asking questions', 'The past', 'Holding a conversation']],
  [/statistic|probabilit/, ['Describing data', 'Probability', 'Distributions', 'Sampling', 'Hypothesis tests', 'Regression']],
  [/ielts|toefl|exam prep/, ['The exam, part by part', 'Reading strategies', 'Listening practice', 'Writing task 1', 'Writing task 2', 'Speaking and mocks']],
]

function course(g: Ground): Reply {
  const cites = new Cites()
  const m = g.text.match(/(?:learn|course (?:on|about|in|for)|teach me|study|get better at)\s+(.+?)(?:\s+(?:by|before|in|within)\s+.+)?[.?!]*$/i)
  const raw = (m?.[1] ?? g.text).replace(/^(about|the basics of|how to)\s+/i, '').trim()
  const goal = raw.charAt(0).toUpperCase() + raw.slice(1)
  const topics = PATHS.find(([re]) => re.test(g.lower))?.[1] ?? [`What ${raw} is`, 'The core ideas', 'Worked examples', 'Common mistakes', 'Practice set', 'A small project']
  const lines = [
    `Here's a course for **${goal}**, as a path you can walk a little each day:`,
    '',
    ...topics.map((t, i) => `${i + 1}. ${t}`),
    '',
    'Each step gets its own lesson with examples and a short quiz, written when you reach it. Add your own files or links on the next screen and the course is built around them.',
  ]
  return reply(['Sketching a path…'], lines.join('\n'), cites, [
    { type: 'create_course', title: goal, summary: null, finish_date: null, topics },
  ])
}

function lesson(g: Ground): Reply {
  const cites = new Cites()
  if (!g.topic) return general(g)
  if (g.topic.node_id) {
    return reply(readingStatus(g), `**${g.topic.title}** already has a lesson.${cites.ref(lectureCite(g, g.topic))} It's one tap away.`, cites, [
      { type: 'open', to: `/app/courses/${g.topic.subject_id}?open=lesson:${g.topic.node_id}`, label: `Open the ${g.topic.title} lesson` },
    ])
  }
  return reply(readingStatus(g), `I can write **${g.topic.title}** as a full lesson: explanation, worked examples and a short quiz at the end, built from your course's materials.${cites.ref(lectureCite(g, g.topic))}`, cites, [
    { type: 'write_lesson', topic_id: g.topic.id, title: g.topic.title },
  ])
}

function general(g: Ground): Reply {
  const cites = new Cites()
  const ctx = g.body.context
  const lines: string[] = []
  if (g.given.length) {
    const key = g.excerpt ? keySentences(g.excerpt, 3) : []
    if (key.length) {
      lines.push(`What stands out in ${g.about}:${cites.ref(hereCite(g))}`, '')
      key.forEach((s) => lines.push(`- ${s}`))
      lines.push('')
    }
    lines.push(
      'From here I can summarise it, quiz you on it, turn it into flashcards, a note or a mind map, or make a whole course from it. Say which, or ask me anything about it.',
    )
    return reply(readingStatus(g), lines.join('\n'), cites)
  }
  if (g.excerpt && g.body.scope === 'here') {
    const key = keySentences(g.excerpt, 3)
    lines.push(`From ${ctx.label ?? 'what\'s on screen'}:${cites.ref(hereCite(g))}`, '')
    key.forEach((s) => lines.push(`- ${s}`))
    lines.push('', 'Ask me to explain any line of it, quiz you, or turn it into cards or a note.')
    return reply(readingStatus(g), lines.join('\n'), cites)
  }
  const next = nextDeadline(g.store, g.subject?.id ?? null, g.now)
  const last = lastClass(g.store, g.subject?.id ?? null, g.now)
  const topic = last?.topic_id ? g.store.get('topics', last.topic_id) : null
  lines.push(
    g.subject
      ? `I can see everything in **${g.subject.title}**: its classes, your notes and cards, and what's due.`
      : 'I can see all your courses: the classes, your notes and cards, and every deadline.',
    '',
    'A few things I can do from here:',
    '',
  )
  if (next) lines.push(`- Tell you what's on **${next.title}** and quiz you for it${cites.ref(deadlineCite(next))}`)
  if (topic) lines.push(`- Explain **${topic.title}** from ${last!.title}${cites.ref(lectureCite(g, topic))}`)
  lines.push('- Plan your week around what\'s due', '- Turn a lesson or a page into flashcards or a mind map', '- Build a new course from a goal or your own files')
  return reply(readingStatus(g), lines.join('\n'), cites)
}

/* -- Attempt first ------------------------------------------------- */

/** Graded work, as the server's prompt reads it: the hand-in kinds. */
const GRADED = new Set<Deadline['kind']>(['assignment', 'lab', 'project', 'presentation'])

/**
 * The graded task a question is about: the one it names or that is on
 * screen, else the next one due in its course, else the next one due at all.
 */
function gradedTask(g: Ground): Deadline | null {
  if (g.deadline && GRADED.has(g.deadline.kind)) return g.deadline
  const open = g.store.deadlines.value
    .filter((d) => GRADED.has(d.kind) && d.status === 'upcoming' && d.due_at && Date.parse(d.due_at) > g.now)
    .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!))
  return open.find((d) => d.subject_id === g.subject?.id) ?? open[0] ?? null
}

function guardFor(d: Deadline): AiGuard {
  return { reason: 'graded', deadline_id: d.id, subject_id: null, title: d.title }
}

/** The topic of a graded task worth pointing at: the one the question names, else its first. */
function taskTopic(g: Ground, d: Deadline | null): Topic | null {
  if (!d) return g.topic
  if (g.topic && d.topic_ids.includes(g.topic.id)) return g.topic
  return d.topic_ids.map((id) => g.store.get('topics', id)).find((t): t is Topic => !!t) ?? g.topic
}

/**
 * "Solve question 3", "write my essay": the work is theirs to do, so the
 * answer says what to try and where in their own material to look, and
 * waits for the attempt. Explaining stays free; this is only the doing.
 */
function graded(g: Ground): Reply {
  const cites = new Cites()
  const d = gradedTask(g)
  const topic = taskTopic(g, d)
  const k = know(topic)
  const lines = [
    `Have a go at it first, and I'll go through it with you: what you work out yourself is what you'll still know at the exam.${d ? cites.ref(deadlineCite(d)) : ''}`,
    '',
    '**Try this first**',
    '',
    `1. Say in one sentence what you have to hand in${d?.scope_note ? ` (the brief: ${d.scope_note})` : ''}, and what you're given to start from.`,
    k?.qa?.[0]
      ? `2. Answer this for yourself before you start: *${k.qa[0][0]}*`
      : '2. Do the first step on your own, even if it\'s rough. A wrong first step is easier to fix than a blank page.',
  ]
  if (topic) lines.push(`3. If you get stuck, look back at **${topic.title}**${cites.ref(lectureCite(g, topic))}.`)
  lines.push('', 'Then send me what you have, typed or a photo of your working, and I\'ll tell you what holds and what to fix next.')
  return { ...reply(readingStatus(g), lines.join('\n'), cites), guard: d ? guardFor(d) : null }
}

/** "I'm stuck, show me": one step, the next one, never the hand-in. */
function stuck(g: Ground, before: AiGuard | null): Reply {
  const cites = new Cites()
  const d = before?.deadline_id ? g.store.get('deadlines', before.deadline_id) : null
  const topic = taskTopic(g, d)
  const rule = know(topic)?.points[0]
  const lines = rule
    ? [
        'The next step, and only that one: take the rule below and test your own work against it, line by line.',
        '',
        `> ${rule}`,
        '',
        `Where your work breaks it is what to fix first.${topic ? cites.ref(lectureCite(g, topic)) : ''} Send me what you get.`,
      ]
    : [
        'The next step, and only that one: write down what you\'re given and what you have to find, then do just the first line of working.',
        '',
        `It doesn't have to be right. Send me that line and I'll tell you if it holds.${topic ? cites.ref(lectureCite(g, topic)) : ''}`,
      ]
  return { ...reply(['Finding the next step…'], lines.join('\n'), cites), guard: before }
}

/**
 * "Check my attempt": feedback on what they sent, never a rewrite. The
 * sample can't mark working, so it reads the shape of it (is there a
 * reason, is there enough to judge) and says so plainly.
 */
function attempt(g: Ground, before: AiGuard | null): Reply {
  const cites = new Cites()
  const own = g.text.replace(/^check my attempt[:.\s]*/i, '').trim() || g.given.map((x) => x.text).join(' ').trim()
  const d = before?.deadline_id ? g.store.get('deadlines', before.deadline_id) : null
  const topic = taskTopic(g, d)
  const k = know(topic)
  if (!own) {
    const photo = g.given.some((x) => x.att.kind === 'file')
    return {
      ...reply(
        readingStatus(g),
        photo
          ? 'The sample can\'t read photos of working. Type a line or two of it here and I\'ll check it.'
          : 'Paste your working, or a photo of it, and I\'ll tell you what holds and what to fix next.',
        cites,
      ),
      guard: before,
    }
  }
  const count = own.split(/\s+/).length
  const first = sentencesOf(own)[0] ?? clip(own, 90)
  const gap =
    count < 15
      ? 'It\'s too short to check yet: it gives an answer, but not how you got there.'
      : !has(own.toLowerCase(), /\b(because|since|so|therefore|thus|which means)\b/)
        ? 'It says what, but not why. Each step needs its reason: which rule makes it true?'
        : k
          ? `Check it against the rule it rests on: ${k.points[0]}`
          : 'The last step jumps: say how it follows from the line before it.'
  const lines = [
    `**What holds:** it's in your own words, and it starts from what you know: “${clip(first, 90)}”`,
    '',
    `**The first thing that doesn't:** ${gap}`,
    '',
    `**Next step:** fix that one thing, then send it again.${topic ? ` If you're unsure, look back at **${topic.title}**${cites.ref(lectureCite(g, topic))}.` : ''}`,
  ]
  return { ...reply(['Reading your attempt…'], lines.join('\n'), cites), guard: before }
}

function compose(body: AiAskBody, history: AiMessage[]): Reply {
  const store = useCompanion()
  const g = resolve(body, store)
  // "Check my attempt" and "I'm stuck" answer the guarded question before
  // them, whatever their own words say, and keep its line.
  const before = [...history].reverse().find((m) => m.role === 'assistant')?.guard ?? null
  if (body.intent === 'attempt') return attempt(g, before)
  if (body.intent === 'stuck') return stuck(g, before)
  const answer = route(g)
  return g.given.length ? withMaterial(answer, g) : answer
}

/** "lecture-4.pdf [1], Normal forms [2] and your pasted text": what was read, cited. */
function readLine(g: Ground, cites: Cites): string {
  const parts = g.given.map((x) => {
    const a = x.att
    if (a.kind === 'text') return a.label.startsWith('Pasted text') ? 'your pasted text' : `**${a.label}**`
    if (a.kind === 'moodle') return `your **${a.label}** course on Moodle`
    if (a.kind === 'calendar') return `your calendar${a.url ? ` (${domainOf(a.url)})` : ''}`
    if (a.kind === 'link') return `**${a.label}**${a.url && domainOf(a.url) !== a.label ? ` (${domainOf(a.url)})` : ''}`
    return `**${a.label}**${cites.ref(x.cite)}`
  })
  const last = parts.pop()
  return `I read ${parts.length ? `${parts.join(', ')} and ${last}` : last}.`
}

/**
 * The answer, opened with what it read: the read line goes first, its
 * citations numbered first, and the answer's own `[n]`s moved up to follow
 * them. Material given without asking for a course is offered as one.
 */
function withMaterial(answer: Reply, g: Ground): Reply {
  const cites = new Cites()
  const line = readLine(g, cites)
  const map = answer.citations.map((c) => Number(cites.ref(c).replace(/\D/g, '')))
  const text = answer.text.replace(/ \[(\d{1,2})\]/g, (_m, n: string) => {
    const to = map[Number(n) - 1]
    return to ? ` [${to}]` : ''
  })
  const asked = answer.actions.some((a) => a.type === 'create_course' || a.type === 'draft_course')
  const label = g.given.length === 1 ? `Make a course from ${g.given[0]!.att.label}` : 'Make a course from these'
  return {
    ...answer,
    text: `${line}\n\n${text}`,
    citations: cites.list,
    actions: asked ? answer.actions : [...answer.actions, { type: 'draft_course', label }],
  }
}

function route(g: Ground): Reply {
  const q = g.lower
  // A message that is only material ("Have a look at these 3."): what's in it.
  if (g.given.length && has(q, /^(have|take) a look at\b/)) return g.excerpt ? summarise(g) : general(g)

  if (has(q, /\b(create|make|build|start|design)\b.{0,30}\bcourse\b|\bi want to learn\b|\bteach me .+ from (scratch|zero)\b|\bfrom scratch\b/)) return course(g)
  if (has(q, /\bwrite (a |the |this )?lesson\b|\bmake (a |the )?lesson\b/)) return lesson(g)
  if (has(q, /mind ?map|\bmap\b|whiteboard|diagram/) && !has(q, /what'?s missing/)) return mapIt(g)
  if (has(q, /flash ?cards?|\bcards\b|\banki\b/)) return cards(g)
  if (has(q, /focus (on )?today|what should i (do|study|focus)|\btoday\b.*\b(plan|do)\b/)) return plan(g, true)
  if (has(q, /\bplan\b|schedule|my week/)) return plan(g, false)
  if (has(q, /^(what'?s|what is) on\b|\bwhen is\b|\bwhat'?s (due|coming)|\bdeadlines?\b|\bdue\b/)) return due(g)
  // Doing graded work: attempt first. Asking what it means is still explaining.
  if (has(q, /\b(assignments?|homework|solve|write my|do my)\b/) && !has(q, /\bexplain\b/)) return graded(g)
  if (has(q, /\bquiz\b|test me|question me|check (me|my)|drill me|practice questions/)) return quiz(g)
  if (has(q, /what'?s missing/) && g.body.context.kind === 'board') return boardGaps(g)
  if (has(q, /what did i miss/)) return missed(g)
  if (has(q, /continue writing|keep writing|write the next/)) return continueWriting(g)
  if (has(q, /summar|key points|recap|tl;?dr|overview|into notes|what'?s missing/)) return summarise(g)
  if (has(q, /example/)) return example(g)
  if (has(q, /simpl|plain words|like i'?m|eli5/)) return explain(g, true)
  if (has(q, /explain|what is|what'?s|what are|how does|how do|why|mean|understand|tell me about/)) return explain(g, false)
  if (g.excerpt || g.topic) return explain(g, false)
  return general(g)
}

/* -- Streaming it ---------------------------------------------------------------------- */

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Stopped', 'AbortError'))
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Stopped', 'AbortError'))
      },
      { once: true },
    )
  })
}

interface DemoThread extends AiThread {
  messages: AiMessage[]
}
const threads = new Map<string, DemoThread>()
let serial = 0

/** Two or three words at a time, the way a model's tokens arrive. */
async function stream(text: string, on: AskHandlers, signal?: AbortSignal): Promise<void> {
  const pieces = text.match(/\S+\s*/g) ?? [text]
  for (let i = 0; i < pieces.length; i += 2 + (i % 3 === 0 ? 1 : 0)) {
    on.delta?.(pieces.slice(i, i + 2 + (i % 3 === 0 ? 1 : 0)).join(''))
    await wait(18 + (i % 5) * 6, signal)
  }
}

export async function demoAsk(body: AiAskBody, on: AskHandlers, signal?: AbortSignal): Promise<void> {
  // A question sent the moment a page opens (`/app/chat?q=`) can beat the
  // sample's own rows; answer from them, not from nothing.
  await useCompanion().load()
  const now = new Date().toISOString()
  let thread = body.thread_id ? threads.get(body.thread_id) : undefined
  if (!thread) {
    serial += 1
    thread = { id: `demo-thread-${serial}`, title: clip(body.message, 60), subject_id: body.context.subject_id ?? null, updated_at: now, messages: [] }
    threads.set(thread.id, thread)
  }
  const history = [...thread.messages]
  const user: AiMessage = {
    id: `demo-m-${++serial}`,
    role: 'user',
    text: body.message,
    quote: body.quote ?? null,
    // Kept whole (pasted text too): a later "make it 6 weeks" re-reads it, as the server does.
    attachments: body.attachments?.length ? body.attachments : undefined,
    created_at: now,
  }
  const id = `demo-m-${++serial}`
  on.start?.({ thread_id: thread.id, message_id: id })
  await wait(160, signal)

  let message: AiMessage
  // The proposer's stand-in is the proposal agent's; loaded only when it's wanted.
  const proposer = await import('./proposal').catch(() => null)
  if (proposer && proposer.demoWantsCourse(body, history)) {
    // Asked outright, the server writes no lead; asked in passing, the model says one line first.
    const lead =
      body.intent === 'course'
        ? ''
        : proposer.latestDraft(history)
          ? 'Redrawing the draft. '
          : 'I\'ll draft it as a course you can check before anything is made. '
    if (lead) {
      on.status?.('Reading what you asked…')
      await wait(420, signal)
      await stream(lead, on, signal)
    }
    on.proposal?.({ state: 'drafting' })
    const drafted = await proposer.demoProposeFromAsk(body, history, (step) => on.status?.(step.label, step), signal)
    on.proposal?.(drafted.proposal)
    if (lead) await stream(drafted.text, on, signal)
    message = { id, role: 'assistant', text: `${lead}${drafted.text}`, citations: [], actions: [], proposal: drafted.proposal, created_at: now }
    if (drafted.proposal.state === 'ready') thread.has_proposal = true
  } else {
    const answer = compose(body, history)
    message = { id, role: 'assistant', text: answer.text, citations: answer.citations, actions: answer.actions, guard: answer.guard ?? null, created_at: now }
    for (const status of answer.status) {
      on.status?.(status)
      await wait(520, signal)
    }
    await stream(answer.text, on, signal)
  }

  thread.messages.push(user, message)
  thread.updated_at = new Date().toISOString()
  on.done({ thread_id: thread.id, message })
}

export function demoThreads(): AiThread[] {
  return [...threads.values()]
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
    .map((t) => ({ id: t.id, title: t.title, subject_id: t.subject_id, updated_at: t.updated_at, has_proposal: Boolean(t.has_proposal) }))
}

export function demoRename(id: string, title: string): void {
  const thread = threads.get(id)
  if (thread) thread.title = title
}

export function demoThread(id: string): AiThread & { messages: AiMessage[] } {
  const thread = threads.get(id)
  if (!thread) throw new Error('That chat is gone: the sample forgets them when the tab closes.')
  return { ...thread, messages: thread.messages.map((m) => ({ ...m })) }
}

export function demoForget(id: string): void {
  threads.delete(id)
}

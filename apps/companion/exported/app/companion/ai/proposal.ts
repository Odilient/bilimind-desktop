/**
 * A course drafted inside the chat, from the draft to the course.
 *
 * Making a course used to be its own screen (`/app/new`): a composer, a
 * checklist, a review page. Now the learner says what they want in the one
 * chat, with whatever they have attached, and the answer carries the draft
 * (`AiMessage.proposal`, drawn by `components/companion/ai/Proposal.vue`).
 * This file is that card's logic, kept out of the SFC:
 *
 *  - what the thread gave the draft (`draftMaterial`): the files, notes,
 *    links and pasted text attached anywhere in the chat up to the draft,
 *    which are what the course is made with, and the line that says so
 *    (pressing Create is the learner choosing the course for them, so the
 *    files and notes move in, unless they keep them in My notes);
 *  - `createFromProposal`: through `POST /companion/courses` in a real
 *    account, through the store in the sample, then `settleCourse` (study
 *    times, pasted text kept as pages) either way. The rows land in the
 *    store at once, so the course is in the sidebar and Courses before the
 *    toast has finished sliding in;
 *  - edits made with Edit, written into the draft in place (the dock and the
 *    full-page chat draw the same message) and kept in sessionStorage, so a
 *    reload before Create doesn't lose them (the server only has the draft
 *    as it was proposed);
 *  - the sample's proposer (`demoProposeFromAsk`), which `ai/demo.ts` calls
 *    when the learner asks for a course: `create-demo.ts`'s reading of the
 *    sentence and the files, plus revisions ("make it 6 weeks", "drop
 *    joins", "call it SQL") applied to the draft before it, paced through
 *    the same work list the server sends.
 *
 * Nothing here imports the thread (`thread.ts`): demo.ts is loaded by the
 * client the thread uses, and a cycle there would load the demo for every
 * real account. The card hands its own message in.
 */
import { useCompanion, type CompanionStore } from '../store'
import type { Uuid } from '../types'
import {
  type Attachment,
  type CourseProposal,
  type TextAttachment,
  buildSteps,
  createLocally,
  domainOf,
  dueIso,
  freeColor,
  linkAttachment,
  moodleAttachment,
  settleCourse,
  splitMinutes,
  textAttachment,
} from '../create'
import { demoProposal, parseWhen } from '../create-demo'
import { dayKey, dayMonthLong, daysBetween, shiftDay } from '../time'
import { useApi } from '~/composables/useApi'
import type { AiAskBody, AiAttachment, AiMessage, AiProposal, AiStep } from './types'

/* -------------------------------------------------------------------------- */
/* Shape                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A draft made safe to draw and edit: every list there, a colour, a finish
 * line. The server's proposer is a model, and a model leaves things out.
 */
export function normaliseProposal(p: CourseProposal, colors: (string | null | undefined)[] = []): CourseProposal {
  return {
    title: p.title ?? '',
    kind: p.kind === 'school' ? 'school' : 'self',
    summary: p.summary ?? '',
    finish: {
      kind: p.finish?.kind ?? 'none',
      label: p.finish?.label ?? '',
      date: p.finish?.date ?? null,
    },
    minutes_per_week: p.minutes_per_week ?? (p.kind === 'school' ? null : 120),
    color: p.color ?? freeColor(colors),
    units: (p.units ?? []).map((u) => ({ title: u.title ?? '', topics: (u.topics ?? []).map((t) => ({ ...t })) })),
    deadlines: (p.deadlines ?? []).map((d) => ({ ...d })),
    sources: (p.sources ?? []).map((s) => ({ ...s })),
  }
}

/** What goes to the server: blank rows dropped, names trimmed, no time a week on a school course. */
export function cleanProposal(p: CourseProposal): CourseProposal {
  return {
    ...p,
    title: p.title.trim() || 'New course',
    summary: p.summary.trim(),
    finish: { ...p.finish, label: p.finish.label.trim(), date: p.finish.kind === 'none' ? null : (p.finish.date || null) },
    minutes_per_week: p.kind === 'school' ? null : (p.minutes_per_week ?? 120),
    units: p.units
      .filter((u) => u.title.trim() || u.topics.some((t) => t.title.trim()))
      .map((u, i) => ({
        title: u.title.trim() || `Unit ${i + 1}`,
        topics: u.topics.filter((t) => t.title.trim()).map((t) => ({ ...t, title: t.title.trim() })),
      })),
    deadlines: p.deadlines.filter((d) => d.title.trim()).map((d) => ({ ...d, title: d.title.trim() })),
  }
}

export function topicCount(p: CourseProposal): number {
  return p.units.reduce((n, u) => n + u.topics.length, 0)
}

/** "2 h a week", "1 h 30 a week", "45 min a week". */
export function paceWords(minutes: number | null): string {
  if (!minutes) return ''
  if (minutes < 60) return `${minutes} min a week`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h} h ${m} a week` : `${h} h a week`
}

/* -------------------------------------------------------------------------- */
/* What the chat gave the draft                                               */
/* -------------------------------------------------------------------------- */

/**
 * The attachments in the thread up to (and not after) a message, once each:
 * the proposer reads every attachment in the chat, so a file attached three
 * turns before "make me a course" is part of the course too.
 */
export function threadAttachments(messages: AiMessage[], uptoId?: string | null): AiAttachment[] {
  const seen = new Set<string>()
  const out: AiAttachment[] = []
  for (const m of messages) {
    if (uptoId && m.id === uptoId) break
    if (m.role !== 'user') continue
    for (const a of m.attachments ?? []) {
      const key = `${a.kind}:${a.item_id ?? a.url ?? a.subject_id ?? a.label}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(a)
    }
  }
  return out
}

export interface DraftMaterial {
  /** Uploaded in the chat: they move into the course (unless kept in Notes). */
  files: AiAttachment[]
  /** Links and calendar feeds: each becomes a link in the course. */
  links: { url: string; title: string }[]
  /** Pasted text still on this device: each is kept as a page in the course. */
  texts: TextAttachment[]
  /** Notes picked from Notes: they move in with the files, by the same press and the same toggle. */
  notes: AiAttachment[]
}

/** What a set of attachments puts into a course, by what happens to each. */
export function materialOf(attachments: AiAttachment[]): DraftMaterial {
  const out: DraftMaterial = { files: [], links: [], texts: [], notes: [] }
  for (const a of attachments) {
    if (a.kind === 'file' && a.item_id) out.files.push(a)
    else if (a.kind === 'note' && a.item_id) out.notes.push(a)
    else if ((a.kind === 'link' || a.kind === 'calendar') && a.url) {
      const title = a.kind === 'calendar' ? `Calendar · ${domainOf(a.url)}` : (a.label || domainOf(a.url))
      out.links.push({ url: a.url, title })
    } else if (a.kind === 'text' && a.text) out.texts.push(textAttachment(a.text))
  }
  return out
}

export function draftMaterial(messages: AiMessage[], messageId: string): DraftMaterial {
  return materialOf(threadAttachments(messages, messageId))
}

function listWords(parts: string[]): string {
  const xs = parts.filter(Boolean)
  if (xs.length < 2) return xs[0] ?? ''
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

/**
 * The card's line about what goes into the course, so the press on Create
 * is an informed one: "Your 2 files and 1 note move into the course",
 * "lecture-4.pdf and your link go into the course". With the files and
 * notes kept in My notes, it says that instead. Empty when the chat gave
 * nothing that moves.
 */
export function movesLine(m: DraftMaterial, keep: boolean): string {
  const n = m.files.length
  const k = m.notes.length
  const count = (x: number, one: string, many: string) => (x === 1 ? `1 ${one}` : `${x} ${many}`)
  // One thing is called by its name; more are counted, files first.
  const yours =
    n + k === 1
      ? (m.files[0] ?? m.notes[0])!.label
      : n && k
        ? `your ${count(n, 'file', 'files')} and ${count(k, 'note', 'notes')}`
        : n
          ? `your ${n} files`
          : k
            ? `your ${k} notes`
            : ''
  const bits: { words: string; many: boolean }[] = []
  if (yours && !keep) bits.push({ words: yours, many: n + k > 1 })
  if (m.links.length) bits.push({ words: m.links.length === 1 ? 'your link' : `${m.links.length} links`, many: m.links.length > 1 })
  if (m.texts.length) bits.push({ words: m.texts.length === 1 ? 'your pasted text' : `${m.texts.length} pasted texts`, many: m.texts.length > 1 })
  const lines: string[] = []
  if (yours && keep) {
    const kept = n + k === 1 ? `${yours} stays` : `Your ${n && k ? 'files and notes' : n ? 'files' : 'notes'} stay`
    lines.push(`${kept} in My notes.`)
  }
  if (bits.length) {
    const words = listWords(bits.map((b) => b.words)).replace(/^your/, 'Your')
    const many = bits.length > 1 || bits[0]!.many
    const onlyYours = bits.length === 1 && yours && !keep
    lines.push(`${words} ${onlyYours ? (many ? 'move' : 'moves') : many ? 'go' : 'goes'} into the course.`)
  }
  return lines.join(' ')
}

/* -------------------------------------------------------------------------- */
/* A newer draft                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Asking for a change in the chat drafts again, and the new draft hangs on
 * the new answer; the one before it folds to a line. A failed redraft
 * doesn't count (the last good draft is still the one to create), and a
 * draft already made into a course never folds: it is a link now.
 */
export function replacedBy(messages: AiMessage[], messageId: string): AiMessage | null {
  const at = messages.findIndex((m) => m.id === messageId)
  if (at < 0) return null
  for (let i = messages.length - 1; i > at; i--) {
    const m = messages[i]!
    if (m.role === 'assistant' && m.proposal && m.proposal.state !== 'failed') return m
  }
  return null
}

/** The latest draft still waiting for Create: what a revision changes. */
export function latestDraft(messages: AiMessage[]): AiMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!
    if (m.role !== 'assistant' || !m.proposal) continue
    if (m.proposal.state === 'ready' && m.proposal.proposal && !m.proposal.created) return m
    if (m.proposal.state !== 'failed') return null
  }
  return null
}

/* -------------------------------------------------------------------------- */
/* Edits kept across a reload                                                 */
/* -------------------------------------------------------------------------- */

const EDIT_KEY = 'bm:chat-draft:'

/** Edit's changes, into the draft in place (every surface draws this one message) and kept. */
export function applyEdit(message: AiMessage, next: CourseProposal): void {
  if (!message.proposal) return
  message.proposal.proposal = next
  try {
    sessionStorage.setItem(EDIT_KEY + message.id, JSON.stringify(next))
  } catch {
    // Private mode or full: the edit holds for this visit.
  }
}

/** A draft edited before a reload comes back edited. */
export function restoreEdit(message: AiMessage): void {
  const p = message.proposal
  if (!p || p.state !== 'ready' || p.created || message.id.startsWith('local-')) return
  try {
    const raw = sessionStorage.getItem(EDIT_KEY + message.id)
    if (raw) p.proposal = JSON.parse(raw) as CourseProposal
  } catch {
    // Nothing kept.
  }
}

function forgetEdit(id: string): void {
  try {
    sessionStorage.removeItem(EDIT_KEY + id)
  } catch {
    // Nothing kept.
  }
}

/* -------------------------------------------------------------------------- */
/* Create                                                                     */
/* -------------------------------------------------------------------------- */

export interface CreateOptions {
  /** The answer that carried the draft: the server marks it created, and so does this. */
  messageId: string
  /** What the chat gave the draft (`threadAttachments` up to the message). */
  attachments: AiAttachment[]
  /** The message itself, to mark `proposal.created` on at once. */
  message?: AiMessage | null
  /** "Keep in My notes": the files and notes are read, not moved. */
  keepFiles?: boolean
}

/**
 * Make the course. A real account posts the draft (the server makes the
 * goal, the course, its units and topics and deadlines, re-files the files and notes
 * and makes the links, and marks the message created) and pulls the rows;
 * the sample makes the same rows through the store. Both then settle what
 * only the client does: study times for a course of your own, and pasted
 * text kept as a page in the course.
 */
export async function createFromProposal(
  c: CompanionStore,
  proposal: CourseProposal,
  opts: CreateOptions,
): Promise<{ subjectId: Uuid; goalId: Uuid | null }> {
  const p = cleanProposal(proposal)
  const material = materialOf(opts.attachments)
  const itemIds = opts.keepFiles ? [] : [...material.files, ...material.notes].map((f) => f.item_id!)
  const links = material.links

  let subjectId: Uuid
  let goalId: Uuid | null
  if (c.status.mode === 'demo') {
    const made = await createLocally(c, p, { itemIds, links })
    subjectId = made.subjectId
    goalId = made.goalId
  } else {
    const made = await useApi().post<{ subject_id: Uuid; goal_id: Uuid }>('/companion/courses', {
      proposal: p,
      item_ids: itemIds,
      links: links.map((l) => l.url),
      ...(opts.messageId && !opts.messageId.startsWith('local-') ? { message_id: opts.messageId } : {}),
    })
    subjectId = made.subject_id
    goalId = made.goal_id ?? null
    await c.sync()
  }
  await settleCourse(c, subjectId, p, material.texts)
  void c.loadToday()

  if (opts.message?.proposal) {
    opts.message.proposal.created = { subject_id: subjectId, goal_id: goalId }
    opts.message.proposal.proposal = p
  }
  forgetEdit(opts.messageId)
  return { subjectId, goalId }
}

/* -------------------------------------------------------------------------- */
/* The sample's proposer                                                      */
/* -------------------------------------------------------------------------- */

/** A new course, said outright: "make me a course on…", "I want to learn…". */
const NEW_COURSE =
  /\b(create|make|build|start|design|draft|plan)\b.{0,24}\b(a|new|another|my|me a)\s+course\b|\bi (want|need|'d like|would like) to (learn|study|get better at|prepare for|revise for|pass)\b|\bteach me .+ from (scratch|zero)\b|\bfrom scratch\b/i

const CHANGE =
  /\b(make it|change|instead|shorter|longer|fewer|less|more time|more topics|more practice|add|include|drop|remove|skip|without|rename|call it|name it|move|push|faster|slower|sooner|easier|harder|deeper|basics)\b/i
const DURATION = /\b(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(day|week|month)s?\b/i
const PACE = /(\d+(?:\.\d)?)\s*(min(?:ute)?s?|h(?:ours?|rs?)?)\s*(?:a|per|each)\s*(day|week)/i
const KIND_SCHOOL = /\b(for (school|uni|university|class|college)|a (school|uni|university|college) course|my (class|module|lecture)s?)\b/i
const KIND_SELF = /\b(on my own|by myself|self[- ]?study|not for school|for fun|for myself)\b/i
const COUNT: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
}

function isRevision(text: string, hasDraft: boolean): boolean {
  if (!hasDraft) return false
  const t = text.trim()
  if (/\b(a|new|another)\s+course\b/i.test(t)) return false
  // A question about the draft ("what's a B1 exam like?") is answered, not drafted.
  if (/\?\s*$/.test(t) && !/^(can|could|would|will) you\b/i.test(t)) return false
  return CHANGE.test(t) || DURATION.test(t) || PACE.test(t) || KIND_SCHOOL.test(t) || KIND_SELF.test(t) || Boolean(parseWhen(t, dayKey()).date)
}

/**
 * Should the sample's answer draft a course? When the learner asked for one
 * outright (`intent: 'course'`, "make me a course on…", "I want to learn…"),
 * or asked to change the draft that is still waiting ("make it 6 weeks").
 */
export function demoWantsCourse(body: AiAskBody, history: AiMessage[]): boolean {
  if (body.intent === 'course') return true
  // Their working, or a press for the next step: never a course, whatever it says.
  if (body.intent === 'attempt' || body.intent === 'stuck') return false
  if (isRevision(body.message, Boolean(latestDraft(history)))) return true
  return NEW_COURSE.test(body.message)
}

/** The learner's sentence without the request around it: "Make a course on statistics by June" → "statistics by June". */
function topicSentence(text: string): string {
  return text
    .replace(/^\s*(please\s+)?(can|could|would) you\s+/i, '')
    .replace(/^\s*(please\s+)?(create|make|build|start|design|draft|plan)\s+(me\s+)?(a|my|the|new|another)?\s*(new\s+)?course\s*(for me\s*)?/i, '')
    .replace(/^(on|about|in|for|from|out of|with|around)\s+/i, '')
    .replace(/^(these|this|them|it|my (files|notes|slides|material))\b[\s,.]*/i, '')
    .replace(/^\s*please\b[\s,]*/i, '')
    .trim()
}

/** An attachment as the create screen's kind, which `demoProposal` reads. */
function asAttachment(c: CompanionStore, a: AiAttachment): Attachment | null {
  if ((a.kind === 'file' || a.kind === 'note') && a.item_id) {
    const item = c.get('items', a.item_id)
    if (a.kind === 'note' && item && item.kind !== 'file') {
      // A page or a board is read for its words: its title names it, its preview carries any dates.
      return { ...textAttachment(item.preview ?? item.title), title: item.title }
    }
    return {
      id: a.item_id,
      kind: 'file',
      file: null,
      name: item?.title || a.label,
      size: item?.meta.size ?? 0,
      mime: a.mime ?? item?.meta.mime ?? '',
      state: 'done',
      progress: 100,
      itemId: a.item_id,
      error: null,
      refused: false,
    }
  }
  if (a.kind === 'link' && a.url) return linkAttachment(a.url)
  if (a.kind === 'calendar' && a.url) return { id: crypto.randomUUID(), kind: 'calendar', url: a.url, domain: domainOf(a.url) }
  if (a.kind === 'text' && a.text) return textAttachment(a.text)
  if (a.kind === 'moodle' && a.subject_id) {
    const subject = c.get('subjects', a.subject_id)
    return subject ? moodleAttachment(c, subject) : null
  }
  return null
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Stopped', 'AbortError'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Stopped', 'AbortError'))
    }, { once: true })
  })
}

/** Each step lit, then ticked, at about the pace the real proposer reports them. */
async function walk(steps: { key: string; label: string }[], onStep: (s: AiStep) => void, signal?: AbortSignal): Promise<void> {
  for (const [i, s] of steps.entries()) {
    onStep({ key: s.key, label: s.label, state: 'active' })
    await wait(i === steps.length - 1 ? 900 : 520 + Math.round(Math.random() * 420), signal)
    onStep({ key: s.key, label: s.label, state: 'done' })
  }
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** "your link", "3 links", or nothing. */
function words(n: number, one: string, many: string): string {
  return n ? (n === 1 ? one : `${n} ${many}`) : ''
}

/** Minutes a week that fit so many topics into so many weeks (about 45 minutes a topic), in half hours. */
function fitMinutes(topics: number, weeks: number): number {
  const need = (topics / Math.max(1, weeks)) * 45
  return Math.min(600, Math.max(60, Math.ceil(need / 30) * 30))
}

function sameWords(a: string, b: string): boolean {
  const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length >= 3)
  const want = words(b)
  if (!want.length) return false
  const have = new Set(words(a))
  return want.every((w) => have.has(w) || [...have].some((h) => h.startsWith(w) || w.startsWith(h)))
}

/** A date moved in proportion: the old span from today stretched (or squeezed) to the new one. */
function rescale(iso: string, today: string, from: number, to: number): string {
  const day = iso.slice(0, 10)
  const at = Math.max(1, Math.round((daysBetween(today, day) * to) / Math.max(1, from)))
  return `${shiftDay(today, at)}${iso.slice(10)}`
}

interface Revised {
  proposal: CourseProposal
  said: string[]
}

/**
 * A change asked for in the chat, applied to the draft before it. The
 * sample reads the handful of changes people actually ask for; what the
 * real proposer can do (anything) is a superset.
 */
function revise(prev: CourseProposal, text: string, today: string): Revised {
  const p = normaliseProposal(prev)
  const said: string[] = []
  const t = text.trim()

  const named = t.match(/\b(?:call|name|rename)\s+it\s+(?:to\s+)?["“']?(.+?)["”']?[.!]*$/i)
  if (named?.[1]) {
    p.title = named[1].trim().replace(/^./, (ch) => ch.toUpperCase()).slice(0, 56)
    said.push(`renamed it **${p.title}**`)
  }

  if (KIND_SCHOOL.test(t) && p.kind !== 'school') {
    p.kind = 'school'
    p.minutes_per_week = null
    said.push('made it a school course, by week')
  } else if (KIND_SELF.test(t) && p.kind !== 'self') {
    p.kind = 'self'
    p.minutes_per_week = p.minutes_per_week ?? 120
    said.push('made it a course of your own, along a path')
  }

  // The finish line: "6 weeks", "in 3 months", "by March", "on 14 December", "faster", "slower".
  const oldDate = p.finish.kind !== 'none' ? p.finish.date : null
  let newDate: string | null = null
  // "3 hours a week" is a pace, not a finish line: read durations without it.
  const bare = t.replace(PACE, ' ')
  const span = bare.match(DURATION)
  const when = parseWhen(bare, today)
  // "Add 2 weeks", "another month": longer than it is, not that long from today.
  const extend = bare.match(/\b(?:add|another|extra|give it)\s+(?:(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*)?(?:more\s+)?(day|week|month)s?\b/i)
  const daysIn = (n: string | undefined, unit: string) =>
    ({ day: 1, week: 7, month: 30 }[unit.toLowerCase() as 'week'] ?? 7) * (!n ? 1 : /^\d+$/.test(n) ? +n : (COUNT[n.toLowerCase()] ?? 1))
  if (extend) newDate = shiftDay(oldDate ?? today, daysIn(extend[1], extend[2]!))
  else if (when.date && !/^\s*(make it|in|over|within|take|just|only)?\s*\d+\s*(day|week|month)/i.test(when.phrase ?? '')) newDate = when.date
  else if (span) {
    newDate = shiftDay(today, daysIn(span[1], span[2]!))
  } else if (oldDate && /\b(faster|sooner|quicker)\b/i.test(t)) {
    newDate = shiftDay(today, Math.max(7, Math.round(daysBetween(today, oldDate) * 0.7)))
  } else if (oldDate && /\b(slower|more time)\b/i.test(bare)) {
    newDate = shiftDay(today, Math.round(daysBetween(today, oldDate) * 1.4))
  }
  let moved = -1
  if (newDate && newDate !== oldDate) {
    if (p.finish.kind === 'none') Object.assign(p.finish, { kind: 'date', label: 'Finish line' })
    p.finish.date = newDate
    const from = oldDate ? daysBetween(today, oldDate) : 0
    const to = daysBetween(today, newDate)
    if (from > 0) {
      p.deadlines = p.deadlines.map((d) => (d.due_at ? { ...d, due_at: rescale(d.due_at, today, from, to) } : d))
    } else {
      p.deadlines.push({ title: p.finish.label || 'Finish line', kind: 'milestone', due_at: dueIso(newDate), weight_pct: null })
    }
    const weeks = Math.round(to / 7)
    moved = said.push(`${weeks >= 2 ? `${weeks} weeks` : `${to} days`} now, finishing on ${dayMonthLong(newDate)}`) - 1
  }

  // Things out: "drop joins", "remove the mock exam", "without speaking", "skip unit 3".
  const out = t.match(/\b(?:drop|remove|skip|cut|without|leave out|no more)\s+(?:the\s+)?(.+?)(?:\s+(?:unit|topic|part|section)s?)?[.!]*$/i)?.[1]
  if (out) {
    // "drop joins and subqueries": each named thing on its own.
    const names = out.split(/\s*(?:,|\band\b|&)\s*/).filter(Boolean)
    const hit = (title: string) => names.some((n) => sameWords(title, n))
    const gone: string[] = []
    p.units = p.units
      .filter((u) => {
        if (hit(u.title)) {
          gone.push(u.title)
          return false
        }
        return true
      })
      .map((u) => ({
        ...u,
        topics: u.topics.filter((x) => {
          if (hit(x.title)) {
            gone.push(x.title)
            return false
          }
          return true
        }),
      }))
      .filter((u) => u.topics.length)
    p.deadlines = p.deadlines.filter((d) => {
      if (hit(d.title)) {
        gone.push(d.title)
        return false
      }
      return true
    })
    if (gone.length) said.push(`took out ${listWords(gone.slice(0, 3).map((g) => `**${g}**`))}${gone.length > 3 ? ` and ${gone.length - 3} more` : ''}`)
  }

  // Things in: "add window functions", "include a unit on statistics".
  const add = t.match(/\b(?:add|include|also cover|cover)\s+(?:a\s+)?(?:unit|topic|lesson|part)?\s*(?:on|about)?\s*(.+?)[.!]*$/i)?.[1]
  if (add && !/^(more|some|a few|another|extra|\d+\s*(day|week|month))\b/i.test(add) && !named && !extend) {
    const title = add.trim().replace(/^./, (ch) => ch.toUpperCase()).slice(0, 64)
    const best = p.units.findIndex((u) => u.topics.some((x) => sameWords(x.title, title)) || sameWords(u.title, title))
    const closing = (u: { title: string }) => /review|exam|mock|portfolio|project|stick/i.test(u.title)
    const at = best >= 0 ? best : Math.max(0, p.units.findIndex(closing) > 0 ? p.units.findIndex(closing) - 1 : p.units.length - 1)
    if (!p.units.length) p.units.push({ title: 'Your topics', topics: [] })
    p.units[at]!.topics.push({ title })
    said.push(`added **${title}** to ${p.units[at]!.title}`)
  }

  // Lighter or heavier.
  if (/\b(shorter|fewer|lighter|easier|just the basics|basics only|less)\b/i.test(t) && !out && !newDate) {
    const before = topicCount(p)
    p.units = p.units.map((u) => ({ ...u, topics: u.topics.slice(0, Math.max(2, Math.ceil(u.topics.length * 0.6))) }))
    said.push(`trimmed it from ${before} to ${topicCount(p)} topics`)
  } else if (/\b(longer|deeper|harder|more topics|more depth|in depth|advanced)\b/i.test(t) && !add) {
    p.units.push({ title: 'Going further', topics: [{ title: 'Harder problems' }, { title: 'Connecting the ideas' }, { title: 'A project of your own' }] })
    said.push('added a unit, **Going further**')
  }

  // Time a week: said ("3 hours a week", "30 minutes a day"), or refitted to a new finish line.
  const pace = t.match(PACE)
  if (pace && p.kind === 'self') {
    const n = +pace[1]! * (/^h/i.test(pace[2]!) ? 60 : 1)
    p.minutes_per_week = Math.round(pace[3]!.toLowerCase() === 'day' ? n * 5 : n)
    said.push(`set your time to ${paceWords(p.minutes_per_week)}`)
  } else if (newDate && p.kind === 'self') {
    const fit = fitMinutes(topicCount(p), daysBetween(today, newDate) / 7)
    if (fit !== p.minutes_per_week) {
      p.minutes_per_week = fit
      // Said with the new finish line it follows from: "6 weeks now, …, at about 5 h a week".
      if (moved >= 0) said[moved] += `, at about ${paceWords(fit)}`
      else said.push(`set your time to ${paceWords(fit)}`)
    }
  }

  p.deadlines.sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
  return { proposal: p, said }
}

/** The first thing the learner said in the chain of drafts: what a re-read with new files starts from. */
function firstAsk(history: AiMessage[]): string {
  for (let i = 0; i < history.length; i++) {
    const m = history[i]!
    if (m.role === 'user' && history[i + 1]?.proposal) return topicSentence(m.text)
  }
  return ''
}

/**
 * The sample's answer to "make me a course": the work list paced through
 * `onStep`, then the draft (ready, or failed with the reason) and the short
 * sentence the answer says above it.
 *
 * `history` is the thread before this turn: user messages with their
 * attachments, answers with their drafts. A change to the waiting draft is
 * applied to it ("make it 6 weeks"); new files with it are read in and the
 * path redrawn around them; anything else is a fresh draft from the
 * sentence and every attachment in the chat.
 */
export async function demoProposeFromAsk(
  body: AiAskBody,
  history: AiMessage[],
  onStep: (step: AiStep) => void,
  signal?: AbortSignal,
): Promise<{ proposal: AiProposal; text: string }> {
  const c = useCompanion()
  await c.load()
  const today = dayKey()
  const term = c.termGoal.value
  const colors = c.subjects.value.map((s) => s.color)
  const before = latestDraft(history)
  const fresh = (body.attachments ?? []).map((a) => asAttachment(c, a)).filter((a): a is Attachment => Boolean(a))
  const all = [...threadAttachments(history), ...(body.attachments ?? [])]
  const material = all
    .filter((a, i) => all.findIndex((b) => `${b.kind}:${b.item_id ?? b.url ?? b.subject_id ?? b.label}` === `${a.kind}:${a.item_id ?? a.url ?? a.subject_id ?? a.label}`) === i)
    .map((a) => asAttachment(c, a))
    .filter((a): a is Attachment => Boolean(a))

  /* -- A change to the draft that's waiting ------------------------------ */
  if (before?.proposal?.proposal && isRevision(body.message, true)) {
    await walk(
      [
        { key: 'ask', label: 'Reading what you asked' },
        ...(fresh.length ? buildSteps('', fresh).slice(0, -3) : []),
        { key: 'path', label: 'Redrawing your path' },
        { key: 'pace', label: 'Fitting it into your week' },
      ],
      onStep,
      signal,
    )
    let base = before.proposal.proposal
    if (fresh.length) {
      // New material with the change: read it in, keep the name and choices the learner made.
      const reread = demoProposal({ text: firstAsk(history), attachments: material, colors, today, termEnd: term?.exam_period?.starts_on ?? term?.ends_on ?? null })
      base = { ...reread, title: base.title, kind: base.kind, color: base.color, minutes_per_week: base.minutes_per_week, finish: base.finish }
    }
    const { proposal, said } = revise(base, body.message, today)
    const text = said.length
      ? `Done: ${listWords(said)}. Press **Create course** when it looks right, or keep telling me what to change.`
      : `I couldn't tell what to change, so the draft is as it was. Try "make it 6 weeks", "drop joins" or "call it SQL", or press **Edit**.`
    return { proposal: { state: 'ready', proposal }, text }
  }

  /* -- A fresh draft ------------------------------------------------------- */
  const sentence = topicSentence(body.message)
  if (!sentence && !material.length) {
    await walk([{ key: 'sentence', label: 'Reading what you wrote' }], onStep, signal)
    return {
      proposal: { state: 'failed', error: 'There was nothing to build a course from. Say what you want to learn, or attach your slides or syllabus.' },
      text: 'Tell me what you want to learn, or attach what you have, and I\'ll draft the course.',
    }
  }
  await walk(buildSteps(sentence, material), onStep, signal)
  const proposal = demoProposal({ text: sentence, attachments: material, colors, today, termEnd: term?.exam_period?.starts_on ?? term?.ends_on ?? null })

  const files = material.filter((a) => a.kind === 'file')
  const unread = files.filter((f) => f.kind === 'file' && !proposal.sources.some((s) => s.kind === 'file' && s.label === f.name))
  const from = listWords([
    sentence ? 'what you wrote' : '',
    files.length ? (files.length === 1 ? (files[0] as { name: string }).name : `${files.length} files`) : '',
    words(material.filter((a) => a.kind === 'link' || a.kind === 'calendar').length, 'your link', 'links'),
    material.some((a) => a.kind === 'text') ? 'your pasted text' : '',
    material.some((a) => a.kind === 'moodle') ? 'your Moodle course' : '',
  ])
  const topics = topicCount(proposal)
  const facts = listWords([
    plural(proposal.units.length, 'unit'),
    plural(topics, 'topic'),
    proposal.deadlines.length ? plural(proposal.deadlines.length, 'deadline') : '',
  ])
  const pace = proposal.minutes_per_week ? `, at about ${paceWords(proposal.minutes_per_week)}` : ''
  const lines = [
    `Here's a draft for **${proposal.title}**${from ? `, from ${from}` : ''}: ${facts}${pace}.`,
    unread.length ? `I couldn't open ${listWords(unread.map((u) => (u as { name: string }).name))}, so the draft leaves ${unread.length === 1 ? 'it' : 'them'} out.` : '',
    `Change anything with **Edit**, or tell me here ("make it 6 weeks").`,
  ]
  return { proposal: { state: 'ready', proposal }, text: lines.filter(Boolean).join(' ') }
}

/** For a school course with no time a week, the sessions line has nothing to say. */
export function sessionsLine(p: CourseProposal): string {
  if (p.kind === 'school' || !p.minutes_per_week) return ''
  const { sessions, minutes } = splitMinutes(p.minutes_per_week)
  return `${sessions} sessions of ${minutes} min`
}

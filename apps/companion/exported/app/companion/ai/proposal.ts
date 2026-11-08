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
 *  - `createFromProposal`: through `POST /companion/courses`, then
 *    `settleCourse` (study times, pasted text kept as pages). The rows land in the
 *    store at once, so the course is in the sidebar and Courses before the
 *    toast has finished sliding in;
 *  - edits made with Edit, written into the draft in place (the dock and the
 *    full-page chat draw the same message) and kept in sessionStorage, so a
 *    reload before Create doesn't lose them (the server only has the draft
 *    as it was proposed).
 *
 * Nothing here imports the thread (`thread.ts`); the card hands its own
 * message in.
 */
import type { CompanionStore } from '../store'
import type { Uuid } from '../types'
import {
  type CourseProposal,
  type TextAttachment,
  domainOf,
  freeColor,
  settleCourse,
  splitMinutes,
  textAttachment,
} from '../create'
import { useApi } from '~/composables/useApi'
import type { AiAttachment, AiMessage } from './types'

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
 * and makes the links, and marks the message created) and pulls the rows,
 * then settles what only the client does: study times for a course of your
 * own, and pasted text kept as a page in the course.
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

  const made = await useApi().post<{ subject_id: Uuid; goal_id: Uuid }>('/companion/courses', {
    proposal: p,
    item_ids: itemIds,
    links: links.map((l) => l.url),
    ...(opts.messageId && !opts.messageId.startsWith('local-') ? { message_id: opts.messageId } : {}),
  })
  const subjectId = made.subject_id
  const goalId = made.goal_id ?? null
  await c.sync()
  await settleCourse(c, subjectId, p, material.texts)
  void c.loadToday()

  if (opts.message?.proposal) {
    opts.message.proposal.created = { subject_id: subjectId, goal_id: goalId }
    opts.message.proposal.proposal = p
  }
  forgetEdit(opts.messageId)
  return { subjectId, goalId }
}

/** For a school course with no time a week, the sessions line has nothing to say. */
export function sessionsLine(p: CourseProposal): string {
  if (p.kind === 'school' || !p.minutes_per_week) return ''
  const { sessions, minutes } = splitMinutes(p.minutes_per_week)
  return `${sessions} sessions of ${minutes} min`
}

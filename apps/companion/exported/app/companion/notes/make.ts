/**
 * Making a page or a whiteboard from code: the one way every screen does it.
 *
 * Notes' own buttons, the template tiles, `/app/p/new` and `/app/b/new`, the
 * AI's "Save as note" and "Make a mind map" cards, the palette and Today all
 * come through here, so a page is made the same way wherever it was asked
 * for: an id made on this device (it works offline), the row written through
 * the store (the sidebar and the course lists show it at once, and offline it
 * waits in the outbox), and the body poured in the first time the page opens
 * (`usePageEditor`), the path every seeded page takes.
 *
 *   const id = await makePage({ template: 'lecture' })              // My notes
 *   const id = await makePage({ subjectId: course.id, title: 'Ideas' }) // in that course, on purpose
 *   const id = await makeBoard({ template: 'mindmap', parentId: pageId })
 *
 * Nothing is filed by guessing. A note goes to My notes (the notes that
 * aren't in a course) unless the caller passes `subjectId` because the
 * learner pressed a control that names the course: the course page's own
 * "+ New page in Databases", a folder's "+", "Take notes" on a class's card.
 * The round-1 rule (file it under the class on now, else the course on
 * screen) put notes in courses nobody asked for, and the learner called it
 * the wrong design.
 *
 * The guess survives as a question. When there is an obvious course (made
 * during its class, or with it open: `onScreen`), the note keeps it in
 * `meta.suggested_subject_id` and its header offers one quiet chip, "Add to
 * Databases?". One tap files it, ✕ forgets it (`actions.ts`). A page made
 * under another (`parentId`) lives where its parent does, so a sub-page
 * never lands in a different course from the page it hangs off.
 */
import type { Item } from '../types'
import { useCompanion, type CompanionStore } from '../store'
import { fileTarget } from '../capture'
import { contextFrom } from '../doc/context'
import { isTemplateKey, templateTitle as pageTitle } from '../doc/templates'
import { makeBoard as makeTemplateBoard } from '../board/make'
import { boardContext } from '../board/context'
import { buildBoard, TEMPLATES as BOARD_TEMPLATES, type TemplateName } from '../board/templates'
import { boardParts, newUuid, writeMeta } from '../board/model'
import { boardPreview, newMindRoot } from '../board/ops'
import { courseHex } from '../board/palette'
import { seedBoard } from '../board/persistence'

export interface MakePageInput {
  /** The course, when the control pressed named it. Left out or `null`: My notes. */
  subjectId?: string | null
  sessionId?: string | null
  topicId?: string | null
  /** The page it sits under; its course, class and topic come with it. */
  parentId?: string | null
  /** Left out, the template names it ("Lecture 8 · Transactions"), or it starts untitled. */
  title?: string | null
  /** A page template key (`lecture`, `cornell`, `reading`, `vocab`, `lab`, `blank`). */
  template?: string | null
  /** The first content, as HTML: an AI answer saved as a note, a pasted passage. */
  seedHtml?: string | null
  /** The course on screen: the suggestion's second guess after the class on now. Never files. */
  onScreen?: string | null
  /** `false`: no "Add to …?" suggestion on it either. */
  suggest?: boolean
}

export interface MakeBoardInput {
  subjectId?: string | null
  sessionId?: string | null
  topicId?: string | null
  parentId?: string | null
  title?: string | null
  /** `blank`, `revision`, `concept`, `kanban`, or `mindmap` (a board with one root, named for it). */
  template?: string | null
  /** The assessment a revision map or a project board is for. */
  deadlineId?: string | null
  onScreen?: string | null
  suggest?: boolean
}

/** Where a new note goes, resolved to rows. */
export interface NoteWhere {
  subject_id: string | null
  session_id: string | null
  topic_id: string | null
}

/** The course a note made right now probably belongs to, said in words: only ever asked about. */
export interface NoteSuggestion {
  subject_id: string
  session_id: string | null
  /** "Databases · Lecture 8", "Databases". */
  label: string
  /** "in class now", "the course you have open". */
  reason: string
  color: string | null
}

/**
 * The course a note made right now most likely belongs to: the class on now
 * (or just over, or about to start), else the course on screen. Null when
 * nothing is obvious. It never decides where a note goes; it is the "Add to
 * Databases?" the note's header asks.
 */
export function suggestWhere(
  store: CompanionStore,
  onScreen: string | null = null,
  now = Date.now(),
): NoteSuggestion | null {
  const target = fileTarget(store, onScreen, now)
  if (!target.subject) return null
  return {
    subject_id: target.subject.id,
    session_id: target.session?.id ?? null,
    label: target.session ? `${target.subject.title} · ${target.session.title}` : target.subject.title,
    reason: target.reason,
    color: target.subject.color,
  }
}

interface Resolved {
  where: NoteWhere
  /** The suggestion's fields for the row's `meta`, when it's in My notes and something was obvious. */
  suggested: Pick<Item['meta'], 'suggested_subject_id' | 'suggested_session_id'>
}

function resolveWhere(store: CompanionStore, input: MakePageInput | MakeBoardInput): Resolved {
  const parent = input.parentId ? store.get('items', input.parentId) : null
  if (parent) {
    return {
      where: {
        subject_id: parent.subject_id,
        session_id: input.sessionId ?? parent.session_id,
        topic_id: input.topicId ?? parent.topic_id,
      },
      suggested: {},
    }
  }
  if (input.subjectId || input.sessionId) {
    // Said outright (a class picked: its course follows from it).
    const session = store.get('sessions', input.sessionId)
    const subjectId = input.subjectId ?? session?.subject_id ?? null
    return {
      where: {
        subject_id: subjectId,
        session_id: session && session.subject_id === subjectId ? session.id : null,
        topic_id: subjectId ? (input.topicId ?? session?.topic_id ?? null) : null,
      },
      suggested: {},
    }
  }
  // My notes. The obvious course, if any, is kept to be asked about.
  const guess = input.suggest === false ? null : suggestWhere(store, input.onScreen ?? null)
  return {
    where: { subject_id: null, session_id: null, topic_id: null },
    suggested: guess ? { suggested_subject_id: guess.subject_id, suggested_session_id: guess.session_id } : {},
  }
}

/** The end of the list it joins: new things go at the bottom, as they do in Notion. */
export function nextPosition(store: CompanionStore, subjectId: string | null, parentId: string | null): number {
  const siblings = store.items.value.filter(
    (i) => !i.deleted_at && i.subject_id === subjectId && (i.parent_id ?? null) === parentId,
  )
  return siblings.reduce((max, i) => Math.max(max, i.position + 1), 0)
}

/** The words of an HTML fragment, for the row's `preview` before the page is ever opened. */
function plainText(html: string): string {
  let text = html
  if (import.meta.client && typeof DOMParser !== 'undefined') {
    text = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
  } else {
    text = html.replace(/<[^>]+>/g, ' ')
  }
  return text.replace(/\s+/g, ' ').trim()
}

/* -- Just made --------------------------------------------------------------- */

/**
 * Pages made a moment ago on this device. The editor asks once
 * (`takeJustMade`) and, for one of these, starts with the cursor in the
 * title, so a new page can be named before anything else.
 */
const justMade = new Set<string>()

export function takeJustMade(id: string): boolean {
  return justMade.delete(id)
}

/* -- Pages ------------------------------------------------------------------- */

export async function makePage(input: MakePageInput = {}): Promise<string> {
  const store = useCompanion()
  await store.load()
  const { where, suggested } = resolveWhere(store, input)
  const template = isTemplateKey(input.template) ? input.template : 'blank'
  const ctx = contextFrom(store, where)
  const seed = input.seedHtml?.trim() || null
  const parentId = input.parentId && store.get('items', input.parentId) ? input.parentId : null
  const id = crypto.randomUUID()
  const item: Item = {
    id,
    ...where,
    parent_id: parentId,
    kind: 'page',
    title: input.title?.trim() || pageTitle(template, ctx),
    preview: seed ? plainText(seed).slice(0, 240) || null : null,
    // `fresh`: it starts as the bare template, never as its preview line;
    // `seed_html` (when given) is what it starts with instead.
    meta: { template, props: { fresh: true }, ...(seed ? { seed_html: seed } : {}), ...suggested },
    source: 'made',
    source_ref: null,
    position: nextPosition(store, where.subject_id, parentId),
    pinned: false,
  }
  justMade.add(id)
  try {
    await store.upsert<Item>('items', item)
  } catch (error) {
    justMade.delete(id)
    throw error
  }
  return id
}

/* -- Whiteboards ------------------------------------------------------------- */

export type BoardTemplate = TemplateName | 'mindmap'

export function isBoardTemplate(value: unknown): value is BoardTemplate {
  return value === 'mindmap' || (BOARD_TEMPLATES as readonly string[]).includes(String(value))
}

export async function makeBoard(input: MakeBoardInput = {}): Promise<string> {
  const store = useCompanion()
  await store.load()
  // A board for an assessment was asked for from that assessment: its
  // course is named by the button, so it goes there.
  const deadline = store.get('deadlines', input.deadlineId)
  const { where, suggested } = resolveWhere(
    store,
    deadline && input.subjectId === undefined && !input.sessionId && !input.parentId
      ? { ...input, subjectId: deadline.subject_id }
      : input,
  )
  const template: BoardTemplate = isBoardTemplate(input.template) ? input.template : 'blank'
  const parentId = input.parentId && store.get('items', input.parentId) ? input.parentId : null
  if (template !== 'mindmap') {
    // The templates (a revision map around the next quiz, a concept map of the
    // course's topics) are built whole and seeded once by `board/make`.
    const board = await makeTemplateBoard(store, template, {
      subject_id: where.subject_id,
      session_id: where.session_id,
      topic_id: where.topic_id,
      parent_id: parentId,
      deadline_id: input.deadlineId ?? null,
      title: input.title ?? null,
      exact: true,
      meta: suggested,
    })
    return board.id
  }
  // A mind map: one root in the middle, named for what it's about, ready for
  // Tab to add a branch. The same starter an unopened board gets, made now.
  const ctx = boardContext(store, where.subject_id, input.deadlineId ?? null)
  const topic = store.get('topics', where.topic_id)
  const title = input.title?.trim() || (topic ? `${topic.title} mind map` : 'Mind map')
  const doc = buildBoard('blank', ctx)
  const parts = boardParts(doc)
  newMindRoot(parts, { x: 0, y: 0 }, topic?.title ?? (input.title?.trim() || 'Main idea'), courseHex(ctx.subject?.color))
  writeMeta(parts, { title })
  const id = newUuid()
  const item: Item = {
    id,
    kind: 'board',
    subject_id: where.subject_id,
    session_id: where.session_id,
    topic_id: where.topic_id,
    parent_id: parentId,
    title,
    preview: boardPreview(parts) || null,
    meta: { template: 'mindmap', props: input.deadlineId ? { deadline_id: input.deadlineId } : {}, ...suggested },
    source: 'made',
    source_ref: null,
    position: nextPosition(store, where.subject_id, parentId),
    pinned: false,
  }
  await store.upsert<Item>('items', item)
  await seedBoard(id, doc, store.repo())
  doc.destroy()
  return id
}

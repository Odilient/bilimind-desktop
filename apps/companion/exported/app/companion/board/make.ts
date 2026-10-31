/**
 * Making a board, whole, before anyone opens it: built from its template and
 * its context (a revision map picks the next quiz or exam in the course, or
 * anywhere when no course is given; a group-project board the next project),
 * filed where it was asked for, and written to the device and the server as
 * the doc's first update. So the template is applied exactly once, however
 * many devices open it. `/app/b/new` and a note's "Whiteboard" button both
 * come through here.
 */
import { boardContext, nextProject, nextRevisable } from './context'
import { buildBoard, templateTitle, type TemplateName } from './templates'
import { boardParts, newUuid, writeMeta } from './model'
import { boardPreview } from './ops'
import { seedBoard } from './persistence'
import type { CompanionStore } from '../store'
import type { Item } from '../types'

export interface BoardWhere {
  subject_id?: string | null
  session_id?: string | null
  topic_id?: string | null
  /** The note it was made from, so the note can list it. */
  parent_id?: string | null
  deadline_id?: string | null
  /** A name instead of the template's own. */
  title?: string | null
  /**
   * File it exactly where `subject_id` says, null meaning My notes, even when
   * the template found its context in a course (a project board for the next
   * project anywhere). That course becomes the row's suggestion instead.
   */
  exact?: boolean
  /** More for the row's `meta` (a suggested course). */
  meta?: Partial<Item['meta']>
}

export async function makeBoard(store: CompanionStore, template: TemplateName, where: BoardWhere = {}): Promise<Item> {
  await store.load()
  const subjectId = where.subject_id ?? null
  let deadline = where.deadline_id ? store.get('deadlines', where.deadline_id) : null
  if (!deadline && template === 'revision') deadline = nextRevisable(store, subjectId)
  if (!deadline && template === 'kanban') deadline = nextProject(store, subjectId)
  const ctx = boardContext(store, subjectId ?? deadline?.subject_id ?? null, deadline?.id ?? null)
  const doc = buildBoard(template, ctx)
  const parts = boardParts(doc)
  const title = where.title?.trim() || templateTitle(template, ctx)
  writeMeta(parts, { title })
  const id = newUuid()
  const found = ctx.subject?.id ?? null
  const course = where.exact ? subjectId : found
  const guess = where.exact && !course && found ? { suggested_subject_id: found } : {}
  const item: Item = {
    id,
    kind: 'board',
    subject_id: course,
    session_id: where.session_id ?? null,
    topic_id: where.topic_id ?? null,
    parent_id: where.parent_id ?? null,
    title,
    preview: boardPreview(parts) || null,
    meta: { template, props: deadline ? { deadline_id: deadline.id } : {}, ...guess, ...(where.meta ?? {}) },
    source: 'made',
    source_ref: null,
    position: store.items.value.filter((i) => i.subject_id === course).length,
    pinned: false,
  }
  // Through the store: the rail and the course list show it straight away,
  // and offline it waits in the outbox instead of failing.
  const saved = await store.upsert<Item>('items', item)
  await seedBoard(id, doc, store.repo())
  doc.destroy()
  return saved ?? item
}

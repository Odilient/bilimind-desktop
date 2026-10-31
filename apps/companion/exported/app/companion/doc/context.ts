import type { CompanionRepo } from '../repo'
import type { Deadline, Item, Session, Subject, Topic, Uuid } from '../types'
import { useCompanion, type CompanionStore } from '../store'

/**
 * Where a page lives, resolved into rows: its course, the class it was made
 * in, the topic, and that class's recording. This is what lets a page made at
 * 10:02 on Tuesday already know it's Databases, Lecture 8, before anyone types.
 *
 * Read from the companion store, so inside a `computed` it stays live: a
 * deadline that moves, or a topic renamed elsewhere, moves on the page too.
 */
export interface PageWhere {
  subject_id?: Uuid | null
  session_id?: Uuid | null
  topic_id?: Uuid | null
}

export interface PageContext {
  subject: Subject | null
  session: Session | null
  topic: Topic | null
  /** The class's recording, when there is one. */
  recording: Item | null
  /** The course's topics, for @mentions. */
  topics: Topic[]
  /** The course's deadlines, for @mentions and views. */
  deadlines: Deadline[]
}

export const EMPTY_CONTEXT: PageContext = {
  subject: null,
  session: null,
  topic: null,
  recording: null,
  topics: [],
  deadlines: [],
}

/** The context from the store's rows. Pure, so it can sit in a `computed`. */
export function contextFrom(store: CompanionStore, where: PageWhere): PageContext {
  const session = store.get('sessions', where.session_id)
  const subjectId = where.subject_id ?? session?.subject_id ?? null
  const topicId = where.topic_id ?? session?.topic_id ?? null
  return {
    subject: store.get('subjects', subjectId),
    session,
    topic: store.get('topics', topicId),
    recording: session ? store.items.value.find((i) => i.kind === 'recording' && i.session_id === session.id) ?? null : null,
    topics: subjectId ? store.topics.value.filter((t) => t.subject_id === subjectId) : [],
    deadlines: subjectId
      ? store.deadlines.value.filter((d) => d.subject_id === subjectId && d.status !== 'cancelled')
      : [],
  }
}

/** The context once the store has loaded. */
export async function loadContext(where: PageWhere): Promise<PageContext> {
  const store = useCompanion()
  await store.load()
  return contextFrom(store, where)
}

/**
 * One item by id: from the store, or (made a moment ago somewhere else) from
 * the repo directly.
 */
export async function findItem(repo: CompanionRepo, id: Uuid): Promise<Item | null> {
  const store = useCompanion()
  await store.load()
  const known = store.get('items', id)
  if (known) return known
  const rows = await repo.list<Item>('items', { id }).catch(() => [] as Item[])
  return rows.find((row) => row.id === id && !row.deleted_at) ?? null
}

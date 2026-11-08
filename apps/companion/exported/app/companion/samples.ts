/**
 * The starter kit, seen from a screen.
 *
 * Every new account starts with a sample course ("Learning how to learn":
 * a path with two lessons written, cards and today's plan) and two sample
 * notes in My notes, a welcome page and a mind map (StarterKit on the
 * server). The course says so with `sample: true`,
 * the notes with `meta.sample`; every other sample row is one by belonging to
 * the sample course.
 *
 * `removeSamples()` is Today's "Remove samples": one press, and the rows leave
 * every screen at once. A note the learner filed into the sample course is
 * theirs, so it goes back to My notes with its cards, as on the server.
 */
import type { CollectionName, Item, Row, Subject, Uuid } from './types'
import { COLLECTION_KEY, useCompanion, type CompanionStore } from './store'
import { useApi } from '~/composables/useApi'
import { nowIso } from './time'

export function isSample(row: Subject | Item): boolean {
  return 'meta' in row ? row.meta?.sample === true : row.sample === true
}

export function hasSamples(store: CompanionStore): boolean {
  return store.subjects.value.some(isSample) || store.items.value.some(isSample)
}

/** What a sample course holds, besides the course itself. */
const UNDER_COURSE: CollectionName[] = ['slots', 'sessions', 'topics', 'deadlines', 'cards', 'plan-tasks', 'items']

type Filed = Row & { subject_id?: Uuid | null; item_id?: Uuid | null }

/** The learner's own rows taken off the sample course, and what that clears. */
const LOOSE = {
  items: { subject_id: null, session_id: null, topic_id: null },
  cards: { subject_id: null, topic_id: null },
} as const

function sampleRows(store: CompanionStore) {
  const courses = store.subjects.value.filter(isSample)
  const ids = new Set(courses.map((course) => course.id))
  const mine = new Set(
    store.items.value.filter((i) => i.subject_id && ids.has(i.subject_id) && !isSample(i)).map((i) => i.id),
  )
  const gone: [CollectionName, Uuid][] = courses.map((course) => ['subjects', course.id])
  const kept: ['items' | 'cards', Uuid][] = []

  for (const collection of UNDER_COURSE) {
    for (const row of Object.values(store.rows[COLLECTION_KEY[collection]]) as Filed[]) {
      if (row.deleted_at) continue
      const own = collection === 'items' ? mine.has(row.id) : collection === 'cards' && mine.has(row.item_id ?? '')
      if (own) kept.push([collection as 'items' | 'cards', row.id])
      else if ((row.subject_id && ids.has(row.subject_id)) || (collection === 'items' && isSample(row as Item))) {
        gone.push([collection, row.id])
      }
    }
  }

  // The sample's goal, unless a course of the learner's own sits under it.
  for (const goalId of new Set(courses.map((course) => course.goal_id))) {
    if (goalId && !store.subjects.value.some((s) => s.goal_id === goalId && !ids.has(s.id))) {
      gone.push(['goals', goalId])
    }
  }
  return { gone, kept }
}

export async function removeSamples(): Promise<void> {
  const store = useCompanion()
  const { gone, kept } = sampleRows(store)

  await useApi().del('/companion/samples')
  // The server has done the same; say it here now, and the next pull agrees.
  const at = nowIso()
  const put = (collection: CollectionName, id: Uuid, patch: Partial<Row>) => {
    const table = store.rows[COLLECTION_KEY[collection]] as Record<Uuid, Row>
    if (table[id]) table[id] = { ...table[id]!, ...patch, updated_at: at }
  }
  for (const [collection, id] of gone) put(collection, id, { deleted_at: at })
  for (const [collection, id] of kept) put(collection, id, LOOSE[collection] as Partial<Row>)
  void store.sync()

  if (store.today.value) void store.loadToday()
}

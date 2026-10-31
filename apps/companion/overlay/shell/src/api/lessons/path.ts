// A topic becomes a lesson by way of a course of nodes, mirrored from the course's topics. Reading order: each top-level
// topic is a step on the line, what hangs under it follows it. A lesson already written keeps its own summary, archetype
// and length, because they came with the lesson and the archetype decides what a rewrite must contain.
import { plannedBlockTypes, type Archetype } from '@bilimind/core'
import { UUID } from '../rules.ts'
import type { Rec, Row, Store } from '../store.ts'
import { userLanguage } from './language.ts'

export const MARKER = 'companion_subject_id'

const ascii = (title: string) => title.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

function keyOf(topic: Row): string {
  const slug = ascii(topic.title).slice(0, 48).replace(/_+$/, '')
  return `${slug || 'topic'}_${topic.id.replace(/-/g, '').slice(-12)}`
}

function minutesOf(store: Store, subject: Row): number {
  const planned = subject.goal_id ? store.get('goals', subject.goal_id)?.minutes_per_session : null
  return Number(planned) > 0 ? Number(planned) : 20
}

export function courseFor(store: Store, subject: Row): Rec {
  const linked = subject.generated_course_id ? store.rec('course', subject.generated_course_id) : null
  if (linked) return linked
  const course = store.add('course', null, {
    uuid: crypto.randomUUID(),
    slug: null,
    title: String(subject.title).slice(0, 90),
    topic: `${subject.title}${subject.code ? ` (${subject.code})` : ''}`,
    language: userLanguage(store),
    allows_code: false,
    code_language: null,
    level: null,
    goal: null,
    minutes_per_week: null,
    source_type: 'topic',
    status: 'outlined',
    further: [],
    settings: { formats_preferred: [], depth: 'standard', include_code: false, [MARKER]: subject.id },
  })
  store.put('subjects', { ...subject, generated_course_id: course.id })
  mirror(store, subject, course)
  return course
}

/** Lay the topics out as nodes, make what's new and forget stubs whose topic went. */
export function mirror(store: Store, subject: Row, course: Rec): void {
  const topics = store.live('topics').filter((t) => t.subject_id === subject.id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.created_at).localeCompare(String(b.created_at)))
  if (!topics.length) return

  const ids = new Set(topics.map((t) => t.id))
  const childrenOf = new Map<string, Row[]>()
  for (const t of topics) {
    if (t.parent_id && ids.has(t.parent_id)) childrenOf.set(t.parent_id, [...(childrenOf.get(t.parent_id) ?? []), t])
  }
  const existing = new Map(store.recs('node', course.id).map((n) => [n.key, n]))
  const minutes = minutesOf(store, subject)
  const seen = new Set<string>()

  const place = (topic: Row, layer: number, position: number, parent: Rec | null): Rec => {
    const key = keyOf(topic)
    seen.add(key)
    const before = existing.get(key)
    const fields = {
      title: topic.title,
      track: parent ? 'subtopic' : 'core',
      branch_of_node_id: parent?.id ?? null,
      layer,
      position,
    }
    const node = before
      ? store.save('node', { ...before, ...fields }, false)
      : store.add('node', course.id, {
        ...fields,
        course_id: course.id,
        key,
        summary: topic.summary ?? null,
        concept_key: topic.title,
        archetype: null,
        planned_block_types: [],
        estimated_minutes: minutes,
        status: 'stub',
        topic_id: topic.id,
      })
    if (topic.node_id !== node.id) store.put('topics', { ...topic, node_id: node.id })
    return node
  }

  let layer = 0
  for (const topic of topics) {
    if (topic.parent_id && ids.has(topic.parent_id)) continue
    const step = place(topic, layer, 0, null)
    let position = 1
    for (const child of childrenOf.get(topic.id) ?? []) {
      const under = place(child, layer, position++, step)
      // Two levels under a step at most: anything deeper reads as the step's own.
      const descend = (parent: Row) => {
        for (const below of childrenOf.get(parent.id) ?? []) {
          place(below, layer, position++, under)
          descend(below)
        }
      }
      descend(child)
    }
    layer++
  }

  for (const [key, node] of existing) {
    if (!seen.has(key) && node.status === 'stub') store.drop('node', node.id)
  }
}

export function nodeForTopic(store: Store, topicId: string): Rec | null {
  const topic = UUID.test(topicId) ? store.get('topics', topicId) : null
  const subject = topic ? store.get('subjects', topic.subject_id) : null
  if (!topic || !subject) return null
  const course = courseFor(store, subject)
  const placed = store.get('topics', topicId)!
  const node = placed.node_id ? store.rec('node', placed.node_id) : null
  if (node?.course_id === course.id) return node
  mirror(store, store.get('subjects', subject.id)!, course)
  const again = store.get('topics', topicId)!
  return again.node_id ? store.rec('node', again.node_id) : null
}

export const planned = (archetype: string) => plannedBlockTypes(archetype as Archetype)

// Search on FTS5. The index is a copy: rebuilt whole when anything has changed since it was built, because one person's
// data rebuilds in moments and a copy kept in step row by row is a copy that drifts.
import { lessonDigest } from '@bilimind/engine/prompts/expand'
import type { DatabaseSync } from 'node:sqlite'
import type { Raw, Store } from './store.ts'
import { blockLabel, byPosition } from './lessons/wire.ts'

const HL_OPEN = '\uE000'
const HL_CLOSE = '\uE001'
const LIMITS: Record<string, number> = { courses: 4, lessons: 6, content: 8, materials: 4 }
const LABELS: Record<string, string> = { courses: 'Courses', lessons: 'Lessons', content: 'In lessons', materials: 'Materials and notes' }
const MATERIAL = ['file', 'recording', 'page', 'link', 'photo', 'board']

export function createSearch(store: Store) {
  const db: DatabaseSync = store.db
  db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(grp UNINDEXED, ref UNINDEXED, title, body, tokenize = "unicode61 remove_diacritics 2")`)
  let builtAt = -1

  const changes = () => Number((db.prepare('SELECT total_changes() AS n').get() as { n: number }).n)

  function rebuild() {
    // Inside the request's transaction, like every synchronous route.
    {
      db.exec('DELETE FROM search_index')
      const add = db.prepare('INSERT INTO search_index (grp, ref, title, body) VALUES (?, ?, ?, ?)')
      for (const course of store.recs('course')) add.run('courses', String(course.id), course.title, course.topic ?? '')
      for (const node of store.recs('node')) {
        add.run('lessons', String(node.id), node.title, node.summary ?? '')
        for (const block of store.recs('block', node.id).sort(byPosition)) {
          // The same prose a learner reads, so an answer key can't turn up in a search hit.
          const body = lessonDigest([block] as never).replace(/^## .*\n/, '')
          if (body.trim()) add.run('content', String(block.id), '', body)
        }
      }
      for (const item of store.live('items')) {
        if (MATERIAL.includes(item.kind)) add.run('materials', item.id, item.title ?? '', item.preview ?? '')
      }
    }
    builtAt = changes()
  }

  const courseOf = (id: number | null) => {
    const course = id ? store.rec('course', id) : null
    return course ? { id: course.id, title: course.title, path: `/app/courses/${course.settings?.companion_subject_id ?? ''}` } : null
  }

  function hit(grp: string, ref: string, title: string, snippet: string): Raw | null {
    const base = { title, snippet, course: null, node: null, block: null, material: null }
    if (grp === 'courses') {
      const course = courseOf(Number(ref))
      return course ? { ...base, id: `course:${ref}`, kind: 'course', context: 'Course', course } : null
    }
    const nodeBrief = (n: Raw) => ({ id: n.id, key: n.key, title: n.title, status: n.status })
    if (grp === 'lessons') {
      const node = store.rec('node', Number(ref))
      if (!node) return null
      const course = courseOf(node.course_id)
      return { ...base, id: `node:${ref}`, kind: 'node', context: course?.title ?? '', course, node: nodeBrief(node) }
    }
    if (grp === 'content') {
      const block = store.rec('block', Number(ref))
      const node = block ? store.rec('node', block.node_id) : null
      if (!block || !node) return null
      const course = courseOf(node.course_id)
      return { ...base, title: node.title, id: `block:${ref}`, kind: 'block', context: `${course?.title ?? ''} · ${node.title}`, course, node: nodeBrief(node), block: { id: block.id, type: block.type, type_label: blockLabel(block.type) } }
    }
    const item = store.get('items', ref)
    if (!item) return null
    const subject = item.subject_id ? store.get('subjects', item.subject_id) : null
    return { ...base, id: `material:${ref}`, kind: 'material', context: subject?.title ?? 'My notes', item_id: item.id, material: { id: item.id, kind: item.kind, title: item.title, course_id: subject?.generated_course_id ?? null } }
  }

  /** Every term a prefix, all of them required, each quoted so nothing typed is FTS5 syntax. */
  function matchOf(q: string): string | null {
    const quoted = [...q.matchAll(/"([^"]+)"/gu)].map((m) => m[1]!)
    const words = q.replace(/"[^"]*"/gu, ' ').split(/\s+/u).map((w) => w.replace(/["*()^:]/g, '')).filter((w) => [...w].length >= 2)
    const terms = [...quoted.map((t) => `"${t.replace(/"/g, '')}"`), ...words.map((w) => `"${w}"*`)]
    return terms.length ? terms.join(' ') : null
  }

  return function search(q: string, courseId: number | null): Raw {
    const started = Date.now()
    const course = courseId ? store.rec('course', courseId) : null
    const scope = { course_id: course?.id ?? null, course_title: course?.title ?? null }
    const match = matchOf(q)
    if (!match) return { query: q, scope, retrieval: 'none', degraded: false, took_ms: 0, groups: [] }
    if (builtAt !== changes()) rebuild()
    const rows = db.prepare(`SELECT grp, ref, title, snippet(search_index, 3, '${HL_OPEN}', '${HL_CLOSE}', ' … ', 24) AS body_hit, highlight(search_index, 2, '${HL_OPEN}', '${HL_CLOSE}') AS title_hit FROM search_index WHERE search_index MATCH ? ORDER BY rank LIMIT 200`).all(match) as { grp: string; ref: string; title: string; body_hit: string; title_hit: string }[]
    const inScope = (grp: string, ref: string) => {
      if (!course) return true
      if (grp === 'courses') return Number(ref) === course.id
      if (grp === 'lessons') return store.rec('node', Number(ref))?.course_id === course.id
      if (grp === 'content') {
        const block = store.rec('block', Number(ref))
        return block ? store.rec('node', block.node_id)?.course_id === course.id : false
      }
      return store.get('items', ref)?.subject_id === course.settings?.companion_subject_id
    }
    const groups = Object.keys(LIMITS).flatMap((key) => {
      const own = rows.filter((r) => r.grp === key && inScope(key, r.ref))
      const results = own.slice(0, LIMITS[key]).flatMap((r) => hit(key, r.ref, r.title, r.body_hit || r.title_hit) ?? [])
      return results.length ? [{ key, label: LABELS[key], results, has_more: own.length > LIMITS[key]!, total: null }] : []
    })
    return { query: q, scope, retrieval: 'fts', degraded: false, took_ms: Date.now() - started, groups }
  }
}

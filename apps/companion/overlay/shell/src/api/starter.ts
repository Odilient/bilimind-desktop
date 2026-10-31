// A new computer starts with one sample course to look around in: a goal, a path, two written lessons, cards, a board and a
// welcome page. All of it comes from the kit shipped in the app, none of it from anyone's data, and one press removes it.
import kit from '../../../app/companion/starter-kit.json' with { type: 'json' }
import { rebuild } from './planner.ts'
import { emptyFsrs, createRow } from './rows.ts'
import { wireTime, type Raw, type Row, type Store } from './store.ts'
import { dayKey, shiftDay } from '../../../app/companion/time.ts'
import { attachAssessments } from './lessons/blocks.ts'
import { courseFor, MARKER, nodeForTopic, planned } from './lessons/path.ts'
import { record } from './lessons/revisions.ts'

const REF = 'starter:'
const DAY = 86_400_000

export function seedStarterKit(store: Store): void {
  if (store.live('subjects').some((s) => String(s.source_ref ?? '').startsWith(REF))) return
  const spec = kit.course
  const now = Date.now()
  const today = dayKey(now)
  const goal = createRow(store, 'goals', {
    title: spec.title,
    kind: 'self',
    starts_on: today,
    ends_on: shiftDay(today, Number(spec.days) - 1),
    finish_kind: 'date',
    sessions_per_week: Number(spec.sessions_per_week),
    minutes_per_session: Number(spec.minutes_per_session),
    status: 'active',
  })
  const subject = createRow(store, 'subjects', {
    goal_id: goal.id,
    title: spec.title,
    color: spec.color,
    source: 'generated',
    source_ref: `${REF}${spec.key}`,
    format: 'path',
  })
  const topics = new Map<string, Row>()
  spec.topics.forEach((topic: { title: string; summary: string }, position: number) => {
    topics.set(topic.title, createRow(store, 'topics', { subject_id: subject.id, title: topic.title, summary: topic.summary, position, source: 'generated' }))
  })

  for (const lesson of kit.lessons as Raw[]) {
    const node = nodeForTopic(store, topics.get(lesson.topic)!.id)!
    const position = { next: 0 }
    ;(lesson.blocks as Raw[]).forEach((raw, index) => {
      const block = store.add('block', node.id, { node_id: node.id, position: index, type: raw.type, payload: raw.payload, source_material_ids: null })
      attachAssessments(store, node, block, (raw.assessments ?? []) as never, position)
    })
    const written = store.save('node', {
      ...store.rec('node', node.id)!,
      status: 'ready',
      summary: lesson.summary ?? node.summary,
      archetype: lesson.archetype,
      planned_block_types: planned(lesson.archetype),
      estimated_minutes: lesson.estimated_minutes ?? node.estimated_minutes,
    })
    record(store, written, 'generated')
  }
  const course = courseFor(store, store.get('subjects', subject.id)!)
  store.save('course', { ...course, status: 'ready' })

  for (const card of kit.cards as Raw[]) {
    const due = now + Number(card.day) * DAY
    createRow(store, 'cards', {
      subject_id: subject.id,
      topic_id: topics.get(card.topic)!.id,
      kind: 'basic',
      front: card.front,
      back: card.back,
      fsrs: emptyFsrs(due),
      due_at: wireTime(due),
    })
  }

  const board = createRow(store, 'items', {
    kind: 'board',
    title: kit.board.title,
    preview: kit.board.preview,
    // Drawn from `seed_mind` the first time it opens.
    meta: { seed_mind: kit.board.mind, sample: true },
    source: 'made',
    source_ref: `${REF}board`,
    position: 1,
  })
  const html = kit.welcome.html.join('').replaceAll('{course}', subject.id).replaceAll('{board}', board.id)
  createRow(store, 'items', {
    kind: 'page',
    title: kit.welcome.title,
    preview: kit.welcome.preview,
    meta: { template: 'blank', icon: kit.welcome.icon, seed_html: html, sample: true },
    source: 'made',
    source_ref: `${REF}welcome`,
    position: 0,
    pinned: true,
  })
  rebuild(store, today)
}

export function removeStarterKit(store: Store): void {
  {
    for (const subject of store.live('subjects').filter((s) => String(s.source_ref ?? '').startsWith(REF))) {
      // What the learner filed under it themselves stays, out of the course.
      for (const item of store.live('items').filter((i) => i.subject_id === subject.id && !String(i.source_ref ?? '').startsWith(REF))) {
        store.put('items', { ...item, subject_id: null, session_id: null, topic_id: null })
      }
      for (const course of store.recs('course').filter((c) => c.settings?.[MARKER] === subject.id)) {
        for (const node of store.recs('node', course.id)) {
          for (const kind of ['annotation', 'attachment', 'revision', 'block'] as const) for (const r of store.recs(kind, node.id)) store.drop(kind, r.id)
          for (const a of store.recs('assessment', node.id)) {
            for (const t of store.recs('attempt', a.id)) store.drop('attempt', t.id)
            store.drop('assessment', a.id)
          }
          store.drop('node', node.id)
        }
        store.drop('course', course.id)
      }
      for (const collection of ['topics', 'cards', 'plan-tasks', 'checks', 'deadlines', 'sessions', 'slots'] as const) {
        for (const row of store.live(collection).filter((r) => r.subject_id === subject.id)) store.bury(collection, row)
      }
      store.bury('subjects', subject)
      const goal = subject.goal_id ? store.get('goals', subject.goal_id) : null
      if (goal && !store.live('subjects').some((s) => s.goal_id === goal.id)) store.bury('goals', goal)
    }
    for (const item of store.live('items').filter((i) => String(i.source_ref ?? '').startsWith(REF))) store.bury('items', item)
    rebuild(store, dayKey(Date.now()))
  }
}

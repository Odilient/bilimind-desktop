/**
 * `?demo=new`: a brand-new account in memory, holding only the starter kit,
 * so the first run can be seen without signing up.
 *
 * Built from a copy of the file the server's StarterKit seeds at
 * registration (`starter-kit.json`), and laid out the way StarterKit lays it
 * out: a self-study goal of one short lesson a day, the sample course on its
 * path, its cards (the first lesson's due now, the second's tomorrow), today's
 * plan in the words the Planner writes it, and in My notes the welcome page
 * and the mind map. The written lessons are answered by `demo-lessons.ts`,
 * like Kamila's, once `bridgeLessons` has pointed the course at them.
 *
 * Ids are derived from names, so a reload builds the same account.
 */
import { createEmptyCard } from 'ts-fsrs'
import type { Card, Goal, Item, PlanTask, Subject, Topic } from './types'
import { bridgeLessons, sid, type DemoWorld } from './demo-seed'
import { browserZone, dayKey, isoWithOffset, shiftDay } from './time'
import kit from './starter-kit.json'

/** The `source_ref` prefix of every sample row, as on the server (StarterKit::REF). */
const REF = 'starter:'

export function buildStarterWorld(now = new Date()): DemoWorld {
  const today = dayKey(now)
  const created = isoWithOffset(now)
  const stamp = { created_at: created, updated_at: created, deleted_at: null }
  const spec = kit.course

  const goal: Goal = {
    id: sid(`goal:${spec.key}`),
    ...stamp,
    title: spec.title,
    kind: 'self',
    starts_on: today,
    ends_on: shiftDay(today, spec.days - 1),
    weeks: null,
    breaks: null,
    exam_period: null,
    finish_kind: 'date',
    finish_label: null,
    sessions_per_week: spec.sessions_per_week,
    minutes_per_session: spec.minutes_per_session,
    timezone: browserZone(),
    status: 'active',
  }

  // `subject:<key>` is what bridgeLessons looks for.
  const subject: Subject = {
    id: sid(`subject:${spec.key}`),
    ...stamp,
    goal_id: goal.id,
    title: spec.title,
    code: null,
    color: spec.color,
    lecturer: null,
    source: 'generated',
    source_ref: `${REF}${spec.key}`,
    source_url: null,
    format: 'path',
    generated_course_id: null,
    recording_allowed: true,
    position: 0,
    archived_at: null,
    group_name: null,
    try_first: false,
    sample: true,
  }

  const topics: Topic[] = spec.topics.map((topic, position) => ({
    id: sid(`topic:${spec.key}:${topic.title}`),
    ...stamp,
    subject_id: subject.id,
    parent_id: null,
    title: topic.title,
    position,
    summary: topic.summary,
    source: 'generated',
    weight: null,
    node_id: null,
  }))
  const topicId = (title: string) => topics.find((topic) => topic.title === title)!.id

  const cards: Card[] = kit.cards.map((card, n) => {
    const due = new Date(now.getTime() + card.day * 86_400_000)
    return {
      id: sid(`card:${spec.key}:${n}`),
      ...stamp,
      subject_id: subject.id,
      topic_id: topicId(card.topic),
      item_id: null,
      kind: 'basic',
      front: card.front,
      back: card.back,
      source_quote: null,
      fsrs: JSON.parse(JSON.stringify(createEmptyCard(due))) as Record<string, unknown>,
      due_at: isoWithOffset(due),
      last_review_at: null,
      suspended: false,
    }
  })

  const board: Item = {
    id: sid(`item:${REF}board`),
    ...stamp,
    subject_id: null,
    session_id: null,
    topic_id: null,
    parent_id: null,
    kind: 'board',
    title: kit.board.title,
    preview: kit.board.preview,
    meta: { seed_mind: kit.board.mind, sample: true } as Item['meta'],
    source: 'made',
    source_ref: `${REF}board`,
    position: 1,
    pinned: false,
  }

  const welcome: Item = {
    id: sid(`item:${REF}welcome`),
    ...stamp,
    subject_id: null,
    session_id: null,
    topic_id: null,
    parent_id: null,
    kind: 'page',
    title: kit.welcome.title,
    preview: kit.welcome.preview,
    meta: {
      template: 'blank',
      icon: kit.welcome.icon,
      seed_html: kit.welcome.html.join('').replaceAll('{course}', subject.id).replaceAll('{board}', board.id),
      sample: true,
    },
    source: 'made',
    source_ref: `${REF}welcome`,
    position: 0,
    pinned: true,
  }

  // Today as the Planner writes it for this account: the first lesson on the
  // path, then the cards due today (40 seconds a card, whole minutes).
  const due = kit.cards.filter((card) => card.day === 0).length
  const task = (kind: PlanTask['kind'], position: number, rest: Partial<PlanTask>): PlanTask => ({
    id: sid(`plan:${today}:${kind}:${subject.id}:null`),
    ...stamp,
    date: today,
    subject_id: subject.id,
    deadline_id: null,
    topic_id: null,
    item_id: null,
    kind,
    title: '',
    detail: null,
    minutes: 0,
    position,
    done_at: null,
    generated_at: created,
    ...rest,
  })
  const plan = [
    task('lesson', 0, {
      topic_id: topics[0]!.id,
      title: `Lesson 1: ${topics[0]!.title}`,
      minutes: spec.minutes_per_session,
    }),
    task('review', 1, {
      title: `Review ${due} flashcard${due === 1 ? '' : 's'}`,
      minutes: Math.min(30, Math.max(1, Math.ceil((due * 40) / 60))),
    }),
  ]

  const subjects = [subject]
  bridgeLessons(subjects, topics)

  return {
    goals: [goal],
    subjects,
    slots: [],
    sessions: [],
    topics,
    deadlines: [],
    items: [welcome, board],
    cards,
    plan_tasks: plan,
    signals: [],
    connections: [],
    checks: [],
    server_time: created,
    seed_day: today,
    ita_original_end: '',
    kind: 'new',
  }
}

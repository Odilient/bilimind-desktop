/**
 * A companion course, drawn by the old workspace.
 *
 * The roadmap, the lesson list and the brief (`WorkspaceRoadmapBoard`,
 * `WorkspaceNodeList`, `WorkspaceNodeBrief`) were built for a generated
 * course's `CourseNode[]`. Every companion course has topics: a school
 * course's come from the outline and the lectures, a self-study course's
 * from its plan, in units. Rather than fork those components, this file says
 * what each topic would be as a lesson box, so they draw it unchanged:
 *
 *  - every topic is a step on the line, in path order, under its unit's
 *    heading when it has one;
 *  - its id is synthetic and negative (`-1`, `-2`, …) and its key is
 *    `topic:<the topic's id>`, which is how a box is told from a real lesson;
 *  - written once it has a lesson (`topic.node_id`), a stub before that, so
 *    the brief offers "Open lesson" or "Write this lesson" as it always did;
 *  - its progress is the companion's own: ready is done, heard or started is
 *    learning, the rest pending;
 *  - the nearest assessment that covers it is the note beside it, so the
 *    line says where the exam is.
 *
 * When a course has a generated course behind it, its real lessons are drawn
 * instead and nothing here is needed beyond `topicOfNode`.
 */
import type { CourseNode, ProgressState } from '~/types/api'
import type { Deadline, Goal, Session, Subject, Topic } from './types'
import { pathOrder } from './readiness'
import { dayKey, shortDate } from './time'

export type TopicProgress = Exclude<ProgressState, 'available'> | null

const TOPIC_KEY = 'topic:'

export interface RoadmapContext {
  subject: Subject
  goal: Goal | null
  /** The course's classes, any order. */
  sessions: Session[]
  /** The course's deadlines, any order. */
  deadlines: Deadline[]
  /** Where the learner is on a topic. */
  progress: (topic: Topic) => TopicProgress
}

/** "Unit 3 · The past", whether or not the title already says "Unit 3". */
export function unitLabel(unit: Topic, index: number): string {
  return /^unit\s*\d+/i.test(unit.title) ? unit.title : `Unit ${index + 1} · ${unit.title}`
}

function minutesOf(s: Session): number {
  return Math.max(0, Math.round((Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 60_000))
}

/** The course's topics as lesson boxes, in path order, with synthetic negative ids. */
export function topicsAsNodes(topics: Topic[], ctx: RoadmapContext): CourseNode[] {
  const own = topics.filter((t) => t.subject_id === ctx.subject.id && !t.deleted_at)
  const units = own
    .filter((t) => !t.parent_id && own.some((x) => x.parent_id === t.id))
    .sort((a, b) => a.position - b.position)
  const unitIndex = new Map(units.map((u, i) => [u.id, i]))
  const leaves = pathOrder(own)

  const classes = ctx.sessions
    .filter((s) => !s.cancelled && !s.deleted_at)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
  const upcoming = ctx.deadlines
    .filter((d) => d.status === 'upcoming' && d.topic_ids.length && d.due_at && Date.parse(d.due_at) > Date.now())
    .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!))

  // An assessment is noted once, beside the last topic it covers: the line
  // reads "everything up to here is on the midterm".
  const notes = new Map<string, string>()
  for (const d of upcoming) {
    const last = [...leaves].reverse().find((t) => d.topic_ids.includes(t.id))
    if (!last || notes.has(last.id)) continue
    notes.set(last.id, `${d.title}, ${shortDate(dayKey(d.due_at!))}: covers everything up to here.`)
  }

  const isPath = ctx.subject.format === 'path'
  const sessionMinutes = ctx.goal?.minutes_per_session ?? null

  return leaves.map((topic, index) => {
    const first = classes.find((s) => s.topic_id === topic.id) ?? null
    const unit = topic.parent_id ? units.find((u) => u.id === topic.parent_id) : undefined
    const state = ctx.progress(topic)
    const minutes = (isPath ? sessionMinutes : null) ?? (first ? minutesOf(first) : null) ?? 30
    const id = -(index + 1)
    return {
      id,
      course_id: 0,
      key: `${TOPIC_KEY}${topic.id}`,
      title: topic.title,
      summary: topic.summary?.trim() || whenLine(topic, first, isPath),
      concept_key: null,
      track: 'core',
      mark: null,
      group: null,
      note: notes.get(topic.id) ?? null,
      branch_of_node_id: null,
      section: unit ? unitLabel(unit, unitIndex.get(unit.id) ?? 0) : null,
      layer: index,
      position: 0,
      estimated_minutes: minutes,
      status: topic.node_id ? 'ready' : 'stub',
      planned_block_types: null,
      failure_reason: null,
      progress: state
        ? { node_id: id, state, time_spent_seconds: 0, completed_at: null, last_seen_at: null }
        : null,
    } satisfies CourseNode
  })
}

/** What the brief says a topic is for, when its outline gave no summary. */
function whenLine(topic: Topic, first: Session | null, isPath: boolean): string | null {
  if (!first) return null
  const when = shortDate(dayKey(first.starts_at))
  const past = Date.parse(first.starts_at) < Date.now()
  if (isPath) return past ? `First studied on ${when}.` : `Planned for ${when}.`
  const week = first.week ? ` in week ${first.week}` : ''
  return past ? `Covered in ${first.title}${week}, on ${when}.` : `Comes up in ${first.title}${week}, on ${when}.`
}

/** Whether a box stands for a topic rather than a written lesson. */
export function isTopicBox(node: Pick<CourseNode, 'key'>): boolean {
  return node.key.startsWith(TOPIC_KEY)
}

/** The topic a drawn box stands for: by its key when it is a topic, by its lesson when real. */
export function topicOfNode(node: Pick<CourseNode, 'id' | 'key'>, topics: Topic[]): Topic | null {
  if (isTopicBox(node)) return topics.find((t) => `${TOPIC_KEY}${t.id}` === node.key) ?? null
  return topics.find((t) => t.node_id === node.id) ?? null
}

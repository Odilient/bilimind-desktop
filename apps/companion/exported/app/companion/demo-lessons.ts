/**
 * The demo's written lessons, answered in memory.
 *
 * In `?demo=1` there is no account and no API, yet Italian and Computer
 * Networks open real lessons in the old lesson view (and in `?demo=new` the
 * starter kit's sample course does, from `starter-kit.json`): blocks, graded
 * questions, highlights and drawings. `useApi` hands every request that names a demo id
 * (negative, see DEMO_LESSON_COURSES) to `answerDemoLesson()`, which answers in
 * the API's own wire shapes, built from two things:
 *
 * - the companion's demo rows (`useCompanion()`): a course is laid out from its
 *   topics the way LessonBridge mirrors them on the server, so a topic and its
 *   node always agree, and a topic renamed in the demo is renamed here;
 * - `demo-lessons.json`, the hand-written lessons. It is a copy of the file the
 *   server's demo seed writes into Kamila's account, so both modes teach the
 *   same lessons.
 *
 * Grading is local and scores each kind the way DeterministicGrader does;
 * answers, progress and marks last as long as the tab. Anything that would
 * write or rewrite a lesson is refused with a sentence, because that spends an
 * account's allowance and the demo has neither.
 *
 * Loaded lazily by `useApi`, and only in demo mode, so no other page ever
 * downloads it.
 */
import type {
  Annotation,
  Assessment,
  AssessmentKind,
  AssessmentOption,
  Attempt,
  Block,
  BlockType,
  ConceptArchetype,
  Course,
  CourseNode,
  Edge,
  GraderKind,
  NodeProgress,
  ProgressState,
} from '~/types/api'
import type { NodeBrief, PlayerNode } from '~/composables/useNodePlayer'
import { ApiError } from '~/composables/useApi'
import type { Topic } from './types'
import { useCompanion } from './store'
import { DEMO_LESSON_COURSES, DEMO_USER, mirrorOrder } from './demo-seed'
import fixture from './demo-lessons.json'
import starter from './starter-kit.json'

interface FixtureAssessment {
  kind: AssessmentKind
  prompt: string
  options: AssessmentOption[] | null
  answer_key: Record<string, unknown>
  grader: GraderKind
  max_score: number
}

interface FixtureBlock {
  type: BlockType
  payload: Record<string, unknown>
  assessments?: FixtureAssessment[]
  /** A dialogue's scripted tutor, one line per learner turn: the demo has no model. */
  demo_replies?: string[]
}

interface FixtureLesson {
  course: string
  topic: string
  summary: string
  archetype: ConceptArchetype
  estimated_minutes: number
  blocks: FixtureBlock[]
}

const LESSONS = [
  ...(fixture as unknown as { lessons: FixtureLesson[] }).lessons,
  ...(starter as unknown as { lessons: FixtureLesson[] }).lessons,
]

const ARCHETYPE_LABEL: Record<string, string> = {
  procedural: 'Procedure', conceptual: 'Concept', factual: 'Facts', discriminative: 'Choosing between',
  diagnostic: 'Diagnosis', quantitative: 'Calculation', spatial: 'Layout', evolutionary: 'How it got here',
  performance: 'Do it for real', safety_critical: 'Safety', communicative: 'Speaking',
}

const KIND_LABEL: Record<string, string> = {
  mcq: 'Multiple choice', multi_select: 'Select all that apply', short_answer: 'Short answer',
  cloze: 'Fill in the blank', essay: 'Essay', project: 'Project', code: 'Code', ordering: 'Put in order',
  numeric: 'Numeric answer',
}

/** What a stub would be written with: the `conceptual` formats the server's mirror falls back to. */
const STUB_FORMATS: BlockType[] = ['explainer', 'diagram', 'analogy', 'quiz']

const REFUSED = 'Writing and changing lessons needs your own account. This is the sample one.'

/* -- The tab's own state ----------------------------------------------------- */

const progress = new Map<number, NodeProgress>()
const attempts = new Map<number, Attempt[]>()
const marks = new Map<number, Annotation[]>()
let attemptSeq = 0

function now(): string {
  return new Date().toISOString()
}

/* -- Ids ------------------------------------------------------------------- */

/** Block ids sit under their node's, two digits each: node -1018 has blocks -101801, -101802… */
function blockId(nodeId: number, index: number): number {
  return nodeId * 100 - (index + 1)
}

/** Questions take the upper half of the same range, so a block and a question never share an id. */
function assessmentId(nodeId: number, index: number): number {
  return nodeId * 100 - 50 - (index + 1)
}

function courseKeyOf(courseId: number): string | null {
  return Object.entries(DEMO_LESSON_COURSES).find(([, id]) => id === courseId)?.[0] ?? null
}

/* -- The course, laid out from the demo's topics ------------------------------ */

interface Laid {
  courseId: number
  key: string
  subjectTitle: string
  nodes: CourseNode[]
  edges: Edge[]
  topicOf: Map<number, Topic>
}

function lessonOf(courseKey: string, title: string): FixtureLesson | null {
  return LESSONS.find((lesson) => lesson.course === courseKey && lesson.topic === title) ?? null
}

function layout(courseId: number): Laid | null {
  const key = courseKeyOf(courseId)
  if (!key) return null
  const { rows } = useCompanion()
  const subject = Object.values(rows.subjects).find(
    (row) => row.generated_course_id === courseId && !row.deleted_at,
  )
  if (!subject) return null

  const ordered = mirrorOrder(Object.values(rows.topics).filter((topic) => topic.subject_id === subject.id))
    .filter((topic) => topic.node_id !== null)
  const nodeOfTopic = new Map(ordered.map((topic) => [topic.id, topic.node_id as number]))

  const nodes: CourseNode[] = []
  const edges: Edge[] = []
  const topicOf = new Map<number, Topic>()
  let layer = -1
  let position = 0
  let previousCore: number | null = null

  for (const topic of ordered) {
    const id = topic.node_id as number
    const parent = topic.parent_id ? (nodeOfTopic.get(topic.parent_id) ?? null) : null
    const lesson = lessonOf(key, topic.title)

    if (parent === null) {
      layer++
      position = 0
      if (previousCore !== null) edges.push(edge(courseId, edges.length, previousCore, id))
      previousCore = id
    } else {
      position++
      edges.push(edge(courseId, edges.length, parent, id))
    }

    topicOf.set(id, topic)
    nodes.push({
      id,
      course_id: courseId,
      key: `topic_${-id}`,
      title: topic.title,
      summary: lesson?.summary ?? topic.summary,
      concept_key: null,
      archetype: lesson?.archetype ?? 'conceptual',
      archetype_label: ARCHETYPE_LABEL[lesson?.archetype ?? 'conceptual'] ?? null,
      track: parent === null ? 'core' : 'subtopic',
      track_label: parent === null ? 'On the path' : 'Under this step',
      mark: null,
      mark_label: null,
      group: null,
      note: null,
      branch_of_node_id: parent,
      section: null,
      layer,
      position,
      estimated_minutes: lesson?.estimated_minutes ?? 25,
      status: lesson ? 'ready' : 'stub',
      planned_block_types: lesson ? [...new Set(lesson.blocks.map((block) => block.type))] : STUB_FORMATS,
      failure_reason: null,
      writing_for: null,
      current_revision_id: null,
      edited_at: null,
      progress: progressOf(id, topic, lesson),
      blocks_count: lesson?.blocks.length ?? 0,
      assessments_count: (lesson?.blocks ?? []).reduce((sum, block) => sum + (block.assessments?.length ?? 0), 0),
      created_at: topic.created_at,
      updated_at: topic.updated_at,
    })
  }

  return { courseId, key, subjectTitle: subject.title, nodes, edges, topicOf }
}

function edge(courseId: number, index: number, from: number, to: number): Edge {
  return {
    id: courseId * 100_000 - (index + 1),
    course_id: courseId,
    from_node_id: from,
    to_node_id: to,
    type: 'prerequisite',
  }
}

/**
 * A written Italian lesson whose evening has passed is done, as it is on the
 * server (DemoSemester); everything else starts untouched.
 */
function progressOf(nodeId: number, topic: Topic, lesson: FixtureLesson | null): NodeProgress {
  const known = progress.get(nodeId)
  if (known) return known
  const { rows } = useCompanion()
  const ended = lesson && lesson.course === 'ita'
    ? Object.values(rows.sessions).find(
        (session) =>
          session.topic_id === topic.id && !session.cancelled && Date.parse(session.ends_at) < Date.now(),
      )
    : undefined
  const fresh: NodeProgress = ended
    ? {
        node_id: nodeId,
        state: 'completed',
        time_spent_seconds: (lesson?.estimated_minutes ?? 25) * 60,
        completed_at: ended.ends_at,
        last_seen_at: ended.ends_at,
      }
    : { node_id: nodeId, state: 'available', time_spent_seconds: 0, completed_at: null, last_seen_at: null }
  progress.set(nodeId, fresh)
  return fresh
}

function courseOf(courseId: number): Course | null {
  const laid = layout(courseId)
  if (!laid) return null
  const { nodes } = laid
  const count = (state: ProgressState) => nodes.filter((node) => node.progress?.state === state).length
  const ready = nodes.filter((node) => node.status === 'ready').length
  const completed = count('completed')
  const stamp = nodes[0]?.created_at ?? now()

  return {
    id: courseId,
    uuid: `demo-course${courseId}`,
    slug: null,
    path: null,
    owner: { username: null, name: DEMO_USER.name },
    title: laid.subjectTitle,
    topic: laid.subjectTitle,
    language: 'en',
    level: null,
    allows_code: false,
    goal: null,
    minutes_per_week: null,
    source_type: 'topic',
    status: 'ready',
    settings: null,
    share_token: null,
    share_url: null,
    is_public: false,
    visibility: 'private',
    organization: null,
    is_mine: true,
    status_label: 'Ready',
    is_generating: false,
    failure_reason: null,
    archived_at: null,
    deleted_at: null,
    purges_at: null,
    node_counts: {
      total: nodes.length,
      stub: nodes.length - ready,
      queued: 0,
      generating: 0,
      ready,
      failed: 0,
    },
    progress: {
      total: nodes.length,
      completed,
      in_progress: count('in_progress'),
      skipped: count('skipped'),
      available: count('available'),
      percent: nodes.length ? Math.round((completed / nodes.length) * 100) : 0,
    },
    materials_count: 0,
    schedule: null,
    next_scheduled_for: null,
    created_at: stamp,
    updated_at: stamp,
    clarifying_questions: null,
    clarifying_answers: null,
    pipeline: null,
    further: [],
    nodes,
    edges: laid.edges,
    materials: [],
    // The demo reads and marks up; it never edits (REFUSED).
    can_edit: false,
  }
}

/* -- One lesson ------------------------------------------------------------ */

interface Found {
  laid: Laid
  node: CourseNode
  lesson: FixtureLesson | null
}

function find(nodeId: number): Found | null {
  const courseId = Math.trunc(nodeId / 1000)
  const laid = layout(courseId)
  const node = laid?.nodes.find((row) => row.id === nodeId)
  if (!laid || !node) return null
  return { laid, node, lesson: lessonOf(laid.key, node.title) }
}

function brief(node: CourseNode): NodeBrief {
  return {
    id: node.id,
    key: node.key,
    title: node.title,
    status: node.status,
    layer: node.layer,
    track: node.track ?? undefined,
  }
}

function questionsOf(found: Found): { assessment: Assessment; key: FixtureAssessment }[] {
  const out: { assessment: Assessment; key: FixtureAssessment }[] = []
  const nodeId = found.node.id
  found.lesson?.blocks.forEach((block, index) => {
    for (const item of block.assessments ?? []) {
      const id = assessmentId(nodeId, out.length)
      const history = attempts.get(id) ?? []
      const scores = history.map((row) => row.score).filter((score): score is number => score !== null)
      const best = scores.length ? Math.max(...scores) : null
      out.push({
        key: item,
        assessment: {
          id,
          node_id: nodeId,
          block_id: blockId(nodeId, index),
          kind: item.kind,
          kind_label: KIND_LABEL[item.kind],
          prompt: item.prompt,
          options: item.options,
          input_hint: item.kind === 'numeric'
            ? { kind: 'numeric', unit: (item.answer_key.unit as string | null | undefined) ?? null }
            : null,
          rubric: null,
          grader: item.grader,
          grader_label: 'Auto-graded',
          graded_automatically: true,
          max_score: item.max_score,
          pass_score: passMark(item.max_score),
          position: out.length,
          attempts: history,
          attempt_summary: {
            count: history.length,
            best_score: best,
            passed: history.some((row) => row.passed === true),
            last_attempt_at: history[0]?.created_at ?? null,
          },
        },
      })
    }
  })
  return out
}

function blocksOf(found: Found, questions: Assessment[]): Block[] {
  const nodeId = found.node.id
  return (found.lesson?.blocks ?? []).map((block, index) => {
    const id = blockId(nodeId, index)
    const own = questions.filter((question) => question.block_id === id).map((question) => question.id)
    return {
      id,
      node_id: nodeId,
      position: index,
      type: block.type,
      payload: block.assessments ? { ...block.payload, assessment_ids: own } : block.payload,
      source_material_ids: null,
      rewriting: false,
      rewrite_error: null,
    } as unknown as Block
  })
}

function nodeOf(nodeId: number): PlayerNode | null {
  const found = find(nodeId)
  if (!found) return null
  const { laid, node } = found
  const questions = questionsOf(found).map((row) => row.assessment)
  const byId = new Map(laid.nodes.map((row) => [row.id, row]))
  const into = laid.edges.filter((row) => row.to_node_id === nodeId).map((row) => byId.get(row.from_node_id))
  const out = laid.edges.filter((row) => row.from_node_id === nodeId).map((row) => byId.get(row.to_node_id))

  return {
    id: node.id,
    course_id: node.course_id,
    key: node.key,
    title: node.title,
    summary: node.summary,
    concept_key: node.concept_key,
    archetype: node.archetype,
    archetype_label: node.archetype_label,
    layer: node.layer,
    position: node.position,
    track: node.track ?? undefined,
    track_label: node.track_label ?? undefined,
    estimated_minutes: node.estimated_minutes,
    status: node.status,
    status_label: node.status === 'ready' ? 'Ready' : 'Not generated',
    is_expanded: node.status === 'ready',
    planned_block_types: node.planned_block_types ?? undefined,
    failure_reason: null,
    writing_for: null,
    current_revision_id: null,
    edited_at: null,
    progress: progress.get(nodeId) ?? node.progress ?? undefined,
    blocks: blocksOf(found, questions),
    attachments: [],
    assessments: questions,
    prerequisites: into.filter((row): row is CourseNode => !!row).map(brief),
    next_nodes: out.filter((row): row is CourseNode => !!row).map(brief),
    course: { id: laid.courseId, title: laid.subjectTitle, language: 'en', status: 'ready' },
  }
}

/* -- Grading, as DeterministicGrader scores the same kinds ------------------ */

function passMark(max: number): number {
  return Math.ceil(max * 0.7)
}

/** AnswerNormaliser: quotes dropped, punctuation to spaces, whitespace collapsed, lower case. */
function normalise(value: string): string {
  return value
    .replace(/['‘’“”"`]+/gu, '')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase()
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

interface Graded {
  ratio: number
  feedback: string
}

function grade(key: FixtureAssessment, response: Record<string, unknown>): Graded {
  const answer = key.answer_key
  switch (key.kind) {
    case 'mcq': {
      const right = strings(answer.correct_option_ids).includes(String(response.option_id ?? ''))
      return {
        ratio: right ? 1 : 0,
        feedback: right ? 'Correct.' : 'Not quite. Read the options against the lesson, then try again.',
      }
    }
    case 'multi_select': {
      const expected = strings(answer.correct_option_ids)
      const given = strings(response.option_ids)
      const hit = given.filter((id) => expected.includes(id)).length
      const union = new Set([...given, ...expected]).size
      const ratio = union ? hit / union : 1
      return {
        ratio,
        feedback: ratio === 1
          ? 'All of them, and nothing else.'
          : `${hit} of ${expected.length} right${given.length > hit ? ', and some that do not belong' : ''}.`,
      }
    }
    case 'cloze': {
      const blanks = (answer.blanks as string[][] | undefined) ?? []
      const given = strings(response.blanks)
      const right = blanks.filter((accepted, index) =>
        accepted.some((ok) => normalise(ok) === normalise(given[index] ?? '')),
      ).length
      const ratio = blanks.length ? right / blanks.length : 0
      return { ratio, feedback: ratio === 1 ? 'Correct.' : 'Not quite. Compare it with the lesson, then try again.' }
    }
    case 'numeric': {
      const expected = Number(answer.value)
      const given = Number(String(response.value ?? '').replace(',', '.').replace(/[^\d.-]/g, ''))
      if (!Number.isFinite(given)) return { ratio: 0, feedback: 'That could not be read as a number.' }
      const tolerance = Math.max(Number(answer.tolerance ?? 0), Math.abs(expected) * 1e-9)
      if (Math.abs(given - expected) <= tolerance) return { ratio: 1, feedback: 'Correct.' }
      return { ratio: 0, feedback: given > expected ? 'Too high.' : 'Too low.' }
    }
    case 'ordering': {
      const expected = strings(answer.correct_order)
      const rank = new Map(expected.map((id, index) => [id, index]))
      const ranked = strings(response.order)
        .map((id) => rank.get(id))
        .filter((at): at is number => at !== undefined)
      const pairs = Math.max(0, ranked.length - 1)
      let right = 0
      for (let at = 0; at < pairs; at++) if (ranked[at]! < ranked[at + 1]!) right++
      const perfect = right === pairs && pairs === expected.length - 1
      const ratio = perfect ? 1 : pairs ? (right / pairs) * (ranked.length / expected.length) : 0
      return {
        ratio,
        feedback: perfect ? 'In order.' : `${right} of ${expected.length - 1} neighbours are in the right order.`,
      }
    }
    default:
      return { ratio: 0, feedback: 'This question is not marked in the sample.' }
  }
}

function attempt(nodeId: number, assessmentIdValue: number, body: Record<string, unknown>) {
  const found = find(nodeId)
  const row = found ? questionsOf(found).find((item) => item.assessment.id === assessmentIdValue) : undefined
  if (!found || !row) throw new ApiError('Not found.', 404)

  const response = (body.response ?? {}) as Record<string, unknown>
  const { ratio, feedback } = grade(row.key, response)
  const max = row.key.max_score
  const score = Math.round(ratio * max)
  const at = now()
  const made: Attempt = {
    id: ++attemptSeq,
    assessment_id: assessmentIdValue,
    user_id: 0,
    response,
    score,
    passed: score >= passMark(max),
    feedback,
    criterion_scores: null,
    grader_meta: { source: 'deterministic', grader: 'deterministic' },
    created_at: at,
    updated_at: at,
  }
  attempts.set(assessmentIdValue, [made, ...(attempts.get(assessmentIdValue) ?? [])])

  // The lesson is complete once every question in it has been passed.
  const all = questionsOf(found).map((item) => item.assessment)
  const passed = all.filter((item) => (attempts.get(item.id) ?? []).some((one) => one.passed === true)).length
  const before = progress.get(nodeId)
  const completed = all.length > 0 && passed === all.length
  const state: ProgressState = completed || before?.state === 'completed' ? 'completed' : 'in_progress'
  progress.set(nodeId, {
    node_id: nodeId,
    state,
    time_spent_seconds: before?.time_spent_seconds ?? 0,
    completed_at: state === 'completed' ? (before?.completed_at ?? at) : null,
    last_seen_at: at,
  })

  return {
    data: made,
    meta: {
      node: { progress: { state } },
      assessments_total: all.length,
      assessments_passed: passed,
      node_completed: completed && before?.state !== 'completed',
    },
  }
}

/* -- Progress, marks and the scripted tutor --------------------------------- */

function setProgress(nodeId: number, body: Record<string, unknown>): NodeProgress {
  const found = find(nodeId)
  if (!found) throw new ApiError('Not found.', 404)
  const before = progress.get(nodeId) ?? found.node.progress
  const asked = body.state as ProgressState | undefined
  const state = asked ?? (!before || before.state === 'available' ? 'in_progress' : before.state)
  const at = now()
  const next: NodeProgress = {
    node_id: nodeId,
    state,
    time_spent_seconds: (before?.time_spent_seconds ?? 0) + Number(body.time_spent_seconds ?? 0),
    completed_at: state === 'completed' ? (before?.completed_at ?? at) : null,
    last_seen_at: at,
  }
  progress.set(nodeId, next)
  return next
}

function saveMarks(nodeId: number, rows: Annotation[]): Annotation[] {
  const list = [...(marks.get(nodeId) ?? [])]
  const at = now()
  const saved = rows.map((row) => ({ ...row, node_id: nodeId, updated_at: at }) as Annotation)
  for (const row of saved) {
    const index = list.findIndex((item) => item.uuid === row.uuid)
    if (index >= 0) list[index] = row
    else list.push(row)
  }
  marks.set(nodeId, list)
  return saved
}

function dropMark(uuid: string): boolean {
  for (const [nodeId, list] of marks) {
    if (list.some((row) => row.uuid === uuid)) {
      marks.set(nodeId, list.filter((row) => row.uuid !== uuid))
      return true
    }
  }
  return false
}

function tutor(body: Record<string, unknown>) {
  const nodeId = Number(body.node_id)
  const found = find(nodeId)
  const blocks = found?.lesson?.blocks ?? []
  const index = blocks.findIndex((_, at) => blockId(nodeId, at) === Number(body.block_id))
  const script = blocks[index]?.demo_replies ?? []
  const turns = (Array.isArray(body.history) ? body.history : []).filter(
    (turn) => (turn as { role?: string }).role === 'learner',
  ).length
  const reply = script[Math.min(turns, script.length - 1)] ?? 'Bene! Continua così.'
  return { data: { reply, correction: null, goal_met: script.length > 0 && turns >= script.length - 1 } }
}

/* -- The door ---------------------------------------------------------------- */

/** Whether a demo node has a written lesson behind it (`writeLesson` opens only those). */
export function demoLessonWritten(nodeId: number): boolean {
  return find(nodeId)?.lesson != null
}

/**
 * Answer one API request from the demo, in the API's wire shape (resources in
 * their `{ data }` envelope), or null when it is not the demo's to answer and
 * should go to the network as usual. Refusals throw `ApiError` like the API.
 */
export function answerDemoLesson(
  method: string,
  rawPath: string,
  rawBody: unknown,
): { body: unknown } | null {
  const path = rawPath.split('?')[0]!.replace(/^\/+/, '/')
  const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as Record<string, unknown>
  const verb = method.toUpperCase()
  let match: RegExpMatchArray | null

  if (verb === 'DELETE' && (match = path.match(/^\/annotations\/([\w-]+)$/))) {
    return dropMark(match[1]!) ? { body: null } : null
  }

  if (verb === 'POST' && path === '/speech/dialogue') {
    return Number(body.node_id) < 0 ? { body: tutor(body) } : null
  }

  if ((match = path.match(/^\/courses\/(-\d+)$/)) && verb === 'GET') {
    const course = courseOf(Number(match[1]))
    if (!course) throw new ApiError('Not found.', 404)
    return { body: { data: course } }
  }

  if ((match = path.match(/^\/nodes\/(-\d+)(?:\/(.*))?$/))) {
    const nodeId = Number(match[1])
    const rest = match[2] ?? ''

    if (rest === '' && verb === 'GET') {
      const node = nodeOf(nodeId)
      if (!node) throw new ApiError('Not found.', 404)
      return { body: { data: node } }
    }
    if (rest === 'progress' && verb === 'POST') return { body: { data: setProgress(nodeId, body) } }
    if (rest === 'annotations' && verb === 'GET') return { body: { data: marks.get(nodeId) ?? [] } }
    if (rest === 'annotations' && verb === 'PUT') {
      return { body: { data: saveMarks(nodeId, (body.annotations as Annotation[] | undefined) ?? []) } }
    }
    if ((rest === 'revisions' || rest === 'attachments') && verb === 'GET') return { body: { data: [] } }
  }

  if ((match = path.match(/^\/assessments\/(-\d+)\/(attempts?)$/))) {
    const id = Number(match[1])
    const nodeId = Math.trunc(id / 100)
    if (match[2] === 'attempts' && verb === 'GET') return { body: { data: attempts.get(id) ?? [] } }
    if (match[2] === 'attempt' && verb === 'POST') return { body: attempt(nodeId, id, body) }
  }

  // Everything else that names a demo id would write, rewrite or spend.
  if (/\/-\d+(?:\/|$)/.test(path)) {
    throw new ApiError(verb === 'GET' ? 'Not in the sample.' : REFUSED, verb === 'GET' ? 404 : 403)
  }
  return null
}

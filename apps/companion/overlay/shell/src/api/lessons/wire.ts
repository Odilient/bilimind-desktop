// The shapes the lesson page reads, from the records: same fields as the hosted API. What a learner must not see before
// answering (keys, reference answers) never leaves here: the player polls these while it renders the lesson.
import { LABEL } from '@bilimind/core'
import type { Raw, Rec, Store } from '../store.ts'
import type { DraftState } from './writer.ts'

export const RETIRED = 2 ** 31 - 1

const BLOCK_LABEL: Record<string, string> = {
  explainer: 'Explainer', key_points: 'Key points', example: 'Example', resource: 'Resources', video: 'Videos', quiz: 'Quiz', exam: 'Exam', project: 'Project',
  flashcards: 'Flashcards', code: 'Code exercise', reflection: 'Reflection', walkthrough: 'Walkthrough', checklist: 'Checklist', diagram: 'Diagram',
  comparison: 'Comparison', scenario: 'Scenario', reference_table: 'Reference table', worked_example: 'Worked example', playground: 'Playground',
  annotated_media: 'Annotated image', timeline: 'Timeline', analogy: 'Analogy', audio: 'Listen', speaking: 'Speak', dialogue: 'Role-play', illustration: 'Illustration', misconception: 'Common misconception',
}
export const blockLabel = (type: string) => BLOCK_LABEL[type] ?? 'Part'
const STATUS_LABEL: Record<string, string> = { stub: 'Not generated', queued: 'Queued', generating: 'Generating', ready: 'Ready', failed: 'Failed' }
const MARK_LABEL: Record<string, string> = { recommended: 'Recommended', alternative: 'Alternative', anytime: 'Learn anytime' }
const KIND_LABEL: Record<string, string> = {
  mcq: 'Multiple choice', multi_select: 'Select all that apply', short_answer: 'Short answer', cloze: 'Fill in the blank', essay: 'Essay',
  project: 'Project', code: 'Code', ordering: 'Put in order', numeric: 'Numeric answer',
}
const GRADER_LABEL: Record<string, string> = { deterministic: 'Auto-graded', llm_rubric: 'Rubric-graded', self: 'Self-assessed' }
const COURSE_STATUS: Record<string, string> = { outlined: 'Outline ready', expanding: 'Writing lessons', ready: 'Ready', failed: 'Failed' }

const FORBIDDEN = new Set(['answer_key', 'answer_keys', 'answerkey', 'accepted_answers', 'correct_answer', 'correct_answers', 'correct_option', 'correct_option_id', 'correct_option_ids', 'correct_options', 'expected_answer', 'expected_answers', 'grading_hints', 'grading_notes', 'internal_notes', 'marking_scheme', 'model_answer', 'reference_answer', 'rubric_hints', 'sample_answer', 'solution', 'solutions', 'teacher_notes'])

/** Grading fields out of anything a learner's screen is handed, however the key is spelled. */
export function scrub<T>(value: T): T {
  if (Array.isArray(value)) return value.map(scrub) as T
  if (!value || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [key, inner] of Object.entries(value)) {
    const snake = key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[- ]/g, '_').toLowerCase()
    if (FORBIDDEN.has(snake) || FORBIDDEN.has(snake.replace(/_/g, ''))) continue
    out[key] = scrub(inner)
  }
  return out as T
}

export const byPlace = (a: Rec, b: Rec) => (a.layer ?? 0) - (b.layer ?? 0) || (a.position ?? 0) - (b.position ?? 0) || a.id - b.id
export const byPosition = (a: Rec, b: Rec) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id

export const isLive = (assessment: Rec) => assessment.position !== RETIRED

const progressOf = (node: Rec) => node.progress ?? { state: 'available', time_spent_seconds: 0, completed_at: null, last_seen_at: null }

export function attemptWire(attempt: Rec, assessment?: Rec): Raw {
  const { grader_meta: meta, ...rest } = attempt
  const status = ['graded', 'pending', 'queued', 'failed', 'grading'].includes(meta?.status) ? (meta.status === 'grading' ? 'pending' : meta.status)
    : attempt.score !== null || attempt.passed !== null ? 'graded' : 'pending'
  return {
    ...rest,
    user_id: 1,
    status,
    response: scrub(attempt.response ?? {}),
    criterion_scores: scrub(attempt.criterion_scores ?? null),
    grader_meta: scrub(meta ?? null),
    ...(assessment ? { max_score: assessment.max_score } : {}),
  }
}

function publicOptions(a: Rec) {
  if (!a.options?.length) return null
  return a.options.map((o: any, i: number) => (typeof o === 'string' ? { id: String(i), text: o } : { id: String(o.id ?? i), text: String(o.text ?? o.label ?? o.value ?? '') }))
}

function publicRubric(a: Rec) {
  const rows = (a.rubric ?? []).flatMap((row: any) => {
    const name = row?.criterion ?? row?.name ?? row?.title
    if (typeof name !== 'string' || !name.trim()) return []
    const weight = Number(row.weight ?? row.points ?? 1)
    return [{ criterion: name.trim(), weight: Number.isFinite(weight) ? weight : 1 }]
  })
  return rows.length ? rows : null
}

export const passScore = (max: number) => Math.ceil(Math.max(0, max) * 70 / 100)

export function assessmentWire(store: Store, a: Rec, attempts?: Rec[]): Raw {
  const rows = attempts ?? store.recs('attempt', a.id).reverse()
  const scores = rows.map((t) => t.score).filter((s) => s !== null && s !== undefined)
  return {
    id: a.id,
    node_id: a.node_id,
    block_id: a.block_id,
    kind: a.kind,
    kind_label: KIND_LABEL[a.kind] ?? a.kind,
    prompt: a.prompt,
    options: publicOptions(a),
    input_hint: a.kind === 'numeric' ? { kind: 'numeric', unit: typeof a.answer_key?.unit === 'string' && a.answer_key.unit.trim() ? a.answer_key.unit.trim() : null } : null,
    rubric: publicRubric(a),
    grader: a.grader,
    grader_label: GRADER_LABEL[a.grader] ?? a.grader,
    graded_automatically: a.grader !== 'self',
    max_score: a.max_score,
    pass_score: passScore(a.max_score),
    position: a.position,
    attempts: rows.map((t) => attemptWire(t, a)),
    attempt_summary: {
      count: rows.length,
      best_score: scores.length ? Math.max(...scores) : null,
      passed: rows.some((t) => t.passed === true),
      last_attempt_at: rows[0]?.created_at ?? null,
    },
    created_at: a.created_at,
    updated_at: a.updated_at,
  }
}

export function blockWire(b: Rec): Raw {
  return {
    id: b.id,
    node_id: b.node_id,
    position: b.position,
    type: b.type,
    type_label: blockLabel(b.type),
    payload: scrub(b.payload ?? {}),
    source_material_ids: b.source_material_ids ?? [],
    rewriting: Boolean(b.rewriting_since),
    rewrite_error: b.rewrite_error ?? null,
  }
}

const ORIGIN = 'app://bilimind'

export function attachmentWire(a: Rec): Raw {
  const kind = a.mime?.startsWith('image/') ? 'image' : a.mime === 'application/pdf' ? 'pdf' : a.mime?.startsWith('audio/') ? 'audio' : a.mime?.startsWith('video/') ? 'video'
    : a.mime === 'application/zip' ? 'file' : 'document'
  const label = { image: 'Image', pdf: 'PDF', audio: 'Audio', video: 'Video', document: 'Document', file: 'File' }[kind]
  return {
    uuid: a.uuid, node_id: a.node_id, name: a.name, mime: a.mime, kind, kind_label: label, bytes: a.bytes, width: a.width ?? null, height: a.height ?? null,
    caption: a.caption ?? null, position: a.position, url: `${ORIGIN}/api/attachments/${a.uuid}/file`, created_at: a.created_at,
  }
}

const brief = (n: Rec) => ({ id: n.id, key: n.key, title: n.title, status: n.status, track: n.track, layer: n.layer })

/** The node without what can be a whole lesson long: what a course lists for each of its lessons. */
export function nodeSummary(node: Rec): Raw {
  return {
    id: node.id,
    course_id: node.course_id,
    key: node.key,
    title: node.title,
    summary: node.summary ?? null,
    concept_key: node.concept_key ?? null,
    archetype: node.archetype ?? null,
    archetype_label: node.archetype ? LABEL[node.archetype as keyof typeof LABEL] ?? node.archetype : null,
    track: node.track,
    track_label: node.track === 'core' ? 'On the path' : 'Under this step',
    branch_of_node_id: node.branch_of_node_id ?? null,
    mark: node.mark ?? null,
    mark_label: node.mark ? MARK_LABEL[node.mark] ?? null : null,
    group: node.group ?? null,
    note: node.note ?? null,
    section: node.section ?? null,
    layer: node.layer,
    position: node.position,
    estimated_minutes: node.estimated_minutes,
    status: node.status,
    status_label: STATUS_LABEL[node.status] ?? node.status,
    is_expanded: node.status === 'ready',
    planned_block_types: node.planned_block_types ?? [],
    failure_reason: node.failure_reason ?? null,
    writing_for: node.writing_since && (node.status === 'queued' || node.status === 'generating') ? Math.max(0, Math.round((Date.now() - Date.parse(node.writing_since)) / 1000)) : null,
    current_revision_id: node.current_revision_id ?? null,
    edited_at: node.edited_at ?? null,
    progress: progressOf(node),
    created_at: node.created_at,
    updated_at: node.updated_at,
  }
}

function edgesOf(nodes: Rec[]): { from: number; to: number; type: string }[] {
  const edges: { from: number; to: number; type: string }[] = []
  let previous: Rec | null = null
  for (const node of [...nodes].sort(byPlace)) {
    if (node.track === 'core') {
      if (previous) edges.push({ from: previous.id, to: node.id, type: 'prerequisite' })
      previous = node
    } else if (node.branch_of_node_id) {
      edges.push({ from: node.branch_of_node_id, to: node.id, type: node.mark === 'alternative' || node.mark === 'anytime' ? 'optional' : 'prerequisite' })
    }
  }
  return edges
}

/** The lesson before and after this one on the line, for the page and for the writer's prompt. */
export function neighboursOf(store: Store, node: Rec): { before: Rec[]; after: Rec[] } {
  const nodes = store.recs('node', node.course_id)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const edges = edgesOf(nodes)
  return {
    before: edges.filter((e) => e.to === node.id).flatMap((e) => byId.get(e.from) ?? []),
    after: edges.filter((e) => e.from === node.id).flatMap((e) => byId.get(e.to) ?? []),
  }
}

export function nodeWire(store: Store, node: Rec, draft?: DraftState | null): Raw {
  const course = store.rec('course', node.course_id)
  const { before, after } = neighboursOf(store, node)
  const live = store.recs('assessment', node.id).filter(isLive).sort(byPosition)
  return {
    ...nodeSummary(node),
    ...(node.status === 'queued' || node.status === 'generating' ? { draft: draft ?? null } : {}),
    blocks: store.recs('block', node.id).sort(byPosition).map(blockWire),
    attachments: store.recs('attachment', node.id).sort(byPosition).map(attachmentWire),
    assessments: live.map((a) => assessmentWire(store, a)),
    prerequisites: before.sort(byPlace).map(brief),
    next_nodes: after.sort(byPlace).map(brief),
    course: course ? { id: course.id, title: course.title, language: course.language, status: course.status } : null,
  }
}

function progressSummary(nodes: Rec[]) {
  const count = (state: string) => nodes.filter((n) => progressOf(n).state === state).length
  const completed = count('completed')
  const total = nodes.length
  return {
    total,
    available: count('available'),
    in_progress: count('in_progress'),
    completed,
    skipped: count('skipped'),
    percent: total ? Math.round((completed / total) * 100) : 0,
  }
}

export function courseWire(store: Store, course: Rec): Raw {
  const nodes = store.recs('node', course.id).sort(byPlace)
  const counts: Record<string, number> = { total: nodes.length }
  for (const status of ['stub', 'queued', 'generating', 'ready', 'failed']) counts[status] = nodes.filter((n) => n.status === status).length
  const { source_chunks: _chunks, ...rest } = course
  return {
    ...rest,
    owner: null,
    path: null,
    status_label: COURSE_STATUS[course.status] ?? course.status,
    is_generating: course.status === 'expanding',
    visibility: 'private',
    can_edit: true,
    organization: null,
    can_report: false,
    is_public: false,
    share_token: null,
    share_url: null,
    clarifying_questions: [],
    clarifying_answers: [],
    failure_reason: course.failure_reason ?? null,
    pipeline: null,
    archived_at: course.archived_at ?? null,
    deleted_at: null,
    purges_at: null,
    materials: [],
    materials_count: 0,
    schedule: null,
    node_counts: counts,
    nodes: nodes.map(nodeSummary),
    edges: edgesOf(nodes).map((e, i) => ({ id: i + 1, from_node_id: e.from, to_node_id: e.to, type: e.type, type_label: e.type === 'optional' ? 'Optional' : 'Prerequisite', constrains_order: e.type !== 'optional' })),
    progress: progressSummary(nodes),
  }
}

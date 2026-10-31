// Marking one attempt. The exact kinds go through core/grade.ts, the same marking the offline player and the CLI use; this
// file adds what only an app with attempts and a model needs: every spelling a response arrives in, self-assessment, code
// results reported by the sandbox, and the rubric marker. What can't be marked says so and scores nothing, never a guess.
import { gradeCloze, gradeCode, gradeMcq, gradeMultiSelect, gradeNumeric, gradeOrdering, isPassed, normaliseAnswer, scoreFromRatio, type GradableItem } from '@bilimind/core'
import { BilimindError, type Ctx } from '@bilimind/engine/contracts'
import { callJson } from '@bilimind/engine/llm'
import type { Raw, Rec } from '../store.ts'

export interface Marked {
  score: number | null
  passed: boolean | null
  feedback: string | null
  criterion_scores: Raw[] | null
  grader_meta: Record<string, unknown>
}

const DETERMINISTIC = ['mcq', 'multi_select', 'cloze', 'code', 'ordering', 'numeric']
const RUBRIC = ['short_answer', 'essay', 'project']

const scalar = (v: unknown) => typeof v === 'string' || typeof v === 'number'
const flat = (values: unknown[]): string[] => values.flatMap((v) => (scalar(v) ? [String(v).trim()] : Array.isArray(v) ? flat(v) : [])).filter(Boolean)

function stringValue(source: Record<string, any>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key]
    if (scalar(value) && String(value).trim()) return String(value).trim()
    if (Array.isArray(value) && flat(value).length) return flat(value)[0]!
  }
  return null
}

function stringList(source: Record<string, any>, keys: string[]): string[] {
  for (const key of keys) {
    const value = source[key]
    const list = scalar(value) ? [String(value).trim()].filter(Boolean) : Array.isArray(value) ? flat(value) : []
    if (list.length) return [...new Set(list)]
  }
  return []
}

function orderedStrings(source: Record<string, any>, keys: string[]): string[] {
  for (const key of keys) {
    const value = source[key]
    if (!Array.isArray(value)) continue
    const ordered = value.map((v) => (scalar(v) ? String(v).trim() : ''))
    if (ordered.some(Boolean)) return ordered
  }
  return []
}

const MISSING = 'This item has no answer key, so it cannot be auto-graded.'

function notMarked(feedback: string, reason: string, assessment: Rec): Marked {
  return { score: null, passed: null, feedback, criterion_scores: null, grader_meta: { status: 'failed', reason, grader: assessment.grader, assessment_kind: assessment.kind } }
}

function fromCore(assessment: Rec, r: ReturnType<typeof gradeMcq>): Marked {
  if (r.status === 'pending') return notMarked(MISSING, 'no_answer_key', assessment)
  return {
    score: r.score,
    passed: r.passed,
    feedback: r.feedback,
    criterion_scores: null,
    grader_meta: { status: 'graded', source: 'deterministic', grader: 'deterministic', ...(r.meta ?? {}) },
  }
}

function selfMarked(assessment: Rec, response: Record<string, any>): Marked {
  const note = ['note', 'notes', 'text', 'reflection', 'comment'].map((k) => response[k]).find((v) => typeof v === 'string' && v.trim())?.trim() as string | undefined
  return {
    score: null,
    passed: true,
    feedback: note
      ? `Marked complete by you, with your note kept on the attempt: "${note.length > 240 ? `${note.slice(0, 240)}...` : note}"`
      : 'Marked complete by you. Nothing was auto-graded here — revisit it later if you want to check yourself again.',
    criterion_scores: null,
    grader_meta: { status: 'graded', source: 'self_report', grader: 'self', assessment_kind: assessment.kind, scored: false, has_note: Boolean(note) },
  }
}

/** The tests a code block declares, by name: a string, `{name}`, `{call}`, or its place in the list. */
function declaredTests(assessment: Rec, blockPayload: Raw | null): string[] {
  const fromKey = assessment.answer_key?.tests
  const sources: unknown[] = Array.isArray(fromKey) && fromKey.length ? fromKey : Array.isArray(blockPayload?.tests) ? blockPayload!.tests : []
  const names = sources.map((test: any, i) => (typeof test === 'string' ? test : scalar(test?.name) ? String(test.name) : scalar(test?.call) ? String(test.call) : `test ${i + 1}`))
  return [...new Set(names)]
}

const truthy = (v: unknown) => v === true || v === 1 || (typeof v === 'string' && ['1', 'true', 'on', 'yes'].includes(v.toLowerCase()))

function markCode(assessment: Rec, response: Record<string, any>, blockPayload: Raw | null): Marked {
  const declared = declaredTests(assessment, blockPayload)
  const reported = new Map<string, boolean>()
  const tests = response.tests ?? response.results ?? []
  if (Array.isArray(tests)) {
    tests.forEach((test: any, i: number) => {
      if (test && typeof test === 'object') reported.set(scalar(test.name) ? String(test.name) : `test ${i + 1}`, truthy(test.passed ?? test.pass ?? test.ok))
    })
  }
  const timedOut = truthy(response.timed_out)
  const sandbox = { source: 'client_worker', grader: 'deterministic', executed_by: 'sandbox', timed_out: timedOut }
  const names = declared.length ? declared : [...reported.keys()]
  if (!names.length) {
    return {
      score: null,
      passed: true,
      feedback: 'There is nothing here that can be checked automatically, so this counts as done when you say it is. Read your work back against what the exercise asked for before you move on.',
      criterion_scores: null,
      grader_meta: { status: 'graded', ...sandbox, rule: 'no_declared_checks', grader: 'self', downgraded_from: 'deterministic', scored: false, tests_declared: 0, tests_reported: 0 },
    }
  }
  const passed = names.filter((n) => reported.get(n) === true)
  const failed = names.filter((n) => reported.get(n) !== true)
  const r = gradeCode({ ...assessment, grader: 'deterministic' } as unknown as GradableItem, passed, names, timedOut)
  return {
    score: r.score,
    passed: r.passed,
    feedback: r.feedback,
    criterion_scores: null,
    grader_meta: { status: 'graded', ...sandbox, rule: 'declared_test_results', tests_declared: declared.length, tests_reported: reported.size, tests_passed: passed.length, tests_failed: failed, tests_not_reported: names.filter((n) => !reported.has(n)), tests_unrecognised: [...reported.keys()].filter((n) => !names.includes(n)) },
  }
}

export function markExact(assessment: Rec, response: Record<string, any>, blockPayload: Raw | null): Marked {
  const item = assessment as unknown as GradableItem
  switch (assessment.kind) {
    case 'mcq': return fromCore(assessment, gradeMcq(item, stringValue(response, ['option_id', 'selected', 'value', 'answer', 'choice'])))
    case 'multi_select': return fromCore(assessment, gradeMultiSelect(item, stringList(response, ['option_ids', 'selected', 'values', 'answers', 'choices'])))
    case 'ordering': return fromCore(assessment, gradeOrdering(item, orderedStrings(response, ['order', 'option_ids', 'sequence', 'values', 'answers'])))
    case 'numeric': return fromCore(assessment, gradeNumeric(item, stringValue(response, ['value', 'answer', 'text', 'number'])))
    case 'cloze': {
      const given = orderedStrings(response, ['blanks', 'answers', 'values'])
      const single = stringValue(response, ['text', 'answer', 'value'])
      return fromCore(assessment, gradeCloze(item, given.length ? given : single === null ? [] : [single]))
    }
    default: return markCode(assessment, response, blockPayload)
  }
}

/** Which marker this question really gets: the one it asks for when that one can mark its kind. */
export function markerOf(assessment: Rec): 'deterministic' | 'llm_rubric' | 'self' {
  if (assessment.grader === 'self') return 'self'
  if (assessment.grader === 'deterministic' && DETERMINISTIC.includes(assessment.kind)) return 'deterministic'
  if (assessment.grader === 'llm_rubric' && RUBRIC.includes(assessment.kind)) return 'llm_rubric'
  return RUBRIC.includes(assessment.kind) ? 'llm_rubric' : 'deterministic'
}

// ---------- the rubric marker ----------

const BANNED = ['Great job!', 'Good effort!', 'Well done!', 'Nice work!', 'You did a good job of explaining the topic.', 'This is a solid answer.', 'Keep up the good work.', 'You could add more detail.']

const rubricSystem = (language: string) => `You are an exacting but generous teacher grading one piece of a learner's work.
You are not a cheerleader and you are not a gatekeeper: you are the person who
tells them precisely what they got right, what they got wrong, and what to do next.

HOW TO GRADE
- Grade ONLY against the rubric criteria you are given. Do not invent criteria,
  do not grade spelling or length unless a criterion asks for it.
- For each criterion, decide which level descriptor the work actually matches
  (excellent / acceptable / poor) and convert that to score_0_to_1:
    1.0  = fully meets the "excellent" descriptor
    0.7  = meets the "acceptable" descriptor
    0.3  = closer to "poor" than to "acceptable" but shows partial understanding
    0.0  = does not address this criterion at all, or is factually wrong on it
  Values in between are allowed and encouraged. Use the full range — a rubric
  where every criterion scores 0.9 is a rubric you did not apply.
- Judge the work in front of you. Never reward intent, effort, formatting or
  confidence. A well-written wrong answer is a wrong answer, and you must say so.
- Factual errors matter more than style. Name them.

HOW TO WRITE FEEDBACK — this is the part that must not be generic
- Every "comment" and the overall "feedback" MUST reference what the learner
  ACTUALLY WROTE. Quote at least one short phrase from their submission verbatim,
  inside double quotes, in the overall feedback.
- Then say what is right about it, what is wrong or missing, and give ONE concrete
  next step ("rewrite the second paragraph to explain why X causes Y, not just that
  it does").
- Feedback that would fit any answer to any question is a failure. If you could
  paste your feedback under a different learner's submission and it would still
  read fine, rewrite it.
- These sentences are BANNED, on their own or as an opening:
${BANNED.map((p) => `  - "${p}"`).join('\n')}
- Do not restate the question. Do not summarise the rubric back. Do not pad.
- Address the learner directly as "you". 2-6 sentences.
- If the submission is empty, off-topic or a refusal, score it honestly at 0 and
  say plainly what was expected instead.

LANGUAGE
- Write every comment and the feedback in ${language}. Keep the criterion names
  exactly as given, unchanged, so they can be matched back.`

const KIND_LABEL: Record<string, string> = { short_answer: 'Short answer', essay: 'Essay', project: 'Project' }
const LEVELS = ['excellent', 'acceptable', 'poor'] as const

function rubricUser(assessment: Rec, rubric: Raw[], submission: string, course: string | null, node: string | null): string {
  const context = [course ? `Course: ${course}` : null, node ? `Lesson: ${node}` : null, `Item type: ${KIND_LABEL[assessment.kind] ?? assessment.kind}`].filter(Boolean).join('\n')
  const criteria = rubric.map((c, i) => [
    `${i + 1}. ${c.criterion}  (weight ${Number(c.weight.toFixed(2))})`,
    ...LEVELS.flatMap((level) => (typeof c[level] === 'string' && c[level].trim() ? [`   - ${level[0]!.toUpperCase()}${level.slice(1)}: ${c[level].trim()}`] : [])),
  ].join('\n')).join('\n')
  const body = submission.trim()
  return `${context}

===== THE TASK THE LEARNER WAS SET =====
${String(assessment.prompt).trim()}

===== RUBRIC (grade against exactly these, and only these) =====
${criteria}

===== THE LEARNER'S SUBMISSION (${body.split(/\s+/u).filter(Boolean).length} words) =====
${body}
===== END OF SUBMISSION =====

Return one criterion_scores entry per rubric criterion above, in the same order,
copying each criterion name exactly. Then give the overall feedback, quoting at
least one phrase from the submission above verbatim in double quotes.`
}

const rubricRetry = (base: string, rejected: string) => `${base}

===== REJECTED DRAFT — DO NOT REPEAT IT =====
A previous attempt produced this feedback, which was rejected for being generic:
"${rejected.trim().slice(0, 600)}"

It failed because it did not engage with the learner's actual words. Write new
feedback that quotes a specific phrase from the submission above verbatim in
double quotes, names one concrete thing that is right, one concrete thing that is
wrong or missing, and one specific next step. Keep the criterion scores honest.`

const RUBRIC_SCHEMA = {
  type: 'object',
  required: ['criterion_scores', 'score', 'passed', 'feedback'],
  properties: {
    criterion_scores: {
      type: 'array', minItems: 1, maxItems: 12, description: 'one entry per rubric criterion, in the order given',
      items: {
        type: 'object', required: ['criterion', 'score_0_to_1', 'comment'],
        properties: {
          criterion: { type: 'string', minLength: 2, description: 'the criterion name copied EXACTLY as given' },
          score_0_to_1: { type: 'number', minimum: 0, maximum: 1, description: '1.0 excellent, 0.7 acceptable, 0.3 partial, 0.0 absent or wrong' },
          comment: { type: 'string', minLength: 25, description: 'the evidence in the submission that justifies this score' },
        },
      },
    },
    score: { type: 'integer', minimum: 0, maximum: 100, description: 'your own overall 0-100 estimate (the server recomputes the real weighted score)' },
    passed: { type: 'boolean', description: 'whether the work is good enough to move on' },
    feedback: { type: 'string', minLength: 80, description: 'learner-facing, 2-6 sentences, MUST quote a phrase from the submission verbatim in double quotes' },
  },
}

function descriptor(entry: Raw, keys: string[]): string | null {
  for (const key of keys) if (typeof entry[key] === 'string' && entry[key].trim()) return entry[key].trim()
  return null
}

function defaultRubric(assessment: Rec): Raw[] {
  const work = assessment.kind === 'project' ? 'deliverable' : 'answer'
  return [
    { criterion: 'Accuracy', weight: 0.5, excellent: `Every claim in the ${work} is correct and the reasoning holds up.`, acceptable: 'Mostly correct, with a minor slip that does not undermine the conclusion.', poor: 'Contains a factual or logical error at the centre of the task.' },
    { criterion: 'Completeness', weight: 0.3, excellent: 'Addresses every part of what was asked, with supporting detail.', acceptable: 'Addresses the main ask but leaves a secondary part thin.', poor: 'Leaves a substantial part of the task unanswered.' },
    { criterion: 'Clarity', weight: 0.2, excellent: 'A reader could follow the reasoning without re-reading; terms are used precisely.', acceptable: 'Understandable, though the structure or terminology wobbles in places.', poor: 'Hard to follow, or key terms are used loosely enough to obscure the meaning.' },
  ]
}

export function normaliseRubric(assessment: Rec): Raw[] {
  const rows = (Array.isArray(assessment.rubric) ? assessment.rubric : []).flatMap((entry: any) => {
    if (!entry || typeof entry !== 'object') return []
    const name = String(entry.criterion ?? entry.name ?? entry.title ?? '').trim()
    if (!name) return []
    const raw = Number(entry.weight ?? entry.points ?? 1)
    return [{
      criterion: name,
      weight: raw > 0 ? raw : 1,
      excellent: descriptor(entry, ['excellent', 'exemplary', 'strong', 'high']),
      acceptable: descriptor(entry, ['acceptable', 'adequate', 'satisfactory', 'medium']),
      poor: descriptor(entry, ['poor', 'weak', 'insufficient', 'low']),
    }]
  })
  return rows.length ? rows : defaultRubric(assessment)
}

function submissionText(assessment: Rec, response: Record<string, any>): string {
  const parts: string[] = []
  for (const key of ['text', 'answer', 'body', 'markdown', 'submission']) {
    if (typeof response[key] === 'string' && response[key].trim()) { parts.push(response[key].trim()); break }
  }
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => scalar(x) && String(x).trim()).map((x) => String(x).trim()) : [])
  if (assessment.kind === 'project') {
    const done = list(response.deliverables)
    if (done.length) parts.push(`Deliverables the learner reports completing:\n${done.map((x) => `- ${x}`).join('\n')}`)
    const links = list(response.links)
    if (links.length) parts.push(`Links submitted:\n${links.map((x) => `- ${x}`).join('\n')}`)
  }
  const notes = response.notes ?? response.note
  if (typeof notes === 'string' && notes.trim()) parts.push(parts.length ? `Learner's notes:\n${notes.trim()}` : notes.trim())
  return parts.join('\n\n').slice(0, 40_000)
}

const GENERIC = [
  /^\s*(great|good|nice|excellent|fantastic|awesome|well done|solid)\b[^.!?]*[.!?]\s*$/iu,
  /^\s*(keep (it )?up|keep going|good luck)\b/iu,
  /^\s*(your answer is|this answer is|the answer is) (good|great|fine|correct|solid|acceptable)\.?\s*$/iu,
]
const QUOTED = /["“‘«]([^"”’»]{3,240})["”’»]/gu

const keywords = (value: string, min = 5) => [...new Set(normaliseAnswer(value).split(' ').filter((w: string) => [...w].length >= min))]

function referencesSubmission(feedback: string, submission: string): boolean {
  const said = normaliseAnswer(feedback)
  const wrote = normaliseAnswer(submission)
  if (!said || !wrote) return false
  for (const match of feedback.matchAll(QUOTED)) {
    const quote = normaliseAnswer(match[1]!.trim())
    if (quote && wrote.includes(quote)) return true
  }
  let words = keywords(submission)
  if (!words.length) words = keywords(submission, 3)
  if (!words.length) return false
  let hits = 0
  for (const word of words) {
    if (said.includes(word)) hits++
    if (hits >= 2) return true
  }
  return hits >= Math.min(2, words.length)
}

export function feedbackAcceptable(feedback: string, submission: string): boolean {
  const text = feedback.trim()
  return [...text].length >= 60 && !GENERIC.some((p) => p.test(text)) && referencesSubmission(text, submission)
}

function breakdown(rubric: Raw[], decoded: Raw, maxScore: number) {
  const returned: Raw[] = (Array.isArray(decoded.criterion_scores) ? decoded.criterion_scores : []).filter((e: unknown) => e && typeof e === 'object')
  const byName = new Map<string, Raw>()
  for (const entry of returned) {
    const name = normaliseAnswer(String(entry.criterion ?? ''))
    if (name && !byName.has(name)) byName.set(name, entry)
  }
  const total = rubric.reduce((sum, c) => sum + c.weight, 0) || 1
  const unmatched: string[] = []
  let weighted = 0
  const rows = rubric.map((criterion, index) => {
    const share = criterion.weight / total
    const entry = byName.get(normaliseAnswer(criterion.criterion)) ?? returned[index]
    if (!entry) unmatched.push(criterion.criterion)
    const ratio = entry ? Math.max(0, Math.min(1, Number(entry.score_0_to_1) || 0)) : 0
    const comment = entry ? String(entry.comment ?? '').trim() : ''
    weighted += share * ratio
    return {
      criterion: criterion.criterion,
      weight: Math.round(criterion.weight * 10_000) / 10_000,
      score_0_to_1: Math.round(ratio * 1000) / 1000,
      points: Math.round(share * ratio * maxScore * 10) / 10,
      max_points: Math.round(share * maxScore * 10) / 10,
      comment: comment || null,
    }
  })
  return { score: scoreFromRatio(weighted, maxScore), rows, unmatched }
}

export interface RubricContext {
  ctx: Ctx
  language: string
  course: string | null
  node: string | null
  fallbackFetch?: typeof fetch
}

export async function markWithRubric(assessment: Rec, response: Record<string, any>, c: RubricContext): Promise<Marked> {
  const submission = submissionText(assessment, response)
  const max = assessment.max_score
  if (!submission.trim()) {
    return {
      score: 0,
      passed: isPassed(0, max),
      feedback: 'There was nothing to grade — your submission came through empty. Write your answer out in full and submit it again; even a rough first attempt gives you something to improve.',
      criterion_scores: null,
      grader_meta: { status: 'graded', source: 'llm_rubric', grader: 'llm_rubric', llm_called: false, reason: 'empty_submission' },
    }
  }
  const rubric = normaliseRubric(assessment)
  const system = rubricSystem(c.language)
  const user = rubricUser(assessment, rubric, submission, c.course, c.node)
  const ask = (prompt: string) => callJson<Raw>(c.ctx, { stage: 'grade' as never, system, user: prompt, schema: RUBRIC_SCHEMA, fallbackFetch: c.fallbackFetch })
  let decoded = (await ask(user)).data
  let feedback = String(decoded.feedback ?? '').trim()
  let reasked = false
  if (!feedbackAcceptable(feedback, submission)) {
    reasked = true
    decoded = (await ask(rubricRetry(user, feedback))).data
    feedback = String(decoded.feedback ?? feedback).trim()
  }
  const { score, rows, unmatched } = breakdown(rubric, decoded, max)
  return {
    score,
    passed: isPassed(score, max),
    feedback,
    criterion_scores: rows,
    grader_meta: {
      status: 'graded', source: 'llm_rubric', grader: 'llm_rubric', llm_called: true, scoring: 'weighted_criterion_scores', criteria_count: rubric.length,
      rubric_source: assessment.rubric?.length ? 'assessment' : 'default', unmatched_criteria: unmatched, model_reported_score: decoded.score ?? null,
      model_reported_passed: decoded.passed ?? null, feedback_reasked: reasked,
    },
  }
}

/** The answer is kept; the mark isn't made up. They see this and can submit again once the model is back. */
export function rubricUnavailable(assessment: Rec, error: unknown, hasKey: boolean): Marked {
  const why = !hasKey
    ? "This answer is marked by your AI model, and there's no key on this computer yet. Your answer is saved. Add a key in Settings and submit it again."
    : `This answer couldn't be marked just now${error instanceof BilimindError && error.message ? `: ${error.message}` : '.'} Your answer is saved, and nothing was scored. Submit it again when your AI model is reachable.`
  return notMarked(why, 'grader_unavailable', assessment)
}

export { selfMarked }

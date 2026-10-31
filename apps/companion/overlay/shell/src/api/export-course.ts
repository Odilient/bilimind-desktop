// A course as an offline page: the same player the CLI's courses open in, with this course poured in. Only what's written
// goes in; a topic with no lesson stays on the path as not written.
import { fromSaasLesson, injectCourse, parseCourse, plannedBlockTypes, type Archetype } from '@bilimind/core'
import type { Raw, Rec, Store } from './store.ts'
import { byPlace, byPosition, isLive } from './lessons/wire.ts'

const iso = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z')

export function courseToJson(store: Store, course: Rec): Raw {
  const nodes = store.recs('node', course.id).sort(byPlace)
  const written = nodes.filter((n) => n.status === 'ready' && store.recs('block', n.id).length)
  if (!written.length) throw new Error('nothing written')
  let n = 0
  const lessons = written.map((node) => {
    const assessments = store.recs('assessment', node.id).filter(isLive).sort(byPosition)
    const blocks = store.recs('block', node.id).sort(byPosition).map((b) => {
      const { assessment_ids: _ids, ...payload } = b.payload ?? {}
      return {
        id: `b${b.id}`,
        type: b.type,
        payload,
        source_material_ids: null,
        assessments: assessments.filter((a) => a.block_id === b.id).map((a) => ({ id: `q${a.id}`, kind: a.kind, prompt: a.prompt, bloom: a.bloom ?? 'understand', grader: a.grader, max_score: a.max_score, ...(a.options ? { options: a.options } : {}), ...(a.answer_key ? { answer_key: a.answer_key } : {}), ...(a.rubric ? { rubric: a.rubric } : {}), ...(a.explanation ? { explanation: a.explanation } : {}) })),
      }
    })
    const parent = node.branch_of_node_id ? store.rec('node', node.branch_of_node_id)?.key ?? null : null
    return fromSaasLesson({ key: node.key, blocks } as never, {
      id: node.key,
      n: ++n,
      title: node.title,
      summary: node.summary ?? '',
      archetype: (node.archetype ?? 'conceptual') as Archetype,
      minutes: node.estimated_minutes,
      track: node.track,
      parent,
      mark: node.mark ?? null,
      section: node.section ?? null,
      day: null,
    } as never)
  })
  const writtenKeys = new Set(written.map((w) => w.key))
  const itemOf = (node: Rec) => ({ id: node.key, title: node.title, mark: node.mark ?? null, lesson: writtenKeys.has(node.key) ? node.key : null, group: node.group ?? null, minutes: node.estimated_minutes, ...(writtenKeys.has(node.key) ? {} : { cut: true }) })
  const path = nodes.filter((node) => node.track === 'core').map((node, step) => ({
    id: node.key,
    step: step + 1,
    title: node.title,
    section: node.section ?? null,
    lesson: writtenKeys.has(node.key) ? node.key : null,
    minutes: node.estimated_minutes,
    note: node.note ?? null,
    summary: node.summary ?? '',
    archetype: node.archetype ?? 'conceptual',
    formats: plannedBlockTypes((node.archetype ?? 'conceptual') as Archetype),
    weight: null,
    cut: !writtenKeys.has(node.key),
    cut_reason: writtenKeys.has(node.key) ? null : 'Not written yet.',
    items: nodes.filter((c) => c.branch_of_node_id === node.id).map(itemOf),
  }))
  const items = lessons.flatMap((l) => l.blocks.flatMap((b: Raw) => b.assessments ?? []))
  return {
    schema: 'bilimind.course/1',
    id: `course-${course.id}`,
    title: course.title,
    lede: `${lessons.length} lessons, written with your own AI key.`,
    skin: 'lime',
    object: 'img/obj-book.webp',
    chips: [],
    language: course.language ?? 'en',
    built_at: iso(),
    allows_code: Boolean(course.allows_code),
    code_language: course.code_language ?? null,
    goal: { sentence: course.goal ?? course.topic ?? course.title, exam_at: null, deadline: null, minutes_per_day: 30, audience: 'student', assumptions: [], timezone: 'UTC' },
    plan: { days: [], weights: [], cut: [], capacity_min: 0, used_min: 0, warnings: [] },
    path,
    further: [],
    lessons,
    narration: null,
    receipts: { files: 0, pages: 0, steps: 0, lessons: lessons.length, agents: 0, checks: { run: 0, passed: 0, repaired: 0, flagged: 0 }, tests: { run: 0, passed: 0 }, code_fixed: 0, quiz_checked: 0, quiz_items: items.length, cut_steps: path.filter((p) => p.cut).length, blocks: lessons.reduce((k, l) => k + l.blocks.length, 0), items: items.length, code_exercises: 0, rejected: 0, rewritten: 0, labels: { beyond_slides: 0 }, narration_min: 0, cards: 0, minutes: lessons.reduce((k, l) => k + (l.minutes ?? 0), 0), cost_usd: 0, credits: null, wall_ms: 0, log: [], excluded: [] },
    sources: [],
    exports: [],
    review: { generated_at: iso(), cards: [] },
  }
}

export function exportHtml(store: Store, course: Rec, template: string): string {
  return injectCourse(template, parseCourse(courseToJson(store, course)))
}

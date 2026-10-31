// Building a course from a folder, in the chat: the older pipeline, which runs for a long while in a process of its own
// (ingest, outline, write, re-solve every auto-marked answer against the files, build), then lands in the database as
// an ordinary course. The Checker's report comes with it, as a file in the course. The folder comes only from the
// app's own dialog: the chat holds a token for it, never a path it could have been handed.
import { BilimindError, type EngineConfig } from '@bilimind/engine/contracts'
import { readIngest } from '@bilimind/engine/ingest/index'
import { lessonSources, teachingChunks } from '@bilimind/engine/prompts/context'
import type { Chunk } from '@bilimind/core'
import { copyFileSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { dayKey } from '../../../../app/companion/time.ts'
import { createRow } from '../rows.ts'
import { wireTime, type Raw, type Rec, type Store } from '../store.ts'
import { replaceContent, type WrittenBlock } from './blocks.ts'
import { planned } from './path.ts'
import { record } from './revisions.ts'

const READABLE = /\.(pdf|docx|pptx|xlsx|txt|md|csv|html?)$/i
const MAX_SCAN = 500

export interface FolderDeps {
  /** The system's folder dialog. */
  pick(): Promise<string | null>
  /** Run the pipeline to the end. Rejects with what went wrong. */
  build(input: { src: string; sentence: string; outRoot: string; config: EngineConfig; progress: (text: string) => void }): Promise<{ course: string }>
  /** Kill a running build. */
  stop(): void
}

function readableFiles(folder: string): number {
  let count = 0
  const walk = (dir: string, depth: number) => {
    if (depth > 4 || count >= MAX_SCAN) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      if (entry.isDirectory()) walk(join(dir, entry.name), depth + 1)
      else if (READABLE.test(entry.name)) count++
    }
  }
  try { walk(folder, 0) } catch { /* whatever it could read */ }
  return count
}

/** What's in a built course goes in as an ordinary one: a goal, a path of topics, lessons with their questions. */
export function importBuilt(store: Store, built: Raw, folder: string, zone: string, filesDir: string): { subject: Raw; report: Raw | null; course: Rec } {
  const today = dayKey(Date.now())
  const goalIn: Raw = built.goal ?? {}
  const minutes = Number(goalIn.minutes_per_day) > 0 ? Number(goalIn.minutes_per_day) : 45
  const ends = typeof goalIn.deadline === 'string' && goalIn.deadline > today ? goalIn.deadline : null
  const goal = createRow(store, 'goals', {
    title: String(built.title).slice(0, 200),
    kind: 'self',
    starts_on: today,
    ends_on: ends,
    finish_kind: goalIn.exam_at ? 'exam' : ends ? 'date' : 'none',
    finish_label: goalIn.exam_at ? 'Exam' : null,
    sessions_per_week: 7,
    minutes_per_session: minutes,
    timezone: zone,
    status: 'active',
  })
  const used = store.live('subjects').map((s) => s.color)
  const subject = createRow(store, 'subjects', {
    goal_id: goal.id,
    title: String(built.title).slice(0, 200),
    color: ['db', 'net', 'prg', 'mth', 'seg', 'eng', 'ita'].find((c) => !used.includes(c)) ?? 'c8',
    source: 'import',
    format: 'path',
    position: Math.max(-1, ...store.live('subjects').map((s) => Number(s.position) || 0)) + 1,
  })
  const course = store.add('course', null, {
    uuid: crypto.randomUUID(),
    slug: null,
    title: String(built.title).slice(0, 200),
    topic: String(goalIn.sentence ?? built.title),
    language: built.language ?? 'en',
    allows_code: Boolean(built.allows_code),
    code_language: built.code_language ?? null,
    level: null,
    goal: goalIn.sentence ?? null,
    minutes_per_week: null,
    source_type: 'materials',
    status: 'ready',
    further: built.further ?? [],
    settings: { formats_preferred: [], depth: 'standard', include_code: Boolean(built.allows_code), companion_subject_id: subject.id },
    folder,
    built_cost_usd: Number(built.receipts?.cost_usd) || 0,
    checks: built.receipts?.checks ?? null,
  })
  store.put('subjects', { ...subject, generated_course_id: course.id })

  const lessons = new Map<string, Raw>((built.lessons ?? []).map((l: Raw) => [l.id, l]))
  const places: Raw[] = (built.path?.length ? built.path : (built.lessons ?? []).map((l: Raw) => ({ id: l.id, title: l.title, summary: l.summary, lesson: l.id, minutes: l.minutes, archetype: l.archetype, section: l.section })))
  let previous: string | null = null
  places.forEach((place: Raw, position: number) => {
    const lesson = place.lesson ? lessons.get(place.lesson) : null
    const topic = createRow(store, 'topics', { subject_id: subject.id, title: String(place.title).slice(0, 300), summary: place.summary ?? lesson?.summary ?? null, position, source: 'extracted' })
    const section = place.section && place.section !== previous ? place.section : null
    previous = place.section ?? previous
    const archetype = lesson?.archetype ?? place.archetype ?? null
    const node = store.add('node', course.id, {
      course_id: course.id,
      key: String(place.id),
      title: String(lesson?.title ?? place.title),
      summary: lesson?.summary ?? place.summary ?? null,
      concept_key: String(place.title),
      archetype,
      planned_block_types: archetype ? planned(archetype) : [],
      track: 'core',
      branch_of_node_id: null,
      section,
      note: place.note ?? null,
      layer: position,
      position: 0,
      estimated_minutes: Number(lesson?.minutes ?? place.minutes) > 0 ? Number(lesson?.minutes ?? place.minutes) : minutes,
      status: lesson ? 'ready' : 'stub',
      topic_id: topic.id,
    })
    store.put('topics', { ...store.get('topics', topic.id)!, node_id: node.id })
    if (!lesson) return
    const blocks: WrittenBlock[] = (lesson.blocks as Raw[]).map((b) => {
      // A block's sources by which file, so its chip counts them: the quotes themselves are in the report.
      const files = [...new Set((b.cites ?? []).map((c: Raw) => c.file))] as string[]
      const titled = b.title && b.type === 'explainer' ? { ...b.payload, markdown: `## ${b.title}\n\n${b.payload.markdown ?? ''}` } : b.payload
      return {
        type: b.type,
        payload: titled,
        source_material_ids: files.length ? files.map((_, i) => i + 1) : null,
        assessments: (b.assessments ?? []).map((a: Raw) => ({ kind: a.kind, prompt: a.prompt, options: a.options ?? null, answer_key: a.answer_key ?? null, rubric: a.rubric ?? null, grader: a.grader ?? 'deterministic', max_score: a.max_score ?? 100, bloom: a.bloom, explanation: a.explanation, verdict: a.verdict ?? null })),
      }
    })
    replaceContent(store, node, blocks)
    record(store, store.rec('node', node.id)!, 'generated')
  })

  if (goalIn.exam_at && Date.parse(goalIn.exam_at) > Date.now()) {
    createRow(store, 'deadlines', {
      subject_id: subject.id,
      kind: 'exam',
      title: 'Exam',
      due_at: wireTime(goalIn.exam_at),
      all_day: false,
      confidence: 'own',
      status: 'upcoming',
      sources: [{ kind: 'user', confidence: 'own', evidence: `"${String(goalIn.sentence ?? '').slice(0, 300)}"` }],
      topic_ids: [],
    })
  }

  let report: Raw | null = null
  const from = join(folder, 'REPORT.md')
  if (existsSync(from)) {
    const id = crypto.randomUUID()
    const stored = `${id}.md`
    copyFileSync(from, join(filesDir, stored))
    report = createRow(store, 'items', {
      id,
      subject_id: subject.id,
      kind: 'file',
      title: `What was checked in ${String(built.title).slice(0, 200)}.md`,
      preview: readFileSync(from, 'utf8').slice(0, 4000),
      meta: { path: stored, mime: 'text/markdown', size: statSync(from).size },
      source: 'made',
    })
  }
  return { subject: store.get('subjects', subject.id)!, report, course }
}

/** A later lesson of a folder's course reads the same files the first ones did. */
export function chunksForLesson(course: Rec, node: Rec): Chunk[] {
  if (!course.folder) return []
  try {
    const pool = teachingChunks(readIngest(course.folder))
    return pool.length ? lessonSources(pool, { title: node.title, summary: node.summary ?? undefined, concept_key: node.concept_key ?? undefined }).chunks : []
  } catch {
    return []
  }
}

export function folderBuilds(store: Store, deps: { dataDir: string; filesDir: string; zone: () => string; host?: FolderDeps }) {
  const picked = new Map<string, string>()
  let running = false

  return {
    running: () => running,

    stop(): boolean {
      if (!running || !deps.host) return false
      deps.host.stop()
      return true
    },

    async pick() {
      const folder = await deps.host?.pick()
      if (!folder) return null
      const id = crypto.randomUUID()
      picked.set(id, folder)
      return { id: `folder:${id}`, title: basename(folder), files: readableFiles(folder) }
    },

    /** Runs to its end whether or not anyone is still watching: leaving the chat doesn't stop it, and its cap bounds it. */
    async build(id: string, message: string, config: EngineConfig, progress: (text: string) => void): Promise<{ text: string; actions: Raw[] }> {
      const folder = picked.get(id)
      const say = (text: string) => ({ text, actions: [] })
      if (!deps.host) return say("Building from a folder isn't available here.")
      if (!folder) return say('That folder needs picking again: I only remember one until the app closes.')
      if (running) return say("I'm already building a course from a folder. One at a time: the next can start when it's finished.")
      if (!readableFiles(folder)) return say(`I couldn't find anything to read in ${basename(folder)}. PDFs, slides, documents and text files all work.`)
      running = true
      progress(`Reading ${basename(folder)}. This takes several minutes, and it keeps going if you leave this chat.`)
      try {
        const out = await deps.host.build({
          src: folder,
          sentence: message.trim() || `Build a course from what's in ${basename(folder)}.`,
          outRoot: join(deps.dataDir, 'built'),
          config,
          progress,
        })
        const built = JSON.parse(readFileSync(join(out.course, 'course.json'), 'utf8')) as Raw
        const { subject, report } = store.tx(() => importBuilt(store, built, out.course, deps.zone(), deps.filesDir))
        const r = built.receipts ?? {}
        const lines = [
          `**${built.title}** is ready: ${r.lessons ?? built.lessons?.length ?? 0} lessons from ${r.files ?? 0} files.`,
          r.quiz_items ? `I checked ${r.quiz_checked ?? 0} of its ${r.quiz_items} auto-marked answers against your files${r.rejected ? `, threw out ${r.rejected} they contradicted` : ''}${r.rewritten ? ` and rewrote ${r.rewritten}` : ''}.` : null,
          typeof r.cost_usd === 'number' ? `It cost $${r.cost_usd.toFixed(2)} on your key.` : null,
        ]
        return {
          text: lines.filter(Boolean).join(' '),
          actions: [
            { type: 'open', to: `/app/courses/${subject.id}`, label: 'Open the course' },
            ...(report ? [{ type: 'open', to: `/app/notes/${report.id}`, label: 'See what was checked' }] : []),
          ],
        }
      } catch (error) {
        if (error instanceof BilimindError && error.message) return say(`I couldn't finish building that course. ${error.message}`)
        console.error('folder build', error)
        return say("I couldn't finish building that course. Whatever it spent is in Settings, under Spending.")
      } finally {
        running = false
      }
    },
  }
}


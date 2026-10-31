// The routes a course and its lessons answer. `answer` runs inside the request's transaction, so everything in it is
// synchronous; `early` takes what has a file for a body or waits on a model.
import { BLOCK_TYPES } from '@bilimind/core'
import { unlinkSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { ACCEPTED, cleanName, MAX_UPLOAD_BYTES, serveFile, sniff } from '../files.ts'
import { createCourse, propose } from '../ask/propose.ts'
import type { Reader } from '../ask/grounding.ts'
import type { KeyState } from '../ask/asker.ts'
import { setEngineConfig } from '@bilimind/engine/llm'
import { message, json, notFound, ok, empty } from '../respond.ts'
import { Invalid, UUID } from '../rules.ts'
import type { Rec, Store } from '../store.ts'
import { attemptEnvelope, attemptsList, setProgress, syncProgress } from './attempts.ts'
import { syncBlocks, type BlockSpec } from './blocks.ts'
import { markerOf, markExact, markWithRubric, rubricUnavailable, selfMarked } from './grading.ts'
import { courseFor, nodeForTopic } from './path.ts'
import { ensureCurrent, fieldDiff, record, restore, revisionDetail, revisionWire } from './revisions.ts'
import { attachmentWire, byPosition, courseWire, nodeWire } from './wire.ts'
import type { createWriter } from './writer.ts'
import { NO_KEY_LESSON } from './writer.ts'

const WRITING = 'This lesson is being written right now. Try again when it is done.'
const KINDS = ['highlight', 'note', 'ink', 'whiteboard']
const MAX_ANNOTATIONS = 500
const STATES = ['available', 'in_progress', 'completed', 'skipped']

const isWriting = (node: Rec) => node.status === 'queued' || node.status === 'generating'

export interface LessonDeps {
  key: () => KeyState
  dataDir: string
  fallbackFetch?: typeof fetch
  reader: Reader
  zone: () => string
}

export function lessonApi(store: Store, filesDir: string, writer: ReturnType<typeof createWriter>, deps: LessonDeps) {
  const nodeWireOf = (node: Rec) => nodeWire(store, node, writer.draftOf(node.id))
  const instructionOf = (input: Record<string, any>) => (typeof input.instruction === 'string' && input.instruction.trim() ? input.instruction.trim().slice(0, 2000) : null)

  function answer(method: string, path: string, params: URLSearchParams, input: Record<string, any>): Response | null {
    const key = `${method} ${path}`

    if (key === 'POST /companion/courses') return makeCourse(input)
    if (key === 'GET /courses') return ok(store.recs('course').map((c) => courseWire(store, c)))

    const topic = path.match(/^\/companion\/topics\/([^/]+)\/lesson$/)
    if (topic && method === 'POST') {
      const node = nodeForTopic(store, topic[1]!)
      return node ? ok({ course_id: node.course_id, node_id: node.id, node_status: node.status }) : notFound('Topic not found.')
    }

    const course = path.match(/^\/courses\/(\d+)(\/expand)?$/)
    if (course) {
      const row = store.rec('course', Number(course[1]))
      if (!row) return notFound('Course not found.')
      if (method === 'GET' && !course[2]) return ok(courseWire(store, row))
      if (method === 'POST' && course[2]) {
        if (!writer.haveKey()) return message(NO_KEY_LESSON, 422)
        const ids = Array.isArray(input.node_ids) ? input.node_ids.filter(Number.isInteger) : []
        const claimed = writer.expand(row, ids, instructionOf(input))
        if (!claimed.length) return message('Those lessons are already being written.', 409)
        return json({ data: courseWire(store, store.rec('course', row.id)!), meta: { node_ids: claimed } }, 202)
      }
    }

    const nodeRoute = path.match(/^\/nodes\/(\d+)(?:\/(progress|regenerate|revisions|annotations|attachments)|\/blocks\/(\d+)\/rewrite)?$/)
    if (nodeRoute) {
      const node = store.rec('node', Number(nodeRoute[1]))
      if (!node) return notFound('Node not found.')
      if (nodeRoute[3]) return method === 'POST' ? rewrite(node, Number(nodeRoute[3]), input) : null
      switch (nodeRoute[2]) {
        case undefined:
          if (method === 'GET') return ok(nodeWireOf(node))
          if (method === 'PATCH') return updateNode(node, input)
          break
        case 'progress':
          if (method === 'POST') return progress(node, input)
          break
        case 'regenerate':
          if (method === 'POST') {
            if (isWriting(node)) return json({ message: 'This lesson is already being written.', node_id: node.id, course_id: node.course_id, node_status: node.status }, 409)
            if (!writer.haveKey()) return message(NO_KEY_LESSON, 422)
            writer.regenerate(node, instructionOf(input))
            return json({ node_id: node.id, course_id: node.course_id, node_status: 'queued' }, 202)
          }
          break
        case 'revisions':
          if (method === 'GET') return ok(store.recs('revision', node.id).reverse().slice(0, 200).map((r) => revisionWire(store, r)))
          break
        case 'annotations':
          if (method === 'GET') return ok(store.recs('annotation', node.id).map(annotationWire))
          if (method === 'PUT') return putAnnotations(node, input)
          break
        case 'attachments':
          if (method === 'GET') return ok(store.recs('attachment', node.id).sort(byPosition).map(attachmentWire))
          break
      }
      return null
    }

    const revision = path.match(/^\/revisions\/(\d+)(?:\/(field|restore))?$/)
    if (revision) {
      const row = store.rec('revision', Number(revision[1]))
      if (!row) return notFound('Revision not found.')
      if (method === 'GET' && !revision[2]) {
        const detail = revisionDetail(store, row, params.get('against'))
        return detail ? ok(detail) : notFound('Revision not found.')
      }
      if (method === 'GET' && revision[2] === 'field') {
        const block = Number(params.get('block'))
        const field = params.get('field')
        if (!Number.isInteger(block) || !field || field.length > 80) throw new Invalid({ block: ['Name the part and the field.'] })
        const diff = fieldDiff(store, row, block, field, params.get('against'))
        return diff ? ok(diff) : notFound('Revision not found.')
      }
      if (method === 'POST' && revision[2] === 'restore') {
        const node = store.rec('node', row.node_id)!
        if (isWriting(node)) return message(WRITING, 409)
        restore(store, row)
        return ok(nodeWireOf(store.rec('node', row.node_id)!))
      }
    }

    const annotation = path.match(/^\/annotations\/([^/]+)$/)
    if (annotation && method === 'DELETE') {
      const row = store.recByUuid('annotation', annotation[1]!)
      if (!row) return notFound('Annotation not found.')
      store.drop('annotation', row.id)
      return empty()
    }

    const attachment = path.match(/^\/attachments\/([^/]+)$/)
    if (attachment) {
      const row = store.recByUuid('attachment', attachment[1]!)
      if (!row) return notFound('Attachment not found.')
      if (method === 'PATCH') return updateAttachment(row, input)
      if (method === 'DELETE') {
        try { unlinkSync(join(filesDir, basename(row.path))) } catch { /* already gone */ }
        store.drop('attachment', row.id)
        return empty()
      }
    }

    const attempts = path.match(/^\/assessments\/(\d+)\/attempts$/)
    if (attempts && method === 'GET') {
      const row = store.rec('assessment', Number(attempts[1]))
      return row ? json(attemptsList(store, row)) : notFound('Assessment not found.')
    }

    return null
  }

  function makeCourse(input: Record<string, any>): Response {
    const proposal = input.proposal
    const errors: Record<string, string[]> = {}
    if (!proposal || typeof proposal !== 'object') errors.proposal = ['The proposal field is required.']
    else {
      if (typeof proposal.title !== 'string' || !proposal.title.trim() || proposal.title.length > 200) errors['proposal.title'] = ['The proposal.title field is required.']
      if (!['school', 'self'].includes(proposal.kind)) errors['proposal.kind'] = ['The selected proposal.kind is invalid.']
    }
    const itemIds = Array.isArray(input.item_ids) ? input.item_ids : []
    const links = Array.isArray(input.links) ? input.links : []
    if (itemIds.length > 12) errors.item_ids = ['Attach at most 12 files.']
    if (links.length > 8) errors.links = ['Attach at most 8 links.']
    for (const id of itemIds) if (typeof id !== 'string' || !UUID.test(id) || !store.get('items', id)) errors.item_ids = ['The selected item_ids is invalid.']
    for (const url of links) if (typeof url !== 'string' || url.length > 2000 || !/^(https?|webcals?):\/\/\S+$/i.test(url)) errors.links = ['That link is not one BiliMind can read.']
    if (Object.keys(errors).length) throw new Invalid(errors)

    const make = () => createCourse(store, deps.zone(), proposal, [...new Set(itemIds as string[])], links, (url) => deps.reader.linkInfo(url))

    if (input.message_id == null) return ok(make(), 201)

    // Pressed twice, or retried: the same course.
    const row = store.db.prepare("SELECT id, body FROM messages WHERE id = ? AND role = 'assistant'").get(String(input.message_id)) as { id: string; body: string } | undefined
    const stored = row ? JSON.parse(row.body) as Record<string, any> : null
    if (!stored || stored.proposal?.state !== 'ready') throw new Invalid({ message_id: ['That draft is not in your chats any more.'] })
    const before = stored.proposal.created
    if (before?.subject_id && store.get('subjects', before.subject_id)) return ok({ subject_id: before.subject_id, goal_id: before.goal_id ?? null })
    const created = make()
    stored.proposal = { ...stored.proposal, created }
    store.db.prepare('UPDATE messages SET body = ? WHERE id = ?').run(JSON.stringify(stored), row!.id)
    return ok(created, 201)
  }

  function updateNode(node: Rec, input: Record<string, any>): Response {
    const errors: Record<string, string[]> = {}
    if ('title' in input && (typeof input.title !== 'string' || !input.title || input.title.length > 250)) errors.title = ['The title must be between 1 and 250 characters.']
    if ('summary' in input && input.summary !== null && (typeof input.summary !== 'string' || input.summary.length > 4000)) errors.summary = ['The summary is too long.']
    if ('estimated_minutes' in input && (!Number.isInteger(input.estimated_minutes) || input.estimated_minutes < 1 || input.estimated_minutes > 600)) errors.estimated_minutes = ['Give the length in minutes.']
    const own = new Set(store.recs('block', node.id).map((b) => b.id))
    if ('blocks' in input) {
      if (!Array.isArray(input.blocks) || input.blocks.length > 60) errors.blocks = ['A lesson has at most 60 parts.']
      else input.blocks.forEach((b: any, i: number) => {
        if (!b || typeof b !== 'object' || !(BLOCK_TYPES as readonly string[]).includes(b.type)) errors[`blocks.${i}.type`] = ['That part is not one a lesson can have.']
        else if (!b.payload || typeof b.payload !== 'object' || Array.isArray(b.payload)) errors[`blocks.${i}.payload`] = ['The payload field is required.']
        else if (b.id != null && !own.has(b.id)) errors[`blocks.${i}.id`] = ['That part is not in this lesson.']
      })
    }
    if (Object.keys(errors).length) throw new Invalid(errors)

    if ('base_revision_id' in input && (input.base_revision_id ?? null) !== (node.current_revision_id ?? null)) {
      return json({ message: 'This lesson changed since you opened it. Reload to see the latest version.', current_revision_id: node.current_revision_id ?? null }, 409)
    }
    if (isWriting(node)) return json({ message: WRITING, current_revision_id: node.current_revision_id ?? null }, 409)

    ensureCurrent(store, node)
    const before = node.current_revision_id
    const next = { ...store.rec('node', node.id)! }
    for (const field of ['title', 'summary', 'estimated_minutes']) if (field in input) next[field] = input[field]
    const saved = store.save('node', next)
    if ('blocks' in input) {
      const specs: BlockSpec[] = input.blocks.map((b: any) => ({ id: b.id ?? null, type: b.type, payload: b.payload, source_material_ids: Array.isArray(b.source_material_ids) ? b.source_material_ids.filter(Number.isInteger) : null }))
      syncBlocks(store, saved, specs)
    }
    const revision = record(store, saved, 'edited')
    if (revision.id !== before) store.save('node', { ...store.rec('node', node.id)!, edited_at: new Date().toISOString() }, false)
    return ok(nodeWireOf(store.rec('node', node.id)!))
  }

  function progress(node: Rec, input: Record<string, any>): Response {
    if ('state' in input && !STATES.includes(input.state)) throw new Invalid({ state: ['The selected state is invalid.'] })
    if ('time_spent_seconds' in input && (!Number.isInteger(input.time_spent_seconds) || input.time_spent_seconds < 0 || input.time_spent_seconds > 86_400)) throw new Invalid({ time_spent_seconds: ['The time spent is invalid.'] })
    return ok(setProgress(store, node, input))
  }

  function rewrite(node: Rec, blockId: number, input: Record<string, any>): Response {
    const block = store.rec('block', blockId)
    if (!block || block.node_id !== node.id) return notFound('Block not found.')
    if (isWriting(node)) return json({ message: WRITING, node_id: node.id, block_id: blockId }, 409)
    if (block.rewriting_since) return json({ message: 'This part is already being rewritten.', node_id: node.id, block_id: blockId }, 409)
    if (!writer.haveKey()) return message(NO_KEY_LESSON, 422)
    writer.rewrite(block, instructionOf(input))
    return json({ node_id: node.id, block_id: blockId, rewriting: true }, 202)
  }

  const annotationWire = (a: Rec) => ({ uuid: a.uuid, node_id: a.node_id, block_id: a.block_id ?? null, kind: a.kind, anchor: a.anchor, data: a.data, updated_at: a.updated_at })

  function putAnnotations(node: Rec, input: Record<string, any>): Response {
    const items = input.annotations
    if (!Array.isArray(items) || !items.length || items.length > MAX_ANNOTATIONS) throw new Invalid({ annotations: ['The annotations field is required.'] })
    const own = new Set(store.recs('block', node.id).map((b) => b.id))
    items.forEach((a: any, i: number) => {
      if (!a || typeof a.uuid !== 'string' || !UUID.test(a.uuid)) throw new Invalid({ [`annotations.${i}.uuid`]: ['The uuid field must be a valid UUID.'] })
      if (!KINDS.includes(a.kind)) throw new Invalid({ [`annotations.${i}.kind`]: ['The selected kind is invalid.'] })
      if (a.block_id != null && !own.has(a.block_id)) throw new Invalid({ [`annotations.${i}.block_id`]: ['That part is not in this lesson.'] })
      if (!a.anchor || typeof a.anchor !== 'object' || !a.data || typeof a.data !== 'object') throw new Invalid({ [`annotations.${i}.anchor`]: ['The anchor and data fields are required.'] })
    })
    const saved = items.map((a: any) => {
      const found = store.recByUuid('annotation', a.uuid)
      if (found && found.node_id !== node.id) throw new Invalid({ [`annotations`]: ['One of these uuids was taken while you were saving. Mint another and try again.'] })
      const fields = { block_id: a.block_id ?? null, kind: a.kind, anchor: a.anchor, data: a.data }
      return found ? store.save('annotation', { ...found, ...fields }) : store.add('annotation', node.id, { uuid: a.uuid, node_id: node.id, ...fields }, a.uuid)
    })
    return ok(saved.map(annotationWire))
  }

  function updateAttachment(row: Rec, input: Record<string, any>): Response {
    if ('caption' in input && input.caption !== null && (typeof input.caption !== 'string' || input.caption.length > 500)) throw new Invalid({ caption: ['That caption is too long.'] })
    let next = store.save('attachment', 'caption' in input ? { ...row, caption: input.caption } : row)
    if (Number.isInteger(input.position)) {
      const others = store.recs('attachment', row.node_id).sort(byPosition).filter((a) => a.id !== row.id)
      const at = Math.max(0, Math.min(others.length, input.position))
      others.splice(at, 0, next)
      others.forEach((a, position) => {
        const moved = store.save('attachment', { ...store.rec('attachment', a.id)!, position })
        if (a.id === row.id) next = moved
      })
    }
    return ok(attachmentWire(next))
  }

  /** What can't run inside the one transaction: a file coming in, a file going out, a model marking an answer. */
  async function early(req: Request, method: string, path: string): Promise<Response | null> {
    const file = path.match(/^\/attachments\/([^/]+)\/file$/)
    if (file && (method === 'GET' || method === 'HEAD')) {
      const row = store.recByUuid('attachment', file[1]!)
      if (!row) return notFound('That file is no longer here.')
      return serveFile(join(filesDir, basename(row.path)), { meta: { mime: row.mime }, title: row.name } as never, req.headers.get('range'))
    }

    const upload = path.match(/^\/nodes\/(\d+)\/attachments$/)
    if (upload && method === 'POST') return uploadAttachment(req, Number(upload[1]))

    const attempt = path.match(/^\/assessments\/(\d+)\/attempt$/)
    if (attempt && method === 'POST') return submitAttempt(req, Number(attempt[1]))

    if (method === 'POST' && path === '/companion/courses/propose') return proposeCourse(req)
    return null
  }

  async function uploadAttachment(req: Request, nodeId: number): Promise<Response> {
    const node = store.rec('node', nodeId)
    if (!node) return notFound('Node not found.')
    let form: FormData
    try { form = await req.formData() } catch { throw new Invalid({ file: ['The file field is required.'] }) }
    const upload = form.get('file')
    if (!(upload instanceof File)) throw new Invalid({ file: ['The file field is required.'] })
    if (upload.size > MAX_UPLOAD_BYTES) throw new Invalid({ file: ['That file is over the 50 MB limit.'] })
    const bytes = Buffer.from(await upload.arrayBuffer())
    const kind = sniff(bytes, upload.name)
    if (!kind) throw new Invalid({ file: [ACCEPTED] })
    const caption = form.get('caption')
    const uuid = crypto.randomUUID()
    const stored = `${uuid}.${kind.extension}`
    // Written before the row, so a failed write leaves no row pointing at nothing.
    writeFileSync(join(filesDir, stored), bytes)
    const row = store.tx(() => store.add('attachment', nodeId, {
      uuid,
      node_id: nodeId,
      name: cleanName(upload.name, kind.extension),
      path: stored,
      mime: kind.mime,
      bytes: bytes.length,
      width: null,
      height: null,
      caption: typeof caption === 'string' && caption.trim() ? caption.trim().slice(0, 500) : null,
      position: store.recs('attachment', nodeId).length,
    }, uuid))
    return ok(attachmentWire(row), 201)
  }

  async function submitAttempt(req: Request, assessmentId: number): Promise<Response> {
    const assessment = store.rec('assessment', assessmentId)
    if (!assessment) return notFound('Assessment not found.')
    let body: Record<string, any>
    try { body = JSON.parse(await req.text()) as Record<string, any> } catch { return message('That answer could not be read.', 400) }
    const response = body.response
    if (!response || typeof response !== 'object' || Array.isArray(response)) throw new Invalid({ response: ['The response field is required.'] })

    const marker = markerOf(assessment)
    const attempt = store.tx(() => store.add('attempt', assessmentId, {
      assessment_id: assessmentId,
      response,
      score: null,
      passed: null,
      feedback: null,
      criterion_scores: null,
      grader_meta: { status: 'grading', grader: marker, assessment_kind: assessment.kind },
    }))

    const node = store.rec('node', assessment.node_id)!
    const course = store.rec('course', node.course_id)!
    const block = assessment.block_id ? store.rec('block', assessment.block_id) : null
    let marked
    if (marker === 'self') marked = selfMarked(assessment, response)
    else if (marker === 'deterministic') marked = markExact(assessment, response, block?.payload ?? null)
    else {
      const key = deps.key()
      try {
        if (key.state !== 'ok') throw new Error('no key')
        setEngineConfig(key.config)
        marked = await markWithRubric(assessment, response, {
          ctx: { course: join(deps.dataDir, 'courses', String(course.id)), agent: 'Grader', noCache: true, spend: { usd: 0, calls: 0 }, now: () => new Date(), progress: () => undefined },
          language: course.language ?? 'en',
          course: course.title,
          node: node.title,
          fallbackFetch: deps.fallbackFetch,
        })
      } catch (error) {
        marked = rubricUnavailable(assessment, error, key.state === 'ok')
      }
    }

    return store.tx(() => {
      const saved = store.save('attempt', {
        ...attempt,
        ...marked,
        grader_meta: {
          ...marked.grader_meta,
          grader: marked.grader_meta.grader ?? marker,
          assessment_kind: assessment.kind,
          graded_at: new Date().toISOString(),
          ...(marker !== assessment.grader ? { configured_grader: assessment.grader, grader_substituted: true } : {}),
        },
      })
      syncProgress(store, assessment.node_id)
      return json(attemptEnvelope(store, saved, assessment), 201)
    })
  }

  async function proposeCourse(req: Request): Promise<Response> {
    let body: Record<string, any>
    try { body = JSON.parse(await req.text()) as Record<string, any> } catch { return message('That could not be read.', 400) }
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    const links = Array.isArray(body.links) ? body.links.filter((l: unknown) => typeof l === 'string') : []
    const itemIds = Array.isArray(body.item_ids) ? body.item_ids.filter((l: unknown) => typeof l === 'string') : []
    if (!text && !links.length && !itemIds.length) throw new Invalid({ text: ['Attach a file or a link, or say what the course is.'] })
    if (deps.key().state !== 'ok') return message(NO_KEY_LESSON, 422)
    return ok(await propose({ store, reader: deps.reader, key: deps.key, zone: deps.zone, fallbackFetch: deps.fallbackFetch, ledgerCourse: () => join(deps.dataDir, 'drafts', crypto.randomUUID()) }, { text, links, itemIds }))
  }

  return { answer, early, courseFor: (subject: Rec) => courseFor(store, subject as never) }
}

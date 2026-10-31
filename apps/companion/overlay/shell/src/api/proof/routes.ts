// The routes of what proves learning and what comes in from outside. All of these wait on something (a model, a file, a
// network), so each runs outside the request's transaction and takes its own when it writes.
import { extractFile } from '@bilimind/engine/ingest/index'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { aiCaller, AiUnavailable, unavailable, type Ask } from '../ai.ts'
import type { KeyState } from '../ask/asker.ts'
import type { Reader } from '../ask/grounding.ts'
import { json, message, notFound, ok } from '../respond.ts'
import { Invalid, UUID } from '../rules.ts'
import { wire } from '../rows.ts'
import type { Raw, Store } from '../store.ts'
import { createChecks } from './checks.ts'
import { createGoals } from './goal.ts'
import { createNotesAi } from './notes-ai.ts'
import { createSignals } from './signals.ts'

const MAX_FILE_BYTES = 15 * 1024 * 1024
const NO_PHOTOS = "Reading a photo needs a vision model, and BiliMind only calls the text models on your DeepSeek or OpenRouter key. Add your timetable's calendar link or its PDF instead, or type the classes in."

export interface ProofDeps {
  key: () => KeyState
  fallbackFetch?: typeof fetch
  reader: Reader
  dataDir: string
}

export function proofApi(store: Store, deps: ProofDeps) {
  const ask: Ask = aiCaller(deps)
  const checks = createChecks(store, deps.reader, ask)
  const notes = createNotesAi(store, deps.reader, ask)
  const signals = createSignals(store, ask)
  const goal = createGoals(store, ask)

  const bodyOf = async (req: Request): Promise<Raw> => {
    const text = await req.text()
    if (!text) return {}
    try { return JSON.parse(text) as Raw } catch { throw new Invalid({ body: ['That request could not be read.'] }) }
  }

  async function ingestFile(req: Request): Promise<Response> {
    let form: FormData
    try { form = await req.formData() } catch { throw new Invalid({ file: ['The file field is required.'] }) }
    const file = form.get('file')
    if (!(file instanceof File)) throw new Invalid({ file: ['The file field is required.'] })
    if (file.size > MAX_FILE_BYTES) throw new Invalid({ file: ['That file is over the 15 MB limit.'] })
    const bytes = Buffer.from(await file.arrayBuffer())
    const hint = signals.hintOf(form.get('subject_id'))
    if (bytes.toString('latin1', 0, 5) !== '%PDF-') {
      if (/^image\//.test(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) return json({ message: NO_PHOTOS, reason: 'photo_reading_off' }, 422)
      throw new Invalid({ file: ['Send a PDF of the timetable.'] })
    }
    const dir = mkdtempSync(join(tmpdir(), 'bm-ingest-'))
    try {
      const path = join(dir, 'timetable.pdf')
      writeFileSync(path, bytes)
      let text = ''
      try {
        text = (await extractFile(path)).sections.map((s) => s.text).join('\n')
      } catch {
        throw new Invalid({ file: ["We couldn't read that PDF."] })
      }
      const out = await signals.examPdf(text, hint)
      return json({ data: out.signals.map((s) => wire('signals', s)), ...(out.message ? { message: out.message } : {}) })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }

  async function early(req: Request, method: string, path: string): Promise<Response | null> {
    try {
      if (method === 'POST' && path === '/companion/checks') {
        const out = await checks.start(await bodyOf(req))
        return ok(out.data, out.status)
      }
      const answer = path.match(/^\/companion\/checks\/([^/]+)\/answer$/)
      if (answer && method === 'POST') {
        if (!UUID.test(answer[1]!) || !store.get('checks', answer[1]!)) return notFound('Check not found.')
        return ok(await checks.answer(answer[1]!, await bodyOf(req)))
      }
      const itemAi = path.match(/^\/companion\/items\/([^/]+)\/(gaps|map)$/)
      if (itemAi && method === 'POST') {
        const item = UUID.test(itemAi[1]!) ? store.get('items', itemAi[1]!) : null
        if (!item) return notFound('Item not found.')
        const input = await bodyOf(req)
        if (itemAi[2] === 'map') return ok(await notes.map(item, input))
        if (item.kind !== 'page') throw new Invalid({ item: ['Only a page can be compared with its lecture.'] })
        return ok(await notes.gaps(item, typeof input.text === 'string' ? input.text : null))
      }
      if (method === 'POST' && path === '/companion/ingest/text') return ok((await signals.text(await bodyOf(req))).map((s) => wire('signals', s)))
      if (method === 'POST' && path === '/companion/ingest/file') return await ingestFile(req)
      if (method === 'POST' && path === '/companion/goals/from-sentence') {
        const out = await goal(await bodyOf(req))
        return ok(out.data, out.status)
      }
      const apply = path.match(/^\/companion\/signals\/([^/]+)\/apply$/)
      if (apply && method === 'POST') {
        const signal = UUID.test(apply[1]!) ? store.get('signals', apply[1]!) : null
        if (!signal) return notFound('Signal not found.')
        const out = signals.apply(signal, await bodyOf(req))
        return json(out.body, out.status)
      }
      return null
    } catch (error) {
      if (error instanceof AiUnavailable) return unavailable(error)
      throw error
    }
  }

  return {
    early,
    writing: () => checks.writing(),
  }
}


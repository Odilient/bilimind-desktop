// The /api contract the SPA already speaks, answered in-process: one (Request) => Response, handed to the app://
// protocol by main. No port, so nothing else on this computer can reach it. Same shapes as the hosted API.
import { BilimindError } from '@bilimind/engine/contracts'
import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { computeReadiness } from '../../../app/companion/readiness.ts'
import { currentZone, dayKey, setZone, shiftDay } from '../../../app/companion/time.ts'
import { createAsker, readInput } from './ask/asker.ts'
import { materialReader } from './ask/material.ts'
import type { edgeSynthesize } from '@bilimind/engine/tts-edge'
import { applyPendingRestore, isBackup, stageRestore, writeBackup } from './backup.ts'
import { credentials, type Vault } from './credentials.ts'
import { exportHtml } from './export-course.ts'
import { proofApi } from './proof/routes.ts'
import { createSearch } from './search.ts'
import { chunksForLesson, folderBuilds, type FolderDeps } from './lessons/folder.ts'
import { ACCEPTED, cleanName, MAX_UPLOAD_BYTES, serveFile, sniff } from './files.ts'
import { lessonApi } from './lessons/routes.ts'
import { createWriter } from './lessons/writer.ts'
import { empty, json, message, notFound, ok } from './respond.ts'
import { removeStarterKit, seedStarterKit } from './starter.ts'
import { setCaps, spendView } from './spend.ts'
import { rebuild } from './planner.ts'
import { Invalid, UUID } from './rules.ts'
import { createRow, deleteRow, instantOf, isWritable, listRows, updateRow, validated, wire, worldOf } from './rows.ts'
import { COLLECTIONS, openStore, wireTime, type Collection, type Row, type Store } from './store.ts'
import { todayView } from './today.ts'
import { zoneFor } from './zone.ts'

const NOT_YET = "This isn't in the desktop app yet."
const MAX_UPDATE_BYTES = 2_000_000
const OVERLAP_MS = 5000
const WEEK = 7 * 86_400_000
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/

export { json }

export interface ApiOptions {
  /** Where the database and uploaded files live. */
  dataDir: string
  /** The folder of the settings file the CLI shares, and the spend ledger. */
  configDir: string
  userName: string
  vault: Vault
  /** A provider's address other than its own, for the tests' fake one. */
  baseUrl?: string
  /** Tried once when a provider's certificate doesn't verify. */
  fallbackFetch?: typeof fetch
  /** False in tests, which want an empty world. */
  seedStarter?: boolean
  /** The folder dialog and the pipeline that runs in a process of its own. Absent, building from a folder says so. */
  folders?: FolderDeps
  /** The player page and where it's saved, for a course as an offline folder. */
  exporter?: { template: () => string; save: (name: string, html: string) => Promise<string | null> }
  /** Start again, which is when a restored backup takes over. */
  relaunch?: () => void
  /** What reads calendars and speaks, in the tests. */
  fetcher?: typeof fetch
  synthesize?: typeof edgeSynthesize
}

// ---------- the one local user ----------

interface LocalUser {
  id: number
  name: string
  email: string
  has_password: boolean
  locale: string
  avatar_url: string | null
  preferences: Record<string, any>
  current_organization_id: number
}

function userOf(store: Store, name: string): LocalUser {
  return store.getMeta<LocalUser>('user') ?? { id: 1, name, email: '', has_password: false, locale: 'en', avatar_url: null, preferences: {}, current_organization_id: 1 }
}

function me(store: Store, name: string) {
  return {
    user: userOf(store, name),
    organization: { id: 1, name: 'This computer', slug: null, type: 'individual', is_owner: true, is_current: true, role: 'owner', plan: 'local' },
    subscription: { status: 'active', plan: 'local', plan_label: 'Local', interval: null, is_active: true },
  }
}

/** `reading` and `companion` merge key by key, so turning one switch never resets another; the rest replaces. */
function updateProfile(store: Store, name: string, input: Record<string, any>) {
  const user = userOf(store, name)
  if (typeof input.name === 'string' && input.name.trim() && input.name.length <= 120) user.name = input.name.trim()
  if (typeof input.locale === 'string' && input.locale && input.locale.length <= 12) user.locale = input.locale
  const prefs = input.preferences
  if (prefs && typeof prefs === 'object' && !Array.isArray(prefs)) {
    for (const [key, value] of Object.entries(prefs)) {
      const mergeable = (key === 'reading' || key === 'companion') && value && typeof value === 'object'
      user.preferences[key] = mergeable ? { ...user.preferences[key], ...(value as object) } : value
    }
  }
  store.setMeta('user', user)
  return me(store, name)
}

// ---------- snapshots ----------

const SNAPSHOT_KEYS: [string, Collection][] = [
  ['goals', 'goals'], ['subjects', 'subjects'], ['slots', 'slots'], ['sessions', 'sessions'], ['topics', 'topics'],
  ['deadlines', 'deadlines'], ['items', 'items'], ['cards', 'cards'], ['plan_tasks', 'plan-tasks'], ['signals', 'signals'],
  ['connections', 'connections'], ['checks', 'checks'],
]

function cardCounts(store: Store, now: number) {
  const by: Record<string, { total: number; due: number }> = {}
  const notebook = { total: 0, due: 0 }
  for (const card of store.live('cards')) {
    if (card.suspended) continue
    const counts = card.subject_id ? (by[card.subject_id] ??= { total: 0, due: 0 }) : notebook
    counts.total++
    if (Date.parse(card.due_at) <= now) counts.due++
  }
  const sum = (key: 'total' | 'due') => Object.values(by).reduce((n, c) => n + c[key], 0) + notebook[key]
  return { total: sum('total'), due: sum('due'), by_subject: by, notebook }
}

const serverTime = (at: number) => new Date(at).toISOString().replace('Z', '+00:00')

/** Bounded where a table grows without limit: classes 8 weeks back to 16 ahead, tasks 21 days back to 7 ahead, signals pending or from 30 days, due cards. */
function bootstrap(store: Store) {
  const now = Date.now()
  const today = dayKey(now)
  const keep: Partial<Record<Collection, (row: Row) => boolean>> = {
    sessions: (s) => Date.parse(s.starts_at) >= now - 8 * WEEK && Date.parse(s.starts_at) <= now + 16 * WEEK,
    'plan-tasks': (t) => t.date >= shiftDay(today, -21) && t.date <= shiftDay(today, 7),
    signals: (s) => s.status === 'pending' || Date.parse(s.updated_at) >= now - 30 * 86_400_000,
    cards: (c) => !c.suspended && Date.parse(c.due_at) <= now,
    checks: (c) => !c.answered_at || Date.parse(c.asked_at) >= now - 60 * 86_400_000,
  }
  const out: Record<string, unknown> = {}
  for (const [key, collection] of SNAPSHOT_KEYS) {
    const rows = store.live(collection)
    const filter = keep[collection]
    out[key] = (filter ? rows.filter(filter) : rows).map((r) => wire(collection, r))
  }
  return { ...out, card_counts: cardCounts(store, now), server_time: serverTime(now) }
}

function changes(store: Store, since: number) {
  const now = Date.now()
  const out: Record<string, unknown> = {}
  // Reach a little past the cursor, as the hosted API does; the client upserts what it gets twice.
  for (const [key, collection] of SNAPSHOT_KEYS) out[key] = store.changedSince(collection, since - OVERLAP_MS).map((r) => wire(collection, r))
  return { ...out, card_counts: cardCounts(store, now), server_time: serverTime(now) }
}

function dateParam(params: URLSearchParams): string {
  const date = params.get('date')
  if (!date) return dayKey(Date.now())
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new Invalid({ date: ['Give the date as YYYY-MM-DD.'] })
  }
  return date
}

// ---------- the handler ----------

export function createApi(options: ApiOptions) {
  mkdirSync(options.dataDir, { recursive: true })
  const filesDir = join(options.dataDir, 'files')
  mkdirSync(filesDir, { recursive: true })
  applyPendingRestore(options.dataDir)
  const store = openStore(join(options.dataDir, 'companion.db'))
  const keys = credentials(options.dataDir, options.configDir, options.vault, options.baseUrl)
  const name = options.userName
  const reader = materialReader(store, filesDir)
  const folders = folderBuilds(store, { dataDir: options.dataDir, filesDir, zone: () => zoneFor(store), ...(options.folders ? { host: options.folders } : {}) })
  const asker = createAsker(store, reader, {
    key: () => keys.keyState(),
    zone: () => {
      const zone = zoneFor(store)
      setZone(zone)
      return zone
    },
    tryFirstEverywhere: () => userOf(store, name).preferences.companion?.try_first === true,
    fallbackFetch: options.fallbackFetch,
    draftLedger: () => join(options.dataDir, 'drafts', crypto.randomUUID()),
    folders,
  })
  const writer = createWriter(store, { key: () => keys.keyState(), dataDir: options.dataDir, fallbackFetch: options.fallbackFetch, chunksFor: chunksForLesson })
  const lessons = lessonApi(store, filesDir, writer, { key: () => keys.keyState(), dataDir: options.dataDir, fallbackFetch: options.fallbackFetch, reader, zone: () => {
    const zone = zoneFor(store)
    setZone(zone)
    return zone
  } })
  const proof = proofApi(store, { key: () => keys.keyState(), fallbackFetch: options.fallbackFetch, reader, dataDir: options.dataDir, ...(options.fetcher ? { fetcher: options.fetcher } : {}), ...(options.synthesize ? { synthesize: options.synthesize } : {}) })
  const search = createSearch(store)

  /** Backup, restore and export: each opens a dialog the system draws, so none of them is in a transaction. */
  async function dataRoutes(method: string, path: string): Promise<Response | null> {
    if (method !== 'POST') return null
    if (path === '/companion/data/backup') {
      const folder = await options.folders?.pick('Choose where to save the backup')
      return ok(folder ? { path: writeBackup(store, options.dataDir, folder) } : null)
    }
    if (path === '/companion/data/restore') {
      const folder = await options.folders?.pick('Choose a BiliMind backup folder')
      if (!folder) return ok(null)
      if (!isBackup(folder)) return message("That folder isn't a BiliMind backup, or its database doesn't open.", 422)
      stageRestore(options.dataDir, folder)
      setTimeout(() => options.relaunch?.(), 300)
      return ok({ restarting: true })
    }
    const exported = path.match(/^\/courses\/(\d+)\/export$/)
    if (exported) {
      const course = store.rec('course', Number(exported[1]))
      if (!course) return notFound('Course not found.')
      if (!options.exporter) return message('Exporting is only in the desktop app.', 422)
      if (!store.recs('node', course.id).some((n) => n.status === 'ready')) return message('Write a lesson first: a course with nothing written has nothing to export.', 422)
      const html = exportHtml(store, course, options.exporter.template())
      const saved = await options.exporter.save(String(course.title).replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'course', html)
      return ok(saved ? { path: saved } : null)
    }
    return null
  }

  // A new computer gets the sample to look around in. Once: removing it stays removed.
  if (options.seedStarter !== false && !store.getMeta('starter_seeded')) {
    store.tx(() => {
      store.setMeta('starter_seeded', true)
      setZone(zoneFor(store))
      seedStarterKit(store)
    })
  }

  /** A row of the collection, or the 404 the hosted API gives for one that isn't there. */
  function byId(collection: Collection, id: string, what = 'Not found.'): Row | Response {
    if (!UUID.test(id)) return notFound(what)
    return store.get(collection, id) ?? notFound(what)
  }

  async function route(req: Request, url: URL, path: string): Promise<Response> {
    const method = req.method
    const params = url.searchParams

    // Files first: the only route with a body that isn't JSON, and the only streams.
    if (method === 'POST' && path === '/companion/items/upload') return uploadItem(req)
    if (method === 'POST' && path === '/companion/ask') return ask(req)
    if (method === 'POST' && path === '/companion/folders/pick') return ok(await folders.pick())
    const data = await dataRoutes(method, path)
    if (data) return data
    const proved = await proof.early(req, method, path)
    if (proved) return proved
    const early = await lessons.early(req, method, path)
    if (early) return early
    const fileMatch = path.match(/^\/companion-files\/([^/]+)$/)
    if (fileMatch && (method === 'GET' || method === 'HEAD')) {
      const item = byId('items', fileMatch[1]!, 'That file is no longer here.')
      if (item instanceof Response) return item
      if (!item.meta?.path) return notFound('That file is no longer here.')
      // Only the name: `meta` is client-writable, and this must never reach outside the files folder.
      return serveFile(join(filesDir, basename(String(item.meta.path))), item, req.headers.get('range'))
    }

    let input: Record<string, any> = {}
    if (method !== 'GET' && method !== 'HEAD') {
      const text = await req.text()
      if (text) {
        try {
          input = JSON.parse(text) as Record<string, any>
        } catch {
          return message('That request could not be read.', 400)
        }
      }
    }

    // From here everything is synchronous, in one transaction.
    return store.tx(() => {
      setZone(zoneFor(store))
      return answer(method, path, params, input)
    })
  }

  /**
   * The body is read and the question written first, so a bad one is still a status. After that the answer streams
   * outside any transaction, because it awaits the model; a reply that stops being read aborts the provider's call.
   */
  async function ask(req: Request): Promise<Response> {
    let body: Record<string, any>
    try {
      body = JSON.parse(await req.text()) as Record<string, any>
    } catch {
      return message('That question could not be read.', 400)
    }
    const input = readInput(store, body)
    const thread = input.threadId ? asker.threadOf(input.threadId) : null
    if (input.threadId && !thread) return notFound('Thread not found.')
    const turn = store.tx(() => asker.begin(input, thread))

    const stop = new AbortController()
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const emit = (event: string, data: unknown) => {
          if (stop.signal.aborted) return
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        }
        emit('start', { thread_id: turn.thread.id, message_id: turn.answerId })
        asker.answer(turn, {
          status: (text) => emit('status', { text }),
          delta: (text) => emit('delta', { text }),
          making: (actions) => emit('making', { actions }),
          proposal: (state) => emit('proposal', state),
          step: (key, label, state) => emit('status', { text: label, step: { key, label, state } }),
        }, stop.signal).then((answer) => {
          emit('done', { thread_id: turn.thread.id, message: asker.messageWire(answer) })
        }).catch((error: unknown) => {
          if (stop.signal.aborted) return
          if (!(error instanceof BilimindError)) console.error('ask', error)
          emit('error', { message: error instanceof BilimindError ? error.message : "That answer didn't come through. Try again in a minute." })
        }).finally(() => {
          if (!stop.signal.aborted) controller.close()
        })
      },
      cancel() {
        stop.abort()
      },
    })
    return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } })
  }

  async function uploadItem(req: Request): Promise<Response> {
    let form: FormData
    try {
      form = await req.formData()
    } catch {
      throw new Invalid({ file: ['The file field is required.'] })
    }
    const file = form.get('file')
    if (!(file instanceof File)) throw new Invalid({ file: ['The file field is required.'] })
    if (file.size > MAX_UPLOAD_BYTES) throw new Invalid({ file: ['That file is over the 50 MB limit.'] })
    const bytes = Buffer.from(await file.arrayBuffer())
    const kind = sniff(bytes, file.name)
    if (!kind) throw new Invalid({ file: [ACCEPTED] })

    return store.tx(() => {
      const refOf = (field: string, collection: Collection) => {
        const id = form.get(field)
        if (typeof id !== 'string' || !id) return null
        const row = UUID.test(id) ? store.get(collection, id) : null
        if (!row) throw new Invalid({ [field]: [`The selected ${field} is invalid.`] })
        return row
      }
      const subject = refOf('subject_id', 'subjects')
      const session = refOf('session_id', 'sessions')
      const id = crypto.randomUUID()
      const stored = `${id}.${kind.extension}`
      // Written before the row, so a failed write leaves no row pointing at nothing.
      writeFileSync(join(filesDir, stored), bytes)
      // Filed only where the learner said; a class without a course is a suggestion, never a filing.
      const suggested = !subject && session ? session.subject_id : null
      const item = createRow(store, 'items', {
        id,
        subject_id: subject?.id ?? null,
        session_id: session?.id ?? null,
        kind: kind.mime.startsWith('image/') ? 'photo' : 'file',
        title: cleanName(file.name, kind.extension),
        meta: { path: stored, mime: kind.mime, size: bytes.length, ...(suggested ? { suggested_subject_id: suggested } : {}) },
        source: 'made',
      })
      return ok(wire('items', item), 201)
    })
  }

  function answer(method: string, path: string, params: URLSearchParams, input: Record<string, any>): Response {
    const zone = currentZone()
    const key = `${method} ${path}`

    // The local user and the stubs that make the hosted app's account screens stand down.
    if (key === 'GET /auth/me') return json(me(store, name))
    if (key === 'PATCH /auth/profile') return json(updateProfile(store, name, input))
    if (key === 'POST /auth/logout') return empty()
    if (key === 'GET /allowance') {
      const meter = (m: string) => ({ meter: m, metered: false, plan_limit: null, plan_used: 0, plan_remaining: 0, topup_remaining: 0, remaining: null, percent_used: 0, unmetered: true })
      return ok({ lessons: meter('node_expansion'), illustrations: meter('illustration'), packs: [] })
    }
    if (key === 'GET /companion/usage') {
      const window = { percent: 0, resets_at: null }
      return ok({ session: window, week: window, credits: 0, credits_expire_at: null, on: [], own_key: true, plan: 'local', packs: [] })
    }
    if (key === 'GET /notifications') return ok([])
    if (key === 'GET /search') return ok(search(params.get('q') ?? '', Number(params.get('course_id')) || null))
    if (key === 'GET /companion/ask/threads') return ok(asker.threads())
    const thread = path.match(/^\/companion\/ask\/threads\/([^/]+)$/)
    if (thread) {
      const id = thread[1]!
      if (method === 'GET') {
        const found = asker.thread(id)
        return found ? ok(found) : notFound('Thread not found.')
      }
      if (method === 'PATCH') {
        const renamed = asker.rename(id, input.title)
        return renamed ? ok(renamed) : notFound('Thread not found.')
      }
      if (method === 'DELETE') return asker.remove(id) ? empty() : notFound('Thread not found.')
    }
    if (key === 'GET /companion/checks/writing') return ok(proof.writing())
    if (key === 'DELETE /companion/samples') {
      removeStarterKit(store)
      return empty()
    }
    if (key === 'GET /companion/spending') return ok({ ...spendView(store, keys.keyState(), options.configDir), building_from_folder: folders.running() })
    if (key === 'DELETE /companion/folders/build') return folders.stop() ? empty() : notFound('Nothing is being built.')
    if (key === 'PUT /companion/spending/caps') return ok(setCaps(options.configDir, input))
    const lesson = lessons.answer(method, path, params, input)
    if (lesson) return lesson

    if (key === 'GET /credentials') return ok(keys.list())
    if (key === 'GET /credentials/storage') return ok(keys.storage())
    if (key === 'POST /credentials') return ok(keys.add(input), 201)
    const credential = path.match(/^\/credentials\/(\d+)(\/activate)?$/)
    if (credential) {
      const id = Number(credential[1])
      if (method === 'POST' && credential[2]) return keys.activate(id) ? ok(keys.list().find((c) => c.id === id)) : notFound()
      if (method === 'DELETE' && !credential[2]) return keys.remove(id) ? empty() : notFound()
    }

    // The plan and Today.
    if (key === 'GET /companion/bootstrap') return ok(bootstrap(store))
    if (key === 'GET /companion/changes') {
      const since = instantOf(params.get('since') ?? '')
      if (since === null) throw new Invalid({ since: ['Send the server_time of your last bootstrap or changes call.'] })
      return ok(changes(store, since))
    }
    if (key === 'GET /companion/today') return ok(todayView(store, dateParam(params), zone))
    if (key === 'POST /companion/plan/rebuild') {
      const date = dateParam(params)
      const tasks = rebuild(store, date)
      return ok({ date, minutes: tasks.reduce((sum, t) => sum + t.minutes, 0), tasks })
    }

    const deadline = path.match(/^\/companion\/deadlines\/([^/]+)\/(readiness|class)$/)
    if (deadline && method === 'GET') {
      const row = byId('deadlines', deadline[1]!, 'Deadline not found.')
      if (row instanceof Response) return row
      if (deadline[2] === 'readiness') return ok(computeReadiness(row as never, worldOf(store) as never, Date.now()))
      // No classmates on one computer: the screen shows nothing about a class.
      return ok({ possible: false, members: 0, shown: false, preparing: null, readiness_median: null, hardest: [], sharing: false, invite: { title: '', text: '', url: '' } })
    }

    const dismiss = path.match(/^\/companion\/signals\/([^/]+)\/dismiss$/)
    if (dismiss && method === 'POST') {
      const signal = byId('signals', dismiss[1]!, 'Signal not found.')
      if (signal instanceof Response) return signal
      if (signal.status === 'applied' || signal.status === 'auto') return message('This was already applied.', 409)
      return ok(store.put('signals', { ...signal, status: 'dismissed' }))
    }

    const review = path.match(/^\/companion\/cards\/([^/]+)\/review$/)
    if (review && method === 'POST') return reviewCard(review[1]!, input)

    const doc = path.match(/^\/companion\/items\/([^/]+)\/(doc|updates)$/)
    if (doc) {
      const item = byId('items', doc[1]!, 'Item not found.')
      if (item instanceof Response) return item
      if (doc[2] === 'doc' && method === 'GET') return ok(documentOf(item))
      if (doc[2] === 'updates' && method === 'POST') return pushUpdate(item, input)
    }

    // The generic collections last, so the named routes above win.
    const row = path.match(/^\/companion\/([a-z-]+)(?:\/([^/]+))?$/)
    const written = method === 'POST' && (row?.[2] || row?.[1] === 'checks')
    if (row && (COLLECTIONS as readonly string[]).includes(row[1]!) && !written) {
      return collection(method, row[1] as Collection, row[2], params, input)
    }

    // Everything that needs a model, a server or a later milestone. The SPA shows the sentence and carries on.
    return message(NOT_YET, 503)
  }

  function collection(method: string, name: Collection, id: string | undefined, params: URLSearchParams, input: Record<string, any>): Response {
    if (method === 'GET') {
      if (!id) return ok(listRows(store, name, params))
      const row = byId(name, id)
      return row instanceof Response ? row : ok(wire(name, row))
    }
    if (!isWritable(name)) return message('Method not allowed.', 405)

    if (method === 'POST' && !id) {
      // The client mints ids so it can create offline, and an offline client retries: an id already here is the
      // update it now is. A deleted one is refused, because quietly bringing back what was removed is worse than asking.
      const existing = typeof input.id === 'string' && UUID.test(input.id) ? store.find(name, input.id) : null
      if (existing?.deleted_at) return message('This was deleted.', 409)
      if (existing) return ok(wire(name, updateRow(store, name, existing, validated(store, name, input, false))))
      return ok(wire(name, createRow(store, name, validated(store, name, input, true))), 201)
    }
    if (!id) return message('Method not allowed.', 405)

    const row = byId(name, id)
    if (row instanceof Response) return row
    if (method === 'PATCH') return ok(wire(name, updateRow(store, name, row, validated(store, name, input, false))))
    if (method === 'DELETE') {
      deleteRow(store, name, row)
      return empty()
    }
    return message('Method not allowed.', 405)
  }

  /** The device scheduled it with ts-fsrs; this keeps the result and the log. A retry lands once, and an older review never overwrites a newer one. */
  function reviewCard(id: string, input: Record<string, any>): Response {
    const card = byId('cards', id, 'Card not found.')
    if (card instanceof Response) return card
    const errors: Record<string, string[]> = {}
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 4) errors.rating = ['The rating field is invalid.']
    if (!input.fsrs || typeof input.fsrs !== 'object') errors.fsrs = ['The fsrs field is required.']
    for (const field of ['due_at', 'reviewed_at']) if (typeof input[field] !== 'string' || Number.isNaN(Date.parse(input[field]))) errors[field] = [`The ${field} field is invalid.`]
    if (input.id != null && !(typeof input.id === 'string' && UUID.test(input.id))) errors.id = ['The id field must be a valid UUID.']
    if (Object.keys(errors).length) throw new Invalid(errors)

    const logId = (input.id as string | null | undefined) ?? crypto.randomUUID()
    const logged = store.db.prepare('SELECT 1 FROM card_reviews WHERE id = ? AND card_id = ?').get(logId, id)
    if (logged) return ok(wire('cards', card))
    store.db.prepare('INSERT INTO card_reviews (id, card_id, rating, reviewed_at, fsrs_before) VALUES (?, ?, ?, ?, ?)')
      .run(logId, id, input.rating, wireTime(input.reviewed_at), JSON.stringify(card.fsrs))
    if (!card.last_review_at || Date.parse(input.reviewed_at) >= Date.parse(card.last_review_at)) {
      return ok(wire('cards', store.put('cards', { ...card, fsrs: input.fsrs, due_at: wireTime(input.due_at), last_review_at: wireTime(input.reviewed_at) })))
    }
    return ok(wire('cards', card))
  }

  /** Snapshot plus every update since. The API never decodes Yjs: applying them all is correct in any order, with duplicates. */
  function documentOf(item: Row) {
    const snapshot = store.db.prepare('SELECT snapshot FROM item_snapshots WHERE item_id = ?').get(item.id) as { snapshot: string | null } | undefined
    const updates = store.db.prepare('SELECT id, body, created_at FROM item_updates WHERE item_id = ? ORDER BY seq').all(item.id) as { id: string; body: string; created_at: string }[]
    return { snapshot: snapshot?.snapshot ?? null, updates: updates.map((u) => ({ id: u.id, update: u.body, created_at: u.created_at })) }
  }

  function pushUpdate(item: Row, input: Record<string, any>): Response {
    if (typeof input.update !== 'string' || !input.update || input.update.length > MAX_UPDATE_BYTES || !BASE64.test(input.update)) throw new Invalid({ update: ['The update field is invalid.'] })
    if (input.id != null && !(typeof input.id === 'string' && UUID.test(input.id))) throw new Invalid({ id: ['The id field must be a valid UUID.'] })
    if (item.kind !== 'page' && item.kind !== 'board') throw new Invalid({ update: ['Only pages and boards have documents.'] })
    const id = (input.id as string | null | undefined) ?? crypto.randomUUID()
    const existing = store.db.prepare('SELECT id, body, created_at FROM item_updates WHERE id = ? AND item_id = ?').get(id, item.id) as { id: string; body: string; created_at: string } | undefined
    if (existing) return ok({ id: existing.id, update: existing.body, created_at: existing.created_at }, 201)
    const createdAt = wireTime(Date.now())
    store.db.prepare('INSERT INTO item_updates (id, item_id, body, created_at) VALUES (?, ?, ?, ?)').run(id, item.id, input.update, createdAt)
    // The page's row moves too, so `/changes` says this document has something new.
    store.put('items', item)
    return ok({ id, update: input.update, created_at: createdAt }, 201)
  }

  return {
    store,

    async handle(req: Request): Promise<Response> {
      const url = new URL(req.url)
      const path = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/'
      try {
        return await route(req, url, path)
      } catch (error) {
        if (error instanceof Invalid) return json({ message: error.message, errors: error.errors }, 422)
        console.error('api', req.method, path, error)
        return message('Something went wrong on this computer.', 500)
      }
    },

    refreshCalendars: () => proof.refreshCalendars(),

    /** Let lessons being written finish, for tests. */
    settled: () => writer.settled(),

    close: () => store.close(),
  }
}

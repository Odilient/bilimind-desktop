import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { testApi, uuid } from './helpers.ts'

let t: ReturnType<typeof testApi>
beforeEach(() => { t = testApi() })
afterEach(() => t.done())

const subject = async () => (await t.post('/companion/subjects', { id: uuid(), title: 'Databases' })).data

describe('the local user and the stubs', () => {
  it('answers /auth/me without a token, and merges preferences key by key', async () => {
    expect((await t.get('/auth/me')).json.user).toMatchObject({ id: 1, name: 'Ada' })
    await t.patch('/auth/profile', { preferences: { companion: { try_first: true } } })
    const { json } = await t.patch('/auth/profile', { preferences: { companion: { share_results: false } } })
    expect(json.user.preferences.companion).toEqual({ try_first: true, share_results: false })
  })

  it('stands the hosted account screens down', async () => {
    expect((await t.get('/companion/usage')).data.own_key).toBe(true)
    expect((await t.get('/allowance')).data.lessons.unmetered).toBe(true)
    const s = await subject()
    const d = (await t.post('/companion/deadlines', { subject_id: s.id, kind: 'quiz', title: 'Quiz' })).data
    expect((await t.get(`/companion/deadlines/${d.id}/class`)).data.possible).toBe(false)
  })

  it('says "not yet" for what needs a model, in the shape the SPA reads', async () => {
    for (const path of ['/companion/ask', '/companion/ingest/text', '/companion/checks', '/companion/goals/from-sentence', '/speech/transcribe']) {
      const res = await t.post(path, {})
      expect(res.status).toBe(503)
      expect(res.json.message).toMatch(/isn't in the desktop app yet/)
    }
  })
})

describe('collections', () => {
  it('creates with the client id, retries as an update, refuses a deleted id', async () => {
    const id = uuid()
    const made = await t.post('/companion/subjects', { id, title: 'Networks' })
    expect(made.status).toBe(201)
    expect(made.data).toMatchObject({ id, color: 'c8', source: 'manual', format: 'weeks', position: 0, archived_at: null, sample: false })
    expect((await t.post('/companion/subjects', { id, title: 'Networks 2' })).status).toBe(200)
    expect((await t.get(`/companion/subjects/${id}`)).data.title).toBe('Networks 2')
    expect((await t.del(`/companion/subjects/${id}`)).status).toBe(204)
    expect((await t.get(`/companion/subjects/${id}`)).status).toBe(404)
    expect((await t.post('/companion/subjects', { id, title: 'Back' })).status).toBe(409)
  })

  it('validates like the hosted API, 422 with the field named', async () => {
    const res = await t.post('/companion/slots', { subject_id: uuid(), kind: 'nap', weekday: 9, starts_at: '09:00', ends_at: '10:00' })
    expect(res.status).toBe(422)
    expect(Object.keys(res.json.errors).sort()).toEqual(['kind', 'subject_id', 'weekday'])
    const s = await subject()
    const late = await t.post('/companion/sessions', { subject_id: s.id, title: 'L', starts_at: '2026-11-02T10:00:00Z', ends_at: '2026-11-02T09:00:00Z' })
    expect(late.json.errors.ends_at).toBeTruthy()
  })

  it('drops keys it does not know, and never stores what the server derives', async () => {
    const s = await subject()
    const res = await t.patch(`/companion/subjects/${s.id}`, { ...s, title: 'DB', sample: true, surprise: 1 })
    expect(res.status).toBe(200)
    expect(res.data.title).toBe('DB')
    expect(res.data.sample).toBe(false)
    expect(res.data.surprise).toBeUndefined()
  })

  it('filters, with null meaning the Notebook, and orders by position', async () => {
    const s = await subject()
    await t.post('/companion/items', { id: uuid(), kind: 'page', title: 'Loose' })
    await t.post('/companion/items', { id: uuid(), kind: 'page', title: 'One', subject_id: s.id })
    await t.post('/companion/items', { id: uuid(), kind: 'page', title: 'Two', subject_id: s.id })
    expect((await t.get('/companion/items?subject_id=null')).data.map((i: any) => i.title)).toEqual(['Loose'])
    expect((await t.get(`/companion/items?subject_id=${s.id}`)).data.map((i: any) => [i.title, i.position])).toEqual([['One', 0], ['Two', 1]])
  })

  it('deleting a course tombstones what is under it, and a goal releases its courses', async () => {
    const goal = (await t.post('/companion/goals', { id: uuid(), title: 'Term', kind: 'term' })).data
    expect(goal.timezone).toBeTruthy()
    const s = (await t.post('/companion/subjects', { id: uuid(), title: 'A', goal_id: goal.id })).data
    const topic = (await t.post('/companion/topics', { id: uuid(), subject_id: s.id, title: 'T' })).data
    await t.del(`/companion/goals/${goal.id}`)
    expect((await t.get(`/companion/subjects/${s.id}`)).data.goal_id).toBeNull()
    await t.del(`/companion/subjects/${s.id}`)
    expect((await t.get(`/companion/topics/${topic.id}`)).status).toBe(404)
    const changed = (await t.get(`/companion/changes?since=${encodeURIComponent(new Date(Date.now() - 60_000).toISOString())}`)).data
    expect(changed.topics.find((r: any) => r.id === topic.id).deleted_at).toBeTruthy()
  })

  it('never returns a connection token', async () => {
    const res = await t.post('/companion/connections', { id: uuid(), kind: 'ics', label: 'Feed', token: 'secret-value' })
    expect(res.data.token).toBeUndefined()
    expect(res.data.has_token).toBe(true)
  })
})

describe('deadlines', () => {
  it('always carry a source, and a hand edit records its change', async () => {
    const s = await subject()
    const made = (await t.post('/companion/deadlines', { id: uuid(), subject_id: s.id, kind: 'quiz', title: 'Quiz 1', due_at: '2026-11-05T09:00:00+05:00' })).data
    expect(made.sources).toHaveLength(1)
    expect(made.sources[0]).toMatchObject({ kind: 'user', confidence: 'own', evidence: 'Added by you.' })
    expect(made.due_at).toBe('2026-11-05T04:00:00+00:00')
    expect(made.tentative).toBe(false)

    const same = (await t.patch(`/companion/deadlines/${made.id}`, { due_at: '2026-11-05T04:00:00Z' })).data
    expect(same.sources).toHaveLength(1)

    const moved = (await t.patch(`/companion/deadlines/${made.id}`, { due_at: '2026-11-06T04:00:00Z', sources: [] })).data
    expect(moved.sources).toHaveLength(2)
    expect(moved.sources[1].change.due_at).toEqual({ from: '2026-11-05T04:00:00+00:00', to: '2026-11-06T04:00:00+00:00' })
    expect(moved.sources[1].evidence).toBe('Changed by you.')
  })

  it('heard and unconfirmed is tentative; a scope keeps only live topics', async () => {
    const s = await subject()
    const topic = (await t.post('/companion/topics', { id: uuid(), subject_id: s.id, title: 'T' })).data
    const d = (await t.post('/companion/deadlines', { id: uuid(), subject_id: s.id, kind: 'quiz', title: 'Q', confidence: 'heard', topic_ids: [topic.id] })).data
    expect(d.tentative).toBe(true)
    expect((await t.patch(`/companion/deadlines/${d.id}`, { confirmed: true })).data.tentative).toBe(false)
    await t.del(`/companion/topics/${topic.id}`)
    expect((await t.get(`/companion/deadlines/${d.id}`)).data.topic_ids).toEqual([])
    expect((await t.post('/companion/deadlines', { subject_id: s.id, kind: 'quiz', title: 'R', topic_ids: [uuid()] })).status).toBe(422)
  })

  it('readiness has the full shape with nothing checked', async () => {
    const s = await subject()
    await t.post('/companion/topics', { id: uuid(), subject_id: s.id, title: 'T' })
    const d = (await t.post('/companion/deadlines', { id: uuid(), subject_id: s.id, kind: 'final', title: 'Final', due_at: '2027-01-10T09:00:00Z' })).data
    const r = (await t.get(`/companion/deadlines/${d.id}/readiness`)).data
    expect(r).toMatchObject({ percent: 0, checked: 0, total: 1, calibration: null })
    expect(r.topics[0]).toMatchObject({ percent: null, state: 'unstudied' })
  })
})

describe('documents', () => {
  it('keeps updates in order, once each, and compaction drops what the snapshot holds', async () => {
    const item = (await t.post('/companion/items', { id: uuid(), kind: 'page', title: 'P' })).data
    const a = uuid()
    const b = uuid()
    expect((await t.post(`/companion/items/${item.id}/updates`, { id: a, update: 'AAAA' })).status).toBe(201)
    await t.post(`/companion/items/${item.id}/updates`, { id: a, update: 'AAAA' })
    await t.post(`/companion/items/${item.id}/updates`, { id: b, update: 'BBBB' })
    await t.post(`/companion/items/${item.id}/updates`, { update: 'CCCC' })
    expect((await t.get(`/companion/items/${item.id}/doc`)).data.updates.map((u: any) => u.update)).toEqual(['AAAA', 'BBBB', 'CCCC'])

    await t.patch(`/companion/items/${item.id}`, { snapshot: 'U05BUA==', merged_through: b })
    const doc = (await t.get(`/companion/items/${item.id}/doc`)).data
    expect(doc.snapshot).toBe('U05BUA==')
    expect(doc.updates.map((u: any) => u.update)).toEqual(['CCCC'])
    expect((await t.get(`/companion/items/${item.id}`)).data.snapshot).toBeUndefined()
  })

  it('refuses a document on a file, and anything that is not base64', async () => {
    const page = (await t.post('/companion/items', { id: uuid(), kind: 'page' })).data
    expect((await t.post(`/companion/items/${page.id}/updates`, { update: '<<not base64>>' })).status).toBe(422)
    const link = (await t.post('/companion/items', { id: uuid(), kind: 'link' })).data
    expect((await t.post(`/companion/items/${link.id}/updates`, { update: 'AAAA' })).status).toBe(422)
  })
})

describe('cards', () => {
  it('a new card is due now with an empty fsrs state; a retried review lands once; an older one does not overwrite', async () => {
    const card = (await t.post('/companion/cards', { id: uuid(), front: 'Q' })).data
    expect(card).toMatchObject({ kind: 'basic', back: '', suspended: false })
    expect(card.fsrs.state).toBe(0)

    const id = uuid()
    const later = { rating: 3, fsrs: { state: 2, reps: 2 }, due_at: '2026-12-01T00:00:00Z', reviewed_at: '2026-11-10T00:00:00Z', id }
    expect((await t.post(`/companion/cards/${card.id}/review`, later)).data.fsrs.reps).toBe(2)
    await t.post(`/companion/cards/${card.id}/review`, { ...later, fsrs: { reps: 99 } })
    expect((await t.get(`/companion/cards/${card.id}`)).data.fsrs.reps).toBe(2)

    await t.post(`/companion/cards/${card.id}/review`, { ...later, id: uuid(), fsrs: { reps: 1 }, reviewed_at: '2026-11-01T00:00:00Z' })
    expect((await t.get(`/companion/cards/${card.id}`)).data.fsrs.reps).toBe(2)
    const reviews = t.store.db.prepare('SELECT count(*) AS n FROM card_reviews').get() as { n: number }
    expect(reviews.n).toBe(2)
  })
})

describe('files', () => {
  const form = (bytes: Uint8Array | string, name: string, extra: Record<string, string> = {}) => {
    const f = new FormData()
    f.append('file', new File([bytes as BlobPart], name))
    for (const [k, v] of Object.entries(extra)) f.append(k, v)
    return f
  }
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])

  it('stores an upload, filed where it was told, and serves it back with ranges', async () => {
    const s = await subject()
    const res = await t.call('POST', '/companion/items/upload', form(PNG, 'board photo.png', { subject_id: s.id }))
    expect(res.status).toBe(201)
    expect(res.data).toMatchObject({ kind: 'photo', title: 'board photo.png', subject_id: s.id })
    expect(res.data.file_url).toBe(`app://bilimind/api/companion-files/${res.data.id}`)

    const whole = await t.get(`/companion-files/${res.data.id}`)
    expect(whole.headers.get('content-type')).toBe('image/png')
    expect(whole.headers.get('x-content-type-options')).toBe('nosniff')
    const part = await t.call('GET', `/companion-files/${res.data.id}`, undefined, { range: 'bytes=0-3' })
    expect(part.status).toBe(206)
    expect(part.headers.get('content-range')).toBe('bytes 0-3/12')
  })

  it('refuses script and unknown types, whatever they are called', async () => {
    for (const [body, name] of [['<svg onload="x()"/>', 'a.svg'], ['<html></html>', 'a.txt'], ['<!doctype html>', 'a.md'], ['plain', 'a.exe']] as const) {
      expect((await t.call('POST', '/companion/items/upload', form(body, name))).status).toBe(422)
    }
    expect((await t.call('POST', '/companion/items/upload', form('notes', 'a.txt'))).status).toBe(201)
  })

  it('never reads outside its folder, whatever meta.path says', async () => {
    const item = (await t.post('/companion/items', { id: uuid(), kind: 'file', meta: { path: '../companion.db', mime: 'text/plain' } })).data
    expect((await t.get(`/companion-files/${item.id}`)).status).toBe(404)
    readFileSync(join(t.dir, 'data', 'companion.db'))
  })
})

describe('keys', () => {
  it('keeps the secret in the settings file, and only ever shows the last four', async () => {
    const key = `sk-${'a'.repeat(20)}wxyz`
    expect((await t.post('/credentials', { provider: 'deepseek', key: 'nope' })).status).toBe(422)
    const made = await t.post('/credentials', { provider: 'deepseek', key })
    expect(made.status).toBe(201)
    expect(made.data).toMatchObject({ provider: 'deepseek', last_four: 'wxyz', active: true })
    expect(JSON.stringify((await t.get('/credentials')).data)).not.toContain(key)
    const file = JSON.parse(readFileSync(join(t.dir, 'config', 'config.json'), 'utf8'))
    expect(file).toMatchObject({ provider: 'deepseek', keys: { deepseek: key } })
    expect((await t.del(`/credentials/${made.data.id}`)).status).toBe(204)
    expect((await t.get('/credentials')).data).toEqual([])
  })
})

describe('survival', () => {
  it('everything is still there after a restart', async () => {
    const s = await subject()
    const item = (await t.post('/companion/items', { id: uuid(), kind: 'board', title: 'B', subject_id: s.id })).data
    await t.post(`/companion/items/${item.id}/updates`, { update: 'AAAA' })
    await t.patch('/auth/profile', { preferences: { inks: ['#112233'] } })
    t.restart()
    const boot = (await t.get('/companion/bootstrap')).data
    expect(boot.subjects.map((r: any) => r.title)).toEqual(['Databases'])
    expect(boot.items[0].title).toBe('B')
    expect((await t.get(`/companion/items/${item.id}/doc`)).data.updates).toHaveLength(1)
    expect((await t.get('/auth/me')).json.user.preferences.inks).toEqual(['#112233'])
  })

  it('a failure halfway leaves nothing written', async () => {
    const before = t.store.db.prepare('SELECT count(*) AS n FROM rows').get() as { n: number }
    expect(() => t.store.tx(() => {
      t.store.put('goals', { id: uuid(), title: 'half' })
      throw new Error('boom')
    })).toThrow('boom')
    expect(t.store.db.prepare('SELECT count(*) AS n FROM rows').get()).toEqual(before)
  })
})

describe('bootstrap and changes', () => {
  it('bootstrap is bounded, changes carries what moved', async () => {
    const s = await subject()
    await t.post('/companion/cards', { id: uuid(), subject_id: s.id, front: 'due now' })
    await t.post('/companion/cards', { id: uuid(), subject_id: s.id, front: 'later', due_at: '2099-01-01T00:00:00Z' })
    await t.post('/companion/sessions', { id: uuid(), subject_id: s.id, title: 'Ancient', starts_at: '2000-01-01T10:00:00Z', ends_at: '2000-01-01T11:00:00Z' })
    const weeks = (n: number) => new Date(Date.now() + n * 7 * 86_400_000).toISOString()
    for (const [title, at] of [['Back 7', -7], ['Back 9', -9], ['Ahead 15', 15], ['Ahead 17', 17]] as const) {
      await t.post('/companion/sessions', { id: uuid(), subject_id: s.id, title, starts_at: weeks(at), ends_at: weeks(at) })
    }
    const boot = (await t.get('/companion/bootstrap')).data
    expect(boot.cards.map((c: any) => c.front)).toEqual(['due now'])
    expect(boot.sessions.map((c: any) => c.title).sort()).toEqual(['Ahead 15', 'Back 7'])
    expect(boot.card_counts).toMatchObject({ total: 2, due: 1 })
    expect(boot.card_counts.by_subject[s.id]).toEqual({ total: 2, due: 1 })
    expect(boot.server_time).toMatch(/\+00:00$/)
    expect((await t.get('/companion/changes')).status).toBe(422)
  })
})

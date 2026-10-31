// Checks, readiness, gaps, maps, goals, signals, calendars, search, speech, export, backup: with a fake provider, and a
// fake clock where a check has to be days old.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createApi, type ApiOptions } from '../merged/shell/src/api/handler.ts'
import { occurrencesOf } from '../merged/shell/src/api/proof/ics.ts'
import { contextFor, locateEvidence, resolveWhen } from '../merged/shell/src/api/proof/signals.ts'
import { courseScore, matchCourse, matchDeadline } from '../merged/shell/src/api/proof/words.ts'
import { fakeProvider, type FakeReply } from './fake-provider.ts'
import { fakeVault } from './helpers.ts'

const DAY = 86_400_000
const cleanups: (() => Promise<void> | void)[] = []
afterEach(async () => { for (const clean of cleanups.splice(0)) await clean() })

async function setup(reply: (system: string, user: string, body: any) => FakeReply | null = () => null, extra: Partial<ApiOptions> = {}) {
  const provider = await fakeProvider((body) => reply(String(body.messages[0].content), String(body.messages.at(-1).content), body) ?? { pieces: ['{}'] })
  const dir = mkdtempSync(join(tmpdir(), 'bm-proof-'))
  const api = createApi({ seedStarter: false, dataDir: join(dir, 'data'), configDir: join(dir, 'config'), userName: 'Ada', vault: fakeVault(), baseUrl: provider.url, ...extra })
  cleanups.push(async () => { api.close(); rmSync(dir, { recursive: true, force: true }); await provider.close() })
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await api.handle(new Request(`app://bilimind/api${path}`, { method, ...(body instanceof FormData ? { body } : { headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }) }))
    const text = res.status === 204 ? '' : await res.text()
    let json: any = null
    try { json = text ? JSON.parse(text) : null } catch { /* bytes */ }
    return { status: res.status, data: json?.data, json, text, headers: res.headers }
  }
  await call('POST', '/credentials', { provider: 'deepseek', key: 'sk-test-0123456789abcdef' })
  return { api, call, provider, dir, store: api.store }
}

const isoDaysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString()

/** A course with topics studied by a class that ended `days` ago. */
async function studied(t: Awaited<ReturnType<typeof setup>>, days: number, titles = ['Joins', 'Indexes']) {
  const subject = (await t.call('POST', '/companion/subjects', { title: 'Databases' })).data
  const topics = []
  for (const title of titles) {
    const topic = (await t.call('POST', '/companion/topics', { subject_id: subject.id, title, summary: `All about ${title}.` })).data
    await t.call('POST', '/companion/sessions', { subject_id: subject.id, topic_id: topic.id, title: `Class on ${title}`, starts_at: isoDaysAgo(days + 0.1), ends_at: isoDaysAgo(days) })
    topics.push(topic)
  }
  return { subject, topics }
}

const checkWriter = (system: string, user: string): FakeReply | null => {
  if (!system.includes('You write a check for one learner')) return null
  const aliases = [...user.matchAll(/^(T\d+) · /gm)].map((m) => m[1])
  return { pieces: [JSON.stringify({ questions: aliases.flatMap((t) => [
    { topic: t, kind: 'why', prompt: `Why does ${t} matter in a real query?`, expected: 'Because of the model answer.', rubric: ['names the reason', 'gives an example'], source: null },
    { topic: t, kind: 'apply', prompt: `Work one step of ${t} with real values.`, expected: 'Step one is this.', rubric: ['does the step'], source: null },
  ]) })] }
}

const marks = (verdicts: string[], extra: Record<string, unknown> = {}) => ({ pieces: [JSON.stringify({ points: verdicts.map((verdict, i) => ({ point: i + 1, verdict })), feedback: 'You said the right thing about it.', tempting: 'It looks like the other rule.', ...extra })] })

describe('checks', () => {
  it('asks nothing until a topic has gone cold, and says when it will', async () => {
    const t = await setup(checkWriter)
    await studied(t, 1)
    const res = await t.call('POST', '/companion/checks', { purpose: 'cold' })
    expect(res.status).toBe(200)
    expect(res.data.checks).toEqual([])
    expect(Date.parse(res.data.opens_at)).toBeGreaterThan(Date.now())
    expect(t.provider.requests).toHaveLength(0)
  })

  it('writes a mixed sitting that gives nothing away, and reopens it rather than a second one', async () => {
    const t = await setup(checkWriter)
    await studied(t, 5)
    const sitting = await t.call('POST', '/companion/checks', { purpose: 'cold' })
    expect(sitting.status).toBe(201)
    expect(sitting.data.checks).toHaveLength(4)
    // Dealt round the topics, one topic never twice in a row.
    const order = sitting.data.checks.map((c: any) => c.topic_id)
    expect(order[0]).not.toBe(order[1])
    for (const check of sitting.data.checks) {
      expect(check.cold).toBe(true)
      expect(check.studied_days_ago).toBe(5)
      expect(check.expected).toBeUndefined()
      expect(check.rubric).toBeUndefined()
      expect(check.material).toBeUndefined()
      expect(check.revealed).toBeNull()
    }
    const listed = await t.call('GET', '/companion/checks')
    expect(JSON.stringify(listed.data)).not.toContain('model answer')
    const again = await t.call('POST', '/companion/checks', { purpose: 'cold' })
    expect(again.status).toBe(200)
    expect(again.data.batch_id).toBe(sitting.data.batch_id)
    expect(t.provider.requests).toHaveLength(1)
  })

  it('never asks about a hand-in: its brief is left out, and the model is told', async () => {
    const t = await setup(checkWriter)
    const { subject, topics } = await studied(t, 5, ['Joins'])
    const form = new FormData()
    form.set('file', new File(['Lab 4 brief: join these tables and submit.'], 'Lab 4.txt'))
    form.set('subject_id', subject.id)
    const item = (await t.call('POST', '/companion/items/upload', form)).data
    // Filed from outside: not something they wrote just now, which would count as studying it.
    t.store.put('items', { ...t.store.get('items', item.id)!, topic_id: topics[0].id, source: 'import' })
    await t.call('POST', '/companion/deadlines', { subject_id: subject.id, kind: 'lab', title: 'Lab 4', due_at: new Date(Date.now() + 9 * DAY).toISOString() })
    await t.call('POST', '/companion/checks', { purpose: 'cold' })
    const user = t.provider.requests[0]!.body.messages.at(-1).content
    expect(user).toContain("THEIR HAND-INS (never ask any part of these)\n- Lab 4")
    expect(user).not.toContain('join these tables')
    expect(user).toContain('Material: none')
  })

  it('marks from the rubric, reveals only after, and a point the model skipped counts as missed', async () => {
    let verdicts = ['met', 'met']
    const t = await setup((s, u) => checkWriter(s, u) ?? (s.includes('You mark one answer') ? marks(verdicts) : null))
    await studied(t, 5, ['Joins'])
    const [first, second] = (await t.call('POST', '/companion/checks', { purpose: 'cold' })).data.checks
    const right = await t.call('POST', `/companion/checks/${first.id}/answer`, { answer: 'Because it matches keys.', confidence: 'sure' })
    expect(right.data.result).toBe('right')
    expect(right.data.revealed).toBe('Because of the model answer.')
    expect(right.data.tempting).toBeNull()
    expect(right.data.expected).toBeUndefined()
    verdicts = ['missed']
    const partly = await t.call('POST', `/companion/checks/${second.id}/answer`, { answer: 'No idea really.', confidence: 'sure' })
    expect(partly.status).toBe(200)
    expect(partly.data.result).toBe('wrong')
    expect(partly.data.tempting).toBe('It looks like the other rule.')
  })

  it("an empty answer is a wrong answer with no model call; a model that's down keeps the answer", async () => {
    let down = false
    const t = await setup((s, u) => checkWriter(s, u) ?? (s.includes('You mark one answer') ? (down ? { status: 401 } : marks(['met', 'met'])) : null))
    await studied(t, 5, ['Joins'])
    const [first, second] = (await t.call('POST', '/companion/checks', { purpose: 'cold' })).data.checks
    const before = t.provider.requests.length
    const blank = await t.call('POST', `/companion/checks/${first.id}/answer`, { answer: '' })
    expect(blank.data.result).toBe('wrong')
    expect(t.provider.requests.length).toBe(before)
    down = true
    const failed = await t.call('POST', `/companion/checks/${second.id}/answer`, { answer: 'My answer.' })
    expect(failed.status).toBe(503)
    expect(failed.json.message).toContain('saved')
    const row = t.store.get('checks', second.id)!
    expect(row.answer).toBe('My answer.')
    expect(row.result).toBeNull()
  })

  it('teach-back: explain, then the listener asks, then both are marked together', async () => {
    const t = await setup((s) => {
      if (s.includes('You write a check')) return { pieces: [JSON.stringify({ questions: [{ topic: 'T1', kind: 'explain', prompt: 'Explain joins to someone who missed it.', expected: 'A join matches rows on keys.', rubric: ['matches on a key'], source: null }] })] }
      if (s.includes('a classmate who missed the class')) return { pieces: ['{"follow_up":"What happens to a row with no match?"}'] }
      if (s.includes('You mark one answer')) return marks(['met'])
      return null
    })
    const { topics } = await studied(t, 1, ['Joins'])
    const sitting = await t.call('POST', '/companion/checks', { purpose: 'teach', topic_ids: [topics[0].id] })
    const check = sitting.data.checks[0]
    expect(check.kind).toBe('explain')
    // Straight after the class it's practice: it doesn't count toward readiness.
    expect(check.cold).toBe(false)
    const asked = await t.call('POST', `/companion/checks/${check.id}/answer`, { answer: 'It matches rows.' })
    expect(asked.data.follow_up).toBe('What happens to a row with no match?')
    expect(asked.data.result).toBeNull()
    const done = await t.call('POST', `/companion/checks/${check.id}/answer`, { follow_up_answer: 'It gets dropped.' })
    expect(done.data.result).toBe('right')
    expect(t.provider.requests.at(-1)!.body.messages.at(-1).content).toContain('THEIR REPLY\nIt gets dropped.')
  })

  it('reports writing progress while the questions are written', async () => {
    let polled: any = null
    const t = await setup((s, u) => {
      const out = checkWriter(s, u)
      return out ? { pieces: out.pieces!.join('').match(/[\s\S]{1,30}/g)!, delayMs: 25 } : null
    })
    await studied(t, 5, ['Joins'])
    const running = t.call('POST', '/companion/checks', { purpose: 'cold' })
    for (let i = 0; i < 60 && !polled?.topics?.[0]?.written; i++) {
      await new Promise((r) => setTimeout(r, 25))
      polled = (await t.call('GET', '/companion/checks/writing')).data ?? polled
    }
    await running
    expect(polled.topics[0].title).toBe('Joins')
    expect(polled.topics[0].written).toBeGreaterThan(0)
    expect((await t.call('GET', '/companion/checks/writing')).data).toBeNull()
  })
})

describe('readiness stays honest', () => {
  const answered = (t: any, topic: any, subject: any, result: string, cold: boolean, daysAgo: number, extra = {}) => t.store.put('checks', { id: crypto.randomUUID(), batch_id: crypto.randomUUID(), purpose: 'cold', subject_id: subject.id, topic_id: topic.id, deadline_id: null, kind: 'why', prompt: 'Q', cold, result, confidence: null, answer: 'A', asked_at: isoDaysAgo(daysAgo), answered_at: isoDaysAgo(daysAgo), graded_at: isoDaysAgo(daysAgo), ...extra })

  it('claims nothing from study alone or from a check asked while it was fresh', async () => {
    const t = await setup()
    const { subject, topics } = await studied(t, 5, ['Joins'])
    const exam = (await t.call('POST', '/companion/deadlines', { subject_id: subject.id, kind: 'exam', title: 'Exam', due_at: new Date(Date.now() + 9 * DAY).toISOString() })).data
    expect((await t.call('GET', `/companion/deadlines/${exam.id}/readiness`)).data).toMatchObject({ percent: 0, checked: 0 })
    answered(t, topics[0], subject, 'right', false, 1)
    expect((await t.call('GET', `/companion/deadlines/${exam.id}/readiness`)).data).toMatchObject({ percent: 0, checked: 0 })
    answered(t, topics[0], subject, 'right', true, 1)
    expect((await t.call('GET', `/companion/deadlines/${exam.id}/readiness`)).data).toMatchObject({ percent: 100, checked: 1 })
  })

  it('remembers what it said when the real grade comes in', async () => {
    const t = await setup()
    const { subject, topics } = await studied(t, 5, ['Joins'])
    answered(t, topics[0], subject, 'right', true, 1)
    const exam = (await t.call('POST', '/companion/deadlines', { subject_id: subject.id, kind: 'exam', title: 'Exam', due_at: new Date(Date.now() - DAY / 2).toISOString() })).data
    const graded = await t.call('PATCH', `/companion/deadlines/${exam.id}`, { grade: 74 })
    expect(graded.data.readiness_said).toBe(100)
    expect(graded.data.grade).toBe(74)
  })

  it('a finished lesson counts as having studied, dated when it was finished', async () => {
    const t = await setup(checkWriter)
    const subject = (await t.call('POST', '/companion/subjects', { title: 'Databases' })).data
    const topic = (await t.call('POST', '/companion/topics', { subject_id: subject.id, title: 'Joins' })).data
    const bridge = (await t.call('POST', `/companion/topics/${topic.id}/lesson`)).data
    await t.call('POST', `/nodes/${bridge.node_id}/progress`, { state: 'completed' })
    const fresh = await t.call('POST', '/companion/checks', { purpose: 'cold' })
    expect(fresh.data.checks).toEqual([])
    expect(fresh.data.opens_at).toBeTruthy()
    const node = t.store.rec('node', bridge.node_id)!
    t.store.save('node', { ...node, progress: { ...node.progress, completed_at: isoDaysAgo(4) } })
    const cold = await t.call('POST', '/companion/checks', { purpose: 'cold' })
    expect(cold.data.checks.length).toBeGreaterThan(0)
    expect(cold.data.checks[0].studied_days_ago).toBe(4)
  })
})

describe('the plan', () => {
  it("puts a check first when one is due, and marks it done when the sitting ends", async () => {
    const t = await setup((s, u) => checkWriter(s, u) ?? (s.includes('You mark one answer') ? marks(['met', 'met']) : null))
    await studied(t, 5, ['Joins'])
    const plan = (await t.call('POST', '/companion/plan/rebuild')).data.tasks
    expect(plan[0].kind).toBe('check')
    expect(plan[0].title).toBe('Check yourself on Joins')
    expect(plan[0].detail).toBe('2 questions · no notes, no help')
    const { checks } = (await t.call('POST', '/companion/checks', { purpose: 'cold' })).data
    for (const check of checks) await t.call('POST', `/companion/checks/${check.id}/answer`, { answer: 'An answer.' })
    const after = (await t.call('GET', '/companion/plan-tasks')).data.filter((x: any) => x.kind === 'check')
    expect(after[0].done_at).toBeTruthy()
  })

  it('sends them back over what a check found missing, until they have', async () => {
    const t = await setup((s, u) => checkWriter(s, u) ?? (s.includes('You mark one answer') ? marks(['missed', 'missed']) : null))
    const { topics } = await studied(t, 5, ['Joins'])
    const { checks } = (await t.call('POST', '/companion/checks', { purpose: 'cold' })).data
    for (const check of checks) await t.call('POST', `/companion/checks/${check.id}/answer`, { answer: 'Wrong.' })
    for (const c of t.store.live('checks')) t.store.put('checks', { ...c, answered_at: isoDaysAgo(0.1) })
    const plan = (await t.call('POST', '/companion/plan/rebuild')).data.tasks
    const read = plan.find((x: any) => x.kind === 'read')
    expect(read.title).toBe('Go back over Joins')
    expect(read.detail).toContain("Missed in today's check")
    await t.call('POST', '/companion/items', { id: crypto.randomUUID(), kind: 'page', title: 'My notes on joins', topic_id: topics[0].id, source: 'made' })
    const again = (await t.call('POST', '/companion/plan/rebuild')).data.tasks
    expect(again.some((x: any) => x.kind === 'read')).toBe(false)
  })
})

describe('notes against the lecture', () => {
  const fixture = async (t: any) => {
    const subject = (await t.call('POST', '/companion/subjects', { title: 'Databases' })).data
    const topic = (await t.call('POST', '/companion/topics', { subject_id: subject.id, title: 'Joins', summary: 'Matching rows across tables on a key.' })).data
    const form = new FormData()
    form.set('file', new File(['A left join keeps every row from the left table, and unmatched columns come back as NULL values in the result.'], 'lecture.txt'))
    form.set('subject_id', subject.id)
    const file = (await t.call('POST', '/companion/items/upload', form)).data
    await t.call('PATCH', `/companion/items/${file.id}`, { topic_id: topic.id, preview: 'A left join keeps every row from the left table, and unmatched columns come back as NULL values in the result.' })
    const page = (await t.call('POST', '/companion/items', { id: crypto.randomUUID(), kind: 'page', title: 'My notes', subject_id: subject.id, topic_id: topic.id, source: 'made' })).data
    const board = (await t.call('POST', '/companion/items', { id: crypto.randomUUID(), kind: 'board', title: 'Map', subject_id: subject.id, source: 'made' })).data
    return { subject, topic, file, page, board }
  }

  it('lists only gaps it can quote from the material', async () => {
    const t = await setup((s, u) => {
      if (!s.includes('check their lecture notes')) return null
      const id = u.match(/\[(E\d+) ·/)![1]
      return { pieces: [JSON.stringify({ gaps: [
        { title: 'Left joins keep rows', body: 'A left join keeps every left row.', why: 'on the slide', sources: [{ excerpt: id, quote: 'keeps every row from the left table' }] },
        { title: 'Invented', body: 'Something the material never says at all.', why: 'made up', sources: [{ excerpt: id, quote: 'hash joins are always faster than anything' }] },
      ] })] }
    })
    const { page } = await fixture(t)
    const res = await t.call('POST', `/companion/items/${page.id}/gaps`, { text: 'Joins match rows.' })
    expect(res.data.gaps.map((g: any) => g.title)).toEqual(['Left joins keep rows'])
    expect(res.data.compared).toBe('Your notes, compared with lecture.txt.')
    expect(res.data.gaps[0].sources[0].item_id).toBeTruthy()
  })

  it('says when there is no material to compare with, and spends nothing', async () => {
    const t = await setup()
    const subject = (await t.call('POST', '/companion/subjects', { title: 'Databases' })).data
    const page = (await t.call('POST', '/companion/items', { id: crypto.randomUUID(), kind: 'page', title: 'Notes', subject_id: subject.id, source: 'made' })).data
    const res = await t.call('POST', `/companion/items/${page.id}/gaps`, { text: 'x' })
    expect(res.data.reason).toBe('no-material')
    expect(t.provider.requests).toHaveLength(0)
  })

  it('maps a course with only ideas it can quote, and never its own title back', async () => {
    const t = await setup((s) => {
      if (!s.includes('revision mind map')) return null
      return { pieces: [JSON.stringify({ ideas: [
        { topic: 'T1', label: 'Unmatched columns are NULL', source: 'T1', quote: 'Matching rows across tables on a key' },
        { topic: 'T1', label: 'Joins', source: 'T1', quote: 'Matching rows across tables on a key' },
        { topic: 'T1', label: 'Not in the material', source: 'T1', quote: 'this sentence does not appear anywhere' },
      ] })] }
    })
    const { board } = await fixture(t)
    const res = await t.call('POST', `/companion/items/${board.id}/map`, { scope: 'course' })
    expect(res.status).toBe(200)
    expect(res.data.root.label).toBe('Databases')
    expect(res.data.root.children[0].label).toBe('Joins')
    expect(res.data.root.children[0].children.map((c: any) => c.label)).toEqual(['Unmatched columns are NULL'])
    expect(res.data.title).toBe('Mapped Databases')
  })

  it('a board with no course says so', async () => {
    const t = await setup()
    const board = (await t.call('POST', '/companion/items', { id: crypto.randomUUID(), kind: 'board', title: 'Map', source: 'made' })).data
    expect((await t.call('POST', `/companion/items/${board.id}/map`, {})).status).toBe(422)
  })
})

describe('a goal from a sentence', () => {
  const intake = (over: Record<string, unknown> = {}) => ({ pieces: [JSON.stringify({ subject_title: 'Italian', goal_title: 'Italian · B1 by {date}', language: 'en', current_level: 'A2', target: 'B1', finish_kind: 'exam', finish_label: 'CELI B1', deadline: { weeks_from_now: 10 }, questions: [], ...over })] })

  it('asks once for what it needs, in the words offered', async () => {
    const t = await setup((s) => (s.includes('the one sentence a learner typed') ? intake({ current_level: null, deadline: null, questions: [{ id: 'current_level', question: 'Where do you start?', options: ['New', 'A2'] }] }) : null))
    const res = await t.call('POST', '/companion/goals/from-sentence', { sentence: 'I want Italian' })
    expect(res.status).toBe(200)
    expect(res.data.questions.map((q: any) => q.id)).toEqual(['current_level', 'deadline'])
    expect(res.data.questions[0].question).toBe('Where do you start?')
    expect(res.data.questions[1].question).toBe('When do you want to get there?')
  })

  it('makes the goal, the course and the path; the code works out the date', async () => {
    const t = await setup((s) => {
      if (s.includes('the one sentence a learner typed')) return intake()
      if (s.includes('curriculum architect')) return { pieces: [JSON.stringify({ units: [{ title: 'Everyday', topics: [{ title: 'Ordering food', summary: 'Order in a cafe.' }] }, { title: 'Past', topics: [{ title: 'Passato prossimo', summary: 'Say what happened.' }] }] })] }
      return null
    })
    const res = await t.call('POST', '/companion/goals/from-sentence', { sentence: 'Italian to B1 in 10 weeks' })
    expect(res.status).toBe(201)
    expect(res.data.goal.ends_on).toBe(new Date(Date.now() + 70 * DAY).toISOString().slice(0, 10))
    expect(res.data.goal.title).toContain('Italian · B1 by')
    expect(res.data.subject.format).toBe('path')
    expect(res.data.topics).toHaveLength(4)
  })
})

describe('signals', () => {
  const facts = (list: unknown[]) => ({ pieces: [JSON.stringify({ facts: list })] })

  it('keeps only facts whose quote is in the text, and never adds them until accepted', async () => {
    const t = await setup((s) => (s.includes('pull out the facts') ? facts([
      { type: 'deadline.create', course_title: 'Databases', kind: 'quiz', title: 'Quiz 2', when: { days_from_now: 1, time: '09:00' }, evidence: 'Quiz 2 is tomorrow at 9' },
      { type: 'deadline.create', course_title: 'Databases', kind: 'exam', title: 'Fake exam', when: { days_from_now: 2 }, evidence: 'this was never said by anyone' },
    ]) : null))
    const subject = (await t.call('POST', '/companion/subjects', { title: 'Databases' })).data
    const res = await t.call('POST', '/companion/ingest/text', { text: 'Reminder: Quiz 2 is tomorrow at 9 in the databases class', channel: 'share' })
    expect(res.data).toHaveLength(1)
    const signal = res.data[0]
    expect(signal.facts).toHaveLength(1)
    expect(signal.status).toBe('pending')
    expect(signal.confidence).toBe('shared')
    expect((await t.call('GET', '/companion/deadlines')).data).toEqual([])

    const applied = await t.call('POST', `/companion/signals/${signal.id}/apply`, {})
    expect(applied.status).toBe(200)
    expect(applied.data.signal.status).toBe('applied')
    const deadline = (await t.call('GET', '/companion/deadlines')).data[0]
    expect(deadline).toMatchObject({ title: 'Quiz 2', kind: 'quiz', subject_id: subject.id, confidence: 'shared', tentative: true })
    expect(deadline.sources[0].evidence).toBe('Quiz 2 is tomorrow at 9')
    expect(Date.parse(deadline.due_at)).toBeGreaterThan(Date.now())
  })

  it('an update moves the deadline it means and keeps the history; a cancel cancels', async () => {
    const t = await setup((s, u) => (s.includes('pull out the facts')
      ? u.includes('cancelled') ? facts([{ type: 'deadline.cancel', title: 'lab 4', evidence: 'lab 4 is cancelled' }])
        : facts([{ type: 'deadline.update', title: 'lab 4', when: { month: 12, day: 1, time: '17:00' }, evidence: 'lab 4 moved to 1 December 5pm' }]) : null))
    const subject = (await t.call('POST', '/companion/subjects', { title: 'Databases' })).data
    const lab = (await t.call('POST', '/companion/deadlines', { subject_id: subject.id, kind: 'lab', title: 'Lab 4 report', due_at: new Date(Date.now() + 5 * DAY).toISOString() })).data
    const moved = (await t.call('POST', '/companion/ingest/text', { text: 'heads up lab 4 moved to 1 December 5pm', channel: 'manual' })).data[0]
    expect(moved.facts[0].target_id).toBe(lab.id)
    expect(moved.confidence).toBe('own')
    await t.call('POST', `/companion/signals/${moved.id}/apply`, {})
    const after = (await t.call('GET', `/companion/deadlines/${lab.id}`)).data
    expect(after.title).toBe('Lab 4 report')
    expect(after.due_at).toContain('-12-01')
    expect(after.sources.at(-1).evidence).toBe('lab 4 moved to 1 December 5pm')
    const off = (await t.call('POST', '/companion/ingest/text', { text: 'sorry, lab 4 is cancelled', channel: 'manual' })).data[0]
    await t.call('POST', `/companion/signals/${off.id}/apply`, {})
    expect((await t.call('GET', `/companion/deadlines/${lab.id}`)).data.status).toBe('cancelled')
  })

  it('what cannot be applied says why, and a dismissed signal stays dismissed', async () => {
    const t = await setup((s) => (s.includes('pull out the facts') ? facts([{ type: 'deadline.create', course_title: 'Unknown course', kind: 'quiz', title: 'Quiz 9', evidence: 'quiz 9 is coming' }]) : null))
    const signal = (await t.call('POST', '/companion/ingest/text', { text: 'quiz 9 is coming', channel: 'share' })).data[0]
    const res = await t.call('POST', `/companion/signals/${signal.id}/apply`, {})
    expect(res.status).toBe(422)
    expect(res.json.skipped[0].reason).toBe('Could not tell which course this is for.')
    await t.call('POST', `/companion/signals/${signal.id}/dismiss`)
    expect((await t.call('POST', `/companion/signals/${signal.id}/apply`, {})).status).toBe(409)
  })

  it('never computes a date the text did not give', () => {
    const c = { zone: 'UTC', now: Date.UTC(2026, 9, 28, 12), today: '2026-10-28', subjects: [], deadlines: [], term: null, hint: null, channel: 'manual' }
    expect(resolveWhen({ week_number: 10 }, c)).toBeNull()
    expect(resolveWhen({ month: 2, day: 30 }, c)).toBeNull()
    expect(resolveWhen({ weekday: 3, time: '09:00' }, c)!.starts).toBe(Date.UTC(2026, 10, 4, 9)) // a Wednesday already gone today
    expect(resolveWhen({ weekday: 5 }, c)).toMatchObject({ allDay: true, starts: Date.UTC(2026, 9, 30, 23, 59) })
    expect(resolveWhen({ weekday: 1, next_week: true }, c)!.starts).toBe(Date.UTC(2026, 10, 2, 23, 59))
    expect(resolveWhen({ month: 1, day: 5 }, c)!.starts).toBe(Date.UTC(2027, 0, 5, 23, 59))
  })

  it('finds a quote through what a model does to quotes and dashes', () => {
    expect(locateEvidence('“Lab 4 — due Friday”', 'see: "Lab 4 - due Friday" ok')).toBe('Lab 4 - due Friday')
    expect(locateEvidence('not there at all', 'something else')).toBeNull()
  })

  it('matches names as people write them, and refuses a close wrong one', () => {
    const subjects = [{ id: 'a', title: 'Programming 1', code: 'CSC1001' }, { id: 'b', title: 'Databases', code: null }] as any[]
    expect(matchCourse('csc 1001', null, subjects)!.id).toBe('a')
    expect(matchCourse(null, 'the databases class', subjects)!.id).toBe('b')
    expect(matchCourse(null, 'Programming 2', subjects)).toBeNull()
    expect(courseScore('Databses', subjects[1])).toBe(0.75)
    const deadlines = [{ id: 'x', title: 'Lab 4 report', kind: 'lab', status: 'upcoming', subject_id: 'b', due_at: null }, { id: 'y', title: 'Lab 5 report', kind: 'lab', status: 'upcoming', subject_id: 'b', due_at: null }] as any[]
    expect(matchDeadline(deadlines, 'b', null, 'lab 4', 0)!.id).toBe('x')
    expect(matchDeadline(deadlines, 'b', null, 'lab 7', 0)).toBeNull()
  })

  it('an exam timetable PDF reads only their rows; a photo names what it needs', async () => {
    const t = await setup((s, u) => {
      if (!s.includes('pull out the facts')) return null
      expect(u).toContain('CSC2103')
      expect(u).not.toContain('MTH9999')
      expect(u).toContain('EXAM TIMETABLE')
      return facts([{ type: 'deadline.create', course_code: 'CSC2103', kind: 'final', title: 'Final exam', when: { day: 14, month: 12, year: 2026, time: '09:00' }, location: 'Hall B', evidence: 'CSC2103 Data Structures 14/12/2026 09:00 Hall B' }])
    })
    await t.call('POST', '/companion/subjects', { title: 'Data Structures', code: 'CSC2103' })
    const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 600 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 120>>stream
BT /F1 10 Tf 20 150 Td (CSC2103 Data Structures 14/12/2026 09:00 Hall B) Tj 0 -20 Td (MTH9999 Other 15/12/2026 09:00 Hall C) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`
    const form = new FormData()
    form.set('file', new File([pdf], 'exams.pdf', { type: 'application/pdf' }))
    const res = await t.call('POST', '/companion/ingest/file', form)
    expect(res.status).toBe(200)
    expect(res.data[0].facts[0].payload.location).toBe('Hall B')
    expect(res.data[0].confidence).toBe('own')

    const photo = new FormData()
    photo.set('file', new File([Buffer.from([0x89, 0x50, 0x4e, 0x47])], 'timetable.png', { type: 'image/png' }))
    const refused = await t.call('POST', '/companion/ingest/file', photo)
    expect(refused.status).toBe(422)
    expect(refused.json.reason).toBe('photo_reading_off')
    expect(refused.json.message).toContain('vision model')
  })
})

const ICS = (now: Date) => {
  const stamp = (d: Date, time = '090000') => `${d.toISOString().slice(0, 10).replace(/-/g, '')}T${time}Z`
  const inDays = (n: number) => new Date(now.getTime() + n * DAY)
  return `BEGIN:VCALENDAR
PRODID:-//Test//EN
X-WR-CALNAME:My timetable
BEGIN:VEVENT
UID:lecture-1
SUMMARY:CSC2103 Lecture - Data Structures
DTSTART:${stamp(inDays(-14))}
DTEND:${stamp(inDays(-14), '100000')}
RRULE:FREQ=WEEKLY;COUNT=6
LOCATION:Room 2\\, Block A
END:VEVENT
BEGIN:VEVENT
UID:quiz-2
SUMMARY:CSC2103 Quiz 2
DESCRIPTION:Chapters 4-5. Worth 10% of the grade.
DTSTART:${stamp(inDays(5))}
DTEND:${stamp(inDays(5))}
CATEGORIES:CSC2103
END:VEVENT
BEGIN:VEVENT
UID:party
SUMMARY:Birthday party
DTSTART:${stamp(inDays(3))}
DTEND:${stamp(inDays(3), '120000')}
END:VEVENT
END:VCALENDAR`
}

describe('a calendar', () => {
  it('becomes a course, its classes and its deadlines, and only that', async () => {
    const t = await setup()
    const res = await t.call('POST', '/companion/ingest/ics', { ics_text: ICS(new Date()) })
    expect(res.status).toBe(200)
    expect(res.data.created).toEqual({ subjects: 1, deadlines: 1, slots: 1, sessions: 6 })
    expect(res.data.details.skipped).toBe(1)
    expect(res.data.connection.label).toBe('My timetable')
    const subject = (await t.call('GET', '/companion/subjects')).data[0]
    expect(subject).toMatchObject({ code: 'CSC2103', title: 'Data Structures', source: 'ics' })
    const sessions = (await t.call('GET', '/companion/sessions?from=2020-01-01&to=2100-01-01')).data
    expect(sessions[0]).toMatchObject({ title: 'Lecture 1', location: 'Room 2, Block A', number: 1 })
    const quiz = (await t.call('GET', '/companion/deadlines')).data[0]
    expect(quiz).toMatchObject({ title: 'Quiz 2', kind: 'quiz', weight_pct: 10, scope_note: 'Chapters 4-5', confidence: 'official' })
    expect(quiz.sources[0].kind).toBe('ics')
  })

  it('reading it again changes nothing; a moved deadline moves; a deleted one stays deleted', async () => {
    const t = await setup()
    const now = new Date()
    await t.call('POST', '/companion/ingest/ics', { ics_text: ICS(now) })
    const again = await t.call('POST', '/companion/ingest/ics', { ics_text: ICS(now) })
    expect(again.data.created).toEqual({ subjects: 0, deadlines: 0, slots: 0, sessions: 0 })
    expect(again.data.updated).toBe(0)
    const quiz = (await t.call('GET', '/companion/deadlines')).data[0]
    const moved = await t.call('POST', '/companion/ingest/ics', { ics_text: ICS(now).replace(/UID:quiz-2\nSUMMARY:CSC2103 Quiz 2\nDESCRIPTION:[^\n]*\nDTSTART:\d+T090000Z/, (m) => m.replace('T090000Z', 'T140000Z')) })
    expect(moved.data.details.moved).toBe(1)
    expect((await t.call('GET', `/companion/deadlines/${quiz.id}`)).data.due_at).toContain('T14:00')
    await t.call('DELETE', `/companion/deadlines/${quiz.id}`)
    const after = await t.call('POST', '/companion/ingest/ics', { ics_text: ICS(now) })
    expect(after.data.created.deadlines).toBe(0)
    expect((await t.call('GET', '/companion/deadlines')).data).toEqual([])
  })

  it('reads a link through the guard, and a feed that stops working says so on the connection', async () => {
    let up = true
    const fetcher = (async () => (up ? new Response(ICS(new Date())) : new Response('gone', { status: 500 }))) as unknown as typeof fetch
    const t = await setup(() => null, { fetcher })
    const first = await t.call('POST', '/companion/ingest/ics', { url: 'webcal://school.example/cal.ics' })
    expect(first.data.connection.url).toBe('https://school.example/cal.ics')
    up = false
    const failed = await t.call('POST', `/companion/connections/${first.data.connection.id}/sync`)
    expect(failed.status).toBe(422)
    expect(failed.json.data.connection.status).toBe('error')
    expect((await t.call('POST', '/companion/ingest/ics', { ics_text: 'not a calendar' })).status).toBe(422)
    const blocked = await setup()
    expect((await blocked.call('POST', '/companion/ingest/ics', { url: 'http://127.0.0.1:1/cal.ics' })).json.errors.url[0]).toContain('private or internal')
  })

  it('keeps a class at its local time across a clock change, honours exceptions and moved days', () => {
    const start = Date.UTC(2026, 9, 19, 8) // Monday 19 Oct, 09:00 in Paris (summer time)
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:a
SUMMARY:Lecture
DTSTART;TZID=Europe/Paris:20261019T100000
DTEND;TZID=Europe/Paris:20261019T110000
RRULE:FREQ=WEEKLY;UNTIL=20261116T235959Z
EXDATE;TZID=Europe/Paris:20261102T100000
END:VEVENT
BEGIN:VEVENT
UID:a
RECURRENCE-ID;TZID=Europe/Paris:20261109T100000
SUMMARY:Lecture
DTSTART;TZID=Europe/Paris:20261110T140000
DTEND;TZID=Europe/Paris:20261110T150000
END:VEVENT
END:VCALENDAR`
    const events = occurrencesOf(ics, 'Europe/Paris', start)
    const utcHours = events.map((e) => [new Date(e.starts).toISOString().slice(5, 16)])
    expect(utcHours.flat()).toEqual(['10-19T08:00', '10-26T09:00', '11-10T13:00', '11-16T09:00'])
    expect(events[0]!.recurring).toBe(true)
  })
})

describe('search', () => {
  it('finds courses, lessons, what they say and notes; never an answer key', async () => {
    const t = await setup()
    const subject = (await t.call('POST', '/companion/subjects', { title: 'Italian basics' })).data
    const topic = (await t.call('POST', '/companion/topics', { subject_id: subject.id, title: 'Ordering food' })).data
    const bridge = (await t.call('POST', `/companion/topics/${topic.id}/lesson`)).data
    const block = t.store.add('block', bridge.node_id, { node_id: bridge.node_id, position: 0, type: 'explainer', payload: { markdown: 'Vorrei is the polite way to ask.' }, source_material_ids: null })
    t.store.add('assessment', bridge.node_id, { node_id: bridge.node_id, block_id: block.id, kind: 'short_answer', prompt: 'Q', answer_key: { reference_answer: 'zanzibarquokka' }, grader: 'self', max_score: 100, position: 0 })
    await t.call('POST', '/companion/items', { id: crypto.randomUUID(), kind: 'page', title: 'Cafe phrases', preview: 'un caffe per favore', source: 'made' })

    const search = async (q: string) => (await t.call('GET', `/search?q=${encodeURIComponent(q)}`)).data
    const food = await search('ordering')
    expect(food.retrieval).toBe('fts')
    expect(food.groups.map((g: any) => g.key)).toEqual(['lessons'])
    expect(food.groups[0].results[0].course.path).toBe(`/app/courses/${subject.id}`)
    const said = await search('polite');
    expect(said.groups[0].key).toBe('content')
    expect(said.groups[0].results[0].snippet).toContain('\uE000polite\uE001')
    expect((await search('caffe')).groups[0].results[0].material.title).toBe('Cafe phrases')
    expect((await search('zanzibarquokka')).groups).toEqual([])
    // What's typed is never search syntax; one letter isn't a search.
    expect((await search('"unclosed OR ( * NEAR')).retrieval).toBe('fts')
    expect((await search('a')).retrieval).toBe('none')
    // New writing shows up without anything telling the index.
    await t.call('POST', '/companion/items', { id: crypto.randomUUID(), kind: 'page', title: 'Pizza words', source: 'made' })
    expect((await search('pizza')).groups[0].results[0].title).toBe('Pizza words')
  })
})

describe('speech', () => {
  const synthesize = (async (text: string) => {
    calls.push(text)
    return { mp3: Buffer.from('mp3'), words: [], duration_ms: 2000, cached: false }
  }) as never
  const calls: string[] = []

  it('reads aloud through the voice service and serves the clip, never playing anything', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'bm-tts-'))
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
    const t = await setup(() => null, { synthesize })
    const res = await t.call('POST', '/audio/tts', { text: 'Buongiorno', language: 'ms' })
    expect(calls).toEqual(['Buongiorno'])
    expect(res.data.seconds).toBe(2)
    expect(res.data.voice).toBe('ms-MY-YasminNeural')
    expect(res.data.url).toMatch(/^app:\/\/bilimind\/api\/audio\/clips\/[a-f0-9]{64}\.mp3$/)
    expect((await t.call('GET', '/audio/clips/..%2F..%2Fkeys.json')).status).toBe(404)
    expect((await t.call('GET', '/audio/voices')).data.length).toBeGreaterThan(2)
  })

  it('says plainly when the voice service is out of reach, or there is no speech-to-text', async () => {
    const t = await setup(() => null, { synthesize: (async () => { throw new Error('offline') }) as never })
    const res = await t.call('POST', '/audio/tts', { text: 'x' })
    expect(res.status).toBe(503)
    expect(res.json.message).toContain("Microsoft's online voice service")
    const form = new FormData()
    form.set('audio', new File(['x'], 'speech.webm'))
    const stt = await t.call('POST', '/speech/transcribe', form)
    expect(stt.status).toBe(503)
    expect(stt.json.message).toContain('speech-to-text')
  })

  it('role-plays a dialogue block in character', async () => {
    const t = await setup((s) => (s.includes('SPEAKING') ? { pieces: ['{"reply":"Certo, un caffe.","goal_met":true,"correction":"Say vorrei."}'] } : null))
    const subject = (await t.call('POST', '/companion/subjects', { title: 'Italian' })).data
    const topic = (await t.call('POST', '/companion/topics', { subject_id: subject.id, title: 'Cafe' })).data
    const bridge = (await t.call('POST', `/companion/topics/${topic.id}/lesson`)).data
    const block = t.store.add('block', bridge.node_id, { node_id: bridge.node_id, position: 0, type: 'dialogue', payload: { scenario_markdown: 'A cafe', ai_role: 'barista', learner_role: 'customer', goal: 'order coffee' } })
    const res = await t.call('POST', '/speech/dialogue', { node_id: bridge.node_id, block_id: block.id, text: 'Voglio caffe', history: [] })
    expect(res.json).toEqual({ reply: 'Certo, un caffe.', correction: 'Say vorrei.', goal_met: true })
    expect(t.provider.requests.at(-1)!.body.messages[0].content).toContain('YOUR ROLE: barista.')
  })
})

describe('your data', () => {
  it('exports a course as one page that passes the player schema', async () => {
    const template = '<!doctype html><script id="bm-course" type="application/json">__BM_COURSE__</script>'
    let saved = ''
    const t = await setup(() => null, { exporter: { template: () => template, save: async (name, html) => { saved = html; return `/somewhere/${name}` } } })
    const subject = (await t.call('POST', '/companion/subjects', { title: 'Italian: basics!' })).data
    const unit = (await t.call('POST', '/companion/topics', { subject_id: subject.id, title: 'First words' })).data
    const topic = (await t.call('POST', '/companion/topics', { subject_id: subject.id, parent_id: unit.id, title: 'Cafe' })).data
    const empty = (await t.call('POST', `/companion/topics/${topic.id}/lesson`)).data
    expect((await t.call('POST', `/courses/${empty.course_id}/export`)).status).toBe(422)
    const node = t.store.rec('node', empty.node_id)!
    const block = t.store.add('block', node.id, { node_id: node.id, position: 0, type: 'quiz', payload: { intro: 'Check it.', assessment_ids: [] }, source_material_ids: null })
    t.store.add('block', node.id, { node_id: node.id, position: 1, type: 'explainer', payload: { markdown: 'Vorrei is polite.' }, source_material_ids: null })
    const a = t.store.add('assessment', node.id, { node_id: node.id, block_id: block.id, kind: 'mcq', prompt: 'Which is polite?', options: [{ id: 'a', text: 'Voglio' }, { id: 'b', text: 'Vorrei' }], answer_key: { correct_option_ids: ['b'] }, grader: 'deterministic', max_score: 100, position: 0 })
    t.store.save('block', { ...block, payload: { intro: 'Check it.', assessment_ids: [a.id] } })
    t.store.save('node', { ...node, status: 'ready', archetype: 'factual' })
    const res = await t.call('POST', `/courses/${empty.course_id}/export`)
    expect(res.status).toBe(200)
    expect(res.data.path).toBe('/somewhere/Italian basics')
    expect(saved).toContain('Vorrei is polite.')
    expect(saved).toContain('Which is polite?')
  })

  it('backs up and restores, keeping what was there; a folder that is not a backup is refused', async () => {
    const root = mkdtempSync(join(tmpdir(), 'bm-backup-'))
    cleanups.push(() => rmSync(root, { recursive: true, force: true }))
    const dataDir = join(root, 'data')
    let folder = root
    let relaunched = false
    const options = { seedStarter: false, dataDir, configDir: join(root, 'config'), userName: 'Ada', vault: fakeVault(), folders: { pick: async () => folder, build: async () => ({ course: '' }), stop: () => undefined }, relaunch: () => { relaunched = true } }
    let api = createApi(options)
    const call = async (method: string, path: string, body?: unknown) => {
      const res = await api.handle(new Request(`app://bilimind/api${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }))
      return { status: res.status, json: await res.json().catch(() => null) as any }
    }
    await call('POST', '/credentials', { provider: 'deepseek', key: 'sk-test-0123456789abcdef' })
    await call('POST', '/companion/subjects', { title: 'Before the backup' })
    const form = new FormData()
    form.set('file', new File(['my notes'], 'notes.txt'))
    await api.handle(new Request('app://bilimind/api/companion/items/upload', { method: 'POST', body: form }))
    const backup = (await call('POST', '/companion/data/backup')).json.data.path as string
    expect(existsSync(join(backup, 'companion.db'))).toBe(true)
    expect(existsSync(join(backup, 'keys.json'))).toBe(false)

    await call('POST', '/companion/subjects', { title: 'After the backup' })
    folder = join(root, 'not-a-backup')
    mkdirSync(folder)
    expect((await call('POST', '/companion/data/restore')).status).toBe(422)
    expect((await call('GET', '/companion/subjects')).json.data).toHaveLength(2)

    folder = backup
    expect((await call('POST', '/companion/data/restore')).json.data).toEqual({ restarting: true })
    await new Promise((r) => setTimeout(r, 350))
    expect(relaunched).toBe(true)
    api.close()
    api = createApi(options)
    const subjects = (await call('GET', '/companion/subjects')).json.data
    expect(subjects.map((s: any) => s.title)).toEqual(['Before the backup'])
    const item = (await call('GET', '/companion/items')).json.data[0]
    const file = await api.handle(new Request(`app://bilimind/api/companion-files/${item.id}`))
    expect(await file.text()).toBe('my notes')
    expect((await call('GET', '/credentials')).json.data).toHaveLength(1)
    const kept = (await import('node:fs')).readdirSync(dataDir).find((n) => n.startsWith('before-restore-'))!
    expect(existsSync(join(dataDir, kept, 'companion.db'))).toBe(true)
    api.close()
  })
})

describe('what a course leaves behind', () => {
  it('deleting a subject takes its course, lessons, history and files with it', async () => {
    const t = await setup()
    const subject = (await t.call('POST', '/companion/subjects', { title: 'Italian' })).data
    const topic = (await t.call('POST', '/companion/topics', { subject_id: subject.id, title: 'Cafe' })).data
    const bridge = (await t.call('POST', `/companion/topics/${topic.id}/lesson`)).data
    const block = t.store.add('block', bridge.node_id, { node_id: bridge.node_id, position: 0, type: 'explainer', payload: { markdown: 'x' } })
    const a = t.store.add('assessment', bridge.node_id, { node_id: bridge.node_id, block_id: block.id, kind: 'mcq', prompt: 'Q', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], answer_key: { correct_option_ids: ['a'] }, grader: 'deterministic', max_score: 100, position: 0 })
    await t.call('POST', `/assessments/${a.id}/attempt`, { response: { option_id: 'a' } })
    const form = new FormData()
    form.set('file', new File(['%PDF-1.4 fake'], 'a.pdf'))
    const made = (await t.call('POST', `/nodes/${bridge.node_id}/attachments`, form)).data
    const stored = t.store.recByUuid('attachment', made.uuid)!.path
    expect(existsSync(join(t.store.filesDir, stored))).toBe(true)
    await t.call('POST', `/nodes/${bridge.node_id}/progress`, { state: 'completed' })

    expect((await t.call('DELETE', `/companion/subjects/${subject.id}`)).status).toBe(204)
    for (const kind of ['course', 'node', 'block', 'assessment', 'attempt', 'attachment', 'review'] as const) expect(t.store.recs(kind), kind).toEqual([])
    expect(existsSync(join(t.store.filesDir, stored))).toBe(false)
    expect((await t.call('GET', `/courses/${bridge.course_id}`)).status).toBe(404)
  })

  it('a completed lesson is seeded for review tomorrow, and recall moves it', async () => {
    const t = await setup()
    const subject = (await t.call('POST', '/companion/subjects', { title: 'Italian' })).data
    const topic = (await t.call('POST', '/companion/topics', { subject_id: subject.id, title: 'Cafe' })).data
    const bridge = (await t.call('POST', `/companion/topics/${topic.id}/lesson`)).data
    await t.call('POST', `/nodes/${bridge.node_id}/progress`, { state: 'completed' })
    await t.call('POST', `/nodes/${bridge.node_id}/progress`, { state: 'in_progress' })
    await t.call('POST', `/nodes/${bridge.node_id}/progress`, { state: 'completed' })
    expect(t.store.recs('review')).toHaveLength(1)
    expect((await t.call('GET', '/reviews/today')).json.meta.due).toBe(0)
    const stats = (await t.call('GET', '/reviews/stats')).data
    expect(stats).toMatchObject({ total: 1, upcoming: 1, due: 0 })
    const item = t.store.recs('review')[0]!
    t.store.save('review', { ...item, due_on: new Date(Date.now() - DAY).toISOString().slice(0, 10) })
    const due = (await t.call('GET', '/reviews/today')).json
    expect(due.data[0].node.title).toBe('Cafe')
    expect(due.data[0].is_overdue).toBe(true)
    const good = (await t.call('POST', '/reviews', { node_id: bridge.node_id, quality: 4 })).json
    expect(good.meta).toMatchObject({ interval_days: 1, remaining_due: 0 })
    const lapse = (await t.call('POST', '/reviews', { node_id: bridge.node_id, quality: 1 })).json
    expect(lapse.data).toMatchObject({ lapses: 1, state: 'learning', repetitions: 0 })
    expect((await t.call('GET', '/reviews/stats')).data.streak.active_today).toBe(true)
  })

  it('a course has no weekly schedule here, in the words a hosted one with none gives', async () => {
    const t = await setup()
    const subject = (await t.call('POST', '/companion/subjects', { title: 'Italian' })).data
    const topic = (await t.call('POST', '/companion/topics', { subject_id: subject.id, title: 'Cafe' })).data
    const { course_id } = (await t.call('POST', `/companion/topics/${topic.id}/lesson`)).data
    const res = await t.call('GET', `/courses/${course_id}/schedule`)
    expect(res.status).toBe(404)
    expect(res.json.message).toBe('This course has no schedule yet.')
  })
})

describe('caps', () => {
  it('default to $1 a course and $2 a day', async () => {
    const t = await setup()
    expect((await t.call('GET', '/companion/spending')).data.caps).toEqual({ run_usd: 1, day_usd: 2 })
  })
})

describe('a built course with subtopics', () => {
  it('keeps every lesson, under the step it belongs to', async () => {
    const { importBuilt } = await import('../merged/shell/src/api/lessons/folder.ts')
    const t = await setup()
    const dir = mkdtempSync(join(tmpdir(), 'bm-sub-'))
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
    writeFileSync(join(dir, 'x'), '')
    const quiz = { id: 'b1', type: 'explainer', title: 'Why', payload: { markdown: 'Text.' }, cites: [{ file: 'sources/a.pdf' }, { file: 'sources/a.pdf' }], assessments: [] }
    const lesson = (id: string, parent: string | null) => ({ id, title: id, summary: 's', archetype: 'conceptual', minutes: 10, track: parent ? 'subtopic' : 'core', parent, blocks: [quiz] })
    const built = {
      title: 'Hash tables', language: 'en', allows_code: false, goal: { sentence: 'Quiz in 5 days', minutes_per_day: 30, deadline: null, exam_at: null }, receipts: { cost_usd: 0.04 },
      lessons: [lesson('step1', null), lesson('kid', 'step1'), lesson('orphan', 'step2')],
      path: [
        { id: 'step1', step: 1, title: 'Step one', section: 'Part A', lesson: 'step1', items: [{ id: 'kid', title: 'Kid', mark: 'anytime', lesson: 'kid', group: null, minutes: 5 }] },
        { id: 'step2', step: 2, title: 'Step two', section: 'Part A', lesson: null, cut: true, items: [{ id: 'orphan', title: 'Orphan', mark: null, lesson: 'orphan', group: null }, { id: 'cutkid', title: 'Cut kid', mark: null, lesson: null, group: null, cut: true }] },
      ],
    }
    const { course, subject } = t.store.tx(() => importBuilt(t.store, built, dir, 'UTC', t.store.filesDir))
    const nodes = t.store.recs('node', course.id)
    expect(nodes.filter((n) => n.status === 'ready').map((n) => n.key).sort()).toEqual(['kid', 'orphan', 'step1'])
    const kid = nodes.find((n) => n.key === 'kid')!
    expect(kid).toMatchObject({ track: 'subtopic', mark: 'anytime', branch_of_node_id: nodes.find((n) => n.key === 'step1')!.id })
    expect(nodes.find((n) => n.key === 'step1')!.section).toBe('Part A')
    expect(nodes.find((n) => n.key === 'step2')!.section).toBeNull()
    expect(t.store.recs('block', kid.id)[0]!.source_material_ids).toEqual([1])
    expect(t.store.live('topics').filter((x) => x.subject_id === subject.id && x.parent_id)).toHaveLength(3)
    // The built folder isn't deleted when it isn't the app's own.
    expect(contextFor(t.store, 'manual').subjects).toHaveLength(1)
    expect(readFileSync(join(dir, 'x'), 'utf8')).toBe('')
  })
})

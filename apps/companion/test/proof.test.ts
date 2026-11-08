// Checks, readiness, gaps, maps, goals, signals, speech, export, backup: with a fake provider, and a
// fake clock where a check has to be days old.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createApi, type ApiOptions } from '../merged/shell/src/api/handler.ts'
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
    // The first check waits a day after study (Readiness' FIRST_COLD_DAYS), so half a day isn't cold yet.
    await studied(t, 0.5)
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
    const { topics } = await studied(t, 0.5, ['Joins'])
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
    expect(res.data.goal.ends_on).toBe(new Date(Date.now() + 70 * DAY).toLocaleDateString('en-CA')) // the learner's day, not UTC's
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

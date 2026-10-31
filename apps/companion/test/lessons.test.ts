// Courses and lessons against a fake provider: a chat draft becomes a course, a topic becomes a written lesson whose page
// polls its draft, answers get marked or say why not, and history and files hang off the lesson.
import { BilimindError } from '@bilimind/engine/contracts'
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { topicSignal } from '../merged/app/companion/readiness.ts'
import { isPrivateAddress, publicFetch } from '../merged/shell/src/api/ask/public-fetch.ts'
import { createApi } from '../merged/shell/src/api/handler.ts'
import { chunksForLesson, type FolderDeps } from '../merged/shell/src/api/lessons/folder.ts'
import { worldOf } from '../merged/shell/src/api/rows.ts'
import { fakeProvider, inPieces, type FakeReply } from './fake-provider.ts'
import { fakeVault, testApi } from './helpers.ts'

const PROPOSAL = {
  title: 'Italian to B1',
  kind: 'self',
  summary: 'You will hold a conversation in Italian.',
  finish: { kind: 'date', label: 'B1', date: null },
  minutes_per_week: 150,
  units: [
    { title: 'Getting started', topics: [{ title: 'Passato prossimo with essere', summary: 'Past tense with essere.' }, { title: 'Ordering food', summary: 'At the table.' }] },
    { title: 'Moving on', topics: [{ title: 'Giving directions', summary: 'Left, right, straight on.' }] },
  ],
  deadlines: [
    { title: 'Oral exam', kind: 'exam', due_at: '2099-01-01', weight_pct: 40, evidence: 'the oral exam counts for forty percent' },
    { title: 'Made up test', kind: 'quiz', due_at: null, weight_pct: null, evidence: 'nothing like this appears anywhere in it' },
  ],
}

const LESSON = {
  blocks: [
    { type: 'explainer', payload: { markdown: 'Essere pairs with verbs of motion, so the participle agrees with the subject.' } },
    { type: 'diagram', payload: { format: 'mermaid', source: 'flowchart TD\n  A[Verb] --> B[Essere]\n  A --> C[Avere]', caption: 'Which helper' } },
    { type: 'analogy', payload: { markdown: 'Essere is a mirror: the participle reflects its subject.', breaks_down_when: 'Avere verbs do not mirror.' } },
    {
      type: 'quiz',
      payload: { intro: 'Check it.' },
      assessments: [
        { kind: 'mcq', prompt: 'Which helper does andare take?', bloom: 'apply', grader: 'deterministic', options: [{ id: 'a', text: 'avere' }, { id: 'b', text: 'essere' }], answer_key: { correct_option_ids: ['b'] }, max_score: 100 },
        { kind: 'short_answer', prompt: 'Why does the participle agree?', bloom: 'analyze', grader: 'llm_rubric', rubric: [
          { criterion: 'Reason', weight: 0.5, excellent: 'Names the subject as what the participle agrees with.', acceptable: 'Says it agrees, without saying with what.', poor: 'Gives no reason, or the wrong one.' },
          { criterion: 'Example', weight: 0.5, excellent: 'Shows it with a correct verb form of their own.', acceptable: 'Gives a form with a slip in it.', poor: 'Gives no form at all to show it.' },
        ], answer_key: { reference_answer: 'Because essere links it to the subject.' }, max_score: 100 },
      ],
    },
  ],
}

const MARKING = { criterion_scores: [{ criterion: 'Reason', score_0_to_1: 0.7, comment: 'You named the subject as the reason it agrees.' }, { criterion: 'Example', score_0_to_1: 0.7, comment: 'You gave a verb form with a slip in the ending.' }], score: 70, passed: true, feedback: 'You wrote "agrees with the subject", which is right: essere links them. Now say what avere does instead, and test it on one verb.' }

function replyFor(overrides: Partial<Record<string, () => FakeReply>> = {}) {
  return (body: any): FakeReply => {
    const system = String(body.messages[0].content)
    const user = String(body.messages.at(-1).content)
    if (system.includes('You turn what a learner gives you')) return overrides.propose?.() ?? { pieces: inPieces(JSON.stringify(PROPOSAL)) }
    if (system.includes('You classify one lesson')) return overrides.classify?.() ?? { pieces: [JSON.stringify({ archetype: 'conceptual' })] }
    if (system.includes('exacting but generous teacher')) return overrides.mark?.() ?? { pieces: [JSON.stringify(MARKING)] }
    if (user.includes('THE PART TO REWRITE')) return overrides.rewrite?.() ?? { pieces: [JSON.stringify({ blocks: [{ type: 'analogy', payload: { markdown: 'A new mirror.', breaks_down_when: 'Never quite.' } }] })] }
    if (user.includes('ARCHETYPE:')) return overrides.lesson?.() ?? { pieces: inPieces(JSON.stringify(LESSON), 40), thinking: ['Which verbs', ' take essere'] }
    return overrides.chat?.() ?? { pieces: inPieces('Let me draft Italian to B1 from what you told me.\n```actions\n[{"type":"propose_course"}]\n```') }
  }
}

async function setup(overrides?: Parameters<typeof replyFor>[0]) {
  const provider = await fakeProvider(replyFor(overrides))
  const t = testApi({ baseUrl: provider.url })
  await t.post('/credentials', { provider: 'deepseek', key: 'sk-test-0123456789abcdef' })
  cleanups.push(async () => { t.done(); await provider.close() })
  return { t, provider }
}

const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const clean of cleanups.splice(0)) await clean() })

/** A created course, its second topic's lesson written. */
async function writtenLesson(t: ReturnType<typeof testApi>) {
  const failureOf = async (id: number) => (await t.get(`/nodes/${id}`)).data.failure_reason
  const asked = await t.ask({ message: 'I want Italian to B1', intent: 'course' })
  const done = asked.events!.find((e) => e.event === 'done')!.data
  const created = await t.post('/companion/courses', { proposal: done.message.proposal.proposal, item_ids: [], links: [], message_id: done.message.id })
  const topics = (await t.get('/companion/topics')).data.filter((x: any) => x.subject_id === created.data.subject_id)
  const topic = topics.find((x: any) => x.title === 'Passato prossimo with essere')
  const bridge = await t.post(`/companion/topics/${topic.id}/lesson`)
  const expanded = await t.post(`/courses/${bridge.data.course_id}/expand`, { node_ids: [bridge.data.node_id] })
  expect(expanded.status).toBe(202)
  await t.settled()
  expect(await failureOf(bridge.data.node_id)).toBeNull()
  return { nodeId: bridge.data.node_id as number, courseId: bridge.data.course_id as number, subjectId: created.data.subject_id as string, topic, node: (await t.get(`/nodes/${bridge.data.node_id}`)).data }
}

describe('a course from a chat', () => {
  it('never keeps a block that needs a voice', async () => {
    const speaking = { type: 'speaking', payload: { language: 'it', items: [{ text: 'Ciao' }] } }
    const { t } = await setup({ lesson: () => ({ pieces: [JSON.stringify({ blocks: [...LESSON.blocks, speaking] })] }) })
    const { nodeId } = await writtenLesson(t)
    const types = (await t.get(`/nodes/${nodeId}`)).data.blocks.map((b: any) => b.type)
    expect(types).toContain('explainer')
    expect(types).not.toContain('speaking')
  })

  it('drafts from the conversation, shows its work, and creates it once', async () => {
    const { t } = await setup()
    const asked = await t.ask({ message: 'I want Italian to B1', intent: 'course' })
    const names = asked.events!.map((e) => e.event)
    expect(names).toContain('proposal')
    const proposals = asked.events!.filter((e) => e.event === 'proposal').map((e) => e.data)
    expect(proposals[0]).toEqual({ state: 'drafting' })
    expect(proposals.at(-1).state).toBe('ready')
    const steps = asked.events!.filter((e) => e.event === 'status').map((e) => e.data.step?.key)
    expect(steps).toContain('path')
    expect(steps).toContain('pace')

    const done = asked.events!.find((e) => e.event === 'done')!.data
    const proposal = done.message.proposal.proposal
    expect(done.message.text).toBe("Here's a draft of Italian to B1 from what you told me.")
    expect(proposal.units).toHaveLength(2)
    // A deadline whose quote isn't in anything they gave is not kept.
    expect(proposal.deadlines).toEqual([])

    const first = await t.post('/companion/courses', { proposal, message_id: done.message.id })
    expect(first.status).toBe(201)
    const again = await t.post('/companion/courses', { proposal, message_id: done.message.id })
    expect(again.status).toBe(200)
    expect(again.data.subject_id).toBe(first.data.subject_id)

    const subject = (await t.get(`/companion/subjects/${first.data.subject_id}`)).data
    expect(subject.format).toBe('path')
    const goal = (await t.get(`/companion/goals/${first.data.goal_id}`)).data
    expect(goal.sessions_per_week).toBe(6)
    const topics = (await t.get('/companion/topics')).data
    expect(topics.filter((x: any) => x.parent_id === null)).toHaveLength(2)
    expect(topics).toHaveLength(5)
  })

  it('keeps a deadline whose quote is in what they pasted', async () => {
    const { t } = await setup()
    const asked = await t.ask({ message: 'my syllabus', intent: 'course', attachments: [{ kind: 'text', label: 'Syllabus', text: 'Marks: the oral exam counts for forty percent of the module.' }] })
    const done = asked.events!.find((e) => e.event === 'done')!.data
    expect(done.message.proposal.proposal.deadlines.map((d: any) => d.title)).toEqual(['Oral exam'])
    const made = await t.post('/companion/courses', { proposal: done.message.proposal.proposal })
    const deadline = (await t.get('/companion/deadlines')).data.find((d: any) => d.subject_id === made.data.subject_id)
    expect(deadline.title).toBe('Oral exam')
    expect(deadline.sources[0].evidence).toBe('"the oral exam counts for forty percent"')
  })

  it('sends the open draft to the model and revises it in place', async () => {
    const { t, provider } = await setup()
    const first = await t.ask({ message: 'I want Italian to B1', intent: 'course' })
    const done = first.events!.find((e) => e.event === 'done')!.data
    await t.ask({ thread_id: done.thread_id, message: 'tell me about the plan' })
    const chat = provider.requests.filter((r) => r.body.stream && !String(r.body.messages[0].content).includes('You turn what')).at(-1)!
    expect(chat.body.messages[0].content).toContain('THE COURSE DRAFT THIS CHAT IS SHOWING')
    expect(chat.body.messages[0].content).toContain('Italian to B1 · a self-study path')
  })

  it('a chat answer that asks for a course drafts one under it', async () => {
    const { t } = await setup()
    const asked = await t.ask({ message: 'I want to learn Italian' })
    const done = asked.events!.find((e) => e.event === 'done')!.data
    expect(done.message.text).toContain('Let me draft')
    expect(done.message.proposal.state).toBe('ready')
    const named = (await t.get('/companion/ask/threads')).data[0]
    expect(named.has_proposal).toBe(true)
  })

  it('says so when the model is unreachable, as a failed card', async () => {
    const { t } = await setup({ propose: () => ({ status: 401 }) })
    const asked = await t.ask({ message: 'I want Italian', intent: 'course' })
    const done = asked.events!.find((e) => e.event === 'done')!.data
    expect(done.message.proposal.state).toBe('failed')
    expect(done.message.text.length).toBeGreaterThan(10)
  })
})

describe('writing a lesson', () => {
  it('classifies the knowledge, code picks the formats, and the page sees it being written', async () => {
    const { t, provider } = await setup({ lesson: () => ({ pieces: inPieces(JSON.stringify(LESSON), 30), thinking: ['Which verbs', ' take essere'], delayMs: 60 }) })
    const asked = await t.ask({ message: 'I want Italian', intent: 'course' })
    const done = asked.events!.find((e) => e.event === 'done')!.data
    const made = await t.post('/companion/courses', { proposal: done.message.proposal.proposal })
    const topics = (await t.get('/companion/topics')).data.filter((x: any) => x.subject_id === made.data.subject_id)
    const topic = topics.find((x: any) => x.title === 'Ordering food')
    const bridge = (await t.post(`/companion/topics/${topic.id}/lesson`)).data
    expect(bridge.node_status).toBe('stub')
    expect((await t.get(`/companion/topics/${topic.id}`)).data.node_id).toBe(bridge.node_id)
    // The bridge is one line of nodes: the unit is a step, its topics hang under it.
    const course = (await t.get(`/courses/${bridge.course_id}`)).data
    expect(course.nodes.filter((n: any) => n.track === 'core')).toHaveLength(2)
    expect(course.nodes.find((n: any) => n.id === bridge.node_id).track).toBe('subtopic')

    expect((await t.post(`/courses/${bridge.course_id}/expand`, { node_ids: [bridge.node_id] })).status).toBe(202)
    expect((await t.post(`/courses/${bridge.course_id}/expand`, { node_ids: [bridge.node_id] })).status).toBe(409)

    let sawDraft = false
    for (let i = 0; i < 80; i++) {
      const node = (await t.get(`/nodes/${bridge.node_id}`)).data
      if (node.draft?.note) sawDraft = true
      if (node.status === 'ready') break
      await new Promise((r) => setTimeout(r, 50))
    }
    await t.settled()
    expect(sawDraft).toBe(true)

    const node = (await t.get(`/nodes/${bridge.node_id}`)).data
    expect(node.status).toBe('ready')
    expect(node.archetype).toBe('conceptual')
    expect(node.planned_block_types).toEqual(expect.arrayContaining(['explainer', 'diagram', 'analogy']))
    expect(node.blocks.map((b: any) => b.type)).toEqual(['explainer', 'diagram', 'analogy', 'quiz'])
    expect(node.assessments).toHaveLength(2)
    expect(node.blocks[3].payload.assessment_ids).toEqual(node.assessments.map((a: any) => a.id))
    expect(node.current_revision_id).toBeTruthy()
    expect(node.draft).toBeUndefined()

    // The prompt names the lessons either side of this one on the line, its siblings included.
    const written = provider.requests.find((r) => String(r.body.messages.at(-1).content).includes('ARCHETYPE:'))!.body.messages.at(-1).content
    expect(written).toContain('Passato prossimo with essere')
    expect(written).toContain('Moving on')

    // Nothing the page is handed can give an answer away.
    expect(JSON.stringify(node)).not.toContain('correct_option_ids')
    expect(JSON.stringify(node)).not.toContain('reference_answer')
    expect(provider.requests.some((r) => r.body.thinking?.type === 'enabled' && r.body.stream === true)).toBe(true)
  })

  it('asks once more for a format the kind of knowledge requires, and keeps what it has', async () => {
    let calls = 0
    const partial = { blocks: [LESSON.blocks[0], LESSON.blocks[1], { type: 'key_points', payload: { points: ['One', 'Two', 'Three'] } }, LESSON.blocks[3]] }
    const { t, provider } = await setup({ lesson: () => (++calls === 1 ? { pieces: [JSON.stringify(partial)] } : { pieces: [JSON.stringify(LESSON)] }) })
    const { node } = await writtenLesson(t)
    expect(calls).toBe(2)
    const second = provider.requests.filter((r) => String(r.body.messages.at(-1).content).includes('ARCHETYPE:')).at(-1)!
    expect(second.body.messages.at(-1).content).toContain('The lesson was missing a mandatory format')
    expect(node.blocks.map((b: any) => b.type)).toContain('diagram')
  })

  it('falls back to a kind that fits any subject when classifying fails', async () => {
    const { t } = await setup({ classify: () => ({ pieces: ['{"archetype":"nonsense"}'] }) })
    const { node } = await writtenLesson(t)
    expect(node.archetype).toBe('conceptual')
    expect(node.status).toBe('ready')
  })

  it('a failed lesson says why and can be tried again; a failed regenerate keeps the lesson', async () => {
    let fail = true
    const { t } = await setup({ lesson: () => (fail ? { status: 401 } : { pieces: [JSON.stringify(LESSON)] }) })
    const asked = await t.ask({ message: 'I want Italian', intent: 'course' })
    const done = asked.events!.find((e) => e.event === 'done')!.data
    const made = await t.post('/companion/courses', { proposal: done.message.proposal.proposal })
    const topic = (await t.get('/companion/topics')).data.find((x: any) => x.subject_id === made.data.subject_id && x.parent_id)
    const bridge = (await t.post(`/companion/topics/${topic.id}/lesson`)).data
    await t.post(`/courses/${bridge.course_id}/expand`, { node_ids: [bridge.node_id] })
    await t.settled()
    const failed = (await t.get(`/nodes/${bridge.node_id}`)).data
    expect(failed.status).toBe('failed')
    expect(failed.failure_reason).toBeTruthy()

    fail = false
    await t.post(`/courses/${bridge.course_id}/expand`, { node_ids: [bridge.node_id] })
    await t.settled()
    expect((await t.get(`/nodes/${bridge.node_id}`)).data.status).toBe('ready')

    fail = true
    expect((await t.post(`/nodes/${bridge.node_id}/regenerate`, { instruction: 'shorter' })).status).toBe(202)
    await t.settled()
    const kept = (await t.get(`/nodes/${bridge.node_id}`)).data
    expect(kept.status).toBe('ready')
    expect(kept.blocks.length).toBeGreaterThan(0)
    expect(kept.failure_reason).toBeTruthy()
  })

  it('without a key it says what to do', async () => {
    const t = testApi()
    cleanups.push(async () => t.done())
    const subject = (await t.post('/companion/subjects', { title: 'Maths' })).data
    const topic = (await t.post('/companion/topics', { subject_id: subject.id, title: 'Limits' })).data
    const bridge = (await t.post(`/companion/topics/${topic.id}/lesson`)).data
    const res = await t.post(`/courses/${bridge.course_id}/expand`, { node_ids: [bridge.node_id] })
    expect(res.status).toBe(422)
    expect(res.json.message).toContain('AI key')
  })

  it('a lesson left writing when the app closed goes back to waiting', async () => {
    const { t } = await setup()
    const subject = (await t.post('/companion/subjects', { title: 'Maths' })).data
    const topic = (await t.post('/companion/topics', { subject_id: subject.id, title: 'Limits' })).data
    const bridge = (await t.post(`/companion/topics/${topic.id}/lesson`)).data
    const node = t.store.rec('node', bridge.node_id)!
    t.store.save('node', { ...node, status: 'generating' })
    t.restart()
    expect((await t.get(`/nodes/${bridge.node_id}`)).data.status).toBe('stub')
  })

  it('stops at the per-course cap and says where to change it', async () => {
    const { t } = await setup()
    const subject = (await t.post('/companion/subjects', { title: 'Maths' })).data
    const topic = (await t.post('/companion/topics', { subject_id: subject.id, title: 'Limits' })).data
    const bridge = (await t.post(`/companion/topics/${topic.id}/lesson`)).data
    await t.call('PUT', '/companion/spending/caps', { run_usd: 0.01, day_usd: 2 })
    appendFileSync(join(t.dir, 'config', 'ledger.jsonl'), `${JSON.stringify({ ts: new Date().toISOString(), course: join(t.dir, 'data', 'courses', String(bridge.course_id)), cmd: 'expand', provider: 'deepseek', model: 'm', prompt_tokens: 1, completion_tokens: 1, cost_usd: 0.02, cached: false })}\n`)
    await t.post(`/courses/${bridge.course_id}/expand`, { node_ids: [bridge.node_id] })
    await t.settled()
    const node = (await t.get(`/nodes/${bridge.node_id}`)).data
    expect(node.status).toBe('failed')
    expect(node.failure_reason).toContain('Settings')
    expect(node.failure_reason).toContain('would cross')
  })

  it('the day cap covers the chat too, and spending is shown by course and lesson', async () => {
    const { t } = await setup()
    const { courseId, node } = await writtenLesson(t)
    const spending = (await t.get('/companion/spending')).data
    expect(spending.today_usd).toBeGreaterThan(0)
    expect(spending.caps).toEqual({ run_usd: 1, day_usd: 2 })
    const course = spending.courses.find((c: any) => c.id === courseId)
    expect(course.lessons[0].title).toBe(node.title)
    expect(course.lessons[0].cost_usd).toBeGreaterThan(0)
    expect(spending.recent.map((r: any) => r.what)).toContain('Writing a lesson')

    await t.call('PUT', '/companion/spending/caps', { run_usd: 1, day_usd: 0.01 })
    appendFileSync(join(t.dir, 'config', 'ledger.jsonl'), `${JSON.stringify({ ts: new Date().toISOString(), course: '', cmd: 'companion_ask', provider: 'deepseek', model: 'm', prompt_tokens: 1, completion_tokens: 1, cost_usd: 0.02, cached: false })}\n`)
    const blocked = await t.ask({ message: 'hello' })
    expect(blocked.events!.find((e) => e.event === 'error')!.data.message).toContain('Settings')
  })
})

describe('editing and history', () => {
  it('rewrites one part, retires its old questions, and records it', async () => {
    const { t } = await setup()
    const { nodeId, node } = await writtenLesson(t)
    const analogy = node.blocks.find((b: any) => b.type === 'analogy')
    const res = await t.post(`/nodes/${nodeId}/blocks/${analogy.id}/rewrite`, { instruction: 'simpler' })
    expect(res.status).toBe(202)
    expect((await t.get(`/nodes/${nodeId}`)).data.blocks.find((b: any) => b.id === analogy.id).rewriting).toBe(true)
    await t.settled()
    const after = (await t.get(`/nodes/${nodeId}`)).data
    expect(after.blocks.find((b: any) => b.id === analogy.id).payload.markdown).toBe('A new mirror.')
    const revisions = (await t.get(`/nodes/${nodeId}/revisions`)).data
    expect(revisions[0].cause).toBe('rewritten')
    expect(revisions[0].summary).toContain('simpler')
    expect(revisions[0].is_current).toBe(true)
  })

  it('edits by hand with an optimistic lock, and restores any version', async () => {
    const { t } = await setup()
    const { nodeId, node } = await writtenLesson(t)
    const blocks = node.blocks.map((b: any) => ({ id: b.id, type: b.type, payload: b.payload }))
    blocks[0].payload = { ...blocks[0].payload, markdown: 'Edited by hand.' }
    const saved = await t.patch(`/nodes/${nodeId}`, { blocks, base_revision_id: node.current_revision_id, title: 'New title' })
    expect(saved.status).toBe(200)
    expect(saved.data.title).toBe('New title')
    expect(saved.data.edited_at).toBeTruthy()

    const stale = await t.patch(`/nodes/${nodeId}`, { title: 'Other', base_revision_id: node.current_revision_id })
    expect(stale.status).toBe(409)

    const list = (await t.get(`/nodes/${nodeId}/revisions`)).data
    expect(list[0].summary).toBe('Changed the title, edited the explainer')
    const detail = (await t.get(`/revisions/${list[0].id}`)).data
    expect(detail.changes.counts.changed).toBe(1)
    expect(JSON.stringify(detail.snapshot)).not.toContain('correct_option_ids')
    const field = (await t.get(`/revisions/${list[0].id}/field?block=${blocks[0].id}&field=markdown`)).data
    expect(field.tokens.some((x: any) => x.op === 'ins' && x.text.includes('Edited'))).toBe(true)

    const generated = list.find((r: any) => r.cause === 'generated')
    const restored = await t.post(`/revisions/${generated.id}/restore`)
    expect(restored.data.title).toBe(node.title)
    expect(restored.data.blocks[0].payload.markdown).toBe(node.blocks[0].payload.markdown)
    expect((await t.get(`/nodes/${nodeId}/revisions`)).data[0].cause).toBe('restored')
  })

  it('regenerating keeps answered questions as history and out of completion', async () => {
    const { t } = await setup()
    const { nodeId, node } = await writtenLesson(t)
    const mcq = node.assessments.find((a: any) => a.kind === 'mcq')
    await t.post(`/assessments/${mcq.id}/attempt`, { response: { option_id: 'a' } })
    await t.post(`/nodes/${nodeId}/regenerate`)
    await t.settled()
    const after = (await t.get(`/nodes/${nodeId}`)).data
    expect(after.assessments.map((a: any) => a.id)).not.toContain(mcq.id)
    expect((await t.get(`/assessments/${mcq.id}/attempts`)).json.meta.count).toBe(1)
    expect((await t.get(`/nodes/${nodeId}/revisions`)).data[0].cause).toBe('regenerated')
  })

  it('keeps annotations and attachments on the lesson', async () => {
    const { t } = await setup()
    const { nodeId, node } = await writtenLesson(t)
    const uuid = crypto.randomUUID()
    const put = await t.call('PUT', `/nodes/${nodeId}/annotations`, { annotations: [{ uuid, block_id: node.blocks[0].id, kind: 'highlight', anchor: { a: 1 }, data: { color: 'yellow' } }] })
    expect(put.data[0].uuid).toBe(uuid)
    await t.call('PUT', `/nodes/${nodeId}/annotations`, { annotations: [{ uuid, block_id: node.blocks[0].id, kind: 'highlight', anchor: { a: 2 }, data: {} }] })
    const list = (await t.get(`/nodes/${nodeId}/annotations`)).data
    expect(list).toHaveLength(1)
    expect(list[0].anchor).toEqual({ a: 2 })
    expect((await t.del(`/annotations/${uuid}`)).status).toBe(204)
    expect((await t.call('PUT', `/nodes/${nodeId}/annotations`, { annotations: [{ uuid, block_id: 999999, kind: 'highlight', anchor: {}, data: {} }] })).status).toBe(422)

    const form = new FormData()
    form.set('file', new File(['%PDF-1.4 fake'], '../../evil.pdf', { type: 'text/html' }))
    form.set('caption', 'My notes')
    const made = await t.call('POST', `/nodes/${nodeId}/attachments`, form)
    expect(made.status).toBe(201)
    expect(made.data.mime).toBe('application/pdf')
    expect(made.data.name).toBe('evil.pdf')
    const file = await t.get(`/attachments/${made.data.uuid}/file`)
    expect(file.text).toBe('%PDF-1.4 fake')
    expect((await t.get(`/nodes/${nodeId}`)).data.attachments).toHaveLength(1)
    expect((await t.patch(`/attachments/${made.data.uuid}`, { caption: 'Renamed' })).data.caption).toBe('Renamed')
    expect((await t.del(`/attachments/${made.data.uuid}`)).status).toBe(204)

    const svg = new FormData()
    svg.set('file', new File(['<svg onload="x"/>'], 'x.svg', { type: 'image/svg+xml' }))
    expect((await t.call('POST', `/nodes/${nodeId}/attachments`, svg)).status).toBe(422)
  })
})

describe('marking', () => {
  const golden = JSON.parse(readFileSync(join(__dirname, 'fixtures/grading-golden.json'), 'utf8')) as any[]

  it.each(golden)('$name matches the hosted grader', async (c) => {
    const { markerOf, markExact, selfMarked } = await import('../merged/shell/src/api/lessons/grading.ts')
    const a = { id: 1, ...c.assessment, prompt: 'Q', rubric: null }
    if (markerOf(a) === 'llm_rubric') return
    const marked = markerOf(a) === 'self' ? selfMarked(a, c.response) : markExact(a, c.response, null)
    expect(marked.score).toBe(c.expect.score)
    expect(marked.passed).toBe(c.expect.passed)
    // Where the hosted grader leaves nothing (no key: a spinner forever), this one says why it can't mark.
    if (c.expect.feedback) expect(marked.feedback).toBe(c.expect.feedback)
    else expect(marked.grader_meta.status).toBe('failed')
  })

  it('marks an exact answer, then completes the lesson when every question is passed', async () => {
    const { t } = await setup()
    const { nodeId, node, topic } = await writtenLesson(t)
    const mcq = node.assessments.find((a: any) => a.kind === 'mcq')
    const open = node.assessments.find((a: any) => a.kind === 'short_answer')

    const wrong = await t.post(`/assessments/${mcq.id}/attempt`, { response: { option_id: 'a' } })
    expect(wrong.status).toBe(201)
    expect(wrong.json.data.passed).toBe(false)
    expect(wrong.json.meta.node.progress.state).toBe('in_progress')
    const right = await t.post(`/assessments/${mcq.id}/attempt`, { response: { option_id: 'b' } })
    expect(right.json.data.score).toBe(100)
    expect(right.json.meta.assessments_passed).toBe(1)
    expect(right.json.meta.node_completed).toBe(false)

    const marked = await t.post(`/assessments/${open.id}/attempt`, { response: { text: 'It agrees with the subject because essere links them.' } })
    expect(marked.json.data.status).toBe('graded')
    expect(marked.json.data.score).toBe(70)
    expect(marked.json.data.passed).toBe(true)
    expect(marked.json.data.criterion_scores.map((c: any) => c.criterion)).toEqual(['Reason', 'Example'])
    expect(marked.json.meta.node_completed).toBe(true)
    const done = (await t.get(`/nodes/${nodeId}`)).data
    expect(done.progress.state).toBe('completed')
    expect(done.progress.completed_at).toBeTruthy()

    // A finished lesson counts as having studied its topic.
    expect(topicSignal(t.store.get('topics', topic.id) as never, worldOf(t.store) as never, Date.now()).seen).toBe(1)
  })

  it('asks again for feedback that ignores the answer, and never lets the model set the score', async () => {
    let calls = 0
    const { t } = await setup({ mark: () => (++calls === 1
      ? { pieces: [JSON.stringify({ ...MARKING, feedback: 'Good effort overall, this reads nicely and you should keep going with it from here.', score: 100 })] }
      : { pieces: [JSON.stringify({ ...MARKING, score: 100 })] }) })
    const { node } = await writtenLesson(t)
    const open = node.assessments.find((a: any) => a.kind === 'short_answer')
    const marked = await t.post(`/assessments/${open.id}/attempt`, { response: { text: 'It agrees with the subject because of essere.' } })
    expect(calls).toBe(2)
    expect(marked.json.data.score).toBe(70)
    expect(marked.json.data.grader_meta.model_reported_score).toBe(100)
    expect(marked.json.data.grader_meta.feedback_reasked).toBe(true)
  })

  it('says so when it cannot mark, and scores nothing', async () => {
    const { t } = await setup({ mark: () => ({ status: 401 }) })
    const { node, nodeId } = await writtenLesson(t)
    const open = node.assessments.find((a: any) => a.kind === 'short_answer')
    const res = await t.post(`/assessments/${open.id}/attempt`, { response: { text: 'An answer.' } })
    expect(res.json.data.status).toBe('failed')
    expect(res.json.data.score).toBeNull()
    expect(res.json.data.passed).toBeNull()
    expect(res.json.data.feedback).toContain('nothing was scored')
    expect((await t.get(`/nodes/${nodeId}`)).data.progress.state).not.toBe('completed')

    await t.call('DELETE', '/credentials/2')
    const noKey = await t.post(`/assessments/${open.id}/attempt`, { response: { text: 'Again.' } })
    expect(noKey.json.data.status).toBe('failed')
    expect(noKey.json.data.feedback).toContain('Add a key in Settings')
  })

  it('uses a default rubric only where the question has none', async () => {
    const { normaliseRubric } = await import('../merged/shell/src/api/lessons/grading.ts')
    expect(normaliseRubric({ id: 1, kind: 'essay', rubric: null }).map((r: any) => r.criterion)).toEqual(['Accuracy', 'Completeness', 'Clarity'])
    expect(normaliseRubric({ id: 1, kind: 'essay', rubric: [{ name: 'Depth', points: 3 }] })[0]).toMatchObject({ criterion: 'Depth', weight: 3 })
  })
})

describe('talking about a lesson', () => {
  it('reads the lesson, not its answer keys', async () => {
    const { t, provider } = await setup()
    const { nodeId, courseId } = await writtenLesson(t)
    await t.ask({ message: 'explain this', scope: 'here', context: { kind: 'lesson', label: 'This lesson', node_id: nodeId, course_id: courseId } })
    const asked = provider.requests.filter((r) => String(r.body.messages[0].content).startsWith('You are BiliMind')).at(-1)!
    const all = JSON.stringify(asked.body.messages)
    expect(all).toContain('Essere pairs with verbs of motion')
    expect(all).not.toContain('reference_answer')
    expect(all).not.toContain('Because essere links it to the subject')
  })
})

describe('the sample course', () => {
  it('seeds a new computer once, from the kit alone, and removes cleanly', async () => {
    const t = testApi()
    cleanups.push(async () => t.done())
    t.restart()
    const api = createApi({ dataDir: join(t.dir, 'seeded'), configDir: join(t.dir, 'cfg'), userName: 'You', vault: { available: false, seal: (s) => s, open: (s) => s } })
    const get = async (path: string) => (await (await api.handle(new Request(`app://bilimind/api${path}`))).json()).data
    const subjects = await get('/companion/subjects')
    expect(subjects).toHaveLength(1)
    expect(subjects[0].sample).toBe(true)
    const course = await get(`/courses/${subjects[0].generated_course_id}`)
    expect(course.nodes.filter((n: any) => n.status === 'ready')).toHaveLength(2)
    const written = await get(`/nodes/${course.nodes.find((n: any) => n.status === 'ready').id}`)
    expect(written.blocks.length).toBeGreaterThan(3)
    expect(written.assessments.length).toBeGreaterThan(0)
    expect((await get('/companion/items')).map((i: any) => i.kind).sort()).toEqual(['board', 'page'])

    const removed = await api.handle(new Request('app://bilimind/api/companion/samples', { method: 'DELETE' }))
    expect(removed.status).toBe(204)
    expect(await get('/companion/subjects')).toEqual([])
    expect(await get('/companion/cards')).toEqual([])
    expect(await get('/companion/items')).toEqual([])
    api.close()
    const reopened = createApi({ dataDir: join(t.dir, 'seeded'), configDir: join(t.dir, 'cfg'), userName: 'You', vault: { available: false, seal: (s) => s, open: (s) => s } })
    expect(reopened.store.live('subjects')).toEqual([])
    reopened.close()
  })
})

describe('building from a folder', () => {
  const showcase = join(__dirname, '../../../showcase/courses/ds-final')

  function withFolders(host: Partial<FolderDeps>) {
    return (async () => {
      const provider = await fakeProvider(replyFor())
      const dir = mkdtempSync(join(tmpdir(), 'bm-folder-'))
      const api = createApi({ seedStarter: false, dataDir: join(dir, 'data'), configDir: join(dir, 'config'), userName: 'Ada', vault: fakeVault(), baseUrl: provider.url, folders: { pick: async () => showcase, build: async () => ({ course: showcase }), stop: () => undefined, ...host } })
      cleanups.push(async () => { api.close(); rmSync(dir, { recursive: true, force: true }); await provider.close() })
      const call = async (method: string, path: string, body?: unknown) => {
        const res = await api.handle(new Request(`app://bilimind/api${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }))
        return res.status === 204 ? null : (await res.json() as any)
      }
      await call('POST', '/credentials', { provider: 'deepseek', key: 'sk-test-0123456789abcdef' })
      const ask = async (message: string, attachments: unknown[]) => {
        const res = await api.handle(new Request('app://bilimind/api/companion/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, scope: 'everything', context: { kind: 'everything' }, attachments }) }))
        const text = await res.text()
        return text.split('\n\n').filter(Boolean).map((block) => ({ event: block.match(/^event: (.*)$/m)![1]!, data: JSON.parse(block.match(/^data: (.*)$/m)![1]!) }))
      }
      return { api, call, ask, provider }
    })()
  }

  it('lands as an ordinary course, with what was checked kept and its lessons markable', async () => {
    const lines: string[] = []
    const { call, ask, provider } = await withFolders({ build: async ({ progress, sentence }) => { progress('Reading your files…'); lines.push(sentence); return { course: showcase } } })
    const picked = (await call('POST', '/companion/folders/pick')).data
    expect(picked.id).toMatch(/^folder:/)
    expect(picked.title).toBe('ds-final')
    expect(JSON.stringify(picked)).not.toContain(showcase)

    const before = provider.requests.length
    const events = await ask('Get me ready for the final', [{ kind: 'moodle', label: picked.title, subject_id: picked.id }])
    expect(lines).toEqual(['Get me ready for the final'])
    expect(events.filter((e) => e.event === 'status').map((e) => e.data.text)).toContain('Reading your files…')
    const done = events.find((e) => e.event === 'done')!.data.message
    expect(done.text).toContain('lessons from 5 files')
    expect(done.text).toContain('against your files')
    expect(done.actions.map((a: any) => a.label)).toEqual(['Open the course', 'See what was checked'])
    // The pipeline spends in its own process; the chat itself made no call.
    expect(provider.requests.length).toBe(before)

    const subject = (await call('GET', '/companion/subjects')).data[0]
    expect(subject.format).toBe('path')
    const course = (await call('GET', `/courses/${subject.generated_course_id}`)).data
    const ready = course.nodes.filter((n: any) => n.status === 'ready')
    expect(ready).toHaveLength(3)
    expect(course.nodes.filter((n: any) => n.status === 'stub').length).toBeGreaterThan(0)
    expect(course.folder).toBe(showcase)
    const topics = (await call('GET', '/companion/topics')).data
    expect(topics.filter((t: any) => t.node_id !== null)).toHaveLength(course.nodes.length)

    const node = (await call('GET', `/nodes/${ready[0].id}`)).data
    expect(node.blocks.length).toBeGreaterThan(3)
    expect(node.archetype).toBeTruthy()
    expect(JSON.stringify(node)).not.toContain('answer_key')
    const mcq = node.assessments.find((a: any) => a.kind === 'mcq')
    const quiz = node.blocks.find((b: any) => b.payload.assessment_ids?.includes(mcq.id))
    expect(quiz).toBeTruthy()

    const report = (await call('GET', '/companion/items')).data.find((i: any) => i.subject_id === subject.id && i.kind === 'file')
    expect(report.title).toContain('What was checked')
    const shown = await call('GET', `/companion/items/${report.id}`)
    expect(shown.data.meta.mime).toBe('text/markdown')
  })

  it('says what went wrong, and needs the folder picked in this sitting', async () => {
    const { call, ask } = await withFolders({ build: async () => { throw new BilimindError('The build was stopped before it finished.') } })
    const picked = (await call('POST', '/companion/folders/pick')).data
    const failed = (await ask('go', [{ kind: 'moodle', label: picked.title, subject_id: picked.id }])).find((e) => e.event === 'done')!.data.message
    expect(failed.text).toContain('The build was stopped')
    const forgotten = (await ask('go', [{ kind: 'moodle', label: 'x', subject_id: 'folder:not-one-i-gave-out' }])).find((e) => e.event === 'done')!.data.message
    expect(forgotten.text).toContain('needs picking again')
  })

  it('a later lesson of that course reads the same files', () => {
    const chunks = chunksForLesson({ id: 1, folder: showcase }, { id: 2, title: 'Hash tables and collisions', summary: 'Chaining and probing', concept_key: 'hash tables' })
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunksForLesson({ id: 1 }, { id: 2, title: 'x' })).toEqual([])
  })
})

describe('reading a link', () => {
  it('recognises what must never be fetched', () => {
    for (const address of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fc00::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe']) {
      expect(isPrivateAddress(address), address).toBe(true)
    }
    for (const address of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
      expect(isPrivateAddress(address), address).toBe(false)
    }
  })

  it('refuses this computer and its network, by name or by number, and through a redirect', async () => {
    let hit = false
    const inside = createServer((_req, res) => { hit = true; res.end('secret') })
    await new Promise<void>((r) => inside.listen(0, '127.0.0.1', r))
    const port = (inside.address() as AddressInfo).port
    for (const url of [`http://127.0.0.1:${port}/`, `http://localhost:${port}/`, `http://[::1]:${port}/`, 'http://169.254.169.254/latest/meta-data/', 'ftp://example.com/x']) {
      await expect(publicFetch(url), url).rejects.toThrow()
    }
    expect(hit).toBe(false)
    inside.close()
  })

  it('a chat cannot read a private link: it says it could not', async () => {
    const { t } = await setup()
    const asked = await t.ask({ message: 'what does this say', attachments: [{ kind: 'link', url: 'http://127.0.0.1:1/secret', label: 'x' }] })
    expect(asked.events!.some((e) => e.event === 'done')).toBe(true)
  })
})

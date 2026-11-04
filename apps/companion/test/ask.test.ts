import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { FenceGate, partialJson } from '../merged/shell/src/api/ask/fence.ts'
import { inProgress } from '../merged/shell/src/api/ask/actions.ts'
import { calendarOf, termsOf } from '../merged/shell/src/api/ask/material.ts'
import { finishedSvg, partialSvg, sceneOf } from '../merged/shell/src/api/ask/drawing.ts'
import { fakeProvider, inPieces, type FakeReply } from './fake-provider.ts'
import { fakeVault, testApi, uuid } from './helpers.ts'

const KEY = `sk-${'a'.repeat(20)}wxyz`

let replies: FakeReply[] = []
let provider: Awaited<ReturnType<typeof fakeProvider>>
let t: ReturnType<typeof testApi>

beforeEach(async () => {
  replies = []
  provider = await fakeProvider(() => replies.shift() ?? { pieces: ['fallback answer'] })
  t = testApi({ baseUrl: provider.url })
})
afterEach(async () => {
  t.done()
  await provider.close()
})

const withKey = () => t.post('/credentials', { provider: 'deepseek', key: KEY })
const answer = (text: string) => { replies.push({ pieces: inPieces(text) }) }
const shown = (events: { event: string; data: any }[]) => events.filter((e) => e.event === 'delta').map((e) => e.data.text).join('')
const done = (events: { event: string; data: any }[]) => events.find((e) => e.event === 'done')!.data
const systemOf = (i = 0) => provider.requests[i].body.messages[0].content as string
const lastUserOf = (i = 0) => provider.requests[i].body.messages.at(-1).content as string

describe('FenceGate', () => {
  const through = (pieces: string[]) => {
    const gate = new FenceGate()
    let out = ''
    for (const p of pieces) out += gate.push(p)
    return { out: out + gate.flush(), gate }
  }

  it('holds back a fence split across pieces, and releases nothing after it', () => {
    const { out, gate } = through(['Ready.\n`', '``act', 'ions\n[{"type":', '"quiz"}]\n```'])
    expect(out).toBe('Ready.\n')
    expect(gate.fenced()).toBe('\n[{"type":"quiz"}]\n```')
  })

  it('lets an ordinary code block through whole, ticks included', () => {
    const text = 'See:\n```python\nprint(1)\n```\n'
    expect(through(inPieces(text, 2)).out).toBe(text)
  })

  it('finds the fence in any case', () => {
    expect(through(['x```ACTIONS\n[]']).out).toBe('x')
  })
})

describe('partialJson', () => {
  it('closes what is open', () => {
    expect(partialJson('[{"type":"create_page","title":"Joi')).toEqual([{ type: 'create_page', title: 'Joi' }])
    expect(partialJson('[{"a":1,"b"')).toEqual([{ a: 1 }])
    expect(partialJson('nothing yet')).toBeNull()
  })

  it('never leaves a cut escape in a string', () => {
    expect(partialJson('[{"a":"x\\')).toEqual([{ a: 'x' }])
    expect(partialJson('[{"a":"x\\u00')).toEqual([{ a: 'x' }])
    expect(partialJson('[{"a":"x\\\\')).toEqual([{ a: 'x\\' }])
  })

  it('stops at the end of the whole value: the fence after it is not JSON', () => {
    expect(partialJson('[{"a":1}]\n```')).toEqual([{ a: 1 }])
  })
})

describe('no key', () => {
  it('says how to add one, with a link to the screen, and calls nobody', async () => {
    const { events } = await t.ask({ message: 'Explain joins' })
    const message = done(events).message
    expect(message.text).toMatch(/your own AI key/)
    expect(message.actions).toEqual([{ type: 'open', to: '/app/settings?section=keys', label: 'Add your AI key' }])
    expect(provider.requests).toHaveLength(0)
  })

  it('keeps the question, so asking again with a key answers it once', async () => {
    const first = await t.ask({ message: 'Explain joins' })
    const threadId = done(first.events).thread_id
    await withKey()
    answer('A join combines rows.')
    const second = await t.ask({ message: 'Explain joins', thread_id: threadId })
    expect(done(second.events).message.text).toBe('A join combines rows.')
    const thread = (await t.get(`/companion/ask/threads/${threadId}`)).data
    expect(thread.messages.map((m: any) => m.role)).toEqual(['user', 'assistant'])
  })
})

describe('the stream', () => {
  beforeEach(withKey)

  it('sends start, deltas and done, and keeps the answer', async () => {
    answer('A join combines rows from two tables.')
    const { events } = await t.ask({ message: 'What is a join?' })
    expect(events[0]!.event).toBe('start')
    expect(events.at(-1)!.event).toBe('done')
    expect(shown(events)).toBe('A join combines rows from two tables.')
    const { thread_id: threadId, message } = done(events)
    expect(message.id).toBe(events[0]!.data.message_id)
    const list = (await t.get('/companion/ask/threads')).data
    expect(list[0]).toMatchObject({ id: threadId, title: 'What is a join?', has_proposal: false })
    expect((await t.get(`/companion/ask/threads/${threadId}`)).data.messages[1].text).toBe(message.text)
    expect(provider.requests[0].authorization).toBe(`Bearer ${KEY}`)
    expect(provider.requests[0].body.stream).toBe(true)
  })

  it('never shows the actions block, and sends the growing list as making', async () => {
    const block = JSON.stringify([{ type: 'create_cards', cards: Array.from({ length: 6 }, (_, i) => ({ front: `Q${i}`, back: `A${i}` })) }])
    replies.push({ pieces: inPieces(`Here are some cards.\n\`\`\`actions\n${block}\n\`\`\``, 12), delayMs: 40 })
    const { events } = await t.ask({ message: 'Make flashcards' })
    expect(shown(events)).toBe('Here are some cards.\n')
    const making = events.filter((e) => e.event === 'making')
    expect(making.length).toBeGreaterThan(1)
    const sizes = making.map((e) => e.data.actions[0].cards.length)
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b))
    const final = done(events).message
    expect(final.text).toBe('Here are some cards.')
    expect(final.actions[0].cards).toHaveLength(6)
  })

  it('reports a provider failure as an error event, in words, and keeps the question', async () => {
    replies.push({ status: 401 })
    const { events } = await t.ask({ message: 'Hello' })
    expect(events.at(-1)).toMatchObject({ event: 'error' })
    expect(events.at(-1)!.data.message).toMatch(/did not accept your key/)
    expect(JSON.stringify(events)).not.toContain(KEY)
    const threadId = events[0]!.data.thread_id
    expect((await t.get(`/companion/ask/threads/${threadId}`)).data.messages).toHaveLength(1)
  })

  it('stops the provider call when the reply stops being read, and stores no answer', async () => {
    replies.push({ pieces: inPieces('word '.repeat(200), 5), delayMs: 5 })
    const { events } = await t.ask({ message: 'Long one' }, (event) => event === 'delta')
    const threadId = events[0]!.data.thread_id
    await expect.poll(() => provider.dropped(), { timeout: 3000 }).toBe(1)
    expect((await t.get(`/companion/ask/threads/${threadId}`)).data.messages).toHaveLength(1)
  })

  it('refuses a bad body before opening a stream, and another thread is a 404', async () => {
    expect((await t.ask({ message: '' })).status).toBe(422)
    expect((await t.ask({ message: 'x', thread_id: uuid() })).status).toBe(404)
    expect((await t.ask({ message: 'x', attachments: [{ kind: 'file', item_id: uuid() }] })).status).toBe(422)
    expect(provider.requests).toHaveLength(0)
  })

  it('sends earlier turns as real turns, marks a press, and renames and deletes threads', async () => {
    answer('First answer.')
    const first = await t.ask({ message: 'First question' })
    const threadId = done(first.events).thread_id
    answer('Second answer.')
    await t.ask({ message: 'My attempt here', thread_id: threadId, intent: 'attempt' })
    answer('Third answer.')
    await t.ask({ message: '', thread_id: threadId, intent: 'stuck' })
    const roles = provider.requests[2].body.messages.map((m: any) => m.role)
    expect(roles).toEqual(['system', 'user', 'assistant', 'user', 'assistant', 'user'])
    expect(provider.requests[2].body.messages[3].content).toBe('(Check my attempt) My attempt here')

    const renamed = await t.patch(`/companion/ask/threads/${threadId}`, { title: 'Joins' })
    expect(renamed.data.title).toBe('Joins')
    expect((await t.patch(`/companion/ask/threads/${threadId}`, { title: '  ' })).status).toBe(422)
    expect((await t.del(`/companion/ask/threads/${threadId}`)).status).toBe(204)
    expect((await t.get(`/companion/ask/threads/${threadId}`)).status).toBe(404)
    expect((await t.get('/companion/ask/threads')).data).toEqual([])
  })
})

describe('grounding', () => {
  beforeEach(withKey)

  it('tells the model the learner’s week, with aliases, and marks graded work', async () => {
    const s = (await t.post('/companion/subjects', { id: uuid(), title: 'Databases', try_first: true })).data
    const due = new Date(Date.now() + 2 * 86_400_000).toISOString()
    await t.post('/companion/deadlines', { id: uuid(), subject_id: s.id, kind: 'assignment', title: 'Assignment 2', due_at: due, scope_note: 'Normalise the schema', weight_pct: 20 })
    await t.post('/companion/deadlines', { id: uuid(), subject_id: s.id, kind: 'quiz', title: 'Quiz 1', due_at: due })
    await t.post('/companion/plan-tasks', { id: uuid(), date: new Date().toISOString().slice(0, 10), kind: 'own', title: 'Read chapter 3', minutes: 20 })
    answer('Do the assignment first.')
    await t.ask({ message: 'What should I do tonight?' })
    const sys = systemOf()
    expect(sys).toContain('Databases {S1}')
    expect(sys).toContain('"Make me try first" is on')
    expect(sys).toMatch(/Assignment 2 \(assignment\) \{D\d\} · Databases · due .* · 20% of the grade · readiness: not checked yet|Assignment 2 \(assignment\) \{D\d\}/)
    expect(sys).toMatch(/Assignment 2[^\n]*graded work they hand in[^\n]*brief: Normalise the schema/)
    expect(sys).toMatch(/Quiz 1[^\n]*/)
    expect(sys).not.toMatch(/Quiz 1[^\n]*graded work/)
    expect(sys).toContain('Read chapter 3')
  })

  it('reads what is on screen, cites it, and deletes a marker it never showed', async () => {
    const item = (await t.post('/companion/items', { id: uuid(), kind: 'page', title: 'Joins' })).data
    answer('An inner join keeps matches [E1]. Something else [E9].')
    const { events } = await t.ask({
      message: 'What does my note say about inner joins?',
      scope: 'here',
      context: { kind: 'page', label: 'Joins', item_id: item.id, excerpt: 'An inner join keeps only the matching rows of both tables.' },
    })
    expect(lastUserOf()).toContain('[E1 · Joins]')
    const message = done(events).message
    expect(message.text).toBe('An inner join keeps matches [1]. Something else.')
    expect(message.citations).toEqual([{ kind: 'item', id: item.id, label: 'Joins', quote: 'An inner join keeps only the matching rows of both tables.', at_seconds: null, subject_id: null }])
  })

  it('turns an alias that leaked into the prose back into a name', async () => {
    await t.post('/companion/subjects', { id: uuid(), title: 'Databases' })
    answer('Your S1 midterm is close. Databases {S1} has more.')
    const { events } = await t.ask({ message: 'How is it going?' })
    expect(done(events).message.text).toBe('Your Databases midterm is close. Databases has more.')
  })

  it('finds material by its words across courses', async () => {
    const s = (await t.post('/companion/subjects', { id: uuid(), title: 'Databases' })).data
    await t.post('/companion/items', { id: uuid(), kind: 'page', title: 'Transactions', preview: 'Two-phase locking rules out phantoms.', subject_id: s.id })
    await t.post('/companion/items', { id: uuid(), kind: 'page', title: 'Cooking', preview: 'Salt the water.' })
    answer('Yes.')
    await t.ask({ message: 'What does two-phase locking rule out?', scope: 'course', context: { kind: 'course', subject_id: s.id } })
    expect(lastUserOf()).toContain('Two-phase locking rules out phantoms.')
    expect(lastUserOf()).not.toContain('Salt the water')
  })
})

describe('attachments', () => {
  beforeEach(withKey)

  const upload = async (text: string, name: string) => {
    const form = new FormData()
    form.append('file', new File([text], name))
    return (await t.call('POST', '/companion/items/upload', form)).data
  }

  it('reads a file, stays with the thread, and hides pasted text when sent back', async () => {
    const file = await upload('Week 3 covers normal forms and how to reach third normal form.', 'notes.txt')
    answer('It covers normal forms [E1].')
    const first = await t.ask({ message: 'What is in this?', attachments: [{ kind: 'file', item_id: file.id, label: 'notes.txt' }, { kind: 'text', text: 'SECRET PASTE about keys' }] })
    expect(lastUserOf()).toContain('WHAT THEY ATTACHED')
    expect(lastUserOf()).toContain('third normal form')
    expect(lastUserOf()).toContain('SECRET PASTE')
    const message = done(first.events).message
    expect(message.citations[0]).toMatchObject({ kind: 'item', id: file.id, label: 'notes.txt' })
    const threadId = done(first.events).thread_id

    answer('Still there.')
    await t.ask({ message: 'And the second normal form?', thread_id: threadId })
    expect(lastUserOf(1)).toContain('third normal form')

    const thread = (await t.get(`/companion/ask/threads/${threadId}`)).data
    expect(thread.messages[0].attachments.map((a: any) => a.label)).toEqual(['notes.txt', 'Pasted text · 4 words'])
    expect(JSON.stringify(thread)).not.toContain('SECRET PASTE')
  })

  it('names what it could not read', async () => {
    const board = (await t.post('/companion/items', { id: uuid(), kind: 'board', title: 'My board' })).data
    answer('Ok.')
    await t.ask({ message: 'Look', attachments: [{ kind: 'note', item_id: board.id, label: 'My board' }] })
    expect(lastUserOf()).toContain('COULD NOT BE READ (say so if it matters): My board')
  })

  it('reads a calendar as dated lines, a repeating event once', () => {
    const soon = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10).replace(/-/g, '')
    const out = calendarOf(`BEGIN:VCALENDAR\r\nX-WR-CALNAME:Term\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${soon}\r\nSUMMARY:Midterm\r\n exam\r\nLOCATION:Room 204\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART:20200105T090000Z\r\nRRULE:FREQ=WEEKLY\r\nSUMMARY:Lecture\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nDTSTART:20200105\r\nSUMMARY:Too old\r\nEND:VEVENT\r\nEND:VCALENDAR`)
    expect(out?.title).toBe('Term')
    expect(out?.text).toContain('Midtermexam · Room 204')
    expect(out?.text).toContain(', repeating · Lecture')
    expect(out?.text).not.toContain('Too old')
  })

  it('drops the words every question shares', () => {
    expect(termsOf('What is the difference between 2PL and strict 2PL?')).toEqual(['2pl', 'strict'])
  })
})

describe('attempt first', () => {
  beforeEach(withKey)

  const block = (json: unknown) => `\`\`\`actions\n${JSON.stringify(json)}\n\`\`\``

  it('turns the model’s attempt_first into a guard, never a card', async () => {
    const s = (await t.post('/companion/subjects', { id: uuid(), title: 'Databases' })).data
    const d = (await t.post('/companion/deadlines', { id: uuid(), subject_id: s.id, kind: 'assignment', title: 'Assignment 2', due_at: new Date(Date.now() + 86_400_000).toISOString() })).data
    answer(`This is part of Assignment 2, so have a go first.\n${block([{ type: 'attempt_first', deadline_id: 'D1', subject_id: null }])}`)
    const { events } = await t.ask({ message: 'Write my normalisation for assignment 2' })
    expect(systemOf()).toContain('GRADED WORK: THEIR ATTEMPT FIRST')
    const message = done(events).message
    expect(message.actions).toEqual([])
    expect(message.guard).toEqual({ reason: 'graded', deadline_id: d.id, subject_id: null, title: 'Assignment 2' })
  })

  it('a hand-in nobody listed is still graded work; try-first names the course or everywhere', async () => {
    answer(`Have a go.\n${block([{ type: 'attempt_first', deadline_id: null, subject_id: null }])}`)
    expect(done((await t.ask({ message: 'Write my essay' })).events).message.guard).toMatchObject({ reason: 'graded', deadline_id: null, title: 'graded work' })

    const s = (await t.post('/companion/subjects', { id: uuid(), title: 'Italian', try_first: true })).data
    answer(`What do you think?\n${block([{ type: 'attempt_first', deadline_id: null, subject_id: 'S1' }])}`)
    expect(done((await t.ask({ message: 'Translate this' })).events).message.guard).toMatchObject({ reason: 'try_first', subject_id: s.id, title: 'Italian' })

    await t.patch('/auth/profile', { preferences: { companion: { try_first: true } } })
    await t.patch(`/companion/subjects/${s.id}`, { try_first: false })
    answer(`What do you think?\n${block([{ type: 'attempt_first', deadline_id: null, subject_id: null }])}`)
    const everywhere = await t.ask({ message: 'What is 2+2?' })
    expect(done(everywhere.events).message.guard).toMatchObject({ reason: 'try_first', subject_id: null, title: 'everywhere' })
    expect(systemOf(2)).toContain('They turned on "Make me try first" for everything.')
  })

  it('the two presses keep the guard, and each is its own instruction to the model', async () => {
    answer(`Have a go.\n${block([{ type: 'attempt_first', deadline_id: null, subject_id: null }])}`)
    const first = await t.ask({ message: 'Solve problem 3' })
    const threadId = done(first.events).thread_id
    const guard = done(first.events).message.guard

    answer('Your first step holds; the second does not.')
    const attempt = await t.ask({ message: 'Here is my work', thread_id: threadId, intent: 'attempt' })
    expect(lastUserOf(1)).toContain('THEY PRESSED "Check my attempt"')
    expect(done(attempt.events).message.guard).toEqual(guard)

    answer('Start by writing the base case.')
    const stuck = await t.ask({ message: '', thread_id: threadId, intent: 'stuck' })
    expect(lastUserOf(2)).toContain(`THEY PRESSED "I'm stuck, show me"`)
    expect(done(stuck.events).message.guard).toEqual(guard)
  })
})

describe('actions', () => {
  beforeEach(withKey)

  const withBlock = async (actions: unknown[]) => {
    answer(`Here.\n\`\`\`actions\n${JSON.stringify(actions)}\n\`\`\``)
    return done((await t.ask({ message: 'Do it' })).events).message.actions
  }

  it('resolves aliases to rows, keeps two, and drops what can’t be made right', async () => {
    const s = (await t.post('/companion/subjects', { id: uuid(), title: 'Databases' })).data
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    const actions = await withBlock([
      { type: 'add_deadline', subject_id: 'S9', title: 'No such course', kind: 'quiz', due_at: `${tomorrow}T09:00` },
      { type: 'create_page', title: 'Note', markdown: '# Hi', subject_id: 'S9' },
      { type: 'add_tasks', date: tomorrow, tasks: [{ title: 'Read', minutes: 900, subject_id: 'S1' }] },
      { type: 'quiz', questions: [{ q: 'Q', a: 'A' }] },
    ])
    expect(actions).toHaveLength(2)
    expect(actions[0]).toEqual({ type: 'create_page', title: 'Note', markdown: '# Hi', subject_id: null })
    expect(actions[1]).toEqual({ type: 'add_tasks', date: tomorrow, tasks: [{ title: 'Read', minutes: 240, subject_id: s.id }] })
  })

  it('never opens a place outside the app, and offers draft_course only with something attached', async () => {
    const actions = await withBlock([
      { type: 'open', to: 'https://evil.example', label: 'Go' },
      { type: 'open', to: '/app/settings', label: 'Go' },
      { type: 'draft_course', label: 'Make a course' },
      { type: 'open', to: '/app/calendar', label: 'See it' },
    ])
    expect(actions).toEqual([{ type: 'open', to: '/app/calendar', label: 'See it' }])
  })

  it('a block with no fence name, wrapped or bare, is still an offer', async () => {
    answer('Here.\n```json\n[{"type":"open","to":"/app/notes","label":"Notes"}]\n```')
    expect(done((await t.ask({ message: 'Go' })).events).message.actions).toHaveLength(1)
    answer('Here.\n```actions\n{"actions":[{"type":"open","to":"/app","label":"Today"}]}\n```')
    expect(done((await t.ask({ message: 'Go' })).events).message.actions).toEqual([{ type: 'open', to: '/app', label: 'Today' }])
  })

  it('shows a half-written block without a quiz’s answers or any ids', () => {
    expect(inProgress('[{"type":"quiz","questions":[{"q":"Q1","a":"secret"},{"q":"Q2"')).toEqual([{ type: 'quiz', questions: [{ q: 'Q1', a: '' }, { q: 'Q2', a: '' }] }])
    expect(inProgress('[{"type":"create_page","title":"N","markdown":"# H","subject_id":"S1"')).toEqual([{ type: 'create_page', title: 'N', markdown: '# H' }])
    expect(inProgress('[{"type":"propose_course"},{"type":"attempt_first"}]')).toEqual([])
  })
})

describe('live graphics', () => {
  beforeEach(withKey)

  const draw = (mode: string) => `Here it is.\n\`\`\`actions\n${JSON.stringify([{ type: 'draw', title: 'A join', mode, caption: 'Two tables', brief: 'Two tables meeting on a key' }])}\n\`\`\``

  it('draws under the words, thinking off, growing as it comes', async () => {
    answer(draw('2d'))
    const svg = '<svg viewBox="0 0 800 500"><rect width="10" height="10"/><circle r="5"/></svg>'
    replies.push({ pieces: ['Sure:\n```svg\n', ...inPieces(svg, 12)], delayMs: 60 })
    const { events } = await t.ask({ message: 'Show me a join' })
    expect(provider.requests[1].body.thinking).toEqual({ type: 'disabled' })
    expect(provider.requests[1].body.messages[1].content).toBe('Two tables meeting on a key')
    expect(events.some((e) => e.event === 'status' && e.data.text === 'Drawing it…')).toBe(true)
    const partial = events.filter((e) => e.event === 'making')
    expect(partial.length).toBeGreaterThan(0)
    expect(partial[0]!.data.actions[0].graphic.svg.startsWith('<svg')).toBe(true)
    expect(done(events).message.actions[0].graphic).toEqual({ mode: '2d', svg })
  })

  it('3D when they said so, whatever the model chose', async () => {
    answer(draw('2d'))
    replies.push({ pieces: inPieces(JSON.stringify({ caption: 'A cube', parts: [{ shape: 'box', at: [0, 1, 0], size: [2, 2, 2], color: 'cobalt' }, { shape: 'nonsense', at: [0, 0, 0] }] })) })
    const { events } = await t.ask({ message: 'Show me a join in 3D' })
    expect(done(events).message.actions[0].graphic).toEqual({ mode: '3d', caption: 'A cube', parts: [{ shape: 'box', at: [0, 1, 0], color: 'cobalt', size: [2, 2, 2] }] })
  })

  it('a drawing that fails costs the picture and a sentence, never the answer', async () => {
    answer(draw('2d'))
    replies.push({ pieces: ['<svg onload="alert(1)"></svg>'] })
    const message = done((await t.ask({ message: 'Show me' })).events).message
    expect(message.text).toBe("Here it is.\n\nThat drawing didn't come out. Ask me again and I'll have another go.")
    expect(message.actions).toEqual([])
  })

  it('refuses anything that could run or load', () => {
    for (const bad of ['<svg><script>x</script></svg>', '<svg><a href="x"/></svg>', '<svg><image src="x"/></svg>', '<svg><foreignObject/></svg>', '<svg style="fill:url(https://x)"></svg>']) {
      expect(finishedSvg(bad)).toBeNull()
    }
    expect(partialSvg('<svg><rect/><cir')).toEqual({ mode: '2d', svg: '<svg><rect/>' })
    expect(sceneOf('{"parts":[{"shape":"box","at":[0,0,0],"size":[1,1,1]},{"shape":"box"')).toEqual({ mode: '3d', caption: '', parts: [{ shape: 'box', at: [0, 0, 0], color: 'grey', size: [1, 1, 1] }] })
  })
})

describe('keys', () => {
  const file = () => join(t.dir, 'data', 'keys.json')

  it('seals the secret, keeps the file to this user, and only ever shows the last four', async () => {
    expect((await t.post('/credentials', { provider: 'deepseek', key: 'nope' })).status).toBe(422)
    const made = await t.post('/credentials', { provider: 'deepseek', key: KEY })
    expect(made.status).toBe(201)
    expect(made.data).toMatchObject({ id: 2, provider: 'deepseek', last_four: 'wxyz', active: true })
    expect(JSON.stringify((await t.get('/credentials')).data)).not.toContain(KEY)
    const raw = readFileSync(file(), 'utf8')
    expect(raw).not.toContain(KEY)
    expect(raw).toContain('sealed:')
    if (process.platform !== 'win32') expect(statSync(file()).mode & 0o777).toBe(0o600) // Windows has no POSIX modes
    expect((await t.get('/credentials/storage')).data).toEqual({ encrypted: true, shared_file_has_key: false })
    expect((await t.del(`/credentials/${made.data.id}`)).status).toBe(204)
    expect((await t.get('/credentials')).data).toEqual([])
  })

  it('switches the key in use', async () => {
    const a = (await t.post('/credentials', { provider: 'deepseek', key: KEY })).data
    const other = `sk-${'b'.repeat(20)}1234`
    await t.post('/credentials', { provider: 'openrouter', key: other })
    expect((await t.get('/credentials')).data.map((c: any) => [c.provider, c.active])).toEqual([['openrouter', true], ['deepseek', false]])
    await t.post(`/credentials/${a.id}/activate`)
    answer('ok')
    await t.ask({ message: 'Hi' })
    expect(provider.requests[0].authorization).toBe(`Bearer ${KEY}`)
    expect(provider.requests[0].body.model).toBe('deepseek-flash')
  })

  it('with no keychain: says so, stays usable, and seals it the moment there is one', async () => {
    const plain = testApi({ baseUrl: provider.url, vault: fakeVault(false) })
    await plain.post('/credentials', { provider: 'deepseek', key: KEY })
    expect((await plain.get('/credentials/storage')).data.encrypted).toBe(false)
    const path = join(plain.dir, 'data', 'keys.json')
    expect(readFileSync(path, 'utf8')).toContain(KEY)
    if (process.platform !== 'win32') expect(statSync(path).mode & 0o777).toBe(0o600) // Windows has no POSIX modes
    answer('ok')
    expect(done((await plain.ask({ message: 'Hi' })).events).message.text).toBe('ok')
    plain.restart(fakeVault(true))
    expect((await plain.get('/credentials')).data[0].last_four).toBe('wxyz')
    expect(readFileSync(path, 'utf8')).not.toContain(KEY)
    answer('still ok')
    expect(done((await plain.ask({ message: 'Hi again' })).events).message.text).toBe('still ok')
    expect(provider.requests.at(-1).authorization).toBe(`Bearer ${KEY}`)
    plain.done()
  })

  it('a key the keychain can no longer open asks for it again, without calling anyone', async () => {
    await t.post('/credentials', { provider: 'deepseek', key: KEY })
    writeFileSync(file(), readFileSync(file(), 'utf8').replace(/sealed:[^"]+/, 'corrupted'))
    const message = done((await t.ask({ message: 'Hi' })).events).message
    expect(message.text).toMatch(/couldn't be unlocked/)
    expect(message.actions[0].to).toBe('/app/settings?section=keys')
    expect(provider.requests).toHaveLength(0)
  })

  it('copies a key from the file the CLI shares once, sealed, and leaves that file alone', async () => {
    const seeded = testApi({ baseUrl: provider.url })
    mkdirSync(join(seeded.dir, 'config'), { recursive: true })
    const shared = JSON.stringify({ provider: 'deepseek', keys: { deepseek: KEY } })
    writeFileSync(join(seeded.dir, 'config', 'config.json'), shared)
    expect((await seeded.get('/credentials')).data[0]).toMatchObject({ provider: 'deepseek', last_four: 'wxyz', active: true })
    expect(readFileSync(join(seeded.dir, 'data', 'keys.json'), 'utf8')).not.toContain(KEY)
    expect(readFileSync(join(seeded.dir, 'config', 'config.json'), 'utf8')).toBe(shared)
    expect((await seeded.get('/credentials/storage')).data.shared_file_has_key).toBe(true)
    seeded.done()
  })
})

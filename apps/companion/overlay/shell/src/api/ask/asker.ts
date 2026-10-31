// `POST /companion/ask`: one question in, one answer out, both kept. Two steps, because the stream needs the ids before
// the answer exists: begin() writes the question and mints the answer's id; answer() grounds, calls the model with
// the thread's recent turns, lets the prose through FenceGate as it streams, finishes it and writes it.
//
// Nothing the learner didn't press is created here. Actions are offers on the stored message. Attachments are stored
// on the question and read for every answer in the thread after it, so "what does slide 4 say?" two turns after
// attaching the deck still has the deck.
import { BilimindError, type Ctx, type EngineConfig } from '@bilimind/engine/contracts'
import { checkBudget } from '@bilimind/engine/ledger'
import { estimateCost, streamChat, type Msg } from '@bilimind/engine/llm'
import { Invalid, UUID } from '../rules.ts'
import { wireTime, type Raw, type Row, type Store } from '../store.ts'
import { inProgress } from './actions.ts'
import { finishedSvg, partialSvg, SCENE_PROMPT, sceneOf, SVG_PROMPT } from './drawing.ts'
import { FenceGate } from './fence.ts'
import { finishAnswer } from './finish.ts'
import { buildGrounding, EXCERPT_CHARS, type AskInput, type Reader } from './grounding.ts'
import { shortUrl } from './material.ts'
import { systemPrompt, userPrompt } from './prompt.ts'
import { courseSummary, DOWN, draftSentence, propose } from './propose.ts'

const HISTORY = 12
const TURN_CHARS = 3000
const MAX_ATTACHED = 12
const MAX_ITEMS = 12
const MAX_LINKS = 8
const MAX_TEXT = 100_000
const TITLE_CHARS = 60
export const TITLE_MAX = 120
const MAKING_EVERY_MS = 250
const KINDS = ['file', 'note', 'link', 'calendar', 'text', 'moodle']
const CONTEXT_KINDS = ['everything', 'today', 'course', 'lesson', 'page', 'board', 'deadline', 'notes']

export const NO_KEY = "BiliMind answers with your own AI key, and you haven't added one yet. Add a DeepSeek or OpenRouter key in Settings and ask again. It stays on this computer, and everything that doesn't need AI keeps working without one."
const KEY_UNREADABLE = "Your AI key couldn't be unlocked on this computer. Add it again in Settings."

export interface Sink {
  status(text: string): void
  delta(text: string): void
  making(actions: Record<string, unknown>[]): void
  /** The course card as it changes. */
  proposal(state: Record<string, unknown>): void
  step(key: string, label: string, state: string): void
}

export type KeyState = { state: 'ok'; config: EngineConfig } | { state: 'none' } | { state: 'unreadable' }

export interface Turn {
  thread: Row
  question: Row
  seq: number
  answerId: string
  input: AskInput
}

function titleFor(question: string): string {
  const flat = question.replace(/\s+/gu, ' ').trim()
  if (flat.length <= TITLE_CHARS) return flat || 'New question'
  const cut = flat.slice(0, TITLE_CHARS - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > 30 ? cut.slice(0, space) : cut).replace(/[ ,;:.-]+$/, '')}…`
}

const shortText = (text: string) => {
  const flat = text.replace(/\s+/gu, ' ').trim()
  return flat.length > 60 ? `${flat.slice(0, 59).trimEnd()}…` : flat
}
const short = (v: unknown, max: number) => (typeof v === 'string' && v.replace(/\s+/gu, ' ').trim() ? v.replace(/\s+/gu, ' ').trim().slice(0, max) : null)
const optional = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** The body, checked before anything is written: a bad one is a 422 while there is still a status to send. */
export function readInput(store: Store, body: Record<string, any>): AskInput {
  const fail = (field: string, why: string): never => { throw new Invalid({ [field]: [why] }) }
  const message = body.message === undefined || body.message === null ? '' : body.message
  if (typeof message !== 'string' || message.length > 8000) fail('message', "That question couldn't be sent. Try saying it another way.")
  const intent = ['course', 'attempt', 'stuck'].includes(body.intent) ? body.intent : null
  const raw = Array.isArray(body.attachments) ? body.attachments : []

  const attachments: Record<string, any>[] = []
  const seen = new Set<string>()
  const count = (kinds: string[]) => raw.filter((a: any) => kinds.includes(a?.kind)).length
  if (count(['file', 'note']) > MAX_ITEMS) fail('attachments', `Attach at most ${MAX_ITEMS} files and notes at once.`)
  if (count(['link', 'calendar']) > MAX_LINKS) fail('attachments', `Attach at most ${MAX_LINKS} links at once.`)
  if (raw.reduce((n: number, a: any) => n + String(a?.text ?? '').length, 0) > MAX_TEXT) fail('attachments', `Pasted text is limited to ${MAX_TEXT.toLocaleString('en-GB')} characters in one message.`)
  raw.forEach((a: any, i: number) => {
    if (!a || !KINDS.includes(a.kind)) fail(`attachments.${i}.kind`, 'That attachment is not one BiliMind can read.')
    const label = short(a.label, 300)
    let row: Record<string, any> | null = null
    if (a.kind === 'file' || a.kind === 'note') {
      const item = typeof a.item_id === 'string' && UUID.test(a.item_id) ? store.get('items', a.item_id) : null
      if (!item) fail(`attachments.${i}.item_id`, 'That note or file is no longer here.')
      row = { kind: a.kind, label: label ?? (item!.title || 'Untitled'), item_id: item!.id, ...(short(a.mime, 200) ?? item!.meta?.mime ? { mime: short(a.mime, 200) ?? item!.meta.mime } : {}) }
    } else if (a.kind === 'link' || a.kind === 'calendar') {
      const url = typeof a.url === 'string' ? a.url.trim() : ''
      if (url.length > 2000 || !/^(https?|webcals?):\/\/\S+$/i.test(url)) fail(`attachments.${i}.url`, 'That link is not one BiliMind can read.')
      row = { kind: a.kind, label: label ?? shortUrl(url), url }
    } else if (a.kind === 'text') {
      const text = typeof a.text === 'string' ? a.text.trim() : ''
      if (text) row = { kind: 'text', label: label ?? `Pasted text · ${text.split(/\s+/u).length.toLocaleString('en-GB')} words`, text }
    } else {
      // No Moodle here: named, so the answer can say it couldn't read it.
      row = { kind: 'moodle', label: label ?? 'Moodle course', subject_id: optional(a.subject_id) }
    }
    if (!row) return
    const key = row.item_id ? `item:${row.item_id}` : row.url ? `url:${row.url}` : row.subject_id ? `subject:${row.subject_id}` : `text:${row.text}`
    if (seen.has(key)) return
    seen.add(key)
    attachments.push(row)
  })

  // "I'm stuck, show me" is a press: it may come without words.
  if (!message.trim() && !attachments.length && intent !== 'course' && intent !== 'stuck') fail('message', 'Ask something first.')
  if (typeof body.quote === 'string' && body.quote.length > 8000) fail('quote', 'That passage is too long to ask about.')

  const context = body.context && typeof body.context === 'object' ? body.context : {}
  const excerpt = optional(context.excerpt)
  return {
    message: message.trim(),
    threadId: optional(body.thread_id),
    quote: optional(body.quote),
    scope: ['here', 'course', 'everything'].includes(body.scope) ? body.scope : 'here',
    kind: CONTEXT_KINDS.includes(context.kind) ? context.kind : 'everything',
    label: short(context.label, 300),
    subjectId: optional(context.subject_id),
    itemId: optional(context.item_id),
    topicId: optional(context.topic_id),
    nodeId: Number.isInteger(context.node_id) ? context.node_id : null,
    courseId: Number.isInteger(context.course_id) ? context.course_id : null,
    deadlineId: optional(context.deadline_id),
    excerpt: excerpt ? excerpt.slice(0, EXCERPT_CHARS) : null,
    attachments,
    intent,
  }
}

export function createAsker(store: Store, reader: Reader, deps: { key: () => KeyState; zone: () => string; tryFirstEverywhere: () => boolean; fallbackFetch?: typeof fetch; draftLedger: () => string }) {
  const db = store.db
  const insertMessage = db.prepare('INSERT INTO messages (id, thread_id, role, body) VALUES (?, ?, ?, ?)')
  const putThread = db.prepare(`INSERT INTO threads (id, body, updated_ms, deleted) VALUES (?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET body = excluded.body, updated_ms = excluded.updated_ms, deleted = excluded.deleted`)

  function saveThread(thread: Row, touch = true): Row {
    const now = Date.now()
    const row = touch ? { ...thread, updated_at: wireTime(now) } : thread
    putThread.run(row.id, JSON.stringify(row), touch ? now : Date.parse(row.updated_at), row.deleted_at ? 1 : 0)
    return row
  }

  function threadOf(id: string): Row | null {
    const row = db.prepare('SELECT body FROM threads WHERE id = ? AND deleted = 0').get(id) as { body: string } | undefined
    return row ? JSON.parse(row.body) as Row : null
  }

  const messagesOf = (threadId: string) => (db.prepare('SELECT seq, body FROM messages WHERE thread_id = ? ORDER BY seq').all(threadId) as { seq: number; body: string }[])
    .map((m) => ({ seq: m.seq, row: JSON.parse(m.body) as Row }))

  /** What a stored message sends back: everything but pasted text, which the chip's label already names. */
  function messageWire(m: Row): Row {
    const { context: _context, ...rest } = m
    return { ...rest, attachments: (m.attachments ?? []).map(({ text: _text, ...a }: Row) => a) }
  }

  function threadWire(t: Row, messages?: Row[]): Row {
    const hasProposal = (messages ?? messagesOf(t.id).map((m) => m.row)).some((m) => m.proposal?.state === 'ready')
    return {
      id: t.id,
      title: t.title,
      subject_id: t.subject_id,
      updated_at: t.updated_at,
      has_proposal: hasProposal,
      ...(messages ? { messages: messages.map(messageWire) } : {}),
    }
  }

  /** The thread (the caller's, or a new one) and the question. A question asked again after a failed answer is the same question, not a second copy. */
  function begin(input: AskInput, existing: Row | null): Turn {
    const thread = existing ?? saveThread({
      id: crypto.randomUUID(),
      title: titleFor(input.message || String(input.attachments[0]?.label ?? (input.intent === 'course' ? 'New course' : ''))),
      subject_id: input.subjectId && UUID.test(input.subjectId) && store.get('subjects', input.subjectId) ? input.subjectId : null,
      created_at: wireTime(Date.now()),
      deleted_at: null,
    })
    const last = messagesOf(thread.id).at(-1)
    const same = last?.row.role === 'user' && last.row.text === input.message && (last.row.quote ?? null) === input.quote
      && JSON.stringify(last.row.attachments ?? []) === JSON.stringify(input.attachments)
    let question = same ? last!.row : null
    let seq = same ? last!.seq : 0
    if (!question) {
      question = {
        id: crypto.randomUUID(),
        role: 'user',
        text: input.message,
        quote: input.quote,
        attachments: input.attachments,
        citations: [],
        actions: [],
        proposal: null,
        guard: null,
        context: { scope: input.scope, kind: input.kind, intent: input.intent },
        created_at: wireTime(Date.now()),
      }
      seq = Number(insertMessage.run(question.id, thread.id, 'user', JSON.stringify(question)).lastInsertRowid)
    }
    return { thread: saveThread(thread), question, seq, answerId: crypto.randomUUID(), input }
  }

  /** Write the answer under the id `start` announced. */
  function keep(turn: Turn, fields: Record<string, unknown>): Row {
    const answer = {
      id: turn.answerId,
      role: 'assistant',
      quote: null,
      attachments: [],
      citations: [],
      actions: [],
      proposal: null,
      guard: null,
      ...fields,
      created_at: wireTime(Date.now()),
    } as Row
    // A thread whose first answer is a ready draft is named after the course.
    const title = answer.proposal?.state === 'ready' && turn.seq === messagesOf(turn.thread.id)[0]?.seq ? String(answer.proposal.proposal?.title ?? '').trim() : ''
    store.tx(() => {
      insertMessage.run(answer.id, turn.thread.id, 'assistant', JSON.stringify(answer))
      saveThread(title ? { ...turn.thread, title: title.slice(0, TITLE_MAX) } : turn.thread)
    })
    return answer
  }

  /** The guard of the thread's latest answer: the one they pressed "Check my attempt" or "I'm stuck" on. */
  function previousGuard(turn: Turn): Row | null {
    return messagesOf(turn.thread.id).filter((m) => m.row.role === 'assistant').at(-1)?.row.guard ?? null
  }

  /** The turns before this question, as the model's own turns: roles alternate, an unanswered question is superseded, the first is the learner's. */
  function history(turn: Turn): Msg[] {
    const earlier = messagesOf(turn.thread.id).filter((m) => m.seq < turn.seq).slice(-HISTORY)
    const turns: { role: 'user' | 'assistant'; content: string }[] = []
    for (const { row } of earlier) {
      const role: 'user' | 'assistant' = row.role === 'assistant' ? 'assistant' : 'user'
      let content = String(row.text ?? '')
      if (role === 'user') {
        // A press reads as one: the model sees which turns were their own work.
        const press = { attempt: '(Check my attempt) ', stuck: "(I'm stuck, show me) " }[row.context?.intent as string] ?? ''
        content = `${press}${content}`.trim()
        if (row.quote) content = `About this passage: "${String(row.quote).slice(0, 600)}"\n\n${content}`
        if (row.attachments?.length) content = `${content}\n\n(Attached: ${row.attachments.map((a: Row) => a.label ?? '').join(', ')})`.trim()
      }
      // What was drafted, by name: the draft is the card's, not prose.
      if (role === 'assistant' && row.proposal?.state === 'ready' && row.proposal.proposal) {
        content += `\n\n(Drafted a course, shown as a card${row.proposal.created ? ' and created' : ''}: ${courseSummary(row.proposal.proposal)})`
      }
      content = content.slice(0, TURN_CHARS)
      if (turns.at(-1)?.role === role) turns[turns.length - 1] = { role, content }
      else turns.push({ role, content })
    }
    while (turns[0] && turns[0].role !== 'user') turns.shift()
    if (turns.at(-1)?.role === 'user') turns.pop()
    return turns
  }

  /** Every attachment in the thread once, the latest message's first, as many as an answer reads. */
  function attachedInThread(turn: Turn): Record<string, any>[] {
    const out: Record<string, any>[] = []
    const seen = new Set<string>()
    for (const { row } of messagesOf(turn.thread.id).reverse()) {
      if (row.role !== 'user') continue
      for (const a of row.attachments ?? []) {
        const key = a.item_id ?? a.url ?? a.subject_id ?? a.text
        if (seen.has(key)) continue
        seen.add(key)
        out.push(a)
      }
    }
    return out.slice(0, MAX_ATTACHED)
  }

  /**
   * Draw what the answer asked to show, in the stream they are already reading. The words are already theirs, so a
   * picture that fails costs the picture and a sentence, never the answer.
   */
  async function drawn(done: ReturnType<typeof finishAnswer>, turn: Turn, config: EngineConfig, sink: Sink, signal: AbortSignal) {
    const at = done.actions.findIndex((a) => a.type === 'draw')
    if (at < 0) return done
    const action: Record<string, any> = { ...done.actions[at] }
    // They said 3D; that isn't the model's to overrule.
    if (/\b3\s?-?d\b|three[\s-]?dimension/i.test(turn.input.message)) action.mode = '3d'
    const others = done.actions.filter((a) => a.type !== 'draw')
    const scene = action.mode === '3d'
    sink.status('Drawing it…')
    let raw = ''
    let sentAt = 0
    let graphic: Record<string, unknown> | null = null
    try {
      const out = await streamChat(config, {
        stage: 'companion_draw',
        messages: [{ role: 'system', content: scene ? SCENE_PROMPT : SVG_PROMPT }, { role: 'user', content: action.brief }],
        temperature: 0.4,
        maxTokens: 6000,
        fast: true,
        signal,
        fallbackFetch: deps.fallbackFetch,
        onDelta(piece) {
          raw += piece
          if (Date.now() - sentAt < MAKING_EVERY_MS) return
          sentAt = Date.now()
          const partial = scene ? sceneOf(raw) : partialSvg(raw)
          if (partial) sink.making([{ ...action, graphic: partial }])
        },
      })
      graphic = scene ? sceneOf(out.text) : finishedSvg(out.text)
    } catch (error) {
      if (signal.aborted) throw error
    }
    if (!graphic) return { ...done, text: `${done.text}\n\nThat drawing didn't come out. Ask me again and I'll have another go.`.trim(), actions: others }
    return { ...done, actions: [{ ...action, graphic }, ...others] }
  }

  /** The newest ready draft in the thread that hasn't become a course. */
  function openDraft(threadId: string): Row | null {
    return messagesOf(threadId).map((m) => m.row).filter((m) => m.role === 'assistant' && m.proposal?.state === 'ready' && !m.proposal.created).at(-1) ?? null
  }

  /** The whole chat and every attachment become the draft. A failed draft is still an answer, never an error event. */
  async function draftCourse(turn: Turn, revise: boolean, change: string | null, sink: Sink, signal: AbortSignal): Promise<{ text: string; proposal: Raw }> {
    const current = revise ? openDraft(turn.thread.id) : null
    const replaces = current ? { replaces: current.id } : {}
    sink.proposal({ state: 'drafting', ...replaces })
    const messages = messagesOf(turn.thread.id).map((m) => m.row)
    const said = [...new Set(messages.filter((m) => m.role === 'user').map((m) => String(m.text ?? '').trim()).filter(Boolean))]
    const itemIds: string[] = []
    const links: string[] = []
    const pasted: string[] = []
    const extra: Raw[] = []
    let texts = 0
    for (const a of attachedInThread(turn)) {
      const label = String(a.label ?? '')
      if (a.kind === 'file' || a.kind === 'note') itemIds.push(a.item_id)
      else if (a.kind === 'link' || a.kind === 'calendar') links.push(a.url)
      else if (a.kind === 'text') {
        const stepKey = `source:text-${++texts}`
        sink.step(stepKey, `Reading ${label}`, 'active')
        pasted.push(`--- Pasted text: ${label} ---\n${a.text}`)
        extra.push({ label, kind: 'text', item_id: null, read: true })
        sink.step(stepKey, `Read ${label}`, 'done')
      } else {
        // No Moodle here: named, so the card says it wasn't read.
        extra.push({ label: `${label} (Moodle)`, kind: 'text', item_id: null, read: false })
      }
    }
    const text = [...said, ...pasted].join('\n\n')
    const failed = (error: string) => {
      const wire = { state: 'failed', error }
      sink.proposal(wire)
      return { text: error, proposal: wire }
    }
    try {
      const proposal = await propose({ store, reader, key: deps.key, zone: deps.zone, fallbackFetch: deps.fallbackFetch, ledgerCourse: deps.draftLedger }, {
        text,
        links,
        itemIds,
        draft: current?.proposal?.proposal ?? null,
        change,
        step: (k, label, state) => { if (!signal.aborted) sink.step(k, label, state) },
        partial: (p) => { if (!signal.aborted) sink.proposal({ state: 'drafting', partial: p, ...replaces }) },
      })
      // Pasted text was read inside `text`; listed on its own, so the card's sources name it. The proposer's own text source goes.
      const given = (proposal.sources as Raw[]).filter((s) => s.kind !== 'text')
      const words = said.length ? [{ label: shortText(said.join(' ')), kind: 'text', item_id: null, read: true }] : []
      const wire = { state: 'ready', proposal: { ...proposal, sources: [...given, ...extra, ...words] }, ...replaces }
      sink.proposal(wire)
      return { text: draftSentence(String(proposal.title), [...given, ...extra], current !== null), proposal: wire }
    } catch (error) {
      if (error instanceof Invalid) return failed(Object.values(error.errors).flat()[0] ?? DOWN)
      if (error instanceof BilimindError) return failed(/\bcap\b|would cross/i.test(error.message) ? `${error.message} You can change the limit in Settings, under Spending.` : error.message)
      console.error('draft', error)
      return failed(DOWN)
    }
  }

  async function answer(turn: Turn, sink: Sink, signal: AbortSignal): Promise<Row> {
    const key = deps.key()
    if (key.state !== 'ok') {
      // Not stored: the question stays unanswered, so asking again once there is a key answers it.
      return {
        id: turn.answerId,
        role: 'assistant',
        text: key.state === 'none' ? NO_KEY : KEY_UNREADABLE,
        quote: null,
        attachments: [],
        citations: [],
        actions: [{ type: 'open', to: '/app/settings?section=keys', label: 'Add your AI key' }],
        proposal: null,
        guard: null,
        created_at: wireTime(Date.now()),
      }
    }

    if (turn.input.intent === 'course') {
      const draft = await draftCourse(turn, false, null, sink, signal)
      return keep(turn, { text: draft.text, proposal: draft.proposal, context: { scope: turn.input.scope, intent: 'course' } })
    }

    const grounding = await buildGrounding(store, reader, turn.input, (t) => sink.status(t), attachedInThread(turn), deps.zone(), deps.tryFirstEverywhere())
    const open = openDraft(turn.thread.id)
    const messages: Msg[] = [
      { role: 'system', content: systemPrompt(grounding, open?.proposal?.proposal ? courseSummary(open.proposal.proposal) : null) },
      ...history(turn),
      { role: 'user', content: userPrompt(grounding, turn.input.message, turn.input.quote, turn.input.intent, turn.input.attachments.map((a) => String(a.label ?? '').trim()).filter(Boolean)) },
    ]

    await guardChat(key.config, messages)

    const gate = new FenceGate()
    let madeAt = 0
    const reply = await streamChat(key.config, {
      stage: 'companion_ask',
      messages,
      temperature: 0.5,
      maxTokens: 8192,
      signal,
      fallbackFetch: deps.fallbackFetch,
      onDelta(piece) {
        const shown = gate.push(piece)
        if (shown) sink.delta(shown)
        // A note can be most of the answer and it all sits inside the block, so it is shown as it comes.
        const block = gate.fenced()
        if (block !== null && Date.now() - madeAt >= MAKING_EVERY_MS) {
          madeAt = Date.now()
          const making = inProgress(block)
          if (making.length) sink.making(making)
        }
      },
    })
    const tail = gate.flush()
    if (tail) sink.delta(tail)

    let done = finishAnswer(store, reply.text, grounding)
    done = await drawn(done, turn, key.config, sink, signal)

    if (!done.draft && !done.text && !done.actions.length) throw new BilimindError("That answer came back empty. Try again.")

    const guard = turn.input.intent === 'stuck' ? previousGuard(turn) ?? done.guard
      : turn.input.intent === 'attempt' ? done.guard ?? previousGuard(turn)
        : done.guard
    const draft = done.draft ? await draftCourse(turn, done.draft.revise, done.draft.change, sink, signal) : null
    return keep(turn, {
      text: done.text || (draft?.text ?? ''),
      citations: done.citations,
      actions: done.actions,
      proposal: draft?.proposal ?? null,
      guard,
      context: { scope: turn.input.scope, excerpts: grounding.excerpts.length, attached: grounding.attached },
    })
  }

  /** The day's cap covers talking too, and it says so before spending anything. */
  async function guardChat(config: EngineConfig, messages: Msg[]): Promise<void> {
    const ctx: Ctx = { course: '', agent: 'Companion', noCache: true, spend: { usd: 0, calls: 0 }, now: () => new Date(), progress: () => undefined }
    try {
      await checkBudget(ctx, config, estimateCost(config.provider, config.models.fast, messages.reduce((n, m) => n + m.content.length, 0), 8192, false))
    } catch (error) {
      if (error instanceof BilimindError && /\bcap\b|would cross/i.test(error.message)) throw new BilimindError(`${error.message} You can change the limit in Settings, under Spending.`)
      throw error
    }
  }

  return {
    begin,
    answer,
    messageWire,
    threads: () => (db.prepare('SELECT body FROM threads WHERE deleted = 0 ORDER BY updated_ms DESC, id LIMIT 50').all() as { body: string }[])
      .map((r) => threadWire(JSON.parse(r.body) as Row)),
    thread(id: string): Row | null {
      const t = threadOf(id)
      return t ? threadWire(t, messagesOf(id).map((m) => m.row)) : null
    },
    threadOf,
    /** A rename is not activity: the thread keeps its place in the list. */
    rename(id: string, title: unknown): Row | null {
      const t = threadOf(id)
      if (!t) return null
      const clean = typeof title === 'string' ? title.replace(/\s+/gu, ' ').trim() : ''
      if (!clean || clean.length > TITLE_MAX) throw new Invalid({ title: ['Give the chat a name.'] })
      return threadWire(saveThread({ ...t, title: clean }, false))
    },
    remove(id: string): boolean {
      const t = threadOf(id)
      if (!t) return false
      saveThread({ ...t, deleted_at: wireTime(Date.now()) })
      return true
    },
  }
}

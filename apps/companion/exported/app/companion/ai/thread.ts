/**
 * The conversation itself, one for the whole app: the docked panel, the
 * drawer, the phone's sheet and the chat page (`/app/chat/<id>`) all draw
 * this same thread, so a question asked beside a lesson is still there when
 * the learner opens the chat full screen, and Today's "Ask BiliMind…" box
 * lands in it too.
 *
 *   const t = useAiThread()
 *   t.send('Quiz me on this lesson')     // grounded in what is on screen, with the tray's attachments
 *   t.send('Italian to B1', { intent: 'course' })   // drafts a course whatever the words
 *   t.pick(ATTEMPT_TILE)                 // "Check my attempt": the next message is their working
 *   t.send(STUCK_WORDS, { intent: 'stuck' })        // "I'm stuck, show me": the next step only
 *   t.messages.value                     // user and assistant turns
 *   t.stop() · t.retry() · t.reset() · t.load(threadId)
 *   t.renameThread(id, title) · t.removeThread(id)  // the sidebar's chat menu
 *
 * Asking, making things and making a course are one conversation. An answer
 * may draft a course (`message.proposal`, drawn as a card with Create); the
 * draft arrives in two beats, `drafting` and then `ready`, with the work
 * list (`message.steps`: "Reading lecture-4.pdf", "Drawing your path")
 * filling in between, and "make it 6 weeks" in the chat drafts it again on
 * the next answer. `intent` is the composer's mode, and it rides on the
 * next message only: "Make a course" (set by a starter, Courses' New course
 * or the + menu) or "Check my attempt" (set by its tile, or by the button
 * under an answer that asked for the learner's attempt first). `tile` is the
 * tile that set it (make.ts). Words can say the same without the mode: a
 * message that starts "Create a course on" or "Check my attempt" goes with
 * that intent anyway, so Today's box, which sends through the address, asks
 * the same way the chat does.
 *
 * Attempt first: an answer that asked for an attempt
 * instead of doing graded work carries `guard`, drawn as a line under it.
 * "I'm stuck, show me" there is a deliberate press, never a setting: it sends
 * STUCK_WORDS with `intent: 'stuck'` at once, and leaves the box (and any
 * attempt half-typed in it) alone.
 *
 * `answersFrom` is the chat page's "Answers from" (all courses, or one): a
 * new chat starts from everything.
 *
 * Sending is optimistic: the question shows at once, and under it an empty
 * answer that fills as the words arrive. They arrive in bursts (a proxy may
 * hold a dozen tokens back), so what is drawn is paced by a small pump that
 * lets the text catch up with what has been received over a few frames
 * rather than in jumps; the pace grows with the backlog, so it never falls
 * behind. Evidence markers the model writes while it works (`[E3]`) never
 * reach the screen; the final text, with its `[1]`-style citations and the
 * things it offers to make, replaces the streamed one in place once `done`
 * arrives, so nothing re-mounts and nothing flashes.
 *
 * Where the answer is grounded (the scope) defaults to what is on screen: a
 * lesson, page or board asks about itself, a course about the course, any
 * other screen about everything. The learner's own pick holds until the
 * screen changes to a different thing.
 */
import { computed, effectScope, nextTick, reactive, ref, toRaw, watch } from 'vue'
import { useToast } from '~/composables/useToast'
import { nowIso } from '../time'
import { useAi, type AiRequest } from './state'
import type { AiAskBody, AiAttachment, AiContext, AiMessage, AiProposal, AiScope, AiStep, AiThread } from './types'
import { AiAskError, askStream, deleteThread, getThread, listThreads, renameThread as renameRemote } from './client'
import { useAiAttachments } from './attach'
import { ATTEMPT_WORDS, COURSE_WORDS, withWords, type AiMode, type MakeTile } from './make'
import { useUsage } from '../usage'

/** The server reads at most this much of what is on screen. */
export const EXCERPT_LIMIT = 16_000

/** What "I'm stuck, show me" says, so the bubble reads as the learner's own words. */
export const STUCK_WORDS = 'I\'m stuck. Show me the next step.'

type AskIntent = NonNullable<AiAskBody['intent']>

const HERE_KINDS = new Set<AiContext['kind']>(['lesson', 'page', 'board', 'deadline'])

/** Which groundings make sense for a screen, narrowest first. */
export function scopesFor(ctx: AiContext): AiScope[] {
  const out: AiScope[] = []
  if (HERE_KINDS.has(ctx.kind)) out.push('here')
  if (ctx.subjectId) out.push('course')
  out.push('everything')
  return out
}

export function defaultScope(ctx: AiContext): AiScope {
  if (HERE_KINDS.has(ctx.kind)) return 'here'
  if (ctx.kind === 'course' && ctx.subjectId) return 'course'
  return 'everything'
}

/* -- State, module-level so every surface shares it ------------------------ */

const threadId = ref<string | null>(null)
const messages = ref<AiMessage[]>([])
const draft = ref('')
const quote = ref<string | null>(null)
const scopePick = ref<AiScope | null>(null)
const threads = ref<AiThread[]>([])
const threadsState = reactive({ loaded: false, loading: false, error: null as string | null })
const opening = ref<string | null>(null)
/** Bumped whenever the composer should take the caret (a request, a new chat). */
const focusTick = ref(0)
/** The chat page is on screen: the drawer stands down and ⌘J focuses its box. */
const pageOpen = ref(0)
/** The composer's mode ("Make a course", "Check my attempt"), taken by the next message. */
const intent = ref<AiMode | null>(null)
/** The tile that set the mode. */
const tile = ref<MakeTile | null>(null)
/** The chat page's "Answers from": one course's id, or null for all of them. */
const answersFrom = ref<string | null>(null)
/** What each question was asked with, so "Try again" asks it the same way. */
const asked = new Map<string, AskIntent>()
/** Chats deleted a moment ago, still undoable: gone from the list, not yet from the server. */
const deleting = new Map<string, { timer: ReturnType<typeof setTimeout>; thread: AiThread }>()

const busy = computed(() => messages.value.some((m) => m.pending))

/**
 * A draft the learner said to create in words ("ok, create it"): the card of
 * that message (Proposal.vue) takes it and creates through its own path.
 * `draftsCreating` is every draft being created now, for the answer's card.
 */
export const draftPress = ref<string | null>(null)
export const draftsCreating = reactive(new Set<string>())
/** Chats with an answer still coming in, on screen or left to finish in the background. */
const answering = ref<string[]>([])

let controller: AbortController | null = null
/**
 * Which conversation is on screen. A new chat (or opening another) moves it
 * on, and an answer still streaming for the one before keeps going into its
 * own thread instead of being thrown away; only Stop throws an answer away.
 */
let epoch = 0
let counter = 0
function localId(): string {
  counter += 1
  return `local-${Date.now().toString(36)}-${counter}`
}

/* -- The pump: what is drawn catches up with what has arrived --------------- */

interface Live {
  id: string
  raw: string
  shown: number
  final: AiMessage | null
}
let live: Live | null = null
let frame = 0

/**
 * Text fit to draw while it streams: no evidence markers (`[E3]`, and the
 * odd `[S1]`/`[T8]` row id the server renames in `done`), no citation
 * numbers yet (they become chips when the final text lands), and no half a
 * marker hanging off the end of the latest burst.
 */
export function streamingText(text: string): string {
  return text
    .replace(/ ?\[[A-Z]\d{1,3}\]/g, '')
    .replace(/ ?\[\d{1,2}\]/g, '')
    .replace(/ ?\[[A-Z]?\d*$/, '')
}

function find(id: string): AiMessage | undefined {
  return messages.value.find((m) => m.id === id)
}

const keys = new WeakMap<object, string>()

/**
 * A message's key for `v-for`: the id it was first drawn with. An answer
 * takes the server's id when it lands, and a key that changed with it would
 * re-mount the row (and its cards) at the very moment it finishes.
 */
export function messageKey(message: AiMessage): string {
  const raw = toRaw(message)
  let key = keys.get(raw)
  if (!key) {
    key = message.id
    keys.set(raw, key)
  }
  return key
}

function settle(): void {
  if (!live?.final) return
  const msg = find(live.id)
  const final = live.final
  live = null
  if (!msg) return
  // In place, so the row doesn't re-mount (its key is the id it streamed
  // with, `messageKey`), now under the server's id: a pressed card is
  // remembered by it (made.ts), and a reloaded chat has the same one.
  Object.assign(msg, {
    id: final.id || msg.id,
    text: final.text ?? '',
    citations: final.citations ?? [],
    actions: final.actions ?? [],
    proposal: final.proposal ?? msg.proposal ?? null,
    guard: final.guard ?? null,
    error: final.error ?? null,
    pending: false,
    status: null,
    making: null,
  })
  const press = msg.actions?.find((a) => a.type === 'create_draft')
  if (press?.type === 'create_draft') draftPress.value = press.message_id
  // The work list stays as it ended, so a finished draft can still say what it read.
  if (msg.steps?.length && msg.proposal?.state === 'ready') {
    msg.steps = msg.steps.map((s) => (s.state === 'active' ? { ...s, state: 'done' } : s))
  }
}

function pump(): void {
  frame = 0
  if (!live) return
  const msg = find(live.id)
  if (!msg) return
  const backlog = live.raw.length - live.shown
  if (backlog > 0) {
    live.shown = Math.min(live.raw.length, live.shown + Math.max(3, Math.ceil(backlog / 9)))
    msg.text = streamingText(live.raw.slice(0, live.shown))
  }
  if (live.shown < live.raw.length) kick()
  else if (live.final) settle()
}

function kick(): void {
  if (frame || !import.meta.client) return
  // A hidden tab gets no frames; there is nobody to pace for, so catch up.
  if (document.hidden) {
    if (live) live.shown = live.raw.length
    pump()
    return
  }
  frame = requestAnimationFrame(pump)
}

/* -- Threads list ------------------------------------------------------------ */

function touchThread(id: string, title: string, subjectId: string | null, drafted = false): void {
  const existing = threads.value.find((t) => t.id === id)
  const next: AiThread = {
    id,
    title: existing?.title || title,
    subject_id: existing?.subject_id ?? subjectId,
    updated_at: nowIso(),
    has_proposal: Boolean(existing?.has_proposal || drafted),
  }
  threads.value = [next, ...threads.value.filter((t) => t.id !== id)]
}

async function refreshThreads(): Promise<void> {
  if (threadsState.loading) return
  threadsState.loading = true
  threadsState.error = null
  try {
    // A chat deleted a moment ago stays out of the list while its Undo stands.
    threads.value = (await listThreads()).filter((t) => !deleting.has(t.id))
    threadsState.loaded = true
  } catch (error) {
    threadsState.error = (error as Error).message || 'Your chats didn\'t load.'
  } finally {
    threadsState.loading = false
  }
}

/** The first question, cut to a title, until the server names the thread. */
function titleFrom(text: string): string {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > 60 ? `${one.slice(0, 59).trimEnd()}…` : one
}

/* -- Sending ----------------------------------------------------------------- */

function statusFor(ctx: AiContext, scope: AiScope): string {
  if (scope === 'here') return `Reading ${ctx.label}…`
  if (scope === 'course') return 'Looking through the course…'
  return 'Looking through your courses…'
}

function bodyContext(ctx: AiContext): AiAskBody['context'] {
  let excerpt: string | null = null
  try {
    const text = ctx.excerpt?.()?.replace(/\n{3,}/g, '\n\n').trim()
    excerpt = text ? text.slice(0, EXCERPT_LIMIT) : null
  } catch {
    excerpt = null
  }
  return {
    kind: ctx.kind,
    label: ctx.label ?? null,
    subject_id: ctx.subjectId ?? null,
    item_id: ctx.itemId ?? null,
    topic_id: ctx.topicId ?? null,
    node_id: ctx.nodeId ?? null,
    course_id: ctx.courseId ?? null,
    deadline_id: ctx.deadlineId ?? null,
    excerpt,
  }
}

async function run(body: AiAskBody, replyId: string, subjectId: string | null): Promise<void> {
  controller?.abort()
  const mine = new AbortController()
  controller = mine
  live = { id: replyId, raw: '', shown: 0, final: null }
  const title = titleFrom(body.message)
  const era = epoch
  /** Still the conversation on screen (not left to finish in the background). */
  const here = () => era === epoch
  let tid: string | null = body.thread_id ?? null
  if (tid) answering.value = [...answering.value, tid]

  try {
    await askStream(
      body,
      {
        start: (event) => {
          if (!event.thread_id) return
          if (tid !== event.thread_id) {
            answering.value = [...answering.value.filter((x) => x !== tid), event.thread_id]
            tid = event.thread_id
          }
          if (here()) threadId.value = event.thread_id
          // Listed at once, so the sidebar shows the new chat (and its answering dot) while it answers.
          touchThread(event.thread_id, title, subjectId)
        },
        status: (text, step) => {
          const msg = find(replyId)
          if (!msg) return
          if (text) msg.status = text
          if (step) msg.steps = upsertStep(msg.steps ?? [], step)
        },
        proposal: (draft) => {
          const msg = find(replyId)
          if (msg) msg.proposal = draft
        },
        making: (actions) => {
          const msg = find(replyId)
          if (msg) msg.making = actions
        },
        delta: (text) => {
          if (!live || live.id !== replyId) return
          live.raw += text
          kick()
        },
        done: (event) => {
          if (event.thread_id) tid = event.thread_id
          if (here() && tid) threadId.value = tid
          if (tid) touchThread(tid, title, subjectId, Boolean(event.message?.proposal))
          if (!live || live.id !== replyId) return
          live.final = event.message
          // A JSON answer (or a stream that sent no deltas) still types itself out.
          if (!live.raw.trim()) live.raw = event.message?.text ?? ''
          kick()
        },
      },
      mine.signal,
    )
  } catch (error) {
    // Left to finish in the background and it didn't: its thread keeps the question.
    if (!here()) return
    const msg = find(replyId)
    const shown = live && live.id === replyId ? streamingText(live.raw.slice(0, live.shown)) : msg?.text ?? ''
    if (live?.id === replyId) live = null
    if (!msg) return
    if ((error as Error).name === 'AbortError') {
      // Stopped by the learner: keep what came, drop an answer that never started.
      if (shown.trim()) Object.assign(msg, { text: shown, pending: false, status: null, making: null })
      else messages.value = messages.value.filter((m) => m.id !== replyId)
      return
    }
    // The question was kept even though the answer wasn't: asking again continues that thread.
    if (error instanceof AiAskError && error.threadId) threadId.value = error.threadId
    Object.assign(msg, {
      text: shown,
      pending: false,
      status: null,
      making: null,
      error: error instanceof AiAskError ? error.message : 'Something went wrong on our side. Try again in a moment.',
      limited: error instanceof AiAskError && error.status === 402,
    })
  } finally {
    if (controller === mine) controller = null
    void useUsage().load()
    if (tid) answering.value = answering.value.filter((x) => x !== tid)
  }
  // The server may have named the thread better than its first question.
  if (threadsState.loaded && !find(replyId)?.error) void refreshThreads()
}

/** A drafting step in place (its state moved on), or added at the end of the work list. */
function upsertStep(steps: AiStep[], step: AiStep): AiStep[] {
  const at = steps.findIndex((s) => s.key === step.key)
  if (at < 0) return [...steps, step]
  const next = [...steps]
  next[at] = step
  return next
}

/**
 * The words for a message that is only material: what ChatGPT leaves blank,
 * said, so the thread reads as a conversation and the server has a question.
 */
function sentenceFor(attachments: AiAttachment[], kind: AskIntent | null): string {
  const one = attachments.length === 1 ? attachments[0]!.label : null
  if (kind === 'course') return one ? `Make a course from ${one}.` : 'Make a course from these.'
  if (kind === 'attempt') return 'Check my attempt.'
  return one ? `Have a look at ${one}.` : `Have a look at these ${attachments.length}.`
}

export interface SendOptions {
  quote?: string | null
  scope?: AiScope
  /** Stop an answer in progress and ask this instead. */
  force?: boolean
  /** Left out, whatever is in the composer's tray goes (and the tray empties). */
  attachments?: AiAttachment[]
  /** Left out, the composer's mode (`intent`) decides, and is used up. */
  intent?: AiAskBody['intent']
}

function send(text: string, opts: SendOptions = {}): void {
  if (busy.value) {
    if (!opts.force) return
    stop()
  }
  const tray = useAiAttachments()
  const attachments = opts.attachments ?? tray.sendable.value
  const words = text.trim()
  // A tile's "Create a course on…" asks for a course as plainly as the course
  // mode does, and "Check my attempt: …" for feedback as plainly as its mode.
  const said = COURSE_WORDS.test(words) ? 'course' : ATTEMPT_WORDS.test(words) ? 'attempt' : null
  const kind: AskIntent | null = opts.intent !== undefined ? opts.intent : intent.value ?? said
  const course = kind === 'course'
  const message = words || (attachments.length ? sentenceFor(attachments, kind) : '')
  if (!message) return
  if (!opts.attachments) tray.take()
  if (opts.intent === undefined) {
    intent.value = null
    tile.value = null
  }

  const ai = useAi()
  const ctx = ai.context.value
  const scope = opts.scope ?? currentScope(ctx)
  const passage = opts.quote !== undefined ? opts.quote : quote.value
  const now = nowIso()
  const question: AiMessage = {
    id: localId(),
    role: 'user',
    text: message,
    quote: passage,
    created_at: now,
    ...(attachments.length ? { attachments } : {}),
  }
  if (kind) asked.set(question.id, kind)
  const status = course
    ? 'Drafting your course…'
    : kind === 'attempt'
      ? 'Reading your attempt…'
      : attachments.length
        ? `Reading ${attachments.length === 1 ? attachments[0]!.label : `the ${attachments.length} things you added`}…`
        : statusFor(ctx, scope)
  messages.value.push(question, { id: localId(), role: 'assistant', text: '', pending: true, status, created_at: now })
  const reply = messages.value[messages.value.length - 1]!
  // "I'm stuck" is pressed under an answer, not sent from the box: an attempt
  // half-typed there is still theirs to finish.
  if (kind !== 'stuck') {
    draft.value = ''
    quote.value = null
  }
  void run(
    {
      message,
      thread_id: threadId.value,
      quote: passage || null,
      ...(attachments.length ? { attachments } : {}),
      ...(kind ? { intent: kind } : {}),
      scope,
      context: bodyContext(ctx),
    },
    reply.id,
    ctx.subjectId ?? null,
  )
}

function stop(): void {
  controller?.abort()
}

/**
 * Move the screen on without throwing away an answer still coming in: it
 * finishes into its own thread (the server keeps it), which stays in the
 * chats list, so it is there when the learner
 * goes back. Stop, by contrast, ends it.
 */
function detach(): void {
  epoch += 1
  controller = null
  live = null
}

/** Ask the last question again, in place of its answer. */
function retry(): void {
  if (busy.value) return
  let i = messages.value.length - 1
  while (i >= 0 && messages.value[i]!.role !== 'user') i--
  if (i < 0) return
  const last = messages.value[i]!
  messages.value = messages.value.slice(0, i)
  send(last.text, {
    quote: last.quote ?? null,
    attachments: last.attachments ?? [],
    intent: asked.get(last.id) ?? null,
  })
}

/** `keepTray`: a question handed over with its attachments (Today's box) keeps them. */
function reset(keepTray = false): void {
  detach()
  threadId.value = null
  messages.value = []
  draft.value = ''
  quote.value = null
  intent.value = null
  tile.value = null
  answersFrom.value = null
  if (!keepTray) useAiAttachments().clear()
  focusTick.value += 1
}

/**
 * A mode on (`COURSE_TILE` from the + menu or `?intent=course`;
 * `ATTEMPT_TILE` from an answer's "Check my attempt") or off (null).
 */
function pick(next: MakeTile | null): void {
  tile.value = next && next.key !== 'ask' ? next : null
  intent.value = tile.value?.intent ?? null
  focusTick.value += 1
}

/**
 * A "Choose what to make" tile pressed: its words go in the box (make.ts
 * `withWords`). "Check my attempt" sets its mode as well; another tile's
 * words in place of its own take the mode away with them.
 */
function write(next: MakeTile): void {
  draft.value = withWords(next, draft.value)
  if (next.intent === 'attempt' || intent.value === 'attempt') {
    tile.value = next.intent === 'attempt' ? next : null
    intent.value = tile.value?.intent ?? null
  }
  focusTick.value += 1
}

async function load(id: string): Promise<void> {
  if (id === threadId.value && messages.value.length) return
  detach()
  opening.value = id
  try {
    const thread = await getThread(id)
    if (opening.value !== id) return
    threadId.value = thread.id
    messages.value = (thread.messages ?? []).map((m) => ({ ...m, pending: false, status: null }))
    quote.value = null
  } catch (error) {
    useToast().error({ title: 'That chat didn\'t open', body: (error as Error).message || 'Try again in a moment.' })
  } finally {
    if (opening.value === id) opening.value = null
  }
}

function putBack(thread: AiThread): void {
  if (threads.value.some((t) => t.id === thread.id)) return
  threads.value = [...threads.value, thread].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
}

/**
 * Delete a chat, with five seconds to take it back. It leaves the list (and
 * the screen, if it was open) at once; the server is only told once the
 * Undo has gone, so taking it back costs nothing.
 */
function removeThread(id: string): void {
  const thread = threads.value.find((t) => t.id === id) ?? { id, title: '', subject_id: null, updated_at: nowIso() }
  const wasOpen = threadId.value === id
  threads.value = threads.value.filter((t) => t.id !== id)
  if (wasOpen) {
    // Deleting the chat that is answering ends that answer too.
    stop()
    reset()
  }
  const toast = useToast()
  const timer = setTimeout(async () => {
    deleting.delete(id)
    try {
      await deleteThread(id)
    } catch {
      putBack(thread)
      toast.error('That chat couldn\'t be deleted. Try again.')
    }
  }, 5000)
  deleting.set(id, { timer, thread })
  toast.push({
    title: thread.title ? `Deleted “${thread.title.length > 40 ? `${thread.title.slice(0, 39)}…` : thread.title}”` : 'Chat deleted',
    duration: 5000,
    action: {
      label: 'Undo',
      handler: () => {
        const pending = deleting.get(id)
        if (!pending) return
        clearTimeout(pending.timer)
        deleting.delete(id)
        putBack(pending.thread)
        if (wasOpen) void load(id)
      },
    },
  })
}

/** Name a chat. The list changes at once; a failure puts the old name back. */
async function renameThread(id: string, title: string): Promise<void> {
  const name = title.replace(/\s+/g, ' ').trim().slice(0, 120)
  const thread = threads.value.find((t) => t.id === id)
  if (!name || (thread && thread.title === name)) return
  const before = thread?.title ?? ''
  if (thread) threads.value = threads.value.map((t) => (t.id === id ? { ...t, title: name } : t))
  try {
    await renameRemote(id, name)
  } catch {
    threads.value = threads.value.map((t) => (t.id === id ? { ...t, title: before } : t))
    useToast().error('That name didn\'t save. Try again.')
  }
}

/** A drafted course was made: its card becomes a link to it. */
function markProposalCreated(messageId: string, created: NonNullable<AiProposal['created']>): void {
  const msg = find(messageId)
  if (msg?.proposal) msg.proposal = { ...msg.proposal, created }
}

/** ↑ in an empty box: the last question back, to fix and send again. */
function editLast(): boolean {
  const last = [...messages.value].reverse().find((m) => m.role === 'user')
  if (!last || draft.value.trim()) return false
  draft.value = last.text
  quote.value = last.quote ?? null
  return true
}

/* -- Scope ------------------------------------------------------------------- */

function currentScope(ctx: AiContext): AiScope {
  const allowed = scopesFor(ctx)
  return scopePick.value && allowed.includes(scopePick.value) ? scopePick.value : defaultScope(ctx)
}

/* -- Requests from other screens, taken once -------------------------------- */

function handle(request: AiRequest | null): void {
  if (!request) return
  if (request.fresh) reset()
  if (request.quote) quote.value = request.quote
  if (request.prompt) {
    if (request.send) send(request.prompt, { quote: request.quote ?? quote.value, force: true })
    else draft.value = request.prompt
  }
  // After the render that may be mounting the box this is meant for.
  void nextTick(() => {
    focusTick.value += 1
  })
}

let wired = false
function wire(): void {
  if (wired || !import.meta.client) return
  wired = true
  const ai = useAi()
  // Detached: these outlive whichever component happened to call first.
  effectScope(true).run(() => {
    watch(
      () => ai.request.value,
      (value) => {
        if (value) handle(ai.take())
      },
      { immediate: true },
    )
    // A different thing on screen is a different default grounding.
    watch(
      () => {
        const c = ai.context.value
        return [c.kind, c.itemId, c.nodeId, c.subjectId, c.deadlineId].join('|')
      },
      () => {
        scopePick.value = null
      },
    )
  })
}

export function useAiThread() {
  wire()
  const ai = useAi()
  const scope = computed<AiScope>({
    get: () => currentScope(ai.context.value),
    set: (value) => {
      scopePick.value = value
    },
  })
  return {
    threadId,
    messages,
    draft,
    quote,
    scope,
    scopes: computed(() => scopesFor(ai.context.value)),
    busy,
    opening,
    focusTick,
    pageOpen,
    answering,
    intent,
    tile,
    answersFrom,
    threads,
    threadsState,
    title: computed(() => {
      const named = threads.value.find((t) => t.id === threadId.value)?.title
      const first = messages.value.find((m) => m.role === 'user')?.text
      return named || (first ? titleFrom(first) : '')
    }),
    send,
    stop,
    retry,
    reset,
    load,
    editLast,
    refreshThreads,
    removeThread,
    renameThread,
    markProposalCreated,
    pick,
    write,
    focus: () => {
      focusTick.value += 1
    },
  }
}

export type AiThreadState = ReturnType<typeof useAiThread>

/* -- Grouping for the history lists ------------------------------------------ */

export interface ThreadGroup {
  label: string
  threads: AiThread[]
}

/** Today, This week, Earlier: the way a person looks for "that chat yesterday". */
export function groupThreads(list: AiThread[], now = Date.now()): ThreadGroup[] {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const today = start.getTime()
  const week = today - 6 * 86_400_000
  const groups: ThreadGroup[] = [
    { label: 'Today', threads: [] },
    { label: 'This week', threads: [] },
    { label: 'Earlier', threads: [] },
  ]
  for (const t of list) {
    const at = Date.parse(t.updated_at)
    groups[at >= today ? 0 : at >= week ? 1 : 2]!.threads.push(t)
  }
  return groups.filter((g) => g.threads.length)
}

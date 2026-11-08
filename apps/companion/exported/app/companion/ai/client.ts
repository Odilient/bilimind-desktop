/**
 * The wire to `POST /api/companion/ask` and its threads.
 *
 *   await askStream(body, {
 *     start: ({ thread_id }) => …,     // the thread exists (new or not)
 *     status: (text, step) => …,       // "Reading Lecture 8 slides…", or a drafting step
 *     delta: (text) => …,              // the next few words, to append
 *     making: (actions) => …,          // the action cards so far: a note's words, the flashcards
 *     proposal: (p) => …,              // a course being drafted: `drafting`, then `ready`/`failed`
 *     done: ({ message }) => …,        // the final text, citations, actions and draft
 *   }, controller.signal)
 *
 * Streaming is a `fetch` read chunk by chunk, not an `EventSource`: an
 * EventSource can't POST and can't send the bearer token, which is exactly
 * why the old generation feed fell back to polling (useGenerationStream.ts).
 * A server (or a proxy) that answers with plain JSON instead is read the
 * same way, as one `start` and one `done`, so the thread never has to know
 * which it got.
 *
 * Failures arrive as a thrown `AiAskError` whose message is fit to show:
 * the server's own sentence when it sent one (503 "The model is resting…"),
 * else a plain one for the status.
 */
import { apiBaseUrl, AUTH_COOKIE, authCookieOptions, useApi } from '~/composables/useApi'
import type { AiAction, AiAskBody, AiMessage, AiProposal, AiStep, AiThread } from './types'

export interface AskHandlers {
  start?: (event: { thread_id: string; message_id?: string | null }) => void
  /** A line of what it's doing; while a course is drafted, `step` is one row of the work list. */
  status?: (text: string, step?: AiStep | null) => void
  delta?: (text: string) => void
  /** What the answer's action cards hold so far; each event is the whole of it. */
  making?: (actions: AiAction[]) => void
  /** Sent once as `drafting` when a course draft starts, then once as `ready` or `failed`. */
  proposal?: (proposal: AiProposal) => void
  done: (event: { thread_id: string; message: AiMessage }) => void
}

export class AiAskError extends Error {
  override readonly name = 'AiAskError'
  constructor(
    message: string,
    readonly status = 0,
    /** The thread the question was kept in, so asking again continues it. */
    readonly threadId: string | null = null,
  ) {
    super(message)
  }
}

function token(): string | null {
  try {
    return useCookie<string | null>(AUTH_COOKIE, authCookieOptions()).value ?? null
  } catch {
    return null
  }
}

function url(path: string): string {
  return `${apiBaseUrl().replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function plainMessage(status: number): string {
  if (status === 0) return 'BiliMind can\'t be reached. Check the connection and try again.'
  if (status === 401 || status === 419) return 'You\'ve been signed out. Sign in again to ask.'
  // The ways forward are drawn after it as links (CompanionOutOfAi), so this is the reason alone.
  if (status === 402) return 'You\'re out of AI for now.'
  if (status === 422) return 'That question couldn\'t be sent. Try saying it another way.'
  if (status === 429) return 'Too many questions at once. Wait a moment and ask again.'
  if (status === 503) return 'The AI is resting for a moment. Try again shortly.'
  return 'Something went wrong on our side. Try again in a moment.'
}

/** One SSE block (`event:` + `data:` lines) to its name and parsed payload. */
function parseBlock(block: string): { event: string; data: unknown } | null {
  let event = 'message'
  const data: string[] = []
  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue
    const colon = line.indexOf(':')
    const field = colon < 0 ? line : line.slice(0, colon)
    const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '')
    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
  }
  if (!data.length) return null
  const raw = data.join('\n')
  try {
    return { event, data: JSON.parse(raw) }
  } catch {
    return { event, data: raw }
  }
}

function dispatch(name: string, data: unknown, on: AskHandlers): boolean {
  const payload = (data ?? {}) as Record<string, unknown>
  switch (name) {
    case 'start':
      on.start?.({ thread_id: String(payload.thread_id ?? ''), message_id: (payload.message_id as string) ?? null })
      return false
    case 'status': {
      const step = payload.step as AiStep | undefined
      on.status?.(String(payload.text ?? ''), step && typeof step === 'object' && step.key ? step : null)
      return false
    }
    case 'proposal': {
      // The event is the AiProposal itself; a server that wraps it in
      // `{ proposal }` is read too (the inner one is the one with a state).
      const inner = payload.proposal as Record<string, unknown> | undefined
      const draft = (typeof payload.state === 'string' ? payload : inner && typeof inner.state === 'string' ? inner : null) as AiProposal | null
      if (draft) on.proposal?.(draft)
      return false
    }
    case 'delta':
      on.delta?.(typeof data === 'string' ? data : String(payload.text ?? ''))
      return false
    case 'making':
      on.making?.((payload.actions as AiAction[]) ?? [])
      return false
    case 'done':
      on.done({ thread_id: String(payload.thread_id ?? ''), message: payload.message as AiMessage })
      return true
    case 'error':
      // Out of AI: the reason alone, because the reply draws the ways forward as links.
      throw new AiAskError(
        String((payload.status === 402 && payload.reason) || payload.message || '') || plainMessage(500),
        Number(payload.status ?? 500),
      )
    default:
      return false
  }
}

async function readStream(response: Response, on: AskHandlers): Promise<void> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finished = false
  while (!finished) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // Events end at a blank line; a half-arrived one waits for the next chunk.
    let cut = buffer.search(/\r?\n\r?\n/)
    while (cut >= 0) {
      const block = buffer.slice(0, cut)
      buffer = buffer.slice(cut).replace(/^\r?\n\r?\n/, '')
      const parsed = parseBlock(block)
      if (parsed && dispatch(parsed.event, parsed.data, on)) finished = true
      cut = buffer.search(/\r?\n\r?\n/)
    }
  }
  if (!finished && buffer.trim()) {
    const parsed = parseBlock(buffer)
    if (parsed) finished = dispatch(parsed.event, parsed.data, on)
  }
  if (!finished) throw new AiAskError('The answer stopped halfway. Ask again to get the rest.', 0)
}

/**
 * Ask, streaming. Resolves once `done` has been handed over; rejects with an
 * `AiAskError` (or an `AbortError` when `signal` fired, which callers treat
 * as the learner pressing Stop, not as a failure).
 */
export async function askStream(body: AiAskBody, on: AskHandlers, signal?: AbortSignal): Promise<void> {
  const bearer = token()
  let response: Response
  try {
    response = await fetch(url('/companion/ask'), {
      method: 'POST',
      headers: {
        'Accept': 'text/event-stream',
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new AiAskError(plainMessage(0), 0)
  }

  if (!response.ok) {
    let message = ''
    let threadId: string | null = null
    try {
      const json = (await response.json()) as { message?: string; reason?: string; thread_id?: string }
      // A 402 from the meter carries its reason alone; the reply adds the ways forward.
      message = response.status === 402 && typeof json?.reason === 'string'
        ? json.reason
        : typeof json?.message === 'string' ? json.message : ''
      threadId = typeof json?.thread_id === 'string' ? json.thread_id : null
    } catch {
      // No body worth reading; the status says enough.
    }
    // Laravel's generic sentences say nothing a learner can act on.
    if (!message || /^(Server Error|Unauthenticated\.?|Too Many Attempts\.?)$/i.test(message)) {
      message = plainMessage(response.status)
    }
    throw new AiAskError(message, response.status, threadId)
  }

  const type = response.headers.get('content-type') ?? ''
  if (type.includes('text/event-stream') && response.body) return readStream(response, on)

  const json = (await response.json()) as { data?: { thread_id: string; message: AiMessage } }
  const data = json?.data
  if (!data?.message) throw new AiAskError(plainMessage(500), 500)
  on.start?.({ thread_id: data.thread_id, message_id: data.message.id })
  on.done({ thread_id: data.thread_id, message: data.message })
}

/* -- Threads ---------------------------------------------------------------- */

export async function listThreads(): Promise<AiThread[]> {
  return useApi().get<AiThread[]>('/companion/ask/threads')
}

export async function getThread(id: string): Promise<AiThread & { messages: AiMessage[] }> {
  const thread = await useApi().get<AiThread & { messages?: AiMessage[] }>(`/companion/ask/threads/${id}`)
  return { ...thread, messages: thread.messages ?? [] }
}

/** A chat named by the learner (the sidebar's Rename, the chat page's title). */
export async function renameThread(id: string, title: string): Promise<void> {
  await useApi().patch(`/companion/ask/threads/${id}`, { title })
}

export async function deleteThread(id: string): Promise<void> {
  await useApi().del(`/companion/ask/threads/${id}`)
}

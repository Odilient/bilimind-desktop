import { toApiError } from '~/composables/useApi'
import type {
  IllustrationTriggerResponse,
  IllustrationUnavailableReason,
  ImageryAllowance,
} from '~/types/api'

/**
 * Asking the server to draw a lesson's illustration, and waiting for it.
 *
 * Every picture costs $0.0387 of real money — measured, not estimated — so the
 * two things this file is actually for are both about not spending it twice.
 * The in-flight map means a block rendered in two panes at once (the phone
 * layout and the desktop layout of the same lesson exist simultaneously in the
 * DOM) issues ONE request; the settled map means switching workspace tabs and
 * coming back does not re-ask a question the server has already answered.
 *
 * The other rule here is that nothing throws. A capped budget, a dead queue
 * worker and an unreachable API all resolve to an outcome the block can render,
 * because the lesson around the picture is perfectly readable and a red error
 * over it would be a lie about how bad the situation is. What the outcome does
 * carry is WHY — a hit ceiling and an outage must never look alike to the person
 * who owns the course.
 */

export interface IllustrationOutcome {
  state: 'ready' | 'generating' | 'unavailable'
  url: string | null
  width: number | null
  height: number | null
  reason: IllustrationUnavailableReason | null
  /**
   * Plain words for the course owner, written by the server. Null when there is
   * nothing a human could act on — a reader who does not own the course, or a
   * network blip that will fix itself.
   */
  message: string | null
  allowance: ImageryAllowance | null
}

/**
 * Shared across every caller in the tab, on purpose: these are caches of what
 * the SERVER said, and the server's answer does not vary by which component
 * asked. They live for the life of the page — a reload is the honest way to
 * re-ask, and `forget()` is the deliberate one.
 */
const inFlight = new Map<number, Promise<IllustrationOutcome>>()
const settled = new Map<number, IllustrationOutcome>()

/** The provider takes 10–20s; a queue with anything else in it takes longer. */
const DEADLINE_MS = 90_000

/* Bounds on what we will honour from `retry_after`. The floor stops a
   misconfigured server turning a lesson into a polling loop; the ceiling stops
   one leaving a spinner up for a minute between checks. */
const POLL_FLOOR_MS = 1_500
const POLL_CEILING_MS = 10_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function outcome(partial: Partial<IllustrationOutcome> & Pick<IllustrationOutcome, 'state'>) {
  return {
    url: null,
    width: null,
    height: null,
    reason: null,
    message: null,
    allowance: null,
    ...partial,
  } satisfies IllustrationOutcome
}

function positiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null
}

/**
 * The response is our own JSON, but it is still parsed rather than trusted: a
 * body that has drifted must degrade to "no picture", which is a state the block
 * already renders well, instead of throwing inside a lesson.
 */
function read(body: IllustrationTriggerResponse | null): IllustrationOutcome {
  if (body?.state === 'ready' && typeof body.url === 'string' && body.url.length > 0) {
    return outcome({
      state: 'ready',
      url: body.url,
      width: positiveInt(body.width),
      height: positiveInt(body.height),
      allowance: body.allowance ?? null,
    })
  }

  if (body?.state === 'generating') {
    return outcome({ state: 'generating', allowance: body.allowance ?? null })
  }

  return outcome({
    state: 'unavailable',
    reason: body?.state === 'unavailable' ? (body.reason ?? null) : null,
    message: body?.state === 'unavailable' ? (body.message ?? null) : null,
    allowance: body?.state === 'unavailable' ? (body.allowance ?? null) : null,
  })
}

export function useIllustration() {
  const api = useApi()

  /** One round trip. Resolves to an outcome for every failure there is. */
  async function ask(blockId: number): Promise<{ outcome: IllustrationOutcome; wait: number }> {
    try {
      const body = await api.post<IllustrationTriggerResponse>(
        `/blocks/${blockId}/illustration`,
        undefined,
        { unwrap: false },
      )

      const retry = body?.state === 'generating' ? positiveInt(body.retry_after) : null

      return {
        outcome: read(body),
        wait: Math.min(POLL_CEILING_MS, Math.max(POLL_FLOOR_MS, (retry ?? 3) * 1000)),
      }
    } catch (error) {
      const failure = toApiError(error)

      /* 404 is the answer for "not your course" and for "not an illustration"
         alike — the endpoint deliberately refuses to distinguish them, so block
         ids cannot be walked. Neither is a fact about the lesson, so the reader
         gets the alt text and no explanation they could not act on. */
      const reason: IllustrationUnavailableReason | null =
        failure.status === 404 || failure.status === 401 || failure.status === 403
          ? 'not_owner'
          : null

      return {
        outcome: outcome({ state: 'unavailable', reason }),
        wait: POLL_CEILING_MS,
      }
    }
  }

  async function drive(blockId: number): Promise<IllustrationOutcome> {
    const deadline = Date.now() + DEADLINE_MS
    let latest = outcome({ state: 'generating' })

    for (;;) {
      const { outcome: answer, wait } = await ask(blockId)

      if (answer.state !== 'generating') return answer

      latest = answer

      /* Out of patience, not out of hope. The job may well still be running, so
         this stays `generating` and says so — telling someone their picture is
         unavailable when it is thirty seconds away is the wrong lie. */
      if (Date.now() + wait >= deadline) {
        return { ...latest, message: 'Still drawing. Reopen this lesson in a minute.' }
      }

      await sleep(wait)
    }
  }

  /**
   * Ask for this block's picture and wait for the answer.
   *
   * Only ever call this for someone who can actually cause a render — the
   * endpoint is `auth:sanctum`, and a 401 from anywhere in this app tears down
   * the session and bounces to the sign-in page. A public reader must never
   * reach it; they see whatever the server already hydrated, or the alt text.
   */
  function request(blockId: number): Promise<IllustrationOutcome> {
    const memo = settled.get(blockId)
    if (memo) return Promise.resolve(memo)

    const pending = inFlight.get(blockId)
    if (pending) return pending

    if (!import.meta.client) return Promise.resolve(outcome({ state: 'unavailable' }))

    const run = drive(blockId)
      .then((result) => {
        /* Memoise what the SERVER decided, never what the network did to us. A
           cap or a stalled worker is a settled answer worth remembering for the
           page's lifetime; a dropped connection is not, and caching it would
           make one bad moment permanent. */
        const answered =
          result.state === 'ready' || (result.state === 'unavailable' && result.reason !== null)

        if (answered) settled.set(blockId, result)
        return result
      })
      .finally(() => {
        inFlight.delete(blockId)
      })

    inFlight.set(blockId, run)

    return run
  }

  /**
   * Drop the memo for one block so the next `request` really asks again.
   *
   * This is what "Try again" is allowed to do and a re-render is not: the states
   * worth retrying are the outage ones, and only a person can know the queue
   * worker has been started.
   */
  function forget(blockId: number): void {
    settled.delete(blockId)
  }

  return { request, forget }
}

// One model call from anywhere that isn't the chat or a lesson: the active key, the day's cap, and words a learner can act on.
import { BilimindError, type Ctx } from '@bilimind/engine/contracts'
import { callJson, setEngineConfig } from '@bilimind/engine/llm'
import type { KeyState } from './ask/asker.ts'
import { json } from './respond.ts'

const NO_KEY = "This needs your AI key, and there isn't one on this computer yet. Add a DeepSeek or OpenRouter key in Settings and try again."

/** The model couldn't help: what to tell them, as the 503 the screens already handle. */
export class AiUnavailable extends Error {}

export const unavailable = (error: AiUnavailable) => json({ message: error.message }, 503)

export interface AiDeps {
  key: () => KeyState
  fallbackFetch?: typeof fetch
}

export type Ask = <T>(stage: string, system: string, user: string, schema: Record<string, unknown>, down: string, options?: { reasoning?: boolean; onContent?: (soFar: string) => void; course?: string }) => Promise<T>

/** `down` is the sentence for a model that didn't answer. A cap says what it is, and where to change it. */
export function aiCaller(deps: AiDeps): Ask {
  return async <T>(stage: string, system: string, user: string, schema: Record<string, unknown>, down: string, options: { reasoning?: boolean; onContent?: (soFar: string) => void; course?: string } = {}) => {
    const key = deps.key()
    if (key.state !== 'ok') throw new AiUnavailable(NO_KEY)
    setEngineConfig(key.config)
    // Not a course's spend unless the caller says so: the day's cap is the one that applies.
    const ctx: Ctx = { course: options.course ?? '', agent: 'Companion', noCache: true, spend: { usd: 0, calls: 0 }, now: () => new Date(), progress: () => undefined }
    try {
      const out = await callJson<T>(ctx, { stage: stage as never, system, user, schema, reasoning: options.reasoning ?? true, onContent: options.onContent, fallbackFetch: deps.fallbackFetch })
      return out.data
    } catch (error) {
      if (error instanceof BilimindError && /\bcap\b|would cross/i.test(error.message)) throw new AiUnavailable(`${error.message} You can change the limit in Settings, under Spending.`)
      throw new AiUnavailable(down)
    }
  }
}

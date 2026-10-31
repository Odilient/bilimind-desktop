import type { PageContext } from './context'
import { demoLines, demoMomentSecond } from './demo'

/**
 * What was said at a second of a recording, for a moment block's quote.
 *
 * Transcripts come from on-device speech and have no endpoint yet, so
 * http mode answers nothing and the learner types the quote. The demo lectures
 * have a few real-sounding lines so the block can be seen whole.
 */

/** The line being spoken at `seconds`: the last one that started before it. */
export function transcriptAt(ctx: PageContext, seconds: number, demo: boolean): string {
  const lines = demo ? demoLines(ctx) : null
  if (!lines) return ''
  let found = ''
  for (const line of lines) if (line.at <= seconds + 2) found = line.text
  return found
}

/**
 * Where a new moment should point. While the class is on, that's now, "what
 * was just said". Afterwards, the demo picks a line worth quoting and a real
 * page starts at 0:00 for the learner to set.
 */
export function momentNow(
  ctx: PageContext,
  demo: boolean,
  now = Date.now(),
): { item_id: string | null; at_seconds: number; quote: string; live: boolean } | null {
  const rec = ctx.recording
  if (!rec) return null
  const duration = Number(rec.meta.duration_s ?? 0)
  const s = ctx.session
  const start = s ? Date.parse(s.starts_at) : NaN
  const end = s ? Date.parse(s.ends_at) : NaN
  const live = Number.isFinite(start) && now >= start && now <= end
  const at = live ? Math.floor((now - start) / 1000) : (demo ? demoMomentSecond(ctx) : null) ?? 0
  const clamped = duration ? Math.min(at, duration) : at
  return { item_id: rec.id, at_seconds: clamped, quote: transcriptAt(ctx, clamped, demo), live }
}

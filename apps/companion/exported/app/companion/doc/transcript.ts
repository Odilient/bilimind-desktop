import type { PageContext } from './context'

/**
 * What was said at a second of a recording, for a moment block's quote.
 *
 * Transcripts come from on-device speech: the desktop app writes them into the
 * recording. Without one the learner types the
 * quote.
 */

/** The line being spoken at `seconds`: the last one that started before it. */
export function transcriptAt(ctx: PageContext, seconds: number): string {
  // Recording: a recording transcribed on the desktop carries its lines (`meta.transcript`).
  const lines = ctx.recording?.meta.transcript?.map((l) => ({ at: l.start, text: l.text })) ?? null
  if (!lines) return ''
  let found = ''
  for (const line of lines) if (line.at <= seconds + 2) found = line.text
  return found
}

/**
 * Where a new moment should point. While the class is on, that's now, "what
 * was just said". Afterwards it starts at 0:00 for the learner to set.
 */
export function momentNow(
  ctx: PageContext,
  now = Date.now(),
): { item_id: string | null; at_seconds: number; quote: string; live: boolean } | null {
  const rec = ctx.recording
  if (!rec) return null
  const duration = Number(rec.meta.duration_s ?? 0)
  const s = ctx.session
  const start = s ? Date.parse(s.starts_at) : NaN
  const end = s ? Date.parse(s.ends_at) : NaN
  const live = Number.isFinite(start) && now >= start && now <= end
  const at = live ? Math.floor((now - start) / 1000) : 0
  const clamped = duration ? Math.min(at, duration) : at
  return { item_id: rec.id, at_seconds: clamped, quote: transcriptAt(ctx, clamped), live }
}

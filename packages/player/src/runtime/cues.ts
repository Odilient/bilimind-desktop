// Pure helpers for the narration clock: which cue is playing, waveform bars, sentence wrapping plans.
import { sentenceRanges } from '@bilimind/core';

export interface Cue { id: string; start_ms: number; end_ms: number }

/**
 * Index of the cue being read at time t (ms): the last cue that has started. A cue stays lit through
 * the short pause after it, so the marker never blinks off between sentences. -1 before the first cue.
 */
export function cueAt(cues: readonly Cue[], t: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid]!.start_ms <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
}

/** n bar heights (0.12..1) resampled from peaks (max per bucket); a gentle fake shape without peaks. */
export function waveBars(values: readonly number[] | undefined, n: number): number[] {
  const out: number[] = [];
  if (n <= 0) return out;
  if (!values || values.length === 0) {
    for (let i = 0; i < n; i++) out.push(0.3 + Math.abs(Math.sin(i * 0.7)) * 0.45);
    return out;
  }
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * values.length) / n);
    const b = Math.max(a + 1, Math.floor(((i + 1) * values.length) / n));
    let m = 0;
    for (let j = a; j < b && j < values.length; j++) m = Math.max(m, values[j]!);
    out.push(Math.max(0.12, Math.min(1, m)));
  }
  return out;
}

/** Amplitude 0..1 at time t from peaks (for the orb ring). */
export function ampAt(peaks: { hz: number; values: readonly number[] } | undefined, t: number): number {
  if (!peaks || !peaks.values.length) return 0;
  const i = Math.min(peaks.values.length - 1, Math.max(0, Math.floor((t / 1000) * peaks.hz)));
  return peaks.values[i] ?? 0;
}

export interface WrapSegment { node: number; start: number; end: number; id: string }

/**
 * Plan the <span class="s" data-s=id> wraps for sentences inside a run of text nodes.
 * texts: the text node contents in document order; sentences: {id, text} in reading order.
 * Returns per-node [start, end) slices; a sentence crossing element boundaries (e.g. into <b>) yields
 * several segments with the same id. Sentences that cannot be found are skipped (never a wrong wrap).
 */
export function planWraps(texts: readonly string[], sentences: readonly { id: string; text: string }[]): WrapSegment[] {
  const starts: number[] = [];
  let hay = '';
  for (const t of texts) { starts.push(hay.length); hay += t; }
  const ranges = sentenceRanges(hay, sentences.map(s => s.text));
  const out: WrapSegment[] = [];
  ranges.forEach((r, k) => {
    if (!r) return;
    const [a, b] = r;
    for (let i = 0; i < texts.length; i++) {
      const s = starts[i]!;
      const e = s + texts[i]!.length;
      if (e <= a || s >= b) continue;
      const from = Math.max(a, s) - s;
      const to = Math.min(b, e) - s;
      if (to > from && texts[i]!.slice(from, to).trim()) out.push({ node: i, start: from, end: to, id: sentences[k]!.id });
    }
  });
  return out;
}

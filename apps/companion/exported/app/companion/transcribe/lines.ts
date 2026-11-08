/**
 * The arithmetic of a transcript, apart from the model so it can be checked
 * without one (scripts/check-transcript.ts).
 *
 * The desktop recorder cuts the sound into `speech-<ms>.webm` files of under
 * 30 seconds (recorder.ts). Each is transcribed alone, and Whisper's times are
 * from the start of that cut, so a line's place in the lecture is the cut's
 * start plus Whisper's time.
 */
import type { TranscriptLine } from '../types'

/** "speech-84000.webm" starts 84 s into the recording (written by recorder.ts). */
export const SPEECH_FILE = /^speech-(\d+)\.webm$/

/** What the speech pipeline returns per stretch of speech, in seconds from the cut's start. */
export interface WhisperChunk {
  text: string
  timestamp: [number, number | null]
}

export interface SpeechCut {
  name: string
  start_ms: number
}

/** Under this loudness (root mean square of the samples) a cut is taken as silence. */
export const SILENCE = 0.002

/** The cuts of a recording, in the order they were said. */
export function speechCuts(names: string[]): SpeechCut[] {
  return names
    .map((name) => ({ name, m: SPEECH_FILE.exec(name) }))
    .filter((x): x is { name: string; m: RegExpExecArray } => x.m !== null)
    .map(({ name, m }) => ({ name, start_ms: Number(m[1]) }))
    .sort((a, b) => a.start_ms - b.start_ms)
}

/** The cuts still to do, once the transcript reaches `doneS` (a run that was stopped carries on there). */
export function cutsAfter(cuts: SpeechCut[], doneS: number): SpeechCut[] {
  return cuts.filter((c) => c.start_ms / 1000 >= doneS - 0.5)
}

/** Where the transcript reaches once a cut is done: the next cut's start, or the end of the recording. */
export function reachAfter(cuts: SpeechCut[], index: number, durationS: number): number {
  const next = cuts[index + 1]
  return next ? round(next.start_ms / 1000) : durationS
}

const round = (s: number) => Math.round(s * 10) / 10

/** One cut's chunks as lines of the whole recording. `cutS` closes a last chunk Whisper left open. */
export function linesFromCut(chunks: WhisperChunk[], offsetS: number, cutS: number): TranscriptLine[] {
  const lines: TranscriptLine[] = []
  for (const chunk of chunks) {
    const text = chunk.text.replace(/\s+/g, ' ').trim()
    if (!text) continue
    const start = round(offsetS + Math.max(0, chunk.timestamp[0] ?? 0))
    const end = round(offsetS + (chunk.timestamp[1] ?? cutS))
    lines.push({ start, end: Math.max(start, end), text })
  }
  return lines
}

/** The transcript as plain text for `items.preview`, which Notes' search reads; the server keeps 5,000 characters. */
export function transcriptPreview(lines: TranscriptLine[]): string {
  return lines.map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim().slice(0, 5000)
}

/** The transcript as text for an answer box: one paragraph, as it was said. */
export function transcriptText(lines: TranscriptLine[]): string {
  return lines.map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim()
}

/** How loud the samples are. */
export function rms(samples: Float32Array): number {
  if (!samples.length) return 0
  let sum = 0
  for (const s of samples) sum += s * s
  return Math.sqrt(sum / samples.length)
}

/** One channel out of several, averaged: Whisper hears mono. */
export function mono(channels: Float32Array[]): Float32Array {
  if (channels.length <= 1) return channels[0] ?? new Float32Array(0)
  const out = new Float32Array(channels[0]!.length)
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i]! += (ch[i] ?? 0) / channels.length
  return out
}

/**
 * Transcripts written on this computer: the desktop app only, and free,
 * because nothing leaves the machine. Phones
 * and the web record without one, for now.
 *
 * Record first, transcribe after: a recording is never slowed by its
 * transcript, and a two-hour lecture on a weak laptop can take as long as the
 * lecture did. So it runs afterwards, one recording at a time, through the
 * recording's speech cuts (recorder.ts) in order:
 *
 *   fetch the cut from the recordings folder → decode it to 16 kHz mono →
 *   skip it if it's silence (Whisper invents a sentence for silence) →
 *   Whisper in the worker → lines at their place in the recording
 *
 * Every few minutes of sound it saves what it has into the item
 * (`meta.transcript`, `meta.transcribed_s`, and `preview` for search), so
 * a run stopped by Stop, a crash or closing the app carries on there.
 *
 * The speech model is downloaded only after the learner agrees, with its
 * size said first (`modelMb`), and kept in the browser cache. Once they have
 * agreed, each new recording is transcribed when it stops.
 */
import { reactive } from 'vue'
import type { CompanionStore } from '../store'
import type { Item, TranscriptLine } from '../types'
import { usePlatform } from '../platform'
import { MODEL_MB, type FromWorker, type SpeechDevice, type ToWorker } from './model'
import { SILENCE, cutsAfter, linesFromCut, mono, reachAfter, rms, speechCuts, transcriptPreview, type WhisperChunk } from './lines'

export { transcriptText } from './lines'

const AGREED = 'bm:transcribe'
const RATE = 16_000
/** Saved every six cuts, about three minutes of sound. */
const SAVE_EVERY = 6
const STOPPED = 'stopped'

export interface TranscriptJob {
  /** `waiting` for another recording's transcript; `model` while the speech model downloads or loads. */
  stage: 'waiting' | 'model' | 'writing'
  /** Bytes of the model downloaded so far, and in all (0 when it was already here). */
  loaded: number
  total: number
  /** Seconds of the recording transcribed, and its length. */
  done_s: number
  total_s: number
  /** Why it stopped, when it failed. */
  error: string | null
}

/** The transcripts being written, by recording id, for the screens that show them. */
export const jobs = reactive<Record<string, TranscriptJob>>({})

/** The transcriber on this computer: what it would run on, and whether its model is here already. */
export const speech = reactive({ known: false, device: 'wasm' as SpeechDevice, cached: false })

/** How big the download is, in MB, for the words before the learner agrees. */
export function modelMb(): number {
  return MODEL_MB[speech.device]
}

export function agreed(): boolean {
  try {
    return localStorage.getItem(AGREED) === '1' || speech.cached
  } catch {
    return speech.cached
  }
}

function agree(): void {
  try {
    localStorage.setItem(AGREED, '1')
  } catch {
    // without storage it asks again next time, which is the safe side
  }
}

/* -- The worker ------------------------------------------------------------- */

let worker: Worker | null = null
let next = 0
const waiting = new Map<string, { resolve: (m: FromWorker) => void; reject: (e: Error) => void }>()
let onProgress: ((loaded: number, total: number) => void) | null = null

function failAll(message: string): void {
  for (const w of waiting.values()) w.reject(new Error(message))
  waiting.clear()
}

function connect(): Worker {
  if (worker) return worker
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  w.onmessage = (event: MessageEvent<FromWorker>) => {
    const m = event.data
    if (m.type === 'progress') {
      onProgress?.(m.loaded, m.total)
      return
    }
    const key = m.type === 'status' ? 'status' : m.type === 'ready' || (m.type === 'error' && m.id === null) ? 'load' : `run:${m.id}`
    const w8 = waiting.get(key)
    waiting.delete(key)
    if (m.type === 'error') w8?.reject(new Error(m.message))
    else w8?.resolve(m)
  }
  // The worker died (out of memory, most likely): every call waiting on it fails, and the next one starts afresh.
  w.onerror = () => {
    worker = null
    loading = null
    failAll('The transcriber stopped. Closing other apps can help on a computer short of memory.')
  }
  worker = w
  return w
}

function call(message: ToWorker, key: string, transfer: Transferable[] = []): Promise<FromWorker> {
  const w = connect()
  return new Promise((resolve, reject) => {
    waiting.set(key, { resolve, reject })
    w.postMessage(message, transfer)
  })
}

let checking: Promise<void> | null = null
let loading: Promise<void> | null = null

/**
 * Download (the first time) and load the speech model. Shared, so a model
 * fetched while a teach-back is being spoken is the one its transcript uses.
 * Calling it is agreeing to the download.
 */
export function prepareSpeech(): Promise<void> {
  agree()
  loading ??= call({ type: 'load' }, 'load').then(
    () => {
      speech.cached = true
    },
    (error: unknown) => {
      loading = null
      throw error
    },
  )
  return loading
}

/** Find out the device and whether the model is here, once per session (for the size and the "agree" step). */
export function checkSpeech(): Promise<void> {
  checking ??= call({ type: 'status' }, 'status')
    .then((m) => {
      if (m.type !== 'status') return
      Object.assign(speech, { known: true, device: m.device, cached: m.cached })
    })
    .catch(() => {
      checking = null
    })
  return checking
}

/* -- One recording ---------------------------------------------------------- */

/** 16 kHz mono from a cut. An OfflineAudioContext decodes at its own rate, so this resamples too; it is never started. */
async function decode(url: string): Promise<Float32Array> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('A part of the recording is missing on this computer.')
  const buffer = await new OfflineAudioContext(1, 1, RATE).decodeAudioData(await response.arrayBuffer())
  return mono(Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i)))
}

let running: string | null = null
let queue: Promise<unknown> = Promise.resolve()
const stopped = new Set<string>()

/**
 * Transcribe the recording `id` kept on this computer, from `fromS` seconds
 * on. `save` gets every new line so far, and how far that reaches, every few
 * cuts and at the end. Resolves with the new lines; rejects with the reason
 * (`STOPPED` when the learner stopped it). One recording at a time.
 */
function transcribe(
  id: string,
  totalS: number,
  fromS = 0,
  save: (lines: TranscriptLine[], reachS: number) => Promise<void> = async () => {},
): Promise<TranscriptLine[]> {
  agree()
  stopped.delete(id)
  jobs[id] = { stage: 'waiting', loaded: 0, total: 0, done_s: fromS, total_s: totalS, error: null }
  // Held, not looked up: a Stop takes it off `jobs`, and the run then only has to notice.
  const j = jobs[id]!
  const job = async (): Promise<TranscriptLine[]> => {
    const files = usePlatform().recordings
    if (!files) throw new Error('Transcripts are written in the BiliMind app for your computer.')
    if (stopped.has(id)) throw new Error(STOPPED)
    running = id
    const cuts = speechCuts((await files.files(id)).map((f) => f.name))
    if (!cuts.length) throw new Error('This recording has no sound on this computer to write down.')

    j.stage = 'model'
    onProgress = (loaded, total) => Object.assign(j, { loaded, total })
    await prepareSpeech()
    j.stage = 'writing'

    const lines: TranscriptLine[] = []
    const todo = cutsAfter(cuts, fromS)
    for (const [k, cut] of todo.entries()) {
      if (stopped.has(id)) throw new Error(STOPPED)
      const audio = await decode(files.url(id, cut.name))
      if (rms(audio) >= SILENCE) {
        const n = ++next
        const lengthS = audio.length / RATE
        const reply = await call({ type: 'run', id: n, audio }, `run:${n}`, [audio.buffer])
        const chunks: WhisperChunk[] = reply.type === 'result' ? reply.chunks : []
        lines.push(...linesFromCut(chunks, cut.start_ms / 1000, lengthS))
      }
      const reach = reachAfter(cuts, cuts.indexOf(cut), totalS)
      j.done_s = reach
      if ((k + 1) % SAVE_EVERY === 0 || k === todo.length - 1) await save(lines, reach)
    }
    return lines
  }
  const done = queue.then(job).finally(() => {
    if (running === id) running = null
    onProgress = null
  })
  queue = done.catch(() => undefined)
  return done
}

/** Stop a transcript: one waiting simply never starts; the one running ends now (the model stays cached). */
export function stopTranscript(id: string): void {
  stopped.add(id)
  delete jobs[id]
  if (running !== id) return
  worker?.terminate()
  worker = null
  loading = null
  failAll(STOPPED)
}

/**
 * Write a recording item's transcript into it, carrying on from where an
 * earlier run stopped. The failure stays on `jobs[id].error` for the screen
 * to show with Try again; a stop leaves no trace.
 */
export async function transcribeItem(store: CompanionStore, itemId: string): Promise<void> {
  const item = store.get('items', itemId)
  // one run per recording; a failed one can be tried again
  const was = jobs[itemId]
  if (!item || (was && !was.error)) return
  const kept = item.meta.transcript ?? []
  try {
    await transcribe(itemId, item.meta.duration_s ?? 0, item.meta.transcribed_s ?? 0, async (lines, reach) => {
      const row = store.get('items', itemId)
      if (!row) return
      const all = [...kept, ...lines]
      await store.upsert<Item>('items', {
        id: itemId,
        preview: transcriptPreview(all) || row.preview,
        meta: { ...row.meta, transcript: all, transcribed_s: reach },
      })
    })
    delete jobs[itemId]
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const j = jobs[itemId]
    if (message === STOPPED || !j) delete jobs[itemId]
    else j.error = message
  }
}

/** The words of a short recording (a teach-back said out loud), with no item behind it. */
export async function transcribeWords(id: string, totalS: number): Promise<TranscriptLine[]> {
  try {
    return await transcribe(id, totalS)
  } finally {
    delete jobs[id]
  }
}

/** Whether a failure is the learner's own Stop, which needs no words. */
export function wasStopped(error: unknown): boolean {
  return error instanceof Error && error.message === STOPPED
}

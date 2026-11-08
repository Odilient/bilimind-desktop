/**
 * The recorder on the web and the desktop: MediaRecorder behind the same
 * Record screen and pill as the phone's native recorder (native/recorder.ts).
 *
 * What it records: the microphone, what the computer plays (an online
 * lecture), a screen or window the learner picked (desktop), or a mix. Two
 * sound sources become one track through an AudioContext that is never
 * connected to the speakers, because MediaRecorder records only the first
 * audio track it is given; nothing here is ever heard.
 *
 * Where it goes:
 *  - the desktop writes every chunk to disk as it comes (`platform.recordings`,
 *    a few seconds each), so a two-hour lecture never sits in memory and a
 *    crash loses seconds, not the lecture. Screen recordings stay there; they
 *    are never uploaded (wave4.md). Beside the recording it writes the sound
 *    again in cuts of under 30 seconds, `speech-<ms>.webm`, for the on-device
 *    transcriber (transcribe/): Whisper reads 30-second windows, and a cut that
 *    decodes on its own is the only way to transcribe a long lecture on a weak
 *    laptop without decoding the whole of it into memory first.
 *  - the web keeps the chunks in memory and hands back one Blob, which
 *    recording.ts uploads like any file.
 *
 * One recording at a time, held here (not in a component), so it keeps going
 * while the learner moves around the app and the pill can show it.
 */
import { reactive } from 'vue'
import { PlatformError, usePlatform, type DeviceRecordings } from './platform'

export type RecordSource = 'mic' | 'system' | 'screen'

export interface RecordStart {
  /** The id of the item it becomes, and its folder on the desktop. */
  id: string
  /** Shown on the pill and the sheet: "Databases · Lecture 8". */
  label: string
  mic: boolean
  /** What the computer plays (with a screen: its sound). */
  system: boolean
  /** A source from `platform.screenSources()`; desktop only. */
  screen: string | null
  /**
   * False when only the words are wanted (a teach-back said out loud): no
   * recording to keep, only the speech cuts for the transcriber.
   */
  keep: boolean
  /** Anything the caller needs back when it stops, such as where to file it. */
  meta?: Record<string, unknown>
  /**
   * Whose it is: the Record sheet's (shown on the pill, reopened by it) or a
   * teach-back's, which its own question controls and the pill leaves alone.
   */
  owner: 'sheet' | 'aloud'
  /** Called when the recording has to end by itself: the share was stopped from the system's bar, the disk is full. */
  onEnded?: (problem: string | null) => void
}

export interface Recorded {
  id: string
  duration_s: number
  mime: string
  screen: boolean
  /** The web's recording, to upload; null on the desktop, where it is on disk already. */
  blob: Blob | null
  /** Speech cuts were written, so the transcriber can run on it. */
  speech: boolean
  meta: Record<string, unknown>
  /** Why it ended early, when it did (what was saved until then is still here). */
  problem: string | null
}

/** The file a recording plays from, on the desktop; the speech cuts beside it are `speech-<ms>.webm` (transcribe/lines.ts). */
export const MEDIA_FILE = 'media.webm'

/** Under Whisper's 30-second window, with room for the half-second tick. */
const CUT_MS = 28_000
const VIDEO_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
// Safari records mp4 and Firefox ogg; the server takes both (AttachmentStore's mimes).
const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

/** The recording in progress, for the sheet and the pill. `id` is null when nothing is recording. */
export const live = reactive({
  id: null as string | null,
  label: '',
  source: 'mic' as RecordSource,
  owner: 'sheet' as RecordStart['owner'],
  paused: false,
  /** Recorded time before the current stretch, pauses excluded. */
  banked: 0,
  /** `Date.now()` when the current stretch began; 0 while paused. */
  since: 0,
  meta: {} as Record<string, unknown>,
})

/** What "Record screen" asked for: the menu only opens the Record sheet, which reads this once as it opens. */
let asked: RecordSource | null = null

export function askFor(source: RecordSource): void {
  asked = source
}

export function takeAsked(): RecordSource | null {
  const source = asked
  asked = null
  return source
}

/** Recorded time now, pauses excluded. */
export function elapsedMs(now = Date.now()): number {
  return live.banked + (live.since ? now - live.since : 0)
}

// Not reactive: the machinery behind `live`.
let media: MediaRecorder | null = null
let speech: MediaRecorder | null = null
let speechStream: MediaStream | null = null
let speechAt = 0
let tracks: MediaStreamTrack[] = []
let mixer: AudioContext | null = null
let ticker: ReturnType<typeof setInterval> | undefined
let files: DeviceRecordings | null = null
let writes: Promise<void> = Promise.resolve()
let problem: string | null = null
let chunks: Blob[] = []
let screen = false
let ending: RecordStart['onEnded']

function pickType(types: string[]): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

async function microphone(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new PlatformError('unsupported', 'This browser can’t use the microphone.')
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
  } catch (error) {
    const name = (error as DOMException)?.name
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new PlatformError(
        'denied',
        'BiliMind needs the microphone to record. Allow it in the browser or the computer’s privacy settings, then try again.',
      )
    }
    throw new PlatformError('failed', 'No microphone answered. Check that one is plugged in and not in use.')
  }
}

/** One audio track out of several, mixed where it is never heard. */
function mix(sound: MediaStreamTrack[]): MediaStreamTrack | null {
  if (sound.length <= 1) return sound[0] ?? null
  mixer = new AudioContext()
  // Electron lets an AudioContext run without a gesture; a browser tab has had the Record press.
  void mixer.resume()
  const out = mixer.createMediaStreamDestination()
  for (const track of sound) mixer.createMediaStreamSource(new MediaStream([track])).connect(out)
  return out.stream.getAudioTracks()[0] ?? null
}

/** Keep a chunk: on disk in order on the desktop, in memory on the web. */
function keep(id: string, name: string, blob: Blob): void {
  if (!blob.size) return
  if (!files) {
    chunks.push(blob)
    return
  }
  const disk = files
  writes = writes.then(async () => {
    if (problem) return
    try {
      await disk.append(id, name, new Uint8Array(await blob.arrayBuffer()))
    } catch (error) {
      problem = error instanceof Error ? error.message : 'The recording couldn’t be saved.'
      ending?.(problem)
    }
  })
}

/** A fresh speech cut, named by where it starts in the recording. */
function cut(id: string): void {
  if (!speechStream) return
  const at = Math.round(elapsedMs())
  const type = pickType(AUDIO_TYPES)
  const r = new MediaRecorder(speechStream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32_000 })
  r.ondataavailable = (e) => keep(id, `speech-${at}.webm`, e.data)
  r.start()
  speech = r
  speechAt = at
}

/** Wait for a recorder's last chunk: `stop` fires after the final `dataavailable`. */
function finish(r: MediaRecorder | null): Promise<void> {
  if (!r || r.state === 'inactive') return Promise.resolve()
  return new Promise((resolve) => {
    r.addEventListener('stop', () => resolve(), { once: true })
    r.stop()
  })
}

function release(): void {
  clearInterval(ticker)
  ticker = undefined
  for (const track of tracks) track.stop()
  tracks = []
  void mixer?.close().catch(() => undefined)
  mixer = null
  speechStream = null
}

/**
 * Start recording. Rejects with a PlatformError whose message can be shown
 * as it is (no microphone, permission refused, the share cancelled).
 */
export async function startRecording(o: RecordStart): Promise<void> {
  if (live.id) throw new PlatformError('busy', 'Something is already being recorded.')
  if (typeof MediaRecorder === 'undefined') throw new PlatformError('unsupported', 'This browser can’t record.')
  const platform = usePlatform()
  const got: MediaStream[] = []
  try {
    if (o.screen) got.push(await platform.captureScreen(o.screen, o.system))
    else if (o.system) got.push(await platform.captureSystemAudio())
    if (o.mic) got.push(await microphone())
  } catch (error) {
    for (const s of got) s.getTracks().forEach((t) => t.stop())
    throw error
  }

  tracks = got.flatMap((s) => s.getTracks())
  const video = got.flatMap((s) => s.getVideoTracks())
  const audio = mix(got.flatMap((s) => s.getAudioTracks()))
  if (!audio && !video.length) {
    release()
    throw new PlatformError('no-audio', 'There was no sound to record.')
  }

  files = platform.recordings
  writes = Promise.resolve()
  problem = null
  chunks = []
  screen = video.length > 0
  ending = o.onEnded
  Object.assign(live, {
    id: o.id,
    label: o.label,
    source: o.screen ? 'screen' : o.system ? 'system' : 'mic',
    owner: o.owner,
    paused: false,
    banked: 0,
    since: Date.now(),
    meta: o.meta ?? {},
  })

  try {
    if (o.keep) {
      const type = pickType(screen ? VIDEO_TYPES : AUDIO_TYPES)
      media = new MediaRecorder(new MediaStream([...video, ...(audio ? [audio] : [])]), {
        ...(type ? { mimeType: type } : {}),
        // Speech needs little: 48 kbps Opus is about 22 MB an hour, so a long lecture fits the upload limit.
        audioBitsPerSecond: 48_000,
        // Two frames a second of slides and a board: ~300 kbps keeps text sharp at ~135 MB an hour.
        ...(screen ? { videoBitsPerSecond: 300_000 } : {}),
      })
      media.ondataavailable = (e) => keep(o.id, MEDIA_FILE, e.data)
      media.onerror = () => ending?.('The recording stopped by itself.')
      media.start(4000)
    }
    // Only the desktop transcribes, so only the desktop cuts the sound for it.
    if (files && audio) {
      speechStream = new MediaStream([audio])
      cut(o.id)
      ticker = setInterval(() => {
        if (!live.paused && elapsedMs() - speechAt >= CUT_MS) {
          const done = speech
          cut(o.id)
          done?.stop()
        }
      }, 500)
    }
  } catch {
    release()
    live.id = null
    throw new PlatformError('failed', 'The recorder didn’t start. Try again in a moment.')
  }

  // The share stopped from the system's own bar, or the microphone unplugged: end it, keeping what there is.
  for (const track of tracks) track.addEventListener('ended', () => ending?.(null), { once: true })
}

export function pauseRecording(): void {
  if (!live.id || live.paused) return
  media?.pause()
  speech?.pause()
  live.banked = elapsedMs()
  live.since = 0
  live.paused = true
}

export function resumeRecording(): void {
  if (!live.id || !live.paused) return
  media?.resume()
  speech?.resume()
  live.since = Date.now()
  live.paused = false
}

/** Stop, wait for the last chunk to be kept, and say what was made. Null when nothing was recording. */
export async function stopRecording(): Promise<Recorded | null> {
  const id = live.id
  if (!id) return null
  ending = undefined
  const duration = Math.round(elapsedMs() / 1000)
  clearInterval(ticker)
  const type = media?.mimeType || pickType(screen ? VIDEO_TYPES : AUDIO_TYPES) || (screen ? 'video/webm' : 'audio/webm')
  await Promise.all([finish(media), finish(speech)])
  release()
  await writes
  const done: Recorded = {
    id,
    duration_s: duration,
    mime: type.split(';')[0]!,
    screen,
    blob: !files && chunks.length ? new Blob(chunks, { type: type.split(';')[0] }) : null,
    speech: Boolean(files && speech),
    meta: live.meta,
    problem,
  }
  media = null
  speech = null
  chunks = []
  Object.assign(live, { id: null, label: '', paused: false, banked: 0, since: 0, meta: {} })
  return done
}

/** Throw away what a recording left on this computer (a teach-back once its words are in the box). */
export async function discardRecording(id: string): Promise<void> {
  await usePlatform().recordings?.remove(id).catch(() => undefined)
}

/**
 * The lecture recorder on the phone: a thin typed door onto the native
 * `Recorder` plugin (`native/recorder`, Kotlin; the Swift side is a stub).
 *
 * The native side owns the recording. JavaScript is suspended when the app
 * leaves the screen and the WebView can be killed outright, so nothing here
 * keeps time or files: the UI asks `getState()` whenever it shows up (mount,
 * app resume) and draws what the native manifest says. A recording started
 * before a reload, or before the app was killed, is still the live one.
 *
 * Off the native shell (web, desktop) `recorderAvailable()` is false and the
 * caller falls back to whatever it does there.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { App } from '@capacitor/app'
import { Capacitor, registerPlugin } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'

export interface RecorderSegment {
  index: number
  /** Absolute path of a finished `.m4a` in the app's data folder. */
  path: string
  startedAt: string
  /** Recorded time in this segment, pauses excluded. */
  durationMs: number
  bytes: number
  /** The recorder was restarted before this one; a fraction of a second is missing. */
  gapBefore: boolean
}

export type RecorderStatus = 'idle' | 'recording' | 'paused' | 'stopped' | 'interrupted'

export interface RecorderState {
  /** True while the session is live, paused included. */
  recording: boolean
  paused: boolean
  /** `interrupted`: the recorder died (a crash, a force stop); finished segments were kept. */
  status: RecorderStatus
  sessionId: string | null
  title?: string | null
  startedAt?: string
  stoppedAt?: string | null
  elapsedMs: number
  segmentSeconds?: number
  /** The recording's folder, and its manifest.json. */
  dir?: string
  manifest?: string
  format?: { mime: string; codec: string; channels: number; sampleRate: number; bitrate: number }
  /** Finished segments only; the one being written joins when it is done. */
  segments: RecorderSegment[]
  error?: string | null
  /** What `start` was given as `meta`, kept in the native manifest. */
  meta?: Record<string, unknown> | null
}

export interface RecorderStartOptions {
  /** Names the recording's folder; reuse it to continue a lost recording. */
  sessionId: string
  /** Target segment length. Default 60. Real lengths follow the bitrate, a few seconds either side. */
  segmentSeconds?: number
  /** The notification's title, e.g. "Databases · Lecture 8". */
  title?: string
  /** AAC bitrate, default 64000 (about 29 MB an hour). */
  bitrate?: number
  sampleRate?: number
  /**
   * Anything the UI needs to file the recording later (the course, the
   * class), stored natively with the audio and returned by `getState()`, so it
   * survives the WebView's storage being cleared. A JSON object.
   */
  meta?: Record<string, unknown>
}

export type RecorderPermission = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'

export interface RecorderPermissions {
  microphone: RecorderPermission
  notifications: RecorderPermission
}

/** Rejections carry one of these as `code`. */
export type RecorderErrorCode =
  | 'invalid'
  | 'busy'
  | 'permission-denied'
  | 'not-allowed'
  | 'mic-unavailable'
  | 'storage-full'
  | 'timeout'
  | 'failed'

export interface RecorderPlugin {
  /** Asks for the microphone (and, on Android 13+, notifications) if needed, then starts. */
  start(options: RecorderStartOptions): Promise<RecorderState>
  stop(): Promise<RecorderState>
  pause(): Promise<RecorderState>
  resume(): Promise<RecorderState>
  /** The live recording, else the last one; or the one named. Never rejects. */
  getState(options?: { sessionId?: string }): Promise<RecorderState>
  /** One-tap delete of a recording that is not live. */
  discard(options: { sessionId: string }): Promise<void>
  checkPermissions(): Promise<RecorderPermissions>
  requestPermissions(): Promise<RecorderPermissions>
  addListener(event: 'state', cb: (state: RecorderState) => void): Promise<PluginListenerHandle>
  addListener(
    event: 'segment',
    cb: (e: { sessionId: string; segment: RecorderSegment; state: RecorderState }) => void,
  ): Promise<PluginListenerHandle>
  addListener(event: 'error', cb: (e: { code: string; message: string }) => void): Promise<PluginListenerHandle>
}

export const Recorder = registerPlugin<RecorderPlugin>('Recorder')

export function recorderAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Recorder')
}

/** A URL the WebView can load a segment from (to play it back, or to upload it with fetch). */
export function segmentUrl(segment: RecorderSegment): string {
  return Capacitor.convertFileSrc(segment.path)
}

/**
 * The recorder as reactive state for a component. Re-attaches on mount and
 * every time the app comes back to the front, and follows the native events
 * in between. Off the native shell `available` is false and nothing runs.
 */
export function useNativeRecorder() {
  const available = recorderAvailable()
  const state = ref<RecorderState | null>(null)
  /** `Date.now()` when `state` arrived, so a timer can count on from `elapsedMs`. */
  let receivedAt = 0
  const handles: Promise<PluginListenerHandle>[] = []

  function take(next: RecorderState): RecorderState {
    state.value = next
    receivedAt = Date.now()
    return next
  }

  async function refresh(): Promise<RecorderState | null> {
    if (!available) return null
    return take(await Recorder.getState())
  }

  async function run(action: () => Promise<RecorderState>): Promise<RecorderState> {
    return take(await action())
  }

  /** Recorded time now, for a ticking clock; no native call. */
  function elapsedNow(now = Date.now()): number {
    const s = state.value
    if (!s) return 0
    return s.recording && !s.paused ? s.elapsedMs + (now - receivedAt) : s.elapsedMs
  }

  onMounted(() => {
    if (!available) return
    void refresh()
    handles.push(Recorder.addListener('state', (s) => take(s)))
    handles.push(Recorder.addListener('segment', (e) => take(e.state)))
    handles.push(App.addListener('resume', () => void refresh()))
  })

  onBeforeUnmount(() => {
    for (const h of handles) void h.then((x) => x.remove())
    handles.length = 0
  })

  return {
    available,
    state,
    elapsedNow,
    refresh,
    start: (options: RecorderStartOptions) => run(() => Recorder.start(options)),
    stop: () => run(() => Recorder.stop()),
    pause: () => run(() => Recorder.pause()),
    resume: () => run(() => Recorder.resume()),
    discard: (sessionId: string) => Recorder.discard({ sessionId }),
  }
}

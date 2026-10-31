/**
 * Narration, spoken by the server's Edge TTS (`POST /audio/tts`).
 *
 * The heavy part — turning text into an audio file — is cached module-wide by
 * what was said and in which voice, so re-opening a lesson or nudging the
 * scrubber never re-bills the same sentence. The light part — one `<audio>`
 * element and its play/scrub state — is per caller, because two players on a
 * page must not share a playhead.
 */

export interface TtsRequest {
  /** Free text to speak. Omit when narrating a whole lesson by `nodeId`. */
  text?: string
  /** Speak the assembled lesson for this node instead of raw text. */
  nodeId?: number
  voice?: string
  language?: string
}

export interface TtsResult {
  url: string
  seconds: number
  voice: string
  cached: boolean
}

export interface TtsVoice {
  value: string
  label: string
  language?: string
}

/* -------------------------------------------------------------------------- */
/* Module-level caches (shared across every player)                           */
/* -------------------------------------------------------------------------- */

const clipCache = new Map<string, TtsResult>()
let voicesCache: TtsVoice[] | null = null

function hash(text: string): string {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0
  return String(h >>> 0)
}

function cacheKey(req: TtsRequest): string {
  const subject = req.nodeId != null ? `node:${req.nodeId}` : `text:${hash(req.text ?? '')}`
  return `${subject}|${req.voice ?? ''}|${req.language ?? ''}`
}

interface VoiceRow {
  id?: string
  value?: string
  name?: string
  short_name?: string
  label?: string
  title?: string
  language?: string
  locale?: string
}

function normaliseVoice(row: VoiceRow | string): TtsVoice | null {
  if (typeof row === 'string') return { value: row, label: row }
  const value = row.value ?? row.id ?? row.short_name ?? row.name
  if (!value) return null
  return {
    value,
    label: row.label ?? row.title ?? row.name ?? value,
    language: row.language ?? row.locale,
  }
}

export function useAudio() {
  const api = useApi()

  const el = ref<HTMLAudioElement | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const playing = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const voice = ref<string | null>(null)
  /** True once a clip has been resolved and attached to the element. */
  const ready = ref(false)

  /** The key currently loaded into the element, so we only reload on change. */
  let loadedKey: string | null = null

  function ensureEl(): HTMLAudioElement | null {
    if (!import.meta.client) return null
    if (el.value) return el.value

    const audio = new Audio()
    audio.preload = 'metadata'
    audio.addEventListener('timeupdate', () => {
      currentTime.value = audio.currentTime
    })
    audio.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(audio.duration)) duration.value = audio.duration
    })
    audio.addEventListener('play', () => {
      playing.value = true
    })
    audio.addEventListener('pause', () => {
      playing.value = false
    })
    audio.addEventListener('ended', () => {
      playing.value = false
      currentTime.value = 0
    })
    audio.addEventListener('error', () => {
      error.value = 'The narration could not be played.'
      playing.value = false
    })
    el.value = audio
    return audio
  }

  /** The catalogue of voices, fetched once and shared. */
  async function voices(): Promise<TtsVoice[]> {
    if (voicesCache) return voicesCache
    try {
      const raw = await api.get<VoiceRow[] | { voices?: VoiceRow[] }>('/audio/voices')
      const rows = Array.isArray(raw) ? raw : (raw.voices ?? [])
      voicesCache = rows.map(normaliseVoice).filter((v): v is TtsVoice => v !== null)
    } catch {
      voicesCache = []
    }
    return voicesCache
  }

  /** Resolve (and cache) the clip for a request, without touching playback. */
  async function synthesize(req: TtsRequest): Promise<TtsResult> {
    const key = cacheKey(req)
    const hit = clipCache.get(key)
    if (hit) return hit

    const result = await api.post<TtsResult>('/audio/tts', {
      text: req.text,
      node_id: req.nodeId,
      voice: req.voice,
      language: req.language,
    })
    clipCache.set(key, result)
    return result
  }

  /** Load the clip into the element if the request differs from what's loaded. */
  async function ensureSource(req: TtsRequest): Promise<HTMLAudioElement | null> {
    const audio = ensureEl()
    if (!audio) return null

    const key = cacheKey(req)
    if (loadedKey === key && ready.value) return audio

    loading.value = true
    error.value = null
    try {
      const clip = await synthesize(req)
      voice.value = clip.voice
      if (clip.seconds > 0) duration.value = clip.seconds
      audio.src = clip.url
      audio.currentTime = 0
      currentTime.value = 0
      loadedKey = key
      ready.value = true
      return audio
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Narration is unavailable right now.'
      ready.value = false
      loadedKey = null
      return null
    } finally {
      loading.value = false
    }
  }

  async function play(req: TtsRequest): Promise<void> {
    const audio = await ensureSource(req)
    if (!audio) return
    try {
      await audio.play()
    } catch {
      /* Autoplay/gesture rejections surface as a paused state, not an error. */
    }
  }

  function pause(): void {
    el.value?.pause()
  }

  /** Toggle play/pause for the given request, loading it the first time. */
  async function toggle(req: TtsRequest): Promise<void> {
    const audio = ensureEl()
    if (audio && playing.value && loadedKey === cacheKey(req)) {
      audio.pause()
      return
    }
    await play(req)
  }

  function seek(seconds: number): void {
    const audio = el.value
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(seconds, duration.value || seconds))
    currentTime.value = audio.currentTime
  }

  /** A fresh request must reload before it plays. */
  function invalidate(): void {
    loadedKey = null
    ready.value = false
    if (el.value) {
      el.value.pause()
      el.value.removeAttribute('src')
    }
    playing.value = false
    currentTime.value = 0
    duration.value = 0
  }

  if (import.meta.client && getCurrentScope()) {
    onScopeDispose(() => {
      if (el.value) {
        el.value.pause()
        el.value.src = ''
        el.value = null
      }
    })
  }

  return {
    loading,
    error,
    playing,
    currentTime,
    duration,
    voice,
    ready,
    voices,
    synthesize,
    play,
    pause,
    toggle,
    seek,
    invalidate,
  }
}

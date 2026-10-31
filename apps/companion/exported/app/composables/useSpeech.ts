/**
 * Speech IN — the learner talks and we turn it into text, then score it.
 *
 * Hybrid by design. When the browser has the Web Speech API (Chrome, Edge, most
 * Android WebViews) recognition happens ON DEVICE with no upload and no server
 * cost. Otherwise (Safari, iOS, some WebViews) we record with MediaRecorder and
 * POST the clip to `/speech/transcribe`, which runs a server-side Whisper — and if
 * that isn't installed either, the caller degrades to "type your reply".
 *
 * Pronunciation scoring is deliberately client-side: an instant, free, offline
 * word-level alignment between what the learner was asked to say and what came
 * back. Only the optional one-line "why?" tip touches the server ({@link coach}).
 */

import { ApiError } from '~/composables/useApi'

interface StartOptions {
  /** Target-language tag or code, e.g. "fr" or "fr-FR". */
  language?: string
}

export interface WordScore {
  word: string
  ok: boolean
}

export interface PronunciationScore {
  /** 0–100, share of the target that came through. */
  score: number
  words: WordScore[]
}

/** 2-letter language → a reasonable default BCP-47 tag for SpeechRecognition. */
const REGION: Record<string, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  uz: 'uz-UZ',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-BR',
  nl: 'nl-NL',
  pl: 'pl-PL',
  tr: 'tr-TR',
  ar: 'ar-SA',
  hi: 'hi-IN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  zh: 'zh-CN',
  ms: 'ms-MY',
  id: 'id-ID',
  vi: 'vi-VN',
  th: 'th-TH',
}

function toBcp47(language?: string): string {
  const raw = (language ?? '').trim()
  if (!raw) return 'en-US'
  if (raw.includes('-')) return raw
  const code = raw.slice(0, 2).toLowerCase()
  return REGION[code] ?? (code.length === 2 ? `${code}-${code.toUpperCase()}` : 'en-US')
}

/** Lowercase, fold Latin diacritics, drop punctuation, collapse whitespace. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Which target words survive as a subsequence of what was heard (order-preserving). */
function alignWords(target: string[], heard: string[]): boolean[] {
  const n = target.length
  const m = heard.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = target[i] === heard[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
    }
  }

  const ok = new Array<boolean>(n).fill(false)
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (target[i] === heard[j]) {
      ok[i] = true
      i++
      j++
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      i++
    } else {
      j++
    }
  }
  return ok
}

/** Levenshtein-ratio similarity (0–1), for scripts without word spacing (CJK). */
function charSimilarity(a: string, b: string): number {
  const s = normalize(a).replace(/\s+/g, '')
  const t = normalize(b).replace(/\s+/g, '')
  if (!s && !t) return 1
  if (!s || !t) return 0

  const prev = new Array<number>(t.length + 1)
  for (let j = 0; j <= t.length; j++) prev[j] = j
  for (let i = 1; i <= s.length; i++) {
    let diag = prev[0]!
    prev[0] = i
    for (let j = 1; j <= t.length; j++) {
      const tmp = prev[j]!
      prev[j] = s[i - 1] === t[j - 1] ? diag : Math.min(diag, prev[j]!, prev[j - 1]!) + 1
      diag = tmp
    }
  }
  const distance = prev[t.length]!
  return 1 - distance / Math.max(s.length, t.length)
}

/**
 * Score what the learner said against the target phrase. Word-level for
 * space-delimited languages (with per-word highlights); character-level
 * similarity as a single verdict for CJK and other unspaced scripts.
 */
export function scorePronunciation(target: string, heard: string): PronunciationScore {
  const origWords = target.trim().split(/\s+/).filter(Boolean)
  const targetWords = origWords.map((w) => normalize(w)).filter(Boolean)
  const heardWords = normalize(heard).split(' ').filter(Boolean)

  if (origWords.length <= 1 || targetWords.length === 0) {
    const sim = charSimilarity(target, heard)
    const pct = Math.round(sim * 100)
    return { score: pct, words: [{ word: target.trim() || '—', ok: pct >= 60 }] }
  }

  const ok = alignWords(targetWords, heardWords)
  const matched = ok.filter(Boolean).length
  const score = Math.round((matched / targetWords.length) * 100)

  return {
    score,
    words: origWords.map((word, index) => ({ word, ok: ok[index] ?? false })),
  }
}

export function useSpeech() {
  const api = useApi()

  const listening = ref(false)
  const busy = ref(false)
  const error = ref<string | null>(null)
  const result = ref('')

  const browserSupported = false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recognition: any = null
  let recorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let chunks: BlobPart[] = []
  let settle: ((text: string) => void) | null = null
  let fail: ((reason: Error) => void) | null = null
  let captured = ''
  let language: string | undefined

  function finish(text: string): void {
    listening.value = false
    result.value = text
    const done = settle
    settle = null
    fail = null
    done?.(text)
  }

  function abort(message: string): void {
    listening.value = false
    busy.value = false
    error.value = message
    const reject = fail
    settle = null
    fail = null
    reject?.(new Error(message))
  }

  function startRecognition(tag: string): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    recognition = new Ctor()
    recognition.lang = tag
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.continuous = false
    captured = ''

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      captured = String(event.results?.[0]?.[0]?.transcript ?? '').trim()
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      const code = String(event?.error ?? '')
      if (code === 'no-speech') return finish('')
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        return abort('Microphone access was blocked. Allow it in your browser to practise speaking.')
      }
      abort('Speech recognition failed. Try again.')
    }
    recognition.onend = () => {
      if (listening.value) finish(captured)
    }

    listening.value = true
    recognition.start()
  }

  async function startRecording(): Promise<void> {
    if (import.meta.client) {
      abort("Speaking practice needs a speech-to-text service, and BiliMind's DeepSeek and OpenRouter keys don't include one. Listen to the phrase and say it aloud, or type your reply.")
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      abort('This browser cannot record audio. Type your reply instead.')
      return
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      abort('Microphone access was blocked. Allow it in your browser to practise speaking.')
      return
    }

    chunks = []
    recorder = new MediaRecorder(stream)
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => {
      void uploadRecording()
    }
    listening.value = true
    recorder.start()
  }

  async function uploadRecording(): Promise<void> {
    releaseStream()
    const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' })
    chunks = []

    if (blob.size === 0) return finish('')

    busy.value = true
    try {
      const form = new FormData()
      form.append('audio', blob, 'speech.webm')
      if (language) form.append('language', language)
      const res = await api.post<{ text?: string }>('/speech/transcribe', form)
      finish(String(res.text ?? '').trim())
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 503
          ? 'Speaking practice needs Chrome or Edge on this device, or you can type your reply.'
          : 'Could not transcribe that recording. Try again or type your reply.'
      abort(message)
    } finally {
      busy.value = false
    }
  }

  function releaseStream(): void {
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
  }

  /**
   * Begin capturing. Resolves with the recognised transcript when the learner
   * stops (browser recognition often auto-stops on its own; {@link stop} forces it
   * and is required for the MediaRecorder path). Rejects on mic/permission errors.
   */
  function start(options: StartOptions = {}): Promise<string> {
    error.value = null
    result.value = ''

    return new Promise<string>((resolve, reject) => {
      if (!import.meta.client) return reject(new Error('not available'))
      if (listening.value) return reject(new Error('already listening'))

      settle = resolve
      fail = reject
      language = (options.language ?? '').trim() || undefined

      if (browserSupported) {
        try {
          startRecognition(toBcp47(options.language))
        } catch {
          abort('Speech recognition could not start. Try again.')
        }
      } else {
        void startRecording()
      }
    })
  }

  /** Stop capturing and let {@link start}'s promise resolve with the transcript. */
  function stop(): void {
    if (!listening.value) return
    if (recognition) {
      try {
        recognition.stop()
      } catch {
        finish(captured)
      }
      return
    }
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }

  /** Give up on the current capture without resolving a transcript. */
  function cancel(): void {
    if (recognition) {
      recognition.onend = null
      try {
        recognition.stop()
      } catch {
        /* ignore */
      }
      recognition = null
    }
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    releaseStream()
    chunks = []
    listening.value = false
    settle = null
    fail = null
  }

  /** A one-sentence coaching tip for one attempt (lazy, server-side DeepSeek). */
  async function coach(target: string, heard: string, lang?: string): Promise<string | null> {
    try {
      const res = await api.post<{ tip?: string }>('/speech/coach', {
        target,
        heard,
        language: lang,
      })
      return String(res.tip ?? '').trim() || null
    } catch {
      return null
    }
  }

  if (import.meta.client && getCurrentScope()) {
    onScopeDispose(cancel)
  }

  return {
    listening,
    busy,
    error,
    result,
    browserSupported,
    start,
    stop,
    cancel,
    coach,
    score: scorePronunciation,
  }
}

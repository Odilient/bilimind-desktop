// Edge TTS client for `narrate` (WP4): msedge-tts 2.0.9 with the clock-skew fix (media.md §1), XML escaping,
// a sha256 file cache, retries, and a small concurrency pool. Output: 24 kHz 48 kbps mono CBR mp3 (6 bytes per ms),
// so clips can be byte-concatenated and durations computed from byte lengths.
// Owner: WP4.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import type { WordTiming } from './contracts.ts';

export const TTS_DEFAULT_VOICE = 'en-US-AvaMultilingualNeural';
/** Narrator voice per language (BCP-47 primary subtag). */
export const TTS_VOICE_BY_LANG: Record<string, string> = {
  en: TTS_DEFAULT_VOICE,
  ms: 'ms-MY-YasminNeural',
  my: 'my-MM-NilarNeural',
};
const LANG_ALIASES: Record<string, string> = {
  malay: 'ms', 'bahasa melayu': 'ms', melayu: 'ms', bm: 'ms', may: 'ms', msa: 'ms',
  burmese: 'my', myanmar: 'my', bur: 'my', mya: 'my', english: 'en', eng: 'en',
};
/** 'ms', 'ms-MY', 'Malay', 'Bahasa Melayu' -> 'ms' (primary subtag). */
export const ttsLangCode = (lang: string | null | undefined): string => {
  const l = String(lang ?? '').trim().toLowerCase();
  return LANG_ALIASES[l] ?? l.split(/[-_ ]/)[0] ?? '';
};
export const ttsVoiceFor = (lang: string | null | undefined, fallback = TTS_DEFAULT_VOICE): string =>
  /^[a-z]{2,3}-[A-Z]{2}-\w+Neural$/.test(String(lang ?? '')) ? String(lang) : TTS_VOICE_BY_LANG[ttsLangCode(lang)] ?? fallback;

export const TTS_BYTES_PER_MS = 6;                     // 48 kbps CBR
export const ttsDurationMs = (bytes: number): number => Math.round(bytes / TTS_BYTES_PER_MS);

/** 384 ms of silence in the identical frame format (16 frames x 144 bytes), for pauses between blocks. */
export const TTS_SILENCE = Buffer.from('//NkxAAAAANIAAAAAExBTUVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVMQU1FMy4xMDBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//NkxHwAAANIAAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV', 'base64');

// ---------- clock-skew fix ----------
let skewMs = 0;
let skewPromise: Promise<number> | null = null;
/**
 * Server time minus local time, from the Date header of speech.platform.bing.com (0 when |skew| < 60 s or offline).
 * Edge's Sec-MS-GEC token is time-based: an 8 h slow PC clock gets 403 on every request without this.
 */
export function edgeClockSkew(): Promise<number> {
  skewPromise ??= (async () => {
    try {
      const r = await fetch('https://speech.platform.bing.com/', { method: 'HEAD', signal: AbortSignal.timeout(6000) });
      const d = r.headers.get('date');
      const skew = d ? new Date(d).getTime() - Date.now() : 0;
      skewMs = Number.isFinite(skew) && Math.abs(skew) > 60_000 ? skew : 0;
    } catch { skewMs = 0; }
    patchSecMsGec();
    return skewMs;
  })();
  return skewPromise;
}

let patched = false;
/** Replace msedge-tts' Sec-MS-GEC generator with one that uses the corrected clock (no global Date.now patch). */
function patchSecMsGec(): void {
  if (patched) return;
  patched = true;
  const cls = MsEdgeTTS as unknown as { generateSecMsGec?: (token: string) => Promise<string> };
  if (typeof cls.generateSecMsGec === 'function') {
    cls.generateSecMsGec = async (token: string) => {
      const ticks = Math.floor((Date.now() + skewMs) / 1000) + 11644473600;
      const rounded = ticks - (ticks % 300);
      return createHash('sha256').update(`${rounded * 10000000}${token}`).digest('hex').toUpperCase();
    };
  } else if (skewMs) {
    const real = Date.now.bind(Date);
    Date.now = () => real() + skewMs;           // fallback when the library changes shape
  }
}

// ---------- one request ----------
export const xmlEscape = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface TtsClip { mp3: Buffer; words: WordTiming[]; duration_ms: number; cached?: boolean }

function parseWords(meta: string[]): WordTiming[] {
  const words: WordTiming[] = [];
  for (const m of meta) {
    try {
      const j = JSON.parse(m) as { Metadata?: { Type: string; Data: { Offset: number; Duration: number; text?: { Text?: string } } }[] };
      for (const e of j.Metadata ?? []) {
        if (e.Type !== 'WordBoundary') continue;
        words.push({ offset_ms: Math.round(e.Data.Offset / 1e4), duration_ms: Math.round(e.Data.Duration / 1e4), text: e.Data.text?.Text ?? '' });
      }
    } catch { /* partial chunk */ }
  }
  return words.sort((a, b) => a.offset_ms - b.offset_ms);
}

async function edgeRequest(text: string, voice: string, rate: string | undefined, timeoutMs: number): Promise<TtsClip> {
  await edgeClockSkew();
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, { wordBoundaryEnabled: true });
    const { audioStream, metadataStream } = tts.toStream(xmlEscape(text), rate ? { rate } : undefined);
    const chunks: Buffer[] = [];
    const meta: string[] = [];
    metadataStream?.on('data', (d: Buffer | string) => meta.push(d.toString()));
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Edge TTS timed out after ${timeoutMs} ms`)), timeoutMs);
      const done = () => { clearTimeout(timer); resolve(); };
      audioStream.on('data', (c: Buffer) => chunks.push(c));
      audioStream.on('end', done);
      audioStream.on('close', done);
      audioStream.on('error', (e: Error) => { clearTimeout(timer); reject(e); });
    });
    const mp3 = Buffer.concat(chunks);
    if (!mp3.length) throw new Error('Edge TTS returned no audio');
    // let trailing metadata land (it can arrive just after the audio end)
    await new Promise(r => setTimeout(r, 30));
    return { mp3, words: parseWords(meta), duration_ms: ttsDurationMs(mp3.length) };
  } finally {
    try { tts.close(); } catch { /* ignore */ }
  }
}

// one process-wide cap on open Edge sockets, so lessons/plan/speaking can all be queued at once
export const TTS_CONCURRENCY = 12;
let inFlight = 0;
const waiting: (() => void)[] = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= TTS_CONCURRENCY) await new Promise<void>(r => waiting.push(r));
  inFlight++;
  try { return await fn(); } finally { inFlight--; waiting.shift()?.(); }
}

export const ttsCacheKey =(text: string, voice: string, rate = ''): string =>
  createHash('sha256').update(`${text}|${voice}|${rate}`).digest('hex');

/** One Edge request with cache (cacheDir/<sha>.mp3 + .json) and 3 attempts. `readCache: false` = always synthesise. */
export async function edgeSynthesize(text: string, opts: { voice: string; rate?: string; cacheDir?: string; readCache?: boolean; timeoutMs?: number }): Promise<TtsClip> {
  const key = ttsCacheKey(text, opts.voice, opts.rate);
  const mp3Path = opts.cacheDir ? join(opts.cacheDir, `${key}.mp3`) : null;
  const jsonPath = opts.cacheDir ? join(opts.cacheDir, `${key}.json`) : null;
  if (mp3Path && jsonPath && opts.readCache !== false && existsSync(mp3Path) && existsSync(jsonPath)) {
    const mp3 = readFileSync(mp3Path);
    const words = JSON.parse(readFileSync(jsonPath, 'utf8')) as WordTiming[];
    return { mp3, words, duration_ms: ttsDurationMs(mp3.length), cached: true };
  }
  let last: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const clip = await withSlot(() => edgeRequest(text, opts.voice, opts.rate, opts.timeoutMs ?? 45_000));
      if (mp3Path && jsonPath && opts.cacheDir) {
        mkdirSync(opts.cacheDir, { recursive: true });
        writeFileSync(mp3Path, clip.mp3);
        writeFileSync(jsonPath, JSON.stringify(clip.words));
      }
      return clip;
    } catch (e) {
      last = e;
      if (attempt < 3) await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

/** Run tasks with at most `limit` in flight; results in input order, failures as Error values. */
export async function ttsPool<T>(tasks: (() => Promise<T>)[], limit = 8): Promise<(T | Error)[]> {
  const out: (T | Error)[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      try { out[i] = await tasks[i]!(); } catch (e) { out[i] = e instanceof Error ? e : new Error(String(e)); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return out;
}

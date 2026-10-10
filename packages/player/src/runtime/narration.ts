// The narration clock: one <audio> element for the whole player (lesson narration or "Hear the plan").
// A rAF loop while playing moves the lime marker (.s.on on [data-s=<cue id>]), feeds the waveform and
// the orb amplitude (from precomputed peaks: a Web Audio analyser is silent on file://), and follows the
// sentence on screen unless the reader scrolled away in the last 4 s.
import { reactive } from 'vue';
import type { Narration } from '@bilimind/core';
import { ampAt, cueAt } from './cues.ts';

export const RATES = [1, 1.25, 1.5, 0.75] as const;

export const voice = reactive({
  key: '',              // 'plan' or a lesson id
  title: '',            // shown in the dock / Media Session
  src: '',
  playing: false,
  t: 0,                 // ms
  duration: 0,          // ms
  rate: 1 as number,
  cue: '',              // current cue id ('' before the first)
  cueIndex: -1,
  amp: 0,               // smoothed 0..1
  follow: true,
  away: false,          // reader scrolled away from the voice while it plays
  error: '',            // 'missing' when the audio file cannot be loaded
  started: false,       // played at least once in this session
});

let el: HTMLAudioElement | null = null;
let narration: Narration | null = null;
let raf = 0;
let lastUserScroll = 0;
let lit: Element[] = [];
let listeners = false;

function audio(): HTMLAudioElement {
  if (el) return el;
  el = new Audio();
  el.preload = 'none';                       // nothing is fetched until Play (a missing file never logs at load)
  el.addEventListener('play', () => { voice.playing = true; voice.started = true; loop(); });
  el.addEventListener('pause', () => { voice.playing = false; });
  el.addEventListener('ended', () => { voice.playing = false; voice.t = voice.duration; light(''); });
  el.addEventListener('loadedmetadata', () => { if (el && Number.isFinite(el.duration) && el.duration > 0) voice.duration = el.duration * 1000; });
  el.addEventListener('error', () => { voice.error = 'missing'; voice.playing = false; });
  el.addEventListener('timeupdate', () => tick(false));
  return el;
}

function userScrolled(): void { lastUserScroll = performance.now(); }

function ensureListeners(): void {
  if (listeners || typeof window === 'undefined') return;
  listeners = true;
  for (const ev of ['wheel', 'touchmove'] as const) window.addEventListener(ev, userScrolled, { passive: true });
  window.addEventListener('keydown', e => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) userScrolled(); });
}

/** Load a narration (no autoplay). Reloading the same key keeps the position. */
export function loadNarration(key: string, n: Narration | null, title = ''): void {
  ensureListeners();
  if (voice.key === key && narration === n) return;
  const a = audio();
  a.pause();
  narration = n;
  voice.key = key;
  voice.title = title;
  voice.cue = '';
  voice.cueIndex = -1;
  voice.t = 0;
  voice.error = '';
  voice.away = false;
  voice.duration = n?.duration_ms ?? 0;
  voice.src = n?.src ?? '';
  light('');
  if (n?.src) { a.src = n.src; a.playbackRate = voice.rate; try { a.load(); } catch { /* ignore */ } }
  else a.removeAttribute('src');
}

export function unloadNarration(): void {
  if (el) el.pause();
  light('');
  narration = null;
  voice.key = '';
  voice.src = '';
  voice.playing = false;
}

export async function play(): Promise<void> {
  if (!narration?.src) return;
  const a = audio();
  voice.error = '';
  try { await a.play(); setMediaSession(); } catch (e) {
    if ((e as DOMException)?.name !== 'AbortError') voice.error = 'missing';
  }
}
export function pause(): void { el?.pause(); }
export function toggle(): void { if (voice.playing) pause(); else void play(); }

export function seek(ms: number): void {
  const a = audio();
  const t = Math.max(0, Math.min(ms, voice.duration || ms));
  try { a.currentTime = t / 1000; } catch { /* not loaded yet */ }
  voice.t = t;
  tick(true);
}
export function seekFraction(f: number): void { seek(f * (voice.duration || 0)); }

/** Jump to a cue id ("tap to listen from here"). */
export function seekCue(id: string, autoplay = true): void {
  const i = narration?.sentences.findIndex(s => s.id === id) ?? -1;
  if (i < 0 || !narration) return;
  seek(narration.sentences[i]!.start_ms + 1);
  voice.follow = true;
  voice.away = false;
  if (autoplay && !voice.playing) void play();
}
export function stepCue(dir: 1 | -1): void {
  if (!narration?.sentences.length) return;
  const i = Math.max(0, Math.min(narration.sentences.length - 1, voice.cueIndex + dir));
  seek(narration.sentences[i]!.start_ms + 1);
}
export function cycleRate(dir: 1 | -1 = 1): void {
  const i = RATES.indexOf(voice.rate as (typeof RATES)[number]);
  voice.rate = RATES[(i + dir + RATES.length) % RATES.length]!;
  if (el) el.playbackRate = voice.rate;
}
export function backToVoice(): void {
  voice.follow = true;
  voice.away = false;
  lastUserScroll = 0;
  const on = lit[0];
  if (on) on.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
}

const reduced = (): boolean => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function light(id: string): void {
  for (const e of lit) e.classList.remove('on');
  lit = id ? Array.from(document.querySelectorAll(`[data-s="${CSS.escape(id)}"]`)) : [];
  for (const e of lit) e.classList.add('on');
}

function followIfNeeded(): void {
  const on = lit[0] as HTMLElement | undefined;
  if (!on || !voice.playing || voice.key === 'plan') return;
  const r = on.getBoundingClientRect();
  const h = window.innerHeight;
  const outside = r.bottom < h * 0.2 || r.top > h * 0.7;
  const recent = performance.now() - lastUserScroll < 4000;
  if (outside && recent) { voice.away = true; return; }
  if (!outside) { voice.away = false; return; }
  if (voice.follow && !recent) on.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
}

function tick(force: boolean): void {
  if (!el || !narration) return;
  voice.t = el.currentTime * 1000;
  const i = cueAt(narration.sentences, voice.t);
  if (i !== voice.cueIndex || force) {
    voice.cueIndex = i;
    voice.cue = i >= 0 ? narration.sentences[i]!.id : '';
    light(voice.cue);
    followIfNeeded();
  }
  const a = voice.playing ? ampAt(narration.peaks, voice.t) : 0;
  voice.amp += (a - voice.amp) * 0.3;
}

function loop(): void {
  cancelAnimationFrame(raf);
  const step = () => {
    tick(false);
    if (voice.playing) raf = requestAnimationFrame(step);
    else voice.amp = 0;
  };
  raf = requestAnimationFrame(step);
}

/** Re-apply the marker after the DOM changed (a block re-rendered and lost its spans). */
export function relight(): void { light(voice.cue); }

function setMediaSession(): void {
  try {
    const ms = (navigator as Navigator & { mediaSession?: MediaSession }).mediaSession;
    if (!ms || typeof MediaMetadata === 'undefined') return;
    ms.metadata = new MediaMetadata({ title: voice.title || 'BiliMind', artist: 'BiliMind' });
    ms.setActionHandler('play', () => void play());
    ms.setActionHandler('pause', () => pause());
  } catch { /* optional */ }
}

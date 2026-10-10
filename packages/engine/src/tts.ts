// `narrate`: msedge-tts with the clock-skew fix, cues from core lessonSentences() of the COURSE-SHAPED lesson
// (core fromSaasLesson(draft, meta)), waveform peaks from word timings; writes crew/narration.json (NarrationIndex).
// Owner: WP4. Keep the export names and types (src/contracts.ts).
//
// Per lesson: the script is lessonSentences(lesson) (title.0, then every narrated block). Sentences are grouped
// into paragraphs (150-400 chars, never across blocks), one Edge request per paragraph, 8 in parallel. Word
// timings are aligned back to sentences, so there is exactly one cue per sentence (never merged or split).
// The paragraph mp3s are byte-concatenated (same CBR frames), with 384 ms of silence between blocks.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { lessonSentences, textSentences } from '@bilimind/core';
import type { AudioClip, CourseLesson, Narration, NarrationIndex } from '@bilimind/core';
import { BilimindError } from './contracts.ts';
import type { Ctx, NarrateFn, ReadClips, ReadNarration, Synthesize, WordTiming } from './contracts.ts';
import { coursePaths, readJsonOrNull, writeJson } from './course.ts';
import { loadCrew, plannedLessons, toCourseLesson } from './export/crew.ts';
import type { Crew } from './export/crew.ts';
import { clockText, localOf, longDay } from './export/time.ts';
import { TTS_SILENCE, edgeClockSkew, edgeSynthesize, ttsDurationMs, ttsLangCode, ttsPool, ttsVoiceFor } from './tts-edge.ts';

export { edgeClockSkew, ttsVoiceFor, TTS_DEFAULT_VOICE } from './tts-edge.ts';

export const synthesize: Synthesize = async (text, opts) => {
  const clip = await edgeSynthesize(text, { voice: opts.voice, rate: opts.rate, cacheDir: opts.cacheDir });
  return { mp3: new Uint8Array(clip.mp3), words: clip.words, duration_ms: clip.duration_ms };
};

export const readNarration: ReadNarration = course => readJsonOrNull<NarrationIndex>(coursePaths(course).narrationJson);
export const readClips: ReadClips = course => readNarration(course)?.clips ?? [];

// ---------- voice text (per sentence; never merges or splits) ----------
const GREEK: Record<string, string> = { 'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'λ': 'lambda', 'μ': 'mu', 'π': 'pi', 'σ': 'sigma', 'θ': 'theta', 'Θ': 'theta', 'Ω': 'omega', 'Σ': 'sigma', 'Δ': 'delta' };
/** Rewrite one sentence for the ear: "O(n log n)" -> "O of n log n", "α" -> "alpha", "½" -> "one half". */
export function voiceText(s: string): string {
  return s
    .replace(/([OΘΩθo])\(([^()]{1,40})\)/g, (_m, f: string, x: string) => `${GREEK[f] ?? 'O'} of ${x}`)
    .replace(/½/g, 'one half').replace(/¼/g, 'one quarter').replace(/¾/g, 'three quarters')
    .replace(/(\w)²/g, '$1 squared').replace(/(\w)³/g, '$1 cubed').replace(/\^2\b/g, ' squared')
    .replace(/[αβγδλμπσθΘΩΣΔ]/g, c => ` ${GREEK[c]} `)
    .replace(/\s*[−–]\s*(?=\d|\w)/g, ' minus ').replace(/\s*×\s*/g, ' times ').replace(/\s*≈\s*/g, ' about ')
    .replace(/\s*≤\s*/g, ' at most ').replace(/\s*≥\s*/g, ' at least ').replace(/\s*≠\s*/g, ' not equal to ')
    .replace(/\s*(→|->|=>)\s*/g, ' to ').replace(/\s*[←]\s*/g, ' from ')
    .replace(/[`*_#|~<>{}\\]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// ---------- script -> paragraphs ----------
export interface TtsScriptSentence { id: string; block: string; text: string; voice: string }
export interface TtsParagraph { block: string; sentences: TtsScriptSentence[]; text: string }
const MIN_PARA = 150;
const MAX_PARA = 320;

/** Groups consecutive sentences of one block into ~150-400 char paragraphs (the title is its own paragraph). */
export function ttsParagraphs(sentences: { id: string; block: string; text: string }[]): TtsParagraph[] {
  const out: TtsParagraph[] = [];
  let cur: TtsParagraph | null = null;
  for (const s of sentences) {
    const voice = voiceText(s.text) || s.text;
    const ss: TtsScriptSentence = { id: s.id, block: s.block, text: s.text, voice };
    const fits = cur && cur.block === s.block && s.block !== 'title' && (cur.text.length < MIN_PARA || cur.text.length + 1 + voice.length <= MAX_PARA);
    if (cur && fits) { cur.sentences.push(ss); cur.text += ' ' + voice; continue; }
    cur = { block: s.block, sentences: [ss], text: voice };
    out.push(cur);
  }
  return out;
}

// ---------- word timings -> sentence cues ----------
const wnorm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');

/** [start_ms, end_ms] per sentence of one paragraph (relative to the paragraph clip). */
export function ttsAlignSentences(p: TtsParagraph, words: WordTiming[], clipMs: number): [number, number][] {
  const ranges: [number, number][] = [];
  let at = 0;
  for (const s of p.sentences) { ranges.push([at, at + s.voice.length]); at += s.voice.length + 1; }
  const lower = p.text.toLowerCase();
  const hits: { sentence: number; start: number; end: number }[] = [];
  let cursor = 0;
  for (const w of words) {
    const t = w.text.trim().toLowerCase();
    if (!t) continue;
    let idx = lower.indexOf(t, cursor);
    if (idx < 0 || idx - cursor > 80) {
      const n = wnorm(t);
      idx = -1;
      if (n) {                                    // fuzzy: first token from the cursor whose normalised form starts the same
        const re = /\S+/g;
        re.lastIndex = cursor;
        let m: RegExpExecArray | null;
        while ((m = re.exec(lower)) && m.index - cursor <= 80) if (wnorm(m[0]).startsWith(n.slice(0, 3))) { idx = m.index; break; }
      }
    }
    if (idx < 0) idx = cursor;                    // unknown token: stays with the current sentence
    else cursor = idx + Math.max(1, t.length);
    let si = ranges.findIndex(([a, b]) => idx >= a && idx <= b);
    if (si < 0) si = ranges.length - 1;
    hits.push({ sentence: si, start: w.offset_ms, end: w.offset_ms + w.duration_ms });
  }
  const out: ([number, number] | null)[] = p.sentences.map((_, i) => {
    const hs = hits.filter(h => h.sentence === i);
    return hs.length ? [Math.min(...hs.map(h => h.start)), Math.max(...hs.map(h => h.end))] : null;
  });
  // sentences without word hits: share the gap between neighbours by text length

  for (let i = 0; i < out.length; i++) {
    if (out[i]) continue;
    let j = i;
    while (j < out.length && !out[j]) j++;
    const from = i > 0 ? out[i - 1]![1] : 0;
    const to = j < out.length ? out[j]![0] : clipMs;
    const len = p.sentences.slice(i, j).reduce((s, x) => s + x.voice.length, 0) || 1;
    let t = from;
    for (let k = i; k < j; k++) {
      const d = (to - from) * (p.sentences[k]!.voice.length / len || 1 / (j - i));
      out[k] = [Math.round(t), Math.round(t + d)];
      t += d;
    }
    i = j - 1;
  }
  // monotone, inside the clip
  let prevEnd = 0;
  return out.map(r => {
    const s = Math.max(prevEnd, Math.min(r![0], clipMs));
    const e = Math.max(s, Math.min(r![1], clipMs));
    prevEnd = e;
    return [s, e] as [number, number];
  });
}

/** Waveform bars (0..1) at `hz` from word timings: speech bins vary by word, gaps stay low. No audio decoding. */
export function peaksFromWords(words: WordTiming[], durationMs: number, hz = 5): { hz: number; values: number[] } {
  const bin = 1000 / hz;
  const n = Math.max(1, Math.ceil(durationMs / bin));
  const values = new Array<number>(n).fill(0.06);
  for (const w of words) {
    const h = createHash('md5').update(w.text + w.offset_ms).digest();
    const a = Math.floor(w.offset_ms / bin);
    const b = Math.min(n - 1, Math.floor((w.offset_ms + Math.max(w.duration_ms, 1)) / bin));
    for (let i = a; i <= b && i < n; i++) {
      const v = 0.28 + (h[(i - a) % h.length]! / 255) * 0.5 + Math.min(0.15, w.text.length / 60);
      values[i] = Math.max(values[i]!, Math.min(1, v));
    }
  }
  return { hz, values: values.map(v => Math.round(v * 100) / 100) };
}

// ---------- render a script (lesson, plan, audio block) ----------
export interface TtsRendered { mp3: Buffer; duration_ms: number; cues: { id: string; start_ms: number; end_ms: number }[]; words: WordTiming[]; text: string }

export async function ttsRenderScript(sentences: { id: string; block: string; text: string }[], opts: { voice: string; rate?: string; cacheDir?: string; readCache?: boolean; concurrency?: number }): Promise<TtsRendered> {
  const paras = ttsParagraphs(sentences);
  if (!paras.length) throw new Error('nothing to narrate');
  const results = await ttsPool(paras.map(p => () => edgeSynthesize(p.text, { voice: opts.voice, rate: opts.rate, cacheDir: opts.cacheDir, readCache: opts.readCache })), opts.concurrency ?? 64);
  const failed = results.find((r): r is Error => r instanceof Error);
  if (failed) throw failed;
  const parts: Buffer[] = [];
  const cues: TtsRendered['cues'] = [];
  const words: WordTiming[] = [];
  let offset = 0;
  paras.forEach((p, i) => {
    const clip = results[i] as Exclude<typeof results[number], Error>;
    if (i > 0 && paras[i - 1]!.block !== p.block) { parts.push(TTS_SILENCE); offset += ttsDurationMs(TTS_SILENCE.length); }
    ttsAlignSentences(p, clip.words, clip.duration_ms).forEach(([s, e], k) => cues.push({ id: p.sentences[k]!.id, start_ms: offset + s, end_ms: offset + e }));
    for (const w of clip.words) words.push({ ...w, offset_ms: offset + w.offset_ms });
    parts.push(clip.mp3);
    offset += clip.duration_ms;
  });
  const mp3 = Buffer.concat(parts);
  return { mp3, duration_ms: ttsDurationMs(mp3.length), cues, words, text: paras.map(p => p.text).join('\n') };
}

const audioName = (voice: string, text: string) => `audio/${createHash('sha256').update(`${voice}|${text}`).digest('hex').slice(0, 16)}.mp3`;

function writeAudio(course: string, rel: string, mp3: Buffer): void {
  mkdirSync(join(course, 'audio'), { recursive: true });
  writeFileSync(join(course, ...rel.split('/')), mp3);
}

// ---------- "Hear the plan" ----------
const pct = (x: number) => `${Math.round(x * 100)} percent`;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Deterministic overview from goal + plan + exam-map (about 45-60 s spoken). Sentences become cues plan.0.. */
export function planOverviewText(crew: Crew, lessons: CourseLesson[]): string {
  const g = crew.goal;
  const tz = crew.timezone;
  const S: string[] = [`Here is your plan for ${crew.outline.title || 'this course'}.`];
  if (g.exam_at) {
    const e = localOf(g.exam_at, tz);
    S.push(`Your exam is on ${longDay(e.date)} at ${clockText(e.hm)}.`);
  } else if (g.deadline) S.push(`You want to be ready by ${longDay(g.deadline)}.`);
  const studyDays = (crew.plan?.days ?? []).filter(d => !d.exam).length;
  S.push(studyDays ? `You have ${studyDays} study day${studyDays === 1 ? '' : 's'} and ${g.minutes_per_day} minutes a day.` : `You have ${g.minutes_per_day} minutes a day.`);
  const w = (crew.examMap?.weights ?? []).filter(x => x.share > 0).slice(0, 2);
  if (w.length) S.push(`Last year's paper put ${list(w.map(x => `${pct(x.share)} of the marks on ${x.title}`))}.`);
  S.push(`So you will learn ${lessons.length} lesson${lessons.length === 1 ? '' : 's'}: ${list(lessons.map(l => l.title))}.`);
  const cut = crew.plan?.cut ?? [];
  if (cut.length) {
    S.push(`We cut ${list(cut.slice(0, 3).map(c => c.title))}.`);
    S.push(`${cut[0]!.title}: ${cut[0]!.reason.replace(/[.!]+$/, '')}.`);
  }
  S.push('Your reviews are dated backwards from the exam, so the last one lands the day before.');
  S.push('Every answer was checked against your own files.');
  return S.join(' ');
}

// ---------- narrate ----------
export const narrate: NarrateFn = async (ctx: Ctx, opts) => {
  const crew = loadCrew(ctx.course);
  const p = coursePaths(ctx.course);
  const entries = plannedLessons(crew, m => ctx.progress(`narrate: ${m}`));
  const want = opts.lessons?.length ? new Set(opts.lessons) : null;
  const langs = opts.langs?.length ? new Set(opts.langs.map(l => ttsLangCode(l))) : null;
  const voice = opts.voice || ttsVoiceFor(crew.goal.language);
  const cacheDir = join(p.cache, 'tts');
  const readCache = !ctx.noCache;
  const skew = await edgeClockSkew();
  if (skew) ctx.progress(`narrate: PC clock is ${Math.round(skew / 60000)} min off; Edge requests use the server time`);

  const prev = crew.narration;
  const index: NarrationIndex = {
    version: 1, voice,
    lessons: { ...(prev?.lessons ?? {}) },
    plan: prev?.plan ?? null,
    clips: [...(prev?.clips ?? [])],
    failed: [],
    updated_at: ctx.now().toISOString(),
  };
  const dropClips = (pred: (c: AudioClip) => boolean) => { index.clips = index.clips.filter(c => !pred(c)); };
  let made = 0;
  const lessonsNow = entries.map(e => toCourseLesson(e));

  const doLesson = async (e: typeof entries[number]) => {
    const lesson = toCourseLesson(e);
    // the lesson narration starts first (the longest job); one mp3, one cue per sentence
    const script = lessonSentences(lesson);
    ctx.progress(`narrate: ${e.key}: ${script.length} sentences`);
    const render = ttsRenderScript(script, { voice, cacheDir, readCache }).then(r => r, (err: Error) => err);
    // speaking items + dialogue openers in their own language's voice (paths go into the draft payloads)
    let draftChanged = false;
    for (const b of e.draft.blocks) {
      const pl = b.payload as Record<string, unknown>;
      const lang = String(pl.language ?? crew.goal.language ?? 'en').toLowerCase();
      if (langs && !langs.has(ttsLangCode(lang))) continue;
      const v = ttsVoiceFor(lang, voice);
      if (b.type === 'speaking' && Array.isArray(pl.items)) {
        const items = pl.items as { text?: string; audio?: string }[];
        const res = await ttsPool(items.map(it => async () => {
          const text = String(it.text ?? '').trim();
          if (!text) return null;
          const clip = await edgeSynthesize(text, { voice: v, cacheDir, readCache });
          const file = audioName(v, text);
          writeAudio(p.root, file, clip.mp3);
          return { file, clip, text };
        }), 8);
        dropClips(c => c.kind === 'speaking' && c.lesson === e.key && c.block === (b.id ?? null));
        res.forEach((r, i) => {
          if (r instanceof Error) { index.failed.push(`${e.key}/${b.id}/speaking ${i}: ${r.message}`); return; }
          if (!r) return;
          items[i]!.audio = r.file;
          index.clips.push({ kind: 'speaking', lesson: e.key, block: b.id ?? null, item: i, file: r.file, voice: v, text: r.text, duration_ms: r.clip.duration_ms, words: r.clip.words });
          made++;
        });
        pl.voice = v;
        draftChanged = true;
      }
      if (b.type === 'dialogue' && typeof pl.opening_line === 'string' && pl.opening_line.trim()) {
        try {
          const text = pl.opening_line.trim();
          const clip = await edgeSynthesize(text, { voice: v, cacheDir, readCache });
          const file = audioName(v, text);
          writeAudio(p.root, file, clip.mp3);
          pl.opening_audio = file;
          dropClips(c => c.kind === 'dialogue' && c.lesson === e.key && c.block === (b.id ?? null));
          index.clips.push({ kind: 'dialogue', lesson: e.key, block: b.id ?? null, file, voice: v, text, duration_ms: clip.duration_ms, words: clip.words });
          draftChanged = true;
          made++;
        } catch (err) { index.failed.push(`${e.key}/${b.id}/dialogue: ${(err as Error).message}`); }
      }
    }
    if (draftChanged) writeJson(p.lessonJson(e.key), e.draft);

    try {
      const r = await render;
      if (r instanceof Error) throw r;
      const file = audioName(voice, r.text);
      writeAudio(p.root, file, r.mp3);
      const narration: Narration = { src: file, duration_ms: r.duration_ms, voice, sentences: r.cues, peaks: peaksFromWords(r.words, r.duration_ms) };
      index.lessons[e.key] = narration;
      dropClips(c => c.kind === 'lesson' && c.lesson === e.key);
      index.clips.push({ kind: 'lesson', lesson: e.key, block: null, file, voice, text: r.text, duration_ms: r.duration_ms });
      made++;
    } catch (err) {
      delete index.lessons[e.key];
      index.failed.push(`${e.key}: ${(err as Error).message}`);
    }
  };

  // "Hear the plan" (only on a full run)
  const doPlan = async () => {
    if (want || !lessonsNow.length) return;
    const text = planOverviewText(crew, lessonsNow);
    try {
      const r = await ttsRenderScript(textSentences('plan', text), { voice, cacheDir, readCache });
      const file = audioName(voice, r.text);
      writeAudio(p.root, file, r.mp3);
      index.plan = { src: file, duration_ms: r.duration_ms, voice, sentences: r.cues, peaks: peaksFromWords(r.words, r.duration_ms), text };
      dropClips(c => c.kind === 'plan');
      index.clips.push({ kind: 'plan', lesson: null, block: null, file, voice, text, duration_ms: r.duration_ms });
      made++;
    } catch (err) { index.failed.push(`plan: ${(err as Error).message}`); }
  };

  await Promise.all([...entries.filter(e => !want || want.has(e.key)).map(doLesson), doPlan()]);

  if (!made && index.failed.length) {
    throw new BilimindError(`Edge TTS failed for every clip (${index.failed[0]})`,
      'Check the network (speech.platform.bing.com) and run `doctor` (clock_skew_ms). The course still builds without narration.');
  }
  writeJson(p.narrationJson, index);
  const totalMs = Object.values(index.lessons).reduce((s, n) => s + n.duration_ms, 0) + (index.plan?.duration_ms ?? 0);
  return { clips: made, minutes: Math.round(totalMs / 6000) / 10, failed: index.failed };
};


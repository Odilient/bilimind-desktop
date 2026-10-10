// The course assistant: answers a question about a course from the open lesson, the course outline and the learner's
// own files (crew/ingest.json chunks, minisearch via the engine's buildIndex; no embeddings), with the learner's key,
// streaming AssistantEvents back through `emit`. Port of the web app's docked assistant (AssistantService::chat):
// grounded in what the learner is looking at, plain and short, citing numbered excerpts.
//
// - The key and provider come from the same config the engine uses (loadConfig over %USERPROFILE%\.bilimind\config.json,
//   provider picked like runs.ts). The key never leaves this process and is never logged.
// - HTTP: the engine's way (global fetch, TLS verified, OpenAI-compatible /chat/completions), streamed. Only when that
//   fails on a certificate check (a TLS-inspecting network) is the same request retried once through Electron's
//   net.fetch (Chromium stack, Windows certificate store, still verified).
// - Events: delta* then exactly one done or error. cancel emits error 'Stopped.' and nothing after it.
import { app, net } from 'electron';
import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Chunk } from '@bilimind/core';
import { loadConfig, needsKey, providerLabel, redact } from '@bilimind/engine/config';
import type { EngineConfig, RetrievalIndex } from '@bilimind/engine/contracts';
import { recordSpend, round6 } from '@bilimind/engine/ledger';
import { costOf, freeServiceFailure, providerHeaders, type RawUsage } from '@bilimind/engine/llm';
import { buildIndex, searchTerms } from '@bilimind/engine/retrieve';
import { isFrontMatter } from '@bilimind/engine/sources';
import type { AssistantAsk, AssistantCite, AssistantEvent, AssistantScope, ProviderId } from '../shared/contract.ts';
import { checkCourseId } from './courses.ts';
import { getSettings } from './settings.ts';

// ---------- budget ----------
const CONTEXT_CHARS = 12_000;          // lesson/outline text + excerpts in the prompt
const LESSON_CHARS = 5_000;
const OUTLINE_CHARS = 3_500;
const EXCERPT_CHARS = 1_400;           // one excerpt (chunks are <= 1200 already)
const MAX_EXCERPTS: Record<AssistantScope, number> = { lesson: 6, course: 8, files: 8 };
const HISTORY_TURNS = 8;
const TURN_CHARS = 2_000;
const QUESTION_CHARS = 4_000;
const MAX_TOKENS = 900;
const TIMEOUT_MS = 90_000;

// ---------- course data (cached per course folder, keyed by file mtimes) ----------
interface Block { id?: string; type?: string; title?: string | null; payload?: unknown; assessments?: unknown[] }
interface Lesson { id: string; title: string; summary?: string; blocks?: Block[] }
interface CourseJson { title?: string; goal?: { sentence?: string }; language?: string; lessons?: Lesson[] }
interface IngestJson { files?: { material_id: number; name?: string; path?: string; role?: string }[]; chunks?: Chunk[] }
interface FileInfo { name: string; pastPaper: boolean }
interface CourseData { stamp: string; course: CourseJson; chunks: Chunk[]; files: Map<number, FileInfo>; index: RetrievalIndex | null }

const cache = new Map<string, CourseData>();

function readJson<T>(p: string): T | null {
  try { return JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')) as T; } catch { return null; }
}
const mtime = (p: string): number => { try { return statSync(p).mtimeMs; } catch { return 0; } };

function courseData(dir: string): CourseData {
  const courseFile = join(dir, 'course.json');
  const ingestFile = join(dir, 'crew', 'ingest.json');
  const stamp = `${mtime(courseFile)}:${mtime(ingestFile)}`;
  const hit = cache.get(dir);
  if (hit && hit.stamp === stamp) return hit;
  const course = readJson<CourseJson>(courseFile) ?? {};
  const ingest = readJson<IngestJson>(ingestFile) ?? {};
  const files = new Map<number, FileInfo>();
  for (const f of Array.isArray(ingest.files) ? ingest.files : []) {
    const name = f.name || (f.path ? f.path.split(/[\\/]/).pop() : '') || `file ${f.material_id}`;
    files.set(f.material_id, { name: name!, pastPaper: f.role === 'past_paper' });
  }
  const chunks = (Array.isArray(ingest.chunks) ? ingest.chunks : [])
    .filter(c => c && typeof c.content === 'string' && c.content.trim() && !isFrontMatter(c));
  const data: CourseData = { stamp, course, chunks, files, index: chunks.length ? buildIndex(chunks) : null };
  cache.set(dir, data);
  return data;
}

// ---------- grounding text ----------
const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const tidy = (s: string): string => s.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

// keys whose values are answers, media or plumbing, not lesson text the learner reads
const SKIP_KEYS = new Set(['id', 'answer_key', 'reference_solution', 'solution', 'tests', 'hidden_tests', 'correct', 'correct_index',
  'correct_option', 'answer', 'audio', 'src', 'peaks', 'voice', 'image', 'img', 'url', 'source', 'format', 'mode', 'language',
  'grader', 'bloom', 'max_score', 'kind', 'cites']);

function strings(v: unknown, out: string[], depth = 0): void {
  if (depth > 6 || out.length > 200) return;
  if (typeof v === 'string') { const t = tidy(v); if (t) out.push(clip(t, 1_500)); return; }
  if (Array.isArray(v)) { for (const x of v) strings(x, out, depth + 1); return; }
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!SKIP_KEYS.has(k)) strings(x, out, depth + 1);
}

/** What is on the lesson page: title, summary, then each part's text (quiz prompts without their answers). */
function lessonText(l: Lesson): string {
  const parts: string[] = [`Title: ${l.title}`];
  if (l.summary) parts.push(`Summary: ${tidy(l.summary)}`);
  for (const b of Array.isArray(l.blocks) ? l.blocks : []) {
    const out: string[] = [];
    if (b.title) out.push(b.title);
    strings(b.payload, out);
    for (const a of Array.isArray(b.assessments) ? b.assessments : []) strings(a, out);
    if (out.length) parts.push(`[${(b.type ?? 'part').replace(/_/g, ' ')}]\n${out.join('\n')}`);
  }
  return clip(parts.join('\n\n'), LESSON_CHARS);
}

function outlineText(c: CourseJson, openLesson: Lesson | null): string {
  const lines = (c.lessons ?? []).map((l, i) => `${i + 1}. ${l.title}${l.summary ? ` (${clip(tidy(l.summary), 220)})` : ''}`);
  if (openLesson) lines.push(`The learner has lesson "${openLesson.title}" open.`);
  return clip(lines.join('\n'), OUTLINE_CHARS);
}

// ---------- retrieval ----------
/** The query plus crude English stems of its words ("stored" -> "store"): the index prefix-matches terms of 4+ letters. */
function withStems(text: string): string {
  const terms = searchTerms(text);
  const have = new Set(terms);
  const stems: string[] = [];
  for (const t of terms) {
    const s = t.replace(/(?:ing|ed|es|s)$/u, '');
    if (s.length >= 4 && !have.has(s)) { have.add(s); stems.push(s); }
  }
  return stems.length ? `${text} ${stems.join(' ')}` : text;
}

/** Places the open lesson cites: "file.pdf" and "file.pdf#5" (page/slide), lower-case file names. */
function citedPlaces(l: Lesson | null): Set<string> {
  const out = new Set<string>();
  for (const b of l?.blocks ?? []) {
    for (const c of Array.isArray((b as { cites?: unknown }).cites) ? (b as { cites: { file?: string; page?: number | null }[] }).cites : []) {
      if (typeof c?.file !== 'string') continue;
      const f = c.file.split(/[\\/]/).pop()!.toLowerCase();
      out.add(f);
      if (typeof c.page === 'number') out.add(`${f}#${c.page}`);
    }
  }
  return out;
}

/**
 * Top chunks over one or more weighted queries: each query's minisearch scores are normalised to its best hit and
 * summed, so the question itself leads and the lesson title only breaks ties. Passages the open lesson cites get a
 * lift (the exact slide/page more than the same file).
 */
function retrieve(data: CourseData, queries: { text: string; weight: number }[], limit: number, cited: Set<string>): Chunk[] {
  if (!data.index || limit <= 0) return [];
  const score = new Map<number, { chunk: Chunk; s: number }>();
  for (const q of queries) {
    const hits = data.index.search(withStems(q.text), limit * 3);
    const top = hits[0]?.score || 1;
    for (const h of hits) {
      const cur = score.get(h.chunk.id) ?? { chunk: h.chunk, s: 0 };
      cur.s += q.weight * (h.score / top);
      score.set(h.chunk.id, cur);
    }
  }
  if (cited.size) {
    for (const v of score.values()) {
      const f = data.files.get(v.chunk.material_id)?.name.toLowerCase() ?? '';
      if (v.chunk.page != null && cited.has(`${f}#${v.chunk.page}`)) v.s += 0.35;
      else if (cited.has(f)) v.s += 0.1;
    }
  }
  return [...score.values()].sort((a, b) => b.s - a.s || a.chunk.id - b.chunk.id).slice(0, limit).map(v => v.chunk);
}

interface Excerpt { n: number; chunk: Chunk; file: string; locator?: string; pastPaper: boolean }

function excerptsFor(data: CourseData, chunks: Chunk[], room: number): { list: Excerpt[]; text: string } {
  const list: Excerpt[] = [];
  const parts: string[] = [];
  let used = 0;
  for (const c of chunks) {
    const f = data.files.get(c.material_id);
    const file = f?.name ?? c.title;
    const locator = c.locator?.trim() || (c.page ? `Page ${c.page}` : undefined);
    const n = list.length + 1;
    const head = `[${n}] ${file}${locator ? ` · ${locator}` : ''}${f?.pastPaper ? ' (past paper: exam questions, not explanations)' : ''}`;
    const body = clip(tidy(c.content), EXCERPT_CHARS);
    const entry = `${head}\n${body}`;
    if (used + entry.length > room && list.length) break;
    list.push({ n, chunk: c, file, locator, pastPaper: !!f?.pastPaper });
    parts.push(entry);
    used += entry.length + 2;
  }
  return { list, text: parts.join('\n\n') };
}

// ---------- prompt ----------
function systemPrompt(o: { course: CourseJson; scope: AssistantScope; lesson: Lesson | null; lessonTxt: string; outline: string; excerpts: string }): string {
  const where = o.scope === 'lesson' && o.lesson ? `the open lesson "${o.lesson.title}"`
    : o.scope === 'course' ? 'this course' : "the learner's own files";
  const goal = o.course.goal?.sentence ? `\nThe learner's goal, in their words: "${clip(tidy(o.course.goal.sentence), 400)}"` : '';
  const sections: string[] = [];
  if (o.lessonTxt) sections.push(`OPEN LESSON (what is on the page right now)\n${o.lessonTxt}`);
  if (o.outline) sections.push(`COURSE LESSONS\n${o.outline}`);
  sections.push(o.excerpts ? `EXCERPTS FROM THE LEARNER'S FILES\n${o.excerpts}` : "EXCERPTS FROM THE LEARNER'S FILES\n(none matched this question)");
  return `You are the study assistant inside BiliMind, a course built from the learner's own files.
Course: "${o.course.title ?? 'Untitled course'}".${goal}
The learner is asking about ${where}.

Rules:
- Answer only from the material below: the lesson text${o.outline ? ', the course lessons' : ''} and the numbered excerpts.
- Answer briefly and plainly. Short sentences. No hype, no filler, no praise. Usually 2 to 6 sentences or a short list.
- When a sentence uses an excerpt, cite it right after with its number in square brackets, like [2]. Cite only numbers listed below. Never invent a file, page or slide.
- If the material does not cover the question, say so in one short sentence, then give a short general answer that starts with "Beyond your files:".
- If the learner is stuck on an exercise or quiz, give a hint first, not the full solution.
- Reply in the same language as the learner's question.
- Simple Markdown only (bold, lists, \`code\`). No headings, no tables.

${sections.join('\n\n')}`;
}

// ---------- cites ----------
/** Excerpt numbers the answer cites: [2], [1, 3], [2-4], [1][2]; not a[1] or numbers inside `code`. */
export function citedNumbers(text: string, max: number): number[] {
  const plain = text.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
  const seen = new Set<number>();
  for (const m of plain.matchAll(/\[(\d{1,2}(?:\s*(?:,|;|–|-|and)\s*\d{1,2})*)\]/g)) {
    const before = plain[m.index! - 1] ?? ' ';
    if (/[A-Za-z_]/.test(before)) continue;                 // heap[1], arr[2]: code, not a cite
    for (const part of m[1]!.split(/\s*(?:,|;|and)\s*/)) {
      const r = /^(\d+)\s*[–-]\s*(\d+)$/.exec(part);
      const [a, b] = r ? [Number(r[1]), Number(r[2])] : [Number(part), Number(part)];
      for (let n = a; n <= Math.min(b, a + 10); n++) if (n >= 1 && n <= max) seen.add(n);
    }
  }
  return [...seen].sort((x, y) => x - y);
}

/** Up to 200 chars of the chunk, starting at the line that shares the most words with the question. */
function bestQuote(content: string, terms: string[]): string {
  const lines = content.split(/\n+/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!lines.length) return '';
  let best = 0, bestHits = -1;
  lines.forEach((l, i) => {
    const lc = l.toLowerCase();
    const hits = terms.filter(t => lc.includes(t)).length;
    if (hits > bestHits) { best = i; bestHits = hits; }
  });
  const text = lines.slice(bestHits > 0 ? best : 0).join(' ');
  if (text.length <= 200) return text;
  const cut = text.slice(0, 199);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 120 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

// ---------- HTTP ----------
type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

function requestBody(cfg: EngineConfig, model: string, messages: Msg[], drop: Set<string>): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model, messages, stream: true, stream_options: { include_usage: true }, max_tokens: MAX_TOKENS, temperature: 0.3,
  };
  if (cfg.provider === 'deepseek') body.thinking = { type: 'disabled' };
  else {
    body.usage = { include: true };
    body.reasoning = { enabled: false };
    // the engine's price pin for DeepSeek routes on OpenRouter (PLAN §6.3)
    if (model.startsWith('deepseek/')) body.provider = { require_parameters: true, max_price: { prompt: 0.2, completion: 0.4 }, allow_fallbacks: true };
  }
  for (const k of drop) delete body[k];
  return body;
}

// the engine's headers: the user's key for DeepSeek/OpenRouter; no key and the client header for BiliMind free
const headers = (cfg: EngineConfig): Record<string, string> => ({ ...providerHeaders(cfg), Accept: 'text/event-stream' });

/** Optional request keys dropped (once) when the endpoint refuses them with a 400 that names them. */
const OPTIONAL_PARAMS: [string, RegExp][] = [['stream_options', /stream[_ ]?options|include[_ ]?usage/i], ['thinking', /thinking/i], ['reasoning', /reasoning/i]];

function isCertError(e: unknown): boolean {
  const err = e as { message?: string; code?: string; cause?: { code?: string; message?: string } };
  const s = `${err?.code ?? ''} ${err?.message ?? ''} ${err?.cause?.code ?? ''} ${err?.cause?.message ?? ''}`;
  return /CERT|SELF_SIGNED|UNABLE_TO_VERIFY|LEAF_SIGNATURE|certificate/i.test(s);
}

class AskError extends Error {}

function httpError(who: string, provider: ProviderId, status: number, detail = ''): AskError {
  if (provider === 'bilimind') return new AskError(freeServiceFailure(status, detail).message);
  if (status === 401 || status === 403) return new AskError(`${who} did not accept your key. Check it in Settings.`);
  if (status === 402) return new AskError(`Your ${who} balance is empty. Top it up, or switch to ${provider === 'deepseek' ? 'OpenRouter' : 'DeepSeek'} in Settings.`);
  if (status === 429) return new AskError(`${who} is busy right now. Try again in a minute.`);
  if (status >= 500) return new AskError(`${who} had a problem answering. Try again in a minute.`);
  return new AskError(`${who} refused the question (${status}). Try a shorter question.`);
}

// ---------- asks ----------
interface Live { ctl: AbortController; stopped: boolean; emit: (e: AssistantEvent) => void }
const live = new Map<string, Live>();

const SCOPES: AssistantScope[] = ['lesson', 'course', 'files'];

function activeConfig(): EngineConfig {
  // provider exactly as a run picks it (runs.ts): the chosen one when its key is set, else the other one with a key
  const s = getSettings();
  const provider = s.keys[s.provider].set ? s.provider : (['deepseek', 'openrouter'] as const).find(p => s.keys[p].set) ?? s.provider;
  const env: Record<string, string | undefined> = { ...process.env, BILIMIND_PROVIDER: provider };
  if (app.isPackaged) env.BILIMIND_NO_ENV_LOCAL = '1';
  return loadConfig({ env });
}

export async function askAssistant(o: AssistantAsk, emit: (e: AssistantEvent) => void): Promise<{ askId: string }> {
  const dir = checkCourseId(o?.courseId);
  const question = typeof o?.question === 'string' ? o.question.trim().slice(0, QUESTION_CHARS) : '';
  if (!question) throw new Error('Type a question first.');
  const scope: AssistantScope = SCOPES.includes(o?.scope) ? o.scope : 'lesson';
  const askId = randomUUID();
  const entry: Live = { ctl: new AbortController(), stopped: false, emit };
  live.set(askId, entry);
  const send = (e: AssistantEvent) => { if (!entry.stopped) { try { emit(e); } catch { /* window gone */ } } };
  // start after this call has answered, so the renderer knows the askId before the first event
  setImmediate(() => {
    void answer(askId, dir, { ...o, question, scope }, entry, send)
      .catch(e => {
        if (entry.stopped) return;
        const aborted = (e as Error)?.name === 'AbortError' || (e as Error)?.name === 'TimeoutError';
        const message = e instanceof AskError ? e.message
          : aborted ? 'The AI took too long to answer. Try again.'
            : 'Something went wrong while answering. Try again.';
        if (!(e instanceof AskError) && !aborted) console.error('[assistant]', redact(String((e as Error)?.message ?? e)).slice(0, 300));
        send({ askId, type: 'error', message });
      })
      .finally(() => { entry.stopped = true; live.delete(askId); });
  });
  return { askId };
}

export async function cancelAssistant(askId: string): Promise<void> {
  const entry = live.get(String(askId));
  if (!entry || entry.stopped) return;
  try { entry.emit({ askId, type: 'error', message: 'Stopped.' }); } catch { /* window gone */ }
  entry.stopped = true;
  entry.ctl.abort();
  live.delete(askId);
}

/** The prompt for one ask (no I/O beyond reading the course folder): messages, the numbered excerpts, the scope used. */
export function groundAsk(dir: string, o: AssistantAsk & { scope: AssistantScope }): { messages: Msg[]; excerpts: Excerpt[]; scope: AssistantScope; lessonId: string | null } {
  const data = courseData(dir);
  const lessons = Array.isArray(data.course.lessons) ? data.course.lessons : [];
  const lesson = o.lessonId ? lessons.find(l => l?.id === o.lessonId) ?? null : null;
  const scope: AssistantScope = o.scope === 'lesson' && !lesson ? 'course' : o.scope;
  const history = (Array.isArray(o.history) ? o.history : [])
    .filter(t => t && (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string' && t.text.trim())
    .map(t => ({ role: t.role, text: t.text.trim() }));
  // the renderer may already have pushed this question onto the history
  const last = history[history.length - 1];
  if (last && last.role === 'user' && last.text === o.question) history.pop();
  const turns = history.slice(-HISTORY_TURNS);

  // a short follow-up ("and why?") searches with the previous question too
  const prevUser = [...turns].reverse().find(t => t.role === 'user')?.text ?? '';
  const qText = searchTerms(o.question).length < 3 && prevUser ? `${o.question} ${prevUser.slice(0, 300)}` : o.question;
  const lessonTxt = scope === 'lesson' && lesson ? lessonText(lesson) : '';
  const outline = scope === 'course' ? outlineText(data.course, lesson) : '';
  const queries = scope === 'lesson' && lesson
    ? [{ text: qText, weight: 1 }, { text: `${qText} ${lesson.title}`, weight: 0.7 }]
    : [{ text: qText, weight: 1 }];
  const chunks = retrieve(data, queries, MAX_EXCERPTS[scope], scope === 'lesson' ? citedPlaces(lesson) : new Set());
  const room = Math.max(2_000, CONTEXT_CHARS - lessonTxt.length - outline.length);
  const ex = excerptsFor(data, chunks, room);

  const messages: Msg[] = [
    { role: 'system', content: systemPrompt({ course: data.course, scope, lesson, lessonTxt, outline, excerpts: ex.text }) },
    ...turns.map(t => ({ role: t.role, content: clip(t.text, TURN_CHARS) }) as Msg),
    { role: 'user', content: o.question },
  ];
  return { messages, excerpts: ex.list, scope, lessonId: lesson?.id ?? null };
}

async function answer(askId: string, dir: string, o: AssistantAsk & { scope: AssistantScope }, entry: Live,
  send: (e: AssistantEvent) => void): Promise<void> {
  const t0 = Date.now();
  const cfg = activeConfig();
  const who = providerLabel(cfg.provider);
  if (needsKey(cfg.provider) && !cfg.apiKey) throw new AskError('Add your AI key in Settings first.');
  const { messages, excerpts, scope, lessonId } = groundAsk(dir, o);

  // ---- call (streamed)
  const model = cfg.models.fast;
  const url = `${cfg.baseUrl}/chat/completions`;
  const signal = AbortSignal.any([entry.ctl.signal, AbortSignal.timeout(TIMEOUT_MS)]);
  const drop = new Set<string>();
  let res: Response | null = null;
  let viaNet = false;
  for (let attempt = 1; attempt <= 3 && !res; attempt++) {
    const init = { method: 'POST', headers: headers(cfg), body: JSON.stringify(requestBody(cfg, model, messages, drop)), signal };
    let r: Response;
    try {
      r = viaNet ? await net.fetch(url, init) : await fetch(url, init);
    } catch (e) {
      if (signal.aborted) throw e;
      if (!viaNet && isCertError(e)) { viaNet = true; attempt--; continue; }   // TLS-inspecting network: system store
      if (isCertError(e)) throw new AskError(`This network blocked the secure connection to ${who}. Try another network.`);
      if (attempt >= 2) throw new AskError(`Could not reach ${who}. Check the internet connection and try again.`);
      continue;
    }
    if (r.ok && r.body) { res = r; break; }
    const detail = await r.text().catch(() => '');
    if (r.status === 400) {
      const param = OPTIONAL_PARAMS.find(([k, re]) => !drop.has(k) && re.test(detail))?.[0];
      if (param) { drop.add(param); attempt--; continue; }
    }
    if ((r.status === 429 || r.status >= 500) && attempt < 2) { await new Promise(f => setTimeout(f, 800)); continue; }
    throw httpError(who, cfg.provider, r.status, detail);
  }
  if (!res) throw new AskError(`Could not reach ${who}. Check the internet connection and try again.`);

  const at = res.headers.get('date');
  const st: { text: string; usage: RawUsage | null; served: string; finished: boolean } = { text: '', usage: null, served: model, finished: false };
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const onLine = (line: string) => {
    if (!line.startsWith('data:')) return;           // ": OPENROUTER PROCESSING" keep-alives, blank lines
    const raw = line.slice(5).trim();
    if (!raw) return;
    if (raw === '[DONE]') { st.finished = true; return; }
    let j: { choices?: { delta?: { content?: string | null } }[]; usage?: RawUsage; model?: string; error?: { message?: string } };
    try { j = JSON.parse(raw) as typeof j; } catch { return; }
    if (j.error) throw new AskError(`${who} stopped while answering. Try again.`);
    if (j.usage) st.usage = j.usage;
    if (typeof j.model === 'string' && j.model) st.served = j.model;
    const piece = j.choices?.[0]?.delta?.content;                 // never reasoning_content
    if (typeof piece === 'string' && piece) { st.text += piece; send({ askId, type: 'delta', text: piece }); }
  };
  try {
    while (!st.finished) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        onLine(line);
      }
    }
    if (buf.trim()) onLine(buf.trim());
  } catch (e) {
    if (entry.stopped || e instanceof AskError) throw e;
    if (signal.aborted) throw e;
    throw new AskError(st.text ? 'The answer was cut off. Try again.' : `Could not reach ${who}. Check the internet connection and try again.`);
  } finally {
    reader.cancel().catch(() => { /* already closed */ });
  }
  if (entry.stopped) return;
  const text = st.text.trim();
  const usage = st.usage;
  const served = st.served;
  if (!text) throw new AskError(`${who} sent an empty answer. Try again.`);

  // ---- cost (the engine's price table), ledger, cites
  const u: RawUsage = usage ?? {
    prompt_tokens: Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 3.2),
    completion_tokens: Math.ceil(text.length / 3.2),
  };
  const costUsd = round6(costOf(cfg.provider, model, u, at ? new Date(at) : null));
  try {
    recordSpend(cfg, { ts: new Date().toISOString(), course: dir, cmd: 'assistant', provider: cfg.provider, model,
      prompt_tokens: u.prompt_tokens ?? 0, completion_tokens: u.completion_tokens ?? 0, cost_usd: costUsd, cached: false });
  } catch { /* ledger is best effort */ }

  const terms = searchTerms(o.question);
  const cites: AssistantCite[] = citedNumbers(text, excerpts.length).map(n => {
    const e = excerpts[n - 1]!;
    const c: AssistantCite = { n, file: e.file, quote: bestQuote(e.chunk.content, terms) };
    if (e.locator) c.locator = e.locator;
    return c;
  });

  send({ askId, type: 'done', text, cites, costUsd, model: served });

  // ---- crew/assistant.jsonl (the question and answer only; never the key)
  try {
    mkdirSync(join(dir, 'crew'), { recursive: true });
    appendFileSync(join(dir, 'crew', 'assistant.jsonl'), JSON.stringify({
      ts: new Date().toISOString(), scope, lesson: lessonId, question: o.question, answer: text,
      cites: cites.map(c => ({ n: c.n, file: c.file, locator: c.locator })), provider: cfg.provider, model: served,
      cost_usd: costUsd, ms: Date.now() - t0, usage_estimated: usage === null,
    }) + '\n');
  } catch { /* log is best effort */ }
}

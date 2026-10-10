// Run worker: an Electron utilityProcess (main forks it per run; cancel = kill this process).
// Receives one WorkerStart message, calls the engine's runPipeline and posts RunEvents back to main:
//   started    from the `[run] course <dir>` progress line
//   step-start from `[run] <Agent>: <cmd> [lesson]` progress lines
//   step-end   from new lines in <course>/crew/log.jsonl (ok, ms, cost, result; Writers run in parallel, so the
//              `[run]   ok` lines alone cannot be matched to their step)
//   plan       from crew/plan.json right after the plan step ends
//   line       every other progress line, in learner words
//   done/error at the end
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runPipeline } from '@bilimind/engine/run';
import type { RunEvent, WorkerStart } from '../shared/contract.ts';
import { readCard } from '../shared/cards.ts';
import { learnerWords, redact } from '../shared/words.ts';

type Port = { postMessage(m: unknown): void; on(ev: 'message', cb: (e: { data: unknown }) => void): void };
const port = (process as unknown as { parentPort?: Port }).parentPort;

let runId = '';
const post = (e: RunEvent) => {
  if (port) port.postMessage(e);
  else process.stdout.write(JSON.stringify(e) + '\n');   // plain `node run.cjs` debugging
};
const send = (e: Record<string, unknown>) => post({ runId, ...e } as RunEvent);

// ---------- crew/log.jsonl tail ----------
let course = '';
let offset = 0;
let rest = '';
let tail: NodeJS.Timeout | null = null;
let planSent = false;

interface LogLine { agent?: string; cmd?: string; lesson?: string; ok?: boolean; ms?: number; cost_usd?: number; result?: string }

function drainLog(): void {
  if (!course) return;
  const file = join(course, 'crew', 'log.jsonl');
  let size = 0;
  try { size = statSync(file).size; } catch { return; }
  if (size <= offset) return;
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(size - offset);
    readSync(fd, buf, 0, buf.length, offset);
    offset = size;
    rest += buf.toString('utf8');
  } finally { closeSync(fd); }
  const lines = rest.split('\n');
  rest = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.trim()) continue;
    let e: LogLine;
    try { e = JSON.parse(line) as LogLine; } catch { continue; }
    if (!e.cmd || e.cmd === 'init') continue;
    const ok = e.ok !== false;
    const text = e.result ? learnerWords(redact(String(e.result))) : undefined;
    send({
      type: 'step-end', agent: e.agent ?? 'Lead', cmd: e.cmd, ...(e.lesson ? { lesson: e.lesson } : {}), ok,
      ms: Number(e.ms) || 0, costUsd: Number(e.cost_usd) || 0,
      ...(ok ? { result: text } : { error: text }),
    });
    if (e.cmd === 'plan' && ok && !planSent) sendPlan();
  }
}

function sendPlan(): void {
  const p = join(course, 'crew', 'plan.json');
  if (!existsSync(p)) return;
  try {
    const plan = JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')) as {
      start?: string;
      lessons?: { key: string; title?: string; day?: string }[];
      cut?: { key: string; title?: string; reason?: string }[];
    };
    const start = plan.start ? Date.parse(`${plan.start}T00:00:00Z`) : NaN;
    const dayOf = (d?: string): number | undefined => {
      if (!d || Number.isNaN(start)) return undefined;
      const t = Date.parse(`${d}T00:00:00Z`);
      return Number.isNaN(t) ? undefined : Math.round((t - start) / 86_400_000) + 1;
    };
    planSent = true;
    send({
      type: 'plan',
      keep: (plan.lessons ?? []).map(l => ({ key: l.key, title: l.title ?? l.key, ...(dayOf(l.day) ? { day: dayOf(l.day) } : {}) })),
      cut: (plan.cut ?? []).map(c => ({ key: c.key, title: c.title ?? c.key, reason: learnerWords(c.reason ?? '') })),
    });
  } catch { /* plan unreadable: the UI just shows the steps */ }
}

// ---------- progress lines ----------
const COURSE_RE = /^\[run\] course (.+)$/;
const STEP_RE = /^\[run\] (.+): ([a-z][a-z-]*)(?: (\S+))?$/;   // greedy agent: Writer titles contain ": "

function onProgress(raw: string): void {
  const line = raw.replace(/\s+$/, '');
  let m: RegExpMatchArray | null;
  if ((m = line.match(COURSE_RE))) {
    course = resolve(m[1]!);
    send({ type: 'started', course });
    if (!tail) tail = setInterval(drainLog, 400);
    return;
  }
  if (/^\[run\]\s{2,}(ok|FAILED)\b/.test(line)) { drainLog(); return; }   // step-end comes from the log
  if ((m = line.match(STEP_RE))) {
    drainLog();
    send({ type: 'step-start', agent: m[1]!, cmd: m[2]!, ...(m[3] ? { lesson: m[3] } : {}) });
    return;
  }
  const text = learnerWords(redact(line.trim()));
  if (text) send({ type: 'line', text });
}

async function start(o: WorkerStart): Promise<void> {
  runId = o.runId;
  try {
    const data = await runPipeline({
      src: o.src, sentence: o.sentence, outRoot: o.outRoot, template: o.template, narrate: o.narrate,
      progress: onProgress,
    });
    course = resolve(data.course);
    drainLog();
    if (!planSent) sendPlan();
    const card = readCard(course, 'ready') ?? {
      id: course, title: course, sentence: o.sentence, createdAt: new Date().toISOString(), status: 'ready' as const,
      lessons: data.lessons, costUsd: data.cost_usd, wallMs: data.ms,
    };
    card.wallMs ??= data.ms;
    send({ type: 'done', course, card });
  } catch (e) {
    drainLog();
    const err = e as { message?: string; hint?: string };
    // the engine's hints talk about config.json and env vars (CLI words); in the app the key lives in Settings
    const hint = err.hint && /config\.json|_API_KEY|BILIMIND_/.test(err.hint) ? 'Open Settings to check the AI key.' : err.hint;
    const message = (err.message ?? String(e)).replace(/\s*Put the key in .*$/s, ' Open Settings and paste the key again.');
    const msg = [message, hint].filter(Boolean).join(' ');
    send({ type: 'error', message: learnerWords(redact(msg)) });
  } finally {
    if (tail) clearInterval(tail);
    setTimeout(() => process.exit(0), 200);
  }
}

process.on('uncaughtException', e => { send({ type: 'error', message: learnerWords(redact(e.message)) }); setTimeout(() => process.exit(1), 200); });
process.on('unhandledRejection', e => { send({ type: 'error', message: learnerWords(redact(String((e as Error)?.message ?? e))) }); });

if (port) {
  port.on('message', ev => {
    const m = ev.data as WorkerStart;
    if (m && m.type === 'start') void start(m);
  });
} else if (process.argv[2]) {
  // debugging without Electron: node dist/worker/run.cjs '<WorkerStart json>'
  void start(JSON.parse(process.argv[2]) as WorkerStart);
}

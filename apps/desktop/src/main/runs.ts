// Runs: one utilityProcess per run (src/worker -> dist/worker/run.cjs). Cancel kills the process.
import { BrowserWindow, app, utilityProcess, type UtilityProcess } from 'electron';
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { RunEvent, WorkerStart } from '../shared/contract.ts';
import { IPC } from '../shared/contract.ts';
import { liveRuns } from './courses.ts';
import { CLIENT_ID, getSettings } from './settings.ts';

interface Run { id: string; proc: UtilityProcess; course?: string; finished: boolean }
const runs = new Map<string, Run>();

/** In a packaged app, files under app.asar that must be real files live in app.asar.unpacked. */
export const unpacked = (p: string) => p.replace(/([\\/])app\.asar([\\/])/, '$1app.asar.unpacked$2');

/** resources/ (icon, templates, assets): next to the app in dev, process.resourcesPath when packaged. */
export function resourcesDir(): string {
  if (app.isPackaged) return process.resourcesPath;
  return join(app.getAppPath(), 'resources');
}

function workerPath(): string {
  return unpacked(join(__dirname, '..', 'worker', 'run.cjs'));
}

function broadcast(e: RunEvent): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed() && !w.webContents.isDestroyed()) w.webContents.send(IPC.runEvent, e);
  }
}

function onEvent(run: Run, e: RunEvent): void {
  if (run.finished && e.type !== 'step-end') return;
  if (e.type === 'started') { run.course = e.course; liveRuns.set(e.course, 'building'); }
  if (e.type === 'done') { run.finished = true; liveRuns.set(e.course, 'ready'); }
  if (e.type === 'error') { run.finished = true; if (run.course) liveRuns.set(run.course, 'failed'); }
  broadcast(e);
}

export function startRun(o: { src: string; sentence: string }): { runId: string } {
  const src = typeof o?.src === 'string' && o.src.trim() ? resolve(o.src.trim()) : '';
  const sentence = typeof o?.sentence === 'string' ? o.sentence.trim() : '';
  if (!src || !existsSync(src) || !statSync(src).isDirectory()) throw new Error('Pick the folder with your files first.');
  if (!sentence) throw new Error('Write one sentence about what you need.');
  const s = getSettings();
  // the chosen provider when it is ready (BiliMind free is while it is on), else the other own-key pool; never a silent
  // switch to BiliMind free when the learner picked their own key
  const provider = s.keys[s.provider].set ? s.provider : (['deepseek', 'openrouter'] as const).find(p => s.keys[p].set);
  if (!provider) throw new Error('Add your AI key in Settings first.');
  mkdirSync(s.outRoot, { recursive: true });

  const res = resourcesDir();
  const template = join(res, 'templates', 'player.html');
  const assets = join(res, 'assets');
  const runId = randomUUID();
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') env[k] = v;
  if (existsSync(template)) env.BILIMIND_TEMPLATE = template;
  if (existsSync(join(assets, 'obj-book.webp'))) env.BILIMIND_ASSETS = assets;
  env.BILIMIND_PROVIDER = provider;
  env.BILIMIND_CLIENT = CLIENT_ID;   // X-BiliMind-Client on the free service
  delete env.ELECTRON_RUN_AS_NODE;

  const proc = utilityProcess.fork(workerPath(), [], {
    serviceName: 'BiliMind course run', env, stdio: 'pipe',
    // dev: cwd inside the repo so the engine finds .env.local; packaged: the output folder
    cwd: app.isPackaged ? s.outRoot : app.getAppPath(),
  });
  const run: Run = { id: runId, proc, finished: false };
  runs.set(runId, run);
  // the engine writes plain progress to stderr only when no progress callback is given; keep it out of the UI
  // BILIMIND_RUN_LOG=<file> (tests only) keeps the worker's raw output for debugging
  const runLog = process.env.BILIMIND_RUN_LOG;
  const keep = (d: Buffer) => { if (runLog) { try { appendFileSync(runLog, d); } catch { /* ignore */ } } };
  proc.stdout?.on('data', keep);
  proc.stderr?.on('data', keep);
  proc.on('message', (m: unknown) => {
    const e = m as RunEvent;
    if (e && typeof e === 'object' && 'type' in e) onEvent(run, { ...e, runId } as RunEvent);
  });
  proc.on('exit', code => {
    runs.delete(runId);
    if (!run.finished) onEvent(run, { runId, type: 'error', message: code === 0 ? 'The run ended without a course.' : `The run stopped unexpectedly (code ${code}).` });
  });
  const msg: WorkerStart = {
    type: 'start', runId, src, sentence, outRoot: s.outRoot, narrate: s.narrate,
    ...(existsSync(template) ? { template } : {}),
  };
  proc.once('spawn', () => proc.postMessage(msg));
  return { runId };
}

export function cancelRun(runId: string): void {
  const run = runs.get(runId);
  if (!run) return;
  if (!run.finished) onEvent(run, { runId, type: 'error', message: 'Stopped. The files made so far stay in the course folder.' });
  run.proc.kill();
  runs.delete(runId);
}

export function killAllRuns(): void {
  for (const r of runs.values()) { try { r.proc.kill(); } catch { /* gone */ } }
  runs.clear();
}

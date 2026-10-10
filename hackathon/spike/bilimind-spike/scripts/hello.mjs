#!/usr/bin/env node
// bilimind-spike/scripts/hello.mjs
// Probes the WorkBuddy runtime for the BiliMind hackathon spike.
// Never prints the value of an API key or any secret: keys are reported as yes/no only.
//
// Commands (default: info; `--sleep N` alone means sleep):
//   info  [--net] [--out DIR]       shell, node versions, cwd, skill dir, env, keys yes/no, clock (+ network with --net)
//   sleep --sleep 15 --id N [--out DIR]   one "writer": logs start/end to DIR/parallel.jsonl
//   report [--out DIR]              did the writers overlap in time?
//   page  [--out DIR]               writes DIR/spike.html + sample.mp3 + sources/x.pdf for the Preview test
// DIR defaults to ./spike-out under the current working directory.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(SCRIPT_DIR, '..');

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0] || (args.sleep !== undefined ? 'sleep' : 'info');
const OUT_DIR = path.resolve(typeof args.out === 'string' ? args.out : path.join(process.cwd(), 'spike-out'));

function ensureOut() { fs.mkdirSync(OUT_DIR, { recursive: true }); }
function line(k, v) { console.log(`${k}: ${v}`); }
function run(exe, argv, timeout = 8000) {
  try {
    const r = spawnSync(exe, argv, { encoding: 'utf8', timeout, windowsHide: true });
    if (r.error) return { ok: false, out: `error ${r.error.code || r.error.message}` };
    return { ok: r.status === 0, out: (r.stdout || '').trim() || (r.stderr || '').trim() };
  } catch (e) {
    return { ok: false, out: `error ${e.message}` };
  }
}

function configDir() {
  const fromEnv = (process.env.WORKBUDDY_CONFIG_DIR || process.env.CODEBUDDY_CONFIG_DIR || '').trim();
  if (fromEnv) return fromEnv;
  const ai = path.join(os.homedir(), '.workbuddy-ai');
  return fs.existsSync(ai) ? ai : path.join(os.homedir(), '.workbuddy');
}

function bundledNode() {
  const base = path.join(configDir(), 'binaries', 'node', 'versions');
  try {
    const cur = fs.readFileSync(path.join(base, 'current'), 'utf8').trim();
    const exe = path.join(base, cur, process.platform === 'win32' ? 'node.exe' : path.join('bin', 'node'));
    if (!fs.existsSync(exe)) return { path: exe, version: 'missing' };
    const v = run(exe, ['--version']);
    return { path: exe, version: v.out };
  } catch {
    return { path: base, version: 'not found' };
  }
}

function nodesOnPath() {
  const r = run(process.platform === 'win32' ? 'where' : 'which', process.platform === 'win32' ? ['node'] : ['-a', 'node']);
  if (!r.ok) return [];
  return r.out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).slice(0, 4).map((p) => ({ path: p, version: run(p, ['--version']).out }));
}

function parentProcessName() {
  if (process.platform === 'win32') {
    const r = run('tasklist', ['/FI', `PID eq ${process.ppid}`, '/FO', 'CSV', '/NH']);
    const m = r.out.match(/^"([^"]+)"/m);
    return m ? m[1] : 'unknown';
  }
  return run('ps', ['-o', 'comm=', '-p', String(process.ppid)]).out || 'unknown';
}

function shellGuess(parent) {
  const p = parent.toLowerCase();
  if (p.includes('bash') || process.env.MSYSTEM) return `Git Bash (MSYSTEM=${process.env.MSYSTEM || '-'})`;
  if (p.includes('pwsh')) return 'PowerShell 7 (pwsh)';
  if (p.includes('powershell')) return 'Windows PowerShell 5.1';
  if (p.includes('cmd')) return 'cmd.exe';
  return `unknown (parent ${parent})`;
}

const SAFE_VALUE_VARS = new Set([
  'CODEBUDDY_SKILL_DIR', 'CLAUDE_SKILL_DIR', 'WORKBUDDY_CONFIG_DIR', 'CODEBUDDY_CONFIG_DIR',
  'WORKBUDDY_DATA_FOLDER_NAME', 'CODEBUDDY_CODE_MAX_CONCURRENT_SUBAGENTS', 'WORKBUDDY_APP_NAME',
  'WORKBUDDY_LOCALE', 'CODEBUDDY_PLUGIN_ROOT',
]);

function envReport() {
  const names = Object.keys(process.env)
    .filter((k) => /^(CODEBUDDY|WORKBUDDY)_/i.test(k) || /^CLAUDE_(SKILL_DIR|PLUGIN_ROOT|SESSION_ID)$/i.test(k))
    .sort();
  const shown = {};
  for (const k of names) {
    const up = k.toUpperCase();
    if (SAFE_VALUE_VARS.has(up)) shown[k] = process.env[k];
    else if (up === 'CODEBUDDY_SESSION_ID' || up === 'CLAUDE_SESSION_ID') shown[k] = `${String(process.env[k]).slice(0, 8)}... (set)`;
    else shown[k] = '(set, value hidden)';
  }
  return shown;
}

function keyState(name) {
  const v = process.env[name];
  return v && v.trim() ? 'yes' : 'no';
}

async function probe(url) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(7000), redirect: 'manual' });
    const ms = Date.now() - t0;
    const date = res.headers.get('date');
    const skew = date ? Math.round((Date.parse(date) - (t0 + ms / 2)) / 1000) : null;
    return { url, ok: true, status: res.status, ms, server_date: date, clock_skew_s: skew };
  } catch (e) {
    return { url, ok: false, ms: Date.now() - t0, error: (e.cause && (e.cause.code || e.cause.message)) || e.name || e.message };
  }
}

async function cmdInfo() {
  ensureOut();
  // fresh run: reset the parallel log
  try { fs.writeFileSync(path.join(OUT_DIR, 'parallel.jsonl'), ''); } catch {}
  const parent = parentProcessName();
  const now = new Date();
  const info = {
    time_local: now.toString(),
    time_utc: now.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    utc_offset_min: -now.getTimezoneOffset(),
    platform: `${process.platform} ${os.release()} ${process.arch}`,
    shell_guess: shellGuess(parent),
    parent_process: parent,
    env_SHELL: process.env.SHELL || '-',
    env_ComSpec: process.env.ComSpec || '-',
    node_running_this: `${process.version} at ${process.execPath}`,
    node_on_path: nodesOnPath(),
    node_bundled: bundledNode(),
    cwd: process.cwd(),
    out_dir: OUT_DIR,
    script_dir: SCRIPT_DIR,
    skill_root_from_script: SKILL_ROOT,
    config_dir: configDir(),
    env_vars: envReport(),
    DEEPSEEK_API_KEY_set: keyState('DEEPSEEK_API_KEY'),
    OPENROUTER_API_KEY_set: keyState('OPENROUTER_API_KEY'),
    bilimind_config_json_exists: fs.existsSync(path.join(os.homedir(), '.bilimind', 'config.json')) ? 'yes' : 'no',
    write_test: 'pending',
  };
  try {
    const p = path.join(OUT_DIR, 'write-test.txt');
    fs.writeFileSync(p, `written ${now.toISOString()}\n`);
    info.write_test = `ok (${p})`;
  } catch (e) {
    info.write_test = `FAILED ${e.code || e.message}`;
  }
  if (args.net) {
    info.network = await Promise.all([
      probe('https://api.deepseek.com/'),
      probe('https://openrouter.ai/api/v1/models'),
      probe('https://speech.platform.bing.com/'),
      probe('https://cdn.jsdelivr.net/npm/mermaid@11/package.json'),
    ]);
    const skews = info.network.filter((n) => n.ok && typeof n.clock_skew_s === 'number').map((n) => n.clock_skew_s);
    if (skews.length) {
      const med = skews.sort((a, b) => a - b)[Math.floor(skews.length / 2)];
      info.clock_check = Math.abs(med) > 120
        ? `WRONG: this PC's clock is off by ${med} s (${(med / 3600).toFixed(1)} h) vs internet servers; fix Windows time before Edge TTS`
        : `ok (within ${Math.abs(med)} s of internet servers)`;
    }
  } else info.network = 'skipped (add --net)';

  console.log('=== bilimind-spike info ===');
  for (const [k, v] of Object.entries(info)) {
    if (k === 'node_on_path') {
      if (!v.length) line(k, 'none found');
      v.forEach((n, i) => line(`${k}[${i}]`, `${n.version} at ${n.path}`));
    } else if (k === 'node_bundled') line(k, `${v.version} at ${v.path}`);
    else if (k === 'env_vars') {
      const keys = Object.keys(v);
      if (!keys.length) line(k, 'none of CODEBUDDY_* / WORKBUDDY_* / CLAUDE_SKILL_DIR set');
      for (const e of keys) line(`env.${e}`, v[e]);
    } else if (k === 'network' && Array.isArray(v)) {
      for (const n of v) {
        line(`net ${n.url}`, n.ok ? `HTTP ${n.status} in ${n.ms} ms, server clock skew ${n.clock_skew_s ?? '?'} s` : `FAILED ${n.error} after ${n.ms} ms`);
      }
    } else line(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  fs.writeFileSync(path.join(OUT_DIR, 'info.json'), JSON.stringify(info, null, 2));
  console.log(`saved: ${path.join(OUT_DIR, 'info.json')}`);
}

async function cmdSleep() {
  ensureOut();
  const id = String(args.id ?? '?');
  const secs = Math.max(0, Math.min(120, Number(args.sleep === true ? 15 : args.sleep ?? 15)));
  const log = path.join(OUT_DIR, 'parallel.jsonl');
  const start = new Date();
  fs.appendFileSync(log, JSON.stringify({ id, event: 'start', t: start.toISOString(), pid: process.pid, sleep_s: secs }) + '\n');
  console.log(`[writer ${id}] start ${start.toISOString()} pid ${process.pid} cwd ${process.cwd()}`);
  await new Promise((r) => setTimeout(r, secs * 1000));
  const end = new Date();
  fs.appendFileSync(log, JSON.stringify({ id, event: 'end', t: end.toISOString(), pid: process.pid }) + '\n');
  console.log(`[writer ${id}] done ${end.toISOString()} after ${((end - start) / 1000).toFixed(1)} s (node ${process.version})`);
}

function cmdReport() {
  const log = path.join(OUT_DIR, 'parallel.jsonl');
  if (!fs.existsSync(log)) { console.log(`no log at ${log}`); process.exitCode = 1; return; }
  const rows = fs.readFileSync(log, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const byId = new Map();
  for (const r of rows) {
    const cur = byId.get(r.id) || {};
    if (r.event === 'start') { cur.start = Date.parse(r.t); cur.end = undefined; cur.sleep = r.sleep_s; }
    if (r.event === 'end') cur.end = Date.parse(r.t);
    byId.set(r.id, cur);
  }
  const ws = [...byId.entries()].map(([id, v]) => ({ id, ...v })).filter((w) => w.start);
  if (!ws.length) { console.log('no writer runs logged'); process.exitCode = 1; return; }
  ws.sort((a, b) => a.start - b.start);
  const t0 = ws[0].start;
  const finished = ws.filter((w) => w.end);
  const spread = (ws[ws.length - 1].start - t0) / 1000;
  const wall = finished.length ? (Math.max(...finished.map((w) => w.end)) - t0) / 1000 : null;
  const allOverlap = finished.length === ws.length && Math.max(...ws.map((w) => w.start)) < Math.min(...ws.map((w) => w.end));
  const sleep = ws[0].sleep || 15;
  let verdict;
  if (ws.length < 2) verdict = 'ONLY ONE WRITER LOGGED (cannot judge parallelism)';
  else if (finished.length < ws.length) verdict = 'INCOMPLETE (some writers never logged an end)';
  else if (allOverlap && spread < sleep / 2) verdict = 'PARALLEL (all writers ran at the same time)';
  else if (allOverlap) verdict = 'PARTLY PARALLEL (overlapping, but starts were staggered)';
  else verdict = 'SEQUENTIAL (writers did not overlap)';
  console.log('=== bilimind-spike parallel report ===');
  for (const w of ws) {
    console.log(`writer ${w.id}: start +${((w.start - t0) / 1000).toFixed(1)} s, end ${w.end ? '+' + ((w.end - t0) / 1000).toFixed(1) + ' s' : 'missing'}`);
  }
  line('writers', ws.length);
  line('start_spread_s', spread.toFixed(1));
  line('wall_s', wall === null ? 'n/a' : wall.toFixed(1));
  line('sequential_would_take_s', (sleep * ws.length).toFixed(0));
  line('verdict', verdict);
  fs.writeFileSync(path.join(OUT_DIR, 'parallel-report.json'), JSON.stringify({ writers: ws.length, start_spread_s: spread, wall_s: wall, verdict }, null, 2));
}

function cmdPage() {
  ensureOut();
  const assets = path.join(SKILL_ROOT, 'assets');
  fs.mkdirSync(path.join(OUT_DIR, 'sources'), { recursive: true });
  fs.copyFileSync(path.join(assets, 'spike.html'), path.join(OUT_DIR, 'spike.html'));
  fs.copyFileSync(path.join(assets, 'sample.mp3'), path.join(OUT_DIR, 'sample.mp3'));
  fs.copyFileSync(path.join(assets, 'sample.pdf'), path.join(OUT_DIR, 'sources', 'x.pdf'));
  const page = path.join(OUT_DIR, 'spike.html');
  console.log('=== bilimind-spike page ===');
  line('page', page);
  line('page_url', pathToFileURL(page).href);
  line('mp3', path.join(OUT_DIR, 'sample.mp3'));
  line('pdf', path.join(OUT_DIR, 'sources', 'x.pdf'));
  line('next', 'call present_files with the page path above to open it in the Preview panel');
}

const commands = { info: cmdInfo, sleep: cmdSleep, report: cmdReport, page: cmdPage };
const fn = commands[cmd];
if (!fn) {
  console.log(`unknown command "${cmd}". Use: info [--net] | --sleep N --id N | report | page   (all take --out DIR)`);
  process.exitCode = 2;
} else {
  try { await fn(); } catch (e) { console.log(`FAILED ${cmd}: ${e.stack || e.message}`); process.exitCode = 1; }
}

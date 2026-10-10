// Main-process smoke test: launch the built app hidden (BILIMIND_E2E=1, show:false), drive it over CDP with
// raw CDP (puppeteer-core's connect() hangs against Electron 44's browser target, so this talks to the page target
// directly over WebSocket), check window.bilimind, settings (in a temp BILIMIND_HOME, fake key) and courses.list() with
// BILIMIND_EXAMPLES=showcase/courses. Never runs a generation. Kills electron at the end.
// Usage: node scripts/e2e-main.mjs [--exe "release/win-unpacked/BiliMind Desktop.exe"]   (after node scripts/build.mjs)
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..');
const repo = join(app, '..', '..');
const require = createRequire(import.meta.url);
const electronExe = require('electron');
const port = process.env.BILIMIND_CDP_PORT || '9333';
const home = mkdtempSync(join(tmpdir(), 'bm-e2e-home-'));
const outRoot = mkdtempSync(join(tmpdir(), 'bm-e2e-out-'));
// a config with fields the app must keep
writeFileSync(join(home, 'config.json'), JSON.stringify({ provider: 'deepseek', models: { deepseek: { fast: 'x' } }, caps: { run_usd: 0.25 } }));

const env = { ...process.env, BILIMIND_E2E: '1', BILIMIND_CDP_PORT: port, BILIMIND_HOME: home, BILIMIND_NO_ENV_LOCAL: '1',
  BILIMIND_EXAMPLES: join(repo, 'showcase', 'courses') };
delete env.ELECTRON_RUN_AS_NODE;
delete env.DEEPSEEK_API_KEY; delete env.OPENROUTER_API_KEY;
// --exe <packaged exe>: test the packaged app (release/win-unpacked/BiliMind Desktop.exe) instead of `electron .`
const exeIdx = process.argv.indexOf('--exe');
const child = exeIdx > 0
  ? spawn(process.argv[exeIdx + 1], [], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  : spawn(electronExe, [app], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
child.stdout.on('data', d => { log += d; });
child.stderr.on('data', d => { log += d; });

let failed = 0;
const check = (name, ok, extra = '') => { if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? `  ${extra}` : ''}`); };

console.log('spawned electron', child.pid);
let ws;
let seq = 0;
const pending = new Map();
function cdp(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}
/** page.evaluate equivalent: fn is serialised, arg passed as JSON; promises are awaited. */
async function evaluate(fn, arg) {
  const expression = `(${fn.toString()})(${arg === undefined ? '' : JSON.stringify(arg)})`;
  const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}
const page = {
  evaluate,
  async waitForFunction(fn, { timeout = 10000 } = {}) {
    const t = Date.now();
    while (Date.now() - t < timeout) { if (await evaluate(fn)) return; await new Promise(r => setTimeout(r, 200)); }
    throw new Error('waitForFunction timed out');
  },
  async screenshot({ path }) {
    const r = await cdp('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path, Buffer.from(r.data, 'base64'));
  },
};

try {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find(t => t.type === 'page' && /^(file|http)/.test(t.url));
    } catch { /* not up yet */ }
    if (!target) await new Promise(r => setTimeout(r, 500));
  }
  if (!target) throw new Error(`no app page on CDP ${port}\n${log}`);
  console.log('target', target.url);
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP socket failed')); });
  ws.onmessage = ev => {
    const m = JSON.parse(String(ev.data));
    const p = m.id && pending.get(m.id);
    if (p) { pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  };
  await page.waitForFunction(() => !!window.bilimind, { timeout: 15000 });
  const shape = await page.evaluate(() => ({
    keys: Object.keys(window.bilimind).sort(), platform: window.bilimind.platform,
    settings: Object.keys(window.bilimind.settings).sort(), courses: Object.keys(window.bilimind.courses).sort(), run: Object.keys(window.bilimind.run).sort(),
    hasRequire: typeof window.require, hasProcess: typeof window.process,
  }));
  check('window.bilimind keys', JSON.stringify(shape.keys) === JSON.stringify(['courses', 'inspectFolder', 'openExternal', 'pickFolder', 'platform', 'run', 'settings']), JSON.stringify(shape.keys));
  check('settings/courses/run methods', shape.settings.join() === 'get,save,testKey' && shape.courses.join() === 'get,list,openFile,playerUrl,remove,reveal' && shape.run.join() === 'cancel,onEvent,start');
  check('platform sync value', shape.platform === 'win32' || typeof shape.platform === 'string', shape.platform);
  check('no node in renderer', shape.hasRequire === 'undefined' && shape.hasProcess === 'undefined');

  const s0 = await page.evaluate(() => window.bilimind.settings.get());
  check('settings.get', s0.provider === 'deepseek' && s0.keys.deepseek.set === false && s0.narrate === true && /BiliMind$/.test(s0.outRoot) && !!s0.version, JSON.stringify({ ...s0, outRoot: '...' }));
  const s1 = await page.evaluate(o => window.bilimind.settings.save({ key: { provider: 'openrouter', value: 'sk-or-e2e-fake-wxyz' }, narrate: false, outRoot: o }), outRoot);
  const cfg = JSON.parse(readFileSync(join(home, 'config.json'), 'utf8'));
  check('settings.save key (last4 only)', s1.keys.openrouter.set && s1.keys.openrouter.last4 === 'wxyz' && !JSON.stringify(s1).includes('fake'));
  check('config.json merged', cfg.keys.openrouter === 'sk-or-e2e-fake-wxyz' && cfg.models?.deepseek?.fast === 'x' && cfg.caps?.run_usd === 0.25 && cfg.provider === 'deepseek' && cfg.desktop?.narrate === false);
  const tk = await page.evaluate(() => window.bilimind.settings.testKey('deepseek'));
  check('testKey without key', tk.ok === false && /No DeepSeek key/.test(tk.error ?? ''), JSON.stringify(tk));

  const list = await page.evaluate(() => window.bilimind.courses.list());
  const ds = list.find(c => c.id.endsWith('ds-final'));
  check('courses.list examples', list.length >= 3 && !!ds, list.map(c => `${c.title} [${c.status}, ${c.lessons} lessons]`).join(' | '));
  check('ds-final card', ds && ds.status === 'ready' && ds.lessons === 3 && ds.checks?.total > 0 && ds.codeTests?.total > 0 && typeof ds.costUsd === 'number' && ds.wallMs > 0 && !!ds.sentence && !!ds.createdAt,
    JSON.stringify(ds));
  const got = await page.evaluate(id => window.bilimind.courses.get(id), ds.id);
  check('courses.get', got?.title === ds.title);
  const url = await page.evaluate(id => window.bilimind.courses.playerUrl(id), ds.id);
  check('courses.playerUrl', /^file:\/\/\/.*ds-final\/index\.html$/.test(url), url);
  const bad = await page.evaluate(() => window.bilimind.courses.playerUrl('C:\\Windows').then(() => 'resolved', e => e.message));
  check('unknown course id refused', bad === 'Unknown course.', bad);
  const rm = await page.evaluate(id => window.bilimind.courses.remove(id).then(() => 'removed', e => e.message), ds.id);
  check('examples cannot be removed', /cannot be removed/.test(rm), rm);
  const insp = await page.evaluate(p => window.bilimind.inspectFolder(p), join(repo, 'showcase', 'sources', 'ds-final'));
  check('inspectFolder', insp.files.length > 0 && insp.files.some(f => f.role === 'past_paper'), insp.files.map(f => `${f.name}:${f.role}`).join(', '));
  const unsub = await page.evaluate(() => { const u = window.bilimind.run.onEvent(() => {}); return typeof u; });
  check('run.onEvent returns unsubscribe', unsub === 'function');
  const noKeyRun = await page.evaluate(() => window.bilimind.run.start({ src: '', sentence: 'x' }).then(() => 'started', e => e.message));
  check('run.start validates input', /Pick the folder/.test(noKeyRun), noKeyRun);
  const ext = await page.evaluate(() => window.bilimind.openExternal('file:///C:/Windows').then(() => 'opened', e => e.message));
  check('openExternal refuses file:', /Only web links/.test(ext), ext);
  // a run with a fake key: the worker must start, report the first steps, and fail cleanly at the first AI call
  const src = mkdtempSync(join(tmpdir(), 'bm-e2e-src-'));
  writeFileSync(join(src, 'week1-notes.md'), ['# Week 1: Hash tables', '',
    'A hash function maps a key to a slot. Collisions are resolved by chaining or probing.', ''].join('\n').repeat(20));
  // drag and drop a folder onto the page (CDP drag events with a real path): preload -> main -> pickFolder()
  const zone = await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(n => n.childElementCount < 6 && /Drag a folder here/.test(n.textContent ?? '') && n.getBoundingClientRect().height > 60);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (zone) {
    await page.evaluate(() => { window.__drops = []; window.addEventListener('drop', e => window.__drops.push(e.dataTransfer?.files?.length ?? -1), true); });
    const data = { items: [], files: [src], dragOperationsMask: 1 };
    for (const type of ['dragEnter', 'dragOver', 'drop']) await cdp('Input.dispatchDragEvent', { type, x: zone.x, y: zone.y, data });
    let shown = false;
    for (let i = 0; i < 20 && !shown; i++) { shown = await page.evaluate(() => document.body.innerText.includes('week1-notes')); if (!shown) await new Promise(r => setTimeout(r, 250)); }
    const drops = await page.evaluate(() => window.__drops);
    if (!drops.length) console.log('  (drop check skipped: CDP drag events do not reach the offscreen test window)');
    else check('drop a folder on the page', shown, JSON.stringify(drops));
  } else console.log('  (drop zone not found: renderer layout changed, drop check skipped)');
  await page.evaluate(() => { window.__ev = []; window.bilimind.run.onEvent(e => window.__ev.push(e)); });
  const started = await page.evaluate(o => window.bilimind.run.start(o), { src, sentence: 'My quiz is in 3 days, 20 minutes a day.' });
  check('run.start returns runId', typeof started?.runId === 'string', started?.runId);
  let evs = [];
  for (let i = 0; i < 90; i++) {
    evs = await page.evaluate(() => window.__ev);
    if (evs.some(e => e.type === 'error' || e.type === 'done')) break;
    await new Promise(r => setTimeout(r, 500));
  }
  const types = evs.map(e => e.type + (e.cmd ? `:${e.cmd}` : ''));
  console.log(`  events: ${types.join(' ')}`);
  for (const e of evs.filter(x => x.type === 'line' || x.type === 'step-end')) console.log(`    ${e.type}: ${e.text ?? `${e.agent} ${e.cmd} ${e.ok ? 'ok' : 'failed'} ${e.ms} ms ${e.result ?? e.error ?? ''}`}`.slice(0, 220));
  const last = evs.find(e => e.type === 'error' || e.type === 'done');
  console.log(`  end: ${last ? JSON.stringify(last).slice(0, 300) : '(none)'}`);
  check('worker events', evs.some(e => e.type === 'started') && evs.some(e => e.type === 'step-start' && e.cmd === 'ingest')
    && evs.some(e => e.type === 'step-end' && e.cmd === 'ingest' && e.ok && typeof e.ms === 'number') && !!last && evs.every(e => e.runId === started.runId));
  const listAfter = await page.evaluate(() => window.bilimind.courses.list());
  check('failed run listed', listAfter.some(c => c.status === 'failed' && c.sentence.startsWith('My quiz')), listAfter.map(c => `${c.title}:${c.status}`).join(' | '));
  rmSync(src, { recursive: true, force: true });

  const shot = join(tmpdir(), 'bm-e2e-main.png');
  try {
    await Promise.race([page.screenshot({ path: shot }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]);
    console.log(`screenshot ${shot}`);
  } catch (e) { console.log(`screenshot skipped (${e.message})`); }
} catch (e) {
  failed++;
  console.error('ERROR', e.message);
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  // the portable exe is a launcher that starts the real app as a child: kill the whole tree first
  if (process.platform === 'win32' && child.exitCode === null) {
    await new Promise(r => spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }).on('exit', r));
  }
  child.kill();
  await new Promise(r => setTimeout(r, 800));
  rmSync(home, { recursive: true, force: true });
  rmSync(outRoot, { recursive: true, force: true });
}
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);

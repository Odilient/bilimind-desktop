// Tiny raw-CDP helper (puppeteer-core connect hangs against Electron 44's browser target).
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function launch({ exe, args = [], env, port, logFile }) {
  const e = { ...process.env, ...env, BILIMIND_E2E: '1', BILIMIND_CDP_PORT: String(port) };
  delete e.ELECTRON_RUN_AS_NODE;
  const child = spawn(exe, args, { env: e, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', d => { log += d; });
  child.stderr.on('data', d => { log += d; });
  child.getLog = () => log;
  return child;
}

export async function connect(port, pred = t => t.type === 'page' && /^(file|http)/.test(t.url), tries = 80) {
  let target;
  for (let i = 0; i < tries && !target; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find(pred);
    } catch { /* not up */ }
    if (!target) await sleep(500);
  }
  if (!target) throw new Error('no CDP target on ' + port);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws failed')); });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(String(ev.data));
    const p = m.id && pending.get(m.id);
    if (p) { pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  };
  const cdp = (method, params = {}) => { const id = ++seq; ws.send(JSON.stringify({ id, method, params })); return new Promise((res, rej) => pending.set(id, { res, rej })); };
  const evaluate = async (fn, arg) => {
    const expression = typeof fn === 'string' ? fn : `(${fn.toString()})(${arg === undefined ? '' : JSON.stringify(arg)})`;
    const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };
  const waitFor = async (fn, timeout = 15000, arg) => {
    const t = Date.now();
    while (Date.now() - t < timeout) { try { const v = await evaluate(fn, arg); if (v) return v; } catch { /* reload */ } await sleep(250); }
    throw new Error('waitFor timed out: ' + fn.toString().slice(0, 120));
  };
  const shot = async path => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(path, Buffer.from(r.data, 'base64')); };
  const click = (text, sel = 'button,[role=button]') => evaluate(([t, s]) => {
    const el = [...document.querySelectorAll(s)].find(n => (n.innerText || n.getAttribute('aria-label') || n.title || '').includes(t));
    if (!el) return false; el.click(); return true;
  }, [text, sel]);
  return { ws, cdp, evaluate, waitFor, shot, click, target, close: () => ws.close() };
}

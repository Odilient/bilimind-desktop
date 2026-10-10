// Phase 2: a REAL run through the UI with the real key in %USERPROFILE%\.bilimind\config.json (never printed).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, connect, sleep } from './cdp.mjs';

const app = 'C:/oybek/projects/bilimind/bilimind-desktop/apps/desktop';
const repo = 'C:/oybek/projects/bilimind/bilimind-desktop';
const tag = process.env.TAG || 'run1';
const out = join(import.meta.dirname, '..', '..', 'shots', 'e2e', tag);
mkdirSync(out, { recursive: true });
const require = createRequire(app + '/package.json');
const exe = process.env.EXE || require('electron');
const port = 9342;
const env = {
  BILIMIND_EXAMPLES: join(repo, 'showcase', 'courses'), BILIMIND_E2E_PICK: 'C:\\Demo\\DS-Final',
  BILIMIND_RUN_LOG: join(out, 'worker.log'),
};
const SENTENCE = "My Data Structures final is Wednesday 9am. The slides and last year's paper are in this folder. I have 45 minutes a day. Get me ready.";
const child = launch({ exe, args: process.env.EXE ? [] : [app], env, port });
const t0 = Date.now();
const el = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;
try {
  const p = await connect(port);
  await p.waitFor(() => !!window.bilimind && document.querySelector('.home'), 20000);
  const s = await p.evaluate(() => window.bilimind.settings.save({ provider: 'deepseek', narrate: true, outRoot: 'C:\\Demo\\BiliMind-out' }));
  console.log('settings', JSON.stringify({ provider: s.provider, deepseek: s.keys.deepseek.set, narrate: s.narrate, outRoot: s.outRoot }));
  if (!s.keys.deepseek.set) throw new Error('no deepseek key');
  await p.evaluate(() => location.reload());
  await sleep(1000);
  await p.waitFor(() => !!window.bilimind && document.querySelector('.home .cards .card') && document.querySelector('.go'), 20000);
  await sleep(1500);
  await p.shot(join(out, 'home-key.png'));
  await p.evaluate(s => {
    const ta = document.querySelector('#sentence');
    ta.value = s; ta.dispatchEvent(new Event('input'));
    document.querySelector('.drop').click();
  }, SENTENCE);
  await p.waitFor(() => document.querySelectorAll('.files .file').length > 0, 10000);
  await sleep(800);
  await p.shot(join(out, 'home-folder.png'));
  await p.evaluate(() => { window.__ev = []; window.bilimind.run.onEvent(e => window.__ev.push({ at: Date.now(), ...e })); });
  const clicked = await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Build my course/.test(x.innerText)); if (!b || b.disabled) return false; b.click(); return true; });
  console.log('build clicked', clicked);
  if (!clicked) throw new Error('build button not clickable');
  const tStart = Date.now();
  let n = 0, lastShot = 0, end = null, seen = 0;
  while (Date.now() - tStart < 40 * 60_000) {
    await sleep(2000);
    const st = await p.evaluate(() => ({ n: window.__ev.length, screen: document.querySelector('.main > *')?.className ?? '', end: window.__ev.find(e => e.type === 'done' || e.type === 'error') ?? null }));
    if (st.n > seen) {
      const evs = await p.evaluate(() => window.__ev);
      for (const e of evs.slice(seen)) {
        const x = e.type === 'step-end' ? `${e.agent} ${e.cmd} ${e.lesson ?? ''} ${e.ok ? 'ok' : 'FAIL'} ${e.ms}ms $${e.costUsd} ${(e.result ?? e.error ?? '').slice(0, 90)}`
          : e.type === 'step-start' ? `${e.agent} > ${e.cmd} ${e.lesson ?? ''}` : e.type === 'plan' ? `PLAN keep ${e.keep.map(k => `${k.title}(d${k.day})`).join(', ')} cut ${e.cut.length}`
          : e.type === 'line' ? `line: ${e.text.slice(0, 100)}` : `${e.type} ${e.message ?? e.course ?? ''}`;
        console.log(`[${el()}] ${x}`);
      }
      seen = evs.length;
      writeFileSync(join(out, 'events.json'), JSON.stringify(evs, null, 1));
    }
    if (Date.now() - lastShot > 15000 && /bld/.test(st.screen)) { lastShot = Date.now(); await p.shot(join(out, `building-${String(++n).padStart(2, '0')}.png`)); }
    if (st.end) { end = st.end; break; }
  }
  console.log(`[${el()}] END`, end?.type, end?.message ?? '', JSON.stringify(end?.card ?? {}));
  if (end?.type === 'done') {
    await p.shot(join(out, `building-${String(++n).padStart(2, '0')}-done.png`));
    await p.waitFor(() => /finished|fin/.test(document.querySelector('.main > *')?.className ?? '') || [...document.querySelectorAll('button')].some(b => /Open course/.test(b.innerText)), 15000);
    await sleep(1500);
    await p.shot(join(out, 'finished.png'));
    await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /Open course/.test(b.innerText)).click());
    await p.waitFor(() => !!document.querySelector('webview'), 10000);
    const wv = await connect(port, t => t.type === 'webview' && /BiliMind-out/i.test(decodeURIComponent(t.url)), 40);
    await wv.waitFor(() => document.readyState === 'complete' && document.body.innerText.length > 100, 15000);
    await sleep(2500);
    const play = await wv.evaluate(async () => {
      const orig = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () { this.muted = true; window.__a = this; return orig.call(this); };
      const b = [...document.querySelectorAll('button')].find(x => /hear the plan|^play|listen/i.test(x.getAttribute('aria-label') || x.innerText || ''));
      if (!b) return 'no play button';
      b.click();
      for (let i = 0; i < 30 && !(window.__a && window.__a.currentTime > 0.3); i++) await new Promise(r => setTimeout(r, 200));
      const a = window.__a; if (!a) return 'nothing played';
      a.currentTime = Math.min(20, (a.duration || 30) / 2); await new Promise(r => setTimeout(r, 600));
      const t1 = a.currentTime; a.pause();
      return `played; seek -> ${t1.toFixed(1)}s of ${(a.duration || 0).toFixed(1)}s`;
    });
    console.log('course audio:', play);
    await p.shot(join(out, 'course.png'));
    wv.close();
  }
  p.close();
} catch (e) {
  console.log('ERROR', e.message);
  console.log(child.getLog().slice(-2000));
} finally {
  child.kill();
  await sleep(800);
  console.log('killed electron');
}

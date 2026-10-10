// Phase 1: examples, course player, settings, folder picked. No AI calls. Uses a temp BILIMIND_HOME with a fake key
// unless --real-home (then the real config.json is read; nothing is printed from it).
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, connect, sleep } from './cdp.mjs';

const app = 'C:/oybek/projects/bilimind/bilimind-desktop/apps/desktop';
const repo = 'C:/oybek/projects/bilimind/bilimind-desktop';
const out = process.env.SHOTS || join(import.meta.dirname, '..', '..', 'shots', 'e2e');
mkdirSync(out, { recursive: true });
const require = createRequire(app + '/package.json');
const exe = process.env.EXE || require('electron');
const port = 9341;
const env = { BILIMIND_EXAMPLES: join(repo, 'showcase', 'courses'), BILIMIND_E2E_PICK: 'C:\\Demo\\DS-Final' };
if (!process.argv.includes('--real-home')) {
  const home = mkdtempSync(join(tmpdir(), 'bm-pre-home-'));
  writeFileSync(join(home, 'config.json'), JSON.stringify({ provider: 'deepseek', keys: { deepseek: 'sk-fake-e2e-0000abcd' }, desktop: { outRoot: 'C:/Demo/BiliMind-out', narrate: true } }));
  env.BILIMIND_HOME = home; env.BILIMIND_NO_ENV_LOCAL = '1';
}
if (process.env.OSR === '0') env.BILIMIND_E2E_OSR = '0';
const child = launch({ exe, args: process.env.EXE ? [] : [app], env, port });
const results = [];
const check = (n, ok, x = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${x}`); };
try {
  const p = await connect(port);
  await p.waitFor(() => !!window.bilimind && document.querySelector('.home .cards .card'), 20000);
  await sleep(1500);
  const list = await p.evaluate(() => window.bilimind.courses.list());
  check('3 example courses listed', list.length >= 3, list.map(c => c.title).join(' | '));
  await p.shot(join(out, 'home.png'));
  // settings panel
  await p.evaluate(() => document.querySelector('.gear').click());
  await sleep(900);
  await p.shot(join(out, 'settings.png'));
  await p.evaluate(() => document.querySelector('.gear').click());
  await sleep(600);
  // folder picked + sentence
  await p.evaluate(() => {
    const ta = document.querySelector('#sentence');
    ta.value = "My Data Structures final is Wednesday 9am. The slides and last year's paper are in this folder. I have 45 minutes a day. Get me ready.";
    ta.dispatchEvent(new Event('input'));
    document.querySelector('.drop').click();
  });
  await p.waitFor(() => document.querySelectorAll('.files .file').length > 0, 10000);
  await sleep(500);
  const roles = await p.evaluate(() => [...document.querySelectorAll('.files .file')].map(f => f.innerText.replace(/\s+/g, ' ')));
  check('folder inspected', roles.length === 5, roles.join(' | '));
  await p.shot(join(out, 'home-folder.png'));
  // open ds-final
  await p.evaluate(() => { document.querySelector('.home').scrollTop = 0; });
  const opened = await p.evaluate(() => {
    const c = [...document.querySelectorAll('.home .cards .card')].find(n => /data structures/i.test(n.innerText));
    if (!c) return false; c.click(); return true;
  });
  check('clicked ds-final card', opened);
  await p.waitFor(() => !!document.querySelector('webview'), 10000);
  const wv = await connect(port, t => t.type === 'webview' && /ds-final/.test(t.url), 40);
  await wv.waitFor(() => document.readyState === 'complete' && document.body.innerText.length > 100, 15000);
  await sleep(2500);
  const btns = await wv.evaluate(() => [...document.querySelectorAll('button')].map(b => (b.getAttribute('aria-label') || b.innerText || '').trim().slice(0, 40)).filter(Boolean).slice(0, 40));
  console.log('player buttons:', btns.join(' | '));
  const play = await wv.evaluate(async () => {
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { this.muted = true; window.__a = this; return orig.call(this); };
    const want = [/^(play|listen)/i, /hear the plan/i, /play|listen|narrat/i];
    let b; for (const re of want) { b = [...document.querySelectorAll('button')].find(x => re.test(x.getAttribute('aria-label') || x.innerText || '')); if (b) break; }
    if (!b) return 'no play button';
    const label = (b.getAttribute('aria-label') || b.innerText).trim().slice(0, 30);
    b.click();
    for (let i = 0; i < 30 && !(window.__a && window.__a.currentTime > 0.3); i++) await new Promise(r => setTimeout(r, 200));
    const a = window.__a; if (!a) return 'clicked ' + label + ' but nothing played';
    const t0 = a.currentTime; a.currentTime = Math.min(20, (a.duration || 30) / 2); await new Promise(r => setTimeout(r, 600));
    const t1 = a.currentTime; a.pause();
    return `played via "${label}": t=${t0.toFixed(1)}s, seek -> ${t1.toFixed(1)}s of ${(a.duration || 0).toFixed(1)}s, src ${String(a.currentSrc).split('/').slice(-2).join('/')}`;
  });
  check('audio plays and seeks', /^played/.test(play) && !/seek -> 0.0/.test(play), play);
  await p.shot(join(out, 'course.png'));
  wv.close();
  p.close();
} catch (e) {
  console.log('ERROR', e.message);
  console.log(child.getLog().slice(-3000));
} finally {
  child.kill();
  await sleep(500);
  console.log(results.every(Boolean) ? 'ALL PASS' : 'SOME FAILED');
}

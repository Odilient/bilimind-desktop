// WP5b browser check: builds the harness to one file:// page, opens it in the installed Edge (puppeteer-core),
// runs the interaction checks and saves screenshots of every block at 1440 and 390 into shots/blocks/.
// Usage (from packages/player): node src/blocks/reading/harness/shoot.mjs [--no-build] [--no-shots]
// Prints one JSON line {ok, checks, errors, shots}; exit code 1 when a check fails.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, '../../../..');
const OUT = join(tmpdir(), 'bm-wp5b-harness');
const SHOTS = join(pkg, 'shots', 'blocks');
const args = new Set(process.argv.slice(2));

if (!args.has('--no-build')) {
  const { build } = await import('vite');
  await build({
    configFile: join(pkg, 'vite.config.ts'), root: pkg, logLevel: 'warn',
    build: { outDir: OUT, emptyOutDir: true, rollupOptions: { input: join(here, 'index.html') } },
  });
}
const page = join(OUT, 'src', 'blocks', 'reading', 'harness', 'index.html');
if (!existsSync(page)) { console.error('harness build missing: ' + page); process.exit(2); }
const html = readFileSync(page, 'utf8');
const url = pathToFileURL(page).href;

const EDGE = [process.env.BILIMIND_BROWSER, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(p => p && existsSync(p));
if (!EDGE) { console.error('No Edge/Chrome found; set BILIMIND_BROWSER'); process.exit(2); }
mkdirSync(SHOTS, { recursive: true });

const TYPES = ['explainer', 'analogy', 'example', 'diagram', 'comparison', 'reference_table', 'timeline',
  'worked_example', 'playground', 'key_points', 'misconception', 'audio', 'reflection'];
const checks = [];
const check = (name, ok, detail = '') => { checks.push({ name, ok: !!ok, detail }); };
const shots = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-first-run', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });

async function open(width, height, { offline = false } = {}) {
  const tab = await browser.newPage();
  await tab.setViewport({ width, height, deviceScaleFactor: width < 500 ? 2 : 1 });
  const errors = [];
  tab.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  tab.on('pageerror', e => errors.push(String(e)));
  if (offline) {
    await tab.setRequestInterception(true);
    tab.on('request', r => (r.url().startsWith('http') ? r.abort('internetdisconnected') : r.continue()));
  }
  await tab.goto(url, { waitUntil: 'load' });
  await tab.waitForSelector('section[data-type="explainer"] .s[data-s]', { timeout: 10000 });
  await tab.waitForFunction(() => {
    const d = document.querySelector('section[data-type="diagram"]');
    return !!d && !!(d.querySelector('.svg-host svg') || d.querySelector('.alt'));
  }, { timeout: 20000 });
  return { tab, errors };
}

async function shoot(tab, sel, name, pad = 20, scroll = true) {
  const el = await tab.$(sel);
  if (!el) { check(`shot ${name}`, false, `missing ${sel}`); return; }
  if (scroll) { await el.evaluate(e => e.scrollIntoView({ block: 'center' })); await sleep(900); }
  const box = await el.evaluate(e => { const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; });
  const vw = await tab.evaluate(() => document.documentElement.clientWidth);
  const x = Math.max(0, box.x - pad);
  const clip = { x, y: Math.max(0, box.y - pad), width: Math.min(vw - x, box.width + pad * 2), height: box.height + pad * 2 };
  const path = join(SHOTS, `${name}.png`);
  const vh = await tab.evaluate(() => innerHeight);
  // fits on screen: capture without resizing the viewport (which would restart running CSS animations)
  await tab.screenshot({ path, clip, captureBeyondViewport: clip.height > vh });
  shots.push(`shots/blocks/${name}.png`);
}

const frame = t => `.bf[data-type="${t}"]`;

try {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const { tab, errors } = await open(w, h);
    const tag = `@${w}`;

    // every type rendered, none fell into the frame's error boundary
    const rendered = await tab.evaluate(types => types.map(t => {
      const f = document.querySelector(`.bf[data-type="${t}"]`);
      return { t, ok: !!f?.querySelector('section[data-block]') && !f.querySelector('.bf-err') };
    }), TYPES);
    check(`all 13 types render ${tag}`, rendered.every(r => r.ok), rendered.filter(r => !r.ok).map(r => r.t).join(', '));

    // narration contract: every sentence of every narrated block has a span with its cue id
    const cues = await tab.evaluate(() => {
      const { expected } = window.__bm;
      const miss = [];
      let total = 0;
      for (const [key, ids] of Object.entries(expected)) {
        const sec = document.querySelector(`.bf[data-type="${key}"] section[data-block]`);
        if (!sec) { miss.push(`${key}:no block`); continue; }
        const got = new Set(Array.from(sec.querySelectorAll('.s[data-s]')).map(s => s.dataset.s));
        total += ids.length;
        for (const id of ids) if (!got.has(id)) miss.push(`${key}:${id}`);
      }
      return { total, miss };
    });
    check(`sentence spans cover every cue ${tag}`, cues.miss.length === 0, `${cues.total - cues.miss.length}/${cues.total} located${cues.miss.length ? '; missing ' + cues.miss.slice(0, 8).join(' ') : ''}`);

    // the three engine-port sample lessons render, never fall into the error boundary, and keep the cue contract
    const sm = await tab.evaluate(() => {
      const { sampleExpected } = window.__bm;
      const miss = [];
      let blocks = 0, errs = 0, total = 0;
      for (const [key, ids] of Object.entries(sampleExpected)) {
        const [lesson, block] = key.split('/');
        const frame = document.querySelector(`[data-sample="${lesson}"] .bf[data-frame="${block}"]`);
        if (!frame) { miss.push(`${key}:no frame`); continue; }
        blocks++;
        if (frame.querySelector('.bf-err')) errs++;
        const got = new Set(Array.from(frame.querySelectorAll('.s[data-s]')).map(s => s.dataset.s));
        total += ids.length;
        for (const id of ids) if (!got.has(id)) miss.push(`${key}:${id}`);
      }
      const drawn = document.querySelectorAll('[data-sample] section[data-type="diagram"] .svg-host svg').length;
      const diagrams = document.querySelectorAll('[data-sample] section[data-type="diagram"]').length;
      return { blocks, errs, total, miss, drawn, diagrams };
    });
    check(`sample lessons render with cues ${tag}`, sm.blocks >= 12 && sm.errs === 0 && sm.miss.length === 0, `${sm.blocks} blocks, ${sm.errs} errors, ${sm.total - sm.miss.length}/${sm.total} cues${sm.miss.length ? '; missing ' + sm.miss.slice(0, 6).join(' ') : ''}`);
    await tab.waitForFunction(() => document.querySelectorAll('[data-sample] section[data-type="diagram"] .pane .svg-host svg, [data-sample] section[data-type="diagram"] .alt').length >= document.querySelectorAll('[data-sample] section[data-type="diagram"]').length, { timeout: 20000 }).catch(() => {});
    const sd = await tab.evaluate(() => ({ drawn: document.querySelectorAll('[data-sample] section[data-type="diagram"] .svg-host svg').length, all: document.querySelectorAll('[data-sample] section[data-type="diagram"]').length }));
    check(`sample diagrams all drawn ${tag}`, sd.drawn === sd.all && sd.all >= 3, JSON.stringify(sd));

    // diagram
    const dg = await tab.evaluate(() => {
      const d = document.querySelector('section[data-type="diagram"]');
      return { drawn: !!d?.querySelector('.svg-host svg'), nodes: d?.querySelectorAll('.svg-host .node').length ?? 0 };
    });
    check(`diagram drawn by Mermaid (online) ${tag}`, dg.drawn && dg.nodes >= 3, JSON.stringify(dg));

    // playground: worker value, 28-point sweep, discovery
    const pg0 = await tab.evaluate(() => {
      const s = document.querySelector('section[data-type="playground"]');
      const d = s?.querySelector('.ex-chart .line')?.getAttribute('d') ?? '';
      return { out: s?.querySelector('.ex-out b')?.textContent?.trim() ?? '', points: (d.match(/[ML]/g) ?? []).length };
    });
    check(`playground computes 2.5 at α=0.5 ${tag}`, pg0.out.startsWith('2.5'), pg0.out);
    check(`playground sweep has 28 points ${tag}`, pg0.points === 28, String(pg0.points));

    // explainer key terms
    const kt = await tab.evaluate(() => ({ chips: document.querySelectorAll('section[data-type="explainer"] .kt-chip').length, defs: document.querySelectorAll('section[data-type="explainer"] .kt-chip.def').length }));
    check(`explainer key-term chips ${tag}`, kt.chips >= 3 && kt.defs >= 1, JSON.stringify(kt));

    // worked example reveal
    const wx0 = await tab.$$eval('section[data-type="worked_example"] .wx-steps > li.shown', els => els.length);
    await tab.click('section[data-type="worked_example"] .wx-bar .pill');
    await sleep(100);
    const wx1 = await tab.$$eval('section[data-type="worked_example"] .wx-steps > li.shown', els => els.length);
    check(`worked example reveals one step at a time ${tag}`, wx0 === 1 && wx1 === 2, `${wx0} -> ${wx1}`);
    await tab.click('section[data-type="worked_example"] .wx-bar .pill');

    // no sideways scroll
    const ov = await tab.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`no horizontal overflow ${tag}`, ov <= 0, `${ov}px`);

    if (!args.has('--no-shots')) {
      for (const t of TYPES) await shoot(tab, frame(t), `${t}-${w}`);
      // states worth showing
      const chip = await tab.$('section[data-type="explainer"] .kt-chip.def');
      if (chip) {
        await tab.$eval(frame('explainer'), e => e.scrollIntoView({ block: 'center' }));
        await sleep(600);
        await chip.click();
        await sleep(400);
        const tipOk = await tab.evaluate(() => !!document.querySelector('section[data-type="explainer"] .kt-tip'));
        check(`key-term chip shows its definition @${w}`, tipOk);
        await shoot(tab, frame('explainer'), `explainer-term-${w}`, 20, false);
      }
      await tab.click('section[data-type="worked_example"] .wx-bar .pill').catch(() => {});
      await tab.click('section[data-type="worked_example"] .wx-bar .pill').catch(() => {});
      await sleep(600);
      await shoot(tab, frame('worked_example'), `worked_example-answer-${w}`);
    }

    // playground: drag past the knee -> 50.5 at 0.9 and "You found it"
    await tab.evaluate(() => {
      const r = document.querySelector('section[data-type="playground"] input[type=range]');
      r.value = '0.9';
      r.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await sleep(600);
    const pg1 = await tab.evaluate(() => {
      const s = document.querySelector('section[data-type="playground"]');
      return { out: s?.querySelector('.ex-out b')?.textContent?.trim() ?? '', found: !!s?.querySelector('.ex-found'), passed: s?.classList.contains('passed') };
    });
    check(`playground 50.5 at α=0.9 and discovery fires ${tag}`, pg1.out.startsWith('50.5') && pg1.found && pg1.passed, JSON.stringify(pg1));
    if (!args.has('--no-shots')) await shoot(tab, frame('playground'), `playground-found-${w}`);

    if (w === 1440) {
      // runaway formula is killed at 1.5 s
      const kill = await tab.evaluate(async () => {
        const t0 = performance.now();
        const r = await new window.__bm.Runner().run('function compute(i) { while (true) {} }', [{ a: 1 }]);
        return { timedOut: !!r.timedOut, ms: Math.round(performance.now() - t0) };
      });
      check('infinite formula killed after 1.5 s', kill.timedOut && kill.ms >= 1400 && kill.ms < 2600, JSON.stringify(kill));
      // reference table filter
      await tab.type('section[data-type="reference_table"] .rt-filter input', 'log');
      await sleep(200);
      const rows = await tab.$$eval('section[data-type="reference_table"] tbody tr', els => els.length);
      check('reference table filter narrows rows', rows === 2, String(rows));
      if (!args.has('--no-shots')) await shoot(tab, frame('reference_table'), `reference_table-filter-${w}`);
      // cite chip opens the shared popover
      await tab.click('section[data-type="explainer"] .cite');
      await sleep(300);
      const pop = await tab.evaluate(() => ({ open: !!document.querySelector('.cite-pop'), mark: document.querySelector('.cite-pop mark')?.textContent ?? '' }));
      check('cite chip opens the popover with the quote marked', pop.open && pop.mark.length > 10, JSON.stringify(pop));
    }

    check(`zero console errors ${tag}`, errors.length === 0, errors.slice(0, 5).join(' | '));
    await tab.close();
  }

  // offline: Mermaid cannot load -> chip flow + alt text, still zero page errors
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const { tab, errors } = await open(w, h, { offline: true });
    const off = await tab.evaluate(() => {
      const d = document.querySelector('section[data-type="diagram"]');
      return { alt: !!d?.querySelector('.alt'), chips: d?.querySelectorAll('.flow .nd').length ?? 0 };
    });
    check(`diagram offline fallback (alt text + flow chips) @${w}`, off.alt && off.chips >= 3, JSON.stringify(off));
    const pageErrors = errors.filter(e => !/Failed to load resource|ERR_INTERNET_DISCONNECTED|net::/i.test(e));
    check(`offline: no script errors @${w}`, pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
    if (!args.has('--no-shots')) await shoot(tab, frame('diagram'), `diagram-offline-${w}`);
    await tab.close();
  }
} finally {
  await browser.close();
}

const ok = checks.every(c => c.ok);
console.log(JSON.stringify({ ok, page: url, bytes: html.length, checks, shots }));
process.exitCode = ok ? 0 : 1;

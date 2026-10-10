// WP5c end-to-end check with puppeteer-core + the installed Edge, over file://.
// Usage (from packages/player):
//   node src/assessments/harness/e2e.mjs                       # the harness page (build it first, see STATUS.md)
//   node src/assessments/harness/e2e.mjs --page dist/demo.html   # the real player (lessons opened by #/l/<id>)
//   add --shots to save screenshots to src/assessments/harness/shots/
// Exit code 0 only when every check passes. Prints one JSON line per check and a summary.
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
import { blockSentences } from '@bilimind/core';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const page = resolve(arg('--page') ?? join(here, 'dist', 'index.html'));
const route = arg('--route', '');
const shots = process.argv.includes('--shots') ? join(here, 'shots') : null;
if (shots) mkdirSync(shots, { recursive: true });
const fixture = JSON.parse(readFileSync(join(here, '..', '..', '..', '..', 'core', 'fixtures', 'course-ds-mini.json'), 'utf8'));
const EDGE = [process.env.BILIMIND_BROWSER, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(p => p && existsSync(p));
if (!EDGE) { console.error('No Edge/Chrome found; set BILIMIND_BROWSER'); process.exit(2); }
if (!existsSync(page)) { console.error(`No page at ${page}. Build the harness first.`); process.exit(2); }

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(JSON.stringify({ check: name, ok: !!ok, detail })); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const harness = !process.argv.includes('--page');
// harness: ?lesson=<id>&only=<types>; the real player: the shell's hash route #/l/<id> (or --route)
const url = (q = '') => {
  if (harness) return pathToFileURL(page).href + q;
  const lesson = new URLSearchParams(q).get('lesson');
  return pathToFileURL(page).href + (route || (lesson ? `#/l/${lesson}` : ''));
};

async function open(browser, q, viewport = { width: 1440, height: 900 }) {
  const tab = await browser.newPage();
  await tab.setViewport(viewport);
  const errors = [];
  tab.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FILE_NOT_FOUND|audio\/fixture/i.test(m.text())) errors.push(m.text()); });
  tab.on('pageerror', e => errors.push(String(e)));
  // centre every target first, so a fixed bar (the shell's narration dock) never takes the click
  const click = tab.click.bind(tab);
  tab.click = async (sel, opts) => { await tab.$eval(sel, el => el.scrollIntoView({ block: 'center' })).catch(() => {}); return click(sel, opts); };
  await tab.goto(url(q), { waitUntil: 'load' });
  await tab.waitForSelector('[data-block]', { timeout: 8000 });
  return { tab, errors };
}

const codeBlock = fixture.lessons[0].blocks.find(b => b.type === 'code');
const reference = codeBlock.assessments[0].answer_key.reference_solution;
const nTests = codeBlock.payload.tests.length;

async function setCode(tab, sel, code) {
  await tab.$eval(`${sel} textarea[data-code-editor]`, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, code);
}
async function runAndWait(tab, sel, timeout = 6000) {
  await tab.click(`${sel} [data-run]`);
  await tab.waitForFunction(s => { const b = document.querySelector(`${s} [data-run]`); return b && !b.disabled; }, { timeout }, sel);
  return tab.$$eval(`${sel} .cs-checks li`, lis => lis.map(li => li.dataset.s));
}

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-first-run', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'] });
try {
  // ---------- code ----------
  {
    const { tab, errors } = await open(browser, '?lesson=hash_tables&only=code');
    const sel = `[data-block="${codeBlock.id}"][data-type="code"]`;
    await tab.waitForSelector(sel);
    const hintLocked = await tab.$eval(`${sel} .cs-foot`, f => [...f.querySelectorAll('button')].find(b => /Hint/.test(b.textContent))?.getAttribute('aria-disabled'));
    check('code: hints locked before the first run', hintLocked === 'true', hintLocked);
    check('code: tested-before-delivery badge', await tab.$eval(sel, el => /Tested before delivery/.test(el.textContent)));
    let states = await runAndWait(tab, sel);
    check('code: starter runs and fails at least one check (red)', states.includes('fail') && states.length === nTests, states.join(','));
    const hintOpen = await tab.$eval(`${sel} .cs-foot`, f => [...f.querySelectorAll('button')].find(b => /Hint/.test(b.textContent))?.getAttribute('aria-disabled'));
    check('code: hints unlock after one run', hintOpen === 'false', hintOpen);
    await setCode(tab, sel, reference);
    states = await runAndWait(tab, sel);
    const status = await tab.$eval(`${sel} [data-status]`, el => el.textContent.trim());
    const green = await tab.$eval(`${sel} .code-stage`, el => el.classList.contains('passed'));
    const passedTag = await tab.$(`${sel}[data-passed="true"]`);
    check('code: Run on the reference reads green', states.every(s => s === 'pass') && green && status.startsWith(`${nTests}/${nTests} passing`), `${states.join(',')} | ${status}`);
    check('code: block marked passed', !!passedTag);
    const stored = await tab.evaluate(id => localStorage.getItem(`bm:${id}:progress`), fixture.id);
    check('code: progress stored in bm:<id>:progress', !!stored && stored.includes(codeBlock.id), stored ?? '');
    if (shots) await (await tab.$(sel)).screenshot({ path: join(shots, 'code-green-1440.png') });
    await setCode(tab, sel, 'function linearProbeIndex(table, key) {\n  while (true) {}\n}');
    const t0 = Date.now();
    states = await runAndWait(tab, sel, 8000);
    const took = Date.now() - t0;
    const stopped = await tab.$eval(`${sel} [data-status]`, el => el.textContent.trim());
    check('code: an endless loop is killed', states.every(s => s === 'fail') && /Stopped/.test(stopped) && took < 4500, `${stopped} in ${took} ms`);
    check('code: no console errors', errors.length === 0, errors.join(' | '));
    await tab.close();
  }

  // ---------- quiz ----------
  {
    const { tab, errors } = await open(browser, '?lesson=hash_tables&only=quiz');
    const q = '[data-type="quiz"]';
    await tab.waitForSelector(q);
    const before = await tab.$$eval(`${q} .opt.right, ${q} .why .wb, ${q} .model`, els => els.length);
    check('quiz: no answers or explanations in the DOM before Check', before === 0, String(before));
    check('quiz: "Beyond your slides" label visible', await tab.$eval(q, el => /Beyond your slides/.test(el.textContent)));
    // q7 (mcq, supported, explanation + cite): pick the right option, choose confidence, check
    const item = `${q} [data-item="q7"]`;
    await tab.click(`${item} .opt:nth-of-type(2)`);         // order is the source order before any retry; b is 2nd
    await tab.click(`${item} .conf .cb.sure`);
    await tab.click(`${item} .q-f .btn.ink`);
    await tab.waitForSelector(`${item} .why.open .wb`);
    const why = await tab.$eval(`${item} .why .wb`, el => ({ text: el.textContent, cites: el.querySelectorAll('.cite').length }));
    check('quiz: mcq graded correct with the cited explanation after Check', why.cites > 0 && why.text.length > 20, `${why.cites} cite(s)`);
    // q4 numeric wrong -> too high
    const num = `${q} [data-item="q4"]`;
    await tab.type(`${num} input`, '20');
    await tab.click(`${num} .q-f .btn.ink`);
    const dir = await tab.$eval(num, el => el.textContent);
    check('quiz: numeric says too high', /Too high/.test(dir));
    // q3 multi_select partial
    const ms = `${q} [data-item="q3"]`;
    await tab.click(`${ms} .opt:nth-of-type(1)`);
    await tab.click(`${ms} .opt:nth-of-type(4)`);
    await tab.click(`${ms} .q-f .btn.ink`);
    const partial = await tab.$eval(ms, el => ({ missed: el.querySelectorAll('.opt.missed').length, wrong: el.querySelectorAll('.opt.wrong').length }));
    check('quiz: multi_select marks wrong picks and missed answers', partial.missed === 2 && partial.wrong === 1, JSON.stringify(partial));
    // q6 short answer: self-marked with the rubric
    const sa = `${q} [data-item="q6"]`;
    await tab.type(`${sa} textarea`, 'The load factor went close to 1 so probe sequences got long; resize and rehash.');
    await tab.click(`${sa} .q-f .btn.ink`);
    await tab.waitForSelector(`${sa} .model`);
    const rows = await tab.$$(`${sa} .rrow`);
    for (const r of rows) { const b = await r.$('.lvb.excellent'); await b.evaluate(el => el.scrollIntoView({ block: 'center' })); await b.click(); }
    await tab.click(`${sa} .q-f .btn.ink`);
    const selfTag = await tab.$eval(sa, el => el.textContent);
    check('quiz: short answer self-marked against the rubric', /100% · self-marked/.test(selfTag));
    const fsrs = await tab.evaluate(id => JSON.parse(localStorage.getItem(`bm:${id}:fsrs`) || '{}'), fixture.id);
    check('quiz: answers reschedule FSRS cards', !!fsrs['hash_tables/q7'], Object.keys(fsrs).join(','));
    if (shots) await (await tab.$(q)).screenshot({ path: join(shots, 'quiz-1440.png') });
    check('quiz: no console errors', errors.length === 0, errors.join(' | '));
    await tab.close();
  }
  {
    const { tab, errors } = await open(browser, '?lesson=binary_heaps&only=quiz');
    const q = '[data-type="quiz"]';
    const ord = `${q} [data-item="q3"]`;
    // correct order b d a c from presented a b c d: move b up, then d up twice
    const up = async text => {
      const rows = await tab.$$(`${ord} .ord li`);
      for (let i = 0; i < rows.length; i++) {
        const t = await rows[i].evaluate(el => el.textContent);
        if (t.includes(text)) { const b = await rows[i].$('.mvb'); await b.evaluate(el => el.scrollIntoView({ block: 'center' })); await b.click(); return; }
      }
    };
    await up('Remove the root');
    await sleep(50);
    await up('Move the last key'); await sleep(50); await up('Move the last key'); await sleep(50);
    await tab.click(`${ord} .q-f .btn.ink`);
    const ok = await tab.$eval(ord, el => el.querySelectorAll('.ord li.ok').length);
    check('quiz: ordering with up/down buttons grades correct', ok === 4, String(ok));
    const cz = `${q} [data-item="q4"]`;
    await tab.type(`${cz} .gap input`, 'floor((i - 1) / 2)');
    await tab.click(`${cz} .q-f .btn.ink`);
    check('quiz: cloze accepts an alternative answer', await tab.$eval(cz, el => !!el.querySelector('.gap.ok')));
    check('quiz (heaps): no console errors', errors.length === 0, errors.join(' | '));
    await tab.close();
  }

  // ---------- flashcards ----------
  {
    const { tab, errors } = await open(browser, '?lesson=hash_tables&only=flashcards');
    const f = '[data-type="flashcards"]';
    await tab.click(`${f} .fc-card`);
    await sleep(700);
    const flipped = await tab.$eval(`${f} .fc-card`, el => el.classList.contains('flipped'));
    const intervals = await tab.$$eval(`${f} .rate small`, els => els.map(e => e.textContent));
    check('flashcards: flip shows the answer and the next intervals', flipped && intervals.every(Boolean), intervals.join(' / '));
    if (shots) await (await tab.$(f)).screenshot({ path: join(shots, 'flashcards-back-1440.png') });
    await tab.click(`${f} .rate .good`);
    await sleep(500);
    const fsrs = await tab.evaluate(id => JSON.parse(localStorage.getItem(`bm:${id}:fsrs`) || '{}'), fixture.id);
    check('flashcards: rating stored in localStorage (FSRS)', !!fsrs['hash_tables/b9/c0'], Object.keys(fsrs).join(','));
    const n = fixture.lessons[0].blocks.find(b => b.type === 'flashcards').payload.cards.length;
    for (let i = 1; i < n; i++) { await tab.keyboard.press('Space'); await sleep(80); await tab.keyboard.press(String((i % 3) + 2)); await sleep(420); }
    const end = await tab.$eval(f, el => /Deck done/.test(el.textContent));
    check('flashcards: keyboard Space + 1-4 rate the whole deck', end);
    check('flashcards: no console errors', errors.length === 0, errors.join(' | '));
    await tab.close();
  }

  // ---------- scenario: every path reaches the debrief ----------
  {
    const { tab, errors } = await open(browser, '?lesson=binary_heaps&only=scenario');
    const s = '[data-type="scenario"]';
    const scen = fixture.lessons[1].blocks.find(b => b.type === 'scenario').payload;
    let paths = 0; let reached = 0;
    for (const o1 of scen.steps[0].options) {
      for (const o2 of scen.steps[1].options) {
        await tab.evaluate(sel => { const b = [...document.querySelectorAll(`${sel} button`)].find(x => /Start over|Try another path/.test(x.textContent)); b?.click(); }, s);
        await sleep(60);
        await tab.click(`${s} .sc-now [data-option="${o1.id}"]`); await sleep(60);
        if (await tab.$(`${s} .sc-now`)) { await tab.click(`${s} .sc-now [data-option="${o2.id}"]`); await sleep(60); }
        paths++;
        if (await tab.$(`${s} .sc-debrief`)) reached++;
      }
    }
    check('scenario: every path reaches the debrief', reached === paths, `${reached}/${paths}`);
    if (shots) await (await tab.$(s)).screenshot({ path: join(shots, 'scenario-debrief-1440.png') });
    check('scenario: no console errors', errors.length === 0, errors.join(' | '));
    await tab.close();
  }

  // ---------- walkthrough + checklist ticks ----------
  {
    const { tab, errors } = await open(browser, '?lesson=binary_heaps&only=walkthrough,checklist,project,dialogue,scenario');
    const w = '[data-type="walkthrough"]';
    const btns = await tab.$$(`${w} .wt-check`);
    for (const b of btns) { await b.evaluate(el => el.scrollIntoView({ block: 'center' })); await b.click(); }
    check('walkthrough: every step ticks', await tab.$eval(w, el => el.querySelectorAll('.wt-s.done').length) === btns.length);
    // every narrated sentence of these blocks is wrapped with exactly the cue ids core blockSentences() gives
    for (const b of fixture.lessons[1].blocks.filter(x => ['walkthrough', 'project', 'dialogue', 'scenario'].includes(x.type))) {
      const want = blockSentences(b).map(x => x.id);
      const got = await tab.$eval(`[data-block="${b.id}"][data-type="${b.type}"]`, el => [...new Set([...el.querySelectorAll('span.s[data-s]')].map(x => x.dataset.s))]);
      check(`${b.type}: narration cue spans match core sentence ids`, want.length > 0 && want.every(id => got.includes(id)) && got.length === want.length, `${got.length}/${want.length}`);
    }
    const c = '[data-type="checklist"]';
    for (const b of await tab.$$(`${c} .tick`)) { await b.evaluate(el => el.scrollIntoView({ block: 'center' })); await b.click(); }
    check('checklist: all ticked marks the block passed', !!(await tab.$(`${c}[data-passed="true"]`)));
    const d = '[data-type="dialogue"]';
    await tab.type(`${d} textarea`, 'A sorted array pays O(n) on every insert, while both heap operations are O(log n). The heap only keeps parents smaller than children.');
    await tab.click(`${d} .dl-in .btn`);
    check('dialogue: replies light up the hint phrases and meet the goal', await tab.$eval(d, el => el.querySelectorAll('.dl-hint.on').length) === 3);
    if (shots) {
      await (await tab.$(w)).screenshot({ path: join(shots, 'walkthrough-1440.png') });
      await (await tab.$(d)).screenshot({ path: join(shots, 'dialogue-1440.png') });
      await (await tab.$('[data-type="project"]')).screenshot({ path: join(shots, 'project-1440.png') });
    }
    check('walkthrough/checklist/dialogue: no console errors', errors.length === 0, errors.join(' | '));
    await tab.close();
  }

  // ---------- speaking: blocked mic shows one line ----------
  {
    const { tab, errors } = await open(browser, '?lesson=binary_heaps&only=speaking');
    const sp = '[data-type="speaking"]';
    await tab.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }));
    });
    await tab.click(`${sp} [data-record]`);
    await tab.waitForSelector(`${sp} .spk-msg`, { timeout: 3000 }).catch(() => null);
    const msg = await tab.$$eval(`${sp} .spk-msg[role="status"]`, els => els.map(e => e.textContent.trim()));
    const stillWorks = await tab.$eval(`${sp} [data-record]`, b => !b.disabled);
    check('speaking: NotAllowedError shows one friendly line, never a broken state', msg.length === 1 && /blocked/i.test(msg[0]) && stillWorks, msg.join(' | '));
    await tab.click(`${sp} .sr.nailed`);
    await sleep(600);
    check('speaking: self-rating moves to the next phrase', await tab.$eval(`${sp} .spk-pos`, el => el.textContent.trim()) === '2 / 3');
    check('speaking: no console errors', errors.length === 0, errors.join(' | '));
    await tab.close();
  }

  // ---------- phone width: no horizontal overflow ----------
  {
    const { tab } = await open(browser, harness ? '' : '?lesson=hash_tables', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await sleep(300);
    const over = await tab.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('[data-block]')) {
        const r = el.getBoundingClientRect();
        if (r.right > window.innerWidth + 1) bad.push(`${el.dataset.block}:${el.dataset.type}:${Math.round(r.right)}`);
      }
      return { doc: document.documentElement.scrollWidth, bad };
    });
    check('phone 390: no block wider than the screen', over.doc <= 390 && over.bad.length === 0, JSON.stringify(over));
    if (shots) {
      for (const t of ['code', 'quiz', 'flashcards', 'speaking', 'scenario', 'dialogue', 'walkthrough', 'checklist']) {
        const el = await tab.$(`[data-type="${t}"]`);
        if (el) await el.screenshot({ path: join(shots, `${t}-390.png`) });
      }
    }
    await tab.close();
  }
} finally {
  await browser.close();
}

// ---------- speaking with a fake microphone (records and plays back) ----------
const fake = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-first-run', '--allow-file-access-from-files', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
try {
  const { tab, errors } = await open(fake, '?lesson=binary_heaps&only=speaking');
  const sp = '[data-type="speaking"]';
  await tab.click(`${sp} [data-record]`);
  await sleep(900);
  const rec = await tab.$eval(`${sp} [data-record]`, b => b.classList.contains('on'));
  await tab.click(`${sp} [data-record]`);
  await sleep(500);
  const yours = await tab.$eval(`${sp} .spk-you`, b => !b.disabled);
  check('speaking: records with MediaRecorder and offers playback', rec && yours, `recording=${rec} playback=${yours}`);
  if (shots) await (await tab.$(sp)).screenshot({ path: join(shots, 'speaking-1440.png') });
  check('speaking (fake mic): no console errors', errors.length === 0, errors.join(' | '));
} finally {
  await fake.close();
}

const failed = results.filter(r => !r.ok);
console.log(JSON.stringify({ ok: failed.length === 0, passed: results.length - failed.length, total: results.length, failed: failed.map(f => f.name) }));
process.exitCode = failed.length ? 1 : 0;

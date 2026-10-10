// WP5a acceptance run in headless Edge from file:// (puppeteer-core): home in 3 skins, path states, receipts
// log, lesson + dock (audio plays, the lit sentence advances, tap-to-seek), cite popover, Mark complete ->
// the path fills, progress survives reload, stage mode at 1280x720 without overflow, 390px phone views,
// and the PATH DONE overlay. Screenshots go to packages/player/shots/. Exit code 1 on any failure.
// Prereq: pnpm build && node scripts/paste-fixture.mjs && node scripts/fake-audio.mjs
// Usage: node scripts/e2e.mjs [course.json]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { injectCourse } from '@bilimind/core';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, '..');
const dist = join(pkg, 'dist');
const shots = join(pkg, 'shots');
mkdirSync(shots, { recursive: true });
const coursePath = process.argv[2] ? resolve(process.argv[2]) : join(pkg, '..', 'core', 'fixtures', 'course-ds-mini.json');
const course = JSON.parse(readFileSync(coursePath, 'utf8'));
const template = readFileSync(join(dist, 'player.html'), 'utf8');
const pages = {};
for (const skin of ['cobalt', 'ink', 'lime']) {
  const file = join(dist, skin === course.skin ? 'demo.html' : `demo-${skin}.html`);
  writeFileSync(file, injectCourse(template, { ...course, skin }));
  pages[skin] = pathToFileURL(file).href;
}
const NOW = 'now=2026-10-11';
const EDGE = [process.env.BILIMIND_BROWSER, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => p && existsSync(p));
if (!EDGE) { console.error('No Edge found; set BILIMIND_BROWSER'); process.exit(2); }

const results = [];
const errors = [];
const warnings = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-first-run', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
async function open(url, w, h) {
  const tab = await browser.newPage();
  await tab.setViewport({ width: w, height: h });
  tab.on('console', m => { if (m.type() === 'error') errors.push(`${url.split('/').pop()}: ${m.text()}`); else if (m.type() === 'warn') warnings.push(m.text()); });
  tab.on('pageerror', e => errors.push(String(e)));
  await tab.goto(url, { waitUntil: 'load' });
  return tab;
}
const overflow = tab => tab.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
async function scrollTo(tab, sel, block = 'start') { await tab.evaluate((s, b) => document.querySelector(s)?.scrollIntoView({ block: b }), sel, block); await sleep(450); }
async function nav(tab, hash) { await tab.evaluate(h => { location.hash = h; }, hash); await sleep(700); }

try {
  // ---------- home, 1440 ----------
  const tab = await open(`${pages.cobalt}#/?${NOW}`, 1440, 900);
  await tab.waitForSelector('#bm-title', { timeout: 8000 });
  await tab.evaluate(() => localStorage.clear());
  await tab.reload({ waitUntil: 'load' });
  await tab.waitForSelector('#bm-title');
  await sleep(900);
  await tab.screenshot({ path: join(shots, 'home-1440.png') });
  check('home: title', (await tab.$eval('#bm-title', e => e.textContent)).toUpperCase().includes(course.title.split(/\s+/)[0].toUpperCase()));
  check('home: plan days', (await tab.$$eval('.day', e => e.length)) === course.plan.days.length);
  check('home: exam countdown', !!(await tab.$eval('[data-countdown]', e => e.textContent?.trim())));
  check('home: milestones', (await tab.$$eval('.p-topic', e => e.length)) === course.path.length);
  check('home: you are here', (await tab.$$eval('.token', e => e.length)) === 1);
  check('home: ties drawn', (await tab.$$eval('.p-wires path', e => e.length)) > 0);
  check('home: due today section', (await tab.$$eval('.due-card', e => e.length)) === 1);
  check('home: receipts steps', (await tab.$$eval('.c-steps li', e => e.length)) === 6);
  check('home: sources', (await tab.$$eval('.src', e => e.length)) === course.sources.length);
  check('home: downloads', (await tab.$$eval('.foot .dl a', e => e.map(a => a.getAttribute('href')))).join(',') === course.exports.map(e => e.file).join(','));
  check('home 1440: no horizontal overflow', (await overflow(tab)) <= 0);
  await scrollTo(tab, '#path');
  await tab.screenshot({ path: join(shots, 'path-1440.png') });
  await scrollTo(tab, '.c-proof');
  await tab.click('.log-toggle');
  await sleep(300);
  check('home: per-agent log', (await tab.$$eval('.log li', e => e.length)) === course.receipts.log.length);
  await tab.screenshot({ path: join(shots, 'receipts-1440.png') });
  await scrollTo(tab, '#sources');
  await tab.screenshot({ path: join(shots, 'sources-1440.png') });
  // brief popover
  await scrollTo(tab, '#path');
  await tab.click('.p-topic.cut');
  await sleep(300);
  check('path: brief popover on a node', (await tab.$$eval('.brief', e => e.length)) === 1);
  await tab.keyboard.press('Escape');
  // plan narration
  await scrollTo(tab, '.c-hero');
  await tab.click('.c-hero .orb');
  await sleep(1500);
  check('home: Hear the plan plays', await tab.evaluate(() => document.querySelector('.c-hero .orb')?.classList.contains('on')));
  await tab.click('.c-hero .orb');

  // ---------- due today on a review day ----------
  {
    const t = await open(`${pages.cobalt}#/?now=2026-10-12`, 1440, 900);
    await t.waitForSelector('#bm-title');
    await sleep(800);
    await scrollTo(t, '.due', 'center');
    const due = await t.$$eval('.due-list a', e => e.length);
    const want = course.review.cards.filter(c => c.due.slice(0, 10) <= '2026-10-12').length;
    check('due today: review cards listed on a review day', due === Math.min(6, want) && due > 0, `${due} shown of ${want}`);
    await t.screenshot({ path: join(shots, 'due-1440.png') });
    await t.close();
  }

  // ---------- skins ----------
  for (const skin of ['ink', 'lime']) {
    const t = await open(`${pages[skin]}#/?${NOW}`, 1440, 900);
    await t.waitForSelector('#bm-title');
    await sleep(900);
    check(`skin ${skin}: hero has the skin`, await t.evaluate(s => document.querySelector('.c-hero')?.classList.contains(s), skin));
    await t.screenshot({ path: join(shots, `home-${skin}-1440.png`) });
    await t.close();
  }

  // ---------- lesson + dock ----------
  const lessonId = course.lessons[0].id;
  await nav(tab, `#/l/${lessonId}?${NOW}`);
  await tab.waitForSelector('[data-view="lesson"]');
  await sleep(1000);
  const frames = await tab.$$eval('[data-frame]', e => e.length);
  check('lesson: every block rendered', frames === course.lessons[0].blocks.length, `${frames}`);
  const cueIds = (course.lessons[0].narration?.sentences ?? []).map(s => s.id);
  const found = await tab.evaluate(ids => ids.filter(id => document.querySelector(`[data-s="${id}"]`)).length, cueIds);
  check('lesson: narration cues found as sentence spans', cueIds.length === 0 || found / cueIds.length >= 0.6, `${found}/${cueIds.length}`);
  await tab.click('[data-play]');
  await sleep(1500);
  const firstCue = await tab.evaluate(() => document.querySelector('.s.on')?.getAttribute('data-s'));
  check('dock: audio plays, a sentence is lit', !!firstCue, firstCue ?? 'none');
  const playing = await tab.evaluate(() => document.querySelector('[data-play]')?.getAttribute('aria-pressed'));
  check('dock: play button pressed', playing === 'true');
  // tap-to-seek a later sentence, then watch it advance on its own
  const target = cueIds.find(id => id.startsWith('b1.') && id !== 'b1.0') ?? cueIds[2];
  if (target) {
    await tab.evaluate(id => document.querySelector(`.s[data-s="${id}"]`)?.dispatchEvent(new MouseEvent('click', { bubbles: true })), target);
    await sleep(500);
    const lit = await tab.evaluate(() => document.querySelector('.s.on')?.getAttribute('data-s'));
    check('dock: tap a sentence to listen from there', lit === target, `${lit}`);
    let moved = '';
    for (let i = 0; i < 44 && !moved; i++) { await sleep(500); const now = await tab.evaluate(() => document.querySelector('.s.on')?.getAttribute('data-s')); if (now && now !== target) moved = now; }
    check('dock: the lit sentence advances with the audio', !!moved, `${target} -> ${moved || 'stuck'}`);
  }
  await tab.screenshot({ path: join(shots, 'lesson-1440.png') });
  await tab.click('[data-play]');
  // cite popover
  await tab.evaluate(() => document.querySelector('.cite')?.scrollIntoView({ block: 'center' }));
  await sleep(400);
  await tab.evaluate(() => document.querySelector('.cite')?.click());
  await sleep(400);
  const pop = await tab.evaluate(() => { const p = document.querySelector('.cite-pop'); return p ? { mark: p.querySelector('mark')?.textContent ?? '', href: p.querySelector('a')?.getAttribute('href') ?? '' } : null; });
  check('cite: popover shows the quote', !!pop?.mark, pop?.mark?.slice(0, 50));
  check('cite: links sources/<file>#page=N', /^sources\/.+#page=\d+$/.test(pop?.href ?? ''), pop?.href);
  await tab.screenshot({ path: join(shots, 'cite-1440.png') });
  await tab.keyboard.press('Escape');
  // finish card
  await scrollTo(tab, '[data-finish]', 'center');
  await tab.screenshot({ path: join(shots, 'finish-1440.png') });
  await tab.click('[data-complete]');
  await tab.waitForSelector('[data-view="home"]', { timeout: 5000 });
  await sleep(2600);
  check('complete: back on the path, milestone done', (await tab.$$eval('.p-topic.done', e => e.length)) >= 1);
  check('complete: Continue offered on the path', (await tab.$$eval('.p-cta', e => e.length)) === 1);
  await tab.screenshot({ path: join(shots, 'path-filled-1440.png') });
  const stored = await tab.evaluate(id => localStorage.getItem(`bm:${id}:progress`), course.id);
  check('progress: stored under bm:<courseId>:progress', !!stored && JSON.parse(stored).lessons?.[lessonId]?.done === true);
  await tab.reload({ waitUntil: 'load' });
  await sleep(900);
  check('progress: survives reload', (await tab.$$eval('.p-topic.done', e => e.length)) >= 1);
  check('progress: ring shows progress', (await tab.$eval('.tb .pct', e => e.textContent)) !== '0%');

  // ---------- stage mode 1280x720 ----------
  await tab.setViewport({ width: 1280, height: 720 });
  await nav(tab, `#/?${NOW}`);
  await tab.keyboard.press('p');
  await sleep(500);
  check('stage: P turns stage mode on', (await tab.evaluate(() => document.documentElement.dataset.density)) === 'stage');
  check('stage home 1280: no horizontal overflow', (await overflow(tab)) <= 0);
  await tab.screenshot({ path: join(shots, 'stage-home-1280.png') });
  await nav(tab, `#/l/${course.lessons[1]?.id ?? lessonId}?${NOW}`);
  await sleep(800);
  check('stage lesson 1280: no horizontal overflow', (await overflow(tab)) <= 0);
  await tab.screenshot({ path: join(shots, 'stage-lesson-1280.png') });
  await tab.keyboard.press('p');
  await sleep(200);
  check('stage: P again turns it off', !(await tab.evaluate(() => document.documentElement.dataset.density)));

  // ---------- PATH DONE ----------
  await tab.setViewport({ width: 1440, height: 900 });
  if (course.lessons[1]) {
    await nav(tab, `#/l/${course.lessons[1].id}?${NOW}`);
    await scrollTo(tab, '[data-finish]', 'center');
    await tab.click('[data-complete]');
    await tab.waitForSelector('[data-view="home"]', { timeout: 5000 });
    await sleep(2400);
    check('course complete: PATH DONE overlay', (await tab.$$eval('.done-ov', e => e.length)) === 1);
    check('course complete: finish pill lit', (await tab.$$eval('.p-fin.lit', e => e.length)) === 1);
    await tab.screenshot({ path: join(shots, 'done-1440.png') });
  }
  await tab.close();

  // ---------- phone 390x844 ----------
  const ph = await open(`${pages.cobalt}#/?${NOW}`, 390, 844);
  await ph.waitForSelector('#bm-title');
  await ph.evaluate(() => localStorage.clear());
  await ph.reload({ waitUntil: 'load' });
  await sleep(900);
  check('390 home: no horizontal overflow', (await overflow(ph)) <= 0, `${await overflow(ph)}px`);
  await ph.screenshot({ path: join(shots, 'home-390.png') });
  await scrollTo(ph, '.c-plan', 'center');
  await ph.screenshot({ path: join(shots, 'plan-390.png') });
  await scrollTo(ph, '#path');
  await ph.screenshot({ path: join(shots, 'path-390.png') });
  await scrollTo(ph, '.c-proof');
  await ph.screenshot({ path: join(shots, 'receipts-390.png') });
  await nav(ph, `#/l/${lessonId}?${NOW}`);
  await sleep(900);
  check('390 lesson: no horizontal overflow', (await overflow(ph)) <= 0, `${await overflow(ph)}px`);
  await ph.screenshot({ path: join(shots, 'lesson-390.png') });
  await ph.click('[data-play]');
  await sleep(1200);
  await ph.evaluate(() => window.scrollBy(0, 500));
  await sleep(500);
  await ph.screenshot({ path: join(shots, 'lesson-dock-390.png') });
  await ph.click('[data-play]');
  await ph.close();
} catch (e) {
  check('e2e run finished without an exception', false, String(e?.stack ?? e));
} finally {
  await browser.close();
}
check('zero console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
const failed = results.filter(r => !r.ok);
writeFileSync(join(shots, 'e2e.json'), JSON.stringify({ at: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results, errors, warnings: [...new Set(warnings)].slice(0, 20) }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exitCode = failed.length ? 1 : 0;

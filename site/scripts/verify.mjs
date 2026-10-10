// Verifies the landing page in the installed Edge (puppeteer-core, no browser download):
// zero console errors, no horizontal scroll at 390 px, every section present, the crew
// story scrubs, the course links resolve, and screenshots at 1440 and 390 into site/shots/.
//
// Usage: node site/scripts/verify.mjs [--url <http(s) or file url>] [--no-shots]
// Default target: site/index.html over file://. Exit code 1 on any failure.
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '..');
const repo = resolve(site, '..');
// site/ is not a workspace package: borrow puppeteer-core from the player's dev dependencies.
const require = createRequire(join(repo, 'packages', 'player', 'package.json'));
const puppeteer = require('puppeteer-core');

const argv = process.argv.slice(2);
const urlAt = argv.indexOf('--url');
const target = urlAt >= 0 ? argv[urlAt + 1] : pathToFileURL(join(site, 'index.html')).href;
const shots = !argv.includes('--no-shots');
const shotDir = join(site, 'shots');
if (shots) {
  mkdirSync(shotDir, { recursive: true });
  for (const f of readdirSync(shotDir)) if (f.endsWith('.png')) unlinkSync(join(shotDir, f));
}

const EDGE = [
  process.env.BILIMIND_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => p && existsSync(p));
if (!EDGE) { console.error('No Edge/Chrome found; set BILIMIND_BROWSER'); process.exit(2); }

const SECTIONS = ['hero', 'ticker', 'problem', 'crew', 'formats', 'outputs', 'shop', 'courses', 'install', 'numbers', 'built', 'faq', 'team', 'start'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const report = { target, widths: {} };

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-first-run', '--allow-file-access-from-files', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [w, h, tag] of [[1440, 900, '1440'], [390, 844, '390']]) {
    const tab = await browser.newPage();
    await tab.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
    const errors = [];
    tab.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    tab.on('pageerror', (e) => errors.push(String(e)));
    tab.on('requestfailed', (r) => { const u = r.url(); if (!u.startsWith('data:')) errors.push('request failed: ' + u + ' ' + (r.failure() || {}).errorText); });
    await tab.goto(target, { waitUntil: 'networkidle2', timeout: 90000 });
    await sleep(1800);

    const info = await tab.evaluate((ids) => ({
      missing: ids.filter((id) => !document.getElementById(id)),
      gsap: !!window.gsap, st: !!window.ScrollTrigger, matter: !!window.Matter, obj: !!window.__obj,
      crew: !!(window.__crew && window.__crew.st), title: document.title,
    }), SECTIONS);
    const r = { errors, ...info };

    if (shots) await tab.screenshot({ path: join(shotDir, `${tag}-00-hero.png`) });

    // Interactions: the hero's copy button copies and goes to the install steps; a placeholder
    // link stays put and explains; a kind-of-knowledge tab switches the panel; a FAQ row opens.
    if (tag === '1440') {
      await tab.click('#go');
      await sleep(2200);
      r.copy = await tab.evaluate(() => ({
        toast: document.getElementById('toast').textContent,
        installTop: Math.round(document.getElementById('install').getBoundingClientRect().top),
        field: document.getElementById('topic').value.slice(0, 40),
      }));
      if (!r.copy.toast || Math.abs(r.copy.installTop) > 140) failures.push(`${tag}: copy button did not toast and scroll (${JSON.stringify(r.copy)})`);
      const before = await tab.evaluate(() => location.href);
      await tab.evaluate(() => document.querySelector('.nav-end .gh').click());
      await sleep(300);
      if ((await tab.evaluate(() => location.href)) !== before) failures.push(`${tag}: a placeholder link navigated`);
      await tab.evaluate(() => { document.getElementById('formats').scrollIntoView(); });
      await sleep(600);
      await tab.evaluate(() => document.querySelector('.fm-tab[data-a="5"]').click());
      await sleep(500);
      r.formatTab = await tab.evaluate(() => document.querySelector('#formats .fm-kind h3').textContent);
      if (r.formatTab !== 'Numbers to feel') failures.push(`${tag}: formats tab did not switch (${r.formatTab})`);
      await tab.evaluate(() => document.querySelector('#faqList .qa:nth-child(2) button').click());
      r.faqOpen = await tab.evaluate(() => document.querySelector('#faqList .qa:nth-child(2)').classList.contains('open'));
      if (!r.faqOpen) failures.push(`${tag}: FAQ row did not open`);
      await tab.evaluate(() => window.scrollTo(0, 0));
      await sleep(600);
    }

    // Scroll the whole page in steps (lets ScrollTriggers fire), checking width as we go.
    let maxOver = 0;
    const H = await tab.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += Math.round(h * 0.8)) {
      await tab.evaluate((y) => window.scrollTo(0, y), y);
      await sleep(70);
      const over = await tab.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      maxOver = Math.max(maxOver, over);
    }
    r.horizontalOverflowPx = maxOver;
    r.scrollHeight = H;

    // The crew story at five points, then each section top.
    const story = [0.08, 0.3, 0.52, 0.72, 0.98];
    for (const [k, p] of story.entries()) {
      await tab.evaluate((p) => window.__crew && window.__crew.seek(p), p);
      await sleep(900);
      if (shots) await tab.screenshot({ path: join(shotDir, `${tag}-crew-${k + 1}.png`) });
    }
    r.crewState = await tab.evaluate(() => {
      const pv = document.getElementById('cwPreview');
      return { prog: document.querySelector('#cwProg span').textContent, preview: pv ? getComputedStyle(pv).transform : null, railOn: [...document.querySelectorAll('#cwRail .sp')].findIndex((s) => s.classList.contains('on')) };
    });
    let n = 1;
    for (const id of SECTIONS.filter((s) => s !== 'hero' && s !== 'crew')) {
      await tab.evaluate((id) => { const el = document.getElementById(id); const top = el.getBoundingClientRect().top + scrollY - 70; window.scrollTo(0, top); }, id);
      await sleep(id === 'formats' ? 2600 : id === 'numbers' ? 2400 : 1100);
      if (shots) await tab.screenshot({ path: join(shotDir, `${tag}-${String(n++).padStart(2, '0')}-${id}.png`) });
    }
    // Course links: each points at an existing local file.
    r.courseLinks = await tab.evaluate(() => [...new Set([...document.querySelectorAll('a[href*="courses/"]')].map((a) => a.getAttribute('href')))]);
    for (const href of r.courseLinks) {
      const f = join(site, href);
      if (!existsSync(f)) failures.push(`${tag}: course link ${href} has no file`);
    }

    if (errors.length) failures.push(`${tag}: ${errors.length} console error(s): ${errors.slice(0, 5).join(' | ')}`);
    if (maxOver > 0) failures.push(`${tag}: horizontal overflow of ${maxOver}px`);
    if (info.missing.length) failures.push(`${tag}: missing sections ${info.missing.join(', ')}`);
    if (!info.gsap || !info.st) failures.push(`${tag}: GSAP/ScrollTrigger did not load`);
    if (!info.crew && !/[?&]still/.test(target)) failures.push(`${tag}: crew story did not pin`);
    report.widths[tag] = r;
    await tab.close();
  }
} finally {
  await browser.close();
}
report.ok = failures.length === 0;
report.failures = failures;
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.ok ? 0 : 1;

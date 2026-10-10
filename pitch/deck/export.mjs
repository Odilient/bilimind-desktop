// Exports the deck to ../BiliMind-Desktop-Deck.pdf (vector, one 1920x1080 page per slide) and shots/slide-N.png.
// Headless Chrome only. Usage (from the repo root): node pitch/deck/export.mjs
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const require = createRequire(path.join(ROOT, 'apps/desktop/package.json'));
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PDF = path.join(ROOT, 'pitch/BiliMind-Desktop-Deck.pdf');
const SHOTS = path.join(HERE, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run', '--mute-audio', '--allow-file-access-from-files', '--hide-scrollbars'] });
try {
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(HERE, 'index.html')).href + '?export#1', { waitUntil: 'load', timeout: 120000 });
  // Every live app frame must reach its state; every course player must render.
  const frames = page.frames().filter((f) => f !== page.mainFrame());
  console.log('frames', frames.length);
  await Promise.all(frames.map(async (f) => {
    const u = f.url();
    if (/app\/index\.html/.test(u)) await f.waitForSelector('html[data-deck-ready]', { timeout: 150000 });
    else { await f.waitForFunction(() => document.readyState === 'complete' && document.body && document.body.innerText.length > 200, { timeout: 60000 }); await sleep(2500); }
    console.log('ready', u.replace(/^.*?(pitch|showcase)/, '$1').slice(0, 90));
  }));
  await page.evaluate(() => document.fonts.ready);
  await sleep(800);
  const n = await page.evaluate(() => document.querySelectorAll('.slide').length);
  for (let i = 0; i < n; i++) {
    await page.evaluate((k) => window.__show(k), i);
    await sleep(700);
    await page.screenshot({ path: path.join(SHOTS, `slide-${i + 1}.png`) });
  }
  await page.evaluate(() => window.__show(0));
  await sleep(400);
  await page.pdf({ path: PDF, preferCSSPageSize: true, printBackground: true, timeout: 180000 });
  console.log('pdf', PDF, fs.statSync(PDF).size, 'bytes');
  console.log(errs.length ? 'CONSOLE:\n' + errs.join('\n') : 'no console errors');
} finally { await browser.close(); }

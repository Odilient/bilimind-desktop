// Quick visual check: opens a page in headless Edge at a viewport and saves screenshots of named states.
// Usage: node scripts/shots.mjs <page.html> <outPrefix> [width=1440] [height=900] [hash=#/]
import { existsSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const [pageArg, prefix = 'shots/x', w = '1440', h = '900', hash = '#/'] = process.argv.slice(2);
const EDGE = [process.env.BILIMIND_BROWSER, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => p && existsSync(p));
const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-first-run', '--autoplay-policy=no-user-gesture-required'] });
try {
  const tab = await browser.newPage();
  await tab.setViewport({ width: Number(w), height: Number(h) });
  const errors = [];
  tab.on('console', m => { if (m.type() === 'error' || m.type() === 'warn') errors.push(`${m.type()}: ${m.text()}`); });
  tab.on('pageerror', e => errors.push(String(e)));
  await tab.goto(pathToFileURL(resolve(pageArg)).href + hash, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 1200));
  mkdirSync(dirname(resolve(prefix)), { recursive: true });
  const full = await tab.evaluate(() => document.documentElement.scrollHeight);
  const n = Math.min(8, Math.ceil(full / Number(h)));
  for (let i = 0; i < n; i++) {
    await tab.evaluate((y) => window.scrollTo(0, y), i * Number(h));
    await new Promise(r => setTimeout(r, 500));
    await tab.screenshot({ path: `${resolve(prefix)}-${i}.png` });
  }
  const overflow = await tab.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(JSON.stringify({ errors, overflow, full }));
} finally { await browser.close(); }

// file:// smoke test with the installed Edge (puppeteer-core, no browser download):
// opens dist/demo.html (run `pnpm build:demo` first), asserts the course rendered and no console errors.
// Usage: node scripts/smoke.mjs [page.html] [--shot out.png]
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const page = resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : join(here, '..', 'dist', 'demo.html'));
const shotAt = process.argv.indexOf('--shot');
const shot = shotAt > 0 ? resolve(process.argv[shotAt + 1]) : null;
const EDGE = [
  process.env.BILIMIND_BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(p => p && existsSync(p));
if (!EDGE) { console.error('No Edge/Chrome found; set BILIMIND_BROWSER'); process.exit(2); }

const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-first-run', '--allow-file-access-from-files'] });
try {
  const tab = await browser.newPage();
  await tab.setViewport({ width: 1440, height: 900 });
  const errors = [];
  tab.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  tab.on('pageerror', e => errors.push(String(e)));
  await tab.goto(pathToFileURL(page).href, { waitUntil: 'load' });
  await tab.waitForSelector('#bm-title', { timeout: 5000 });
  const title = await tab.$eval('#bm-title', el => el.textContent);
  const blocks = await tab.$$eval('[data-block]', els => els.length);
  if (shot) await tab.screenshot({ path: shot, fullPage: false });
  const ok = errors.length === 0 && blocks > 0;
  console.log(JSON.stringify({ ok, page: pathToFileURL(page).href, title, blocks, errors }));
  process.exitCode = ok ? 0 : 1;
} finally {
  await browser.close();
}

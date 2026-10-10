// One-off: render resources/icon.svg to resources/icon.png (256) and resources/icon.ico (16..256, PNG entries)
// with headless Chrome/Edge through puppeteer-core. Usage: node scripts/make-icon.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const res = join(here, '..', 'resources');
const svg = readFileSync(join(res, 'icon.svg'), 'utf8');
const exe = [process.env.BILIMIND_BROWSER, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe']
  .find(p => p && existsSync(p));
if (!exe) { console.error('no Chrome/Edge found'); process.exit(1); }

const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-first-run', '--no-default-browser-check'] });
const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = new Map();
try {
  const page = await browser.newPage();
  for (const s of sizes) {
    await page.setViewport({ width: s, height: s, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body></html>`);
    pngs.set(s, Buffer.from(await page.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: s, height: s } })));
  }
} finally { await browser.close(); }

writeFileSync(join(res, 'icon.png'), pngs.get(256));
// ICO: header + directory + PNG payloads (PNG-in-ICO is valid on Vista and later; electron-builder accepts it)
const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
const dir = Buffer.alloc(16 * sizes.length);
let offset = 6 + dir.length;
sizes.forEach((s, i) => {
  const png = pngs.get(s);
  const o = i * 16;
  dir.writeUInt8(s >= 256 ? 0 : s, o); dir.writeUInt8(s >= 256 ? 0 : s, o + 1);
  dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3);
  dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
  dir.writeUInt32LE(png.length, o + 8); dir.writeUInt32LE(offset, o + 12);
  offset += png.length;
});
writeFileSync(join(res, 'icon.ico'), Buffer.concat([header, dir, ...sizes.map(s => pngs.get(s))]));
console.log(`icon.png 256 px, icon.ico ${sizes.join('/')} px`);

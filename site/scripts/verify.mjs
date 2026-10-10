// Verifies that site/index.html is the exact copy of the approved design
// (plan/reference/design/hero-v7/11-cobalt-landing.html) with only link targets changed.
//
//   node site/scripts/verify.mjs [--no-shots]
//
// 1. Text diff: every differing line must differ only inside href/src/action attributes or the START
//    link constant.
// 2. Pixels, in headless Chrome/Edge (puppeteer-core, no browser download, never a visible window):
//    a) "still" pass (?still, the page's own reduced-motion mode): full-page screenshots of both files at
//       1440x900 and 390x844 must be byte-identical PNGs (or 0 differing pixels).
//    b) "motion" pass: viewport screenshots of both files at the same scroll positions and the same
//       wall-clock timings, Math.random seeded identically. Animation timing can still jitter, so this
//       pass reports the share of differing pixels instead of failing.
//    Screenshots of the site go to site/shots/ (unless --no-shots). Exit code 1 on a failure.
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '..');
const repo = resolve(site, '..');
const require = createRequire(join(repo, 'packages', 'player', 'package.json'));
const puppeteer = require('puppeteer-core');

const ORIG = join(repo, 'plan', 'reference', 'design', 'hero-v7', '11-cobalt-landing.html');
const COPY = join(site, 'index.html');
const shots = !process.argv.includes('--no-shots');
const shotDir = join(site, 'shots');
const failures = [];
const report = { text: {}, still: {}, motion: {} };

// ── 1 · text diff ────────────────────────────────────────────────────────────
{
  const a = readFileSync(ORIG, 'utf8').split('\n');
  const b = readFileSync(COPY, 'utf8').split('\n');
  if (a.length !== b.length) failures.push(`line count differs: ${a.length} vs ${b.length}`);
  const LINK = /((?:href|src|action)=")[^"]*(")|(const START = ')[^']*(')/g;
  const changed = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    const na = (a[i] ?? '').replace(LINK, '$1$3<link>$2$4');
    const nb = (b[i] ?? '').replace(LINK, '$1$3<link>$2$4');
    if (na !== nb) failures.push(`line ${i + 1} differs outside a link target`);
    const la = [...(a[i] ?? '').matchAll(LINK)].map((m) => m[0]);
    const lb = [...(b[i] ?? '').matchAll(LINK)].map((m) => m[0]);
    la.forEach((x, k) => { if (x !== lb[k]) changed.push({ line: i + 1, from: x, to: lb[k] }); });
  }
  report.text = { lines: a.length, changedLinks: changed };
}

// ── 2 · pixels ───────────────────────────────────────────────────────────────
const BROWSER = [
  process.env.BILIMIND_BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => p && existsSync(p));
if (!BROWSER) { console.error('No Chrome/Edge found; set BILIMIND_BROWSER'); process.exit(2); }

if (shots) {
  mkdirSync(shotDir, { recursive: true });
  for (const f of readdirSync(shotDir)) if (f.endsWith('.png')) unlinkSync(join(shotDir, f));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SEED = `(() => { let s = 1234567; Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();`;
const VIEWS = [[1440, 900, '1440'], [390, 844, '390']];

const browser = await puppeteer.launch({
  executablePath: BROWSER, headless: true,
  args: ['--no-first-run', '--allow-file-access-from-files', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--font-render-hinting=none'],
});

async function open(file, w, h, query) {
  const tab = await browser.newPage();
  await tab.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await tab.evaluateOnNewDocument(SEED);
  const errors = [];
  tab.on('pageerror', (e) => errors.push(String(e.message || e)));
  await tab.goto(pathToFileURL(file).href + query, { waitUntil: 'networkidle0', timeout: 60000 });
  await tab.evaluate(() => document.fonts.ready);
  return { tab, errors };
}

// Count differing pixels of two PNGs by decoding them in a canvas (no pngjs needed).
async function pixelDiff(pngA, pngB) {
  if (pngA.equals(pngB)) return { identical: true, diff: 0 };
  const tab = await browser.newPage();
  const r = await tab.evaluate(async (a, b) => {
    const load = async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); return im; };
    const [ia, ib] = [await load(a), await load(b)];
    if (ia.width !== ib.width || ia.height !== ib.height) return { size: [ia.width, ia.height, ib.width, ib.height] };
    const px = (im) => { const c = new OffscreenCanvas(im.width, im.height); const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data; };
    const da = px(ia), db = px(ib); let diff = 0;
    for (let i = 0; i < da.length; i += 4) if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) diff++;
    return { diff, total: ia.width * ia.height };
  }, pngA.toString('base64'), pngB.toString('base64'));
  await tab.close();
  return { identical: false, ...r };
}

// Pixels where the copy differs from the original, outside the blocks where the original differs from itself.
async function maskedDiff(o1, others, c) {
  const tab = await browser.newPage();
  const r = await tab.evaluate(async (a, bs, cc) => {
    const load = async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); return im; };
    const ims = [await load(a), await load(cc)]; for (const b of bs) ims.push(await load(b));
    if (ims.some((im) => im.width !== ims[0].width || im.height !== ims[0].height)) return { size: ims.map((im) => [im.width, im.height]) };
    const px = (im) => { const cv = new OffscreenCanvas(im.width, im.height); const x = cv.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data; };
    const [A, C, ...Bs] = ims.map(px); const W = ims[0].width, H = ims[0].height, BS = 16, BW = Math.ceil(W / BS);
    const ne = (X, Y, i) => X[i] !== Y[i] || X[i + 1] !== Y[i + 1] || X[i + 2] !== Y[i + 2];
    const BH = Math.ceil(H / BS), raw0 = new Uint8Array(BW * BH), mask = new Uint8Array(BW * BH);
    for (const B of Bs) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ne(A, B, (y * W + x) * 4)) raw0[Math.floor(y / BS) * BW + Math.floor(x / BS)] = 1;
    // dilate by one block: anti-aliased edges of a moving element spill into the neighbour block
    for (let by = 0; by < BH; by++) for (let bx = 0; bx < BW; bx++) if (raw0[by * BW + bx]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = by + dy, xx = bx + dx; if (yy >= 0 && yy < BH && xx >= 0 && xx < BW) mask[yy * BW + xx] = 1; }
    let masked = 0; for (const m of mask) masked += m;
    let raw = 0, out = 0; const rows = {};
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (!ne(A, C, i)) continue; raw++; if (!mask[Math.floor(y / BS) * BW + Math.floor(x / BS)]) { out++; const band = Math.floor(y / 100) * 100; rows[band] = (rows[band] || 0) + 1; } }
    return { total: W * H, diffRaw: raw, noiseMaskPct: +(100 * masked / mask.length).toFixed(2), diffOutsideMask: out, outsideBands: rows };
  }, o1.toString('base64'), others.map((o) => o.toString('base64')), c.toString('base64'));
  await tab.close();
  return r;
}

try {
  // a) still: full page. The original is shot three times: the 3D object (WebGL) and the rolling
  //    number digits are not pixel-stable even against themselves, so 16x16 blocks where the two
  //    original shots disagree form a "noise mask"; outside it the copy must match exactly.
  for (const [w, h, tag] of VIEWS) {
    const shot = async (file) => {
      const { tab, errors } = await open(file, w, h, '?still');
      await sleep(1500);
      const height = await tab.evaluate(() => document.documentElement.scrollHeight);
      const png = Buffer.from(await tab.screenshot({ fullPage: true, type: 'png' }));
      await tab.close();
      return { png, height, errors };
    };
    // Warm-up: in a fresh headless session one load at a new viewport can lay the hero out mid-way
    // (seen at 390 on whichever file loads first), so one load of each file is shot and discarded.
    await shot(ORIG); await shot(COPY);
    const o1 = await shot(ORIG), c = await shot(COPY), o2 = await shot(ORIG), o3 = await shot(ORIG);
    const d = await maskedDiff(o1.png, [o2.png, o3.png], c.png);
    report.still[tag] = { origHeight: o1.height, copyHeight: c.height, origErrors: o1.errors, copyErrors: c.errors, ...d };
    if (shots) writeFileSync(join(shotDir, `${tag}-full-still.png`), c.png);
    if (o1.height !== c.height) failures.push(`still ${tag}: page height ${c.height} vs ${o1.height}`);
    if (d.size || d.diffOutsideMask !== 0) failures.push(`still ${tag}: ${d.size ? 'size differs' : d.diffOutsideMask + ' pixels differ outside the noise mask'}`);
  }
  // b) motion: viewport at fixed scroll stops, same timings
  for (const [w, h, tag] of VIEWS) {
    const runs = [];
    for (const file of [ORIG, COPY]) {
      const { tab } = await open(file, w, h, '');
      const height = await tab.evaluate(() => document.documentElement.scrollHeight);
      const stops = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((f) => Math.round(f * (height - h)));
      const imgs = [];
      await sleep(2500);
      for (const y of stops) {
        await tab.evaluate((yy) => window.scrollTo(0, yy), y);
        await sleep(1800);
        imgs.push(Buffer.from(await tab.screenshot({ type: 'png' })));
      }
      runs.push({ imgs, stops });
      await tab.close();
    }
    report.motion[tag] = [];
    for (let i = 0; i < runs[0].imgs.length; i++) {
      const d = await pixelDiff(runs[0].imgs[i], runs[1].imgs[i]);
      report.motion[tag].push({ scrollY: runs[0].stops[i], identical: d.identical, diffPct: d.total ? +(100 * d.diff / d.total).toFixed(3) : 0 });
      if (shots) writeFileSync(join(shotDir, `${tag}-motion-${i}.png`), runs[1].imgs[i]);
    }
  }
} finally {
  await browser.close();
}

report.ok = failures.length === 0;
report.failures = failures;
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.ok ? 0 : 1;

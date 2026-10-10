// workbuddy/bilimind-crew/avatars/src/make-avatars.mjs
// Draws the BiliMind Crew avatars as geometric cobalt/lime SVG portraits (no text, no faces beyond
// shapes) and renders each to a 512x512 PNG with headless Edge. One consistent style for the team.
//
//   node workbuddy/bilimind-crew/avatars/src/make-avatars.mjs [--svg-only]
//
// Writes ../<id>.png (and the .svg sources next to this script). Edge: BILIMIND_BROWSER overrides the path.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..');
const EDGE = process.env.BILIMIND_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const C = {
  cobalt: '#2340E6', cobalt2: '#1B33CF', cobalt3: '#3253F4', navy: '#0D1660', soft: '#EEF1FE',
  lime: '#C6F24E', lime2: '#B4E03A', limeSoft: '#EEF9CF', ink: '#0B0D10', ink2: '#1A1D23', white: '#FFFFFF',
};
const SKIN = { a: '#F2C9A0', b: '#D9A47A', c: '#B07850', d: '#7A4B32' };
const shade = (hex, f) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('');

// Background: cobalt radial gradient, a faint dot grid, one lime arc (rotated per member).
function background(id, arcRotate) {
  const dots = [];
  for (let y = 24; y < 512; y += 32) for (let x = 24; x < 512; x += 32) dots.push(`<circle cx="${x}" cy="${y}" r="2.2"/>`);
  return `
  <defs>
    <radialGradient id="bg-${id}" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="${C.cobalt3}"/><stop offset="0.65" stop-color="${C.cobalt}"/><stop offset="1" stop-color="${C.cobalt2}"/>
    </radialGradient>
    <clipPath id="head-${id}"><circle cx="256" cy="232" r="82"/></clipPath>
  </defs>
  <rect width="512" height="512" fill="url(#bg-${id})"/>
  <g fill="${C.white}" opacity="0.08">${dots.join('')}</g>
  <g transform="rotate(${arcRotate} 256 232)">
    <path d="M 102 232 A 154 154 0 0 1 410 232" fill="none" stroke="${C.lime}" stroke-width="10" stroke-linecap="round" opacity="0.95"/>
    <circle cx="410" cy="232" r="13" fill="${C.lime}"/>
  </g>`;
}

// A bust: shoulders, neck, head. `hairBack` draws behind the head, `hairFront` is clipped to the head.
function bust(id, { skin, top, collar, hairBack = '', hairFront = '' }) {
  return `
  ${hairBack}
  <path d="M 92 512 C 92 418, 158 366, 256 366 C 354 366, 420 418, 420 512 Z" fill="${top}"/>
  ${collar || ''}
  <rect x="226" y="286" width="60" height="96" rx="24" fill="${shade(skin, 0.86)}"/>
  <circle cx="256" cy="232" r="82" fill="${skin}"/>
  <g clip-path="url(#head-${id})">${hairFront}</g>
  <g fill="${C.ink}"><ellipse cx="227" cy="244" rx="7" ry="8"/><ellipse cx="285" cy="244" rx="7" ry="8"/></g>
  <path d="M 236 274 Q 256 290 276 274" fill="none" stroke="${C.ink}" stroke-width="5" stroke-linecap="round" opacity="0.85"/>`;
}

const AVATARS = {
  // Dean Bilim, Exam Strategist: mortarboard, lime tassel, a navy blazer with lime lapels.
  'bilimind-crew-team-lead': (id) => background(id, -18) + bust(id, {
    skin: SKIN.b, top: C.navy,
    collar: `<path d="M 214 372 L 256 452 L 298 372 Z" fill="${C.white}"/>
      <path d="M 214 372 L 256 452 L 236 372 Z" fill="${C.lime}"/><path d="M 298 372 L 256 452 L 276 372 Z" fill="${C.lime}"/>`,
    hairFront: `<ellipse cx="256" cy="150" rx="104" ry="70" fill="${C.ink}"/>`,
  }) + `
  <rect x="196" y="140" width="120" height="40" rx="10" fill="${C.ink}"/>
  <polygon points="256,96 384,132 256,168 128,132" fill="${C.ink2}"/>
  <polygon points="256,104 368,132 256,160 144,132" fill="${C.ink}"/>
  <path d="M 256 132 L 352 150 L 352 206" fill="none" stroke="${C.lime}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="340" y="200" width="24" height="34" rx="8" fill="${C.lime}"/>`,

  // Paige Turner, Lesson Writer: a dark bob, a white top, a lime page with a folded corner.
  'bilimind-writer': (id) => background(id, 22) + bust(id, {
    skin: SKIN.a, top: C.white,
    collar: `<path d="M 226 366 C 236 396, 276 396, 286 366 Z" fill="${C.soft}"/>`,
    hairBack: `<rect x="160" y="148" width="192" height="182" rx="84" fill="${C.ink}"/>`,
    hairFront: `<path d="M 160 150 L 352 150 L 352 196 C 300 214, 236 206, 196 180 L 160 222 Z" fill="${C.ink}"/>`,
  }) + `
  <g transform="rotate(-9 362 420)">
    <path d="M 304 352 L 396 352 L 424 380 L 424 482 L 304 482 Z" fill="${C.lime}"/>
    <path d="M 396 352 L 396 380 L 424 380 Z" fill="${C.lime2}"/>
    <g stroke="${C.cobalt2}" stroke-width="7" stroke-linecap="round">
      <line x1="324" y1="396" x2="398" y2="396"/><line x1="324" y1="420" x2="404" y2="420"/>
      <line x1="324" y1="444" x2="380" y2="444"/></g>
  </g>`,

  // Ada Passmore, Exercise Tester: a high bun, an ink hoodie, a lime code badge with a pass tick.
  'bilimind-coder': (id) => background(id, -32) + bust(id, {
    skin: SKIN.c, top: C.ink2,
    collar: `<path d="M 206 370 C 216 420, 296 420, 306 370" fill="none" stroke="${C.soft}" stroke-width="8" stroke-linecap="round"/>
      <line x1="236" y1="404" x2="232" y2="452" stroke="${C.soft}" stroke-width="6" stroke-linecap="round"/>
      <line x1="276" y1="404" x2="280" y2="452" stroke="${C.soft}" stroke-width="6" stroke-linecap="round"/>`,
    hairBack: `<circle cx="256" cy="136" r="38" fill="${C.ink}"/>`,
    hairFront: `<path d="M 170 150 L 342 150 L 342 210 C 312 176, 252 164, 200 190 L 170 228 Z" fill="${C.ink}"/>`,
  }) + `
  <rect x="300" y="380" width="132" height="100" rx="20" fill="${C.lime}"/>
  <g fill="none" stroke="${C.ink}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="338,410 320,430 338,450"/><polyline points="394,410 412,430 394,450"/>
    <polyline points="352,432 364,446 384,416"/></g>`,

  // Vera Citewell, Slide Fact-Checker: long hair, lime round glasses, a magnifier with a tick.
  'bilimind-checker': (id) => background(id, 30) + bust(id, {
    skin: SKIN.d, top: C.soft,
    collar: `<path d="M 222 368 L 256 412 L 290 368 Z" fill="${C.cobalt}"/>`,
    hairBack: `<path d="M 160 228 C 160 150, 210 136, 256 136 C 302 136, 352 150, 352 228 L 362 400 L 150 400 Z" fill="${C.ink}"/>`,
    hairFront: `<path d="M 168 150 L 344 150 L 344 182 C 296 200, 236 194, 196 168 L 176 214 L 168 214 Z" fill="${C.ink}"/>`,
  }) + `
  <g fill="none" stroke="${C.lime}" stroke-width="7">
    <circle cx="226" cy="240" r="24"/><circle cx="286" cy="240" r="24"/>
    <path d="M 250 238 C 254 232, 258 232, 262 238"/></g>
  <g transform="translate(372 430)">
    <line x1="34" y1="34" x2="70" y2="70" stroke="${C.ink}" stroke-width="18" stroke-linecap="round"/>
    <circle cx="0" cy="0" r="50" fill="${C.white}" stroke="${C.lime}" stroke-width="14"/>
    <polyline points="-20,2 -6,18 22,-14" fill="none" stroke="${C.cobalt}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`,
};

// The team: four round medallions (lead top-left, then writer, checker, coder) on deep navy, joined by
// lime ties at a lime centre node: the crew as one network.
function team() {
  const ids = ['bilimind-crew-team-lead', 'bilimind-writer', 'bilimind-checker', 'bilimind-coder'];
  const centres = [[150, 150], [362, 150], [150, 362], [362, 362]];
  const R = 106;
  const dots = [];
  for (let y = 24; y < 512; y += 32) for (let x = 24; x < 512; x += 32) dots.push(`<circle cx="${x}" cy="${y}" r="2.2"/>`);
  const medals = ids.map((id, i) => {
    const [cx, cy] = centres[i];
    return `<clipPath id="med-${i}"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath>
    <g clip-path="url(#med-${i})"><g transform="translate(${cx - R} ${cy - R}) scale(${(2 * R) / 512})">${AVATARS[id](`t${i}`)}</g></g>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${C.lime}" stroke-width="${i === 0 ? 9 : 5}"/>`;
  });
  return `
  <defs><radialGradient id="bg-team" cx="50%" cy="50%" r="72%">
    <stop offset="0" stop-color="${C.cobalt2}"/><stop offset="1" stop-color="${C.navy}"/>
  </radialGradient></defs>
  <rect width="512" height="512" fill="url(#bg-team)"/>
  <g fill="${C.white}" opacity="0.07">${dots.join('')}</g>
  <g stroke="${C.lime}" stroke-width="8" stroke-linecap="round">
    <line x1="150" y1="150" x2="362" y2="362"/><line x1="362" y1="150" x2="150" y2="362"/></g>
  ${medals.join('\n')}
  <circle cx="256" cy="256" r="22" fill="${C.lime}"/><circle cx="256" cy="256" r="9" fill="${C.navy}"/>`;
}

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${body}</svg>\n`;
const files = { ...Object.fromEntries(Object.entries(AVATARS).map(([id, f]) => [id, svg(f(id))])), team: svg(team()) };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-avatars-'));
for (const [id, text] of Object.entries(files)) {
  fs.writeFileSync(path.join(HERE, `${id}.svg`), text);
  if (process.argv.includes('--svg-only')) continue;
  const html = path.join(tmp, `${id}.html`);
  fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:#2340E6}svg{display:block}</style></head><body>${text}</body></html>`);
  const png = path.join(OUT, `${id}.png`);
  fs.rmSync(png, { force: true });
  execFileSync(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--window-size=512,512', `--user-data-dir=${path.join(tmp, 'profile')}`, `--screenshot=${png}`, pathToFileURL(html).href], { stdio: 'ignore', timeout: 60000 });
  const buf = fs.readFileSync(png);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  console.log(`${id}.png ${w}x${h} ${(buf.length / 1024).toFixed(1)} KB`);
  if (w !== 512 || h !== 512) throw new Error(`${id}.png is ${w}x${h}, expected 512x512`);
  if (buf.length > 500 * 1024) throw new Error(`${id}.png is over 500 KB`);
}
fs.rmSync(tmp, { recursive: true, force: true });

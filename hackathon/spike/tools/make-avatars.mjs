// hackathon/spike/tools/make-avatars.mjs
// Writes flat placeholder avatars (512x512 PNG, a few KB each) for the bilimind-crew Expert Team package.
// Replace them later with ImageGen output if credits allow (spec: 512x512 PNG/JPG, <= 500 KB, one style).
//   node hackathon/spike/tools/make-avatars.mjs [outDir]

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] || path.join(HERE, '..', 'expert-team', 'bilimind-crew', 'avatars'));
const S = 512;

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const COBALT = hex('#2340E6'), INK = hex('#0E1330'), LIME = hex('#C6F24E'), SOFT = hex('#EEF1FE');

// A person = head circle + shoulders (ellipse cut by the bottom edge). Shapes are [kind, ...params, color].
function person(cx, cy, scale, color) {
  return [
    ['circle', cx, cy - 70 * scale, 62 * scale, color],
    ['ellipse', cx, cy + 120 * scale, 125 * scale, 105 * scale, color],
  ];
}
function inside(shape, x, y) {
  if (shape[0] === 'circle') { const [, cx, cy, r] = shape; return (x - cx) ** 2 + (y - cy) ** 2 <= r * r; }
  if (shape[0] === 'ellipse') { const [, cx, cy, rx, ry] = shape; return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1; }
  if (shape[0] === 'ring') { const [, cx, cy, r1, r2] = shape; const d = (x - cx) ** 2 + (y - cy) ** 2; return d <= r2 * r2 && d >= r1 * r1; }
  return false;
}
function render(bg, shapes) {
  const raw = Buffer.alloc((S * 4 + 1) * S);
  const sub = [0.25, 0.75];
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0;
    for (let x = 0; x < S; x++) {
      let acc = [0, 0, 0];
      for (const sy of sub) for (const sx of sub) {
        let c = bg;
        for (const sh of shapes) if (inside(sh, x + sx, y + sy)) c = sh[sh.length - 1];
        acc = [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]];
      }
      const o = y * (S * 4 + 1) + 1 + x * 4;
      raw[o] = Math.round(acc[0] / 4); raw[o + 1] = Math.round(acc[1] / 4); raw[o + 2] = Math.round(acc[2] / 4); raw[o + 3] = 255;
    }
  }
  return png(raw);
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const avatars = {
  'team.png': [COBALT, [
    ...person(150, 300, 0.62, SOFT), ...person(362, 300, 0.62, SOFT), ...person(256, 280, 0.8, LIME),
  ]],
  'bilimind-crew-team-lead.png': [COBALT, [['ring', 256, 256, 236, 250, LIME], ...person(256, 290, 1, LIME)]],
  'bilimind-writer.png': [LIME, [...person(256, 290, 1, INK)]],
  'bilimind-coder.png': [INK, [...person(256, 290, 1, LIME)]],
  'bilimind-checker.png': [SOFT, [['ring', 256, 256, 236, 250, COBALT], ...person(256, 290, 1, COBALT)]],
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, [bg, shapes]] of Object.entries(avatars)) {
  const buf = render(bg, shapes);
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(`${name} ${(buf.length / 1024).toFixed(1)} KB`);
}

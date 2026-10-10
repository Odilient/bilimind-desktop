// hackathon/spike/tools/build.mjs
// Builds the bilimind-spike skill assets, installs a copy into WorkBuddy's watched user skills folder,
// and writes hackathon/spike/bilimind-spike.zip (SKILL.md at the zip root, forward-slash entry names).
//
//   node hackathon/spike/tools/build.mjs            build + install + zip
//   node hackathon/spike/tools/build.mjs --no-install
//
// The install target is %USERPROFILE%\.workbuddy-ai\skills\bilimind-spike (WORKBUDDY_CONFIG_DIR wins if set).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPIKE = path.resolve(HERE, '..');
const SKILL = path.join(SPIKE, 'bilimind-spike');
const HACKATHON = path.resolve(SPIKE, '..');
const MP3_SRC = path.join(HACKATHON, 'scratch', 'media', 'out', 'en-US-AvaMultilingualNeural.sentence.mp3');
const ZIP_OUT = path.join(SPIKE, 'bilimind-spike.zip');
const noInstall = process.argv.includes('--no-install');

// ---------- assets ----------
function makePdf(pages) {
  // Minimal landscape PDF, one big label per page, Helvetica (standard 14 font, no embedding).
  const objs = [];
  const add = (body) => { objs.push(body); return objs.length; };
  const catalog = add(null);
  const pagesObj = add(null);
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const kids = [];
  for (let i = 1; i <= pages; i++) {
    const text = [
      'BT /F1 110 Tf 150 330 Td (SLIDE ' + i + ') Tj ET',
      'BT /F1 22 Tf 150 260 Td (BiliMind spike sample PDF, page ' + i + ' of ' + pages + ') Tj ET',
      i === 3 ? 'BT /F1 22 Tf 150 220 Td (If this is the first page you saw, #page=3 works.) Tj ET' : '',
    ].filter(Boolean).join('\n');
    const content = add(`<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${pages} >>`;
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((body, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

fs.mkdirSync(path.join(SKILL, 'assets'), { recursive: true });
fs.writeFileSync(path.join(SKILL, 'assets', 'sample.pdf'), makePdf(4));
if (!fs.existsSync(MP3_SRC)) throw new Error(`missing mp3: ${MP3_SRC}`);
fs.copyFileSync(MP3_SRC, path.join(SKILL, 'assets', 'sample.mp3'));
for (const f of ['SKILL.md', path.join('scripts', 'hello.mjs'), path.join('assets', 'spike.html')]) {
  if (!fs.existsSync(path.join(SKILL, f))) throw new Error(`missing ${f}`);
}

// ---------- file list ----------
function walk(dir, base = dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, base));
    else out.push({ abs: p, rel: path.relative(base, p).split(path.sep).join('/') });
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}
const files = walk(SKILL);

// ---------- install ----------
if (!noInstall) {
  const cfg = (process.env.WORKBUDDY_CONFIG_DIR || '').trim() || path.join(os.homedir(), '.workbuddy-ai');
  const target = path.join(cfg, 'skills', 'bilimind-spike');
  fs.rmSync(target, { recursive: true, force: true });
  for (const f of files) {
    const dst = path.join(target, ...f.rel.split('/'));
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(f.abs, dst);
  }
  console.log(`installed ${files.length} files -> ${target}`);
}

// ---------- zip (stored + deflate, no dependencies) ----------
function dosTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}
const locals = [];
const centrals = [];
let offset = 0;
const now = dosTime(new Date());
for (const f of files) {
  const data = fs.readFileSync(f.abs);
  const crc = zlib.crc32(data);
  const deflated = zlib.deflateRawSync(data, { level: 9 });
  const useDeflate = deflated.length < data.length;
  const body = useDeflate ? deflated : data;
  const name = Buffer.from(f.rel, 'utf8');
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
  lh.writeUInt16LE(useDeflate ? 8 : 0, 8); lh.writeUInt16LE(now.time, 10); lh.writeUInt16LE(now.date, 12);
  lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22);
  lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
  locals.push(lh, name, body);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
  ch.writeUInt16LE(useDeflate ? 8 : 0, 10); ch.writeUInt16LE(now.time, 12); ch.writeUInt16LE(now.date, 14);
  ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24);
  ch.writeUInt16LE(name.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34);
  ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
  centrals.push(ch, name);
  offset += lh.length + name.length + body.length;
}
const cd = Buffer.concat(centrals);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6);
end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
fs.writeFileSync(ZIP_OUT, Buffer.concat([...locals, cd, end]));
const kb = (fs.statSync(ZIP_OUT).size / 1024).toFixed(1);
console.log(`zip ${ZIP_OUT} (${kb} KB): ${files.map((f) => f.rel).join(', ')}`);

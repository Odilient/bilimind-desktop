#!/usr/bin/env node
// skills/bilimind/scripts/zip-skill.mjs (dev tool, not shipped in the zip)
//
// Packages the BiliMind skill and keeps the Expert Team package in sync with it.
//
//   node skills/bilimind/scripts/zip-skill.mjs            check, then write skills/dist/bilimind-skill.zip
//   node skills/bilimind/scripts/zip-skill.mjs --team     also sync workbuddy/bilimind-crew (playbooks into the
//                                                         member agents, a copy of the skill in skills/bilimind)
//                                                         and write skills/dist/bilimind-crew.zip
//   node skills/bilimind/scripts/zip-skill.mjs --check    verify only (no writes); exit 1 on any problem
//   --out <dir>                                           zip folder (default <repo>/skills/dist)
//
// Zips use forward-slash entry names (WorkBuddy's own package_expert.py writes backslashes on Windows).
// The skill zip has SKILL.md at its root (for "Upload skill"); the team zip has bilimind-crew/ at its root.
// Never reads or writes a key. Runs on Node 22+ (WorkBuddy's bundled Node included).

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SKILL = path.resolve(HERE, '..');
export const REPO = path.resolve(SKILL, '..', '..');
export const TEAM = path.join(REPO, 'workbuddy', 'bilimind-crew');
const MEMBERS = { 'bilimind-writer': 'writer', 'bilimind-coder': 'coder', 'bilimind-checker': 'checker' };
const START = '<!-- playbook:start -->';
const END = '<!-- playbook:end -->';

// ---------- file lists ----------
const SKILL_DEV_ONLY = new Set(['STATUS.md', 'install.ps1', 'scripts/zip-skill.mjs']);
function walk(dir, base = dir, keepDot = () => false) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if ((e.name.startsWith('.') && !keepDot(e.name)) || e.name === 'node_modules') continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(abs, base, keepDot));
    else out.push({ abs, rel: path.relative(base, abs).split(path.sep).join('/') });
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}
/** The files that ship in the skill: SKILL.md, references/, scripts/ (minus dev tools), templates/, assets/. */
export function skillFiles() {
  return walk(SKILL).filter((f) => !SKILL_DEV_ONLY.has(f.rel) && !f.rel.startsWith('test/') && !f.rel.endsWith('.map'));
}
/** The files that ship in the team package (avatars/src and dotfiles other than .codebuddy-plugin stay out). */
export function teamFiles() {
  return walk(TEAM, TEAM, (n) => n === '.codebuddy-plugin')
    .filter((f) => !f.rel.startsWith('avatars/src/') && f.rel !== 'STATUS.md');
}

// ---------- playbook sync ----------
export function playbookBlock(text, where) {
  const a = text.indexOf(START), b = text.indexOf(END);
  if (a < 0 || b < a) throw new Error(`${where}: missing ${START} ... ${END}`);
  return text.slice(a, b + END.length);
}
/** Returns the agent file with its playbook block replaced by the reference's block (LF endings). */
export function syncedAgent(agentText, refText, where) {
  const block = playbookBlock(refText.replace(/\r\n/g, '\n'), `references (${where})`);
  const agent = agentText.replace(/\r\n/g, '\n');
  const old = playbookBlock(agent, where);
  return agent.replace(old, block);
}

// ---------- checks ----------
export function problems({ team = true } = {}) {
  const out = [];
  const need = ['SKILL.md', 'references/writer.md', 'references/coder.md', 'references/checker.md',
    'references/planning.md', 'references/output-spec.md', 'references/troubleshooting.md'];
  for (const f of need) if (!fs.existsSync(path.join(SKILL, f))) out.push(`missing skills/bilimind/${f}`);
  const skillMd = fs.existsSync(path.join(SKILL, 'SKILL.md')) ? fs.readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8') : '';
  if (!/^---\r?\nname: bilimind\r?\n/.test(skillMd)) out.push('SKILL.md: frontmatter must start with name: bilimind');
  if (skillMd.split('\n').length > 260) out.push(`SKILL.md: ${skillMd.split('\n').length} lines (keep it under ~250)`);
  if (!skillMd.includes('present_files')) out.push('SKILL.md: must end the run with present_files');
  if (!skillMd.includes('${CODEBUDDY_SKILL_DIR}')) out.push('SKILL.md: must use ${CODEBUDDY_SKILL_DIR}');
  if (!team) return out;
  for (const [id, ref] of Object.entries(MEMBERS)) {
    const agentPath = path.join(TEAM, 'agents', `${id}.md`);
    if (!fs.existsSync(agentPath)) { out.push(`missing agents/${id}.md`); continue; }
    const raw = fs.readFileSync(agentPath, 'utf8');
    if (raw.includes('\r')) out.push(`agents/${id}.md has CRLF line endings (the validator needs LF)`);
    try {
      const want = syncedAgent(raw, fs.readFileSync(path.join(SKILL, 'references', `${ref}.md`), 'utf8'), `agents/${id}.md`);
      if (want !== raw) out.push(`agents/${id}.md playbook is out of sync with references/${ref}.md (run --team)`);
    } catch (e) { out.push(e.message); }
  }
  const lead = path.join(TEAM, 'agents', 'bilimind-crew-team-lead.md');
  if (fs.existsSync(lead) && fs.readFileSync(lead, 'utf8').includes('\r')) out.push('agents/bilimind-crew-team-lead.md has CRLF line endings');
  const copy = path.join(TEAM, 'skills', 'bilimind');
  for (const f of skillFiles()) {
    const dst = path.join(copy, ...f.rel.split('/'));
    if (!fs.existsSync(dst) || !fs.readFileSync(dst).equals(fs.readFileSync(f.abs))) {
      out.push(`workbuddy/bilimind-crew/skills/bilimind/${f.rel} is missing or stale (run --team)`);
      break;
    }
  }
  return out;
}

// ---------- team sync ----------
export function syncTeam() {
  for (const [id, ref] of Object.entries(MEMBERS)) {
    const agentPath = path.join(TEAM, 'agents', `${id}.md`);
    const next = syncedAgent(fs.readFileSync(agentPath, 'utf8'), fs.readFileSync(path.join(SKILL, 'references', `${ref}.md`), 'utf8'), id);
    fs.writeFileSync(agentPath, next);
  }
  const leadPath = path.join(TEAM, 'agents', 'bilimind-crew-team-lead.md');
  fs.writeFileSync(leadPath, fs.readFileSync(leadPath, 'utf8').replace(/\r\n/g, '\n'));
  const copy = path.join(TEAM, 'skills', 'bilimind');
  fs.rmSync(copy, { recursive: true, force: true });
  const files = skillFiles();
  for (const f of files) {
    const dst = path.join(copy, ...f.rel.split('/'));
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(f.abs, dst);
  }
  return files.length;
}

// ---------- zip (deflate, no dependencies) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf);
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function writeZip(outFile, entries) {
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const locals = [], centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const crc = crc32(data);
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const nameBuf = Buffer.from(name, 'utf8');
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(useDeflate ? 8 : 0, 8); lh.writeUInt16LE(time, 10); lh.writeUInt16LE(date, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, body);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(useDeflate ? 8 : 0, 10); ch.writeUInt16LE(time, 12); ch.writeUInt16LE(date, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(0, 30); ch.writeUInt32LE(0, 34);
    ch.writeUInt32LE(0, 38); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, Buffer.concat([...locals, cd, end]));
  return fs.statSync(outFile).size;
}

// ---------- main ----------
function main(argv) {
  const has = (f) => argv.includes(f);
  const outIdx = argv.indexOf('--out');
  const outDir = outIdx >= 0 ? path.resolve(argv[outIdx + 1]) : path.join(REPO, 'skills', 'dist');
  const team = has('--team');
  if (has('--check')) {
    const p = problems({ team: true });
    if (!fs.existsSync(path.join(SKILL, 'scripts', 'bilimind.mjs'))) console.warn('note: scripts/bilimind.mjs not built yet (WP6: node apps/cli/scripts/bundle.mjs)');
    if (p.length) { console.error(p.map((x) => `- ${x}`).join('\n')); process.exitCode = 1; } else console.log('ok: skill and team package are consistent');
    return;
  }
  if (team) console.log(`synced team package: ${syncTeam()} skill files copied into workbuddy/bilimind-crew/skills/bilimind`);
  const p = problems({ team });
  if (p.length) { console.error(p.map((x) => `- ${x}`).join('\n')); process.exitCode = 1; return; }
  const files = skillFiles();
  if (!files.some((f) => f.rel === 'scripts/bilimind.mjs')) console.warn('warning: scripts/bilimind.mjs is missing: build it first (node apps/cli/scripts/bundle.mjs); the zip will not run');
  if (!files.some((f) => f.rel === 'templates/player.html')) console.warn('warning: templates/player.html is missing (WP6 bundle copies it)');
  const skillZip = path.join(outDir, 'bilimind-skill.zip');
  const size = writeZip(skillZip, files.map((f) => ({ name: f.rel, data: fs.readFileSync(f.abs) })));
  console.log(`zip ${skillZip} (${(size / 1024).toFixed(1)} KB, ${files.length} files)`);
  if (size > 10 * 1024 * 1024) { console.error('the skill zip is over 10 MB'); process.exitCode = 1; }
  if (team) {
    const tf = teamFiles();
    const teamZip = path.join(outDir, 'bilimind-crew.zip');
    const tsize = writeZip(teamZip, tf.map((f) => ({ name: `bilimind-crew/${f.rel}`, data: fs.readFileSync(f.abs) })));
    console.log(`zip ${teamZip} (${(tsize / 1024).toFixed(1)} KB, ${tf.length} files)`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));

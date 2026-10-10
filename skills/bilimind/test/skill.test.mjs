// Tests for the BiliMind skill (WP7) and the Expert Team package (WP16).
//   node --test skills/bilimind/test/
// Dev-only: excluded from the skill zip, from install.ps1 and from the team package copy.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { SKILL, TEAM, problems, skillFiles, teamFiles, writeZip, syncedAgent, playbookBlock } from '../scripts/zip-skill.mjs';

const read = (p) => fs.readFileSync(p, 'utf8');
const skillMd = read(path.join(SKILL, 'SKILL.md'));
const BUNDLE = path.join(SKILL, 'scripts', 'bilimind.mjs');
const docs = ['SKILL.md', 'references/writer.md', 'references/coder.md', 'references/checker.md',
  'references/planning.md', 'references/troubleshooting.md'].map((f) => ({ f, text: read(path.join(SKILL, f)) }));

test('skill and team package are consistent (zip-skill --check)', () => {
  assert.deepEqual(problems({ team: true }), []);
});

test('SKILL.md frontmatter: name, trigger words, version', () => {
  const fm = skillMd.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(fm, 'frontmatter with LF endings');
  assert.match(fm[1], /^name: bilimind$/m);
  const desc = fm[1].match(/^description: "(.*)"$/m)?.[1] ?? '';
  for (const w of ['exam', 'final', 'lecture slides', 'past paper', 'revision', 'course', 'onboarding', 'SOP',
    'staff training', 'study plan', 'flashcards', 'quiz']) assert.ok(desc.includes(w), `description mentions "${w}"`);
  assert.ok(desc.length < 1024, 'description under 1024 characters');
  assert.match(fm[1], /^description_en: ".+"$/m);
  assert.match(fm[1], /^version: \d+\.\d+\.\d+$/m);
});

test('SKILL.md is the Lead playbook: short, never asks, parallel writers, ends with present_files', () => {
  const lines = skillMd.split('\n').length;
  assert.ok(lines <= 250, `SKILL.md has ${lines} lines`);
  assert.match(skillMd, /Never ask the user a question/);
  assert.match(skillMd, /\$\{CODEBUDDY_SKILL_DIR\}/);
  assert.match(skillMd, /TaskCreate/);
  assert.match(skillMd, /In ONE message, call the Agent tool once per kept lesson/);
  assert.match(skillMd, /FINAL tool call is `present_files`/);
  for (const f of ['index.html', 'plan.md', 'REPORT.md']) assert.ok(skillMd.includes(`COURSE/${f}`));
  for (const cmd of ['doctor', 'init', 'goal', 'ingest', 'outline', 'exam-map', 'plan', 'narrate', 'export', 'build'])
    assert.ok(skillMd.includes(cmd), `SKILL.md runs ${cmd}`);
  assert.ok(!/telegram/i.test(skillMd), 'no Telegram');
  assert.ok(!skillMd.includes('Artifact'), 'WorkBuddy has no Artifact tool');
});

test('`bm run` only ever appears as a prohibition', () => {
  for (const { f, text } of docs) for (const line of text.split('\n'))
    if (/`bm run`/.test(line)) assert.match(line, /[Nn]ever/, `${f}: ${line}`);
});

// Every `bm <cmd> --flag` in the playbooks must exist in the built CLI (skipped until WP6 bundles it).
test('every command and flag in the playbooks exists in the CLI', { skip: !fs.existsSync(BUNDLE) && 'bilimind.mjs not built' }, () => {
  // stdout carries only the one JSON line, so commander's help goes to stderr
  const help = (args) => { const r = spawnSync(process.execPath, [BUNDLE, ...args], { encoding: 'utf8' }); return `${r.stdout}
${r.stderr}`; };
  const commands = new Set([...help(['--help']).matchAll(/^ {2}([a-z][a-z-]*)\b/gm)].map((m) => m[1]));
  const global = new Set(['--course', '--as', '--no-cache', '--model', '--max-usd', '--help']);
  const used = new Map();
  for (const { text } of docs) {
    for (const m of text.matchAll(/(?:`bm |bilimind\.mjs" )([a-z][a-z-]*)([^`]*)`/g)) {
      if (!used.has(m[1])) used.set(m[1], new Set());
      for (const flag of m[2].matchAll(/--[a-z][a-z-]*/g)) used.get(m[1]).add(flag[0]);
    }
  }
  assert.ok(used.size >= 15, `found ${used.size} commands in the playbooks`);
  for (const [cmd, flags] of used) {
    if (cmd === 'run') continue; // only mentioned as "never"
    assert.ok(commands.has(cmd), `CLI has command "${cmd}"`);
    const own = help([cmd, '--help']);
    for (const flag of flags) if (!global.has(flag)) assert.ok(own.includes(flag), `"${cmd}" accepts ${flag}`);
  }
});

test('playbook blocks: member agents carry exactly the reference text', () => {
  for (const [id, ref] of [['bilimind-writer', 'writer'], ['bilimind-coder', 'coder'], ['bilimind-checker', 'checker']]) {
    const agent = read(path.join(TEAM, 'agents', `${id}.md`));
    const refText = read(path.join(SKILL, 'references', `${ref}.md`));
    assert.equal(playbookBlock(agent, id), playbookBlock(refText, ref));
    assert.equal(syncedAgent(agent, refText, id), agent);
    assert.match(agent, /SendMessage/);
    const lines = playbookBlock(refText, ref).split('\n').length;
    assert.ok(lines >= 15 && lines <= 45, `${ref}.md playbook is ${lines} lines (15-40 wanted)`);
  }
});

test('agent files: LF, name == file name, no tools field, bilingual display names', () => {
  const plugin = JSON.parse(read(path.join(TEAM, '.codebuddy-plugin', 'plugin.json')));
  for (const rel of plugin.agents) {
    const file = path.join(TEAM, rel);
    const text = read(file);
    assert.ok(!text.includes('\r'), `${rel} uses LF`);
    const fm = text.match(/^---\n([\s\S]*?)\n---/)?.[1];
    assert.ok(fm, `${rel} frontmatter`);
    assert.match(fm, new RegExp(`^name: ${path.basename(rel, '.md')}$`, 'm'));
    assert.ok(!/^tools:/m.test(fm), `${rel} has no tools field`);
    assert.match(fm, /^displayName:\n {2}en: ".+"\n {2}zh: ".+"$/m);
    assert.match(fm, /^profession:\n {2}en: ".+"\n {2}zh: ".+"$/m);
    assert.match(fm, /^maxTurns: \d+$/m);
  }
  const lead = read(path.join(TEAM, 'agents', 'bilimind-crew-team-lead.md'));
  for (const s of ['TeamCreate', 'SendMessage', 'present_files', '`subagent_type`', 'In ONE message', '- bilimind'])
    assert.ok(lead.includes(s), `lead prompt mentions ${s}`);
});

test('plugin.json follows the team spec', () => {
  const p = JSON.parse(read(path.join(TEAM, '.codebuddy-plugin', 'plugin.json')));
  assert.equal(p.name, 'bilimind-crew');
  assert.equal(p.plugin, p.name);
  assert.equal(p.expertType, 'team');
  assert.equal(p.agentName, 'bilimind-crew-team-lead');
  assert.equal(JSON.parse(read(path.join(TEAM, 'settings.json'))).agent, p.agentName);
  assert.deepEqual(p.teamInfo.memberAgents, ['bilimind-writer', 'bilimind-coder', 'bilimind-checker']);
  assert.deepEqual(p.profession, p.displayName);
  assert.equal(p.tags.length, 3);
  assert.equal(p.quickPrompts.length, 3);
  assert.deepEqual(p.defaultInitPrompt, p.quickPrompts[0]);
  const zh = [...p.displayDescription.zh].length;
  assert.ok(zh >= 40 && zh <= 50, `displayDescription.zh is ${zh} characters`);
  assert.ok(['09-OperationsHR', '04-DataAI'].includes(p.categoryId));
  assert.deepEqual(p.skills, ['./skills/bilimind']);
  assert.ok(fs.existsSync(path.join(TEAM, 'skills', 'bilimind', 'SKILL.md')));
  assert.deepEqual(p.members.map((m) => m.id).sort(), [p.agentName, ...p.teamInfo.memberAgents].sort());
  assert.equal(p.members.filter((m) => m.role === 'lead').length, 1);
  for (const m of p.members) {
    assert.ok(m.displayName.en && m.displayName.zh && m.profession.en && m.profession.zh);
    assert.notEqual(m.displayName.en, m.profession.en);
    assert.notEqual(m.displayName.en, m.id);
  }
});

test('avatars: N+1 PNGs, 512x512, at most 500 KB', () => {
  const p = JSON.parse(read(path.join(TEAM, '.codebuddy-plugin', 'plugin.json')));
  const files = [p.avatar, ...p.members.map((m) => m.avatar)];
  assert.equal(new Set(files).size, p.members.length + 1);
  for (const rel of files) {
    const buf = fs.readFileSync(path.join(TEAM, rel));
    assert.equal(buf.subarray(1, 4).toString('latin1'), 'PNG', `${rel} is a PNG`);
    assert.equal(buf.readUInt32BE(16), 512); assert.equal(buf.readUInt32BE(20), 512);
    assert.ok(buf.length <= 500 * 1024, `${rel} is ${buf.length} bytes`);
  }
});

// A tiny zip reader: entries from the central directory, inflated and compared with the sources.
function readZip(file) {
  const buf = fs.readFileSync(file);
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map();
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28);
    const elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString('utf8');
    const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const body = buf.subarray(start, start + csize);
    out.set(name, method === 8 ? zlib.inflateRawSync(body) : body);
    p += 46 + nlen + elen + clen;
  }
  return out;
}

test('skill zip: SKILL.md at the root, forward slashes, no dev files, contents intact', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-zip-'));
  const files = skillFiles();
  const zip = path.join(tmp, 'bilimind-skill.zip');
  writeZip(zip, files.map((f) => ({ name: f.rel, data: fs.readFileSync(f.abs) })));
  const entries = readZip(zip);
  assert.ok(entries.has('SKILL.md'));
  for (const name of entries.keys()) {
    assert.ok(!name.includes('\\'), name);
    assert.ok(!/^(STATUS\.md|install\.ps1|scripts\/zip-skill\.mjs|test\/)/.test(name), `dev file ${name} not shipped`);
  }
  for (const f of files) assert.ok(entries.get(f.rel).equals(fs.readFileSync(f.abs)), `${f.rel} round-trips`);
  assert.ok(fs.statSync(zip).size < 10 * 1024 * 1024, 'zip under 10 MB');
  const team = teamFiles().map((f) => f.rel);
  assert.ok(team.includes('.codebuddy-plugin/plugin.json'));
  assert.ok(!team.some((r) => r.startsWith('avatars/src/')));
  fs.rmSync(tmp, { recursive: true, force: true });
});

const PY = 'C:\\Program Files\\WorkBuddyAI\\resources\\vendor\\python\\python.exe';
const VALIDATE = 'C:\\Program Files\\WorkBuddyAI\\resources\\app.asar.unpacked\\resources\\plugins\\workbuddy-builtin\\skills\\expert-manager\\scripts\\validate_expert.py';
test('WorkBuddy validate_expert.py passes (scratch config folder, nothing registered)', { skip: !(fs.existsSync(PY) && fs.existsSync(VALIDATE)) && 'WorkBuddy not installed' }, () => {
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-wbcfg-'));
  const dest = path.join(cfg, 'plugins', 'marketplaces', 'my-experts', 'plugins', 'bilimind-crew');
  fs.cpSync(TEAM, dest, { recursive: true });
  const r = spawnSync(PY, [VALIDATE, dest], { encoding: 'utf8', env: { ...process.env, WORKBUDDY_CONFIG_DIR: cfg, PYTHONUTF8: '1' } });
  fs.rmSync(cfg, { recursive: true, force: true });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Expert package is valid/);
  assert.ok(!/warning/i.test(r.stdout), r.stdout);
});

test('install.ps1 copies the runtime files only', { skip: process.platform !== 'win32' && 'Windows only' }, () => {
  const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bm-inst-')), 'bilimind');
  const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(SKILL, 'install.ps1'), '-Target', target], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const got = new Set(fs.readdirSync(target, { recursive: true }).map((p) => String(p).split(path.sep).join('/')));
  for (const f of skillFiles()) assert.ok(got.has(f.rel), `installed ${f.rel}`);
  for (const dev of ['STATUS.md', 'install.ps1', 'scripts/zip-skill.mjs', 'test']) assert.ok(!got.has(dev), `${dev} not installed`);
  assert.ok(!/sk-[A-Za-z0-9]{10,}/.test(r.stdout), 'never prints a key');
  fs.rmSync(path.dirname(target), { recursive: true, force: true });
});

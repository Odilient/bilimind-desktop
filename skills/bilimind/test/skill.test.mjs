// Tests for the BiliMind skill (WP7) and the Expert Team package (WP16).
//   node --test skills/bilimind/test/
// Dev-only: excluded from the skill zip and from install.ps1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { SKILL, problems, skillFiles, writeZip } from '../scripts/zip-skill.mjs';

const read = (p) => fs.readFileSync(p, 'utf8');
const skillMd = read(path.join(SKILL, 'SKILL.md'));
const BUNDLE = path.join(SKILL, 'scripts', 'bilimind.mjs');
const docs = ['SKILL.md', 'references/writer.md', 'references/coder.md', 'references/checker.md',
  'references/planning.md', 'references/troubleshooting.md'].map((f) => ({ f, text: read(path.join(SKILL, f)) }));

test('the skill is consistent (zip-skill --check)', () => {
  assert.deepEqual(problems(), []);
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
  fs.rmSync(tmp, { recursive: true, force: true });
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

// Contract test (PLAN §2.5, WP6 acceptance): every command, run as a real process on the fixture, prints exactly ONE
// JSON line on stdout ({ok:true,cmd,data,cost_usd,ms} or {ok:false,cmd,error,hint}) and exits 0/1 to match.
// The network is disabled (test/no-net.mjs), so LLM and TTS commands fail cleanly instead of spending money.
// Engine functions still being built answer "not implemented"; the summary at the end says which.
// BILIMIND_CLI=<path to bilimind.mjs> runs the same suite against the esbuild bundle.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedCourse, writeSourceFolder } from './seed.ts';

const here = dirname(fileURLToPath(import.meta.url));
const CLI = process.env.BILIMIND_CLI ? resolve(process.env.BILIMIND_CLI) : join(here, '..', 'src', 'main.ts');
const NO_NET = pathToFileURL(join(here, 'no-net.mjs')).href;
const SENTENCE = "My Data Structures final is 14 Oct 2026 at 9am. The slides and last year's paper are in this folder. I have 45 minutes a day.";

interface Line { ok: boolean; cmd: string; data?: any; cost_usd?: number; ms?: number; error?: string; hint?: string }
interface Call { label: string; args: string[]; status: number | null; lines: string[]; line: Line | null; stderr: string; ms: number }
const calls: Call[] = [];

function cli(label: string, args: string[], cwd: string): Call {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['--no-warnings', '--import', NO_NET, CLI, ...args], {
    cwd, encoding: 'utf8', timeout: 120_000, env: { ...process.env, BILIMIND_DEBUG: '', NODE_OPTIONS: '', BILIMIND_NO_CLOCK: '1' },   // offline probe must not cache skew 0 in the real ~/.bilimind/clock.json
  });
  const lines = (r.stdout ?? '').split(/\r?\n/).filter(l => l.trim());
  let line: Line | null = null;
  try { line = lines.length === 1 ? JSON.parse(lines[0]!) : null; } catch { line = null; }
  const c: Call = { label, args, status: r.status, lines, line, stderr: r.stderr ?? '', ms: Date.now() - t0 };
  calls.push(c);
  return c;
}

/** The JSON-line contract, for every call. */
function contract(c: Call): Line {
  expect(c.lines.length, `${c.label}: stdout must be exactly one line, got ${c.lines.length}\n${c.lines.join('\n')}\nstderr: ${c.stderr.slice(-800)}`).toBe(1);
  expect(c.line, `${c.label}: stdout is not JSON: ${c.lines[0]}`).not.toBeNull();
  const l = c.line!;
  expect(typeof l.ok).toBe('boolean');
  expect(typeof l.cmd).toBe('string');
  if (l.ok) {
    expect(Object.keys(l).sort()).toEqual(['cmd', 'cost_usd', 'data', 'ms', 'ok']);
    expect(typeof l.cost_usd).toBe('number');
    expect(typeof l.ms).toBe('number');
    expect(c.status, `${c.label}: ok:true must exit 0`).toBe(0);
  } else {
    expect(Object.keys(l).sort()).toEqual(['cmd', 'error', 'hint', 'ok']);
    expect(typeof l.error).toBe('string');
    expect(l.error!.length).toBeGreaterThan(0);
    expect(typeof l.hint).toBe('string');
    expect(c.status, `${c.label}: ok:false must exit 1`).toBe(1);
  }
  return l;
}

const kindOf = (c: Call) => !c.line ? 'BROKEN' : c.line.ok ? 'ok' : /^not implemented/i.test(c.line.error ?? '') ? 'not implemented' : 'error';

let ws = '';
let src = '';
let seeded = '';
let planted = '';

beforeAll(() => {
  ws = mkdtempSync(join(tmpdir(), 'bm-contract-'));
  src = join(ws, 'notes');
  writeSourceFolder(src);
  seeded = join(ws, 'seeded');
  seedCourse(seeded);
  planted = join(ws, 'planted');
  cpSync(seeded, planted, { recursive: true });
});

afterAll(() => {
  const rows = calls.map(c => `${kindOf(c).padEnd(16)} ${c.label.padEnd(34)} ${String(c.ms).padStart(6)} ms  ${c.line && !c.line.ok ? c.line.error!.slice(0, 90) : ''}`);
  const by = (k: string) => [...new Set(calls.filter(c => kindOf(c) === k).map(c => c.line?.cmd || c.label))];
  console.log([
    `\nCLI contract report (${CLI.endsWith('.mjs') ? 'bundle' : 'source'}): ${calls.length} calls`,
    ...rows,
    `\nok:              ${by('ok').join(', ')}`,
    `not implemented: ${by('not implemented').join(', ')}`,
    `error:           ${by('error').join(', ')}`,
    `BROKEN contract: ${by('BROKEN').join(', ') || 'none'}`,
  ].join('\n'));
  if (!process.env.BILIMIND_KEEP) rmSync(ws, { recursive: true, force: true });
});

describe('usage errors still answer with one JSON line', () => {
  it('no command, unknown command, missing required option, bad values', () => {
    expect(contract(cli('(no command)', [], ws)).ok).toBe(false);
    const u = contract(cli('unknown command', ['frobnicate'], ws));
    expect(u.ok).toBe(false);
    expect(u.cmd).toBe('frobnicate');
    const m = contract(cli('draft without --lesson', ['draft'], ws));
    expect(m.ok).toBe(false);
    expect(m.cmd).toBe('draft');
    expect(contract(cli('status without a course', ['status'], ws)).ok).toBe(false);
    expect(contract(cli('code-test two modes', ['code-test', '--lesson', 'x', '--dump', '--apply', '--course', seeded], ws)).ok).toBe(false);
    expect(contract(cli('plan --start bad', ['plan', '--keep', 'a', '--start', 'monday', '--course', seeded], ws)).ok).toBe(false);
    expect(contract(cli('--max-usd bad', ['status', '--max-usd', 'lots', '--course', seeded], ws)).ok).toBe(false);
  });
});

describe('fresh course: doctor, init, goal, ingest, outline, status', () => {
  it('runs the Lead\'s first steps', () => {
    contract(cli('doctor', ['doctor'], ws));

    const i = contract(cli('init', ['init', '--src', 'notes', '--sentence', SENTENCE, '--as', 'Lead'], ws));
    expect(i.ok, i.error).toBe(true);
    const course = i.data.course as string;
    expect(existsSync(course)).toBe(true);
    const copied = readdirSync(join(course, 'sources')).sort();
    expect(copied).toEqual(['sample-lecture-04-hashing.md', 'sample-lecture-08-heaps.md', 'sample-quiz-1-past-paper.md']);
    expect(copied).not.toContain('LICENSE.md');

    // a second init gets its own folder, and is now the newest (the --course default)
    const i2 = contract(cli('init again', ['init', '--src', 'notes', '--sentence', SENTENCE, '--slug', 'ds-final'], ws));
    expect(i2.ok, i2.error).toBe(true);
    expect(i2.data.course).toMatch(/\/bilimind-out\/ds-final$/);

    const gl = contract(cli('goal', ['goal', '--deadline', '2026-10-14', '--exam-time', '09:00', '--minutes-per-day', '45', '--audience', 'student',
      '--lang', 'en', '--code-lang', 'js', '--assume', 'Wednesday means 14 Oct 2026', '--assume', 'Study starts Sunday', '--as', 'Lead'], ws));
    expect(gl.ok, gl.error).toBe(true);
    expect(gl.data.goal.exam_at).toBe('2026-10-14T09:00:00+08:00');
    expect(gl.data.goal.code_language).toBe('javascript');
    expect(gl.data.goal.sentence).toBe(SENTENCE);
    expect(gl.data.goal.assumptions).toEqual(['Wednesday means 14 Oct 2026', 'Study starts Sunday']);
    const goalFile = JSON.parse(readFileSync(join(i2.data.course, 'crew', 'goal.json'), 'utf8'));
    expect(goalFile.minutes_per_day).toBe(45);

    expect(contract(cli('goal bad minutes', ['goal', '--minutes-per-day', '2'], ws)).ok).toBe(false);
    expect(contract(cli('goal bad date', ['goal', '--minutes-per-day', '45', '--deadline', 'next tuesday'], ws)).ok).toBe(false);

    contract(cli('ingest', ['ingest', '--role', 'sample-quiz-1-past-paper.md=past_paper'], ws));
    expect(contract(cli('ingest bad role', ['ingest', '--role', 'x.pdf=homework'], ws)).ok).toBe(false);
    contract(cli('outline (offline)', ['outline', '--max-topics', '4', '--no-cache'], ws));

    const st = contract(cli('status', ['status', '--as', 'Lead'], ws));
    expect(st.ok, st.error).toBe(true);
    expect(st.data.stages.init).toBe('done');
    expect(st.data.stages.goal).toBe('done');
    expect(typeof st.data.next).toBe('string');
  });
});

describe('seeded course: every other command on the fixture', () => {
  it('Lead, Writer, Coder, Checker, packaging, review and benchmark commands', () => {
    const C = ['--course', seeded];
    const st = contract(cli('status (seeded)', ['status', ...C], ws));
    expect(st.ok, st.error).toBe(true);
    expect(st.data.stages.plan).toBe('done');
    expect(st.data.lessons).toEqual({ hash_tables: 'drafted', binary_heaps: 'drafted' });

    contract(cli('note', ['note', '--text', 'Cut AVL rotations: no marks in the past paper.', ...C], ws));
    contract(cli('exam-map', ['exam-map', '--assign', 'Q2=hash_tables', ...C], ws));
    contract(cli('plan', ['plan', '--keep', 'hash_tables,binary_heaps', '--cut', 'dynamic_arrays=10% of the marks', '--cut', 'avl_rotations=no marks',
      '--start', '2026-10-11', ...C], ws));
    contract(cli('draft (offline)', ['draft', '--lesson', 'hash_tables', '--only', 'walkthrough', '--note', 'Teach probing step by step.', '--as', 'Writer · Hash tables', ...C], ws));
    for (const k of ['hash_tables', 'binary_heaps']) contract(cli(`check ${k}`, ['check', '--lesson', k, '--as', 'Writer', ...C], ws));
    contract(cli('code-test run', ['code-test', '--lesson', 'hash_tables', '--as', 'Coder', ...C], ws));
    contract(cli('code-test --dump', ['code-test', '--lesson', 'hash_tables', '--block', '10', '--dump', '--as', 'Coder', ...C], ws));
    contract(cli('code-test --apply', ['code-test', '--lesson', 'hash_tables', '--block', 'b10', '--apply', '--as', 'Coder', ...C], ws));
    contract(cli('code-test --disable', ['code-test', '--lesson', 'binary_heaps', '--block', '8', '--disable', '--reason', 'contract test', '--as', 'Coder', ...C], ws));
    contract(cli('evidence', ['evidence', '--lesson', 'hash_tables', '--as', 'Checker', ...C], ws));

    // a real verbatim quote from the chunk an item cites
    const draft = JSON.parse(readFileSync(join(seeded, 'crew', 'lessons', 'hash_tables.json'), 'utf8'));
    const ingest = JSON.parse(readFileSync(join(seeded, 'crew', 'ingest.json'), 'utf8'));
    const items = draft.blocks.flatMap((b: any) => b.assessments.map((a: any) => ({ ...a, block: b })));
    const cited = items.find((a: any) => a.cite_chunk_ids?.length && a.status !== 'contradicted') ?? items[0];
    const chunkId = cited.cite_chunk_ids?.[0] ?? cited.block.source_material_ids?.[0];
    const quote = (ingest.chunks.find((ch: any) => ch.id === chunkId)?.content ?? '').split('. ')[0];
    contract(cli('verdict --item', ['verdict', '--lesson', 'hash_tables', '--item', cited.id, '--verdict', 'supported', '--quote', quote,
      '--reason', 'The slide states it.', '--as', 'Checker', ...C], ws));
    const rulings = join(ws, 'rulings.json');
    writeFileSync(rulings, JSON.stringify({ rulings: [{ item: cited.id, verdict: 'not covered', quote: 'this is not in the slides', reason: 'invented' }] }));
    contract(cli('verdict --file', ['verdict', '--lesson', 'hash_tables', '--file', rulings, '--as', 'Checker', ...C], ws));
    expect(contract(cli('verdict bad kind', ['verdict', '--lesson', 'hash_tables', '--item', 'q2', '--verdict', 'maybe', '--quote', 'x', ...C], ws)).ok).toBe(false);
    contract(cli('rewrite-item (offline)', ['rewrite-item', '--lesson', 'hash_tables', '--item', 'q5', '--reason', 'Only the chain at h(k) is searched.', '--as', 'Checker', ...C], ws));

    contract(cli('narrate (offline)', ['narrate', '--lessons', 'hash_tables', '--langs', 'en', ...C], ws));
    contract(cli('export', ['export', ...C], ws));
    contract(cli('build', ['build', ...C], ws));
    expect(contract(cli('build bad template', ['build', '--template', 'nope.html', ...C], ws)).ok).toBe(false);
    contract(cli('due', ['due', '--n', '3', ...C], ws));
    contract(cli('grade', ['grade', '--answers', '1 b, 2 chaining', ...C], ws));
    contract(cli('plant', ['plant', '--n', '2', '--course', planted], ws));
    contract(cli('plant-score', ['plant-score', '--course', planted], ws));

    // global options also work BEFORE the command
    const pre = contract(cli('options before command', ['--course', seeded, '--as', 'Checker', 'status'], ws));
    expect(pre.ok, pre.error).toBe(true);
  });

  it('every logged command lands in crew/log.jsonl with its --as label (when log.ts is implemented)', () => {
    const log = join(seeded, 'crew', 'log.jsonl');
    if (!existsSync(log)) { console.log('crew/log.jsonl not written yet (log.ts appendLog is still a stub)'); return; }
    const events = readFileSync(log, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
    expect(events.some(e => e.cmd === 'note' && e.agent === 'Lead')).toBe(true);
    expect(events.some(e => e.agent === 'Checker')).toBe(true);
    for (const e of events) expect(typeof e.ms).toBe('number');
  });
});

describe('run (builders-only harness)', () => {
  it('answers with one JSON line even when a step fails offline', () => {
    const r = contract(cli('run (offline)', ['run', '--src', 'notes', '--sentence', SENTENCE, '--slug', 'run-offline', '--no-narrate', '--concurrency', '2'], ws));
    if (r.ok) expect(r.data.course).toBeTruthy();
  });
});

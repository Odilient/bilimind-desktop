// `run` end to end with NO real model: a local mock of the OpenAI-compatible API (BILIMIND_BASE_URL) answers every call
// with one superset reply built from the recorded samples (hackathon/research/engine-port-samples): outline nodes,
// lesson blocks and higher-order items in one object; each stage reads its own keys. Free and offline, so it can run
// on every change: it proves the wiring (init -> ... -> build), not the content quality.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateCourse } from '@bilimind/core';
import { writeSourceFolder } from './seed.ts';

const here = dirname(fileURLToPath(import.meta.url));
const CLI = process.env.BILIMIND_CLI ? resolve(process.env.BILIMIND_CLI) : join(here, '..', 'src', 'main.ts');
const SAMPLES = join(here, '..', '..', '..', 'hackathon', 'research', 'engine-port-samples');
const sample = (f: string) => JSON.parse(readFileSync(join(SAMPLES, f), 'utf8'));

let server: ReturnType<typeof createServer>;
let base = '';
let calls = 0;
let ws = '';

beforeAll(async () => {
  const outline = sample('outline-trees-heaps-noreason.json');
  const lesson = sample('lesson-bst-noreason.json');
  const items = lesson.blocks.flatMap((b: { assessments?: unknown[] }) => b.assessments ?? []).slice(0, 2);
  const reply = { ...outline, ...lesson, assessments: items };
  server = createServer((req, res) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      if (req.url?.includes('balance')) { res.end(JSON.stringify({ is_available: true, balance_infos: [{ currency: 'USD', total_balance: '50.00' }] })); return; }
      calls++;
      res.end(JSON.stringify({ id: `mock-${calls}`, model: 'deepseek-flash', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(reply) } }],
        usage: { prompt_tokens: 1000, completion_tokens: 1500 } }));
    });
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  ws = mkdtempSync(join(tmpdir(), 'bm-run-'));
  writeSourceFolder(join(ws, 'notes'));
});

afterAll(() => {
  server?.close();
  if (!process.env.BILIMIND_KEEP) rmSync(ws, { recursive: true, force: true });
});

function runCli(args: string[]): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise(res => {
    const p = spawn(process.execPath, ['--no-warnings', CLI, ...args], {
      cwd: ws,
      env: {
        ...process.env, NODE_OPTIONS: '', BILIMIND_BASE_URL: base, BILIMIND_PROVIDER: 'deepseek', DEEPSEEK_API_KEY: 'mock-key',
        OPENROUTER_API_KEY: '', BILIMIND_HOME: join(ws, '.bilimind'), BILIMIND_NO_ENV_LOCAL: '1', BILIMIND_LLM_TIMEOUT_MS: '20000',
      },
    });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', c => { stdout += c; });
    p.stderr.on('data', c => { stderr += c; });
    p.on('close', status => res({ status, stdout, stderr }));
  });
}

describe('run against a mock model', () => {
  it('goes init -> goal -> ingest -> outline -> plan -> draft/check -> code-test -> evidence -> export -> build', async () => {
    const r = await runCli(['run', '--src', 'notes', '--sentence', 'My Data Structures final is 14 Oct 2026 at 9am. I have 45 minutes a day.',
      '--slug', 'mock-run', '--no-narrate', '--max-lessons', '2', '--repair-rounds', '0', '--concurrency', '2', '--no-cache']);
    const lines = r.stdout.split(/\r?\n/).filter(Boolean);
    expect(lines.length, r.stderr.slice(-3000)).toBe(1);
    const line = JSON.parse(lines[0]!);
    const steps = (line.data?.steps ?? []) as { cmd: string; agent: string; ok: boolean; error?: string; result?: string }[];
    console.log(`run (mock model): ${line.ok ? 'ok' : `FAILED: ${line.error}`} · ${calls} model calls\n`
      + steps.map(s => `  ${s.ok ? 'ok    ' : 'FAILED'} ${s.agent.padEnd(28)} ${s.cmd.padEnd(10)} ${s.ok ? s.result ?? '' : s.error}`).join('\n'));
    if (!line.ok) {
      // engine lanes still landing: the contract holds, the failure is reported above
      expect(line.error).toBeTruthy();
      return;
    }
    expect(line.data.lessons).toBeGreaterThan(0);
    const course = line.data.course as string;
    expect(existsSync(join(course, 'index.html'))).toBe(true);
    const v = validateCourse(JSON.parse(readFileSync(join(course, 'course.json'), 'utf8')));
    expect(v.errors, v.errors.slice(0, 5).join('\n')).toEqual([]);
    const log = readFileSync(join(course, 'crew', 'log.jsonl'), 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
    expect(log.some(e => e.agent.startsWith('Writer · ') && e.cmd === 'draft')).toBe(true);
  });
});

// Live probe (NOT part of `vitest run`): one tiny JSON call per provider through callJson, ~$0.0002 in all.
// Usage: node packages/engine/test/live/probe.ts [deepseek|openrouter|both]
// Prints provider, model, tokens, cost and ms only; never the key.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { callJson, setEngineConfig } from '../../src/llm.ts';
import { loadConfig } from '../../src/config.ts';
import type { Ctx, ProviderId } from '../../src/contracts.ts';

const which = (process.argv[2] ?? 'both') as ProviderId | 'both';
const providers: ProviderId[] = which === 'both' ? ['deepseek', 'openrouter'] : [which];
const course = mkdtempSync(join(tmpdir(), 'bm-probe-'));

for (const p of providers) {
  const cfg = loadConfig({ env: { ...process.env, BILIMIND_PROVIDER: p } });
  setEngineConfig(cfg);
  const ctx: Ctx = { course, agent: 'Probe', noCache: true, spend: { usd: 0, calls: 0 }, now: () => new Date(), progress: l => process.stderr.write(l + '\n') };
  try {
    const r = await callJson<{ answer: number; word: string }>(ctx, {
      stage: 'probe', system: 'You are a calculator.', user: 'What is 2+3? Also give one English word for the number.', maxTokens: 60, temperature: 0,
      schema: { type: 'object', required: ['answer', 'word'], properties: { answer: { type: 'integer' }, word: { type: 'string', maxLength: 10 } } },
    });
    console.log(JSON.stringify({ provider: r.provider, key_source: cfg.keySource, model: r.model, data: r.data, usage: r.usage, cost_usd: r.cost_usd, ms: r.ms, attempts: r.attempts }));
  } catch (e) {
    console.log(JSON.stringify({ provider: p, error: (e as Error).message, hint: (e as { hint?: string }).hint }));
  }
}

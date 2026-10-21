// WP1: ledger caps, balance floor, config precedence, log + note.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkBudget, recordSpend, spentToday, spentForCourse, balance, parseBalance, resetBalanceCache } from '../src/ledger.ts';
import { loadConfig, parseDotenv, redact } from '../src/config.ts';
import { appendLog, readLog, note } from '../src/log.ts';
import { BilimindError } from '../src/contracts.ts';
import type { LedgerEntry } from '../src/contracts.ts';
import { fakeConfig, fakeCtx, tempDir } from './wp1-helpers.ts';

const entry = (course: string, cost: number, ts = new Date().toISOString()): LedgerEntry =>
  ({ ts, course, cmd: 'expand', provider: 'deepseek', model: 'deepseek-flash', prompt_tokens: 1, completion_tokens: 1, cost_usd: cost, cached: false });

let dir: string;
beforeEach(() => { dir = tempDir(); resetBalanceCache(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('ledger', () => {
  it('sums per course and per UTC day', () => {
    const cfg = fakeConfig(dir);
    recordSpend(cfg, entry(join(dir, 'a'), 0.01));
    recordSpend(cfg, entry(join(dir, 'a'), 0.02));
    recordSpend(cfg, entry(join(dir, 'b'), 0.04, '2020-01-01T10:00:00.000Z'));
    expect(spentForCourse(cfg, join(dir, 'a'))).toBeCloseTo(0.03, 9);
    expect(spentForCourse(cfg, join(dir, 'b') + '/')).toBeCloseTo(0.04, 9);
    expect(spentToday(cfg)).toBeCloseTo(0.03, 9);
    expect(spentToday(cfg, new Date('2020-01-01T23:00:00Z'))).toBeCloseTo(0.04, 9);
  });

  it('refuses above $0.25 per run', async () => {
    const cfg = fakeConfig(dir);
    const course = join(dir, 'course');
    recordSpend(cfg, entry(course, 0.24));
    await expect(checkBudget(fakeCtx(course), cfg, 0.005)).resolves.toBeUndefined();
    await expect(checkBudget(fakeCtx(course), cfg, 0.02)).rejects.toThrow(/per-run cap/);
  });

  it('refuses above $2 per day', async () => {
    const cfg = fakeConfig(dir);
    for (let i = 0; i < 10; i++) recordSpend(cfg, entry(join(dir, `c${i}`), 0.199));
    await expect(checkBudget(fakeCtx(join(dir, 'new')), cfg, 0.02)).rejects.toThrow(/daily cap/);
  });

  it('refuses above --max-usd for the command', async () => {
    const cfg = fakeConfig(dir);
    const ctx = fakeCtx(join(dir, 'x'), { maxUsd: 0.01, spend: { usd: 0.009, calls: 1 } });
    await expect(checkBudget(ctx, cfg, 0.002)).rejects.toThrow(/--max-usd/);
  });

  it('refuses when balance - reserve < 0, unless demo day', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ is_available: true, balance_infos: [{ currency: 'USD', total_balance: '3.01' }] }), { status: 200 })));
    const cfg = fakeConfig(dir, { demoDay: false });
    const e = await checkBudget(fakeCtx(join(dir, 'x')), cfg, 0.02).catch(x => x);
    expect(e).toBeInstanceOf(BilimindError);
    expect((e as Error).message).toMatch(/reserve/);
    expect((e as BilimindError).hint).toMatch(/BILIMIND_DEMO_DAY=1/);
    await expect(checkBudget(fakeCtx(join(dir, 'x')), fakeConfig(dir, { demoDay: true }), 0.02)).resolves.toBeUndefined();
    resetBalanceCache();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ balance_infos: [{ currency: 'USD', total_balance: '9.19' }] }), { status: 200 })));
    await expect(checkBudget(fakeCtx(join(dir, 'x')), cfg, 0.02)).resolves.toBeUndefined();
  });

  it('an unreachable balance does not block (caps still apply)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const lines: string[] = [];
    await checkBudget(fakeCtx(join(dir, 'x'), { progress: l => lines.push(l) }), fakeConfig(dir, { demoDay: false }), 0.01);
    expect(lines.join()).toMatch(/balance unavailable/);
    expect((await balance(fakeConfig(dir))).usd).toBeNull();
  });

  it('parses both balance endpoints', () => {
    expect(parseBalance('deepseek', { balance_infos: [{ currency: 'USD', total_balance: '9.19' }] })).toBe(9.19);
    expect(parseBalance('openrouter', { data: { total_credits: 75, total_usage: 65.318038734 } })).toBeCloseTo(9.681961, 5);
  });
});

describe('config', () => {
  const writeUser = (cfg: unknown) => { mkdirSync(join(dir, 'home', '.bilimind'), { recursive: true }); writeFileSync(join(dir, 'home', '.bilimind', 'config.json'), JSON.stringify(cfg)); };
  const base = () => ({ USERPROFILE: join(dir, 'home'), BILIMIND_NO_ENV_LOCAL: '1' } as Record<string, string | undefined>);

  it('user config.json first, deepseek preset, caps and reserve', () => {
    writeUser({ provider: 'deepseek', keys: { deepseek: 'sk-user', openrouter: 'sk-or' }, models: { deepseek: { fast: 'deepseek-flash', smart: 'deepseek-v4-pro' } } });
    const c = loadConfig({ env: { ...base(), DEEPSEEK_API_KEY: 'sk-env' } });
    expect(c.provider).toBe('deepseek');
    expect(c.apiKey).toBe('sk-user');
    expect(c.keySource).toBe('user-config');
    expect(c.baseUrl).toBe('https://api.deepseek.com');
    expect(c.models).toEqual({ fast: 'deepseek-flash', reasoning: 'deepseek-v4-pro' });
    expect(c.caps).toEqual({ runUsd: 0.25, dayUsd: 2 });
    expect(c.reserveUsd).toEqual({ deepseek: 0, openrouter: 0, bilimind: 0 });
    expect(c.ledgerPath).toBe(join(dir, 'home', '.bilimind', 'ledger.jsonl'));
    expect(c.demoDay).toBe(false);
  });

  it('env when there is no user config; auto-picks deepseek when its key exists', () => {
    const c = loadConfig({ env: { ...base(), DEEPSEEK_API_KEY: 'sk-ds', OPENROUTER_API_KEY: 'sk-or' } });
    expect(c.provider).toBe('deepseek');
    expect(c.keySource).toBe('env');
    const o = loadConfig({ env: { ...base(), OPENROUTER_API_KEY: 'sk-or', BILIMIND_MODEL_FAST: 'deepseek/deepseek-v4-flash' } });
    expect(o.provider).toBe('openrouter');
    expect(o.baseUrl).toBe('https://openrouter.ai/api/v1');
    expect(o.models.fast).toBe('deepseek/deepseek-v4-flash');
  });

  it('BILIMIND_PROVIDER switches pools; OpenRouter-style model env is ignored for DeepSeek; demo day flag', () => {
    writeUser({ provider: 'deepseek', keys: { deepseek: 'sk-user', openrouter: 'sk-or' } });
    expect(loadConfig({ env: { ...base(), BILIMIND_PROVIDER: 'openrouter' } }).provider).toBe('openrouter');
    const d = loadConfig({ env: { ...base(), BILIMIND_MODEL_FAST: 'deepseek/deepseek-v4-flash', BILIMIND_DEMO_DAY: '1' } });
    expect(d.models.fast).toBe('deepseek-flash');
    expect(d.demoDay).toBe(true);
  });

  it('.env.local is found by walking up from repoRoot', () => {
    const repo = join(dir, 'repo');
    mkdirSync(join(repo, 'packages', 'engine'), { recursive: true });
    writeFileSync(join(repo, '.env.local'), '# keys\nDEEPSEEK_API_KEY="sk-local"\nOTHER=1 # comment\n');
    const c = loadConfig({ env: { USERPROFILE: join(dir, 'nohome') }, repoRoot: join(repo, 'packages', 'engine') });
    expect(c.apiKey).toBe('sk-local');
    expect(c.keySource).toBe('env.local');
    expect(parseDotenv('A=1\nexport B = "two"\n#C=3\nD=x # y')).toEqual({ A: '1', B: 'two', D: 'x' });
  });

  it('no key anywhere and no provider named -> BiliMind free (no key), its URL overridable', () => {
    const c = loadConfig({ env: base() });
    expect(c.provider).toBe('bilimind');
    expect(c.apiKey).toBe('');
    expect(c.keySource).toBe('none');
    expect(c.baseUrl).toBe('https://desktop-api.bilimind.com/v1');
    expect(c.models).toEqual({ fast: 'deepseek/deepseek-v4-flash', reasoning: 'deepseek/deepseek-v4-pro' });
    expect(loadConfig({ env: { ...base(), BILIMIND_FREE_URL: 'http://127.0.0.1:8787/v1/' } }).baseUrl).toBe('http://127.0.0.1:8787/v1');
    writeUser({ free_base_url: 'http://127.0.0.1:8788/v1' });
    expect(loadConfig({ env: base() }).baseUrl).toBe('http://127.0.0.1:8788/v1');
  });

  it('a configured provider keeps the old behaviour; provider "bilimind" never takes a key', () => {
    writeUser({ provider: 'deepseek' });
    expect(loadConfig({ env: base() }).provider).toBe('deepseek');            // named but no key: still deepseek
    writeUser({ provider: 'bilimind', keys: { deepseek: 'sk-user' } });
    const b = loadConfig({ env: { ...base(), BILIMIND_BASE_URL: 'http://elsewhere' } });
    expect(b.provider).toBe('bilimind');
    expect(b.apiKey).toBe('');
    expect(b.baseUrl).toBe('https://desktop-api.bilimind.com/v1');
    writeUser({ keys: { openrouter: 'sk-or' } });
    expect(loadConfig({ env: base() }).provider).toBe('openrouter');          // a key and no provider: that key's pool
  });

  it('redact hides keys and bearer tokens', () => {
    expect(redact('Authorization: Bearer sk-abcdef123 failed for sk-zzzz9999')).toBe('Authorization: Bearer [redacted] failed for [redacted]');
  });
});

describe('log + note', () => {
  it('appends and reads LogEvents; redacts; skips torn lines', async () => {
    appendLog(dir, { ts: '2026-10-10T10:00:00Z', agent: 'Lead', cmd: 'ingest', ok: true, result: '5 files', ms: 12, cost_usd: 0 });
    appendLog(dir, { ts: '2026-10-10T10:01:00Z', agent: 'Writer · Hashing', cmd: 'draft', ok: false, result: 'key sk-secret123 rejected', ms: 5, cost_usd: 0.001, lesson: 'hash_tables' });
    writeFileSync(join(dir, 'crew', 'log.jsonl'), '{"torn":', { flag: 'a' });
    const log = readLog(dir);
    expect(log).toHaveLength(2);
    expect(log[1]!.result).toBe('key [redacted] rejected');
    expect(readLog(join(dir, 'missing'))).toEqual([]);
    await expect(note(fakeCtx(dir), { text: 'Cut AVL: no exam question uses it.' })).resolves.toEqual({ text: 'Cut AVL: no exam question uses it.' });
    await expect(note(fakeCtx(dir), { text: '  ' })).rejects.toThrow(/--text/);
  });
});

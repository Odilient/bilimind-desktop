// WP1: LLM client with mocked fetch (PLAN §5.2 acceptance): request shape per provider, 4xx stops, 429 retries,
// one corrective turn, truncation restart, ledger + ctx.spend, cache hit costs $0.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { callJson, setEngineConfig, describeSchema, validateSchema, decodeJsonObject, costOf, isDeepseekPeak } from '../src/llm.ts';
import { cacheKey } from '../src/cache.ts';
import { resetBalanceCache } from '../src/ledger.ts';
import { BilimindError } from '../src/contracts.ts';
import { fakeConfig, fakeCtx, tempDir } from './wp1-helpers.ts';

type Call = { url: string; init: RequestInit; body: Record<string, unknown> };

function reply(content: string, opts: { finish?: string; usage?: Record<string, unknown>; status?: number; date?: string } = {}): Response {
  const status = opts.status ?? 200;
  const body = status === 200
    ? { model: 'deepseek-flash', choices: [{ message: { content }, finish_reason: opts.finish ?? 'stop' }], usage: opts.usage ?? { prompt_tokens: 1000, completion_tokens: 500, prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 1000 } }
    : { error: { message: content } };
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', date: opts.date ?? 'Sat, 10 Oct 2026 09:00:00 GMT' } });
}

function mockFetch(replies: (Response | Error)[]): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init, body: init.body ? JSON.parse(String(init.body)) : {} });
    const r = replies.shift();
    if (!r) throw new Error('no more mocked replies');
    if (r instanceof Error) throw r;
    return r;
  }));
  return calls;
}

const schema = { type: 'object', required: ['title', 'items'], properties: {
  title: { type: 'string', maxLength: 20, description: 'short title' },
  items: { type: 'array', minItems: 2, items: { type: 'string' } },
} };

let dir: string;
beforeEach(() => { dir = tempDir(); resetBalanceCache(); });
afterEach(() => { vi.unstubAllGlobals(); setEngineConfig(null); });

describe('callJson request shape', () => {
  it('DeepSeek direct: json_object, thinking disabled + temperature for drafts; schema rendered into the system prompt', async () => {
    setEngineConfig(fakeConfig(dir));
    const calls = mockFetch([reply('{"title":"Hashing","items":["a","b"]}')]);
    const ctx = fakeCtx(dir);
    const r = await callJson<{ title: string }>(ctx, { stage: 'expand', system: 'You write lessons.', user: 'Go', schema });
    expect(r.data.title).toBe('Hashing');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.deepseek.com/chat/completions');
    const b = calls[0]!.body;
    expect(b.model).toBe('deepseek-flash');
    expect(b.response_format).toEqual({ type: 'json_object' });
    expect(b.thinking).toEqual({ type: 'disabled' });
    expect(b.temperature).toBe(0.6);
    expect(b.max_tokens).toBe(32768);
    expect(b.provider).toBeUndefined();
    const sys = (b.messages as { role: string; content: string }[])[0]!.content;
    expect(sys).toContain('OUTPUT CONTRACT');
    expect(sys).toContain('"title": string /* max length 20 chars — HARD LIMIT, count them */,   // REQUIRED — short title');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test-0000');
    // Saturday = off-peak: (1000 * 0.30 + 500 * 1.20) / 1e6 / 2
    expect(r.cost_usd).toBeCloseTo(0.00045, 8);
    expect(ctx.spend.usd).toBeCloseTo(0.00045, 8);
    expect(ctx.spend.calls).toBe(1);
    const ledger = readFileSync(fakeConfig(dir).ledgerPath, 'utf8').trim().split('\n').map(l => JSON.parse(l));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ course: dir, cmd: 'expand', provider: 'deepseek', model: 'deepseek-flash', prompt_tokens: 1000, completion_tokens: 500, cached: false });
  });

  it('DeepSeek direct: thinking enabled for outline, no temperature', async () => {
    setEngineConfig(fakeConfig(dir));
    const calls = mockFetch([reply('{"title":"x","items":["a","b"]}')]);
    await callJson(fakeCtx(dir), { stage: 'outline', system: 's', user: 'u', schema, reasoning: true });
    expect(calls[0]!.body.thinking).toEqual({ type: 'enabled' });
    expect(calls[0]!.body.temperature).toBeUndefined();
  });

  it('OpenRouter: provider pin, require_parameters, usage.include, reasoning flag, its own usage.cost', async () => {
    setEngineConfig(fakeConfig(dir, { provider: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', models: { fast: 'deepseek/deepseek-v4-flash', reasoning: 'deepseek/deepseek-v4-pro' } }));
    const calls = mockFetch([reply('{"title":"x","items":["a","b"]}', { usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.0000123 } })]);
    const r = await callJson(fakeCtx(dir), { stage: 'outline', system: 's', user: 'u', schema, reasoning: true });
    expect(calls[0]!.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    const b = calls[0]!.body;
    expect(b.model).toBe('deepseek/deepseek-v4-flash');
    expect(b.provider).toEqual({ require_parameters: true, max_price: { prompt: 0.2, completion: 0.4 }, allow_fallbacks: true });
    expect(b.usage).toEqual({ include: true });
    expect(b.reasoning).toEqual({ enabled: true });
    expect((calls[0]!.init.headers as Record<string, string>)['X-Title']).toBe('BiliMind for WorkBuddy');
    expect(r.cost_usd).toBe(0.000012);
  });

  it('refuses the expensive model unless BILIMIND_ALLOW_EXPENSIVE=1', async () => {
    setEngineConfig(fakeConfig(dir));
    mockFetch([]);
    await expect(callJson(fakeCtx(dir, { model: 'deepseek-v4-pro' }), { stage: 'expand', system: 's', user: 'u' })).rejects.toThrow(/expensive/);
  });

  it('no key -> BilimindError with a hint, no request', async () => {
    setEngineConfig(fakeConfig(dir, { apiKey: '', keySource: 'none' }));
    const calls = mockFetch([]);
    const e = await callJson(fakeCtx(dir), { stage: 'expand', system: 's', user: 'u' }).catch(x => x);
    expect(e).toBeInstanceOf(BilimindError);
    expect((e as BilimindError).hint).toMatch(/config\.json/);
    expect(calls).toHaveLength(0);
  });
});

describe('callJson retries and repairs', () => {
  it('a 4xx (not 429) stops at once', async () => {
    setEngineConfig(fakeConfig(dir));
    const calls = mockFetch([reply('bad key', { status: 401 }), reply('{"title":"x","items":["a","b"]}')]);
    const e = await callJson(fakeCtx(dir), { stage: 'expand', system: 's', user: 'u', schema }).catch(x => x);
    expect(calls).toHaveLength(1);
    expect(e).toBeInstanceOf(BilimindError);
    expect((e as Error).message).toMatch(/rejected \(401\)/);
    expect((e as Error).message).not.toContain('sk-test');
  });

  it('a 400 naming response_format drops it once and retries (thinking + json mode safety net)', async () => {
    setEngineConfig(fakeConfig(dir));
    const calls = mockFetch([reply('response_format json_object is not supported in thinking mode', { status: 400 }), reply('{"title":"x","items":["a","b"]}')]);
    const r = await callJson(fakeCtx(dir), { stage: 'outline', system: 's', user: 'u', schema, reasoning: true });
    expect(calls).toHaveLength(2);
    expect(calls[0]!.body.response_format).toEqual({ type: 'json_object' });
    expect(calls[1]!.body.response_format).toBeUndefined();
    expect(calls[1]!.body.thinking).toEqual({ type: 'enabled' });
    expect(r.attempts).toBe(1);
  });

  it('429 and 5xx retry, then succeed', async () => {
    setEngineConfig(fakeConfig(dir));
    const calls = mockFetch([reply('slow down', { status: 429 }), reply('oops', { status: 503 }), reply('{"title":"x","items":["a","b"]}')]);
    const r = await callJson(fakeCtx(dir), { stage: 'expand', system: 's', user: 'u', schema });
    expect(calls).toHaveLength(3);
    expect(r.attempts).toBe(3);
  });

  it('a transport error retries', async () => {
    setEngineConfig(fakeConfig(dir));
    const calls = mockFetch([new Error('ECONNRESET'), reply('{"title":"x","items":["a","b"]}')]);
    await callJson(fakeCtx(dir), { stage: 'expand', system: 's', user: 'u', schema });
    expect(calls).toHaveLength(2);
  });

  it('invalid JSON gets ONE corrective turn carrying the assistant reply, then succeeds', async () => {
    setEngineConfig(fakeConfig(dir));
    const calls = mockFetch([reply('Sure! here is the lesson'), reply('```json\n{"title":"x","items":["a","b"],}\n```')]);
    const ctx = fakeCtx(dir);
    const r = await callJson(ctx, { stage: 'expand', system: 's', user: 'u', schema });
    expect(r.data).toEqual({ title: 'x', items: ['a', 'b'] });
    const msgs = calls[1]!.body.messages as { role: string; content: string }[];
    expect(msgs).toHaveLength(4);
    expect(msgs[2]).toEqual({ role: 'assistant', content: 'Sure! here is the lesson' });
    expect(msgs[3]!.content).toContain('did not satisfy the output contract');
    expect(ctx.spend.calls).toBe(2);
  });

  it('schema errors are fed back verbatim; a second failure throws (one corrective turn only)', async () => {
    setEngineConfig(fakeConfig(dir));
    const calls = mockFetch([reply('{"title":"a title that is far too long","items":["a"]}'), reply('{"items":["a"]}'), reply('{"title":"x","items":["a","b"]}')]);
    const e = await callJson(fakeCtx(dir), { stage: 'expand', system: 's', user: 'u', schema }).catch(x => x);
    expect(calls).toHaveLength(2);
    const corrective = (calls[1]!.body.messages as { content: string }[])[3]!.content;
    expect(corrective).toContain('- $.title: must be at most 20 characters long (got 28)');
    expect(corrective).toContain('- $.items: needs at least 2 items (got 1)');
    expect(e).toBeInstanceOf(BilimindError);
    expect((e as Error).message).toMatch(/missing required key "title"/);
  });

  it('req.validate failures also get the corrective turn', async () => {
    setEngineConfig(fakeConfig(dir));
    const calls = mockFetch([reply('{"title":"x","items":["a","b"]}'), reply('{"title":"y","items":["a","b"]}')]);
    const r = await callJson<{ title: string }>(fakeCtx(dir), { stage: 'expand', system: 's', user: 'u', schema,
      validate: v => ((v as { title: string }).title === 'x' ? ['$.title: must not be "x"'] : []) });
    expect(r.data.title).toBe('y');
    expect(calls).toHaveLength(2);
  });

  it('a truncated reply restarts from the original two messages with the budget override', async () => {
    setEngineConfig(fakeConfig(dir));
    const calls = mockFetch([reply('{"title":"x","items":["a"', { finish: 'length' }), reply('{"title":"x","items":["a","b"]}')]);
    await callJson(fakeCtx(dir), { stage: 'expand', system: 's', user: 'u', schema });
    const msgs = calls[1]!.body.messages as { role: string; content: string }[];
    expect(msgs).toHaveLength(2);
    expect(msgs[1]!.content).toContain('BUDGET OVERRIDE');
  });
});

describe('cache', () => {
  it('a cache hit costs $0 and makes no request; --no-cache bypasses it', async () => {
    setEngineConfig(fakeConfig(dir));
    const calls = mockFetch([reply('{"title":"x","items":["a","b"]}'), reply('{"title":"z","items":["a","b"]}')]);
    const ctx = fakeCtx(dir, { noCache: false });
    const first = await callJson(ctx, { stage: 'expand', system: 's', user: 'u', schema });
    expect(first.cached).toBe(false);
    const ctx2 = fakeCtx(dir, { noCache: false });
    const second = await callJson(ctx2, { stage: 'expand', system: 's', user: 'u', schema });
    expect(second.cached).toBe(true);
    expect(second.cost_usd).toBe(0);
    expect(ctx2.spend.usd).toBe(0);
    expect(calls).toHaveLength(1);
    const third = await callJson(fakeCtx(dir, { noCache: true }), { stage: 'expand', system: 's', user: 'u', schema });
    expect(third.data).toEqual({ title: 'z', items: ['a', 'b'] });
    expect(calls).toHaveLength(2);
    expect(existsSync(dir + '/crew/cache')).toBe(true);
  });

  it('cacheKey is a sha256 hex that depends on model and messages', () => {
    const a = cacheKey('m1', [{ role: 'user', content: 'x' }]);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(cacheKey('m2', [{ role: 'user', content: 'x' }])).not.toBe(a);
    expect(cacheKey('m1', [{ role: 'user', content: 'y' }])).not.toBe(a);
  });
});

describe('schema subset + JSON repair (SchemaValidator port)', () => {
  it('error strings match the SaaS shapes', () => {
    const s = { type: 'object', required: ['nodes', 'kind', 'x'], properties: {
      nodes: { type: 'array', items: { type: 'object', properties: { title: { type: 'string', maxLength: 5 } } } },
      kind: { type: 'string', enum: ['a', 'b'] }, x: { type: 'integer', minimum: 1 },
    } };
    expect(validateSchema({ kind: 'a', x: 1 }, s)).toEqual(['$: missing required key "nodes"']);
    expect(validateSchema({ nodes: [{ title: 'abcdefg' }], kind: 'foo', x: null }, s)).toEqual([
      '$.x: is required but was null',
      '$.nodes[0].title: must be at most 5 characters long (got 7)',
      '$.kind: value "foo" is not one of the allowed values ["a", "b"]',
    ]);
    expect(validateSchema({ nodes: [], kind: 'a', x: 3.0 }, s)).toEqual([]);   // an integer accepts 3.0
    expect(validateSchema({ nodes: [], kind: 'a', x: 0 }, s)).toEqual(['$.x: must be >= 1 (got 0)']);
    expect(validateSchema('str', { type: 'object' })).toEqual(['$: expected object, got string']);
  });

  it('describeSchema renders commented pseudo-JSON', () => {
    const d = describeSchema({ type: 'object', required: ['a'], properties: { a: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string', enum: ['x', 'y'] } }, b: { type: ['number', 'null'], minimum: 0 } } });
    expect(d).toBe('{\n  "a": [string one of ["x"|"y"]] /* min 1, max 3 items */,   // REQUIRED\n  "b": number|null /* >= 0 */\n}');
  });

  it('decodeJsonObject: raw, fenced, embedded, trailing commas; arrays and junk give null', () => {
    expect(decodeJsonObject('{"a":1}')).toEqual({ a: 1 });
    expect(decodeJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(decodeJsonObject('Here you go: {"a":[1,2,],} thanks')).toEqual({ a: [1, 2] });
    expect(decodeJsonObject('[1,2]')).toBeNull();
    expect(decodeJsonObject('no json')).toBeNull();
    // G2: raw control characters and bad backslashes inside strings are repaired (live expand failure)
    expect(decodeJsonObject('{"code":"function f() {\n\treturn 1;\n}","tex":"\\alpha \\d+","ok":"a\\nb \\u00e9"}'))
      .toEqual({ code: 'function f() {\n\treturn 1;\n}', tex: '\\alpha \\d+', ok: 'a\nb é' });
  });

  it('DeepSeek price: peak vs off-peak from the server clock; cache hits are cheap', () => {
    expect(isDeepseekPeak(new Date('2026-10-12T02:00:00Z'))).toBe(true);    // Monday 02:00 UTC
    expect(isDeepseekPeak(new Date('2026-10-12T05:00:00Z'))).toBe(false);
    expect(isDeepseekPeak(new Date('2026-10-11T08:00:00Z'))).toBe(false);   // Sunday
    const u = { prompt_tokens: 2000, completion_tokens: 1000, prompt_cache_hit_tokens: 1000, prompt_cache_miss_tokens: 1000 };
    expect(costOf('deepseek', 'deepseek-flash', u, new Date('2026-10-12T02:00:00Z'))).toBeCloseTo((1000 * 0.006 + 1000 * 0.3 + 1000 * 1.2) / 1e6, 10);
    expect(costOf('deepseek', 'deepseek-flash', u, null)).toBeCloseTo((1000 * 0.006 + 1000 * 0.3 + 1000 * 1.2) / 1e6, 10);   // unknown time = peak
  });
});

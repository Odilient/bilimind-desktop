import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Ctx, EngineConfig } from '../src/contracts.ts';
import { callJson, setEngineConfig, streamChat } from '../src/llm.ts';

const dir = mkdtempSync(join(tmpdir(), 'bm-stream-'));
const cfg: EngineConfig = {
  provider: 'deepseek', baseUrl: 'https://llm.test', apiKey: 'sk-test-0000', keySource: 'none',
  models: { fast: 'deepseek-flash', reasoning: 'deepseek-v4-pro' }, userDir: dir, ledgerPath: join(dir, 'ledger.jsonl'),
  caps: { runUsd: 1, dayUsd: 1 }, reserveUsd: { deepseek: 0, openrouter: 0, bilimind: 0 }, demoDay: false,
};
const sse = (...pieces: string[]): Response => new Response(
  pieces.map(p => `data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`).join('')
    + `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 10, completion_tokens: 5 } })}\n\ndata: [DONE]\n\n`,
  { headers: { 'content-type': 'text/event-stream' } },
);
const call = (over: Partial<Parameters<typeof streamChat>[1]> = {}) => {
  const seen: string[] = [];
  return { seen, run: streamChat(cfg, { stage: 'test', messages: [{ role: 'user', content: 'hi' }], onDelta: p => seen.push(p), ...over }) };
};
const fetchOnce = (...replies: (Response | Error)[]) => {
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    const next = replies.shift()!;
    if (next instanceof Error) throw next;
    return next;
  }));
  return bodies;
};

afterEach(() => vi.unstubAllGlobals());

describe('streamChat', () => {
  it('hands pieces over as they come, and returns the whole with its usage', async () => {
    const bodies = fetchOnce(sse('Hel', 'lo'));
    const { seen, run } = call();
    const out = await run;
    expect(seen).toEqual(['Hel', 'lo']);
    expect(out.text).toBe('Hello');
    expect(out.usage.completion_tokens).toBe(5);
    expect(bodies[0]).toMatchObject({ model: 'deepseek-flash', stream: true });
    expect(bodies[0]!.thinking).toBeUndefined();
  });

  it('turns thinking off when asked to be fast', async () => {
    const bodies = fetchOnce(sse('x'));
    await call({ fast: true }).run;
    expect(bodies[0]!.thinking).toEqual({ type: 'disabled' });
  });

  it('retries a 500 before anything was shown, and says a rejected key plainly without retrying', async () => {
    const first = fetchOnce(new Response('', { status: 500 }), sse('ok'));
    expect((await call().run).text).toBe('ok');
    expect(first).toHaveLength(2);

    const second = fetchOnce(new Response('', { status: 401 }));
    await expect(call().run).rejects.toThrow('did not accept your key');
    expect(second).toHaveLength(1);
  });

  it('drops an optional parameter the provider refuses, once', async () => {
    const bodies = fetchOnce(new Response('unknown field thinking', { status: 400 }), sse('ok'));
    expect((await call({ fast: true }).run).text).toBe('ok');
    expect(bodies[1]!.thinking).toBeUndefined();
  });

  it('never retries once words are on screen', async () => {
    let sent = false;
    const broken = new ReadableStream({
      pull(c) {
        if (sent) { c.error(new Error('socket hang up')); return; }
        sent = true;
        c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: 'part' } }] })}\n\n`));
      },
    });
    const bodies = fetchOnce(new Response(broken));
    await expect(call().run).rejects.toThrow('cut off');
    expect(bodies).toHaveLength(1);
  });

  it('stops at once when aborted, with no retry', async () => {
    const ctl = new AbortController();
    ctl.abort();
    const bodies = fetchOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    await expect(call({ signal: ctl.signal }).run).rejects.toThrow('aborted');
    expect(bodies).toHaveLength(1);
  });
});

describe('callJson streaming', () => {
  afterEach(() => setEngineConfig(null));
  const ctx = (): Ctx => ({ course: join(dir, 'c'), agent: 't', noCache: true, spend: { usd: 0, calls: 0 }, now: () => new Date(), progress: () => undefined });
  const chunks = (...rows: unknown[]) => new Response(`${rows.map(r => `data: ${JSON.stringify(r)}\n\n`).join('')}data: [DONE]\n\n`, { headers: { 'content-type': 'text/event-stream' } });
  const answer = (...pieces: string[]) => chunks(
    { choices: [{ delta: { reasoning_content: 'hm' } }] },
    ...pieces.map(p => ({ choices: [{ delta: { content: p } }] })),
    { choices: [{ delta: {}, finish_reason: 'stop' }] },
    { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5 }, model: 'served' },
  );

  it('shows the work as it comes, and returns the same result as a whole reply', async () => {
    setEngineConfig(cfg);
    const bodies = fetchOnce(answer('{"a"', ':1}'));
    const seen: string[] = [];
    const thoughts: string[] = [];
    const out = await callJson<{ a: number }>(ctx(), { stage: 'expand', system: 'Reply in JSON', user: 'x', schema: { type: 'object', required: ['a'], properties: { a: { type: 'number' } } }, onContent: s => seen.push(s), onThinking: p => thoughts.push(p) });
    expect(out.data).toEqual({ a: 1 });
    expect(out.model).toBe('served');
    expect(out.usage.completion_tokens).toBe(5);
    expect(seen).toEqual(['{"a"', '{"a":1}']);
    expect(thoughts).toEqual(['hm']);
    expect(bodies[0]).toMatchObject({ stream: true, stream_options: { include_usage: true } });
  });

  it('stays a whole-reply call without a watcher', async () => {
    setEngineConfig(cfg);
    const bodies = fetchOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"a":1}' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } })));
    await callJson(ctx(), { stage: 'expand', system: 'Reply in JSON', user: 'x' });
    expect(bodies[0]!.stream).toBe(false);
  });

  it('drops a stream option the provider refuses, then retries', async () => {
    setEngineConfig(cfg);
    const bodies = fetchOnce(new Response('stream_options is not supported', { status: 400 }), answer('{"a":1}'));
    await callJson(ctx(), { stage: 'expand', system: 'Reply in JSON', user: 'x', onContent: () => undefined });
    expect(bodies[0]!.stream_options).toBeTruthy();
    expect(bodies[1]!.stream_options).toBeUndefined();
  });
});

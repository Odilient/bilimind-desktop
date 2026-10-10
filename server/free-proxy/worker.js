// BiliMind free: an OpenAI-compatible proxy in front of OpenRouter, so BiliMind Desktop works with no key.
// The OpenRouter key lives only here, as the Worker secret OPENROUTER_API_KEY. The app never sees it.
// Guards: two models only, a price pin on every request, a max_tokens cap, a body size cap, a per-IP rate limit,
// a client header, and a kill switch (var DISABLED = "1"). No CORS headers, so web pages cannot call it.

const UPSTREAM = 'https://openrouter.ai/api/v1/chat/completions';
const MODELS = ['deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4-pro'];
const PASS = ['model', 'messages', 'temperature', 'top_p', 'max_tokens', 'stream', 'stream_options', 'response_format', 'reasoning', 'stop', 'seed'];
const MAX_TOKENS = 32768;
const MAX_BODY = 600_000;   // bytes; the engine caps its own prompts well under this
const PRICE_PIN = { require_parameters: true, max_price: { prompt: 0.2, completion: 0.4 }, allow_fallbacks: true };

const fail = (status, message) => Response.json({ error: { message } }, { status, headers: { 'Cache-Control': 'no-store' } });

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    if (pathname === '/v1/health' && req.method === 'GET') return Response.json({ ok: env.DISABLED !== '1', models: MODELS });
    if (pathname !== '/v1/chat/completions') return fail(404, 'Not found.');
    if (req.method !== 'POST') return fail(405, 'Use POST.');
    if (env.DISABLED === '1') return fail(503, 'The free BiliMind service is paused. Add your own key in Settings.');
    if (!/^(desktop|engine|cli)\/[\w.+-]{1,32}$/.test(req.headers.get('x-bilimind-client') || '')) return fail(403, 'Unknown client.');
    if (!env.OPENROUTER_API_KEY) return fail(503, 'The free BiliMind service is not set up yet.');

    const ip = req.headers.get('cf-connecting-ip') || 'unknown';
    if (env.PER_IP) {
      const { success } = await env.PER_IP.limit({ key: ip });
      if (!success) return fail(429, 'Too many requests. Wait a minute.');
    }

    const raw = await req.text();
    if (raw.length > MAX_BODY) return fail(413, 'The request is too large.');
    let body;
    try { body = JSON.parse(raw); } catch { return fail(400, 'The request is not JSON.'); }
    if (!body || !MODELS.includes(body.model)) return fail(400, `Model not offered. Use one of: ${MODELS.join(', ')}.`);
    if (!Array.isArray(body.messages) || !body.messages.length) return fail(400, 'No messages.');

    const out = {};
    for (const k of PASS) if (k in body) out[k] = body[k];
    out.max_tokens = Math.min(Math.max(1, Number(out.max_tokens) || 4096), MAX_TOKENS);
    out.provider = PRICE_PIN;
    out.usage = { include: true };

    let up;
    try {
      up = await fetch(UPSTREAM, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://bilimind.com',
          'X-Title': 'BiliMind Desktop (free)',
        },
        body: JSON.stringify(out),
      });
    } catch {
      return fail(502, 'The free BiliMind service could not reach the model. Try again in a minute.');
    }
    // our own key or balance failing is never the learner's fault: say so plainly, and never echo upstream details
    if (up.status === 401 || up.status === 402 || up.status === 403) return fail(503, 'The free BiliMind service is unavailable right now. Add your own DeepSeek or OpenRouter key in Settings.');
    if (up.status === 429) return fail(429, 'Too many requests. Wait a minute.');
    return new Response(up.body, {
      status: up.status,
      headers: { 'Content-Type': up.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' },
    });
  },
};

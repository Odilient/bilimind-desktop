# BiliMind free

The key-less provider BiliMind Desktop uses by default. It is a Cloudflare Worker at
`https://desktop-api.bilimind.com/v1` that forwards chat requests to OpenRouter with the BiliMind team's key.

The key is a Worker secret. It is not in this repo, not in the app, and never sent to the app.

What it accepts:

- `POST /v1/chat/completions`: OpenAI-style body, models `deepseek/deepseek-v4-flash` and `deepseek/deepseek-v4-pro`
  only, with an `X-BiliMind-Client: desktop/<version>` header. JSON or streamed replies.
- `GET /v1/health`: `{ ok, models }`.

Guards: two models, a price pin on every request, `max_tokens` capped at 32768, a 600 KB body cap, 120 requests a
minute per IP, no CORS (web pages cannot call it), and a kill switch (`DISABLED = "1"` in `wrangler.toml`).

Deploy:

```sh
npx wrangler login
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler deploy
```

Set a credit limit on the OpenRouter key in the OpenRouter dashboard so the free service can never spend more
than you allow.

## Paused, and how to bring it back

The service has been paused since October 2026: the Worker still answers `/v1/health`, but its OpenRouter key no
longer works, so completions return 503. While it is paused, the app, the CLI and the website say "bring your own
key" and never offer BiliMind free. To bring it back:

1. Put a working key in the Worker (`npx wrangler secret put OPENROUTER_API_KEY`) with a hard credit limit on
   it, and check that a real completion succeeds, not just `/v1/health`.
2. Set `FREE_TIER_ON = true` in [packages/engine/src/config.ts](../../packages/engine/src/config.ts). The desktop
   app offers BiliMind free again and a fresh install uses it; rebuild the bundled CLI (see CONTRIBUTING.md).
3. Set `data-free-tier="on"` on the `<html>` element of [site/index.html](../../site/index.html). The landing's
   "no key needed" copy and FAQ answers come back.
4. Update the README ("Bring your own key") and the changelog, then release.

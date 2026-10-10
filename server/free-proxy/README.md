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

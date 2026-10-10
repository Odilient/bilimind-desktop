# BiliMind Desktop: main ↔ renderer contract

The desktop app is the Dormathon 2026 product (Track 2: "How can AI help students and small businesses solve real
business problems and operate more effectively?"). A student or a shop owner drops in a folder of their own files
(lecture slides + past paper, or a shop SOP), types one sentence, and gets a course: lessons, narration, runnable
code exercises, quizzes checked against their files, a study plan, Anki deck and calendar file. It runs the existing
engine (`@bilimind/engine` `runPipeline`) locally, on BiliMind free by default or the user's own AI key. Open source (AGPL-3.0).

Organiser rules for the UI: **no login screen, no dashboard**, demo-sized scope, one clear flow.

## Layout

```
apps/desktop/
  package.json            (given; add deps only if truly needed)
  electron-builder.yml    win portable + nsis, artifactName BiliMind-Desktop-${version}-${arch}-{portable|setup}.exe
  scripts/build.mjs       vite build (renderer) + esbuild (main, preload, worker) -> dist/
  scripts/dev.mjs         optional
  src/main/               Electron main (CJS bundle dist/main/main.cjs)
  src/preload/            contextBridge -> window.bilimind (dist/preload/preload.cjs)
  src/worker/             utilityProcess entry that imports runPipeline (dist/worker/run.cjs or .mjs)
  src/renderer/           Vue 3 + Vite app (dist/renderer/index.html), cobalt design
  resources/              icon.ico/png, templates/player.html (copied from packages/player/dist/player.html at build)
```

## window.bilimind (preload API, all async unless noted)

```ts
type ProviderId = 'bilimind' | 'deepseek' | 'openrouter';     // 'bilimind' = BiliMind free (no key), the default
interface Settings {
  provider: ProviderId;
  keys: Record<ProviderId, { set: boolean; last4?: string }>;   // the key itself never reaches the renderer; bilimind: always { set: true }
  narrate: boolean;                                            // Edge TTS narration (free)
  outRoot: string;                                             // default <Documents>/BiliMind
  version: string;
}
interface FolderFile { name: string; path: string; ext: string; bytes: number; role: 'lecture' | 'past_paper' | 'sop' | 'notes' | 'other' }
interface CourseCard {
  id: string;                 // absolute course folder path
  title: string; sentence: string; createdAt: string;   // ISO
  status: 'ready' | 'building' | 'failed';
  lessons: number; minutes?: number;                     // narration minutes if known
  checks?: { passed: number; total: number };
  rejected?: number; codeTests?: { passed: number; total: number };
  costUsd?: number; wallMs?: number;
}
type RunEvent =
  | { runId: string; type: 'started'; course: string }
  | { runId: string; type: 'step-start'; agent: string; cmd: string; lesson?: string }
  | { runId: string; type: 'step-end'; agent: string; cmd: string; lesson?: string; ok: boolean; ms: number; costUsd: number; result?: string; error?: string }
  | { runId: string; type: 'line'; text: string }                       // other progress lines, learner words
  | { runId: string; type: 'plan'; keep: { key: string; title: string; day?: number }[]; cut: { key: string; title: string; reason: string }[] }
  | { runId: string; type: 'done'; course: string; card: CourseCard }
  | { runId: string; type: 'error'; message: string };

window.bilimind = {
  settings: { get(): Promise<Settings>; save(p: { provider?: ProviderId; key?: { provider: ProviderId; value: string }; narrate?: boolean; outRoot?: string }): Promise<Settings>;
              testKey(provider: ProviderId): Promise<{ ok: boolean; balance?: string; note?: string; error?: string }> },
  pickFolder(): Promise<string | null>,
  inspectFolder(path: string): Promise<{ path: string; files: FolderFile[] }>,
  courses: { list(): Promise<CourseCard[]>; get(id: string): Promise<CourseCard | null>;
             playerUrl(id: string): Promise<string>;                 // file:// URL of <course>/index.html
             reveal(id: string): Promise<void>;                     // show the folder in Explorer
             openFile(id: string, rel: 'plan.md' | 'REPORT.md' | 'deck.csv' | 'reviews.ics' | string): Promise<void>;
             remove(id: string): Promise<void> },                   // moves the folder to the OS trash (shell.trashItem)
  run: { start(o: { src: string; sentence: string }): Promise<{ runId: string }>; cancel(runId: string): Promise<void>;
         onEvent(cb: (e: RunEvent) => void): () => void },            // returns unsubscribe (sync)
  openExternal(url: string): Promise<void>,
  platform: string,                                                // sync value
};
```

Providers:
- `bilimind` (**BiliMind free**, the default): the team's OpenAI-compatible proxy at `https://desktop-api.bilimind.com/v1`
  (override: env `BILIMIND_FREE_URL` or config.json `free_base_url`, for tests). Its OpenRouter key lives only on that
  server; the app has no key for it and sends **no `Authorization` header**. Every request carries
  `X-BiliMind-Client: desktop/<app version>` (the engine alone sends `engine/<version>`; env `BILIMIND_CLIENT`).
  `POST /chat/completions` takes the engine's OpenRouter body unchanged (models `deepseek/deepseek-v4-flash` fast,
  `deepseek/deepseek-v4-pro` smart) and returns OpenRouter's reply with `usage`, so cost is still shown and the
  per-run/day caps apply; no balance check, reserve 0. `GET /health` -> `{ ok: true, models }` (Settings "Check").
  Errors `{ error: { message } }`: 429 busy, 503 paused/unavailable, 400/403/413; the app words them plainly and
  suggests the user's own key, never "your key was rejected".
- `deepseek` / `openrouter`: the user's own key, sent only to that provider.
- Default: config.json `provider` when set (unchanged); else the pool of a key that exists; else `bilimind`
  (fresh install). Choosing `bilimind` never needs a key; a run never falls back to it silently.

Rules:
- Keys are saved in `%USERPROFILE%\.bilimind\config.json` (the same file the CLI and the WorkBuddy skill read:
  `{"provider","keys":{"deepseek","openrouter"},"models":{...}}`); merge, never drop other fields; never log or
  return a key. `testKey` calls the provider's balance endpoint (see `packages/engine/src/config.ts` PRESETS
  `balancePath`); for `bilimind` it calls `GET <free base>/health` and answers `{ ok: true, note: 'Free, no key needed' }`.
- `run.start` forks `src/worker` with `utilityProcess.fork`; the worker calls
  `runPipeline({ src, sentence, outRoot, template, progress })` and posts structured events (parse the
  `[run] Agent: cmd lesson` / `[run]   ok 3.2s result` / `[run]   FAILED msg` progress lines, or tail
  `<course>/crew/log.jsonl`). The `plan` event comes from the course's plan file after the `plan` step.
- Courses list = every `<outRoot>/*/course.json` (ready) plus folders with a running/failed run. When
  `BILIMIND_EXAMPLES=<dir>` is set, also list `<dir>/*` (used in dev and screenshots with `showcase/courses`).
- The course player is the course's own offline `index.html`. Show it inside the app with a `<webview>`
  (`webviewTag: true`) or a `WebContentsView` under the in-app top bar; audio must play and seek.
- Test mode: when `BILIMIND_E2E=1`, windows are created with `show: false` (never visible on the owner's screen)
  and `--remote-debugging-port` from `BILIMIND_CDP_PORT` is enabled so puppeteer-core can drive and screenshot.
- Windows paths via `node:path`; no native modules.

## Course workspace: `courses.outline` and the assistant

```ts
courses.outline(id): Promise<CourseOutline>   // id = course folder (same guard as every other courses.* call)
assistant.ask(o: AssistantAsk): Promise<{ askId }>; assistant.cancel(askId); assistant.onEvent(cb): () => void
```

- `outline` reads `<course>/course.json`: lessons in course order, `route` = the player's hash route `#/l/<encoded id>`
  (packages/player/src/router.ts), `day` = 1-based index of the `plan.days` entry that lists the lesson, `minutes` =
  the lesson's study minutes (narration length when missing); `sources` = every file under `<course>/sources`
  (`rel` like `sources/x.pdf`). A course still building (no course.json) returns its card title/sentence and no lessons.
- `ask` validates the course id and question (throws on bad input), returns `{ askId }` at once, then emits
  `delta`* and exactly one `done` or `error` (plain English). `cancel` emits `error 'Stopped.'` and nothing after it.
- The key stays in main: provider picked like a run (Settings provider when its key is set, else the other one),
  config via the engine's `loadConfig`, the provider's fast (non-reasoning) model, `/chat/completions` with
  `stream: true` + `include_usage`. HTTP is the engine's (global fetch, TLS verified); only on a certificate error is
  the request retried once through Electron `net.fetch` (Windows certificate store, still verified). `costUsd` =
  engine `costOf`; every answer is also written to the spend ledger (`cmd: "assistant"`).
- Grounding (no embeddings; engine `buildIndex` minisearch over `crew/ingest.json` chunks, title slides dropped):
  `lesson` = the open lesson's text (block payloads + quiz prompts, never answer keys) + top 6 passages for the
  question and question + lesson title (passages the lesson cites ranked up); `course` = lesson titles/summaries +
  top 8 passages; `files` = top 8 passages only. About 12k chars of context; history = last 8 turns.
  Excerpts are numbered `[1]..[n]`; past-paper passages are labelled as exam questions.
- The model answers briefly from the lesson/excerpts, cites like `[2]`, says so when the files do not cover the
  question and then answers after "Beyond your files:", in the question's language. `cites` = only the excerpts the
  answer cites: `{ n, file (source file name), locator (Slide 5 / Page 2 / section), quote (<= 200 chars) }`.
- Each finished answer is appended to `<course>/crew/assistant.jsonl` (question, answer, cites, model, cost; no key).

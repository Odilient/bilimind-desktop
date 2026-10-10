# BiliMind Desktop: main ↔ renderer contract

The desktop app is the Dormathon 2026 product (Track 2: "How can AI help students and small businesses solve real
business problems and operate more effectively?"). A student or a shop owner drops in a folder of their own files
(lecture slides + past paper, or a shop SOP), types one sentence, and gets a course: lessons, narration, runnable
code exercises, quizzes checked against their files, a study plan, Anki deck and calendar file. It runs the existing
engine (`@bilimind/engine` `runPipeline`) locally with the user's own AI key. Open source (AGPL-3.0).

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
type ProviderId = 'deepseek' | 'openrouter';
interface Settings {
  provider: ProviderId;
  keys: Record<ProviderId, { set: boolean; last4?: string }>;   // the key itself never reaches the renderer
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
              testKey(provider: ProviderId): Promise<{ ok: boolean; balance?: string; error?: string }> },
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

Rules:
- Keys are saved in `%USERPROFILE%\.bilimind\config.json` (the same file the CLI and the WorkBuddy skill read:
  `{"provider","keys":{"deepseek","openrouter"},"models":{...}}`); merge, never drop other fields; never log or
  return a key. `testKey` calls the provider's balance endpoint (see `packages/engine/src/config.ts` PRESETS
  `balancePath`; engine `doctor.ts` may already do it).
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

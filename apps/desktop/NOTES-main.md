# NOTES-main (Task A: main, preload, worker, build, packaging)

- [start] Read CONTRACT.md, engine run.ts (runPipeline, progress lines), config.ts/ledger.ts (balance), build.ts
  (template/assets lookup via BILIMIND_TEMPLATE / BILIMIND_ASSETS), showcase/courses/ds-final (course.json has receipts).
- Plan: step-start from `[run] Agent: cmd lesson` progress lines; step-end from tailing <course>/crew/log.jsonl
  (has agent/cmd/lesson/ok/ms/cost_usd/result; Writers run 4 in parallel so `ok` lines alone are ambiguous).
- CourseCard from course.json (title, goal.sentence, lessons, receipts.{narration_min,checks,tests,rejected,cost_usd,wall_ms}).
- [build] scripts/build.mjs works: template + 9 obj webps -> resources/, esbuild main 28 KB, preload 2 KB, worker 5.4 MB CJS
  (+ sql-wasm.wasm). CJS worker defines import.meta.url -> __bmImportMetaUrl (unpdf/pdfjs calls createRequire(import.meta.url)).
  `--no-renderer` skips vite (renderer agent still writing; vite fails until App.vue/styles exist).
- shared types in src/shared/contract.ts (IPC channel names, WorkerStart); cards.ts (CourseCard from course.json receipts);
  words.ts (learner words: chunk->passage, LLM->AI, ...; redact).
- [e2e] scripts/e2e-main.mjs: hidden Electron (BILIMIND_E2E=1, CDP 9333, temp BILIMIND_HOME, fake key), raw CDP over
  WebSocket (puppeteer-core connect() hangs on Electron 44's browser target). 22 checks pass: API shape, settings
  get/save/merge, testKey, courses list/get/playerUrl/remove guard, inspectFolder roles, run with fake key -> worker
  started/step-start/step-end/error events, failed run listed. Hidden windows do not paint, so E2E windows use
  offscreen rendering (BILIMIND_E2E_OSR=0 turns it off); CDP Page.captureScreenshot then works.
- broadcast uses BrowserWindow.getAllWindows() (offscreen webContents type is 'offscreen', not 'window').
- [pack] electron-builder.yml + scripts/dist.mjs: `pnpm --filter @bilimind/desktop dist` produced
  release/BiliMind-Desktop-0.1.0-x64-portable.exe and -setup.exe (99 MB each) via npmmirror binaries; electronDist uses the
  installed Electron. @bilimind/core+engine moved to devDependencies (everything is bundled; electron-builder packages
  no node_modules); pnpm-lock updated offline. Packaged app passes e2e (`--exe "release/win-unpacked/BiliMind Desktop.exe"`):
  worker runs from app.asar.unpacked/dist/worker, templates/assets/icon.png under resources/.
- [drop] File.path is gone (Electron 32+): preload captures `drop`, sends webUtils.getPathForFile() to main
  (IPC.dropped); the renderer's fallback pickFolder() then returns the dropped folder (or the dropped file's folder)
  without a dialog. In E2E, pickFolder never opens a native dialog (returns BILIMIND_E2E_PICK or null).
  CDP drag events do not reach the offscreen test window, so the e2e drop check self-skips.
- [icon] resources/icon.svg -> icon.png/icon.ico (scripts/make-icon.mjs, headless Chrome): cobalt rounded square, lime "b" + spark.
- [ci] .github/workflows/release.yml (tags v*, windows-latest, public registry + GitHub mirrors via env overrides).
- [final] `pnpm --filter @bilimind/desktop build` passes with the real renderer; tsc -p tsconfig.node.json clean;
  e2e-main 22/22 (dev) and 21/21 + drop skipped (packaged, minified). No electron processes left; temp dirs removed.
- Timings: step-end events carry the real per-step ms + cost from crew/log.jsonl; done card carries wallMs
  (receipts.wall_ms) — so the UI shows real timings, never invented ones.

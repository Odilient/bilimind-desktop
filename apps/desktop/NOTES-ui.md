# NOTES-ui (Task B: renderer, Vue 3 + Vite)

User request relayed with this task: "if commited, transfer timings too pls". Read as: the mock run must replay the
REAL step timings recorded in the showcase runs (showcase/courses/*/crew/log.jsonl), not invented ones.

- [start] Read CONTRACT.md, NOTES-main.md, landing tokens (11/base.css), sprite.html, showcase REPORT.md + crew/log.jsonl.
- Plan: src/renderer/{index.html,main.ts,App.vue,env.d.ts,mock.ts,styles/*,screens/*,components/*,assets/obj-*.webp}.
- Mock data: src/renderer/mock/gen-mock-data.mjs reads the 3 showcase courses (course.json, crew/log.jsonl,
  crew/plan.json, crew/ingest data) and writes src/renderer/mock/data.json (real cards, files, plan, step timeline
  with real start offsets and durations). mock.ts replays the first unattended pass (up to the first build) with
  long waits compressed (gap^0.6 then normalised to ~22 s); the feed shows the real step durations.
- [built] All five screens + settings in src/renderer (App.vue, store.ts state machine, words.ts plain-word
  translations of engine step results, mock.ts, components/{TitleBar,KeyCard,SettingsPanel,Icon}.vue,
  screens/{Home,Building,Finished,CourseView}.vue, sprite.ts = landing sprite + gear/key/lock, images.ts).
  `npx vite build --config apps/desktop/vite.config.ts` OK -> apps/desktop/dist/renderer. `vue-tsc -p src/renderer/tsconfig.json` clean.
- Screenshots: scratchpad shots.mjs serves the repo root over http (so the mock can iframe showcase/courses/*/index.html)
  and drives headless Chrome (puppeteer-core) at 1280x820 -> apps/desktop/shots/*.png.
- Iteration 1 fixes: course objects by keyword (shop > exam > language), file chips as 2-col grid with ellipsis,
  eyebrow pills no longer stretched, writer cards: Day chip nowrap, dot-only status, Write/Check/Pass strip,
  Coder counts the latest run per exercise (a self-marked exercise leaves the total: no fake 9/13),
  Narrator->Packager connector vertical, unused crew members become "Not needed" at the end, receipts auto-fit.
- Timings: the mock's finished card reports the recorded first pass (ds-final 4 min 33 s, $0.0397; boba 7 min 57 s,
  $0.0810) - the replay itself is compressed to ~22 s (?replay=40 slows it), the feed shows each step's real duration.
- Iteration 2: big faint phase word (READING / WRITING / CHECKING / NARRATING ...) behind the canvas, step timer in the
  ticker, Checker "rejected -> rewritten" moment captured (shots/04-building-*-moment.png), receipts auto-fit.
- For main/preload (Task A): main must create the window with webviewTag: true (course screen uses <webview>);
  dropping a folder needs a path: Electron 32+ removed File.path, so the drop zone falls back to pickFolder() unless
  the preload adds webUtils.getPathForFile (not in CONTRACT, so not used). index.html carries a CSP meta
  (self + file: + data:), adjust if main loads anything else.
- [done] Final shots in apps/desktop/shots (01-home, 02-home-filled, 03-home-key, 04-building-*, 05-finished,
  06-course, 07-settings). No console errors except a favicon 404 from the screenshot server.

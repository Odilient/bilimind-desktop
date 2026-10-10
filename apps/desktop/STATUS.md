# BiliMind Desktop: integration status (Task E, 2026-10-11)

## Result

The desktop app works end to end. Three REAL runs were driven through the UI (hidden window, BILIMIND_E2E=1, raw
CDP), each with folder `C:\Demo\DS-Final` (4 lecture PDFs + past-paper.pdf), the sentence "My Data Structures final
is Wednesday 9am. The slides and last year's paper are in this folder. I have 45 minutes a day. Get me ready.",
DeepSeek, narration on, outRoot `C:\Demo\BiliMind-out`. All three finished with a playable course; in each, the
course opened inside the app's `<webview>` and the player's "Hear the plan" audio played and seeked to 20.6 s.

| Run | Build | Click to done | Engine wall | Cost | Lessons (cut) | Checks | Rejected and rewritten | Code tests | Narration |
|-----|-------|---------------|-------------|------|---------------|--------|------------------------|------------|-----------|
| 1 | dev (`electron .`) | 209.5 s | 3 min 23 s | $0.0356 | 3 (11 cut) | 91/91 | 0 | 8/8 | 18.5 min |
| 2 | dev | 286.5 s | 4 min 42 s | $0.0489 | 3 (10 cut) | 98/100 | 0 | 4/4 | 32 min |
| 3 | **packaged** (`release/win-unpacked`) | 222.6 s | 3 min 37 s | $0.0322 | 3 (10 cut) | 79/80 | 2 | 13/13 | 24.4 min |

Total spent on the three runs: about $0.117. Per-step timings (every step's real ms and cost, seconds from the click)
are in `hackathon/proof/desktop-run-timings.json` (the "transfer timings" request: the real measured timings now
travel with the proof, next to the deck screenshots). Courses: `C:\Demo\BiliMind-out\ds-final`, `ds-final-2`,
`ds-final-3` (run 1's course was rebuilt offline after the title fix, which moved its recorded wall time to 3 min 30 s).

The events stream behaved as CONTRACT.md says: started, step-start/step-end with real ms and cost (from
crew/log.jsonl), plan right after the plan step (3 lessons with days 1 to 3, cut topics with reasons), done with the
card. The Checker's "rejected and rewritten" moment fired live in run 3.

## Screenshots (1280x820, captured from the hidden window over CDP)

In `docs/img/` and `hackathon/proof/deck-assets/`:
- `app-home.png`: home with a key saved and 5 courses (2 real + 3 examples). `app-home-folder.png`: folder picked, 4 Lecture + 1 Past paper.
- `app-building.png`: run 2 at 2:12, three Writers at work, plan with days and cut topics, plain-words feed.
- `app-building-checked.png`: run 3 (packaged) at 2:29, narration phase, Coder 13/13, Checker "2 rejected and rewritten".
- `app-finished.png`: run 3 receipts slab (79/80, 2 rejected, 13/13, 24.4 min, $0.0322, 3 min 37 s).
- `app-course.png`: run 2's new course in the in-app player.
- `app-settings.png`: settings panel (shows a fake test key's last 4, not the real key).

## Packaging

`pnpm --filter @bilimind/desktop dist` (npmmirror mirrors, signtool without a certificate):
- `apps/desktop/release/BiliMind-Desktop-0.1.0-x64-portable.exe`: 103,057,261 bytes (98.3 MB)
- `apps/desktop/release/BiliMind-Desktop-0.1.0-x64-setup.exe`: 103,301,643 bytes (98.5 MB)
- `apps/desktop/release/win-unpacked/BiliMind Desktop.exe`

Smoke test of the PORTABLE exe, hidden: `node scripts/e2e-main.mjs --exe release/BiliMind-Desktop-0.1.0-x64-portable.exe`
gives ALL PASS (window.bilimind shape, no Node in the renderer, settings merge, courses.list with the 3 examples,
guards, inspectFolder, worker start with a fake key failing cleanly at the first AI call). Real run 3 above is the
packaged app (asar + unpacked worker + sql-wasm + template + assets all fine, PDFs read inside the packaged worker).

## Tests

- `pnpm -r test`: core 55/55, player 73/73, engine 195 passed + 2 skipped (re-run after the shortTitle fix, which added one assertion), cli 12/12. Desktop has no unit tests (`--passWithNoTests`).
- `pnpm --filter @bilimind/desktop typecheck` (renderer + main/preload/worker): clean.
- Drivers kept in `apps/desktop/scripts/e2e/` (`drive-pre.mjs`: examples, settings, folder, player audio, no AI;
  `drive-run.mjs`: one real run through the UI, about $0.03 to $0.05; `EXE=<path>` drives a packaged build).
  Output goes to `apps/desktop/shots/e2e/` (gitignored).

## Changes made in this task

- `src/renderer/words.ts` + `store.ts`: `sayLine` keeps raw progress lines (model names, token counts, lesson keys,
  ReferenceError dumps, "run `check --lesson ...`" hints) out of the "What just happened" feed; only file reads, the
  topic search and narration lines get through, in plain words.
- `src/renderer/screens/Building.vue`: node status lines ellipsize; the Writer card shows "Rewriting" + its timer
  (it used to clip "Rewriting after the checks · 00:21" to "· 00").
- `src/renderer/screens/Home.vue`: the sentence box no longer shows a scrollbar at 3 lines.
- `packages/engine/src/build.ts` `shortTitle`: drops date tails ("exam-ready by Wednesday 9am" became
  "Data Structures exam-ready by"); test in `packages/engine/test/g2-e2.test.ts`.
- `src/main/runs.ts`: optional `BILIMIND_RUN_LOG=<file>` keeps the worker's raw output (tests only; off by default).
- `scripts/e2e-main.mjs`: kills the whole process tree first (the portable exe is a launcher; its app child used to survive).
- `package.json` `typecheck` script points at the real tsconfigs.
- `%USERPROFILE%\.bilimind\config.json` now also has `"desktop": {"narrate": true, "outRoot": "C:\Demo\BiliMind-out"}`
  (saved through settings.save as the brief asked; provider, keys and models are unchanged), so the app opens on the
  demo courses.

## Known issues

- Course titles come from the model and the 32-character short-title rule: run 2 and 3 are titled just "Data Structures"
  (from "Data Structures for the CSC2103 final exam").
- A Writer card keeps showing its own last check (run 3: Hash tables 18/23, red CHECK) even after the Checker's later
  pass brings the course to 79/80. True, but it can read as a failure on the canvas.
- The engine warns "lesson changed after its last check" at build when the Checker fixes a fact in place; the feed hides it.
- Drag and drop of a folder is still untested in a visible window (CDP drag does not reach the offscreen test window).
- No code signing: SmartScreen will warn on first launch of either exe.
- Offscreen test windows do not draw the native window buttons; the real window has them.
- `release.yml` has not run on GitHub yet.

## Log
- Started integration. Player dist present; C:\Demo\DS-Final has 4 lecture PDFs + past-paper.pdf.
- Build passes (`pnpm --filter @bilimind/desktop build`). Added BILIMIND_RUN_LOG (test-only) in src/main/runs.ts to keep worker output.
- Headless Electron (OSR, CDP 9341) with BILIMIND_EXAMPLES=showcase/courses: home lists the 3 example courses; settings
  panel opens; folder pick (BILIMIND_E2E_PICK=C:\Demo\DS-Final) lists 4 Lecture + 1 Past paper; ds-final opens in a
  `<webview>`; the player's "Hear the plan" button plays audio/a0173c367a47b452.mp3 (69.4 s) and seeking to 20.6 s works.
  (The player creates its `<audio>` with `new Audio()`, so it is not in the DOM; the check hooks HTMLMediaElement.play.)
- Real run 1 (UI, headless, DeepSeek, narration on): DONE in 203 s engine wall time (217 s from click), $0.0356,
  3 lessons kept (11 cut), 91/91 checks, 0 rejected, 8/8 code tests, 18.5 min narration; the new course opens in the
  webview and its "Hear the plan" audio plays and seeks (62.2 s clip). Events and screenshots looked right except:
  - the feed showed raw progress lines (model stats, lesson keys, ReferenceError dumps): fixed with `sayLine` in
    src/renderer/words.ts (only file reads, topic search and narration lines get through, in plain words);
  - the Writer card's "Rewriting after the checks · 00:21" clipped the timer: card now shows "Rewriting" + timer;
  - course title came out "Data Structures exam-ready by" (engine shortTitle cut "by Wednesday 9am" word by word):
    fixed in packages/engine/src/build.ts (drops date tails; test added in test/g2-e2.test.ts);
  - the sentence box showed a scrollbar for 3 lines (border-box height): fixed in Home.vue.
- `pnpm typecheck` script fixed (renderer + node configs); both pass.

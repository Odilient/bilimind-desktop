# WP4 status: tts, review, export, build

Files: `src/tts.ts`, `src/tts-edge.ts`, `src/review.ts`, `src/build.ts`, `src/export/{index,crew,time,receipts,report,ics,anki-csv,markdown}.ts`,
`test/wp4.test.ts`, `test/helpers/fixture-crew.ts`. Core change: `convert.ts` passes the Checker's `quote` to resolveCite (CHANGELOG 0.1.2).

## Works (tested)

- **narrate**: msedge-tts 2.0.9 with the clock-skew fix. The Sec-MS-GEC generator is replaced with one that uses
  server time; Date.now is not patched globally. Tested for real with the PC clock 8 h slow (skew 28,799 s).
  The script is `lessonSentences(fromSaasLesson(draft, meta))`. Sentences are grouped into 150-320 char paragraphs, never
  across blocks, with one request per paragraph and at most 12 Edge sockets per process. Word timings are aligned back to
  one cue per sentence. The paragraph mp3s are byte-concatenated with 384 ms of silence between blocks, and peaks are
  computed from word timings at 5 Hz. The cache is `crew/cache/tts/<sha256>.mp3`; `--no-cache` skips reading it.
  Voices: Ava (default), Yasmin for `ms`, Nilar for `my`.
  Speaking items and dialogue openers are voiced, and their paths are written into the draft. "Hear the plan" uses cues `plan.N`.
- Live numbers: 12 parallel clips took 12.7 s on the first run (1.5 s on a repeat). On the fixture, 94 sentences (9.0 min of
  audio) took 76 s with lessons run one after another; after the change to parallel lessons it took 12 s, a warm repeat.
  ffprobe durations match the byte-based durations exactly, a full ffmpeg decode reports zero errors, and the cue ids
  equal the player's sentence ids. `BILIMIND_LIVE_TTS=1 pnpm -F @bilimind/engine test` runs the live tests.
- **review**: `initReview` writes `review/state.json` with one card per item (except project, essay and code) and one per
  flashcard. The first due time is `plan.review_dates[key][0]` at 08:00 Asia/Kuala_Lumpur. It is idempotent: existing
  cards keep their FSRS state and cards for removed items are dropped. P2 `due` writes `review/today.html` and
  `outbox.json`; P2 `grade` parses "1 b, 2 chaining", uses core gradeFromText, reschedules with rateCard (capped at the
  exam) and rewrites reviews.ics.
- **export**: `lessons/NN-<key>.md` (Obsidian callouts, collapsed answers, `> [!quote]- Source:` citation callouts that
  link to `../sources/<file>#page=N`), `deck.csv` (Anki header lines; flashcards plus cloze items), `reviews.ics` (our own
  writer with VTIMEZONE, study blocks at 20:00 and review events, every event ending before the exam, lines folded at 75
  octets), and `REPORT.md`. Every REPORT count is recomputed from `crew/log.jsonl` with the same tallies as the receipts.
  `plan.md` is written only when `plan` did not write one.
- **build**: assembles course.json from crew/. It uses the shared `loadCrew` / `plannedLessons` / `toCourseLesson`, the
  cite resolver (file + locator, falling back to `Page N` and then the title, page, a verbatim quote, and an excerpt of at
  most 700 chars containing the quote), excludedItems, path, plan, review cards and receipts, and the licence line from
  `sources/LICENSE*.md`. It validates with validateCourse, writes course.json and runs `injectCourse` on the template
  (packages/player/dist/player.html, or `<skill>/templates/player.html` next to the bundle, or `$BILIMIND_TEMPLATE`, else
  a stub). It copies the obj-*.webp images the course uses (`$BILIMIND_ASSETS`, `<skill>/assets`, or the repo design
  folder).
- Fixture build: index.html is 882 KB with narration, course.json validates, and the player smoke test (Edge, file://)
  shows 0 console errors.
- An esbuild bundle (`--platform=node --format=esm --target=node22` plus a createRequire banner) ran TTS, export and
  build under WorkBuddy's Node v22.22.2.

## Not done or stubbed

- The manual imports (reviews.ics into Google or Outlook, deck.csv into Anki) were not done. They need a human, and
  there is no screenshot.
- No Mermaid SVG pre-render (P1). Audio blocks get no clip of their own; they are read as part of the lesson narration.
  No `.apkg` (P1).
- Receipts and REPORT times follow the clock of the machine that wrote crew/log.jsonl. If that clock is 8 h slow, the
  HH:MM values shown are 8 h early. Relative values (wall time) are correct.

## Next / notes for integration

- WP6 CLI: `narrate {lessons?, voice?, langs?}`, `export` (calls initReview), `build {template?}`, `due {n}`,
  `grade {answers}`. `doctor` can use `edgeClockSkew()` (exported) for `clock_skew_ms`.
  The bundle needs the `createRequire` banner because msedge-tts is CommonJS and uses ws and axios. Ship
  `skills/bilimind/templates/player.html` and `skills/bilimind/assets/obj-*.webp` next to `scripts/`.
- `node packages/engine/test/helpers/fixture-crew.ts <dir>` writes a ready crew/ folder from the core fixture, for
  demos and contract tests.

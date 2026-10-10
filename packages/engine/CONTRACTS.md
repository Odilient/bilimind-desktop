# @bilimind/engine contracts

Signatures live in `src/contracts.ts` (types + JSDoc). Every module below exports exactly these names, typed
with the contract types; `src/contracts-check.ts` fails the typecheck if a name or type drifts. Stubs throw
`new Error('not implemented: <name>')`: replace them in place. Change a signature only with a line here.

## Conventions

- Command functions: `(ctx: Ctx, opts) => Promise<Data>`; `Data` is the CLI's `data` (PLAN §2.5).
  The CLI (`apps/cli/src/output.ts runCommand`) prints `{ok, cmd, data, cost_usd: ctx.spend.usd, ms}`, appends `crew/log.jsonl`.
- Failure: `throw new BilimindError(message, hint)` -> `{"ok":false,"cmd","error","hint"}`, exit 1.
- `Ctx = {course (abs), agent (--as), noCache, model?, maxUsd?, spend:{usd,calls}, now(), progress(line)}`.
- All model calls go through `callJson(ctx, req)` (llm.ts). It checks the ledger, records spend, adds to `ctx.spend`.
- Paths: `coursePaths(course)` (course.ts, implemented). Returned paths are relative to the course folder.
  JSON helpers `readJson / readJsonOrNull / writeJson / writeText` (course.ts, implemented).
- Shared types, schemas, graders, sentence ids, FSRS: import from `@bilimind/core` only.
- **Ids (all lanes):** block ids `b<n>` and item ids `q<n>` are unique per lesson, assigned by `draft`, kept across
  repairs and hand edits, never renumbered by position, never reused. A *block number* (`--block n`, `codeDir(key, n)`,
  `CheckFailure.block`, `CodeBlockReport.block`) is the numeric part of the id (`core blockNumber('b3') === 3`).
- **Draft -> course is ONE function:** core `fromSaasLesson(draft, meta)`. `build` uses it AND `narrate` scripts its
  output (`lessonSentences(fromSaasLesson(...))`), so cue ids equal the player's spans. It keeps ids, drops items with
  status `contradicted`/`excluded`, maps `status` -> course `verdict`, adds `beyond_slides` for `not_covered`, resolves
  `cite_chunk_ids` -> item `cites` (passing the Checker quote to `resolveCite(chunkId, quote)`), and nulls a narration whose
  cues no longer match (`core narrationMatches`). `core excludedItems(lessonId, draft, resolveCite)` gives `receipts.excluded`.
- **Checker loop on the draft item** (never delete an item): `verdict` sets `status`, `quote`, `reason`,
  `cite_chunk_ids`; supported also sets `explanation = quote`; not_covered adds label `beyond_slides`. `rewrite-item`
  appends a NEW item (next free `q<n>`, `replaces: <old id>`, labels `['rewritten']`, status `pending`) after the old one,
  which stays `contradicted`. `verdict --file` = JSON array of `VerdictInput` (or `{"rulings": [...]}`).
- **code-test --disable:** `payload.tests = []`, the code item gets grader `self` and loses `answer_key.tests`.

## Modules (owner · exports)

| File | Owner | Exports |
|---|---|---|
| `config.ts` | WP1 | `loadConfig` |
| `llm.ts` | WP1 | `callJson` |
| `ledger.ts` | WP1 | `checkBudget`, `recordSpend`, `spentToday`, `spentForCourse`, `balance` |
| `cache.ts` | WP1 | `cacheKey`, `cacheGet`, `cacheSet` |
| `log.ts` | WP1 | `appendLog`, `readLog`, `note` (cmd `note`) |
| `ingest/index.ts` | WP1 | `extractFile`, `detectRole`, `chunkSections`, `buildDigest`, `ingest` (cmd), `readIngest` (done) |
| `retrieve.ts` | WP1 | `buildIndex`, `searchTerms`, `retrieveForLesson` |
| `outline.ts` | WP2 | `outline` (cmd), `readOutline` (done) |
| `exam.ts` | WP2 | `parseExamQuestions`, `examMap` (cmd `exam-map`), `readExamMap` (done) |
| `plan.ts` | WP2 | `plan` (cmd), `readPlan` (done) |
| `draft.ts` | WP2 | `draft` (cmd), `readLessonDraft`, `writeLessonDraft` (done) |
| `normalise/index.ts` | WP2 | `normaliseLesson` |
| `validate/index.ts` | WP3 | `check` (cmd), `runJsTests`, `isSafeFormula`, `isPlausibleMermaid` |
| `codework.ts` | WP3 | `codeTest` (cmd `code-test`, mode run/dump/apply/disable) |
| `evidence.ts` | WP3 | `evidence` (cmd) |
| `verdict.ts` | WP3 | `verdict` (cmd), `findQuote`, `readVerdicts` (done) |
| `rewrite.ts` | WP3 | `rewriteItem` (cmd `rewrite-item`) |
| `plant.ts` | WP3 | `plant`, `plantScore` (cmds) |
| `tts.ts` | WP4 | `synthesize`, `narrate` (cmd), `readNarration`, `readClips` (both done) |
| `review.ts` | WP4 | `initReview`, `readReviewState` (done), `due`, `grade` (P2 cmds) |
| `export/index.ts` | WP4 | `toMarkdown`, `ankiCsv`, `ics`, `report`, `computeReceipts`, `exportAll` (cmd `export`) |
| `build.ts` | WP4 | `assembleCourse`, `build` (cmd) |
| `course.ts` | WP0 / WP6 | `coursePaths`, `resolveCourse`, `readJson`, `readJsonOrNull`, `writeJson`, `writeText` (done); `init`, `setGoal` (cmd `goal`), `status` (stubs) |
| `doctor.ts` | WP6 | `doctor` (cmd) |
| `run.ts` | WP6 | `run` (builders only, never in SKILL.md) |

## Files each command reads/writes (crew/ = the agents' workbench)

`goal` -> `crew/goal.json` (core `Goal`) · `ingest` -> `crew/ingest.json` (`IngestResult`) · `outline` -> `crew/outline.json`
(`OutlineResult`) · `exam-map` -> `crew/exam-map.json` (`ExamMap`) + `.md` · `plan` -> `crew/plan.json` (`PlanResult`) + `plan.md` ·
`draft` -> `crew/lessons/<key>.json` (`LessonContent`, block ids `b1..`, item ids `q1..` per lesson) · `check` ->
`crew/checks/<key>.json` · `code-test --dump` -> `crew/code/<key>-b<n>/` · `evidence` -> `crew/evidence/<key>.md` ·
`verdict` -> `crew/verdicts/<key>.json` (`Verdict[]`) + item fields in `crew/lessons/<key>.json` · `narrate` -> `audio/*.mp3`
+ `crew/narration.json` (core `NarrationIndex`: per-lesson `Narration`, the plan overview, clips) + speaking/dialogue audio paths
in the draft payloads · `initReview` (called by `export`, idempotent) -> `review/state.json` (`ReviewState`) · `export` ->
`lessons/NN-<key>.md`, `deck.csv`, `reviews.ics`, `REPORT.md` · `build` -> `course.json` (core `CourseSchema`, validated with
`validateCourse`, the ORIGINAL object written) + `index.html` (core `injectCourse(template, course)`).
`check` -> `crew/checks/<key>.json` (`CheckData` incl. `total`) · receipts/REPORT numbers come from `LogEvent.data` of each command.

## Changes after the G0 contract review

- `CoursePaths.narrationJson` (`crew/narration.json`), `ReadNarration` + `readNarration` export (done), `AudioClip` reshaped
  (`kind`, string `block` id, `duration_ms`), `CheckData.total`, JSDoc rules above. core: `Assessment.quote/reason/replaces`,
  `blockNumber`, `DROPPED_STATUSES`, `NarrationIndex`, `narrationMatches`, `excludedItems`, `resolveCite(chunkId, quote?)`.

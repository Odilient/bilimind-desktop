# WP3 status: validate, code-test, evidence, verdict, rewrite-item, plant

Owner files: `src/validate/*`, `src/codework.ts`, `src/evidence.ts`, `src/verdict.ts`, `src/rewrite.ts`, `src/plant.ts`.
Tests: `test/wp3-validate.test.ts`, `test/wp3-codework.test.ts`, `test/wp3-checker.test.ts`, plus the fixture builder
`test/wp3-fixture.ts`, which turns `core/fixtures/course-ds-mini.json` into a throwaway course folder. Result: 26 WP3 tests pass,
and the whole engine suite passes (115 tests). Typecheck is clean for these files.

## Works

- **`check --lesson k`** runs deterministic repairs first, written back to the draft with one `repairs` line each and listed in `auto_fixed`.
  Then the rules run, and the result goes to `crew/checks/<k>.json` = CheckData + `{lesson, round, at, checks}`. Rows: one passing row per subject
  (the lesson, a block or an item), or one failing row per problem. Each failing row has a `detail` and a `suggestion` the Writer can act on.
  `total = passed + failed.length` (the fixture gives 33/33 and 37/37).
  - Q0 schema (core `payloadIssues` + `AssessmentItemSchema`) and ids (unique `b<n>` / `q<n>`)
  - Q1 mandatory formats (`mandatoryFormats(archetype)` from crew/outline.json)
  - Q2 item count (3 to 6), Q3 Bloom (at least one higher-order item, at most half `remember`), Q4 MCQ cap (repair: surplus demoted to short_answer)
  - Q5 mcq: 4 options, unique ids and texts. A leaked answer is demoted.
  - Q6 multi_select: 4 to 6 options and 2 to 3 correct. Repair: "(Select all that apply.)" is appended.
  - Q7 ordering: a permutation, not presented in the correct order (repair: rotate)
  - Q8 cloze: exactly one `____`. Repair: `_{3,}` becomes `____`. With no blank, the item becomes short_answer.
  - Q9 numeric: tolerance repair, and the unit is named in the prompt. Q10 rubric: weights are normalised, and generic criteria are flagged.
  - **Q11 code runs**: node:vm, fresh context per test, 2 s budget. After a timeout the remaining tests are skipped. deepEqual follows the spec.
    The reference must pass every test, the starter must fail at least one, and a debug starter must parse. Repair: `answer_key.tests` is
    synced to the block's test names.
  - Q12 playground: `isSafeFormula`, then 28 points across input 1 in node:vm (200 ms). Every output must be finite and the output must change.
    `discover` must fall inside the input's range. Repair: if input 1 does not change the output, an input that does is moved first.
  - Q13 Mermaid plausibility. **An implausible diagram is dropped** (acceptance e). If it was mandatory, Q1 then asks for a new one.
  - Q14 cite ids must exist in crew/ingest.json; unknown ids are stripped. A "slide N" / "page N" in the prose that does not exist in the cited file is flagged.
  - Q15 thin lesson (words >= 50% of minutes/5 x 150). The suggestion is the verbatim re-ask sentence as a `draft --note`.
  - Q16 URLs are stripped and the link text is kept. Q17 speaking/dialogue/audio must have exactly one language code.
- **`code-test`**:
  - run
  - dump: `crew/code/<k>-b<n>/{instructions.md, starter.js, solution.js, tests.json}`
  - apply: validates tests.json (unique names), re-runs, adds a `repairs` line
  - disable: `tests = []`, grader `self`, `answer_key.tests` removed, reason added to `repairs`; core `gradeCode` then says `self`.
- **`evidence`**: writes `crew/evidence/<k>.md`. It opens with the ruling rules and the exact `verdict` / `rewrite-item` commands. Then, for each
  live non-code item: the prompt, the options, the accepted answer in words, and the excerpts (each up to 700 chars, with chunk id and locator).
- **`verdict`**: the quote must be a verbatim substring of one of the item's chunks, after normalising Unicode (NFKC), curly quotes, dashes and
  minus signs, soft hyphens and whitespace. `...` skips words, but every piece must appear in order in the same chunk. Case is kept, and a quote
  needs at least 3 words or 12 characters. Otherwise the ruling is refused with a `why`.
  - supported: `explanation = quote`, and `cite_chunk_ids = [chunk]`
  - contradicted: status `contradicted`; core `fromSaasLesson` drops the item and `excludedItems` lists it. A reason is required.
  - not_covered: label `beyond_slides`; the quote may be empty.
  - Each ruling is appended to `crew/verdicts/<k>.json` with its `round` (2 for a rewritten item).
- **`rewrite-item`**: one deepseek-flash call through `callJson` (stage `rewrite_item`). It has a schema, and its `validate` runs the Q5-Q9 item
  rules (one corrective turn). The new item gets the next free `q<n>`, counting ids in the draft and in the verdict history. It also gets
  `replaces`, `rewritten`, `pending`, and the old item's `cite_chunk_ids`. It is inserted right after the old item. An old item that was not
  `contradicted` becomes `excluded`, so the course never shows both. **Live run: 2 calls, $0.00034 in all**, both valid on the first attempt
  (an mcq and a cloze).
- **`plant` / `plant-score`**:
  - plant corrupts mcq, multi_select, numeric, ordering and cloze keys, picked by a seeded shuffle and spread round-robin across lessons.
  - Every checkable item in the touched lessons is reset to `unchecked`, so its status gives nothing away.
  - The answer key goes to `crew/plant-key.json`, together with the verdict-history offsets.
  - plant-score counts only rulings made after planting. `caught` means ruled `contradicted`; `false_alarms` means an honest item was ruled `contradicted`.
  - Tested: a scripted perfect Checker scores 10/10 and an "all supported" Checker scores 0/10.
- **Lesson lock**: `withLessonLock` (`crew/lessons/<k>.json.lock`, created with `wx`, stale after 30 s, waits up to 15 s) wraps every read-modify-write
  done by check, code-test apply/disable, verdict and rewrite-item. The Coder and the Checker run in parallel on the same lesson. In a test,
  6 parallel processes each ruled on a different item, and all 6 rulings landed.
- Runs on WorkBuddy's Node 22.22.2: the harness and playground were bundled with esbuild for node22 and executed there, including `Atomics.wait`.
- The CLI wiring is WP6's (`apps/cli/src/commands/{lessons,checker,package}.ts`). The smoke test of check, code-test dump/apply, evidence and
  verdict through `node apps/cli/src/main.ts` passed, and the log lines carry the data the receipts need.

## Stubbed / not done

- Q11 runs only JavaScript (function/debug/script). Python, SQL query and HTML build exercises are `skipped`: they produce no row and are not
  counted as passed. sql.js is available if query mode is wanted later.
- Q14 checks that a slide/page number EXISTS in the cited file, not that it is the slide the block cites (that would give false alarms).
- Q2 above 6 items is flagged, never trimmed (no item is ever deleted). Q12 flags; it does not remove the playground's sparkline.
- node:vm is not a security sandbox: the context has a null prototype, no require/process, and eval / new Function are disabled. That is enough
  for model-written exercises from our own pipeline, and it is not meant for hostile code.

## Next (if time)

- Player parity: the code runner in the page should use the same deepEqual (expected `null` also matches `undefined`).
- Optional sql.js run for `query` mode.

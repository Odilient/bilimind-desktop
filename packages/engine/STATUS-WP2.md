# WP2 status: prompts, outline, exam-map, plan, draft, normalisers

Files: `src/prompts/{php,support,outline,expand,context}.ts`, `src/normalise/{index,util,blocks,assessment,lesson,outline}.ts`,
`src/{outline,exam,plan,draft}.ts`, `scripts/extract-php-prompts.mjs`, tests `test/wp2-*.test.ts` (68 tests, all pass;
`npx vitest run test/wp2-*.test.ts`). No core change, no new dependency.

## Works

- **Prompts are the production text, verbatim.** `scripts/extract-php-prompts.mjs` pulls the 21 heredocs out of
  `backend/app/Services/Llm/Prompts/*.php` into `src/prompts/php.ts` (generated, do not edit). The TS only fills the
  placeholders and applies the HACKATHON edits through `edit()`, which throws if a target string ever stops matching.
  A golden test diffs our outline system against the PHP text line by line (exactly the compact-spine edits: 5-8 topics,
  2-5 subtopics, one sitting, deadline wording, 2-3 chapters, 1-3 notes) and the expand system (exactly the 5 disabled
  catalogue entries removed). Tables (archetypes with `mandatoryFormats`, tracks, marks) are rendered from core.
- **outline**: one reasoning call, variety gate (`strictSmall`) + relabel up to 2 passes then accept (errors swallowed),
  GraphBuilder port (slugs, dedupe, unplaced subtopic -> spine, depth > 2 re-hung, long notes dropped, minutes clamped,
  reading order, parent index), marks fix (all-`recommended` siblings lose their marks; `alternative` without a pick gets
  one), `allows_code` decided in code (never for staff; true for a coding subject; else the model), `code_language`
  always `javascript`, `planned_block_types` from core `plannedBlockTypes` (never the model), top-6 chunk ids and the
  thin flag per lesson. Data has extra `warnings` (spine too long, allows_code override, marks fixed, accepted violation).
- **exam-map**: regex parser ("Question N"/"QN"/"N." headers, line-start "(a)" parts, "[N marks]"/"(N marks)"; a part
  without marks shares what is left of its question), chunk overlap removed, each part matched to topics by explainable
  term overlap (title x3, summary x2, the topic's own chunks, idf, crude stem), a subtopic's marks go to its parent
  unless it wins by 25%, `--assign "Q3=key"` / `"Q3b=key"`. Writes `crew/exam-map.json` + a readable `crew/exam-map.md`
  (weights, every part with matched terms and runner-up, how to fix). Extra data: `zero_mark_topics`, `report`.
- **plan**: keep/cut/order/start; capacity = study days (start .. exam-1) x minutes, 60/40; days by linear partition
  (busiest day as small as possible; new lessons finish a day early when that fits, so every lesson gets a review);
  review dates from core `reviewDatesBackwardsFromExam` (all strictly before the exam); warnings only (over capacity,
  a cut topic with >= 10% of marks, thin lessons, no review before the exam, variety on the selection). Writes
  `crew/plan.json` (PlanResult) + `plan.md` (exported `planMarkdown()` for WP4's refresh). Extra data: `cut`, `plan_md`.
- **draft**: one expand call (reasoning off) with the lesson's chunk ids printed as `material_id` (past-paper chunks
  never), neighbours (the kept lessons in plan order when a plan exists), derived mandatory formats, `--note` as the
  steer; no automatic re-ask; one higher-order repair call only when every item is recall. `--only <type>` rewrites
  that block in place keeping its id, or ADDS a missing one (next free `b<n>`, before the quiz); new items get the
  next free `q<n>`. Extra data: `missing_formats`, `mandatory`, `repairs`, `thin`, `chunks`, `file`.
- **normalisers**: BlockPayloadNormaliser port for the 22 enabled types with every alias in engine-port §4; items
  (normaliseAssessment, usable keys, rubric weights, llm_rubric without rubric -> self); singleton rule; orphans into
  the last quiz; MCQ cap (demote to short_answer); strip code when `allows_code` is false; code = JavaScript
  function/debug only (others dropped with a reason); a project/code block without its item gets one. Every output
  passes core `fromSaasLesson` + `CourseLessonSchema` (tested on the 3 BST samples and both live drafts).

## Live run (ds-final, 2026-10-10, DeepSeek direct `deepseek-flash`, total $0.032 of the $0.05 allowance)

- outline: 111 s incl. ingest, $0.0163 (thinking on), 13 lessons (8 core + 5 subtopics), gate passed first time,
  7 archetypes, allows_code true. exam-map on it: 20 parts, 100 marks, 100% assigned; heaps 30, collisions 26, BST 15,
  AVL 0 (cut). Q4a went to the dynamic-arrays parent rather than the linked-list subtopic (the Lead can `--assign`).
- drafts (run in parallel): `dynamic_arrays` 21 s $0.0044, `binary_heaps` failed once ($0.0076: the reply was not
  parseable JSON twice, initial + corrective turn) and passed on the retry (26 s, $0.0040). **Mandatory formats on the
  first usable draft: 2/2.** Both drafts validate. The live code exercise's reference solution fails 1 of 4 tests
  (expected 13, got 4): real material for the Coder's "failed, fixed, passed" beat.
- Course folder kept at the session scratchpad `.../scratchpad/live` (not in the repo).

## Stubbed / not done

- No automatic missing-format re-ask (by design: the Writer runs `draft --only <type>`).
- A full re-draft restarts ids at b1/q1 (contract); `--only` uses max existing id + 1, so an id deleted by hand at the
  top end could be reused.
- Python/SQL/HTML exercises are dropped (the page runs JS only).

## Next

- WP1: `decodeJsonObject` returns null for a raw newline or tab inside a JSON string; escaping control characters
  inside strings as one more repair candidate would likely have saved the failed heaps call.
- WP7 (writer.md): read `missing_formats` from `draft`; repair with `draft --lesson k --only <type> --note "..."`.
  Lead: `exam-map` then open `crew/exam-map.md`; `plan` warnings name what to reorder or cut.

# Inventory: Learning Loop (assessments, grading, progress, review, schedule)

Slice owner: learning loop. Source of truth: BiliMind web (Laravel 13 backend + Nuxt 4 frontend) as of 2026-10-10.
Target: BiliMind Desktop (Node.js, single local user, BYOK, everything written to a local markdown vault).

Status: COMPLETE (2026-10-10). Sections: 0 source map, 1 checklist, 2 backend specs, 5 frontend, 3 data model, 4 API, 6 porting.

---

## 0. Source map

Backend (`/home/iphone8/projects/odilient/bilimind/backend`):

| Area | Files |
|---|---|
| Grading core | `app/Services/Grading/{Grader,GraderRegistry,GradeResult,GradingPolicy,AnswerNormaliser,AttemptService}.php` |
| Graders | `app/Services/Grading/{DeterministicGrader (932 lines),LlmRubricGrader,SelfGrader}.php` |
| Grading safety | `app/Services/Grading/{FeedbackAudit,LeakGuard}.php` |
| Rubric prompt | `app/Services/Grading/Prompts/RubricGradePrompt.php` (VERSION `grade.rubric.v1`) |
| Progress rules | `app/Services/Grading/NodeProgressUpdater.php` |
| Async grading | `app/Jobs/GradeAttemptJob.php` |
| Spaced repetition | `app/Services/Review/ReviewScheduler.php` (SM-2), `app/Http/Controllers/ReviewController.php`, `app/Models/ReviewItem.php` |
| Study plan | `app/Services/Schedule/ScheduleBuilder.php`, `app/Jobs/BuildScheduleJob.php`, `app/Http/Controllers/{ScheduleController,TodayController,NotificationController}.php` |
| Digest | `app/Jobs/DailyDigestJob.php`, scheduled in `routes/console.php` at 08:00 daily |
| Routes | `routes/api/{assessments,schedule,reviews}.php` |
| Requests | `app/Http/Requests/{SubmitAttemptRequest,UpdateProgressRequest,StoreScheduleRequest,UpdateScheduleItemRequest}.php` |
| Resources | `app/Http/Resources/{AttemptResource,AssessmentResource,ReviewItemResource,ScheduleItemResource,ScheduleResource}.php` |
| Enums | `app/Enums/{AssessmentKind,GraderKind,ProgressState,ScheduleItemState,CodeMode,BlockType,LessonMark}.php` |
| Generation side (assessment shapes) | `app/Services/Llm/Prompts/ExpandNodePrompt.php` (`assessmentSchema()`, `assessmentRules()`, `payloadCatalogue()`) |

Frontend (`/home/iphone8/projects/odilient/bilimind/frontend/app`): see section 5.

---

## 1. Feature checklist (LRN-xx)

Assessments and grading
- [ ] **LRN-01** Nine assessment kinds (mcq, multi_select, cloze, ordering, numeric, short_answer, essay, project, code), each with its own input UI
- [ ] **LRN-02** Per-kind response validation with friendly messages, plus shorthand promotion of bare values
- [ ] **LRN-03** Grader registry with fallback (configured -> kind default -> self); substitution recorded in grader_meta
- [ ] **LRN-04** One pass policy: pass = 70% of max_score; pass mark shown to the learner
- [ ] **LRN-05** MCQ exact-option grading
- [ ] **LRN-06** Multi-select Jaccard partial credit, with feedback explaining that over-selecting costs marks
- [ ] **LRN-07** Cloze: positional multi-blank matching after normalisation (no accent stripping, no stemming)
- [ ] **LRN-08** Ordering: consecutive-pair credit x coverage
- [ ] **LRN-09** Numeric: tolerant number parsing, absolute or % tolerance, "too high/too low" feedback, unit hint
- [ ] **LRN-10** Code: grades the declared tests the client reports, with partial credit, timeout handling and honesty meta
- [ ] **LRN-11** A code item that declares no checks is recorded as self-assessed done, so it never stays pending forever
- [ ] **LRN-12** LLM rubric grading for short_answer/essay/project: weighted score computed locally, per-criterion comments
- [ ] **LRN-13** Rubric prompt rules: banned praise phrases, must quote the learner verbatim, written in the course language
- [ ] **LRN-14** Feedback audit, with one re-ask when feedback is generic or too short
- [ ] **LRN-15** Default rubric (Accuracy 0.5 / Completeness 0.3 / Clarity 0.2) when an item has none
- [ ] **LRN-16** Empty submission scores 0 with no LLM call
- [ ] **LRN-17** Self-assessment ("I've done this") with an optional note to your future self
- [ ] **LRN-18** Attempt saved before grading; an LLM outage leaves it pending/queued; async option; retry job; failed status
- [ ] **LRN-19** Attempt history (last 100), best score, retry ("Submit again" / "Try a different answer"), polling for pending grades
- [ ] **LRN-20** Answer-key firewall: LeakGuard redaction, options as {id,text} only, rubric as {criterion,weight} only, unit-only input hint
- [ ] **LRN-21** Attempt result card: headline, score only when it means something, rubric bars, feedback, sandbox footnote
- [ ] **LRN-22** Plain-language grader chips: "Checked instantly", "Marked by AI", "You mark it"
- [ ] **LRN-23** Shared view shows assessments read-only (question and "Graded on ..." without the form)
- [ ] **LRN-24** Retired assessments keep their attempts but are excluded from completion
- [ ] **LRN-25** Generation-side sanitisation the grader relies on: MCQ cap 40%, Bloom coverage, rubric required, code key derived from payload tests

Code exercises (client-side grading)
- [ ] **LRN-26** Five code modes (function, script, debug, query, build) in a browser WASM sandbox (Python, JS, SQL, HTML)
- [ ] **LRN-27** Check semantics: deepEqual on call/expect, exact trimmed stdout, SQL compared as an unordered set (ordered on request), DOM selector checks
- [ ] **LRN-28** Dirty-run rule: editing marks results stale and blocks submission until the next run
- [ ] **LRN-29** Hints locked until an attempt, revealed one at a time; no solution reveal
- [ ] **LRN-30** Draft autosave/restore; reset to the starter with an 8 s undo
- [ ] **LRN-31** Focus (full-screen) mode, Cmd/Ctrl+Enter to run, per-mode output tabs, checks listed before the first run
- [ ] **LRN-32** Runtimes load lazily when the learner shows intent, with download explanation; 5 s timeout; 100 KB code/output caps
- [ ] **LRN-33** Open an exercise in a workspace sandbox tab

Lesson containers
- [ ] **LRN-34** Quiz block container with a passed counter
- [ ] **LRN-35** Exam block: start gate plus a soft countdown timer that never discards work
- [ ] **LRN-36** In-lesson flashcard deck (flip, shuffle, "again" re-queue, keyboard shortcuts)

Progress
- [ ] **LRN-37** Four progress states: Not started / In progress / Completed / Skipped
- [ ] **LRN-38** A node auto-completes when every live assessment is passed; auto-completion never undoes itself
- [ ] **LRN-39** Manual Done / Learning / Skip toggles; roadmap gestures (right-, shift-, alt-click) with optimistic UI and undo
- [ ] **LRN-40** Time on task: counts only while visible and in the foreground, 30 s delta pings, beacon on unload, 1-day cap per call
- [ ] **LRN-41** Course progress summaries (percent and counts) on roadmap, Today and library
- [ ] **LRN-42** "Lesson complete" toast; node state refreshed from the attempt response meta

Spaced review
- [ ] **LRN-43** SM-2 review item seeded when a lesson is first completed (due tomorrow); idempotent
- [ ] **LRN-44** Review session: one card at a time, Again/Hard/Good/Easy, progress bar, "waited N days", "Open the lesson"
- [ ] **LRN-45** Review queue drops archived/trashed courses but keeps their schedule
- [ ] **LRN-46** Review stats (due/overdue/upcoming/learning/mastering) and a review streak
- [ ] **LRN-47** "Lessons to review today" card on Today with a minutes estimate
- [ ] **LRN-48** Review done screen: a warm full stop with a streak pill

Study plan
- [ ] **LRN-49** Plan from three inputs (start date, minutes/week, study days), with presets and a per-session preview
- [ ] **LRN-50** Prerequisite-aware, cycle-safe topological packing into sessions; nodes never split; an oversized node gets its own day
- [ ] **LRN-51** Mark a session done/skipped (or un-skip), move it to a date (a pin), push to tomorrow; future work re-flows
- [ ] **LRN-52** Overdue work stays visible as calm debt (never silently moved); "slipped — no problem" reassurance copy
- [ ] **LRN-53** Self-healing: new nodes join the plan on read; completions sync to the plan; un-ticking reopens progress
- [ ] **LRN-54** Re-plan/rebuild; a completed schedule reactivates; statuses active/paused/completed
- [ ] **LRN-55** Plan tab grouped by day with All/Open/Done filters, stats, next session and finish date
- [ ] **LRN-56** "Today" computed in the learner's own timezone everywhere

Today (home)
- [ ] **LRN-57** Today home: greeting, continue card (resume an in-progress lesson or start the next), plan list (overdue then today), course rings
- [ ] **LRN-58** Bulk "Move them to today" catch-up
- [ ] **LRN-59** Row actions: mark done (with undo), move to today, skip
- [ ] **LRN-60** Completion streak (current, longest, 14-day strip), is_study_day, data for the week strip
- [ ] **LRN-61** Nudge for a course with no plan: "Give your course a weekly rhythm"
- [ ] **LRN-62** New-learner and empty states with the composer and suggestion chips; drafts strip

Nudges
- [ ] **LRN-63** Daily 08:00 digest notification: one per day, silent on rest days, re-flows the plan first
- [ ] **LRN-64** In-app notification inbox (bell, 45 s poll, unread count, mark one or all read)

Public content
- [ ] **LRN-65** Public /learn roadmaps (stages with proofs, paces, self-checks); 32 static subjects

---

## 2. Detailed specs — backend learning engine

### 2.1 Assessment model (what gets graded)

Table `assessments`: `id, node_id, block_id?, kind, prompt (text), options (json [{id,text}]), answer_key (json, NEVER serialised), rubric (json [{criterion, weight, excellent, acceptable, poor}]), grader ('deterministic'|'llm_rubric'|'self', default deterministic), max_score (int, default 100), position (int)`.

- Assessments are owned by assessment-bearing blocks: `BlockType::carriesAssessments()` = `quiz`, `exam`, `project`, `code`. The block payload carries `assessment_ids`.
- Block container payloads: `quiz {"intro"}`, `exam {"intro", "time_limit_minutes": 30}` ("a longer, mixed-kind checkpoint"), `project {"title","brief_markdown","deliverables":[...]}`, `code` (5 modes, below), `reflection {"prompt"}` (ungraded), `flashcards {"cards":[{front,back}]}` (ungraded in-lesson, 6-12 cards), `scenario` (branching, "not graded; practice").
- **Retired assessments**: a regeneration cannot delete an answered assessment (attempts cascade), so `NodeExpander` parks it at `position = 1000` (`Assessment::RETIRED_POSITION`). Scope `live()` = `position < 1000`; `retired()` = `>= 1000`. Only live assessments count toward completion or are rendered.
- `answer_key` is in `$hidden` on the model (defence in depth) and never read by any resource.

**AssessmentKind** (9 kinds) and default grader:

| kind | label | default grader | has options |
|---|---|---|---|
| `mcq` | Multiple choice | deterministic | yes |
| `multi_select` | Select all that apply | deterministic | yes |
| `cloze` | Fill in the blank | deterministic | no |
| `code` | Code | deterministic (client-reported tests) | no |
| `ordering` | Put in order | deterministic | yes (to arrange, not pick) |
| `numeric` | Numeric answer | deterministic | no |
| `short_answer` | Short answer | llm_rubric | no |
| `essay` | Essay | llm_rubric | no |
| `project` | Project | llm_rubric | no |

`needsRubric()` = default grader is llm_rubric. GraderKind labels: `Auto-graded` / `Rubric-graded` / `Self-assessed`.

**Generation contract** (from `ExpandNodePrompt::assessmentRules()`; the grading engine depends on these shapes):
- 3-6 items per node; at most `MAX_MCQ_SHARE` (rendered as a %, "one out of three, or two out of five") may be mcq.
- Every item declares `bloom` in `remember|understand|apply|analyze|evaluate|create`. At least one item must be apply+; at most half may be `remember`. A recall-only node triggers a repair pass (`higherOrderSystem()/higherOrderUser()`) that writes 1-2 higher-order replacement items.
- Per kind: mcq = exactly 4 options ids a-d, distractors encode real misconceptions, `{"correct_option_ids":["b"]}`; multi_select = 4-6 options, 2-3 correct; ordering = 4-6 options in scrambled order, `{"correct_order":[...]}` (every id once); numeric = `{"value":13.04,"tolerance":0.05,"unit":"A"}` (never tolerance 0 after a division); cloze = prompt contains exactly one `____` (four underscores), `{"accepted":[...]}`; short_answer = 2-4 sentences, rubric required, `{"reference_answer"}`; essay = 200-400 words, rubric required; project mirrors the project block brief, rubric required; code = one per code block, `{"reference_solution"}` (never in payload).
- Rubric: 2-4 rows, `criterion` (6-200 chars, question-specific; "Understanding", "Clarity", "Quality of writing" are rejected), `weight` 0..1 summing to 1, and one-sentence `excellent/acceptable/poor` descriptors of observable content.
- `max_score` 1..100.

**Code block modes** (`CodeMode`): `function` (python|javascript; tests `{name, call, expect}`), `script` (python; tests `{name, stdin, expect}` compare trimmed stdout; JS script keeps one test, no stdin), `debug` (python|javascript; starter code runs and is wrong; `symptom_markdown` required; function-style tests), `query` (sql; `setup_sql` required; tests `{name, expect_table:{columns, rows}}`), `build` (html; DOM-selector tests or purely visual -> downgraded to self). All carry `instructions_markdown`, `starter_code`, `tests` (2-5, one edge case), optional `hints` (1-3, revealed one at a time). Code runs in a browser WebAssembly sandbox (`app/sandbox/runner.worker.ts`), never on the server.

### 2.2 Submitting an attempt — `POST /api/assessments/{assessment}/attempt`

Body: `{ "response": {...}, "async"?: bool }`. 201 Created.

Canonical response shapes, validated **per kind** in `SubmitAttemptRequest`:

| kind | shape | limits |
|---|---|---|
| mcq | `{"option_id":"b"}` | must be one of the declared option ids (only enforced when options exist) |
| multi_select | `{"option_ids":["a","c"]}` | `present` (empty list allowed), max 50 |
| cloze | `{"blanks":["mitochondria","atp"]}` or `{"text":"..."}` | max 50 blanks, 2000 chars each |
| short_answer | `{"text"}` | 1-5000 chars |
| essay | `{"text"}` | 1-40000 chars |
| project | `{"text"?, "deliverables"?:[...], "links"?:[url...], "notes"?}` | text required unless links/deliverables; 50 deliverables, 20 links (must be URLs) |
| ordering | `{"order":[ids]}` | distinct, each a declared option id, max 50 |
| numeric | `{"value":"13,04"}` | **string** (so comma-decimal keyboards survive), max 80 |
| code | `{"code", "language"?, "tests":[{name, passed, error?, detail?, expected?, received?}], "console"?:[...], "timed_out"?, "duration_ms"?}` | code max 100000; tests max 200; error/detail max 5000; console max 500 lines |
| any kind with grader `self` | `{"completed"?: bool, "note"?: string<=5000}` (+ `code`, `language` for code kind so the work is archived) | |

Shorthand promotion (`prepareForValidation`): a bare list becomes `option_ids` / `blanks` / `order`; a bare string becomes `option_id` (mcq), `value` (numeric), `text` (cloze), `{code, tests:[]}` (code), else `text`.

Friendly validation messages (port verbatim): "Choose one of the options before submitting.", "That option is not part of this question.", "Write your answer before submitting.", "Fill in the blanks, or send your answer as text.", "Describe what you built, or attach a deliverable or a link.", "Your code came through empty.", "Send the test results reported by the in-browser runner.", "Arrange the steps before submitting.", "Each step can only appear once in the sequence.", "Enter a number before submitting."

**AttemptService::submit flow**:
1. Resolve grader via `GraderRegistry::for(assessment)`.
2. **Write the attempt row before grading** with `grader_meta = {status:'grading', grader, assessment_kind}` (crash mid-grade leaves a recoverable ungraded attempt; no DB transaction held across the LLM call).
3. If `async && grader == llm_rubric`: set status `queued`, dispatch `GradeAttemptJob`, sync progress, return.
4. Else grade synchronously (rubric too: "a learner who just submitted an essay should be reading their feedback a moment later").
5. On `LlmException`: `deferAfterFailure` -> score/passed/feedback/criterion_scores null, `grader_meta.status = 'queued'` (if a real queue exists) or `'pending'`, `reason:'grader_unavailable'`, `error`, `retry_queued`; dispatch the job if queued.
6. `grade()` fills `score, passed, feedback, criterion_scores, grader_meta` (+ `graded_at`, `grader`, `assessment_kind`; plus `configured_grader` + `grader_substituted:true` if the registry fell back).
7. `syncProgress` -> `NodeProgressUpdater::syncAfterAttempt`.

Response = `AttemptResource` plus `meta: { node: NodeResource (with refreshed progress), assessments_total, assessments_passed, node_completed }` so the player can close the lesson without a second round trip.

**AttemptResource** fields: `id, assessment_id, user_id, status, response (LeakGuard-scrubbed), score, max_score, passed, feedback, criterion_scores (scrubbed), grader_meta (scrubbed), assessment, created_at, updated_at`. `status` is derived: one of `graded|pending|queued|failed` (`grading` is reported as `pending`); fallback = graded if score or passed set, else pending.

`GET /api/assessments/{assessment}/attempts` -> learner's last 100 attempts newest first + `meta {assessment, count, best_score, passed (any attempt passed), last_attempt_at}`.

**GradeAttemptJob**: tries 3, timeout 1200 s (must exceed request_timeout 300 x max_attempts 3), backoff [10, 30, 90]. Idempotent: skips if `grader_meta.status === 'graded'` unless `force`. `failed()` sets `status:'failed', reason:'grader_unavailable', retry_queued:false` and keeps the submission.

### 2.3 Grader registry and pass policy

- `GraderRegistry::for()`: use the configured grader if it `supports(kind)`; otherwise fall back to `kind.defaultGrader()`; if that also cannot, use `SelfGrader`. Substitution is recorded in grader_meta.
- `GradingPolicy::PASS_PERCENT = 70`. `passMark(max) = ceil(max * 0.70)`; `passes(score,max) = score >= passMark`; `scoreFromRatio(r,max) = round(clamp(r,0,1) * max)`.
- `GradeResult::scored()` clamps to [0,max], derives `passed`, adds `status:'graded'`. `GradeResult::pending(reason)` -> null score/passed, `status:'pending'`.
- AssessmentResource exposes `pass_score = passMark(max_score)` and `graded_automatically = grader != 'self'`.

### 2.4 DeterministicGrader — exact algorithms

All feedback/meta must never reveal the key (counts fine; ids/accepted strings not).

**Answer-key aliases** (models are inconsistent): mcq/multi `correct_option_ids, correct_option_id, option_ids, option_id, correct, accepted, values, value, ids, id, answer, answers`; last resort = options flagged `correct:true` / `is_correct:true`. Cloze: `blanks` (list of `{accepted:[...]}` | list of lists | list of strings) else single `accepted, answers, correct, value, values, text, answer`. Ordering: `correct_order, order, sequence, correct_option_ids, correct, answer, values` (must be >1 unique ids; duplicates make the key unusable). Numeric: `value | answer | expected`, `tolerance`, `tolerance_pct | tolerance_percent`, `unit`.

Response aliases: mcq `option_id, selected, value, answer, choice`; multi `option_ids, selected, values, answers, choices`; cloze positional `blanks, answers, values` then single `text, answer, value`; ordering `order, option_ids, sequence, values, answers`; numeric `value, answer, text, number`; code tests under `tests | results` with pass flag `passed | pass | ok`.

| kind | rule id | algorithm | feedback |
|---|---|---|---|
| mcq | `exact_option_id` | all-or-nothing | "Correct." / "Not quite. Re-read the lesson section this question came from, then try again — the wording of the options matters here." |
| multi_select | `jaccard_partial_credit` | ratio = \|sel ∩ exp\| / \|sel ∪ exp\| (empty union = 1.0); over-selecting costs marks | All right: "Correct — you found every option that applies and included none that do not." Else "You identified X of the Y options that apply." + "N is/are still missing." + "You also selected N option(s) that do(es) not belong — partial credit is the overlap between your set and the correct set, so over-selecting costs marks." |
| cloze | `normalised_string_match` | per blank, positional (duplicated answers both count); ratio = correct/total | single: "Correct." / "That is not one of the accepted answers. Spelling, spacing, capitalisation and punctuation are all ignored, so check the term itself rather than its formatting." multi: "Correct — all N blanks match an accepted answer." / "X of N blanks are right. Blank(s) 2, 3 did not match..." |
| ordering | `consecutive_pair_order` | map given ids to expected rank (unknown ids dropped); pairs = len(ranked)-1; correctPairs = count of ranked[i] < ranked[i+1]; coverage = len(ranked)/len(expected); ratio = (correctPairs/pairs) * coverage; perfect -> 1.0. Meta also counts `items_in_exact_place`. | "Only X of the Y steps were placed, so this cannot score full marks..." / "Correct — the whole sequence is in the right order." / "X of the Y consecutive pairs are in the right relative order. Work out which step cannot happen until another one is finished, and move that pair first." Empty: "Nothing was submitted for this ordering item." |
| numeric | `numeric_tolerance` | tolerance = `tolerance` or `abs(value)*pct/100`; floor = max(tol, abs(value)*1e-9, 1e-9) so 0.1+0.2 == 0.3; correct iff abs(given-expected) <= tol; all-or-nothing | "Correct." / "That is too high/low. Re-check the units (the answer is expected in A) and the order of operations — an answer off by a factor of ten is almost always a unit conversion, and an answer off by a little is usually a rounding step taken too early." Meta `direction: exact|too_high|too_low` (never the value or signed delta). Unparseable: "That could not be read as a number. Enter digits only — units and words are not needed." |
| code | `declared_test_results` | declared test names come from `answer_key.tests` else the parent block payload `tests` (name = `name` / `call` / `"test N"`); ratio = passed/declared; a declared test missing from the report counts as failed; extras reported as `tests_unrecognised` | "All N test(s) passed." / "X of N tests passed. Still failing: "a", "b" (+N more). Run them again after each change — the first failing test is usually the one worth fixing." Timeout with 0 passed: "Your code ran past the time limit and was stopped, so no test could complete. Look for a loop that never ends or a recursive call with no base case." |

**Tolerant number parser** (`number()`): strip NBSP, narrow NBSP, thin space, space, apostrophe; the LAST of `,`/`.` is the decimal separator (`1.234,56` and `1,234.56` both work); then regex `-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?` (trailing units ignored); reject NaN/Inf.

**Code with no declared checks** (`uncheckedSubmission`): returns `score:null, passed:true` recorded as self-assessed (`rule:no_declared_checks`, `downgraded_from:'deterministic'`, `scored:false`) with feedback "There is nothing here that can be checked automatically, so this counts as done when you say it is. Read your work back against what the exercise asked for before you move on." (Otherwise a node could never complete.)

**Code meta** (honesty labels): `source:'client_worker', executed_by:'browser_web_worker', backend_executed:false, trusted_client_report:true, timed_out`, note "The backend does not execute untrusted learner code. These results were reported by the sandboxed client-side Web Worker and are trusted as-is for the MVP."

**Missing key**: `GradeResult::pending('This item has no answer key, so it cannot be auto-graded.')`.

**AnswerNormaliser** (cloze + feedback audit): (1) remove apostrophes/quote marks `' ‘ ’ “ ” " \`` entirely (`don't` == `dont`), (2) every other `\p{P}\p{S}` run -> single space, (3) collapse whitespace, trim, (4) lowercase. Deliberately NO accent stripping and NO stemming ("résumé" != "resume"). `keywords(text, minLen=5)` = unique normalised words >= minLen chars.

### 2.5 LlmRubricGrader (short_answer, essay, project)

1. Build submission text: first non-empty of `text, answer, body, markdown, submission`; for projects append "Deliverables the learner reports completing:\n- ..." and "Links submitted:\n- ..."; append "Learner's notes:\n..." (or notes alone). Truncate at 40,000 chars on word boundary.
2. **Empty submission -> no LLM call**: score 0, feedback "There was nothing to grade — your submission came through empty. Write your answer out in full and submit it again; even a partial attempt gives you something to build on.", meta `llm_called:false, reason:'empty_submission'`.
3. Normalise rubric: name from `criterion|name|title`; weight from `weight|points` (non-numeric or <=0 -> 1.0); descriptors from aliases (`excellent|exemplary|strong|high`, `acceptable|adequate|satisfactory|medium`, `poor|weak|insufficient|low`). Empty -> **default rubric**: Accuracy 0.5 ("Every claim in the {answer|deliverable} is correct and the reasoning holds up." / "Mostly correct, with a minor slip that does not undermine the conclusion." / "Contains a factual or logical error at the centre of the task."), Completeness 0.3, Clarity 0.2 (descriptors in source).
4. LLM call: `stage = grade`, tier `flash` (cheap model), JSON schema mode, system = `RubricGradePrompt::system(course.language)`, user = `user(assessment, rubric, submission, courseTitle, nodeTitle)`. Cost metered against course/node (`generation_runs`).
5. **FeedbackAudit**; if not acceptable, ONE re-ask with `retryUser()` that includes the rejected draft ("REJECTED DRAFT — DO NOT REPEAT IT").
6. **Score computed server-side**: match returned `criterion_scores` by normalised criterion name, falling back to same index; missing criteria score 0 (listed as `unmatched_criteria`); weighted = sum(weight/totalWeight * clamp(score_0_to_1)); final = `scoreFromRatio(weighted, max_score)`. The model's own `score`/`passed` are recorded (`model_reported_score/passed`) but **never used**.
7. Per-criterion output stored in `criterion_scores`: `{criterion, weight, score_0_to_1 (3dp), points (1dp), max_points (1dp), comment|null}`.
8. Meta: `source:'llm_rubric', prompt_version:'grade.rubric.v1', tier:'flash', llm_called:true, scoring:'weighted_criterion_scores', criteria_count, rubric_source:'default'|'assessment', unmatched_criteria, model_reported_score, model_reported_passed, feedback_quality ('quotes_submission'|'specific'|'too_short'|'generic'), feedback_reasked`.

**RubricGradePrompt** (port intent faithfully):
- System persona: "an exacting but generous teacher... not a cheerleader and not a gatekeeper". Grade ONLY against given criteria. Score mapping: 1.0 = excellent, 0.7 = acceptable, 0.3 = partial, 0.0 = absent/wrong; in-between allowed; "a rubric where every criterion scores 0.9 is a rubric you did not apply". Never reward intent/effort/formatting; factual errors over style.
- Feedback rules: every comment references what the learner actually wrote; overall feedback must quote at least one phrase verbatim in double quotes; then right / wrong / ONE concrete next step; "if you could paste your feedback under a different learner's submission... rewrite it". Banned phrases: "Great job!", "Good effort!", "Well done!", "Nice work!", "You did a good job of explaining the topic.", "This is a solid answer.", "Keep up the good work.", "You could add more detail.". Address as "you", 2-6 sentences. Empty/off-topic/refusal -> 0. Write in the course language; keep criterion names verbatim.
- User message layout: `Course: / Lesson: / Item type:` header; `===== THE TASK THE LEARNER WAS SET =====`; `===== RUBRIC (grade against exactly these, and only these) =====` numbered `N. criterion (weight W)` + `- Excellent/Acceptable/Poor:` lines; `===== THE LEARNER'S SUBMISSION (N words) =====` ... `===== END OF SUBMISSION =====`; closing instruction to return one entry per criterion in order and quote a phrase.
- JSON schema: `{criterion_scores: [{criterion (minLength 2), score_0_to_1 (0..1), comment (minLength 25)}] (1..12), score: int 0..100, passed: bool, feedback: string minLength 80}`, all required.
- Note: the rubric's `reference_answer` in answer_key is NOT currently passed to the grader prompt (generation says "for the grader's eyes only", but `RubricGradePrompt::user` never reads answer_key). Port should fix this (see section 6).

**FeedbackAudit::isAcceptable(feedback, submission)**: false if length < 60; false if it matches a generic pattern (whole feedback is one praise sentence starting great/good/nice/excellent/fantastic/awesome/well done/solid; starts with "keep (it) up / keep going / good luck"; "your/this/the answer is good/great/fine/correct/solid/acceptable."); then true if any quoted phrase (`"..."`, `“...”`, `‘...’`, `«...»`, 3-240 chars) appears in the normalised submission; else true if >= 2 distinctive submission keywords (>=5 chars; fall back to >=3 chars for short submissions) appear in the normalised feedback.

### 2.6 SelfGrader

Supports every kind. Returns `score:null, passed:true`. Note looked up in `note|notes|text|reflection|comment`. Feedback: "Marked complete by you. Nothing was auto-graded here — revisit it later if you want to check yourself again." or "Marked complete by you, with your note kept on the attempt: "<note, 240 chars>"". Meta `source:'self_report', scored:false, has_note`.

### 2.7 LeakGuard (answer-key firewall)

Every free-form JSON reaching the client (block payloads, rubrics, grader_meta, echoed response, criterion_scores) is recursively scrubbed of keys (after snake_case + lowercase, also with underscores removed): `answer_key(s), answerkey, accepted_answers, correct_answer(s), correct_option(s), correct_option_id(s), expected_answer(s), grading_hints, grading_notes, internal_notes, marking_scheme, model_answer, reference_answer, rubric_hints, sample_answer, solution(s), teacher_notes`. AssessmentResource additionally rebuilds `options` as `{id,text}` only (strips `correct:true`), reduces `rubric` to `{criterion, weight}` (level descriptors are grading hints and stay hidden), and exposes only `input_hint {kind:'numeric', unit}` from the key.

### 2.8 Progress tracking — `NodeProgressUpdater` + `POST /api/nodes/{node}/progress`

Table `progress`: `user_id, node_id (unique pair), state (available|in_progress|completed|skipped), time_spent_seconds, completed_at, last_seen_at`.

ProgressState labels: `Not started`, `In progress`, `Completed`, `Skipped`. `isSettled()` = completed or skipped (scheduler stops offering it; map stops counting it against the learner). Skipped is roadmap.sh's fourth state: "not completion — nothing was learned — but not pending either".

- `syncAfterAttempt(node,user)`: available -> in_progress on first attempt; `last_seen_at = now`; if every **live** assessment has >= 1 passing attempt -> completed (`completed_at ??= now`) and seed SM-2 review. **Never un-completes** (re-failing a passed item keeps the node completed).
- `completionStats`: `{total (live assessments), passed (distinct assessments with any passed attempt), attempted}`.
- `apply(node,user,state?,addSeconds?)` (explicit endpoint): body `{state?, time_spent_seconds?}`; `time_spent_seconds` is a **delta** per ping (0..86400 per call, "a runaway timer in a background tab cannot poison stats"); state transitions recorded verbatim (`completed_at` set when completed, cleared otherwise); time on an available node with no state moves it to in_progress; first completion seeds review. Response `{data:{node_id, state, time_spent_seconds, completed_at, last_seen_at}}`.
- Review seeding failures are swallowed and logged (never break the progress write).

### 2.9 Spaced repetition — `ReviewScheduler` (SM-2, node-level)

Unit of review = a **completed node (lesson)**, not individual flashcards. Table `review_items`: `user_id, course_id, node_id (unique user+node), ease_factor float default 2.5, interval_days int 0, repetitions int 0, lapses int 0, state new|learning|review, due_on date?, last_reviewed_at`.

- **Seed** (`seedFromCompletion`): on first completion create `state:new, ease 2.5, interval 0, reps 0, lapses 0, due_on = tomorrow` (user TZ). Idempotent (firstOrCreate) — re-finishing never resets an earned schedule.
- **Review** (`reviewNode(user,node,quality 0..5)`), clamp quality:
  - pass (q >= 3): `repetitions++`; `interval = 1` if reps==1, `6` if reps==2, else `max(1, round(interval * ease))`; `state = review`.
  - lapse (q < 3): `repetitions = 0`, `interval = 1`, `lapses++`, `state = learning`.
  - `ease = max(1.3, ease + 0.1 - (5-q)*(0.08 + (5-q)*0.02))` (no ceiling).
  - `due_on = today + interval`, `last_reviewed_at = now`.
  - Reviewing a never-seeded node creates the item on the spot (`due_on null` before update).
- **Due queue** (`dueFor`): `due_on <= today`, course on shelf (not archived/trashed — items survive archive so un-archiving restores the schedule), eager-loads node.course.user, ordered `due_on, id` (oldest debt first).
- Review is never plan-gated.

Endpoints:
- `GET /api/reviews/today` -> `{data: ReviewItemResource[], meta:{date, due, minutes (sum of node.estimated_minutes)}}`.
- `POST /api/reviews` `{node_id, quality?: 0..5 | correct?: bool}` (one required; `correct:true` -> 5, `false` -> 2) -> `{data: item, meta:{quality, next_due_on, interval_days, remaining_due}}`.
- `GET /api/reviews/stats` -> `{date, total, due, due_today, overdue, upcoming, learning, mastering (state=review), streak:{current, active_today, last_reviewed_on}}`. Review streak = consecutive days (in user TZ) with any `last_reviewed_at`, counting from today if active today else from yesterday. Caveat: only the LAST review per item is stored, so the streak calendar under-counts history (port should keep a review log).

ReviewItemResource: `id, user_id, course_id, node_id, state, ease_factor (2dp), interval_days, repetitions, lapses, due_on, is_due, is_overdue, days_late, days_until, last_reviewed_at, node {id, course_id, key, title, summary, layer, position, estimated_minutes, status, status_label}, course {id, slug, path, title, language, status, status_label}`.

### 2.10 Study plan — `ScheduleBuilder` (SPEC §6)

Design goal (verbatim intent): "the schedule survives contact with a human: you miss a Wednesday, you skip a lesson you already know, you drag something to Saturday — and the plan quietly re-flows around you instead of falling apart."

Tables: `schedules {course_id, user_id, starts_on date, minutes_per_week int, days_of_week json [1..7 ISO, 1=Mon], status active|paused|completed}`; `schedule_items {schedule_id, node_id, scheduled_for date, estimated_minutes int default 15, state pending|done|skipped|moved}`.

- `minutesPerSession() = max(1, floor(minutes_per_week / max(1, count(days_of_week))))`.
- `normaliseDays()`: dedupe + sort; empty means "any day" (ALL_DAYS) rather than never.
- `todayFor(user)`: start of day in `user.timezone` (fallback app TZ, then UTC). All overdue/due/streak math uses this.
- `ScheduleItemState.isOpen()` = pending or moved.

**Topological order** (`topologicalOrder(course)`): Kahn's algorithm over `prerequisite` edges (self-loops, unknown nodes, duplicate edges ignored); ties broken by `(layer, position, id)` so the order matches the map. **Cycle-safe**: if no node has in-degree 0, force-emit the lowest-ranked remaining node; always terminates in N iterations.

**layout(schedule, replanOverdue)** — shared by `build` and `recompact`:
1. anchor = max(starts_on, today).
2. For each node in topo order: if an item exists and it is NOT pending (done/skipped/moved), or (during recompact) it is pending but overdue (date < anchor) -> **fixed**: keep its date; if not skipped and date >= anchor, its minutes count toward that day's `used` budget; if still open it "blocks" dependents. Otherwise it becomes a planning unit `{node_id, minutes = max(1, node.estimated_minutes), order_key = item.id}`. Nodes without an item (added after build) become units with `order_key = INT_MAX`.
3. `plan()`: for each unit, earliest = anchor; for each prerequisite that is dated and blocking: bound = prereq date, +1 day if the prereq's order_key > unit's order_key (same day allowed only if the prereq sorts first, since the API sorts by date then id); earliest = max. Then `firstFittingSession(earliest)`: walk allowed weekdays forward; accept the first day where `used == 0` (an empty session always accepts, so oversized nodes get a day to themselves; nodes are never split) or `used + minutes <= budget`. Hard bound 3650 days.
4. Persist: update existing items' `scheduled_for` + `estimated_minutes`, create new items `pending`.
5. `syncStatus`: paused is left alone; if items exist and none open -> `completed`, else `active`.

- `build()` = full plan with `replanOverdue:true` (overdue pending work is pulled forward to today+). Idempotent: preserves done/skipped/moved.
- `recompact()` = `syncFromProgress` then layout with `replanOverdue:false`: future pending items re-pack earlier into freed space; **overdue pending items stay put as visible debt** ("a missed day stays visible as debt on the Today screen instead of silently vanishing"). Moved items are pins/anchors.
- `syncFromProgress()`: any pending/moved item whose node has a `completed` progress row is marked `done` (player completion closes the schedule loop).

Invariants: dates only on allowed weekdays, never before anchor; never before a prerequisite; a session never exceeds budget unless it holds exactly one node; no node split; cycles cannot hang.

**Endpoints**:
- `POST /api/courses/{course}/schedule` `{starts_on (date <= now+5y), minutes_per_week (10..10080), days_of_week (1..7 distinct, 1-7 items; strings like "1" accepted)}` -> creates (201) or re-plans (200). Re-planning a completed schedule sets it active again. Writes `course.minutes_per_week` too. Builds synchronously (`BuildScheduleJob::dispatchSync`). Validation copy: "Study days are ISO weekdays: 1 (Monday) through 7 (Sunday).", "A week of study needs at least 10 minutes in it."
- `GET /api/courses/{course}/schedule` -> 404 `{message:'This course has no schedule yet.'}` or ScheduleResource. **Self-healing on read**: if the course has nodes with no item (late outline, regeneration), run `build()` first.
- `PATCH /api/schedule-items/{item}` `{state?, scheduled_for?}` (at least one; both = "I did it, but on Saturday"). A new date on an open item with no explicit state -> state `moved` (a pin). After saving: `syncProgress` (done -> progress completed (keeps earliest completed_at); reopening (pending/moved) a node whose progress was completed -> progress back to in_progress, completed_at null, otherwise reconciliation would re-tick it), then `recompact()`. Response `{data: ScheduleItemResource, meta:{schedule: ScheduleResource with items}}`.
- Schedule lookup prefers active, then paused, then newest.
- `BuildScheduleJob`: tries 3, timeout 120, backoff [10,30,90]; for async builds when an outline lands later.

ScheduleResource: `id, course_id, user_id, starts_on, minutes_per_week, minutes_per_session, days_of_week, days_of_week_labels (Mon..Sun), sessions_per_week, status, is_active, stats{total, pending, moved, done, skipped, open, minutes_total, minutes_done, minutes_remaining, percent (resolved=done+skipped / total), first_scheduled_for, last_scheduled_for, next_scheduled_for (earliest open item >= today)}, first/last/next_scheduled_for, items[], course{}`.

ScheduleItemResource: `id, schedule_id, node_id, course_id, scheduled_for, weekday, estimated_minutes, state, state_label, is_open, is_today, is_overdue (open && date<today), days_late, days_until, node{... + is_expanded + progress{state, time_spent_seconds, completed_at, last_seen_at}}, course{id, slug, path, title, language, status, status_label}`.

### 2.11 Today — `GET /api/today` (the home screen payload)

Computed across all **active** schedules whose course is on the shelf (not archived/trashed). It reconciles (`syncFromProgress`) but deliberately **does not recompact** ("opening the app must never quietly move an overdue lesson out of sight"); dates re-flow only when the learner acts or at the 08:00 digest.

Item set (one query): every open item of any date + every item scheduled this ISO week (Mon-Sun) + every item done since today's start.

Response `data`:
- `date, weekday, timezone, user{id,name}`
- `summary{due_today, due_today_minutes, overdue, overdue_minutes, upcoming, completed_today, completed_today_minutes, active_courses, is_study_day (today in union of all schedules' days), all_clear (no due + no overdue), has_schedule}`
- `streak{current, longest, active_today, last_completed_on, days:[14 x {date, weekday, completed (count), is_today}]}` — completion streak: a day counts if >= 1 distinct node completed that day (progress.completed_at, plus done schedule items without a progress-dated completion, deduped per node). Tolerant: yesterday's streak is still alive this morning. `longest` = longest consecutive run ever.
- `due_today[], overdue[], completed_today[]` (ScheduleItemResource; completed-today uses progress.completed_at ?? item.updated_at)
- `next_up` = first due-today item else first upcoming.
- `continue` = most recently touched node with progress not completed/skipped and `last_seen_at` set -> `{reason:'in_progress', node, course, state, time_spent_seconds, last_seen_at}`; fallback next scheduled -> `{reason:'next_scheduled', ..., state:'available'}`; else null.
- `courses[]` per active schedule: `{id, title, language, level, status, status_label, nodes_total, nodes_ready, nodes_completed, nodes_in_progress, minutes_total, minutes_completed, time_spent_seconds, percent (completed/total nodes), schedule{id, status, starts_on, minutes_per_week, minutes_per_session, days_of_week, items_total, items_done, items_skipped, items_open, minutes_remaining, percent, next_scheduled_for, finishes_on (max scheduled date)}}`
- `week{starts_on, ends_on, planned_minutes, completed_minutes, days:[7 x {date, weekday, items, done, minutes, is_today, is_past}]}`
- `notifications{unread, latest{id,type,title,is_read,created_at}|null}`

### 2.12 Daily digest — `DailyDigestJob` (08:00, `withoutOverlapping`)

Per user (one user's failure never stops the rest): load active on-shelf schedules; **recompact each**; collect open items with `scheduled_for <= today`; if none -> **write nothing** (silent on rest days). Rows: `{schedule_item_id, schedule_id, node_id, course_id, course_title, title, estimated_minutes, scheduled_for, days_late}`.

- Title: no due rows -> "Catch up: N lesson(s) waiting for you"; else "Today's plan: N lesson(s) · M min" + " (+K overdue)" (max 200 chars).
- Body: one line per due item `- Title — Course (15 min)`; then blank line + "Still open: K lesson(s), up to D day(s) late." + up to 5 overdue lines.
- Payload: `{date, due_count, due_minutes, overdue_count, max_days_late, course_ids, schedule_item_ids, items}`.
- **Idempotent per day**: if a `daily_digest` notification with `payload.date == today` exists (looked up in the last 3 days), rewrite it instead of adding a row.
- Note: the schedule runs at 08:00 in the APP timezone, not per-user local time (port fix: run per local morning).

Notifications API: `GET /api/notifications?limit=30(max 100)&unread_only=` -> unread first then newest, each `{id, type, title, body, payload, is_read, read_at, created_at, created_at_human}`, meta `{unread_count, total, limit}`; `POST /api/notifications/{id}/read` idempotent. In-app only (no mail). Types also written by the generation pipeline.

### 2.13 Generation-time sanitisation that the grader relies on (`NodeExpander`)

(Generation itself is another slice; these are the rules that keep grading sound.)
- `normaliseAssessment`: unknown kind or empty prompt -> dropped; kinds with options need >= 2 options; grader from model else kind default; **llm_rubric without a rubric -> self**; **deterministic without a usable answer key -> llm_rubric if a rubric exists else self**; `max_score` clamped 1..100 (default 100); bloom defaults to `understand`.
- MCQ cap: `allowed = max(1, floor(total * 0.40))`; later MCQs beyond the cap are demoted to short_answer (`demoteToShortAnswer`), keeping the first (usually best-written).
- `reconcileCodeAssessments`: the code item's `answer_key.tests` is **derived from `payload.tests[].name`** (model's own list discarded — exact string match between what the browser reports and what the grader expects); no named tests -> self; a code item downgraded only because the key was missing is re-promoted to deterministic.
- Recall-only lesson -> repair call for 1-2 higher-order items (failure is logged; lesson kept).
- Player steer chip "harder practice": regenerate with "Add a harder assessment that makes me apply this, not recall it."

---

## 5. Frontend (Nuxt) — pages and components that drive the loop

### 5.1 Today (`pages/today.vue`, route `/`)

Philosophy (port it): "It answers one question: what should I do right now." A previous version opened on "Overdue 5" in red with "5 DAYS LATE" badges — "a debt-collection screen". Falling behind is the normal state of adult self-study, so lateness is a quiet count with one bulk fix.

Layout and behaviour:
- Header: title "Today", eyebrow = time-of-day greeting (`<5h` "Still up", `<12` "Good morning", `<18` "Good afternoon", else "Good evening"); streak pill "N-day streak" (flame icon, tooltip "Days in a row with a lesson finished") when `streak.current > 0`; activity bell (compact on mobile).
- Subtitle precedence: "N lessons planned · about X" | drafts exist "Nothing scheduled yet — finish setting up your course below." | unplanned course "Nothing scheduled — pick up where you left off." | next item "Nothing due today — next lesson <day>." | "Nothing scheduled. A good day to start something."
- `CourseDraftsStrip` (half-set-up courses) above everything.
- States: error ("Today can't load right now" + Try again), loading skeletons, brand-new learner (big "What do you want to learn?" + PromptComposer "Plan my course" + suggestion chips), the day.
- The day: (1) "Learn something new" composer card ("Planning is free"); `?topic=` prefill from `/learn/{slug}`; pending landing-page prompt is flown in and auto-run. (2) **Continue hero card** (dark): "Pick up where you left off" / "Start here", node title, course title, "Resume"/"Start" button + minutes. Client fallback: if API `continue` is null use first plan item. (3) **Behind strip** (amber, only if overdue): "N lessons from earlier — nothing is lost, the plan just waits for you." + button **"Move them to today"** (bulk: PATCH every overdue item `scheduled_for = today` in parallel via `Promise.allSettled`; success toast "Back on track — N lessons moved to today. Do what you can — the rest will spread out again."; partial failure toast "Some lessons did not move"). (4) **ReviewDueCard** if reviews due (loaded client-side after paint, never blocks). (5) **"Your plan"** = overdue first then due today (one ordered list); "N lessons done today" on the right. Each row: numbered circle (filled accent once the lesson was opened = in_progress), title, course title only where it changes from the previous row (sr-only otherwise), minutes + "· planned for <day>" if late; desktop inline check button "Mark as done"; overflow menu: Mark as done, Move to today (late only), Skip this one (destructive). Mark done is optimistic, toast "Done — <title>. The rest of the plan moved up to close the gap." with **Undo** (PATCH back to pending). Skip toast "Skipped — The rest of the plan shifted to fill the gap." Empty states: unplanned course card "Give your course a weekly rhythm" -> "Plan my week" (`<courseUrl>?panel=plan`); "That's today done" / "Nothing scheduled today". Footer line "Next up <day> · <title>". (6) Aside "Your courses": up to 6 active courses with progress ring + `courseProgressLine`, "See all" -> /library; an unplanned-but-started course shows "No weekly plan yet".
- Lessons open inside the course workspace (`nodeUrl(course, node)`); no standalone player route.

### 5.2 Review (`pages/review.vue`, route `/review`) + `components/review/*` + `composables/useReviews.ts`

- Learner never sees "SRS", "due items", "quality", "ease factor". Four honest buttons.
- **Recall mapping** (`RECALL_QUALITY`): Again -> 1 ("Blanked on it"), Hard -> 3 ("Came back slowly"), Good -> 4 ("Remembered it", emphasised dark default), Easy -> 5 ("Knew it cold"). Colours: coral / amber / ink / lime. 2x2 grid on phone, 4 across on desktop. Row locks while a grade is in flight; pressed button keeps a spinner, others dim to 45%.
- Page: header "Review", eyebrow "Keep it fresh", back to `/`, subtitle "N lessons to bring back". Queue fixed at page load (new due items never shove into a session). Thin progress bar (reviewed/total). One `ReviewCard` at a time: "2 of 6", "waited N days" if overdue, course title, node title, node summary (deliberately does NOT re-teach), "Open the lesson" link, prompt "How well did you remember this?". After the last card -> `ReviewDone`.
- `ReviewDone`: "All caught up" / "Nothing to review right now"; body "You brought back N lessons. That's the part that makes it last." / "Come back when a lesson is due — spacing the gaps is what makes it stick."; review streak pill "N days in a row"; "Back to today". No stats grid, no accuracy.
- Errors: "Reviews can't load right now" + Try again; grade save failure toast "That didn't save".
- `ReviewDueCard` on Today: "N lessons to review today", "A quick pass to keep earlier lessons from slipping. About X min.", Start -> /review.
- Weakness: the review is pure self-report on a lesson title + summary — no retrieval prompt, no question. See section 6.

### 5.3 Course Plan tab (`components/CourseScheduleTab.vue`, `components/workspace/PlanPanel.vue`, `composables/useSchedule.ts`)

- No plan (404) -> form "Step 1 · Put this course on a calendar": start date (default today), **Minutes a week** presets `[60, 120, 180, 300, 420]` + custom field (default = course.minutes_per_week if >= 10, else 150 in the tab / 240 in the PlanPanel), **Study days** M T W T F S S toggles (default Mon/Wed/Fri), live line "3× 50 min per session" (`max(5, round(mpw/days))`), button "Build my schedule". Errors: "Pick at least one study day." / "A study week needs at least 10 minutes in it." / "Choose a start date." Empty: "Nothing to schedule yet" until the outline exists. Success toast "Schedule built — N sessions on the calendar."
- With plan: summary "X of Y sessions done", "Mon · Wed · Fri · 50 min per session · 3 hr left", "N overdue" badge, "Next <day>", "Re-plan" (form becomes "Re-plan · Change the plan" / "Rebuild the plan"), "<total> of study planned". Filter segmented control All / Open / Done (done includes skipped), with counts. Items grouped by date (labels Today / Tomorrow / Yesterday / "Wed 14 Oct"; deterministic date math without Intl so SSR = client), per-day minutes. Row actions: done toggle ("Mark as done"/"Mark as not done"), "Move to another day" (date picker), "Push to tomorrow", "Skip this session"/"Un-skip". Toggling a state that is already set sends `pending` (each action toggles). State badge tones: pending neutral, done success, skipped warn, moved accent. PATCH response's `meta.schedule` replaces the whole schedule (instant recompaction feedback); on error refetch.
- PlanPanel (workspace sidebar variant): rows toned done / skipped / overdue ("Moved forward · was Nd ago", amber, never red) / today ("Today · 15 min") / pending; `slippage` reassurance banner: "One session slipped — no problem." / "N sessions slipped — no problem." + "Your plan shifted D days so you keep H hrs a week. Nothing was dropped."; `thisWeek` = done minutes vs weekly budget.
- Deep link `?panel=plan` opens this tab (desktop sidebar and mobile).

### 5.4 Progress marking in the workspace (roadmap/list/brief)

- `NodeBrief` marks: **Done** (completed), **Learning** (in_progress), **Skip** (skipped); each toggles back to `available` when pressed again.
- roadmap.sh gestures on the map/list: **right-click** toggles done, **shift-click** toggles learning, **alt-click** toggles skipped, plain click opens the brief. Optimistic repaint; revert + toast on failure; "Marked as done" toast with Undo (-> available).
- Visuals: completed = strikethrough faint; skipped = dashed border, ghost text, strikethrough; in_progress = accent text.
- Roadmap header: "N topics and M subtopics. Work down the line — you are on step K." + progress bar "P% · done/total". Counts `{topics, subtopics, total, done, learning, skipped, minutes}`. **Percent = completed / total — skipped still counts against the learner** (contradicts the enum's intent; fix in port).
- Player (`useNodePlayer`): time-on-task ticker every 1 s only while the browser tab is visible AND the node pane is foreground; ships a delta every `PING_SECONDS = 30` (`POST /nodes/{id}/progress {time_spent_seconds}`), on failure puts the seconds back; on `beforeunload`/`pagehide` uses `navigator.sendBeacon`; flush on unmount. "Mark complete" toggles completed <-> in_progress optimistically. When an attempt completes the node: toast "Lesson complete — Every assessment here has been passed."

### 5.5 Assessments UI (`components/assessments/*`)

`AssessmentItem.vue` (one item end to end):
- Header chips: question number circle (turns into a green check once any attempt passed), kind label (`Multiple choice`, `Select all that apply`, `Short answer`, `Fill the blanks`, `Essay`, `Project`, `Code`, `Put in order`, `Numeric answer`), grader chip in plain words: deterministic "Checked instantly", llm_rubric "Marked by AI" (accent), self "You mark it". "N attempts" counter. Card border turns success when passed.
- Prompt rendered as Markdown a step larger (cloze renders its own inline prompt).
- Component routing: `code` always -> CodeAssessment (even when self-graded, because the editor/fixture/preview IS the exercise); grader self -> SelfAssessment; else per kind; unknown -> ShortAnswer.
- Submit button labels: self "Mark done"; code "Submit results"; ordering first time "Check the order"; after an attempt "Submit again"; else "Submit". Disabled until `response !== null`; hint "Answer to enable submission." / code: "Write something to enable submission." (no tests) | "Check the page to enable submission." (build) | "Run it once to enable submission.".
- After submit: prepend attempt to history, show `AttemptResult`, emit `graded {assessmentId, attempt, assessmentsTotal, assessmentsPassed, nodeCompleted, nodeState}`. If status pending/queued: poll `GET /assessments/{id}/attempts` every 2.5 s up to 12 times.
- Retry: "Try again" (or "Try a different answer" when passed) re-opens the form; "Cancel" returns to the result; "best X/max" when >1 attempt.
- Read-only (shared course): question + lettered options + "Graded on <criteria>" only, never the form.
- Validation errors surface the first server message inline + toast "Submission failed".

`AttemptResult.vue` ("Never returns a bare score"):
- Headline: "Grading…" (spinner) for pending/queued, "Grading failed", "Recorded" (passed null), "Passed", "Not yet". Tones success/danger/neutral.
- Score line "S / M · pass mark P" + progress ring only when meaningful: rubric/self graders, or deterministic partial credit (0 < S < M). Self: "Recorded without a score."
- Feedback paragraph (pre-line).
- Rubric breakdown: per criterion name, "· weight W" (from the public rubric), percentage, coloured bar (>= 0.8 success, >= 0.5 warn, else danger), comment.
- Code results footnote (lock icon): "Scored from the test results your browser's sandbox reported — the server ran nothing."

Per-kind inputs:
- **MCQ**: radio-group of lettered (A, B, C...) option buttons; `{option_id}`. Empty options: "This question has no options — regenerate the lesson to repair it."
- **Multi-select**: checkbox buttons; `{option_ids}` (null when none ticked); footnote "More than one answer is correct. Partial credit is the overlap between your set and the right one, so a scattergun costs you."
- **Cloze**: prompt split on `_{3,}`; inline auto-width inputs (7-28ch) at each gap; Enter moves to the next blank then submits; no gap -> single field; `{blanks:[...]}` positional.
- **Ordering**: up/down buttons (deliberately not drag-and-drop: touch + keyboard accessibility); seeded with the scrambled option order which already counts as an answer (published on mount to avoid SSR hydration mismatch); `{order:[ids]}`.
- **Numeric**: `inputmode="decimal"` text input (not type=number, so "13,04" survives); unit suffix from `input_hint.unit`; `{value}` exactly as typed.
- **Short answer**: 4-row textarea, max 5000, placeholder "Answer in two to four sentences.", live word count.
- **Essay**: 10-row textarea, max 40000, placeholder "Write your answer. Aim for 200–400 words — argue a position and back it with specifics.", word counter coloured (<120 or >600 warn, else success) "· target 200–400", "Judged on N criteria".
- **Project**: textarea + deliverables checklist from the project block (tick off), up to 20 link fields (must match `^https?://\S+$`, broken ones flagged); sends only non-empty parts.
- **Self**: checkbox "I've done this. Record it as complete." + optional note "Optional note to your future self — what you did, what you'd change." (enabled only when ticked) + "Self-assessed: this is stored as an attempt with no score."

### 5.6 Code exercise UI and client-side grading (`CodeAssessment.vue`, `code/*`, `useCodeExercise.ts`, `sandbox/*`)

- `buildSpec()` reconciles any payload into `{mode, lang, language, checks, setup, tables (<=6, <=12 cols), requirements (<=6, build), symptomMarkdown (debug), hints (<=5), graded = checks.length > 0}`. **Language decides mode first**: html -> build, sql -> query; otherwise declared function/script/debug, else `script` iff any test has `stdin`, else `function`. Max 12 checks (8 script cases).
- Runtimes (browser WASM worker, `runner.worker.ts`): JavaScript = quickjs-emscripten (64 MB memory, ~4 s CPU interrupt); Python = Pyodide 0.27.2 from jsDelivr (~10 MB, lazy); SQL = sql.js 1.14.1 (~1.5 MB); HTML = parsed on the main thread with `DOMParser` (never executed for grading) + preview in `<iframe sandbox="allow-scripts">` (no allow-same-origin), 400 ms debounce. Limits: code 100 KB, stdout/stderr 100 KB each (truncated notice), wall-clock **5 s** timeout (main thread terminates the worker). Runtime warmed **on intent** (editor focus / run / focus mode), never on mount. `RuntimeState` explains the one-time download ("about 10 MB" / "about 1.5 MB").
- Check semantics: function/debug = evaluate `call` expression in the same VM after the code, `deepEqual` to `expect` (NaN==NaN; arrays ordered; objects key-set equal; Python dicts converted from Map); script = one worker run per case, stdin fed line by line, compare trimmed stdout exactly; a timeout stops the loop (remaining cases reported "not run — an earlier case timed out") but a crash continues to the next case; query = `setup_sql` then learner query, compare final result set: columns only if the test names them; cells normalised to strings (null sentinel, numbers via String, booleans 1/0, blobs `blob:N`, trimmed); rows compared as a sorted set unless `ordered:true`; build = `querySelectorAll(selector)` with `min_count` (default 1), optional `text_contains` (case-insensitive) and `attribute {name, value?}`; invalid selectors reported as such.
- Failure details: "expected 3 row(s) [...] · received ...", "expected stdout ... · received ...", "nothing in your page matches h1", "2 matched li, but 1 of 3 met the rest of the check".
- **Dirty-run rule**: editing marks the last run `stale` (results stay visible, submission blocked) — a graded exercise needs a fresh, non-aborted run behind the submission; ungraded needs only non-empty code.
- Attempt payload built from the run: `{code, language, tests:[{name, passed, error, detail, expected, received}], console (<=400 lines x 4000 chars, head kept, "…and N more lines"), timed_out, duration_ms}`; self-graded code adds `completed:true`.
- UX: `ExercisePane` one component for inline and full-screen focus mode (teleported; Esc twice: first leaves editor, second closes; Cmd/Ctrl+Enter runs); mode headers "Write the function" / "Write the program" / "Fix the bug" / "Write the query" / "Build the page"; output tabs by mode (script: Cases, Console; query: Tables, Result, Checks, Console; build: Preview, Checks, "Done when"; else Checks, Console); opens on the tab needed before a run, jumps to the verdict tab after a run; container-query split (not viewport). `CheckList` shows declared checks BEFORE running ("promise list"; script shows inputs but not expected output), icon + sr-only verdicts. Reset to starter with 8 s Undo. `HintTrail`: hints one at a time, never re-collapsible, **locked until an attempt** (one run or >= 20 non-whitespace chars past the starter): "Have a go first — run it once, or write a few lines. A hint read before the attempt replaces the attempt." No solution reveal exists. Draft autosave to **sessionStorage** (`bilimind:code:{assessmentId}`, 600 ms debounce; "Restored the code you had open in this tab." + "Use the starter instead"). "Open in sandbox" pops the exercise into a workspace sandbox tab. Footnote: "Your code runs in a sandboxed WebAssembly worker in this browser, with a 5s timeout — never on the server. The results above are what gets submitted." (variants for ungraded / build).

### 5.7 Exam and quiz containers, flashcards (blocks)

- `QuizBlock`: picks its assessments by `payload.assessment_ids` (fallback: `block_id`), optional intro, passed counter "k/n".
- `ExamBlock`: same machinery framed as a sitting — questions behind a **start gate**, optional countdown from `time_limit_minutes` ("N questions · M minutes suggested"); "the timer is a prompt, not a lock — it never throws away work". Opens automatically if any item was already attempted. Passed counter.
- `FlashcardsBlock` (in-lesson, NOT persisted, NOT connected to SM-2): flip, next/prev, Fisher-Yates shuffle, "got it / again" pass that re-queues missed cards, progress = known/total; keyboard: Space flips, arrows move, S shuffles.
- Scenario (branching choices with outcomes) and Reflection are ungraded practice.

### 5.8 Notifications bell (`components/shell/Activity.vue`)

Polls `GET /notifications` every 45 s (one shared poll however many bells are mounted); unread badge; open panel lists digest/course_ready/course_failed rows; mark read optimistically; "mark all read" (first 50 unread).

### 5.9 Public `/learn` roadmaps and marketing pages (context, not app features)

- `/learn` hub + `/learn/{subject}` (32 generated JSON roadmaps in `app/content/learn/*.json`, schema `{h1, titleTag, description, lead, hours, span, prerequisites, opening[], stages[{name, span, summary, topics[], proof}], paces[{hours, reality}], mistakes[{title, body}], checks[] (six self-tests easiest to hardest), faq[], subject, updated}`; components `learn/Path` (numbered spine of stages each with a "proof" test), `Paces` (same hours at 3 speeds + where a subject stops compounding), `Checks`, `Facts`, `Related`, `Cta` ("have the lessons written onto it" -> `/today?topic=` or `/start`).
- `/exam-prep`, `/study-plan-generator`, `/ai-quiz-generator` are SEO pages whose claims constrain the product: planning/scheduling/re-flow/spaced review are free and uncapped; **"There is no exam-date field that compresses the plan for you"** (the plan gives a finish date to compare against the exam); "nothing is marked overdue" (marketing) vs backend keeping overdue items as visible debt (inconsistency).

---

## 3. Data model summary (web)

| Table | Key columns | Notes |
|---|---|---|
| `assessments` | node_id, block_id?, kind, prompt, options[{id,text}], answer_key (hidden), rubric[{criterion,weight,excellent,acceptable,poor}], grader, max_score=100, position | position >= 1000 = retired |
| `attempts` | assessment_id, user_id, response json, score?, passed?, feedback?, criterion_scores?, grader_meta? | `grader_meta.status` in grading/queued/pending/graded/failed |
| `progress` | user_id+node_id unique, state available/in_progress/completed/skipped, time_spent_seconds, completed_at, last_seen_at | one row per learner per node |
| `review_items` | user_id+node_id unique, course_id, ease_factor 2.5, interval_days, repetitions, lapses, state new/learning/review, due_on, last_reviewed_at | SM-2, node-level; no review log table |
| `schedules` | course_id, user_id, starts_on, minutes_per_week, days_of_week[], status active/paused/completed | `paused` exists in data model but no endpoint sets it |
| `schedule_items` | schedule_id, node_id, scheduled_for, estimated_minutes=15, state pending/done/skipped/moved | ordered by (date, id) |
| `notifications` | user_id, type daily_digest/course_ready/course_failed, title, body, payload json, read_at | in-app only |
| `users.timezone` | default UTC | drives every "today" |
| `courses.minutes_per_week`, `courses.archived_at`, `courses.deleted_at` | | archived/trashed courses leave Today, digest and review queue |

Course-level progress summary (`CourseResource::progressSummary`): `{total, completed, in_progress, skipped, available, percent (completed/total)}`.

## 4. API surface (web) — learning loop

| Method + path | Body / query | Returns |
|---|---|---|
| `POST /api/assessments/{id}/attempt` | `{response, async?}` | 201 AttemptResource + `meta{node, assessments_total, assessments_passed, node_completed}` |
| `GET /api/assessments/{id}/attempts` | | last 100 attempts + `meta{assessment, count, best_score, passed, last_attempt_at}` |
| `POST /api/nodes/{id}/progress` | `{state?, time_spent_seconds? (delta 0..86400)}` | `{node_id, state, time_spent_seconds, completed_at, last_seen_at}` |
| `GET /api/reviews/today` | | ReviewItem[] + `meta{date, due, minutes}` |
| `GET /api/reviews/stats` | | `{date,total,due,due_today,overdue,upcoming,learning,mastering,streak{current,active_today,last_reviewed_on}}` |
| `POST /api/reviews` | `{node_id, quality 0..5 \| correct bool}` | ReviewItem + `meta{quality,next_due_on,interval_days,remaining_due}` |
| `POST /api/courses/{id}/schedule` | `{starts_on, minutes_per_week, days_of_week}` | 201/200 ScheduleResource (with items) |
| `GET /api/courses/{id}/schedule` | | ScheduleResource or 404 "This course has no schedule yet." |
| `PATCH /api/schedule-items/{id}` | `{state?, scheduled_for?}` | ScheduleItemResource + `meta.schedule` |
| `GET /api/today` | | see 2.11 |
| `GET /api/notifications` | `limit, unread_only` | list + `meta{unread_count,total,limit}` |
| `POST /api/notifications/{id}/read` | | notification + `meta.unread_count` |

All are `auth:sanctum` + `throttle:api`; ownership enforced by 404 (never 403). Scheduling, reminders and review are never plan-gated.

Test coverage to port as golden cases: `tests/Feature/Grading/{DeterministicGradingTest, RubricGradingTest, SelfGradingTest, NodeProgressTest, AnswerKeyLeakTest}.php`, `tests/Unit/OrderingAndNumericGradingTest.php`, `tests/Feature/{ScheduleBuilderTest, ScheduleRecompactionTest, ScheduleApiTest, TodayViewTest, DailyDigestTest}.php`. **There are no tests for `ReviewScheduler` (SM-2) or the review endpoints.**

---

## 6. Porting to BiliMind Desktop (Node.js + local markdown vault + BYOK)

### 6.1 Principles for this slice

1. **The vault is the database.** Every attempt, progress change, review and plan is a file the student owns and can read in Obsidian without the app. A local SQLite (or in-memory) index is a rebuildable cache, never the source of truth.
2. **Pure, framework-free engines.** Port `DeterministicGrader`, `GradingPolicy`, `AnswerNormaliser`, `FeedbackAudit`, `ScheduleBuilder`, the SRS scheduler and the Today aggregator as pure TypeScript functions (`(state, input, now) -> newState`) in a `packages/learning-core` module, unit-tested against the PHP golden cases above. The Electron main process owns file IO; the renderer calls it over IPC.
3. **No auth, no tenancy, no plan gates** — drop `CurrentUser`, ownership 404s, Sanctum, throttles. Keep the honesty labels (what was executed where, what the model said vs what we computed).
4. **BYOK everywhere an LLM is touched** (rubric grading, review question variants, explanations) with a per-call cost meter written to the vault.
5. **Port the copy.** The tone decisions (no debt-collection screen, four honest recall buttons, "nothing is lost, the plan just waits for you", banned praise phrases) are product, not decoration.

### 6.2 Vault layout for learning-loop data

```
<Vault>/
  BiliMind/
    Courses/<course-slug>/
      course.md                         # course frontmatter (id, title, language, minutes_per_week, archived)
      roadmap.md                        # the path (owned by the course/roadmap slice)
      lessons/<NN>-<node-key>.md        # lesson body; progress lives in its frontmatter (below)
      .bilimind/
        assessments/<node-key>.json     # questions + answer keys + rubrics (sidecar, never rendered pre-attempt)
        schedule.json                   # plan config + items (machine copy)
      plan.md                           # generated, human-readable calendar of the plan (regenerated on change)
      attempts/<node-key>/<assessment-id>/<YYYY-MM-DDTHH-mm-ss>.md   # one file per attempt
    Review/
      cards.json                        # SRS state per card (FSRS fields) — or per-card frontmatter, see 6.7
      review-log.jsonl                  # append-only: every review ever done
    Journal/
      activity.jsonl                    # append-only: progress transitions, time pings (aggregated per day), completions
    Daily/<YYYY-MM-DD>.md               # optional daily digest note (Obsidian Daily Notes compatible)
  .bilimind/index.sqlite                # rebuildable cache (never synced, safe to delete)
```

**Lesson frontmatter (progress)**:
```yaml
---
bilimind_id: node_01JAX...      # stable ULID (never a DB int)
course: rust-for-pythonistas
key: ownership-and-borrowing
estimated_minutes: 25
progress:
  state: in_progress            # available | in_progress | completed | skipped
  time_spent_seconds: 1240
  completed_at: null
  last_seen_at: 2026-10-10T09:12:44+05:00
---
```
Obsidian users can flip `progress.state` by hand; the app watches files (chokidar) and treats an external edit exactly like `POST /nodes/{id}/progress` (seed review on first completion, sync schedule).

**Assessment sidecar** (`.bilimind/assessments/<node-key>.json`):
```json
{ "version": 1, "node": "ownership-and-borrowing", "items": [
  { "id": "asm_01JAX...", "block_id": "blk_...", "kind": "numeric", "prompt": "...", "bloom": "apply",
    "options": null, "answer_key": {"value": 13.04, "tolerance": 0.05, "unit": "A"},
    "rubric": null, "grader": "deterministic", "max_score": 100, "position": 0, "retired": false } ] }
```
`retired: true` replaces the `position >= 1000` sentinel. Keys are in a dot-folder so Obsidian does not index them; secrecy is UX, not security (the student owns the files) — say so in the UI.

**Attempt file** (`attempts/<node-key>/<assessment-id>/<ts>.md`):
```markdown
---
attempt_id: att_01JAX...
assessment: asm_01JAX...
kind: essay
status: graded            # grading | queued | pending | graded | failed
score: 78
max_score: 100
passed: true
grader: llm_rubric
grader_meta: { prompt_version: grade.rubric.v1, provider: openrouter, model: deepseek/deepseek-v4-flash, cost_usd: 0.0011, feedback_quality: quotes_submission, feedback_reasked: false, model_reported_score: 85, unmatched_criteria: [] }
criterion_scores:
  - { criterion: "Names which index the planner would pick and why", weight: 0.5, score_0_to_1: 0.7, points: 35, max_points: 50, comment: "..." }
created_at: 2026-10-10T09:20:01+05:00
---
## My answer
<the response, rendered: text / chosen option text / blanks / order / code fenced block + test table>

## Feedback
<feedback>
```
Human-readable history, greppable, diffable; code attempts embed the code in a fenced block plus a checks table.

**schedule.json**: `{version, starts_on, minutes_per_week, days_of_week:[1,3,5], status, deadline?: "2026-12-15", include_review_minutes: true, items:[{id, node_key, scheduled_for, estimated_minutes, state, pinned}]}`. `plan.md` is regenerated from it with a Markdown table/checklist per day (`- [ ] Wed 14 Oct · Ownership (25 min)`); ticking a checkbox in Obsidian is parsed back as "done" (two-way, with the JSON as the conflict winner).

### 6.3 Module mapping

| Web (PHP/Vue) | Desktop (TS) | Notes |
|---|---|---|
| `GraderRegistry`, `Grader`, `GradeResult`, `GradingPolicy` | `learning-core/grading/{registry,types,policy}.ts` | identical semantics; pass mark configurable per course (default 70%) |
| `DeterministicGrader` | `learning-core/grading/deterministic.ts` | port 1:1 incl. key/response alias lists and number parser |
| `AnswerNormaliser` | `learning-core/grading/normalise.ts` | use `\p{P}\p{S}` with the `u` flag; keep "no accent stripping, no stemming" but add an opt-in per-course accent-insensitive mode for languages where diacritics are routinely dropped |
| `LlmRubricGrader` + `RubricGradePrompt` | `learning-core/grading/rubric.ts` + `prompts/grade.rubric.v2.ts` | via the BYOK provider adapter (6.4) |
| `FeedbackAudit`, `LeakGuard` | `grading/audit.ts`, `grading/redact.ts` | LeakGuard becomes a render-time redaction (never show keys before an attempt) |
| `SelfGrader` | `grading/self.ts` | same |
| `AttemptService` + `GradeAttemptJob` | `main/attempts.ts` + persistent local job queue (`main/queue.ts`, JSON/SQLite backed) | write attempt file first with `status: grading`; grade; on provider error -> `queued`, retry with backoff [10s, 30s, 90s] and on reconnect |
| `NodeProgressUpdater` | `main/progress.ts` | frontmatter writer + activity journal + SRS seeding |
| `ReviewScheduler` (SM-2) | `learning-core/srs/fsrs.ts` (via `ts-fsrs`) with SM-2 fallback import | see 6.7 |
| `ScheduleBuilder` | `learning-core/schedule/{topo,pack,recompact}.ts` | pure; same invariants; extras in 6.8 |
| `TodayController` | `learning-core/today.ts` | aggregates over all courses in the vault |
| `DailyDigestJob` + notifications | `main/digest.ts` + Electron `Notification` + tray badge + optional Daily note | per local time, see 6.8 |
| Vue components (`AssessmentItem`, kind inputs, `AttemptResult`, review/*, Plan tab, Today) | reuse almost verbatim if the desktop renderer is Vue/Nuxt-SPA; replace `useApi` with an IPC client | keep the same copy |
| `runner.worker.ts`, `useCodeExercise`, `ExercisePane` | renderer Web Worker, same code | bundle Pyodide/sql.js locally (no CDN) |

### 6.4 BYOK rubric grading

- Provider adapter interface `{ completeJson({system, user, schema, tier}) -> {json, usage:{input_tokens, output_tokens, cost_usd?}} }` with drivers for OpenRouter, OpenAI (Responses/`json_schema` strict), Anthropic (tool-use with the schema as input_schema, or structured outputs), Gemini (`responseSchema`), Ollama (`format: <schema>`). Tier `flash` maps to the user's chosen cheap model per provider; let the user pick a dedicated "grading model".
- Validate returned JSON against the schema locally (ajv); on failure one corrective re-ask, then mark `pending` (never fabricate a score).
- Cost meter: append `{ts, stage:'grade', provider, model, tokens, cost_usd (measured when the provider returns it, else estimated from a local rate card)}` to `BiliMind/.bilimind/usage.jsonl`; show per-attempt cost in the attempt file and a running monthly total in Settings (replaces billing/allowance).
- **Improvements over web**:
  - Pass `answer_key.reference_answer` (and the lesson excerpt the item came from) into the grader prompt as "REFERENCE (for your eyes only; do not quote it to the learner)". Web generates it but never uses it — a real accuracy loss.
  - Bump to `grade.rubric.v2`; keep the score computed locally from weighted criteria; keep the banned list and the verbatim-quote rule; keep FeedbackAudit + one re-ask.
  - Optional "second opinion" re-grade with a different model when the score lands within ±5 of the pass mark (borderline), averaged — cheap insurance for the learner.
  - "Why did I lose marks?" follow-up chat scoped to the attempt (uses the assistant slice).
  - Offline: queue rubric attempts; deterministic and self grading always work offline.
  - Local models (Ollama) are first-class: if JSON adherence is poor, fall back to a two-pass "score each criterion separately" prompt.

### 6.5 Code sandbox on desktop

- Keep the WASM worker model (quickjs, Pyodide, sql.js, DOMParser for HTML) — it is already offline-capable once the WASM assets are **bundled in the app** instead of fetched from jsDelivr (removes the 10 MB first-run download and the "CDN blocked" failure mode). `RuntimeState` copy changes to "Starting Python…" (no download).
- Grading stays client-side; on desktop the "trusted client report" caveat disappears (single user) — keep the honesty footnote but reword: "Your code ran on this computer in a sandbox; nothing was sent anywhere."
- Optional opt-in native runners (detected system `python3`/`node`, later more languages) behind an explicit setting, executed in a child process with a timeout and no network flag where the OS allows; default stays WASM.
- Persist drafts to the vault (`attempts/<node>/<asm>/draft.<ext>`) instead of sessionStorage — desktop users expect work to survive restarts; keep "Use the starter instead".
- Keep: dirty-run rule, hint gating, promise list, focus mode, 5 s timeout (configurable), output caps, per-mode tabs.

### 6.6 Progress, time and streaks

- Progress states unchanged (available/in_progress/completed/skipped), auto-complete on all live assessments passed, never auto-un-complete.
- Time-on-task: renderer ticker while the window is focused AND the lesson pane is foreground; flush every 30 s and on blur/close to main; main aggregates per day into `activity.jsonl` (`{date, node, seconds}`) and updates frontmatter at most once a minute (avoid hammering files that sync via iCloud/Dropbox/Obsidian Sync). Add idle detection (`powerMonitor.getSystemIdleTime() > 120 s` pauses the ticker) — web counts time even when the learner walked away.
- **Fix**: roadmap/course percent should exclude skipped nodes from the denominator (or show "done + skipped" as settled) — matches the enum's stated intent.
- **Fix**: progress `skipped` should propagate to the plan (schedule item -> skipped) and schedule-item skip should set progress `skipped` — web does neither, so a node skipped on the roadmap keeps being scheduled.
- **Unify streaks**: web shows a completion streak on Today and a separate review streak on the Review done screen. Desktop: one "study streak" = any day with a completion, a review, or >= N minutes on task, computed from `activity.jsonl` + `review-log.jsonl` (full history, not only `last_reviewed_at`), with current/longest and a 14-day (and yearly heatmap) strip. Optional streak freeze for rest days that are not study days.
- New **Stats page** (web has none): minutes per week vs budget, completion pace and projected finish date, accuracy by assessment kind and Bloom level, weakest lessons (lowest best-score / most lapses), retention curve from the review log.

### 6.7 Spaced repetition — replace node-level SM-2 with card-level FSRS and real retrieval

Web today: one SM-2 item per completed lesson; the "review" is a title + summary and a self-rating; in-lesson flashcards are not persisted; there is no review log; SM-2 is untested. This is the weakest part of the loop and the clearest place to beat NotebookLM (which generates flashcards/quizzes but schedules nothing).

Desktop design:
- **Cards** come from three sources: (a) every generated flashcard (`flashcards` block `{front, back}`), (b) every deterministic assessment (mcq/multi/cloze/ordering/numeric — re-askable and auto-gradable), (c) a lesson-level "recall" card (keep the web behaviour as a fallback: title + summary + "explain it in two sentences", self-rated or rubric-graded).
- **Scheduler**: FSRS (open-source `ts-fsrs`, MIT) with default parameters and optional per-user optimisation from the review log once enough reviews exist; desired retention setting (default 0.9). Ratings Again/Hard/Good/Easy map 1:1 to FSRS ratings (web's mapping to SM-2 qualities 1/3/4/5 is kept for import). For auto-graded cards the rating is derived: fail -> Again, pass after a hint or slow -> Hard, pass -> Good, pass fast on first try -> Easy (overridable).
- **Seeding**: on lesson completion seed its cards as `new`, first due tomorrow (same as web), idempotent; re-finishing never resets earned state. Archived courses' cards pause but keep state (same as web).
- **Variants**: optional LLM "fresh variant" of a question at review time (BYOK, cached) so the learner recalls the concept rather than the wording.
- **Review session UI**: keep the web page's calm one-card loop, progress bar, "waited N days", "Open the lesson", warm done screen; add the actual question/answer face, a daily new-card cap and a max-reviews cap, and "undo last rating".
- **Storage**: `Review/cards.json` (`{card_id, source:{type: flashcard|assessment|lesson, course, node, ref}, fsrs:{due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review}}`) + append-only `Review/review-log.jsonl` (`{ts, card_id, rating, duration_ms, prev_due, next_due, stability, difficulty}`). Alternatively write cards as Obsidian Spaced Repetition plugin syntax (`front::back` under `#flashcards`) in a `Review/<course>.md` for compatibility.
- **Interop**: export to Anki (`.apkg` via an apkg writer, or CSV), import an existing SM-2 web export (map `ease_factor/interval/repetitions` to an FSRS initial state).

### 6.8 Plan, Today and the daily nudge on desktop

- Port `ScheduleBuilder` exactly (Kahn with `(layer, position, id)` ties and cycle breaking, session budget `floor(mpw / days)`, never split, oversized node gets its own day, prerequisite-respecting dates, recompact leaves overdue in place, `build` pulls overdue forward, pins = moved). Port the self-healing (new nodes folded in on read) and progress<->plan reconciliation.
- **Improvements**:
  - **Deadline mode** (web explicitly has "no exam-date field"): optional `deadline`; the planner reports the projected finish date and, if it is after the deadline, offers (a) the minutes/week needed, (b) adding a study day, or (c) marking Anytime/Alternative lessons (LessonMark) as skip candidates. The marketing copy can then truthfully drop the caveat.
  - **Budget includes review**: subtract the forecast review minutes (from FSRS due counts × average review duration) from each session's budget so new lessons do not crowd out reviews.
  - **Calendar export**: write `plan.ics` (one VEVENT per session, stable UIDs) and optionally subscribe-able local file; regenerate on change.
  - **Pause** a schedule (the `paused` status exists in the web data model but has no UI/endpoint) — vacation mode that shifts everything by the paused span.
  - Resolve the web inconsistency between marketing ("nothing is marked overdue") and behaviour (overdue kept as debt). Recommendation: keep the backend behaviour (visible, calm, one bulk "Move them to today") and fix the copy.
- **Today**: port the payload shape (summary, continue, overdue-then-today plan, next_up, courses, week strip, streak) computed locally across the vault's courses; keep the copy and the single "Move them to today" fix; reviews due card; Undo toasts.
- **Daily nudge**: Electron `Notification` at a user-chosen local time (default 08:00, per local timezone — fixing web's app-timezone cron), only if something is due (silent on rest days), idempotent per day, plus tray/dock badge with the due count; optionally write `Daily/<date>.md` with the plan as a checklist (Obsidian daily-notes compatible) and append the evening summary (done, minutes, reviews). If the app was closed at nudge time, show it on next launch (catch-up, once).

### 6.9 Competitive notes (learning loop only)

- **Google NotebookLM**: generates study guides, FAQs, quizzes and flashcards from sources (and a guided "learning" chat), but has no persistent grading history, no rubric-graded free-text with verbatim-quoting feedback, no code exercises, no prerequisite-aware calendar plan, no spaced-repetition scheduling, and data lives in Google's cloud. BiliMind Desktop's moat here: the full loop (plan -> lesson -> graded practice -> FSRS review -> re-plan) persisted as files the student owns, offline-capable, any model.
- **Open-source notebook clones** (e.g. Open Notebook, SurfSense, Kotaemon): strong on source chat/RAG and podcast-style audio, weak to absent on assessment, grading, scheduling and SRS.
- **Anki / Obsidian Spaced Repetition plugin**: excellent schedulers, but cards are hand-made and there is no course, plan or graded open-ended practice. Interop (export/import) turns them into allies rather than competitors.
(Feature sets of third-party products are from general knowledge as of 2026 and should be re-verified before marketing claims.)

### 6.10 Defects and gaps found in the web version (fix, do not port)

1. `reference_answer` is generated for short-answer items but never shown to the rubric grader.
2. Review streak is computed from each item's `last_reviewed_at` only, so history collapses (an item reviewed Monday and again Wednesday erases Monday). Needs a review log.
3. The 08:00 digest runs in the app timezone, not each learner's.
4. Roadmap/course percent counts skipped nodes against the learner.
5. Progress `skipped` and schedule `skipped` are not reconciled with each other.
6. Lesson review is a self-report on title + summary — no retrieval prompt; in-lesson flashcards are throwaway (not persisted, not scheduled).
7. SM-2 scheduler and review endpoints have no tests.
8. Marketing copy says nothing is marked overdue; the API and Today show overdue items.
9. `schedules.status = paused` exists but nothing can set it.
10. Session packing ignores review workload.
11. Time-on-task has no idle detection.
12. Code drafts live in sessionStorage and die with the tab.

### 6.11 Per-feature port table

| ID | Port as | Improvement on desktop |
|---|---|---|
| LRN-01..02 | same inputs + local validation (zod) with the same messages | — |
| LRN-03..04 | same registry/policy | per-course pass mark |
| LRN-05..11 | 1:1 deterministic ports with golden tests | opt-in accent-insensitive cloze |
| LRN-12..16 | BYOK rubric grading, same scoring/audit | reference answer in prompt; borderline second opinion; cost per attempt |
| LRN-17 | same | note saved into the attempt file |
| LRN-18 | local persistent queue | retry on reconnect; offline-safe |
| LRN-19, 21, 22 | same UI, history from attempt files | attempt timeline view in the lesson |
| LRN-20 | render-time redaction | "Reveal model answer" after passing or after 3 tries (user setting) — web forbids any reveal |
| LRN-23 | export/publish slice renders questions read-only | — |
| LRN-24 | `retired: true` in sidecar | — |
| LRN-25 | generation slice | — |
| LRN-26..33 | same worker + components | bundled runtimes; vault drafts; optional native runners |
| LRN-34..36 | same blocks | flashcards feed FSRS |
| LRN-37..42 | frontmatter + journal | idle detection; skipped excluded from percent; Obsidian edits honoured |
| LRN-43..48 | FSRS card-level reviews | real retrieval, review log, Anki interop, unified streak |
| LRN-49..56 | pure TS planner + `schedule.json` + `plan.md` | deadline mode, review-aware budgets, `.ics`, pause |
| LRN-57..62 | local Today aggregator | stats page link, catch-up preserved |
| LRN-63..64 | OS notifications + tray badge + Daily note | local-time schedule, catch-up on launch |
| LRN-65 | ship the 32 roadmaps as offline starter templates ("start from a roadmap") | — |


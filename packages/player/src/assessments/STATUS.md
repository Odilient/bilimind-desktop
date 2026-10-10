# WP5c: interactive blocks and assessments (status)

Owner files: `src/blocks/{Quiz,Code,Flashcards,Walkthrough,Checklist,Scenario,Project,Speaking,Dialogue}Block.vue`
and everything under `src/assessments/`. No change to `packages/core`, no new npm dependency.

## Works (tested)

Unit tests: 23 vitest tests in `assessments.test.ts`, all passing. End-to-end: 40 puppeteer-core + Edge checks
over file://. All 40 pass on the harness page and on the real player (`dist/demo.html`, with WP5a's shell).

- **Every assessment kind grades with core `grade.ts`** (`gradeItem`, `gradeCode`, `gradeSelf`, `rubricRatio`).
  - mcq / multi_select: option rows. After Check, right picks go lime, wrong picks coral with a shake, and
    missed answers are hatched.
  - ordering: up/down buttons. "Show the right order" animates the rows into place.
  - numeric: unit shown beside the field, plus a "too high" / "too low" tag.
  - cloze: inline gaps sized to the answer. A wrong gap shows the accepted word above it.
  - short_answer / essay / project: write first, then "Compare with the model answer", then mark yourself
    per rubric row (Excellent / Acceptable / Not yet).
- **Explanations appear only after Check.** The "Why" panel shows `item.explanation` and the item's cite chips
  (the shell's `components/CiteChip.vue`, so the shared popover is used). The e2e confirms that no
  `.opt.right`, `.why .wb` or model answer is in the DOM before Check.
- **Labels.** "Beyond your slides" (the `beyond_slides` label) is visible before and after Check, with a line
  in the Why panel. "Rewritten after a check" (`rewritten`) is shown too.
- **"How sure are you?"** (Guessing / Fairly sure / Certain) can be picked before the reveal. A calibration line
  follows Check, and the pick sets the FSRS rating for the item's card (`<lesson>/<item>` in `bm:<id>:fsrs`).
- **Code** (JS function / debug mode):
  - Ink stage: a highlighted textarea editor with line numbers. Tab / Shift+Tab indent, Enter keeps the
    indent, Esc releases focus, Ctrl/Cmd+Enter runs.
  - Run executes the tests in a fresh classic Blob worker and kills it after 1.5 s ("Stopped after 1.5 s").
  - Check rows flip pass/fail 120 ms apart and show `expected X, got Y`.
  - All green: lime ring, confetti, "Passed".
  - Hints are locked until the first run. "See the reference solution" appears after 2 runs.
  - Badges: "Tested before delivery" and "Reference solution passes N/N".
  - The draft is kept in `bm:<id>:ui`.
  - Grader `self` or no tests means "Mark it yourself".
- **Flashcards:**
  - 3D flip with the deck stack, fly-out and deal animations.
  - Again / Hard / Good / Easy, each labelled with the real next interval from core `rateCard`. Due dates are
    capped before the exam.
  - Ratings are stored in `bm:<id>:fsrs` under `<lesson>/<block>/c<n>`, the key the shell's DueToday reads.
  - Keys: Space flips, 1-4 rate. Again deals the card once more. End card: "Deck done · N remembered".
- **Scenario:** each choice shows its outcome card (lime or amber) and every path ends at the debrief. A
  missing, null or unknown `next_id` ends the path, and a loop guard stops cycles. Both the unit test and the
  e2e (9/9 paths) cover this.
- **Speaking** (record and compare, no recognition scoring, PLAN 0 #9):
  - Plays the native mp3 and records with MediaRecorder, with a live AnalyserNode waveform.
  - Your take plays back beside the native one. Self-rate with Nailed it / Close / Again.
  - NotAllowedError shows one friendly line and the drill keeps working. A missing mp3 disables Native and
    says so.
  - Tested with a fake mic device.
- **Walkthrough:** steps sit on a rail with tick buttons and the current step is highlighted. Ticks are kept in
  `bm:<id>:ui`.
- **Checklist:** ticks with a progress bar. Ticking every item marks the block passed. Ticks are not kept on
  purpose.
- **Project:** brief, then deliverables as ticks, then the rubric self-mark.
- **Dialogue** (offline):
  - Shows the scene, the roles, the goal and the opening line (voiced when `opening_audio` exists).
  - Typed replies light up the hint phrases they cover. The goal is met when every hint is covered or the
    learner says so.
  - "Practise live with WorkBuddy" copies an in-character prompt.
- **Narration spans.** The narrated fields of walkthrough, scenario, project and dialogue are wrapped in
  `<span class="s" data-s="bN.i">`, using ids from core `fieldSentences`. The e2e checks that they equal
  `blockSentences` ids (16/16, 3/3, 3/3, 2/2). The shell's `wrapBlock` leaves already-wrapped blocks alone.
- **Progress.** A passed task:
  - writes `bm:<id>:progress` in the shell's shape (`{v:1, lessons:{id:{seen,passed}}}`);
  - dispatches `bm:passed` on `document`, which the shell's `runtime/progress.ts` listens for;
  - sets `data-passed="true"` and the `.passed` ring on the block.
- **Layout.** At 390 px no block is wider than the screen (e2e). Screenshots at 1440 and 390 are written to
  `harness/shots/` (git-ignored).

## How to run

```
cd packages/player
npx vitest run src/assessments                               # unit tests
npx vite build -c src/assessments/harness/vite.harness.config.ts   # harness -> src/assessments/harness/dist/index.html
node src/assessments/harness/e2e.mjs --shots                 # 40 checks on the harness (+ screenshots)
pnpm build && node scripts/paste-fixture.mjs && node src/assessments/harness/e2e.mjs --page dist/demo.html   # same checks on the real player
```

The harness (`src/assessments/harness/`) renders every lesson's blocks through the registry, using the shell's
tokens, block styles, sprite and cite popover, but not the shell's routing. `?lesson=<id>&only=code,quiz`
narrows it. Edge path: `BILIMIND_BROWSER` overrides it.

## Stubbed / not done

- Code runs JavaScript only (function and debug modes). Python, SQL and HTML exercises show the editor, say
  "Runs in the full app" and fall back to self-marking with the reference solution. That is the hackathon
  scope (PLAN 3.2).
- Ordering uses up/down buttons. Drag is P2.
- Dialogue has no AI partner offline. It points to WorkBuddy for live practice.
- Speaking self-ratings are stored in `bm:<id>:ui`, not FSRS. Review cards cover only quiz items and flashcards.
- Quiz answers are not restored after a reload. The block's Passed state is restored.

## Notes for integration

- All block CSS is scoped under `.bmx` (the TaskShell root). It overrides the shell's global spec rules of the
  same name (`.opt`, `.ord`, `.cs-*`, `.fc-*`, `.spk-*`) where they differ. The shell's global
  `.cs-checks .st svg { display:none }` and `.spk-res` 2-column grid are overridden on purpose.
- Every block renders its own `.cite` chips (TaskShell footer, Why panels), so `BlockFrame` does not add a
  second row. Flashcards keep their block-level cites off the card face, so `BlockFrame` shows them under the
  deck.
- In e2e runs, targets are scrolled to the centre before clicking. Otherwise the shell's fixed narration dock
  can take a click near the bottom edge.

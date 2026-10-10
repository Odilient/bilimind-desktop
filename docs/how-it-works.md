# How it works

BiliMind for WorkBuddy splits the work in two:

- **Agents decide.** The Lead, the Writers, the Coder and the Checker run inside WorkBuddy. They make every
  judgment call (what the goal is, what to keep and cut, how to repair a lesson, which side of a failing test
  is wrong, whether an answer is supported by the slides), and their reasoning is visible in the WorkBuddy
  transcript.
- **Code enforces.** The `bilimind` CLI (`skills/bilimind/scripts/bilimind.mjs`) does what must be
  deterministic: reading files, the archetype-to-format table, schema checks, running code tests, checking
  that quotes are verbatim, text-to-speech, exports and packaging. It also makes single-shot text-model calls
  (one call per outline, per lesson draft, per rewrite).

The agents only talk to the engine through the CLI. Every command prints one JSON line and appends one line
to `crew/log.jsonl`, so `REPORT.md` and the course's receipts are computed from what actually ran.

## The pipeline

| Phase | Who | Commands | What happens |
|---|---|---|---|
| 1. Understand the goal | Lead | `doctor`, `init`, `goal` | Checks the key, balance and clock. Creates `bilimind-out/<slug>/`, copies your files into `sources/`. Records the deadline, exam time, minutes a day, audience, language and every assumption. The Lead never asks a question. |
| 2. Read the folder | Lead | `ingest` | Extracts text from PDF, DOCX, PPTX and Markdown, detects each file's role (lecture, past paper, syllabus, SOP, other), finds scanned pages with no text layer, and splits the text into chunks with locators ("Slide 12", "Page 3"). |
| 3. Plan the path | Lead | `outline`, `exam-map`, `plan` | `outline` (one reasoning call) proposes topics and gives each an archetype; the CLI derives the block formats from the archetype. `exam-map` reads the past paper into questions and marks and matches them to topics. The Lead keeps and cuts topics with one reason each; `plan` does the arithmetic, schedules the days and writes `plan.md`. |
| 4. Write lessons | Writers, in parallel | `draft`, `check` | One Writer per kept lesson, all launched in one message. Each drafts its lesson from the chunks retrieved for it, reads the check report, and repairs for up to two rounds. |
| 5. Test code | Coder | `code-test` | Dumps each JavaScript exercise to `crew/code/<key>-b<n>/` (instructions, starter, solution, tests), runs the tests, fixes the solution, the starter or a wrong expectation, and applies the fix. An exercise whose reference still fails is disabled with a reason. |
| 6. Check answers | Checker (parallel with the Coder) | `evidence`, `verdict`, `rewrite-item` | Reads each quiz item next to the slide text it cites and rules supported, contradicted or not covered, with a verbatim quote. Contradicted items are rewritten as new items and ruled again. |
| 7. Narrate | Lead | `narrate` | Edge TTS reads each lesson and a "Hear the plan" overview, one cue per sentence, so the page can highlight the sentence being read. |
| 8. Schedule reviews | Lead | `export` | Writes the FSRS review state, `reviews.ics`, `deck.csv`, `lessons/*.md` and `REPORT.md`. |
| 9. Package and open | Lead | `build`, `present_files` | Assembles and validates `course.json`, pastes it into the player template to make `index.html`, writes `crew/proof.md`, and opens `index.html`, `plan.md` and `REPORT.md` in WorkBuddy's Preview panel. |

Each phase is one item in the WorkBuddy task checklist (TaskCreate / TaskUpdate). A task that failed stays
`in_progress` and the final reply says why.

## What each agent decides, and what the code checks

| Agent | Decides | Enforced by the CLI |
|---|---|---|
| Lead | Exam date and time, minutes a day, audience, language, code language; which file is the past paper; fixes wrong question-to-topic matches; which topics to keep and cut, in what order, with a reason | `outline` derives formats from archetypes, never from the model. `plan` warns when lessons exceed the minutes available and dates reviews backwards from the exam. |
| Writer | How to repair its lesson after a failed check: edit the JSON directly, or re-draft one block with its own instruction | `check` re-validates every change: schema, mandatory formats for the archetype, citations that resolve to real chunks, code tests, thin-lesson rules. |
| Coder | Which side of a failing exercise is wrong (solution, starter or test) and the smallest fix | `code-test` runs each exercise in `node:vm` with a timeout. Nothing ships unless the reference solution passes every test and the starter fails at least one. |
| Checker | Supported, contradicted or not covered, with a reason and a quote | `verdict` refuses a quote that is not word for word in the cited chunk, so the Checker cannot invent evidence. Contradicted items never reach the course; not-covered items get a "Beyond your slides" label. |

The Checker runs on WorkBuddy's own model, which is a different model from the one that drafted the lesson
through the CLI (DeepSeek or OpenRouter).

## The planner

- **Capacity** is study days times minutes a day. Study days run from today to the day before the exam.
- **Weight** comes from the past paper: each topic's share of the marks in `exam-map`. Topics that no
  question touches count as 0 marks, so they are cut first, with the reason "No marks in the past paper".
- **Order**: the heaviest topic first, unless a kept lesson needs another one before it.
- **Reviews** are dated backwards from the exam (the day before, then 3, 7, 14 and 30 days before, plus the
  day after a lesson is learned), at most 4 per lesson, strictly between learning day and exam day. One
  FSRS schedule (`review/state.json`) drives both the calendar file and the page's "Due today" list; answering
  in the page reschedules the card locally.
- `plan` warns, the Lead decides. Only the hard warning "more than the whole N min available" makes the Lead
  cut another lesson. Other warnings are mentioned in the plan summary.

## Lesson formats follow the kind of knowledge

`outline` gives every topic one of 11 archetypes. Each archetype has mandatory formats that every lesson of
that kind must contain, and `check` fails a lesson that is missing one. The table is in
[course-format.md](course-format.md#archetypes-and-mandatory-formats). This mapping, and the lesson prompts,
come from the team's existing BiliMind app.

## Text-model calls

- Every call goes through one function (`callJson`) with a JSON schema, a per-stage model choice (a fast
  model for drafts, a reasoning model for the outline), a cache and a spend ledger.
- Finished calls are cached in `crew/cache/`, so a command that timed out can be run again and picks up where
  it stopped.
- Broken JSON from the model is repaired locally (raw newlines and bad escapes in strings, miscounted
  brackets) before the CLI asks again. Replies that still cannot be decoded are saved to
  `crew/cache/bad-replies/` for diagnosis.
- Spend caps: $0.25 per run and $2 per day by default (`caps` in `~/.bilimind/config.json`), plus a balance
  floor (`reserve_usd`). When the CLI refuses on budget, the Lead launches nothing new, builds what exists
  and says so.

## Timing and cost (measured)

From two unattended runs (`run`, DeepSeek direct) on the sample Data Structures folder:

- Whole run: 268 s and 289 s; $0.046 and $0.047.
- The outline takes 109 to 117 s (one reasoning call). Narration takes about 100 s. Drafts take about 60 to
  170 s in parallel. Everything else takes about 1 s per command.

A run with the agents takes longer, because they read reports and make decisions between commands: the
Data Structures showcase course (3 lessons, 6 agents) took 16 min 55 s of wall time and $0.040 in text
calls, according to its `REPORT.md`. WorkBuddy credits per course: {{CREDITS_PER_COURSE}}.

## Resume

`status` lists which stages and lessons are done and what to run next. If a folder already has
`bilimind-out/<slug>/`, "continue" or "rebuild" in WorkBuddy makes the Lead resume from the first stage still
marked `todo`.

## The offline player

`index.html` is one self-contained file: the course data is embedded as JSON in a script tag and the Vue
player is inlined. It works from `file://`, from WorkBuddy's Preview panel and from any static host.
Progress and review state are kept in the browser's `localStorage` under `bm:<course id>:*`. Citation chips
open the copy of your file in `sources/` at the cited page. Mermaid diagrams are rendered to SVG at build time
when a local browser is available (cached in `crew/diagrams.json`); otherwise the page loads Mermaid from a
CDN when online and shows the diagram's alt text offline.

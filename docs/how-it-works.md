# How it works

BiliMind Desktop is an Electron app. You pick a folder, type one sentence and press Build. The app runs the
BiliMind engine (`@bilimind/engine`, `runPipeline` in `packages/engine/src/run.ts`) on your own machine, in a
separate worker process. The text-model calls go to BiliMind free (our open-source proxy, no key, the
default) or straight to DeepSeek or OpenRouter with your own key. There is no account. The finished course
is a normal folder under `Documents\BiliMind\`.

## Inside the app

```
Renderer (Vue)  --window.bilimind-->  Main process  --utilityProcess.fork-->  Worker
  home: folder + sentence               keys in ~/.bilimind/config.json        runPipeline({ src, sentence,
  building: live steps                   (never sent to the window)             outRoot, template, progress })
  finished: checks, cost, files          courses list, open/reveal files        -> progress events
  course: the offline player             forwards run events
```

- The renderer never sees a key. Settings shows only whether a key is set and its last four characters.
  "Test key" asks the provider's balance endpoint.
- The worker reports every step (who, what, how long, cost) as it happens; the building screen shows them in
  plain words, plus the plan (kept and cut topics) as soon as it exists.
- The course is shown in the app from its own `index.html`, the same file you can open in any browser.
- The exact interface between the window and the main process is in `apps/desktop/CONTRACT.md`.

## Two halves: judgement and rules

- **Judgement** comes from text-model calls: the outline, lesson drafts, repairs, the Checker's rulings and
  rewrites. Each role (Lead, Writer, Coder, Checker) is a stage of the engine with its own prompts.
- **Rules** are code, and the code has the last word: reading files, the kind-of-knowledge-to-format table,
  schema checks, running code tests, checking that every quote is verbatim, narration, exports and packaging.

Every step appends one line to `crew/log.jsonl`, so `REPORT.md` and the course's receipts are computed from
what actually ran.

The same engine also runs as a CLI, which the WorkBuddy skill and Expert Team call (see the README). They
are designed so that WorkBuddy's agents make the Lead's and the Checker's judgement calls in a visible
transcript; in the desktop app the engine makes them unattended.

## The pipeline

| Phase | Role | Step | What happens |
|---|---|---|---|
| 1. Understand the goal | Lead | `init`, `goal` | Creates the course folder and copies your files into `sources/`. Reads the deadline, exam time, minutes a day, audience and language from your sentence, and writes every assumption into `plan.md`. Never asks a question. |
| 2. Read the folder | Lead | `ingest` | Extracts text from PDF, DOCX, PPTX and Markdown, detects each file's role (lecture, past paper, syllabus, SOP, other), finds scanned pages with no text layer, and splits the text with locators ("Slide 12", "Page 3"). |
| 3. Plan the path | Lead | `outline`, `exam-map`, `plan` | `outline` (one reasoning call) proposes topics and gives each a kind of knowledge (archetype); the code derives the lesson formats from it. `exam-map` reads the past paper into questions and marks and matches them to topics. Topics are kept by marks per minute and cut with one reason each; `plan` schedules the days. |
| 4. Write lessons | Writers, in parallel (4 at a time) | `draft`, `check` | One Writer per kept lesson. Each drafts from the passages retrieved for it; `check` validates it and a failing lesson is repaired. |
| 5. Test code | Coder | `code-test` | Runs each JavaScript exercise in `node:vm` with a timeout. An exercise whose reference solution still fails is switched off with a reason. |
| 6. Check answers | Checker | `fact-check`, `verdict`, `evidence` | Proof-reads each lesson's teaching text, then re-solves every auto-marked item against your files. A wrong answer key is rejected with a verbatim quote, rewritten and re-solved. Items your files do not cover get a "Beyond your slides" label. |
| 7. Narrate | Lead | `narrate` | Microsoft Edge's free online voices read each lesson and a "Hear the plan" overview, one cue per sentence, so the page highlights the sentence being read. |
| 8. Schedule reviews | Lead | `export` | Writes the FSRS review state, `reviews.ics`, `deck.csv`, `lessons/*.md` and `REPORT.md`. |
| 9. Package | Lead | `build` | Assembles and validates `course.json` and pastes it into the player template to make `index.html`. |

## What each role decides, and what the code checks

| Role | Decides | Enforced by the code |
|---|---|---|
| Lead | Goal, which file is the past paper, which topics to keep and cut, in what order | Formats come from archetypes, never from the model. `plan` warns when lessons exceed the minutes available and dates reviews backwards from the exam. |
| Writer | The lesson text, examples, exercises and questions | `check` re-validates every change: schema, mandatory formats for the archetype, citations that resolve to real passages, code tests, thin-lesson rules. |
| Coder | Whether an exercise can ship | Nothing ships unless the reference solution passes every test and the starter fails at least one. |
| Checker | Supported, contradicted or not covered, with a reason and a quote | The quote must be word for word in the cited passage, so the Checker cannot invent evidence. Contradicted items never reach the course. |

## The planner

- **Capacity** is study days times minutes a day. Study days run from today to the day before the exam.
- **Weight** comes from the past paper: each topic's share of the marks in `exam-map`. Topics that no
  question touches count as 0 marks, so they are cut first, with the reason "No marks in the past paper".
  A topic worth 10% or more of the paper is not cut while time allows.
- **Order**: the heaviest topic first, unless a kept lesson needs another one before it.
- **Reviews** are dated backwards from the exam (the day before, then 3, 7, 14 and 30 days before, plus the
  day after a lesson is learned), at most 4 per lesson, strictly between learning day and exam day. One
  FSRS schedule (`review/state.json`) drives both the calendar file and the page's "Due today" list;
  answering in the page reschedules the card locally.

## Lesson formats follow the kind of knowledge

`outline` gives every topic one of 11 archetypes. Each archetype has mandatory formats that every lesson of
that kind must contain, and `check` fails a lesson that is missing one. The table is in
[course-format.md](course-format.md#archetypes-and-mandatory-formats). This mapping, and the lesson prompts,
come from the team's existing BiliMind web app.

## Text-model calls

- Every call goes through one function (`callJson`) with a JSON schema, a per-stage model choice (a fast
  model for drafts, a reasoning model for the outline), a cache and a spend ledger.
- Finished calls are cached in `crew/cache/`, so a run that stopped can be started again and picks up where
  it stopped.
- Broken JSON from the model is repaired locally (raw newlines and bad escapes in strings, miscounted
  brackets) before asking again. Replies that still cannot be decoded are saved to
  `crew/cache/bad-replies/` for diagnosis.
- Spend caps: $0.25 per run and $2 per day by default (`caps` in `~/.bilimind/config.json`), plus a balance
  floor (`reserve_usd`).

## Timing and cost (measured)

From two unattended runs (DeepSeek direct) on the sample Data Structures folder, the same pipeline the
desktop app runs:

- Whole run: 268 s and 289 s; $0.046 and $0.047.
- The outline takes 109 to 117 s (one reasoning call). Narration takes about 100 s. Drafts take about 60 to
  170 s in parallel. Everything else takes about 1 s per step.

The showcase courses in `showcase/courses/` each started as an unattended run of this pipeline, then our
team reviewed them with an AI coding agent (re-planning, fixing exercises, correcting lesson text), which
takes longer: the Data Structures course (3 lessons, 6 agents) took 19 min 39 s of wall time and $0.04 in
text calls, according to its `REPORT.md`. Every change after the run is in
[showcase/courses/_notes](../showcase/courses/_notes/).

## The offline player

`index.html` is one self-contained file: the course data is embedded as JSON in a script tag and the Vue
player is inlined. It works inside the app, from `file://` and from any static host. Progress and review
state are kept in `localStorage` under `bm:<course id>:*`. Citation chips open the copy of your file in
`sources/` at the cited page. Mermaid diagrams are rendered to SVG at build time when a local browser is
available (cached in `crew/diagrams.json`); otherwise the page loads Mermaid from a CDN when online and shows
the diagram's alt text offline.

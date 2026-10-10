# Course format

A BiliMind course is a folder. Everything in it is a plain file you own: an HTML page, Markdown, a calendar
file, a CSV deck and JSON data. Nothing needs an account or a server.

## The folder

The skill writes each course to `<workspace>/bilimind-out/<slug>/`:

```
bilimind-out/ds-final/
  index.html            the course page (player + embedded course.json), works offline
  course.json           the course data, schema bilimind.course/1
  plan.md               the Lead's plan: assumptions, weights, kept and cut topics, days, review dates
  REPORT.md             what each agent did, every check, rejections, fixes, cost, wall time
  reviews.ics           study blocks and spaced reviews (Asia/Kuala_Lumpur unless the goal says otherwise)
  deck.csv              Anki import file
  lessons/
    README.md           index of the notes
    01-<key>.md ...     one note per lesson, with citation callouts
  review/state.json     the FSRS review schedule
  audio/*.mp3           narration (Edge TTS)
  img/                  lesson images
  sources/              copies of your files; citation chips open them at the cited page
  crew/                 the crew's workbench (see below)
```

## `index.html`

One self-contained file. The Vue player is inlined as a single module script, and the course data is
embedded in one `<script type="application/json">` tag. Nothing is fetched at start-up, so the page works from
`file://` and from any static host, and is meant to open in WorkBuddy's Preview panel too. (A diagram that was
not drawn at build time loads Mermaid from the internet when it is shown.) It shows:

- the path: kept topics in order with "You are here", and cut topics struck through with the reason;
- lessons whose blocks follow the lesson's archetype (below);
- runnable JavaScript exercises with tests, graded in the page;
- quizzes with citation chips that show the exact text from your file;
- narration with sentence highlighting, and a "Hear the plan" overview;
- "Due today", from the review schedule;
- the receipts: checks run and passed, code tests, rejected and rewritten answers, cost, wall time.

Progress and review state are stored in the browser's `localStorage` under `bm:<course id>:progress` and
`bm:<course id>:fsrs`. Answering in the page reschedules the card locally.

## `course.json` (schema `bilimind.course/1`)

The schema lives in `packages/core/src/course-schema.ts` (zod). `validateCourse(data)` returns
`{ok, course, errors}` and also checks cross-references (every cite, review card and path step points at
something that exists). Field names are snake_case. Top-level fields:

| Field | What it holds |
|---|---|
| `schema`, `id`, `title`, `lede`, `skin`, `language`, `built_at` | Identity and display. `id` is the slug and the `localStorage` prefix. |
| `allows_code`, `code_language` | Whether lessons may contain code exercises, and in which language (JavaScript in the page). |
| `goal` | The sentence, exam time, deadline, minutes per day, audience, assumptions. |
| `plan` | Days (date, lessons, reviews, minutes), past-paper weights (topic, marks, share, questions), cut topics with reasons, capacity and used minutes, warnings. |
| `path` | The ordered steps shown on the home page, including cut topics. |
| `lessons[]` | Each lesson: `id`, `n`, `title`, `summary`, `archetype`, `minutes`, `day`, `formats`, `blocks[]`, `narration`. |
| `narration` | The "Hear the plan" audio and its sentence cues. |
| `receipts` | Files, pages, lessons, agents, checks `{run, passed, repaired, flagged}`, tests `{run, passed}`, code fixes, rejected and rewritten counts, cards, narration minutes, `cost_usd`, `wall_ms`, a short log, and the excluded items with their reasons and quotes. |
| `sources[]` | Your files: title, short label (e.g. `L2`), path under `sources/`, kind, role, pages, how often cited. |
| `exports[]` | Links to the calendar, deck, notes, plan and report. |
| `review` | The review cards and their due dates (the same cards as `review/state.json`). |

### Blocks

A block is `{id, type, title?, payload, cites[], assessments[]}`. Block ids are `b1`, `b2`, ... and item ids
are `q1`, `q2`, ... per lesson. Ids are assigned by `draft` and kept through repairs and rewrites; they are
never renumbered.

The 22 enabled block types:

`explainer`, `example`, `analogy`, `walkthrough`, `checklist`, `project`, `code`, `diagram`, `timeline`,
`comparison`, `reference_table`, `flashcards`, `scenario`, `worked_example`, `playground`, `speaking`,
`dialogue`, `quiz`, `key_points`, `misconception`, `audio`, `reflection`.

### Assessment items

Item kinds: `mcq`, `multi_select`, `short_answer`, `cloze`, `essay`, `project`, `code`, `ordering`,
`numeric`. Each item has a `prompt`, a Bloom level, a grader, `max_score`, and an `answer_key` (for code: a
reference solution and named tests). The page grades deterministic kinds itself; 70% is a pass. Feedback
never reveals the key.

Checker results are stored on the item: `verdict` (`supported`, `not_covered`, `pending`, `unchecked`), the
quote, and `labels` (`beyond_slides` for answers your files do not cover, `rewritten` for an item that
replaced a contradicted one). Contradicted items are excluded from the course and listed in
`receipts.excluded` with the Checker's reason and quote.

### Citations

A cite is `{file, locator, page?, quote, excerpt, chunk_id?}`. `file` matches `sources[].file`
(`sources/<name>`); `locator` is a human label such as "Slide 12" or "Page 3"; `excerpt` holds up to 700
characters of the chunk around the quote.

### Narration

A narration is `{src, duration_ms, voice?, sentences[{id, start_ms, end_ms}], peaks?}`. Sentence cue ids
are `<block id>.<n>` (counted across the block's spoken fields in reading order), `title.0` for the lesson
title, and `plan.<n>` for the overview. Quiz, code, flashcards, checklist, reference table and speaking
blocks are not read aloud.

## Archetypes and mandatory formats

Every lesson has one archetype: the kind of knowledge it teaches. The CLI derives the lesson's formats from
it, and `check` fails a lesson that is missing a mandatory format. A quiz is added to every lesson.

| Archetype | Mandatory formats |
|---|---|
| procedural | walkthrough, checklist |
| conceptual | explainer, diagram, analogy |
| factual | flashcards, reference_table |
| discriminative | comparison, example |
| diagnostic | scenario, diagram |
| quantitative | worked_example, playground |
| spatial | diagram, walkthrough |
| evolutionary | timeline, explainer |
| performance | project, checklist |
| safety_critical | checklist, scenario |
| communicative | speaking, dialogue |

Optional formats per archetype are in `packages/core/src/archetypes.ts`. This mapping and the lesson
prompts come from the team's existing BiliMind app.

## Exports

- **`reviews.ics`**: an iCalendar file (`PRODID:-//BiliMind//BiliMind for WorkBuddy//EN`) with a
  `VTIMEZONE` for the course time zone, one event per study block and one per review session. Import it
  into Google Calendar, Outlook or Apple Calendar.
- **`deck.csv`**: Anki's CSV import format with header lines (`#separator:Comma`, `#html:false`,
  `#notetype:Basic`, `#deck:<course title>`, `#columns:Front,Back,Tags`). It holds every flashcard and
  cloze item; a course with neither gets its short-answer quiz items (MCQ, multi-select, numeric, short
  answer) instead.
- **`lessons/*.md`**: one Markdown note per lesson, with citations as callouts, for Obsidian or any
  Markdown editor.
- **`plan.md`** and **`REPORT.md`**: Markdown. Every number in `REPORT.md` is recomputed from
  `crew/log.jsonl` and the course files.
- **`review/state.json`**: `{version: 1, course_id, exam_at, updated_at, cards}`. Each card has an id
  (`<lesson>/<item>` or `<lesson>/<block>/c<n>` for a flashcard) and its FSRS state. Due dates are capped at
  12 hours before the exam. The calendar and the page's "Due today" list are both generated from this file.

## `crew/`: the workbench

Kept visible on purpose, so anyone can see what the agents did.

| Path | Written by | Contents |
|---|---|---|
| `crew/goal.json` | `init`, `goal` | The sentence, deadline, minutes, audience, language, assumptions |
| `crew/ingest.json` | `ingest` | Files, roles, pages, scanned pages, chunks |
| `crew/outline.json` | `outline` | Topics with archetypes and formats |
| `crew/exam-map.json`, `.md` | `exam-map` | Past-paper questions, marks, matched topics |
| `crew/plan.json` | `plan` | The plan as data |
| `crew/lessons/<key>.json` | `draft`, Writers, `verdict`, `code-test --apply` | Lesson drafts |
| `crew/checks/<key>.json` | `check` | Check results per round |
| `crew/code/<key>-b<n>/` | `code-test --dump`, the Coder | `instructions.md`, `starter.js`, `solution.js`, `tests.json` |
| `crew/evidence/<key>.md` | `evidence` | The packet the Checker reads |
| `crew/verdicts/<key>.json` | `verdict` | Every ruling with its quote, reason and round |
| `crew/narration.json` | `narrate` | Clips, cues, voices |
| `crew/log.jsonl` | every command | Agent label, command, result, time, cost |
| `crew/proof.md` | the Lead | Start and end of each task, how many Writers ran in parallel, rejections, fixes, totals |
| `crew/cache/` | the CLI | Cached model and TTS calls; not for publishing |

When a course is published, only `index.html`, `audio/`, `img/` and `sources/` are copied. `crew/` is never
published.

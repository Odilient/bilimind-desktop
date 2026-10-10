# Output: what every file is

Everything lands in `<workspace>/bilimind-out/<slug>/` (COURSE). The user owns the whole folder; it
works offline and needs no account.

| File | What it is | Opens in |
|---|---|---|
| `index.html` | The course: the path with "You are here", lessons whose formats follow the kind of knowledge, runnable JavaScript exercises, quizzes with citation chips to the user's slides, narration with sentence highlighting, "Due today", and the "Checked before you saw it" receipts | WorkBuddy Preview, any browser, offline (double-click) |
| `plan.md` | What the Lead decided: assumptions, past-paper weights, kept and cut topics with reasons, the day-by-day plan, review dates | WorkBuddy, Obsidian, any Markdown viewer |
| `REPORT.md` | What each agent did: every check run, repairs, the Checker's verdicts with quotes, rejections and rewrites, code test fixes, cost in USD, wall time | WorkBuddy, any Markdown viewer |
| `reviews.ics` | Study blocks and spaced reviews dated backwards from the exam (Asia/Kuala_Lumpur) | Google Calendar, Outlook, Apple Calendar |
| `deck.csv` | Every flashcard and cloze item: front, back, tags | Anki (File > Import) |
| `lessons/NN-<key>.md` | One note per lesson with citation callouts | Obsidian |
| `course.json` | The full data the page uses (schema `bilimind.course/1`) | (data) |
| `review/state.json` | The one review schedule (FSRS cards). The calendar and "Due today" come from it | (data) |
| `audio/*.mp3` | Narration and speaking phrases (Edge TTS voices) | (used by the page) |
| `img/`, `sources/` | The lesson objects, and copies of the user's files that citation chips open at the cited page | (used by the page) |

## The crew's workbench (`crew/`, visible on purpose)

| Path | Written by | Contents |
|---|---|---|
| `crew/goal.json` | `init`, `goal` | The sentence, deadline, minutes, audience, language, assumptions |
| `crew/ingest.json` | `ingest` | Files, roles, pages, scanned pages, chunks |
| `crew/outline.json` | `outline` | Topics with archetypes and formats |
| `crew/exam-map.json`, `.md` | `exam-map` | Past-paper questions, marks, matched topics |
| `crew/plan.json` | `plan` | The plan in data form |
| `crew/lessons/<key>.json` | `draft`, Writers, `verdict`, `code-test --apply` | The lesson drafts |
| `crew/checks/<key>.json` | `check` | Check results per round |
| `crew/code/<key>-b<n>/` | `code-test --dump`, the Coder | instructions.md, starter.js, solution.js, tests.json |
| `crew/evidence/<key>.md` | `evidence` | The packet the Checker reads; `*.rulings.json` are the Checker's inputs |
| `crew/verdicts/<key>.json` | `verdict` | Every ruling with its quote, reason and round |
| `crew/narration.json` | `narrate` | Clips, cues, voices |
| `crew/log.jsonl` | every command | Agent label, command, result, time, cost: REPORT.md and the receipts come only from this |
| `crew/proof.md` | the Lead (last step) | Proof of the run: start and end time of each task, how many Writers ran in parallel, rejections, fixes, totals |

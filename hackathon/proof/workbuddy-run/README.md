# A course built inside WorkBuddy, from one sentence

- **Where:** the WorkBuddy desktop app on our laptop, a new task in the default (Craft) mode, with the BiliMind
  skill installed (`skills/bilimind`, installed with its `install.ps1`).
- **When:** Sunday 11 October 2026, 05:05:43 to 05:20:30 MYT (14 min 47 s from the request to the finished course
  in WorkBuddy's preview panel).
- **The request, the only message typed:**
  > Use the bilimind skill. My Data Structures final is Wednesday 9am. The slides and last year's paper are in
  > C:\Demo\DS-WorkBuddy. I have 45 minutes a day. Get me ready.
- **Source files:** the same 5 Data Structures PDFs as our other runs (4 lecture decks and a past paper, 63 pages).
- **AI:** WorkBuddy's own model ran the crew (the Lead and the sub-agents). The `bilimind` command line the crew
  calls used BiliMind free for its own AI calls, no key.

## What WorkBuddy did, in order

From WorkBuddy's session record (every tool call, in order: [session-tool-calls.json](session-tool-calls.json)):

| Time (MYT) | WorkBuddy tool | What happened |
|---|---|---|
| 05:05:48 | `Skill` | Loaded the **bilimind** skill |
| 05:06:05 | `TaskCreate` ×9 | Made its checklist: understand the goal, read the folder, plan the path, write lessons in parallel, test code, check answers against the slides, narrate, schedule reviews, package and open |
| 05:06–05:10 | `Bash` (the `bilimind` CLI) | As the Lead: `doctor`, `init`, `goal`, `ingest`, `outline`, `exam-map`, then `plan` three times while it tried a different lesson order, with a note on why it kept the first |
| 05:10:28 | `Agent` ×4 | Launched **4 Writer sub-agents in the same second**, one per lesson |
| 05:12:50 | `Agent` ×2 | Launched the **Coder and the Checker in parallel** |
| 05:13–05:17 | (sub-agents) | The Coder found 3 broken code exercises (a missing class, test syntax, test values that contradicted the hash function) and fixed them until the model solution passed every test; the Checker re-solved every auto-marked answer against the slides |
| 05:18–05:19 | `Bash` | `narrate`, `export`, `build` |
| 05:20:04 | `present_files` | Opened the finished course in WorkBuddy's preview panel |

Every step the crew ran is also in the course's own log, with times and costs:
[crew/log.jsonl](../../../showcase/courses/ds-workbuddy/crew/log.jsonl) (60 steps, 7 agents).

## The result

The course: [play it in the browser](https://odilient.github.io/bilimind-desktop/courses/ds-workbuddy/) ·
[what the agents did (REPORT.md)](../../../showcase/courses/ds-workbuddy/REPORT.md). Nothing in it was edited after
the run.

| What | Count |
|---|---|
| Lessons | 4 (3 topics cut, each with a reason) |
| Checks | 103/106 passed, 4 repaired, 3 still flagged |
| Code tests (model solutions) | 16/16, 3 exercises fixed by the Coder |
| Quiz answers re-solved against your files | 15 rulings, 0 wrong keys, 6 labelled "Beyond your slides" |
| Narration | 23.2 min |
| Anki cards | 13 |
| AI cost of the CLI's calls (BiliMind free) | $0.0126 |
| Wall time (crew log, `init` to `build`) | 13 min |

## For comparison: the same sentence without naming the skill

Ten minutes earlier (04:56 MYT) we sent the same sentence without "Use the bilimind skill". WorkBuddy's agent did not
pick the skill. It read the PDFs itself and wrote one static HTML study guide: no checks against the slides, no tested
code, no narration, no exports. So in WorkBuddy, BiliMind is called by name (or by picking the BiliMind Crew expert).

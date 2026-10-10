# Market validation, researched in WorkBuddy (Deep Research)

- Where: WorkBuddy web app, Deep Research mode, model Hy4 preview.
- When: Sun 11 Oct 2026, 01:47 to 01:57 MYT (9 min 54 s).
- Task: https://www.workbuddy.ai/app/task/2108977764853211136
- Screenshot: `workbuddy-web-market-research.jpg`.
- WorkBuddy's full report: `research_report_bilimind_market_validation.md` (8.1 KB, in the task's artifacts).

Why: the organisers advised us to validate the idea with research before building. We asked WorkBuddy to check
demand on both halves of the Track 2 theme (students and small businesses), compare competitors and name the risks.

## What WorkBuddy found (summary of its report, with its sources)

| Finding | Source WorkBuddy cited |
|---|---|
| 95% of undergraduates use AI; 94% use it for assessed work; time saving is the main reason | HEPI/Kortext Student Generative AI Survey 2026 |
| 86% of students worldwide use AI regularly | Digital Education Council Global AI Student Survey 2024 |
| 51% of students are deterred by false results or hallucinations | HEPI/Kortext 2026 |
| Audits find 35% to 60% of AI answers wrong or with significant problems | NewsGuard (Sep 2025), EBU/BBC (Oct 2025), Columbia Tow Center (Mar 2025) |
| Practice testing and spaced practice are the two "high utility" study techniques | Dunlosky et al. |
| Malaysian retail and hospitality attrition was 22.2% in 2025, the highest of any industry (national 18.2%) | Aon, Malaysia salary and turnover study, Dec 2025 |
| Malaysia's F&B sector: 1.07 million workers, 136,453 establishments | DOSM Economic Census 2023 |
| Replacing one crew member costs roughly RM10,000 to RM20,000 (WorkBuddy's estimate: the RM1,700 minimum wage times Gallup's 0.5x to 2x annual salary) | Bernama; Gallup |

Its competitor table: NotebookLM has grounded chat but no code execution and keeps files in Google's cloud; Quizlet has no
per-passage source verification, code or narration; Anki generates nothing; ChatGPT Study Mode has no enforced
grounding in your own files and no offline mode; Trainual costs hundreds of dollars a month and is cloud-only. Its
conclusion: no tool combines files you own, answers verified against your sources, runnable code, narration and offline
use.

## Where we disagree with WorkBuddy, and why

WorkBuddy estimated $0.10 to $0.45 per course plus about $0.60 for paid narration. We measured our real runs instead:
$0.040, $0.094 and $0.055 for the three showcase courses, and $0.046 and $0.047 for unattended runs. Narration uses
free Edge voices, not a paid voice service (see each course's `REPORT.md`). WorkBuddy is right that fully offline
local models are not tested yet. We present them as next steps, not as a result.

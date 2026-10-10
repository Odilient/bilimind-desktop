# BiliMind Crew

A WorkBuddy Expert Team that turns one sentence ("My Data Structures final is Wednesday 9am. The slides
and last year's paper are in this folder. I have 45 minutes a day. Get me ready.") into a checked,
narrated interactive course, a study plan and a review calendar, built only from the user's own files.

Same engine as the `bilimind` skill (bundled in `skills/bilimind`): the team only gives each role its
own member card. Agents decide; the `bilimind` CLI enforces.

| Agent ID | Name | Role |
|---|---|---|
| `bilimind-crew-team-lead` | Dean Bilim ("bilim" = knowledge in Uzbek) | Exam Strategist: reads the goal and the folder, weighs the past paper, plans and cuts, dispatches, packages and delivers |
| `bilimind-writer` | Paige Turner (a page-turner) | Lesson Writer: one per kept lesson, all in parallel; drafts, checks and repairs its lesson |
| `bilimind-coder` | Ada Passmore (Ada Lovelace; makes the tests pass) | Exercise Tester: runs every JavaScript exercise, fixes the side that is wrong |
| `bilimind-checker` | Vera Citewell (veritas; cites well) | Slide Fact-Checker: rules every quiz answer against the slides with a verbatim quote, rewrites contradicted items |

Workflow: Phase 0 the lead (goal, ingest, outline, exam map, plan) -> Phase 1 writers in parallel ->
Phase 2 coder and checker in parallel -> Phase 3 the lead (narrate, export, build, `present_files`
on `index.html`, `plan.md`, `REPORT.md`). Every member reports to the lead with SendMessage.

## Category

`09-OperationsHR` (运营人力: 培训). The crew's job is training: exam revision for students and day-one
onboarding for new staff from an SOP. `04-DataAI` fits the technology, not the user's job.

## Try it

1. My Data Structures final is Wednesday 9am. The slides and last year's paper are in this folder. I have 45 minutes a day. Get me ready.
2. We hire new crew every few weeks. Turn our SOP folder into a day-one course they must pass before their first shift.
3. I'm an international student with zero Malay. Make me a survival course for my first month from the notes in this folder: 20 minutes a day.

## Needs

- Node 22+ (WorkBuddy bundles it) and a DeepSeek or OpenRouter key in `%USERPROFILE%\.bilimind\config.json`.
- `skills/bilimind/` must contain the built `scripts/bilimind.mjs` and `templates/player.html`
  (from the repo: `node apps/cli/scripts/bundle.mjs`, then `node skills/bilimind/scripts/zip-skill.mjs --team`).

## Avatars

`avatars/*.png`: 512x512 geometric cobalt/lime portraits, no text, about 110-170 KB each, drawn as SVG
and rendered with headless Edge by `avatars/src/make-avatars.mjs`.

## Install

Copy this folder to `%USERPROFILE%\.workbuddy-ai\plugins\marketplaces\my-experts\plugins\bilimind-crew`,
then validate and register it with WorkBuddy's own `expert-manager` scripts (`validate_expert.py`,
`register_expert.py`), preferably from inside WorkBuddy so the session marker is written. Steps:
`hackathon/EXPERT-TEAM.md` in the BiliMind repo.

# BiliMind Crew

A WorkBuddy Expert Team (team type) that turns "My exam is Thursday, the slides are in this folder"
into a checked, narrated interactive course, a study plan and a review calendar.

## Type

Team (lead + 3 member roles).

| Agent ID | Name | Role |
|---|---|---|
| bilimind-crew-team-lead | Dina Planwell | Exam Strategist: reads the goal and folder, plans, dispatches, packages |
| bilimind-writer | Lena Page | Lesson Writer (one per lesson, parallel) |
| bilimind-coder | Cody Pass | Exercise Tester |
| bilimind-checker | Vera Quote | Slide Fact-Checker |

## Needs

The `bilimind` skill (SKILL.md + scripts/bilimind.mjs + references/). Either installed as a user skill
(`%USERPROFILE%\.workbuddy-ai\skills\bilimind`) or bundled in this package as `skills/bilimind` with
`"skills": ["./skills/bilimind"]` in `.codebuddy-plugin/plugin.json` (required before sharing the zip).

## Try it

- My Data Structures final is Thursday 9am. The slides and last year's paper are in this folder. I have 45 minutes a day. Get me ready.
- Turn the SOP in this folder into a first-shift training course for our new boba shop staff.
- Make a Bahasa Melayu survival course from these notes: 20 minutes a day for one week.

## Avatars

`avatars/` holds flat placeholders (512x512 PNG). Replace with ImageGen output if wanted:
PNG or JPG, 512x512, at most 500 KB each, one consistent style.

## Install

See `hackathon/EXPERT-TEAM.md` in the BiliMind repo (validate, then register from inside WorkBuddy).

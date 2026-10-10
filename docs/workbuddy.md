# How, where and in what scenario we used WorkBuddy

The Dormathon organisers clarified that WorkBuddy does not have to be integrated into the solution: every
Track 2 team shows proof that it used WorkBuddy and explains how, where and in what scenario. This page is
that explanation, with links and screenshots.

**To be clear about what was built where.** Our product is BiliMind Desktop, an open-source Electron app.
The desktop app, the engine and the three showcase courses were built by our team with AI coding agents
outside WorkBuddy. WorkBuddy was a work tool for us during Dormathon (the pitch deck, a comparison, reviews),
and BiliMind also ships as a WorkBuddy skill and Expert Team so WorkBuddy users can run it there.

## Summary

| # | Where | Scenario | Proof |
|---|---|---|---|
| a | WorkBuddy web app, Slides Creation | Generated our pitch deck from a written brief and screenshots, then reviewed and corrected it slide by slide | Task https://www.workbuddy.ai/app/task/2108960359124951040, `hackathon/proof/workbuddy-web-deck-task.jpg`, `hackathon/proof/workbuddy-web-deck-slide5-review.jpg`, `pitch/BiliMind-Dormathon-Deck.pdf` |
| b | WorkBuddy web app, plain chat | Sent our student request to plain WorkBuddy to see what a general agent does without BiliMind | Task https://www.workbuddy.ai/app/task/2108963860471234560, `hackathon/proof/workbuddy-web-plain-comparison.jpg` |
| c | WorkBuddy desktop app | Studied its skill and Expert Team format and shipped BiliMind as a WorkBuddy skill and Expert Team, validated with WorkBuddy's own `validate_expert.py` | `skills/bilimind/`, `workbuddy/bilimind-crew/`, `hackathon/SPIKE.md`, `hackathon/EXPERT-TEAM.md` |
| d | WorkBuddy web app, Deep Research | Market validation (Sunday 01:47 to 01:57 MYT): demand on both halves of Track 2 (students and small businesses), competitors and risks | Task https://www.workbuddy.ai/app/task/2108977764853211136, `hackathon/proof/workbuddy-market-validation.md`, `hackathon/proof/workbuddy-web-market-research.jpg` |
| e | WorkBuddy (Sunday) | Documentation review and an app review | See [More WorkBuddy work on Sunday](#more-workbuddy-work-on-sunday) |

## (a) The pitch deck, made in WorkBuddy

- **Where:** the WorkBuddy web app (workbuddy.ai/app), Slides Creation.
- **How:** we wrote an 8-slide brief (`hackathon/SLIDES-BRIEF.md`: structure, style, real numbers only) and
  attached five screenshots (`hackathon/proof/deck-assets/`). WorkBuddy generated the deck; we reviewed it
  slide by slide, asked WorkBuddy for four factual corrections and downloaded the PDF
  (`pitch/BiliMind-Dormathon-Deck.pdf`).
- **When:** Sunday 11 October, about 00:38 to 01:07 MYT.
- **Next:** the deck is regenerated in WorkBuddy for the desktop app from the new brief in
  `hackathon/SLIDES-BRIEF.md`.

## (b) Plain WorkBuddy on the same student request

- **Where:** the WorkBuddy web app.
- **How:** we sent the hero sentence ("My Data Structures final is Wednesday 9am. The slides and last year's
  paper are in this folder. I have 45 minutes a day. Get me ready.") to WorkBuddy without BiliMind.
- **What we saw:** a reasonable 3-day plan, but no citations to the slides, no narration, no tested code and
  no exports. That gap is what BiliMind Desktop fills: answers checked against your own files, runnable code,
  narration, an Anki deck and a calendar, in a folder you own.
- **When:** Sunday 11 October, about 00:40 to 01:00 MYT.

## (c) BiliMind as a WorkBuddy skill and Expert Team

- **Where:** the WorkBuddy desktop app (international build) on our Windows laptop; data folder
  `%USERPROFILE%\.workbuddy-ai`.
- **How:** we read WorkBuddy's tool list, skills folder and Expert Team format, then packaged the same engine
  that powers the desktop app as:
  - a **skill** (`skills/bilimind/`): the Lead's playbook, a nine-step task checklist, Writer sub-agents in
    parallel, a Coder and a Checker, ending with `present_files` opening the course in WorkBuddy's Preview;
  - an **Expert Team** "BiliMind Crew" (`workbuddy/bilimind-crew/`): Dean Bilim (lead), Paige Turner
    (Lesson Writer), Ada Passmore (Exercise Tester), Vera Citewell (Slide Fact-Checker). We validated it with
    WorkBuddy's own `validate_expert.py` and registered it with `register_expert.py`, so it appears in
    "My Experts".
- **Scenario:** a WorkBuddy user sets the workspace to their folder and types one sentence; they get the same
  course the desktop app makes.
- **When:** Saturday 10 October evening (spike) to about 23:55 (team registered).

| WorkBuddy feature | How the skill uses it | Where in this repo |
|---|---|---|
| Skills | The Lead's rules and steps; triggers on exam, past paper, revision, SOP, onboarding | `skills/bilimind/SKILL.md`, `references/*.md` |
| Expert Team | Lead + three members with cards and avatars | `workbuddy/bilimind-crew/.codebuddy-plugin/plugin.json`, `agents/*.md` |
| Sub-agents | One Writer per lesson in parallel (at most 6), then Coder and Checker in parallel | SKILL.md steps 4 and 5 |
| Task checklist | Nine items moved to in progress and completed as the crew works | SKILL.md step 0 |
| Shell + bundled Node 22 | Every agent calls the bundled `bilimind.mjs` CLI | `skills/bilimind/scripts/bilimind.mjs` |
| Preview panel | Opens `index.html`, `plan.md` and `REPORT.md` | SKILL.md step 8 |
| expert-manager | `validate_expert.py`, `register_expert.py` | `hackathon/EXPERT-TEAM.md` |

## More WorkBuddy work on Sunday

| When (MYT) | What we did in WorkBuddy | Proof |
|---|---|---|
| Sun 11 Oct | Documentation review: README and docs reviewed in WorkBuddy for clarity and accuracy | (pending) |
| Sun 11 Oct | App review: BiliMind Desktop reviewed in WorkBuddy (flow, wording, first-run experience) | (pending) |
| Sun 11 Oct | Pitch deck regenerated for the desktop app in Slides Creation | (pending) |

## Credits and cost

| Pool | What it paid for | Measured |
|---|---|---|
| WorkBuddy credits | The deck, the comparison and the reviews above | Not itemised |
| DeepSeek or OpenRouter (user's own key) | Course text in the desktop app | About $0.05 per course in unattended runs ($0.046 and $0.047); showcase courses $0.040, $0.094 and $0.055 |
| Edge voices | Narration | Free |

## Practical notes for other WorkBuddy builders

Things we found on our machine that are not obvious from the docs:

- The international build keeps its data in `~/.workbuddy-ai`, not `~/.workbuddy`. Inside WorkBuddy the app
  sets `WORKBUDDY_CONFIG_DIR` and `CODEBUDDY_CONFIG_DIR` for the agent's processes.
- Copying a folder into `~/.workbuddy-ai/skills/` installs a skill live; frontmatter `name`, `description`,
  `description_en` and `version` are picked up.
- WorkBuddy's shell does not see environment variables set in your own terminal unless WorkBuddy is fully
  restarted, so our CLI reads keys from `~/.bilimind/config.json`.
- The Bash tool stops a command after 120 s unless you pass a timeout, and then the agent never sees the
  output. Our long commands (outline, draft, narrate, build) always pass 600 s and are cached so a rerun resumes.
- An Agent call without `name` runs to the end and returns the sub-agent's final text; several such calls in
  one message run in parallel. A named Agent call becomes a team member that answers by mailbox.
- There is no Artifact tool in Work mode; `present_files` opens files in the Preview panel.
- `workbuddy_sites_deploy` needs the user's explicit wording to publish in the same turn.
- An Expert Team is adopted into "My Experts" only when `register_expert.py` writes `.created-by-session`,
  which happens automatically when it runs inside WorkBuddy. Agent `.md` files need LF line endings.
- Ask mode is read-only and Quick mode has no tools, so a skill that runs commands needs a Work mode
  (Craft, Plan or Expert).

## Thanks

To the WorkBuddy team for the platform, and to the Dormathon 2026 organisers at Taylor's University.

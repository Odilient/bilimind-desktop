# How, where and when we used WorkBuddy

The Dormathon organisers asked every Track 2 team to show proof that they used WorkBuddy and to explain how,
where and in what scenario. This page is that explanation.

**Short version.** The organisers confirmed that WorkBuddy does not have to be built into the solution;
teams show proof that they used it. We used it in two ways:

1. **As the platform we built for.** BiliMind ships as a WorkBuddy **skill** (`skills/bilimind/`) and a
   WorkBuddy **Expert Team** (`workbuddy/bilimind-crew/`). We studied WorkBuddy's skill and Expert Team
   formats on our laptop, validated our package with WorkBuddy's own `validate_expert.py` and registered
   the team into "My Experts". In this design a student types one sentence into WorkBuddy; WorkBuddy's
   agent loop plays the Lead, launches Writer sub-agents in parallel, then a Coder and a Checker, and opens
   the course in its Preview panel. There is no BiliMind server.
2. **As a work tool during Dormathon.** The 8-slide pitch deck was generated in the WorkBuddy web app
   (Slides Creation), and we ran the same student request in plain WorkBuddy to compare the result with
   BiliMind's.

The three showcase courses were generated with the same CLI and crew playbook by our build agents outside
WorkBuddy. We do not claim they were made inside WorkBuddy.

## The scenario

A university student has a Data Structures final on Wednesday at 9:00, a folder with four lecture decks and
last year's paper, and 45 minutes a day. In WorkBuddy they set the workspace to that folder and type:

> My Data Structures final is Wednesday 9am. The slides and last year's paper are in this folder.
> I have 45 minutes a day. Get me ready.

That is the only message. The same flow works for a shop owner onboarding new staff from an SOP ("We hire new
crew every few weeks. Turn our SOP folder into a day-one course...") and for an international student
learning survival Malay. All three prompts are the Expert Team's quick prompts in `plugin.json`.

## How: the WorkBuddy features we use

| WorkBuddy feature | How BiliMind uses it | Where in this repo |
|---|---|---|
| **Skills** (user skill in `~/.workbuddy-ai/skills/<name>/SKILL.md`) | The `bilimind` skill is the Lead's playbook: rules (never ask the user a question, write only inside `bilimind-out/`, never touch the key), the nine steps, and the final reply format. It triggers on exam, past paper, revision, SOP, onboarding and similar words. It finds its own folder through `${CODEBUDDY_SKILL_DIR}`. | `skills/bilimind/SKILL.md`, `skills/bilimind/references/*.md`, `skills/bilimind/install.ps1` |
| **Expert Team** (custom expert package with a lead and members) | "BiliMind Crew": Dean Bilim (lead, Exam Strategist), Paige Turner (Lesson Writer), Ada Passmore (Exercise Tester), Vera Citewell (Slide Fact-Checker), each with an avatar and a member card. The lead preloads the `bilimind` skill; members get their playbooks synced into their agent files. | `workbuddy/bilimind-crew/.codebuddy-plugin/plugin.json`, `settings.json`, `agents/*.md`, `avatars/` |
| **Sub-agents** (Agent tool; TeamCreate and SendMessage in team mode) | One Writer per kept lesson, all launched in one message so they run in parallel (at most 6). Then the Coder and the Checker in parallel. In skill mode each Agent call returns the member's one-line report; in Expert Team mode members report to the lead with SendMessage. | SKILL.md steps 4 and 5; `agents/bilimind-crew-team-lead.md` |
| **Task checklist** (TaskCreate, TaskUpdate) | Nine tasks, created at the start and moved to `in_progress` and `completed` as the crew works: Understand the goal, Read the folder, Plan the path, Write lessons (parallel), Test code, Check answers against the slides, Narrate, Schedule reviews, Package and open. WorkBuddy shows them as its plan view. | SKILL.md step 0 |
| **Shell** (Bash tool, Git Bash, WorkBuddy's bundled Node 22) | Every agent calls our CLI: `node "SKILL_DIR/scripts/bilimind.mjs" <command> --course ... --as "<agent>"`. The CLI is bundled for Node 22 because WorkBuddy puts its own Node 22 first on PATH. Long commands pass the Bash tool a 600 s timeout. | `apps/cli/scripts/bundle.mjs`, `skills/bilimind/scripts/bilimind.mjs` |
| **Workspace files** (Read, Edit, Write) | Writers edit their lesson JSON to repair small faults; the Coder edits `solution.js`, `starter.js` and `tests.json`; the Lead writes `crew/proof.md`. Everything stays in `bilimind-out/<slug>/` in the user's workspace. | `skills/bilimind/references/writer.md`, `coder.md` |
| **Preview panel** (`present_files`) | The skill's last tool call opens `index.html`, `plan.md` and `REPORT.md`. The course plays inside WorkBuddy, offline. | SKILL.md step 8 |
| **Sites** (`workbuddy_sites_deploy`) | Only when the user's own message asks to publish: the Lead copies `index.html`, `audio/`, `img/` and `sources/` (never `crew/`) into `site/` and publishes it as a public link. | SKILL.md step 8.4 |
| **WorkBuddy's model and credits** | All agent reasoning (planning, repairs, code fixes, the Checker's rulings) runs on WorkBuddy's model and spends WorkBuddy credits. Lesson drafts run through the CLI on the user's own DeepSeek or OpenRouter key. So the Checker rules on answers written by a different model. | SKILL.md rules; `docs/how-it-works.md` |
| **expert-manager** (WorkBuddy's built-in skill and scripts) | We validated the Expert Team package with WorkBuddy's own `validate_expert.py` and register it with `register_expert.py`, run from inside WorkBuddy so the team appears in "My Experts". | `hackathon/EXPERT-TEAM.md` |

What the agents decide and what our code enforces is described in [how-it-works.md](how-it-works.md).

## Where

- **WorkBuddy desktop app** (international build) on the team's Windows laptop. Its data folder is
  `%USERPROFILE%\.workbuddy-ai`; the skill is installed in `skills\bilimind` under it, and the Expert Team in
  `plugins\marketplaces\my-experts\plugins\bilimind-crew`.
- **Work modes** with tools (Craft, Plan, Expert). Ask mode is read-only and Quick mode has no tools, so the
  skill cannot run there.
- **WorkBuddy web app** (workbuddy.ai/app) for the slides and documents: the 8-slide pitch deck was generated by WorkBuddy's Slides Creation from our brief and screenshots (task https://www.workbuddy.ai/app/task/2108960359124951040).
- **Hosting**: the deployed site https://bilimind-workbuddy-55b817.gitlab.io/ is served by GitLab Pages from this repo (the full site with narration audio is ~57 MB, too large for a browser upload into WorkBuddy's web app).

## When (Dormathon, 10-11 October 2026, times in MYT)

| When | What we did in WorkBuddy | Proof |
|---|---|---|
| Sat 10 Oct, evening | Spike: read WorkBuddy's tool list, skills folder and Expert Team format on this machine; drafted the Expert Team package and validated it with WorkBuddy's own validator; checked the bundled Node and Python | `hackathon/SPIKE.md`, `hackathon/EXPERT-TEAM.md` |
| Sat 10 Oct, ~23:55 | Expert Team "BiliMind Crew" registered into WorkBuddy (My Experts) with WorkBuddy's own `validate_expert.py` / `register_expert.py`; skill installed into its skills folder | `workbuddy/bilimind-crew/`, `skills/bilimind/` |
| Sun 11 Oct, 00:00-00:40 | Showcase courses (Data Structures final, Mutiara Tea Bar day one, Bahasa Melayu survival) generated with the same CLI and crew playbook, run by our build agents outside WorkBuddy | `showcase/courses/*/REPORT.md` |
| Sun 11 Oct, 00:38 | Pitch deck generated in the WorkBuddy web app (Slides Creation, model Hy4 preview) from our brief + 5 screenshots | https://www.workbuddy.ai/app/task/2108960359124951040, `hackathon/proof/workbuddy-web-deck-task.jpg`, `hackathon/proof/deck-assets/` |
| Sun 11 Oct, 00:41 | Site published (GitLab Pages) | https://bilimind-workbuddy-55b817.gitlab.io/ |
| Sun 11 Oct, 00:40-01:00 | The hero sentence in the WorkBuddy web app without BiliMind, for comparison: a reasonable 3-day plan, but no citations to the slides, no narration, no tested code and no exports | https://www.workbuddy.ai/app/task/2108963860471234560, `hackathon/proof/workbuddy-web-plain-comparison.jpg` |
| Sun 11 Oct, 00:50-01:07 | Deck reviewed slide by slide; four factual corrections applied in WorkBuddy and the final PDF downloaded | `hackathon/proof/workbuddy-web-deck-slide5-review.jpg`, `pitch/BiliMind-Dormathon-Deck.pdf` |
| Sun 11 Oct, 10:00-13:00 | Live demo: WorkBuddy on the projector for the whole pitch | - |

Screenshots of each step go in `hackathon/proof/`.

## What a judge sees in WorkBuddy during a run

1. The skill appears in the Skills list (or the BiliMind Crew in My Experts).
2. One user message. The nine-item checklist appears and fills in as the crew works.
3. The Lead's plan in a few lines: assumptions, past-paper weights, kept lessons by day, cut topics with
   reasons.
4. Several Writer cards running at the same time, each ending with a one-line report.
5. The Coder's report (an exercise failed, was fixed, passed) and the Checker's report (an answer rejected
   with a quote from the slides, rewritten, ruled again).
6. The course opening in the Preview panel, with `plan.md` and `REPORT.md` next to it.

## Credits and cost

| Pool | What it pays for | Measured |
|---|---|---|
| WorkBuddy credits | All agent turns: Lead, Writers, Coder, Checker | Not measured yet for a course run (the showcase courses ran outside WorkBuddy) |
| DeepSeek or OpenRouter (user's own key) | Outline, lesson drafts, rewrites | About $0.05 per course in unattended runs ($0.046 and $0.047); showcase courses $0.040, $0.094 and $0.055 |
| Edge TTS | Narration | Free |

WorkBuddy's docs say an Expert Team costs about 3 to 5 times the credits of a single expert, so we rehearse
with the plain skill and use the team where member cards matter.

## Practical notes for other WorkBuddy builders

Things we found on our machine that are not obvious from the docs:

- The international build keeps its data in `~/.workbuddy-ai`, not `~/.workbuddy`. Inside WorkBuddy the app
  sets `WORKBUDDY_CONFIG_DIR` and `CODEBUDDY_CONFIG_DIR` for the agent's processes.
- Copying a folder into `~/.workbuddy-ai/skills/` installs a skill live; frontmatter `name`, `description`,
  `description_en` and `version` are picked up.
- WorkBuddy's shell does not see environment variables set in your own terminal unless WorkBuddy is fully
  restarted, so the CLI reads keys from `~/.bilimind/config.json`.
- The Bash tool stops a command after 120 s unless you pass a timeout, and then the agent never sees the
  output. Our long commands (outline, draft, narrate, build) always pass 600 s and are cached so a rerun resumes.
- An Agent call without `name` runs to the end and returns the sub-agent's final text; several such calls in
  one message run in parallel. A named Agent call becomes a team member that answers by mailbox.
- There is no Artifact tool in Work mode; `present_files` opens files in the Preview panel.
- `workbuddy_sites_deploy` needs the user's explicit wording to publish in the same turn.
- An Expert Team is adopted into "My Experts" only when `register_expert.py` writes `.created-by-session`,
  which happens automatically when it runs inside WorkBuddy. Agent `.md` files need LF line endings.

## Thanks

To the WorkBuddy team for the platform, and to the Dormathon 2026 organisers at Taylor's
University.

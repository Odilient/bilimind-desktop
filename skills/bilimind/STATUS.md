# WP7 skill + WP16 Expert Team: status

Owner lane: `skills/bilimind/` (SKILL.md, references/, install.ps1, scripts/zip-skill.mjs, test/) and
`workbuddy/bilimind-crew/` (the Expert Team package). `scripts/bilimind.mjs`, `scripts/sql-wasm.wasm`,
`templates/player.html` and `assets/obj-*.webp` are WP6 bundle output; this lane only ships them.

## Works

- **SKILL.md** (about 170 lines): the Lead's playbook from PLAN 2.6. It never asks the user anything,
  creates a 9-task TaskCreate checklist, then runs doctor, init, goal (assumptions recorded), ingest
  (fixes roles), outline, exam-map (with `--assign` fixes) and plan (keep/cut/order using
  references/planning.md). It launches one Writer sub-agent per kept lesson IN PARALLEL with the Agent
  tool, then the Coder and the Checker in parallel, then narrate, export and build. It ENDS with
  `present_files` on index.html, plan.md and REPORT.md. The final reply gives counts, checks,
  rejections and rewrites, cost, credits and wall time. Publishing with `workbuddy_sites_deploy` happens
  only when the user's own message asks for it. `run` (the desktop app's fixed pipeline) appears only as
  "never call `run`". The description
  carries the trigger words (exam, final, lecture slides, past paper, revision, course, onboarding, SOP,
  staff training, study plan, flashcards, quiz). Every command and flag in the playbooks exists in the
  built CLI (a test checks this against `bilimind.mjs <cmd> --help`).
- **references/**: writer.md, coder.md and checker.md (playbooks of 27-33 lines, each between
  `<!-- playbook:start/end -->` markers), planning.md (capacity, weights, what to cut first, order,
  example cut reasons), output-spec.md and troubleshooting.md (key, budget, sandbox, scanned pages,
  Edge TTS 403, Git Bash paths, quoting, sub-agent failures, Preview).
- **install.ps1** (Windows PowerShell 5.1, ASCII only): copies the runtime files to
  `%WORKBUDDY_CONFIG_DIR%\skills\bilimind` (default `C:\Users\User\.workbuddy-ai\skills\bilimind`, the
  folder WorkBuddy watches). `-Workspace <dir>` also copies to `<dir>\.codebuddy\skills\bilimind`, and
  `-Target <dir>` installs somewhere else (used by the tests). It replaces only an earlier BiliMind
  install or an empty folder. It skips dev files, and it never reads or prints a key: it only reports
  whether `%USERPROFILE%\.bilimind\config.json` exists. Tested against scratch folders only.
- **scripts/zip-skill.mjs** (dev tool; not shipped):
  - (no flag) writes `skills/dist/bilimind-skill.zip`: 19 files, about 1.8 MB, SKILL.md at the root, forward slashes.
  - `--team` syncs the playbook blocks into the member agent files (LF), copies the skill into
    `workbuddy/bilimind-crew/skills/bilimind` and writes `skills/dist/bilimind-crew.zip` (about 2.4 MB).
  - `--check` verifies only (exit 1 on drift).
  `skills/dist/` is git-ignored.
- **Expert Team** `workbuddy/bilimind-crew/` (started from the spike package; the agent IDs are
  unchanged):
  - lead: Dean Bilim, Exam Strategist. Its prompt is the skill as a team: TeamCreate first (loaded via
    ToolSearch if deferred), writers spawned in ONE message with `subagent_type` = `bilimind-writer`
    and unique names `bilimind-writer`, `-2`, `-3` and so on, then Coder and Checker in ONE message,
    all reports relayed through the lead, `present_files` last. It also has a routing table, preset
    workflows (exam, onboarding, language), the iron rules and the red lines.
  - members: Paige Turner (Lesson Writer), Ada Passmore (Exercise Tester) and Vera Citewell (Slide
    Fact-Checker). Their prompts are the references playbooks plus a SendMessage report section.
  - plugin.json: 3 tags, 3 quickPrompts (the first is defaultInitPrompt = the hero sentence),
    displayDescription.zh is 50 characters, categoryId `09-OperationsHR`, `"skills": ["./skills/bilimind"]`.
  - settings.json: `{"agent": "bilimind-crew-team-lead"}`.
  - Avatars: 5 PNGs, 512x512, 110-170 KB each. They are geometric cobalt/lime portraits with no text,
    drawn as SVG and rendered by headless Edge (`avatars/src/make-avatars.mjs`).
  - WorkBuddy's own `validate_expert.py` reports "Expert package is valid!" with no warnings. A dry-run
    `register_expert.py` into a SCRATCH config folder also succeeded. Then it was registered for real on
    this laptop (10 October, from our terminal, `--session-id dormathon-build`), and WorkBuddy adopted it
    into My Experts. Details: `workbuddy/bilimind-crew/STATUS.md`.
- **Tests**: `node --test skills/bilimind/test/skill.test.mjs` passes 12 of 12. It covers the
  frontmatter and trigger words, the playbook rules, CLI commands and flags against the bundle,
  playbook sync, agent frontmatter (LF, no tools), the plugin.json spec, avatar size and dimensions, a
  zip round trip, `validate_expert.py` in a scratch config folder, and install.ps1 into a temp folder.
  Run the file path, not the directory, because `node --test <dir>` fails on Windows.
- The bundle `doctor` also runs under WorkBuddy's bundled Node 22.22.2 (key from the user config;
  the clock skew of 8 h is reported).

## Stubbed / not verified

- Nothing has been run inside WorkBuddy yet: the parallel Agent spawns, the TeamCreate/SendMessage
  relay, `${CODEBUDDY_SKILL_DIR}` substitution and `present_files` are all written to the documented
  behaviour (spike facts) but are untested. That is gate G3, a first real run inside WorkBuddy.
- Open team questions (EXPERT-TEAM.md section 8): T2 (are repeated member names allowed? the lead
  already uses unique `-2`/`-3` names), T3 (does TeamCreate load cleanly?), T5 (does a preloaded skill
  substitute its folder? the lead has an `ls` fallback over both install locations).
- No LLM spend in this lane. Only doctor, init, goal, ingest, status and note were smoke-tested, on the
  ds-final sources in a scratch workspace.

## Next

1. After WP6's final bundle: `node skills/bilimind/scripts/zip-skill.mjs --team` (refreshes the team's
   copy of bilimind.mjs and the player; `--check` fails while they are stale), then rerun the tests.
2. Install the skill: `powershell -ExecutionPolicy Bypass -File skills\bilimind\install.ps1` (optionally
   `-Workspace C:\Demo\DS-Final`). Done on this laptop.
3. Register the team: follow hackathon/EXPERT-TEAM.md steps B-E, but copy from
   **`workbuddy/bilimind-crew`** (not the spike draft). Done on this laptop; after any rebuild, copy again
   and re-run register (it updates in place).
4. G3: run the hero sentence and read the transcript. Check for zero questions, 4 parallel Writers,
   the Coder and Checker in parallel, present_files last and a real rejection in REPORT.md. Tune the
   SKILL.md wording on anything the agent misreads.

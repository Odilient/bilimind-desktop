# WorkBuddy spike (H4): what to paste, what to look for, results form

Owner at the keyboard, about 15 minutes, about 10-40 credits. The skill is already installed; there is
nothing to upload. Telegram is cut (PLAN 0b), so S11 is gone.

Kit: `hackathon/spike/` (skill source `bilimind-spike/`, upload zip `bilimind-spike.zip`, workspace
folder `workspace/`, Expert Team draft `expert-team/bilimind-crew/`, rebuild with
`node hackathon/spike/tools/build.mjs`).

---

## 0. Already verified on this PC (no need to test again)

Checked on 2026-10-10 by reading WorkBuddy's install and its config folder. Evidence in brackets.

| Fact | What it means for us |
|---|---|
| The skill `bilimind-spike` is installed and enabled (WorkBuddy's own skill list cache now lists it, source "userSettings", from `C:\Users\User\.workbuddy-ai\skills\bilimind-spike\SKILL.md`) | Copying a folder into `%USERPROFILE%\.workbuddy-ai\skills\<name>\` is a working install. No zip upload needed on this PC |
| Config folder is `C:\Users\User\.workbuddy-ai` (international build; data folder name `.workbuddy-ai`, not `.workbuddy`). The app passes `WORKBUDDY_CONFIG_DIR` and `CODEBUDDY_CONFIG_DIR` to the agent's processes [app.asar] | Scripts run by the agent see the right folder. Scripts run from our own terminal must set it (EXPERT-TEAM.md) |
| WorkBuddy's shell is Git Bash from its bundled PortableGit, and its PATH puts the bundled **Node 22.22.2** before the system Node 24 [shell snapshot in `.workbuddy-ai\shell-snapshots\`] | Inside WorkBuddy, `node` is almost certainly v22.22.2. WP6's bundle must run on Node 22 (esbuild target `node22`). The spike confirms it |
| Tools the agent has in the Craft / Plan / Expert modes: Read, Write, Edit, Glob, Grep, Bash, PowerShell, TaskCreate, TaskGet, TaskUpdate, TaskList, TaskStop, TaskOutput, WebFetch, WebSearch, Skill, AskUserQuestion, Agent, SendMessage, TeamCreate/TeamDelete (deferred), ImageGen/VideoGen (deferred), ToolSearch, present_files, show_widget, automation_update, workbuddy_sites_deploy (deferred) [`interactionmode/*/fragments/interaction.md`]. Ask mode is read-only; Quick mode has no tools | Use Craft (default work) mode for the demo, never Ask or Quick |
| The Preview panel is opened by the tool **`present_files`** ("for HTML files it automatically opens a live preview panel AND lists them as artifact cards"; it also previews http/https URLs) [`result-presentation.md`] | SKILL.md (WP7) must end with a `present_files` call on `index.html`, `plan.md`, `REPORT.md` |
| TaskCreate / TaskUpdate / TaskList / TodoWrite results are turned into WorkBuddy's plan/checklist view [app.asar] | S5 is very likely yes; the spike shows how it looks |
| There is **no `Artifact` tool** in the Work-mode tool list. Sharing goes through the built-in "Publish as app" skill (`sites`, tool `workbuddy_sites_deploy`): it publishes a static folder (or a Node/Python app) as an online link, and needs the user's explicit "publish" in that same turn | S10 becomes "can WorkBuddy host the course?". If yes, that link can be our **deployed application link**, made with WorkBuddy (optional message 3 below) |
| Expert Teams: `my-experts` marketplace exists but is empty; registration needs a `.created-by-session` marker (see `hackathon/EXPERT-TEAM.md`) | WP16 can register from inside WorkBuddy in 2 minutes |
| Bundled CodeBuddy CLI: `C:\Program Files\WorkBuddyAI\resources\app.asar.unpacked\cli\bin\codebuddy`, version 2.156.0 | S12 can be tried without installing anything (optional message 4) |
| From this PC (not from inside WorkBuddy yet): api.deepseek.com, openrouter.ai, speech.platform.bing.com and cdn.jsdelivr.net all answer in 100-350 ms | Network is fine; the spike shows whether WorkBuddy's sandbox asks for permission |
| The spike page via `file://` in Edge: audio, Blob worker, killed infinite loop, localStorage, CDN fetch, MediaRecorder all PASS; `fetch()` of a sibling file FAILS (expected on `file://`) | Baseline to compare the Preview panel against |
| `DEEPSEEK_API_KEY` and `OPENROUTER_API_KEY` are not set as environment variables in a normal shell; `%USERPROFILE%\.bilimind\config.json` does not exist | WorkBuddy will not see the keys either. Either `setx` both keys and fully restart WorkBuddy, or WP1's `config.ts` must also read `%USERPROFILE%\.bilimind\config.json` |

### The clock is still wrong (measured 09:01 local time)

`hello.mjs info --net` asked four internet servers for their time. All four say this PC is **exactly
8.0 hours behind** (skew +28800 s). Windows now shows the Asia/Singapore time zone, but the time
itself was not corrected, so the PC thinks it is about 09:00 when it is about 17:00 MYT. Edge TTS
narration (and possibly WorkBuddy sign-in) will fail until this is fixed.

Fix (1 minute): Windows Settings → Time & language → Date & time → "Set time automatically" ON →
"Sync now". Time zone: (UTC+08:00) Kuala Lumpur, Singapore. The taskbar clock must then show the real
Malaysian time. Step 1 of the spike prints `clock_check: ok` when it is fixed.

---

## 1. Before you start (2 minutes)

1. Fix the clock (above).
2. WorkBuddy Settings: Language English, **Compact Mode OFF** (so tool calls are visible), Prevent
   Sleep ON. Leave the permission mode at its default for this run (we want to see the prompts).
3. Write down the credit balance (form below, "credits before").
4. Open "Experts · Skills · Connectors" (or "Skills") and check that **bilimind-spike** is listed and on.
   Screenshot `spike-01-skills.png`.
5. New task. Mode: the default work mode (Craft), not Ask or Quick. Model: leave on Auto/default; note
   which one it shows.
6. Workspace: input box, bottom right, "Select Folder" →
   `C:\oybek\projects\bilimind\bilimind-desktop\hackathon\spike\workspace`
7. Start a timer when you press Enter.

## 2. Message 1: the spike (paste exactly)

Type `/bilimind-spike` and pick it from the menu, or paste this sentence:

```
Run the bilimind spike.
```

Do not type anything else until it finishes (about 2-4 minutes). If a permission prompt appears, allow
it, and write down the exact prompt text and which command caused it.

What to watch, with screenshots:

| Look for | Screenshot |
|---|---|
| The skill "capsule" or a "using skill bilimind-spike" line at the top | `spike-02-skill-used.png` |
| A checklist with 4 items that tick off one by one (TaskCreate) | `spike-03-checklist.png` |
| The command for step 1: did it run in Bash or PowerShell? Any permission prompt? | `spike-04-first-command.png` |
| **Writer 1/2/3: separate cards? side by side? all "running" at once?** Click one card: what opens? | `spike-05-writers.png` (most important screenshot of the spike) |
| The `report` output line `verdict:` (PARALLEL / PARTLY / SEQUENTIAL) and `wall_s` | `spike-06-verdict.png` |
| The Preview panel opens with "BiliMind spike: does WorkBuddy's Preview run our course page?" | `spike-07-preview.png` |
| The Results panel tabs (exact English names) and whether `SPIKE-RESULT.md` shows as an artifact | `spike-08-results-panel.png` |

## 3. In the Preview panel (2 minutes)

1. Press **Play**. Then click "Yes, I heard it" or "No sound".
2. Click "Open slide 3 (new tab)". Note where it opens (Preview tab, Edge, nothing) and which slide shows.
   Go back if needed; then "Open slide 3 (same tab)". Click the matching answer button.
3. Click "Reload this page". The visit counter must go up by 1. Then close the Preview panel, reopen
   `spike-out/spike.html` from the Results panel, and check the counter went up again.
4. Optional: "Try the microphone (2 s)". Note whether a microphone permission prompt appears.
5. Click "Copy results" (or select the box and Ctrl+C) and paste it into section 6 below.

## 4. Message 2: workspace skill (S2, 30 seconds)

Type `/bilimind-spike-ws` and pick it from the menu (if it is not in the menu, that already answers S2:
no). Or paste:

```
Use the bilimind-spike-ws skill.
```

Expected reply: `WORKSPACE SKILL LOADED (S2 = yes). Skill folder: ...`

## 5. Optional messages (owner's call)

**Message 3, hosting test (S10, creates a PUBLIC link; the page has no personal data).** Only if you are
fine with a public test link:

```
Publish the spike-out folder in this workspace as an online link, with spike.html as the entry page. I confirm I want it published.
```

Record the link, whether it opens on your phone without signing in, and whether audio and the slide-3
link work there. Unpublish later from Settings → Data Management → Published Apps, or ask
"Unpublish the spike-out app".

**Message 4, CLI (S12).** In a PowerShell window (not WorkBuddy). It runs one tiny prompt on your
WorkBuddy account (a few credits):

```
$env:WORKBUDDY_CONFIG_DIR = "C:\Users\User\.workbuddy-ai"
$env:CODEBUDDY_CONFIG_DIR = "C:\Users\User\.workbuddy-ai"
node "C:\Program Files\WorkBuddyAI\resources\app.asar.unpacked\cli\bin\codebuddy" -p "Reply with the word ok" --output-format json
```

Record whether it answers, asks you to log in, or says the plan does not allow the CLI.

## 6. Results form (fill in)

```
Date / time (MYT):
Tester:
WorkBuddy version (Settings → About):
Mode / model shown:
Credits before:            Credits after:            Used:
Wall time message 1 (Enter → final reply):
Permission prompts (text + command), or "none":

Agent's file: hackathon/spike/workspace/spike-out/SPIKE-RESULT.md   exists? yes / no
Parallel report: verdict =          start_spread_s =          wall_s =

Preview page results (paste the JSON from "Copy results"):

Screenshots saved to hackathon/runs/spike/ (names from section 2):
Anything surprising:
```

## 7. Spike questions (PLAN §7.1, Telegram removed)

Fill the "Answer" column; the right-hand column is what changes in the build.

| # | Question | Answer | If yes | If no |
|---|---|---|---|---|
| S1 | Is `${CODEBUDDY_SKILL_DIR}` substituted in the installed skill? (SPIKE-RESULT.md "S1") Where did the skill land on disk? | Disk: `C:\Users\User\.workbuddy-ai\skills\bilimind-spike` (verified). Substituted: | SKILL.md uses `${CODEBUDDY_SKILL_DIR}` | `install.ps1` writes the absolute path into the installed SKILL.md |
| S2 | Does the workspace copy `.codebuddy\skills\` load in Work mode? (message 2) | | Keep both copies | Install to the user skills folder only |
| S3 | Which shell runs commands, and which `node`? (SPIKE-RESULT.md "S3") | Expected: Git Bash, node v22.22.2 | Quoting rules for Git Bash in SKILL.md; bundle targets Node 22 | Adjust quoting; call node by full path |
| S4 | Do 3 parallel Agent sub-agents from a plain skill show as cards, and does `verdict` say PARALLEL? | | The plain skill is the stage version | Try the Expert Team (`hackathon/EXPERT-TEAM.md`); if nothing parallel renders, run Writers one by one and cap the live run at 3 lessons |
| S5 | Does TaskCreate render as a ticking checklist? | | Use it | The Lead ticks a checklist in `plan.md`, shown in Preview |
| S6 | Credits used by the spike; is a custom model selectable on this account (Settings → Model → Custom)? | | | Budget decisions in PLAN §6.4 |
| S7 | Preview: mp3 plays, Blob worker runs, localStorage survives reload and reopen, `#page=3` opens on slide 3? (section 3) | | The course opens in Preview on stage | Open `index.html` in Edge on stage |
| S8 | Permission prompts for scripts and network; does Full Access for one folder silence them? | | Full Access in `C:\Demo\` only | Pre-approve each command type in rehearsal |
| S9 | Are `DEEPSEEK_API_KEY` / `OPENROUTER_API_KEY` visible to the skill's shell? | Expected: no (not set as env vars yet) | | `setx` both and fully restart WorkBuddy, or read `%USERPROFILE%\.bilimind\config.json` |
| S10 | (Changed) Can WorkBuddy publish the course folder as a public link (message 3)? | | Use it as the deployed application link and the "share with your study group" beat | Deploy the static site elsewhere (WP12) |
| S12 | Is the bundled CodeBuddy CLI usable on this plan (message 4)? | | Scripted regression runs in WP9 | WP9 uses WorkBuddy only |
| S13 | Exact English UI labels: sidebar items, the Skills/Experts page, Results panel tabs, the Preview tab, Automation | | Into RUNBOOK and the pitch script | |

## 8. Hand back

Tell the orchestrator "spike done" with: this file filled in, the path
`hackathon/spike/workspace/spike-out/SPIKE-RESULT.md`, and the screenshots in `hackathon/runs/spike/`.
Gate G1 then fixes WP7's SKILL.md shape and decides WP16 (Expert Team).

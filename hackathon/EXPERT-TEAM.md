# Expert Team "bilimind-crew": how to create and register it on this PC

Status: written before registration. The final package, `workbuddy/bilimind-crew/` (not the spike draft
below), passes WorkBuddy's own validator and was registered on this PC on 10 October with these steps (step D's
fallback, `--session-id dormathon-build`); WorkBuddy adopted it into My Experts. See
`workbuddy/bilimind-crew/STATUS.md`.

Draft package (source of truth): `hackathon/spike/expert-team/bilimind-crew/`
Placeholder avatars: `node hackathon/spike/tools/make-avatars.mjs` (already run).

Everything below was read from this machine: the built-in `expert-manager` skill
(`C:\Program Files\WorkBuddyAI\resources\app.asar.unpacked\resources\plugins\workbuddy-builtin\skills\expert-manager\`:
SKILL.md, `references/{plugin-json-spec,agent-md-spec,team-spec,avatar-spec}.md`,
`scripts/{init_expert,validate_expert,register_expert,package_expert}.py`), the empty target folder
`C:\Users\User\.workbuddy-ai\plugins\marketplaces\my-experts`, and the app code that loads custom experts.

---

## 1. How WorkBuddy finds a custom Expert Team

1. Package folder: `C:\Users\User\.workbuddy-ai\plugins\marketplaces\my-experts\plugins\bilimind-crew\`.
   Scripts refuse any other location.
2. Registry: `...\my-experts\.codebuddy-plugin\marketplace.json`, an entry
   `{"name": "bilimind-crew", "source": "./plugins/bilimind-crew", "description": "..."}`.
   `register_expert.py` writes it (do not hand-edit; the skill forbids bypassing the script).
3. The app watches that `marketplace.json`. On change it scans the listed packages and **adopts** every
   package that has a non-empty `.created-by-session` file: it adds the id to
   `C:\Users\User\.workbuddy-ai\experts\custom\<userId>\experts.json`, which is what "My Experts" shows.
   `register_expert.py` writes `.created-by-session` from `CODEBUDDY_SESSION_ID` (set automatically in
   WorkBuddy's own shell) or from `--session-id <id>`. Without it the script warns "it may not appear in
   My Experts for the current user automatically".
4. Teams work locally; only the cloud sync of a team is unsupported (the app skips teams with
   `team_not_supported` when uploading to the cloud). Sharing by link may therefore not work for a team.
5. Teams cost about 3-5x the credits of a single expert (WorkBuddy docs). Rehearse with the plain skill.

## 2. WORKBUDDY_CONFIG_DIR on this PC

- The scripts default to `~\.workbuddy` (`C:\Users\User\.workbuddy`), which is **wrong** here. This
  install is the international build and its data folder is `C:\Users\User\.workbuddy-ai`.
- Inside WorkBuddy nothing is needed: the app sets `WORKBUDDY_CONFIG_DIR` and `CODEBUDDY_CONFIG_DIR` to
  its config folder for the agent's processes.
- From our own terminal you must set it, or `init_expert.py` refuses the `--path` and
  `validate_expert.py` fails with "专家不在专家目录下" (the expert is not in the experts folder):
  - Git Bash: `export WORKBUDDY_CONFIG_DIR="C:/Users/User/.workbuddy-ai"`
  - PowerShell: `$env:WORKBUDDY_CONFIG_DIR = "C:\Users\User\.workbuddy-ai"`
- Also set `PYTHONUTF8=1` (PowerShell: `$env:PYTHONUTF8 = "1"`). The scripts print emoji; without it
  Python crashes with `UnicodeEncodeError: 'charmap' codec can't encode character` (seen here).
- Python: use WorkBuddy's bundled one, `"C:\Program Files\WorkBuddyAI\resources\vendor\python\python.exe"`
  (3.13). The system `python3` (3.11, Windows Store alias) also works.
- Agent `.md` files must use LF line endings: the validator's frontmatter regex is `^---\n` and fails on
  CRLF. The draft files are LF; keep them LF if you edit them on Windows.

## 3. Steps (when the orchestrator says go)

Prerequisite: the real `bilimind` skill exists (WP7), with `SKILL.md`, `scripts/bilimind.mjs` and
`references/{writer,coder,checker}.md`.

**Step A. Bundle the skill into the package** (needed so the zip works on any machine):

```bash
cd /c/oybek/projects/bilimind/bilimind-desktop
mkdir -p hackathon/spike/expert-team/bilimind-crew/skills
cp -r skills/bilimind hackathon/spike/expert-team/bilimind-crew/skills/bilimind
```

Then add `"skills": ["./skills/bilimind"],` to `.codebuddy-plugin/plugin.json` right after `"agents"`.
(Skipping step A also works on this PC, because the lead preloads the skill by name (`skills: [bilimind]`)
and the user-level skill `C:\Users\User\.workbuddy-ai\skills\bilimind` is installed by WP7. The package is
then not self-contained.)

**Step B. Copy the package into the experts folder** (Git Bash):

```bash
export WORKBUDDY_CONFIG_DIR="C:/Users/User/.workbuddy-ai"
export PYTHONUTF8=1
DEST="$WORKBUDDY_CONFIG_DIR/plugins/marketplaces/my-experts/plugins"
mkdir -p "$DEST"
rm -rf "$DEST/bilimind-crew"
cp -r /c/oybek/projects/bilimind/bilimind-desktop/hackathon/spike/expert-team/bilimind-crew "$DEST/"
```

**Step C. Validate:**

```bash
PY="/c/Program Files/WorkBuddyAI/resources/vendor/python/python.exe"
S="/c/Program Files/WorkBuddyAI/resources/app.asar.unpacked/resources/plugins/workbuddy-builtin/skills/expert-manager/scripts"
"$PY" "$S/validate_expert.py" "$DEST/bilimind-crew"
```

Expected: `✅ Expert package is valid!` (the draft already passes this).

**Step D. Register, preferably from inside WorkBuddy** so the real session id is recorded. New task
(any workspace), paste:

```
Run these two commands with the Bash tool and show me their output, nothing else:
"/c/Program Files/WorkBuddyAI/resources/vendor/python/python.exe" "/c/Program Files/WorkBuddyAI/resources/app.asar.unpacked/resources/plugins/workbuddy-builtin/skills/expert-manager/scripts/validate_expert.py" "C:/Users/User/.workbuddy-ai/plugins/marketplaces/my-experts/plugins/bilimind-crew"
"/c/Program Files/WorkBuddyAI/resources/vendor/python/python.exe" "/c/Program Files/WorkBuddyAI/resources/app.asar.unpacked/resources/plugins/workbuddy-builtin/skills/expert-manager/scripts/register_expert.py" "C:/Users/User/.workbuddy-ai/plugins/marketplaces/my-experts/plugins/bilimind-crew"
```

Expected: `✅ Registered 'bilimind-crew' in marketplace.json` and
`🎉 Expert 'bilimind-crew' is now registered and visible in WorkBuddy!`.

Fallback from our own terminal (same env as step B): add a session id by hand:

```bash
"$PY" "$S/register_expert.py" "$DEST/bilimind-crew" --session-id manual-bilimind-crew
```

**Step E. Check:**

```bash
cat "$WORKBUDDY_CONFIG_DIR/plugins/marketplaces/my-experts/.codebuddy-plugin/marketplace.json"
cat "$DEST/bilimind-crew/.created-by-session"; echo
cat "$WORKBUDDY_CONFIG_DIR"/experts/custom/*/experts.json
```

The last file appears a few seconds after registration and must contain `"bilimind-crew"`. In the app:
"Experts · Skills · Connectors" → Experts → My Experts → card "BiliMind Crew" (team badge, 4 member
avatars). Screenshot it for the deck.

**Step F. Use it.** Open the card → start a chat (the lead `bilimind-crew-team-lead` is the main agent,
set by `settings.json`) → select the course folder as workspace → paste the hero sentence (it is also the
card's first quick prompt).

**After any edit:** edit the files in the repo draft, repeat B, C and D (the skill says re-register after
every change). Never rename `name`, `agentName`, the folder or the agent file names: that loses the
expert. To remove it: delete the card in My Experts (or delete the folder and its `marketplace.json` entry).

**Sharing a zip:** `package_expert.py <dir> <outdir>` works but writes Windows backslash paths into the zip
on this PC. If a zip must be shared, re-zip with forward slashes (same writer as
`hackathon/spike/tools/build.mjs`).

## 4. Package layout

```
bilimind-crew/
  .codebuddy-plugin/plugin.json      team manifest (below)
  settings.json                      {"agent": "bilimind-crew-team-lead"}
  agents/
    bilimind-crew-team-lead.md       lead (file name must carry the team prefix, never "team-lead.md")
    bilimind-writer.md
    bilimind-coder.md
    bilimind-checker.md
  avatars/
    team.png  bilimind-crew-team-lead.png  bilimind-writer.png  bilimind-coder.png  bilimind-checker.png
  skills/bilimind/                   added in step A
  README.md
```

Forbidden by the validator: `hooks/`, `commands/`, `.lsp.json`, and `agents/ skills/ bin/ avatars/` inside
`.codebuddy-plugin/`. Agent frontmatter must not contain a `tools` field (tools are assigned by the
system; the lead additionally gets Agent and SendMessage).

## 5. Rules the validator and the spec enforce (all met by the draft)

- `name` kebab-case; `plugin` == `name`; `agentName` == lead file name == `settings.json` `agent`.
- `expertType: "team"`; `teamInfo.leadAgent` = lead; `teamInfo.memberAgents` = members WITHOUT the lead.
- `members[]` includes the lead with `role: "lead"`; the others `role: "member"`.
- Team `profession` must equal `displayName` (both languages).
- `displayName`, `profession`, `displayDescription`, `defaultInitPrompt` need both `en` and `zh`.
- `displayDescription.zh` 40-50 characters (ours: 46). `tags` exactly 3, `quickPrompts` exactly 3,
  `defaultInitPrompt` == `quickPrompts[0]`.
- `categoryId` from the fixed list. We use `06-ContentCreative` (the main output is teaching content).
  Alternative: `09-OperationsHR` (training) if we lead with the shop-onboarding story.
- Member naming (team-spec): a person's name that hints at the job, different from the profession; the
  lead's profession must not be a generic "Team Lead".
- The lead's prompt must: create the team with TeamCreate itself; spawn members with the Agent tool
  passing the member's Agent ID as both `name` and `subagent_type`; relay every output (members report
  with SendMessage, never to each other); report to the user after each phase; never write a member's
  output; never spawn itself.

## 6. Templates

### 6.1 `.codebuddy-plugin/plugin.json`

```json
{
  "name": "bilimind-crew",
  "version": "0.1.0",
  "description": "A study crew that reads your lecture slides and past paper, plans the days you have, writes lessons in parallel, tests every code exercise and checks every answer against your slides.",
  "author": { "name": "BiliMind team", "email": "team@bilimind.com" },
  "agents": [
    "./agents/bilimind-crew-team-lead.md",
    "./agents/bilimind-writer.md",
    "./agents/bilimind-coder.md",
    "./agents/bilimind-checker.md"
  ],
  "expertType": "team",
  "agentName": "bilimind-crew-team-lead",
  "teamInfo": {
    "leadAgent": "bilimind-crew-team-lead",
    "memberAgents": ["bilimind-writer", "bilimind-coder", "bilimind-checker"]
  },
  "displayName": { "en": "BiliMind Crew", "zh": "BiliMind 备考团" },
  "profession": { "en": "BiliMind Crew", "zh": "BiliMind 备考团" },
  "displayDescription": {
    "en": "Reads your slides and last year's paper, plans the days you have, writes interactive lessons in parallel, tests every code exercise and checks every answer against your slides.",
    "zh": "读懂课件和往年试卷，按剩余天数规划复习，并行编写互动课程，测试代码练习，逐题对照课件核查答案"
  },
  "avatar": "avatars/team.png",
  "categoryId": "06-ContentCreative",
  "defaultInitPrompt": {
    "en": "My Data Structures final is Thursday 9am. The slides and last year's paper are in this folder. I have 45 minutes a day. Get me ready.",
    "zh": "我的数据结构期末考试在周四上午9点。课件和去年的试卷都在这个文件夹里。我每天有45分钟。帮我做好准备。"
  },
  "plugin": "bilimind-crew",
  "tags": [
    { "en": "Exam prep", "zh": "备考" },
    { "en": "Interactive courses", "zh": "互动课程" },
    { "en": "Checked against slides", "zh": "对照课件核查" }
  ],
  "quickPrompts": [
    { "en": "My Data Structures final is Thursday 9am. The slides and last year's paper are in this folder. I have 45 minutes a day. Get me ready.",
      "zh": "我的数据结构期末考试在周四上午9点。课件和去年的试卷都在这个文件夹里。我每天有45分钟。帮我做好准备。" },
    { "en": "Turn the SOP in this folder into a first-shift training course for our new boba shop staff.",
      "zh": "把这个文件夹里的操作手册做成奶茶店新员工第一天上岗培训课程。" },
    { "en": "Make a Bahasa Melayu survival course from these notes: 20 minutes a day for one week.",
      "zh": "用这些笔记做一个马来语生存会话课程：每天20分钟，一周学完。" }
  ],
  "members": [
    { "id": "bilimind-crew-team-lead", "name": { "en": "Dina Planwell", "zh": "程备考" }, "displayName": { "en": "Dina Planwell", "zh": "程备考" },
      "profession": { "en": "Exam Strategist", "zh": "备考总策划" }, "avatar": "avatars/bilimind-crew-team-lead.png", "role": "lead" },
    { "id": "bilimind-writer", "name": { "en": "Lena Page", "zh": "许成章" }, "displayName": { "en": "Lena Page", "zh": "许成章" },
      "profession": { "en": "Lesson Writer", "zh": "课程撰稿人" }, "avatar": "avatars/bilimind-writer.png", "role": "member" },
    { "id": "bilimind-coder", "name": { "en": "Cody Pass", "zh": "寇测通" }, "displayName": { "en": "Cody Pass", "zh": "寇测通" },
      "profession": { "en": "Exercise Tester", "zh": "练习题测试工程师" }, "avatar": "avatars/bilimind-coder.png", "role": "member" },
    { "id": "bilimind-checker", "name": { "en": "Vera Quote", "zh": "严引证" }, "displayName": { "en": "Vera Quote", "zh": "严引证" },
      "profession": { "en": "Slide Fact-Checker", "zh": "课件核查员" }, "avatar": "avatars/bilimind-checker.png", "role": "member" }
  ]
}
```

(`members[].name` is extra: the spec uses `displayName`, an older doc used `name`; both are kept.)
After step A add `"skills": ["./skills/bilimind"]`.

### 6.2 `settings.json`

```json
{ "agent": "bilimind-crew-team-lead" }
```

### 6.3 Agent file frontmatter (one per agent, LF line endings, no `tools` field)

```yaml
---
name: bilimind-writer            # == file name without .md
description: <English, used to decide when this agent is used>
displayName:
  en: "Lena Page"
  zh: "许成章"
profession:
  en: "Lesson Writer"
  zh: "课程撰稿人"
maxTurns: 40                     # lead: 200; writer 40; coder 60; checker 80
---
```

The lead adds `skills:` with `- bilimind` (preloads the skill, which carries the CLI path and the
playbooks).

### 6.4 Lead body (structure; full text in `agents/bilimind-crew-team-lead.md`)

1. Title + one paragraph: the lead decides what to teach and when; members write, test, check; the CLI
   enforces.
2. Team members table: Agent ID, name, what they do, when to call them.
3. Before Phase 1 (the lead itself): never ask; resolve `BILIMIND` (`<skill folder>/scripts/bilimind.mjs`)
   from the preloaded skill; TaskCreate checklist; **TeamCreate**; `doctor`, `init`, `goal`, `ingest`,
   `outline`, `exam-map`, `plan`; show the plan in at most 10 lines.
4. Phase 1 (parallel, one message): one `bilimind-writer` per kept lesson, max 6. Prompt carries the lesson
   key, course dir, BILIMIND and `references/writer.md`.
5. Phase 2 (parallel, one message, after every writer reported): `bilimind-coder` (if code) +
   `bilimind-checker`, with the writers' reports.
6. Phase 3 (the lead): `narrate`, `export`, `build`, then `present_files` on `index.html`, `plan.md`,
   `REPORT.md`; final reply.
7. Iron rules (section 5 above) and "pass the Agent ID as `name` and `subagent_type`".

### 6.5 Member body (structure; full texts in `agents/`)

Role line → core skills (3) → workflow (numbered CLI calls with `--as "<agent>"`) → one-line output
format → **"SendMessage report: when done you MUST send the result to the lead with SendMessage; do not
message other members"** → rules.

## 7. Avatars

Requirements (`references/avatar-spec.md` + app behaviour):

- PNG (preferred) or JPG, 512x512, **at most 500 KB each**. The app refuses an avatar path that points
  outside the package and drops a file that is too large (the card shows no picture).
- A team needs N+1 files: `avatars/team.png` (whole team), `avatars/bilimind-crew-team-lead.png`, and one
  per member `avatars/<member-id>.png`; the paths in `plugin.json` (`avatar`, `members[].avatar`) must match.
- One consistent style for the whole team. The spec's ImageGen recipe: a fixed style prefix ("Professional
  cartoon-style illustration avatar, consistent art style with warm lighting and soft shadows,"), the
  role taken from each agent file, and a fixed suffix ("Bust shot, facing forward. Clean simple
  pink-magenta-toned background. High quality, professional, natural." for 06-ContentCreative), ImageGen
  `size: "1024x1024"`, then rename to the declared file names (and shrink to 512x512 if over 500 KB).
- Never put text in an image (our own rule).

Current state: flat cobalt/lime placeholders made by `hackathon/spike/tools/make-avatars.mjs` (3-6 KB each,
512x512 RGBA PNG). They pass validation. Replace them with ImageGen output only if credits allow; ImageGen
costs WorkBuddy credits.

## 8. Open questions for the first team run (record in SPIKE.md or runs/)

| # | Question | Why it matters |
|---|---|---|
| T1 | Does the card show 4 member avatars, and do member sub-agents render as member cards during a run? | WP16's whole reason to exist |
| T2 | Can the lead spawn `bilimind-writer` 4 times in parallel with the same `name`, or must it use `bilimind-writer-2` ...? | The lead prompt already tells it to fall back |
| T3 | Is TeamCreate (a deferred tool) loaded without a hiccup, and does SendMessage relay show in the transcript? | Iron rules depend on both |
| T4 | Credits for one hero run as a team vs the plain skill | Teams cost 3-5x; budget (PLAN §6.4) |
| T5 | Does the preloaded `skills: [bilimind]` show the substituted CLI path to the lead? | If not, put the absolute path in the lead file at install time |

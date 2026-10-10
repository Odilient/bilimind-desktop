# WorkBuddy integration research (for Dormathon, Track 2)

Status: COMPLETE (first pass). Date: 2026-10-10. Author: research agent for the Odilov team.
Legend: VERIFIED = seen in an official doc / package / repo / live API (URL given). INFERRED = our reasoning, or a third-party claim not confirmed by an official source.
WorkBuddy itself is NOT installed on this machine yet, so nothing below was tested hands-on. Items marked "check on day 1" must be confirmed on the demo laptop.

## 0. TL;DR

1. **WorkBuddy runs on the CodeBuddy Code engine, and its Skills are standard SKILL.md folders** (YAML `name` + `description`, Markdown body, optional `scripts/`, `references/`, `templates/`). The engine even accepts Claude Code placeholders (`${CLAUDE_SKILL_DIR}`). Our skill can ship Node scripts that the agent runs through its Bash/PowerShell tool. VERIFIED (open.workbuddy.cn/docs/skill, codebuddy.ai/docs/cli/skills).
2. **Install a skill**: Experts · Skills · Connectors -> Skills -> Add skill -> Upload skill (zip). The engine also loads `.codebuddy/skills/` in the workspace and `~/.codebuddy/skills/`. WorkBuddy's own store is probably `~/.workbuddy/skills/` (community source only). Check on day 1.
3. **MCP works** (stdio, SSE, streamable HTTP; standard `mcpServers` JSON): Connectors tab -> "Custom connector", and `mcp.json` is directly editable again since 5.6.0. Guidance is under 30 s per tool call. It is not needed on our critical path.
4. **Multi-agent is real**: the engine has Agent (sub-agents, 20 concurrent by default), TeamCreate/SendMessage, a task list, Workflow, Cron. WorkBuddy "Expert Teams" are plugins with a lead agent that "automatically decomposes, executes in parallel and integrates delivery", shown with sub-agent cards. They cost 3-5x credits.
5. **BYOK is supported**: Settings -> Model -> Custom (OpenAI-compatible `/chat/completions`, so OpenRouter works). Custom models use no WorkBuddy credits. Free plan: 100 credits/month + 250 sign-up credits (14 days) + a 30/day activity promo, and model choice is "Auto" only. Pro is $10 ($7 first month) for 2,000 credits. Ask the organisers for hackathon credit codes (the Singapore Tencent hackathon gave 2,000 per participant).
6. **CLI for testing**: `npm i -g @tencent-ai/codebuddy-code` (v2.164.0). Then `codebuddy -p "..." -y --output-format stream-json --plugin-dir ./plugin --mcp-config ./mcp.json`. It shares `~/.codebuddy` with WorkBuddy. CLI access may need a paid plan (the CN pricing excludes it on Free).
7. **Recommendation**: build a **Skill + Node CLI** (`bilimind ingest|outline|expand|validate|narrate|build`) first. Then wrap it in an **Expert Team** ("Dean" lead, Writers in parallel, Reviewer loop) for the stage demo. Add an Automation (daily review) plus a Telegram push for the "keeps working for you" moment. Leave MCP as optional. The SKILL.md skeleton is in 7.4 and the Windows checklist is in 7.6.
8. **Watch out**: WorkBuddy already ships student experts and skills in China (33 experts, 15 skills, "final-exam outlines"). Our pitch must stress what they don't produce: a tested, narrated, cited, interactive course plus a spaced-review loop, all built from the student's own files.

## 1. Custom Skills

### 1.1 File format (SKILL.md)

- A skill is a folder with a required `SKILL.md` (YAML frontmatter + Markdown body) and optional sub-folders. VERIFIED, official WorkBuddy Open Platform skill spec: https://open.workbuddy.cn/docs/skill
  ```
  {skill-name}/
   ├── SKILL.md        # required
   ├── references/     # optional: docs the AI reads as context, referenced as @references/xxx.md
   ├── scripts/        # optional: executable scripts (.js, .py); the AI runs them through its Bash tool
   └── templates/      # optional: reusable templates
  ```
- Frontmatter fields listed by the Open Platform spec (VERIFIED, same URL): `name` (optional, skill id), `description` (required: "write the purpose and the trigger words"), `description_zh`, `description_en`, `display_name`, `display_name_en`, `category`, `version`, `author`, `allowed-tools` (comma list), `disable-model-invocation` (true = only manual call), `user-invocable` (false = hidden from the menu, AI-only). The `*_zh/_en`, `version`, `author` fields are marketplace-listing requirements, not runtime requirements (INFERRED from the CodeBuddy runtime spec below, where only `name`/`description` matter).
- The runtime that actually loads skills is the CodeBuddy Code engine. Its spec (VERIFIED: https://www.codebuddy.ai/docs/cli/skills): `name` (defaults to folder name), `description` (how the AI decides to use it), `allowed-tools`, `disable-model-invocation`, `user-invocable`, `context: fork` (run in an isolated sub-agent), `agent` (sub-agent type when forked: `general-purpose`, `Explore`, `Plan`, or a custom agent from `.codebuddy/agents/`), `model` (only with fork), `hooks` (only with fork, and only if the user sets `allowUntrustedFrontmatterHooks`).
- Placeholders inside SKILL.md (VERIFIED, same page): `${CODEBUDDY_SKILL_DIR}` = absolute path of the skill folder (use this to call our scripts), `${CODEBUDDY_SESSION_ID}`, `${CODEBUDDY_PLUGIN_ROOT}` (plugin skills only), any `${UPPER_ENV_VAR}` or `${VAR:-default}`. Inline shell (exclamation mark + backticked command) is executed when the skill loads and its output is pasted into the prompt; `$ARGUMENTS` is substituted; `@file` references are inlined.
- **Compatible with Anthropic / Claude Agent Skills: yes, effectively the same format.** VERIFIED evidence: the CodeBuddy skills page says that for compatibility with Claude Code, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_SKILL_DIR}` and `${CLAUDE_SESSION_ID}` are recognised as aliases (https://www.codebuddy.ai/docs/cli/skills); the WorkBuddy Skills page says skills "copied from `.agents` and similar directories keep their original SKILL.md" (https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market). A plain Anthropic-style SKILL.md with `name` + `description` loads. INFERRED: use `name`, `description`, `allowed-tools` for maximum portability; add the `_en/_zh/version/author` fields only if we submit to the marketplace.
- Note: the international "Create Skills" practice page still says a skill has `skill.yml` + implementation + README (https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Practice-Cases/Create-Skills). VERIFIED that the page says this; INFERRED that it is stale generic text, because every other official source uses SKILL.md and changelog 4.24.2 (2026-05-29) says "skill description priority now prefers the value in SKILL.md frontmatter" (VERIFIED: https://www.workbuddy.cn/docs/workbuddy/Changelog).

### 1.2 Where skills live on disk (Windows)

| Location | Scope | Status |
|---|---|---|
| `%USERPROFILE%\.codebuddy\skills\<name>\SKILL.md` | user-level, CodeBuddy engine | VERIFIED for CodeBuddy Code (https://www.codebuddy.ai/docs/cli/skills). VERIFIED that WorkBuddy "automatically recognises and loads your user-level `.codebuddy` config: rules, Skills, Commands, MCP" (https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Setting, section on user-level config compatibility). Caveat: the doc frames this under "code development"; INFERRED that it also applies in Work mode. Must be tested. |
| `<workspace>\.codebuddy\skills\<name>\SKILL.md` | project-level, highest priority | VERIFIED: WorkBuddy reads project `.codebuddy/skills/`, `.codebuddy/agents/`, `.codebuddy/rules/`, `.codebuddy/commands/`, `.codebuddy/CODEBUDDY.md`, `AGENTS.md`, "behaviour identical to CodeBuddy Code"; project beats user on a name clash (https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Project). Same caveat about "code development". |
| `%USERPROFILE%\.workbuddy\skills\<name>\SKILL.md` | user-level, WorkBuddy's own store (probably where "Upload skill" installs) | INFERRED / community only: a third-party skill pack (oh-my-workbuddy, https://skillsmp.com/creators/mrzhangguoguo/oh-my-workbuddy/skills-skill) scans `~/.workbuddy/skills/` and `.workbuddy/skills/`. The changelog VERIFIES a `~/.workbuddy` folder exists (mentions `~/.workbuddy/binaries`) and that `.workbuddy` internal files are hidden from the artifact list. A Tencent article says custom MCP config is `~/.workbuddy/mcp.json` (https://developer.cloud.tencent.com/article/2698011). Not stated in the main docs. |
| `%APPDATA%\WorkBuddy\skills\` | | UNRELIABLE: only from an AI-written CSDN article (https://gitcode.csdn.net/69e7284054b52172bc6b325f.html). Ignore. |
| `C:\Users\<user>\AppData\Local\Programs\WorkBuddy` | app install dir, wiped on every update | VERIFIED (CN FAQ https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/FAQ). Never put our files here. |

Practical rule (INFERRED): on the demo laptop install via the UI "Upload skill" (zip), AND keep a copy in the demo workspace at `.codebuddy\skills\bilimind\` so it loads even if the upload path differs. Right after installing WorkBuddy, run `dir %USERPROFILE%\.workbuddy` and `dir %USERPROFILE%\.codebuddy` and note the real paths in this file.

### 1.3 Can a skill ship scripts and reference files?

Yes. VERIFIED (https://open.workbuddy.cn/docs/skill): `scripts/` holds scripts the skill needs; "the AI executes them via the Bash tool"; use cases: calling external APIs, data processing, batch operations, logic needing a specific runtime; "declare the command and parameters in SKILL.md". `references/` files are read as context and referenced as `@references/xxx.md`.
Caveats:
- A plain skill's scripts run on the user's system runtime. Only connectors (section 2) can declare a managed Node/Python `runtime` that WorkBuddy installs itself (VERIFIED: https://open.workbuddy.cn/docs/connector). We cannot assume Node/Python on a judge's PC (INFERRED); our demo laptop has Node 24 and Python 3.11, so the demo is fine.
- In Default Permissions mode, "run scripts, commands or external programs" and "network access" need user confirmation (VERIFIED: https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Permission-Modes). Commands run in a sandbox first. Our scripts call OpenRouter and Edge-TTS over the network, so expect prompts (INFERRED). For a smooth demo: click allow once per command type during rehearsal, or switch to Full Access inside a disposable demo folder (the docs explicitly allow Full Access for "temporary test folders").
- Skills are security-scanned on install; "high-risk" ones always need manual confirmation; a setting "Auto-install non-high-risk skills" exists (VERIFIED: https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Setting). Avoid obfuscated code, `eval`, writes outside the workspace, hard-coded keys, or downloading binaries at runtime to stay "non-high-risk" (INFERRED).

### 1.4 How to import / install a skill

VERIFIED (https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market): left sidebar "Experts · Skills · Connectors" -> Skills tab -> "Add skill", three options:
1. **Upload skill**: drag or choose a local skill package; "the system configures it automatically". The package is a zip; the Open Platform describes zip parse failures and points to the "basic structure" section for fixes (https://open.workbuddy.cn/docs/skill); the "SKILL.md must be in the root directory of the ZIP, .zip only, max 10 MB" rule is VERIFIED only for a sibling Tencent product, the Tencent Cloud Agent Development Platform (https://intl.cloud.tencent.com/document/product/1254/81540), so it is INFERRED for WorkBuddy. CodeBuddy IDE has an "Import Skill" button for skills "obtained from the web" (VERIFIED: https://www.tencentcloud.com/document/product/1256/77295). Safest: zip so that `SKILL.md` sits at the zip root and keep the zip under 10 MB; if rejected, zip the folder itself.
2. **Find skill**: describe the need, WorkBuddy searches (the SkillHub marketplace, added in 4.6.2, 2026-03-20, VERIFIED changelog).
3. **Create skill**: describe the need, WorkBuddy writes the skill for you.
Also (INFERRED from a search snippet only): typing "import skill" in chat or dragging a SKILL.md into the chat imports it.
Installed skills can be toggled on/off without uninstalling; the toggle state syncs across devices via the account and never edits SKILL.md (VERIFIED, same page).
Marketplace publishing: register on the WorkBuddy Open Platform (https://open.workbuddy.cn/docs), pass developer or enterprise verification, submit the zip, review, publish. Not needed for the hackathon (INFERRED).

### 1.5 How skills are triggered

- Automatically: the model sees every enabled skill's name + description and picks the match; project skills beat user skills. VERIFIED: https://www.codebuddy.ai/docs/cli/skills ("How AI Selects Skills").
- Manually: `/skill-name` from the slash menu (unless `user-invocable: false`); the input box shows a "Skill capsule" (VERIFIED changelog 4.6.2).
- Disabled skills "do not take part in automatic model invocation" (VERIFIED, WorkBuddy Skills page).
- Practical (INFERRED): put trigger words in `description` ("exam", "lecture slides", "revision", "course", "onboarding", "SOP", "quiz", "flashcards", "study plan") and in the demo also say "use the BiliMind skill" so triggering is deterministic on stage.

## 2. MCP in WorkBuddy

### 2.1 How to add a custom MCP server (UI)

- VERIFIED (https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Connector): sidebar "Experts · Skills · Connectors" -> **Connectors** tab -> top-right button **"Custom connector"** -> "install a custom MCP service". The doc says custom connector config "is similar to MCP configuration" and links to the CodeBuddy IDE MCP page (https://www.codebuddy.cn/docs/ide/User-guide/MCP), which shows an "Add MCP" button that opens a JSON editor with a standard `mcpServers` object.
- VERIFIED changelog 5.6.0 (2026-09-19): "restored the ability to directly edit `mcp.json` for custom MCP; the whole config can be maintained and takes effect immediately" (https://www.workbuddy.cn/docs/workbuddy/Changelog). Other changelog lines VERIFY custom MCP accepts Chinese and upper-case server names, has an auth panel, health-check and auto-reconnect, and that long-running MCP tool calls were fixed so they are not cut off early.
- Three ways to use a connector in a task (VERIFIED, Connector page): (1) "Go to chat" from the connector card; (2) when creating a task, input box "+" -> Connectors -> toggle it on; (3) mid-task, WorkBuddy shows a "connect" card above the input box when it needs one, and auto-resumes after you authorise.
- Connector reads/writes themselves cost no credits; only the model's work on the data does (VERIFIED, Connector page: "连接器自身的读写不消耗积分").

### 2.2 Config file location and JSON format

- WorkBuddy custom MCP file: `~/.workbuddy/mcp.json` per a Tencent developer-community article (https://developer.cloud.tencent.com/article/2698011, "如何在 WorkBuddy 中使用 MCP Server?"). On Windows that is `%USERPROFILE%\.workbuddy\mcp.json`. Status: VERIFIED that the article says so; the main docs do not give the path, so confirm on the machine.
- CodeBuddy engine MCP files (VERIFIED: https://www.codebuddy.ai/docs/cli/mcp): user scope `~/.codebuddy/.mcp.json` (recommended), then `~/.codebuddy/mcp.json` (deprecated), then `~/.codebuddy.json`; project scope `<project>/.mcp.json`; local scope inside `~/.codebuddy.json#/projects/<path>`. Priority local > project > user. Files are JSONC (comments and trailing commas OK). WorkBuddy loads user-level `.codebuddy` MCP config (VERIFIED, Settings page quoted in 1.2, under "code development").
- Format (VERIFIED, same page). Standard `mcpServers` object, same shape as Claude Code / Claude Desktop:
  ```jsonc
  {
    "mcpServers": {
      "bilimind": {
        "type": "stdio",                       // "stdio" | "sse" | "http"; inferred from command/url if omitted
        "command": "node",
        "args": ["C:/bilimind-wb/mcp/server.mjs"],
        "env": { "OPENROUTER_API_KEY": "${OPENROUTER_API_KEY}" }, // ${VAR} and ${VAR:-default} expanded
        "description": "BiliMind course tools"
      },
      "bilimind-remote": {
        "type": "http",                        // streamable HTTP
        "url": "http://127.0.0.1:7801/mcp",
        "headers": { "Authorization": "Bearer ${BILIMIND_TOKEN}" }
      }
    }
  }
  ```
  Extra fields: `defer_loading` (tools loaded on demand via ToolSearch), per-tool `tools` overrides, `disabledMcpServers` list. Tool names appear as `mcp__<server>__<tool>`.
- Marketplace-grade connector package (VERIFIED: https://open.workbuddy.cn/docs/connector): folder with `connector-meta.json` (name, description_en/zh, `source` kebab id, `type`: `mcp` | `cli` | `skill-only`, version, examples), `mcp.json` (exactly ONE server), `icon.svg`, optional `skills/<name>/SKILL.md`. Remote transports: `sse` or `streamableHttp` over HTTPS; local: `stdio`. Extra `mcp.json` fields: `timeout` (default 30000 ms), `cwd`, `disabledTools` (since 4.22.15), `runtime: {"type":"node","version":"20"}` + `npmRegistry` (since 5.0.0: WorkBuddy provides a managed Node so the user needs nothing installed), `staticEnv`/`staticHeaders`, `preAuth`. Credentials via `auth_mode: "token"` + `token-schema.json` (a form; values stored only on the user's machine under `~/.workbuddy` and injected into `${VAR}` placeholders), or OAuth 2.1 + PKCE handled by WorkBuddy. Submit the zip to the WorkBuddy team for review; updates sync in 10-15 minutes after approval.
- Expert / Expert-team packages can declare their own MCP in a root `.mcp.json` (standard format plus a private `x-workbuddy` block with displayName, icon, `auth.type` oauth/token/none) or `dependencies.mcpServers` in plugin.json; WorkBuddy then shows a connect card before the expert starts, and the MCP ends up under "Connectors -> Custom connectors" (VERIFIED: https://open.workbuddy.cn/docs/expert).

### 2.3 stdio vs streamable HTTP / SSE

- All three are supported: stdio, SSE, HTTP streaming (VERIFIED: https://www.codebuddy.ai/docs/cli/mcp and https://open.workbuddy.cn/docs/connector). The Open Platform recommends "MCP + Skill" over "CLI + Skill" when a network API exists, and remote over HTTPS.
- For us (INFERRED): stdio `node server.mjs` is simplest (no port, no firewall prompt). A localhost HTTP server is a good fallback if stdio spawning misbehaves on Windows, and it lets the same server also feed a live progress page in the browser.

### 2.4 Limits and caveats

- Recommended response time under 30 s per call; default connect timeout 30 000 ms (VERIFIED, Open Platform connector spec). Long-running jobs (a whole course build takes minutes) should be split into short calls or run as a background job with a `status` tool (INFERRED). Changelog says long MCP tool executions are less likely to be cut off since a recent version, and that MCP tool-call timeouts used to ignore config (VERIFIED changelog), so do not rely on long calls.
- One connector package = one MCP server (marketplace rule, VERIFIED). Doesn't apply to a hand-edited mcp.json (INFERRED).
- Headless CLI runs need explicit approval of project MCP servers: `--settings '{"enableAllProjectMcpServers": true}'` or `{"enabledMcpjsonServers": ["bilimind"]}` (VERIFIED: https://www.codebuddy.ai/docs/cli/mcp).
- MCP prompts become slash commands `/server:prompt` (VERIFIED, CLI MCP page). Optional nicety.
- Never hard-code keys in any shipped file; marketplace review rejects it (VERIFIED, connector spec).

## 3. Experts, multi-agent, plan UI, Automations, IM, files, cloud

### 3.1 Skill vs Expert vs Expert Team (this is the key mapping for our pitch)

VERIFIED (https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Expert-Center):
- **Skill** = a tool capability ("lets the AI do a thing").
- **Expert (agent type)** = a role switch: "persona + methodology + toolchain". Use for a single clear problem.
- **Expert Team (team type)** = "collaborative execution": "the team lead automatically decomposes, executes in parallel and integrates delivery". Use for complex tasks needing several roles. Credit cost is "usually 3-5x a single expert".
- Users summon an expert/team from "Experts · Skills · Connectors" -> Experts (Expert Center, browse by industry) or "My Experts". "Create expert" / "Create expert team" opens a chat with a built-in expert-builder that writes the config for you. Created experts can be edited, shared by link (the receiver gets a copy), or deleted. Expert names cannot be changed after creation.
- If an expert needs an MCP/connector that is not connected, WorkBuddy shows a connect card and resumes automatically (VERIFIED, same page).

**Expert package format = a CodeBuddy plugin** (VERIFIED: https://open.workbuddy.cn/docs/expert and https://open.workbuddy.cn/docs/expert-team):
```
bilimind-team/
 ├── .codebuddy-plugin/plugin.json   # name, version, description, author{name,email}, agents[], expertType "agent"|"team",
 │                                   # agentName (lead), teamInfo{leadAgent, memberAgents[]}, displayName{en,zh}, profession{en,zh},
 │                                   # displayDescription{en,zh}, avatar, categoryId (e.g. "04-DataAI"), defaultInitPrompt{en,zh},
 │                                   # plugin (= name), tags[3]{en,zh}, quickPrompts[3]{en,zh}, members[] (team only), skills[], dependencies{}
 ├── avatars/ team.png, lead.png, member-*.png   # 512x512 PNG/JPG, <= 500 KB, consistent illustration style
 ├── agents/ bilimind-team-lead.md, planner.md, writer.md, narrator.md, coder.md, examiner.md   # YAML frontmatter + system prompt
 ├── skills/<skill>/SKILL.md (+ references/ scripts/ templates/)   # shared skills
 ├── .mcp.json                         # optional built-in MCP (with optional x-workbuddy display/auth block)
 ├── bin/                              # optional executables (added to PATH in CodeBuddy plugins)
 ├── settings.json                     # required for teams: sets the lead, e.g. {"agent": "bilimind-team-lead"}
 └── README.md
```
- Agent file frontmatter: `name` (= file name), `description` (English, used to decide activation), `displayName{en,zh}`, `profession{en,zh}`, `maxTurns` (default 50), `skills` (preloaded). Developers "cannot add tools"; tools are assigned by the system: Read, Write, Grep, Glob, Bash, WebSearch, WebFetch, plus **AgentTool and SendMessage for the lead** (VERIFIED, same pages).
- The official team-lead template is strict: create the team with **TeamCreate** first (lead only), dispatch each member as a separate sub-task via the Agent tool, relay outputs between phases through the lead, report progress to the user after each phase, "pass the member's role name as the Agent tool `name` parameter", and **"Phase 1: call X, Y, Z in parallel"** (VERIFIED: trading-team example on https://open.workbuddy.cn/docs/expert-team). Template zips: trading-team.zip and design-experts.zip linked from those pages (not downloaded; get them on the demo machine if needed).
- `settings.json` with `{"agent": "<name>"}` activates a plugin agent as the main thread (VERIFIED: https://www.codebuddy.ai/docs/cli/plugins, "Bundling Default Settings").
- Marketplace listing needs Open Platform review. For the hackathon we only need it locally (INFERRED). Two local routes: (a) "My Experts -> Create expert team" in chat and paste our agent prompts; (b) put agent files in the workspace `.codebuddy/agents/` which WorkBuddy "automatically discovers and uses" (VERIFIED, Project page). Route (b) gives sub-agents but not the Expert Team card UI (INFERRED).

### 3.2 Parallel sub-agents: can a skill ask for them? How is it shown?

- Engine level, VERIFIED (https://www.codebuddy.ai/docs/cli/tools-reference): tools `Agent` ("spawns a sub-agent with an independent context window"), `TeamCreate`/`TeamDelete`, `SendMessage`, `TaskCreate`/`TaskUpdate`/`TaskList`/`TaskGet` (shared task list), `TaskOutput`, `Workflow` (dynamic workflows in the background), `CronCreate` (scheduled tasks), `ImageGen`, `VideoGen`, `Artifact` (publishes local HTML/Markdown as a shareable link), `AskUserQuestion`, `EnterPlanMode`/`ExitPlanMode`.
- Default max **20 concurrent sub-agents** per root session (`CODEBUDDY_CODE_MAX_CONCURRENT_SUBAGENTS`, shared by background, team-member, skill and workflow agents) (VERIFIED: https://www.codebuddy.ai/docs/cli/env-vars).
- A skill can request parallelism in plain words in SKILL.md ("for each lesson, launch one sub-agent in parallel using the Agent tool") because the skill body is just instructions to the model, which has the Agent tool (INFERRED from how skills work; the official expert-team template does exactly this in an agent prompt, VERIFIED). A skill can also itself run as a sub-agent with `context: fork` (VERIFIED, skills page).
- Agent Teams (CLI): members have their own context, a shared task list, can message each other; status bar shows each member as working / completed / failed with token and tool-call counts (VERIFIED: https://www.codebuddy.ai/docs/cli/agent-teams). This is the CLI TUI; WorkBuddy has its own UI.
- WorkBuddy UI evidence (all VERIFIED from the CN changelog https://www.workbuddy.cn/docs/workbuddy/Changelog): "expert team sub-agent view page", "sub-agent view header more compact, artifacts entry follows the end of output", "expert team sub-task (subagent) cards", "team queue", "parallel sub-tasks during deep thinking", "input box member bar collapse button". So: an expert team run shows member cards / sub-agent views that you can open. Exact look: not documented; INFERRED, check on the machine and screenshot for the pitch.

### 3.3 Task plan UI

- WorkBuddy shows "execution steps", "stage descriptions (e.g. Analyzing data..., Generating report...)", "expandable intermediate steps", a Stop button, and a right-hand Results panel (Artifacts / All Files / Changes / Preview) (VERIFIED: https://www.workbuddy.ai/docs/workbuddy/Conversation and https://www.workbuddy.ai/docs/workbuddy/Results). Task states include "Planning" (VERIFIED: Task Management page).
- Compact Mode is ON by default and "tool call details are collapsed" (VERIFIED, Settings page). **Turn Compact Mode OFF for the demo** so judges see every tool call (INFERRED).
- A checklist that ticks off: the engine has the TaskCreate/TaskUpdate task-list tools (VERIFIED, tools reference) and a "Plan mode" with plan approval (VERIFIED, changelog mentions "Plan mode" and EnterPlanMode/ExitPlanMode tools). Whether WorkBuddy renders TaskCreate as a live checklist is not documented (INFERRED likely, since it is the same engine; verify). The techpedia guide describes the flow "describe -> confirm the plan (the agent shows the steps, you approve) -> watch it run" (VERIFIED: https://www.tencentcloud.com/techpedia/144100?lang=en).
- Our own guaranteed fallback (INFERRED): the skill writes `plan.md` with checkboxes into the workspace and updates it after every step, and our course `index.html` has a live "build log" view. Both show in the Results panel Preview / Artifacts.

### 3.4 Automations (scheduled tasks)

- VERIFIED (https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Automation-Guide and CN page https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Automation-Guide): sidebar Automation -> "New Automation": name, prompt, workspace (default `automation-xxxx`), permission mode, **choose model + skills + experts + connectors**, schedule (hourly / daily / weekly incl. several weekdays / monthly multi-day / one-time), templates exist (CN list includes a "study plan" template). Results can be pushed to Slack / Telegram / Discord via Assistant (intl doc) or to WeCom / the WorkBuddy mini-program (CN). Renamed "定时任务" (scheduled tasks) in the CN client.
- Runs locally: the config is saved in the local client and runs "with your login identity"; the computer must be on and WorkBuddy running; "Prevent sleep" setting helps (VERIFIED: Automation CN page, Setting page, Assistant page).
- Limits: Free 3 automations (99 during the promo), Pro 15 (99 during the promo) (VERIFIED: https://www.workbuddy.ai/docs/workbuddy/pricing).
- For us (INFERRED): "Every day 8 pm: run BiliMind review for ~/Exams/DS — pick today's due cards from the SM-2 deck, write a 10-minute review page, send me the link on Telegram". This is the "operate continuously" story judges like.

### 3.5 IM connectors (Assistant / remote control)

- VERIFIED (https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Assistant): Slack, Telegram, Discord, WeChat Work, Feishu, DingTalk, QQ, YuanbaoPai, WeChat AssistantBot. The computer must be on and WorkBuddy running. The intl FAQ still says only Slack/Telegram/Discord for Assistant, so on the international build expect those three (INFERRED from conflicting VERIFIED pages).
- Telegram setup (VERIFIED: https://www.workbuddy.ai/docs/workbuddy/Platform-Integration/Telegram-Guide): BotFather `/newbot` -> copy token -> WorkBuddy Assistant -> Assistant Settings -> Channels -> Telegram -> paste token -> Save -> open the bot and press Start. You can send text, photos and files; `/clear` resets; replies support Markdown.
- Demo value (INFERRED): student sends a photo of a whiteboard or a PDF to the Telegram bot from a phone, the laptop builds the course. Strong "agent works for you while you are away" moment, about 2 minutes of setup.

### 3.6 Files, workspace, outputs

- Each task has a **workspace** folder: chosen with "Select Folder" at the bottom-right of the input box, or WorkBuddy creates a task folder in a default directory (VERIFIED: https://www.workbuddy.ai/docs/workbuddy/Create-Task and Permission-Modes page). Default Permissions decides risk by whether an operation stays inside the workspace.
- Results panel: Artifacts (generated files with preview: docs, spreadsheets, PPT, Markdown, PDF), All Files (file tree), Changes (diffs), Preview (web pages, "built-in browser opens automatically to preview" generated web files) (VERIFIED: Results page and Explore page). So our offline `index.html` course previews inside WorkBuddy. Changelog VERIFIES HTML artifacts can be clicked to preview, and a fix for "web artifact preview cannot play embedded audio" (so narration audio in HTML now plays in preview).
- `.workbuddy` internal files are hidden from the artifact list (VERIFIED changelog 4.6.2). INFERRED: WorkBuddy keeps per-workspace state in `<workspace>/.workbuddy/`; don't write our outputs there.
- Sharing: tasks and outputs can be shared by link; "Library" for central artifact management and publishing (VERIFIED: intl changelog 5.7.6 and 5.2.3). Engine `Artifact` tool publishes HTML as a public link (VERIFIED tools reference). Good for "send the course to your study group" (INFERRED).

### 3.7 "Cloud computer"

- The CN mobile App and WeChat mini-program have two modes: **cloud work** ("uses a cloud sandbox to run tasks, no PC needed") and **connect to computer** (remote-control the desktop) (VERIFIED: https://www.workbuddy.cn/docs/workbuddyapp/Overview and https://www.workbuddy.cn/docs/workbuddymini/quick-start/Overview).
- Desktop changelog also mentions "cloud tasks", "cloud project sessions", "cloud assistant" (VERIFIED CN changelog). Not documented for the international build; do not plan the demo around it (INFERRED). Our skill writes local files, which is exactly what the desktop does best.
- Desktop tasks run in a local sandbox (VERIFIED: Permission-Modes page; changelog "Windows lightSandbox").

## 4. Models, credits, free tier, BYOK

### 4.1 Plans and credits (international, workbuddy.ai)

VERIFIED (https://www.workbuddy.ai/docs/workbuddy/pricing, https://www.workbuddy.ai/docs/workbuddy/Subscription, https://www.workbuddy.ai/docs/workbuddy/credits):

| | Free | Pro |
|---|---|---|
| Price | 0 | $10/month ($7 first month for new users), $96/year |
| Credits / month | 100 | 2,000 (1,000 base + 1,000 bonus) |
| Sign-up bonus | 250 credits, valid 14 days | (same, new users) |
| Daily activity promo (limited time) | +30 credits/day if you start one task in the WorkBuddy or CodeBuddy desktop client that day (web does not count), credited next day | +50/day |
| Automations | 3 (99 during promo) | 15 (99 during promo) |
| Model choice | "Auto" routing only: "you cannot specify a single model" (all models selectable during the promo) | all models |
| Top-up | none | 500 credits for $15, valid 1 month |

- Credits do not roll over; earliest-expiring credits are spent first. Consumption depends on model tier, task complexity and context length; "premium models cost more per interaction"; exact per-model rates are not published in the docs (VERIFIED absence; the model picker shows credit usage per model per CN changelog "model credit usage shown flat next to the model name").
- Expert Teams cost "3-5x a single expert" (VERIFIED, Expert page). A loop-detection pause exists; terminating a looping request can trigger a refund evaluation (VERIFIED: CN credits page https://www.workbuddy.cn/docs/workbuddy/Credits).
- WorkBuddy and CodeBuddy share one account credit pool (VERIFIED for CN: https://www.workbuddy.cn/docs/workbuddy/Pricing "WorkBuddy 和 CodeBuddy 同一账号积分共享"; INFERRED for international, consistent with the shared daily-activity rule).
- Hackathon note: the Singapore AIT x Tencent WorkBuddy/CodeBuddy hackathon gave every participant **2,000 credits** plus daily credit codes (VERIFIED: https://hackmd.io/@yongquantan/S1YGtKwVzl). **Ask the Dormathon organisers / Tencent mentors for hackathon credit codes on day 1** (INFERRED, high value).
- Budget estimate (INFERRED): 250 sign-up + 100 monthly + 30/day promo is about 400 credits for the build week on Free. One Expert Team run could burn tens to hundreds of credits. Plan: Pro for $7 first month on one demo account if organiser credits are not given.

### 4.2 Models

- CN build built-in models (VERIFIED: https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Model): Hy4 preview, Hy3 (Hunyuan), GLM-5.3, GLM-5.3-Flash, GLM-5.2, GLM-5.1, GLM-5v-Turbo, MiniMax-M3, MiniMax-m2.7, Kimi-K3, Kimi-K2.7-Code, Kimi-K2.6, DeepSeek-V4-Flash, DeepSeek-V4-Pro. Three tiers: Fast / Balanced / Ultimate; thinking strength; context window default 200K (up to 1M, costs more); "Max mode" disables context compression (costs more).
- International build: the docs only say "built-in model options for everyday tasks, reasoning, and multimodal; the list may vary by version, account type and availability" and "Auto Mode" picks a model (VERIFIED: https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Model). The exact international list is not published; check the in-app picker on day 1 (INFERRED). CodeBuddy's international login "supports international mainstream models" (VERIFIED: https://www.codebuddy.ai/docs/cli/quickstart).

### 4.3 Bring your own model / API key: YES

- VERIFIED (intl Model page above, CN Model page): Settings -> Model -> Add custom model. Provider presets (enter only the API key) or **Custom**: URL + API key + model name; OpenAI-compatible `/chat/completions` only ("Custom protocol" toggle for non-standard paths); Ollama local supported. Capability flags (tool calling, image input, reasoning) are auto-filled for presets, manual for Custom. Config stored locally in `workbuddy/models.json`; legacy `~/.codebuddy/models.json` still honoured; hot-reload without restart (VERIFIED changelog). **Custom models do not consume WorkBuddy credits; you pay the provider** (VERIFIED: CN Model page "自定义模型产生的全部费用...由您向第三方支付"; also https://docs.apiyi.com/en/scenarios/chat/workbuddy.md).
- OpenRouter is OpenAI-compatible, so: Provider Custom, URL `https://openrouter.ai/api/v1/chat/completions`, key `sk-or-...`, model `deepseek/deepseek-v4-flash`, tick "tool calling" (INFERRED by analogy with the APIYI guide; test once).
- models.json format (VERIFIED: https://www.codebuddy.ai/docs/cli/models): `{"models":[{"id","name","vendor","apiKey":"${OPENROUTER_API_KEY}","url":".../chat/completions","maxInputTokens","maxOutputTokens","supportsToolCall":true,"supportsImages","supportsReasoning"}],"availableModels":[...]}`; `${ENV}` references allowed.
- Caveat: on Free, model choice is "Auto routing" for built-ins; whether a Free account may select a custom model is not stated (INFERRED risk; the CN changelog fixed a bug that wrongly told personal accounts "enterprise forbids custom models", suggesting personal accounts are allowed).
- OpenRouter prices pulled live today from https://openrouter.ai/api/v1/models (VERIFIED 2026-10-10), all with tool support: `deepseek/deepseek-v4-flash` $0.013/M in, $1.28/M out, 1M ctx; `anthropic/claude-haiku-5.5` $0.10 / $0.50; `z-ai/glm-5.3-flash` $0.15 / $0.50; `qwen/qwen3.5-flash-02-23` $0.065 / $0.26.
- Strategy (INFERRED): WorkBuddy credits pay for the orchestration (the part judges must see happening "in WorkBuddy"); our skill scripts call OpenRouter directly for the bulk writing (lessons, quizzes, cards), so a full course costs cents. If WorkBuddy credits run low, switch the WorkBuddy model to the OpenRouter custom model; it is still WorkBuddy doing the orchestration. Keep a hard cap in our script (e.g. max $0.50 per run, abort over budget) to protect the $12.

## 5. CodeBuddy Code CLI (for automated testing of our skill)

- Package: `@tencent-ai/codebuddy-code`, latest **2.164.0** (published 2026-10-09), bins `codebuddy`, `cbc`, `codebuddy-code`, `cbc-prewarm`, `codebuddy-lowmem`; homepage https://cnb.cool/codebuddy/codebuddy-code; license "SEE LICENSE IN README.md"; about 190 MB unpacked; ships Windows sandbox and node-pty optional deps (VERIFIED via the npm mirror https://registry.npmmirror.com/@tencent-ai%2fcodebuddy-code; `npm view` against registry.npmjs.org failed on this machine with a TLS chain error, so use `--registry=https://registry.npmmirror.com` if the same happens on install).
- Install (VERIFIED: https://www.codebuddy.ai/docs/cli/installation): `npm install -g @tencent-ai/codebuddy-code` (Node >= 18.20) or native Windows binary `irm https://www.codebuddy.cn/cli/install.ps1 | iex` (beta; adds `%USERPROFILE%\AppData\Local\codebuddy\bin`). Verify with `codebuddy --version`.
- Login (VERIFIED: https://www.codebuddy.ai/docs/cli/quickstart): first run shows "Log in via Chinese Site / International Site / Enterprise Domain / iOA"; choose **International Site** (codebuddy.ai) and finish in the browser. Same account as WorkBuddy (INFERRED: same "Buddy AI" account system per the subscription page). For non-interactive use: env `CODEBUDDY_API_KEY` ("always used in -p mode") and `CODEBUDDY_BASE_URL`; `CODEBUDDY_INTERNET_ENVIRONMENT` selects edition (`internal` = China edition, `ioa`) (VERIFIED: https://www.codebuddy.ai/docs/cli/env-vars).
- Headless (VERIFIED: https://www.codebuddy.ai/docs/cli/headless and /cli-reference):
  ```bash
  codebuddy -p "Use the bilimind skill: build a course from ./slides for my Data Structures final on Friday" \
    -y --output-format stream-json \
    --mcp-config ./mcp.json --strict-mcp-config \
    --settings '{"enabledMcpjsonServers":["bilimind"]}' \
    --plugin-dir ./bilimind-plugin
  ```
  `-y` (`--dangerously-skip-permissions`) is required in `-p` mode for file writes / commands / network; HIGH-risk commands may still prompt (`CODEBUDDY_IS_SANDBOX=1` suppresses all, only in a disposable sandbox). Output formats `text | json | stream-json`; stream-json emits `task_started / task_progress / task_notification` events for background sub-agents (useful to prove parallelism in logs). Other flags: `--add-dir`, `--agents '<json>'`, `--allowedTools`, `--disallowedTools`, `--tools`, `--model`, `-c/--continue`, `-r <session>`, `--append-system-prompt`, `--setting-sources user,project,local`, `--plugin-dir` (load a plugin folder without installing; also `CODEBUDDY_PLUGIN_DIRS`).
- Same skills / MCP as WorkBuddy? Partly. VERIFIED: the CLI loads `~/.codebuddy/skills`, `.codebuddy/skills`, `~/.codebuddy/.mcp.json`, `.mcp.json`, `.codebuddy/agents`; WorkBuddy says it loads the same user/project `.codebuddy` config "for code development" (Settings and Project pages). The CLI install doc even warns to set `CODEBUDDY_CONFIG_DIR` "to avoid configuration conflicts when coexisting with other applications using the CodeBuddy engine (such as WorkBuddy)" (VERIFIED: https://www.codebuddy.ai/docs/cli/installation), which confirms they share `~/.codebuddy`. What the CLI will NOT see: skills uploaded through the WorkBuddy UI if they land in `~/.workbuddy/skills`, and WorkBuddy's own custom-connector mcp.json (INFERRED). So: keep our canonical copy in a plugin folder / `.codebuddy/skills` and test with the CLI; install the same zip into WorkBuddy for the demo.
- Plan risk: the CN pricing table lists "CLI access" as **not included on the free tier** (VERIFIED: https://www.workbuddy.cn/docs/workbuddy/Pricing). The international pricing table does not mention CLI for individuals (Team: "use across IDEs and CLIs"). INFERRED: CLI may need Pro on the international site; test login on day 1 and fall back to testing inside WorkBuddy if blocked.

## 6. Hackathon guidance (Tencent / WorkBuddy, SEA)

- **Dormathon / Hackerdorm / BuilderX**: no public pages found by web search on 2026-10-10 (searched "Dormathon Taylor's University Hackerdorm BuilderX WorkBuddy"). Use the organiser brief as the source of truth.
- **AIT x Tencent Hackathon, Singapore 2026** (AI Tinkerers + Tencent Cloud; Jul 20 - Aug 14 submissions, Singapore demo day late August, global final in Shenzhen): tracks Productivity Agent / Business Agent / Life Agent; projects "must be built on at least one of CodeBuddy or WorkBuddy"; judging **AI innovation 30%, Technical excellence 20%, User experience & demo 25%, Business value & viability 25%**; submission = title, 16:9 cover, <10-word blurb, description, **3-5 minute demo video**, "product usage testimony", optional live link; 2,000 credits per participant + daily credit codes (VERIFIED: https://hackmd.io/@yongquantan/S1YGtKwVzl; event page https://singapore.aitinkerers.org/hackathons/h_bKcMFTi7cB8 returned 403 to our fetcher).
- **Tencent Cloud AI Coding Challenge, Singapore 2026** winners: 1st "Auntie AI" (multimodal anti-scam co-pilot for seniors, warnings in dialect), 2nd "EyeDentify" by **University of Malaya** students (wearable visual aid). Judges valued "human-centered design, AI interaction quality, and practical feasibility alongside technical execution" (VERIFIED: https://www.aap.com.au/aapreleases/cision20260513ae58232/). Pattern: a specific, sympathetic user + a visible real-world outcome.
- **Tencent Cloud in Malaysia**: first Malaysia cloud region in Johor; UTM partnership with an "AI and Cloud Innovation Hackathon", train-the-trainer and certifications for 1,000+ students, explicitly using "WorkBuddy and Tencent Design Miora to develop applications that address real-world Malaysian scenarios" (VERIFIED: https://soyacincau.com/2026/08/20/tencent-cloud-malaysia-johor/). SEA launch pitch for WorkBuddy: "a single instruction into a completed deliverable", "multiple tasks and agents running concurrently", "flexible multi-model integration via APIs", Discord/Slack/Telegram remote control (VERIFIED: https://technode.global/prnasia/tencent-cloud-unveils-new-ai-agents-workbuddy-and-miora-driving-innovation-and-real-business-outcomes-across-southeast-asia/). Reuse these exact phrases in the pitch.
- **Competition inside WorkBuddy (important)**: WorkBuddy's China back-to-school campaign launched **33 experts and 15 skills for students** (exam planning, note-taking, essays, job search), a campus Skill contest with 1,176 student-built skills from 416 universities, and promotes turning lecture recordings into "course summaries and final-exam outlines" (VERIFIED: https://www.news.cn/tech/20260901/af859c980cae416bb1e92deb0729409e/c.html). So "summarise my notes" is already native. Our edge must be what those do not produce: a **pedagogy-driven interactive course** (archetype per topic, runnable code sandbox exercises that were executed and tested, narrated voice lessons, source-grounded quizzes with citations, Anki deck + .ics spaced-review plan, daily review automation). Say this explicitly when a judge asks "can't WorkBuddy already do this?" (INFERRED).
- Also seen (VERIFIED, CN docs): SkillHub's own "Skill Scanner" skill talks about auditing before "npm install, openclaw plugins install, clawhub install" (https://www.workbuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/WorkBuddy-Zero-Cost-Skill-Top-10/Skill-Scanner). INFERRED: the WorkBuddy skill ecosystem overlaps with the open SKILL.md ecosystem (OpenClaw/ClawHub, Anthropic Agent Skills), so one SKILL.md serves WorkBuddy, CodeBuddy CLI and Claude Code. That portability is a fair pitch point ("our skill is not locked in").

## 7. Recommendation: how to package BiliMind for WorkBuddy

### 7.1 Decision

**Primary: one Skill folder that ships a Node CLI (`scripts/bilimind.mjs`) + references. Add an Expert Team wrapper for the multi-agent show. Treat MCP as an optional upgrade, not a dependency.** (INFERRED, reasoning below.)

| Option | Certainty it works on the demo laptop | What judges see | Cost to build | Verdict |
|---|---|---|---|---|
| Skill only (prompt, no scripts) | high | the model writing everything itself; slow, expensive in credits, no validators | low | no: loses "format follows pedagogy" and validators |
| **Skill + CLI scripts** | **high**: SKILL.md + `scripts/` + Bash execution are all VERIFIED in official docs | named tool calls in the transcript: `bilimind ingest`, `outline`, `expand --lesson 3`, `validate`, `narrate`, `build`; files appearing in Artifacts | medium (the engine port is needed anyway) | **yes, build this first** |
| Skill + MCP server | medium: MCP is VERIFIED, but WorkBuddy's custom-MCP file path and UI are only partly documented, 30 s guidance per call, Windows stdio spawning untested | typed tools `mcp__bilimind__outline` etc. under a "connector" | medium-plus (thin wrapper over the same CLI functions) | optional day-2 upgrade if time remains |
| Expert Team (plugin: lead + members) | medium: format VERIFIED for the marketplace; local import path = "Create expert team" chat or workspace `.codebuddy/agents/` | the "team lead decomposes, executes in parallel, integrates" UI with member cards; maps 1:1 to the track bullets | low once the skill exists (prompts only) | **yes, as the stage wrapper** |
| Connector package (`connector-meta.json`, `type: cli` with managed Node runtime) | low for a hackathon: needs Open Platform review to appear in the market | the cleanest install for real users | medium | mention as "next step" in the pitch |

Why: the judging question is "can your agent use WorkBuddy to solve a real problem and actually get things done". With skill + CLI, WorkBuddy does the agentic part (understand the sentence, plan, fan out writer sub-agents, react to validator failures, deliver files, schedule reviews), and our code does what must be deterministic (archetype -> formats, schema checks, running code tests, TTS, packaging). Every stage call is short and inspectable, which also keeps us inside the "under 30 s per tool call" guidance if we later wrap it as MCP.

### 7.2 Track-bullet mapping (use in the pitch)

| Track capability | WorkBuddy feature (VERIFIED in sections 1-3) | BiliMind step |
|---|---|---|
| Understanding the goal | one-sentence task + workspace folder + @files | lead extracts topic, deadline, exam scope, language from "my DS final is Friday, slides are here"; asks at most ONE question |
| Planning tasks | plan / task list (TaskCreate), "Planning" state | `outline` -> roadmap (archetype per topic), shown as checklist + Mermaid path |
| Executing actions | Bash/PowerShell tool runs our CLI; Write; ImageGen optional | `ingest`, `expand`, `narrate`, `build` |
| Collaborating & validating | Agent tool sub-agents in parallel, Expert Team lead/members, SendMessage | Writers expand lessons in parallel; Reviewer runs `validate` (code tests executed, citations checked, quiz answer keys checked); failed checks go back to one Writer with a correction |
| Integrating results | lead merges outputs | `build` -> one course |
| Delivering the outcome | Artifacts / Preview panel, share link, Automation, Telegram | `index.html` (cobalt player, offline), `lessons/*.md` (Obsidian), Anki deck, `study-plan.ics`, `report.md`; daily review Automation pushed to Telegram |

### 7.3 Skill folder layout (canonical copy lives in our repo)

```
bilimind/                          # zip THIS folder's contents (SKILL.md at zip root) for "Upload skill"
 ├── SKILL.md
 ├── scripts/
 │    ├── bilimind.mjs             # single entry: ingest|outline|expand|validate|narrate|build|run|status|doctor
 │    └── (bundled deps: one esbuild bundle, no npm install at runtime)
 ├── references/
 │    ├── archetypes.md            # archetype table -> mandatory block formats (read only when needed)
 │    ├── output-spec.md           # what each output file is and where it goes
 │    └── troubleshooting.md       # 401 from OpenRouter, sandbox denial, Node missing, budget hit
 └── templates/
      └── player/                  # index.html + cobalt CSS/JS for the offline course
```
Rules for the scripts (INFERRED, from the security/permission notes in 1.3): one bundled file, no runtime downloads, no `eval`, write only under the workspace output folder, read the OpenRouter key from the `OPENROUTER_API_KEY` env var or `%USERPROFILE%\.bilimind\config.json` (never inside the zip), print one JSON line per result so the agent can parse it, exit non-zero with a human sentence on failure, every call under ~60 s (one lesson per `expand` call), hard budget cap per run (`--max-usd 0.50`).

### 7.4 SKILL.md skeleton (correct format; adapt freely)

```markdown
---
name: bilimind
description: >-
  Turns a student's own lecture files (PDF, PPTX, DOCX, notes) or a small business's SOP documents into a complete,
  source-grounded interactive course: a learning path, lessons whose format follows the kind of knowledge, runnable
  and tested code exercises, voice narration, quizzes with citations, an Anki deck and a spaced-review study plan
  (.ics). Use when the user mentions an exam, final, midterm, revision, lecture slides, a course, a syllabus, studying
  by a deadline, staff onboarding, SOPs or training material, or asks for flashcards, quizzes or a study plan from files.
description_en: Build a source-grounded interactive course, quizzes, Anki deck and study plan from your own files.
version: 0.1.0
author: BiliMind (Odilov team)
---

# BiliMind: your files -> a course you own

You are the course-building lead. The student gives ONE sentence. You deliver a finished folder of files without
asking them to guide each step. Deterministic work is done by the CLI below; you plan, delegate, check and explain.

CLI (run with the Bash or PowerShell tool; quote the path):
  node "${CODEBUDDY_SKILL_DIR}/scripts/bilimind.mjs" <command> [flags]
Every command prints one JSON line: {"ok":true,...} or {"ok":false,"error":"...","hint":"..."}.

## Workflow

1. Goal. From the user's sentence extract: topic, deadline (date), exam scope if stated, language, audience
   (student | staff onboarding). Source folder = the folder the user named, else the current workspace.
   If the deadline or scope is genuinely unknown, ask ONE short question, then continue without further questions.
2. Plan. Create a task list (TaskCreate) with these steps and tick them off as you go. Also write
   `bilimind-out/<slug>/plan.md` with the same checklist.
3. Check: `node ".../bilimind.mjs" doctor` (Node version, key present, budget). If the key is missing, tell the user
   exactly how to set OPENROUTER_API_KEY and stop.
4. Ingest: `... ingest --src "<folder>" --out "bilimind-out/<slug>"`. Report: files read, pages, chunks.
5. Outline: `... outline --out "bilimind-out/<slug>" --deadline <YYYY-MM-DD> --lang <code>`.
   Show the user the path (lesson titles + archetype + why) in 10 lines or fewer. Do not wait for approval.
6. Expand IN PARALLEL: for each lesson key in outline.json, launch one sub-agent with the Agent tool
   (name it "Writer: <lesson title>"), at most 6 at a time. Each sub-agent runs ONLY
   `... expand --out "bilimind-out/<slug>" --lesson <key>` and returns the JSON line. Never write lesson content yourself.
7. Validate: launch one sub-agent named "Reviewer" that runs `... validate --out "bilimind-out/<slug>"`
   (executes code tests, checks every quiz answer against its cited source chunk, checks Mermaid, archetype coverage).
   For each failed check, re-run ONE Writer with `... expand --lesson <key> --correction "<the failed check, one sentence>"`.
   At most 2 repair rounds; then report anything still flagged honestly.
8. Narrate and package (can run in parallel): `... narrate --out ...` then `... build --out ...`.
9. Deliver. Open `bilimind-out/<slug>/index.html` in the preview. Reply with: what was built (counts), what was
   checked (checks run / passed / repaired / flagged), cost in USD from report.json, and the file list:
   index.html, lessons/*.md, deck.apkg (or deck.csv), study-plan.ics, report.md.
10. Offer: "Want a daily 10-minute review at 8 pm sent to Telegram?" If yes, create an Automation that runs
    `... review --out ... --today` and posts the result.

## Rules
- Content comes from the user's files. Every quiz answer and key claim carries a citation like "Week 7 slides, p.14".
  If the files do not cover something, say so; do not invent.
- Format follows pedagogy: never choose lesson block formats yourself; the CLI derives them from the archetype.
- Generated images never contain text; labels are added by the player.
- Write only inside `bilimind-out/`. Never print or log the API key. Stop if the CLI reports the budget cap.
- If a command fails twice, read references/troubleshooting.md, fix the cause, and continue with the remaining lessons.

## References (read only when needed)
- @references/archetypes.md
- @references/output-spec.md
- @references/troubleshooting.md
```
Notes on the skeleton: `allowed-tools` is deliberately omitted because it restricts tools (we need Agent, Bash/PowerShell, Read, Write, TaskCreate) (VERIFIED semantics: https://www.codebuddy.ai/docs/cli/skills). `description` carries the trigger words (VERIFIED requirement: https://open.workbuddy.cn/docs/skill). `${CODEBUDDY_SKILL_DIR}` is the VERIFIED placeholder for the skill folder; if WorkBuddy's upload path does not substitute it, the fallback is `${CLAUDE_SKILL_DIR}` (alias) or an absolute path written by a tiny install script (INFERRED; test on day 1). The marketplace fields (`description_en`, `version`, `author`) are harmless at runtime.

### 7.5 Expert Team wrapper (optional, after the skill works)

`.codebuddy-plugin/plugin.json` (trimmed; full field list in 3.1):
```json
{
  "name": "bilimind-course-team",
  "version": "0.1.0",
  "description": "A course-building team that turns your lecture files into a tested, narrated interactive course",
  "author": { "name": "BiliMind", "email": "team@bilimind.com" },
  "expertType": "team",
  "agentName": "bilimind-team-lead",
  "agents": ["./agents/bilimind-team-lead.md", "./agents/bilimind-planner.md", "./agents/bilimind-writer.md",
             "./agents/bilimind-narrator.md", "./agents/bilimind-coder.md", "./agents/bilimind-examiner.md"],
  "teamInfo": { "leadAgent": "bilimind-team-lead",
                "memberAgents": ["bilimind-planner", "bilimind-writer", "bilimind-narrator", "bilimind-coder", "bilimind-examiner"] },
  "skills": ["./skills/bilimind"],
  "displayName": { "en": "BiliMind Course Team", "zh": "BiliMind 课程团队" },
  "profession": { "en": "BiliMind Course Team", "zh": "BiliMind 课程团队" },
  "categoryId": "04-DataAI",
  "avatar": "avatars/team.png",
  "defaultInitPrompt": { "en": "My exam is on Friday and my slides are in this folder. Build me a course.", "zh": "..." },
  "quickPrompts": [ { "en": "My exam is on Friday and my slides are in this folder. Build me a course.", "zh": "..." },
                    { "en": "Turn our cafe SOPs into a staff onboarding course", "zh": "..." },
                    { "en": "Make flashcards and a study plan from these notes", "zh": "..." } ],
  "tags": [ { "en": "Exam prep", "zh": "备考" }, { "en": "Courses", "zh": "课程" }, { "en": "Onboarding", "zh": "培训" } ],
  "plugin": "bilimind-course-team",
  "members": [ { "id": "bilimind-team-lead", "name": {"en":"Dean","zh":"Dean"}, "profession": {"en":"Course lead","zh":"主理人"}, "avatar": "avatars/lead.png", "role": "lead" } ]
}
```
`settings.json`: `{ "agent": "bilimind-team-lead" }`. Lead prompt = the SKILL.md workflow, rewritten as "create the team with TeamCreate, dispatch Writers in parallel via the Agent tool with `name` = role, relay outputs, report after each phase, never write member output yourself" (pattern VERIFIED from the official trading-team template). Member prompts are 10-20 lines each, each tied to one CLI command. Credit warning: teams cost 3-5x (VERIFIED), so rehearse with the plain skill and use the team only for the recorded demo and the live pitch.

### 7.6 Install checklist (Windows 11 demo laptop)

1. Download WorkBuddy (international) from https://www.workbuddy.ai/ (`WorkBuddySetup.exe`, Windows 10 1809+ x64/ARM64, SmartScreen: More info -> Run anyway). The user signs in with Google or GitHub (we do not handle credentials). VERIFIED: Windows install guide and techpedia.
2. Settings: Language English; **Compact Mode OFF** (show tool calls); **Prevent Sleep ON**; **Auto-install non-high-risk skills ON**. VERIFIED settings exist (Setting page).
3. Note real paths: `dir %USERPROFILE%\.workbuddy`, `dir %USERPROFILE%\.codebuddy`; write them into section 1.2 of this file.
4. Check the model picker; note the international model list and credit balance. Ask organisers for hackathon credit codes.
5. Set the OpenRouter key for the CLI scripts: `setx OPENROUTER_API_KEY sk-or-...` (user runs it), then fully quit and restart WorkBuddy so the process sees it (INFERRED: env is read at process start, per CodeBuddy docs "environment variables are resolved at startup"). Alternative: `%USERPROFILE%\.bilimind\config.json` read by the script.
6. Optional: Settings -> Model -> Add model -> Custom -> `https://openrouter.ai/api/v1/chat/completions`, model `deepseek/deepseek-v4-flash` (or `anthropic/claude-haiku-5.5`), tick Tool calling, as the cheap backup brain.
7. Confirm `node -v` (>= 20) from inside a WorkBuddy task ("run node -v"): this also shows how WorkBuddy runs shell commands on Windows (PowerShell vs Git Bash).
8. Build the zip: contents of `bilimind/` with `SKILL.md` at the zip root. WorkBuddy -> Experts · Skills · Connectors -> Skills -> Add skill -> Upload skill. Wait for the security scan; confirm it is enabled under Installed.
9. Belt and braces: copy the same folder to `<demo workspace>\.codebuddy\skills\bilimind\`.
10. Demo workspace: `C:\Demo\DS-Final\` with 3-5 real lecture PDFs/PPTX (our own course material). Dry-run the exact demo sentence; accept each permission prompt once, or set Full Access for this folder only (the docs allow Full Access for disposable test folders).
11. Optional extras, in this order: Expert Team (7.5) -> Automation "daily review 8 pm" -> Telegram bot (BotFather token -> Assistant -> Channels -> Telegram).
12. Safety net: keep a finished `bilimind-out/` from a good run and a screen recording of the full run; if Wi-Fi or credits fail on stage, open the finished course and play the recording.
13. Test harness on our dev machine: `npm i -g @tencent-ai/codebuddy-code --registry=https://registry.npmmirror.com`, login International, then `codebuddy -p "..." -y --output-format stream-json --plugin-dir ./bilimind-plugin` for scripted end-to-end runs (if the free plan blocks CLI, test inside WorkBuddy instead).

### 7.7 Fallbacks

- **MCP not available / custom connector misbehaves**: nothing breaks; the skill calls the CLI through Bash/PowerShell. MCP was never on the critical path.
- **Skill upload fails or the skill does not trigger**: (a) workspace `.codebuddy/skills/bilimind/SKILL.md`; (b) say "use the bilimind skill" or `/bilimind`; (c) reference it directly in the prompt: `@bilimind/SKILL.md follow this workflow for ./slides`; (d) create an Expert via "My Experts -> Create expert" and paste the workflow as its prompt.
- **`${CODEBUDDY_SKILL_DIR}` not substituted**: ship `install.ps1` that copies the folder to `%USERPROFILE%\.bilimind\skill` and rewrites the path to an absolute one.
- **Scripts blocked by the sandbox or permission prompts too noisy**: Full Access for the demo folder only; or pre-approve during rehearsal.
- **Parallel sub-agents not shown nicely**: run the Expert Team version; or let the CLI do the parallelism (`bilimind run --concurrency 4`) and keep sub-agents for the Reviewer loop only, so the demo still shows collaboration.
- **WorkBuddy credits exhausted**: switch WorkBuddy's model to the OpenRouter custom model (no credits used, VERIFIED); our CLI already uses OpenRouter.
- **OpenRouter budget near the limit**: run `--model qwen/qwen3.5-flash-02-23` (cheapest tool-capable listed) for rehearsals; keep `deepseek/deepseek-v4-flash` for the final demo; cache stage outputs (`.work/*.json`) so reruns do not re-spend.

## 8. Day-1 spike: confirm these on the real install (about 45 minutes)

Each item is currently INFERRED or only partly documented. Record the answers back into this file.
1. Real on-disk location of an uploaded skill (`%USERPROFILE%\.workbuddy\skills\`?) and of custom MCP config (`%USERPROFILE%\.workbuddy\mcp.json`?).
2. Does the Upload skill zip want `SKILL.md` at the zip root or a top-level folder? Is there a size limit?
3. Is `${CODEBUDDY_SKILL_DIR}` substituted in an uploaded skill? Test with a body line such as "Run: node "${CODEBUDDY_SKILL_DIR}/scripts/hello.mjs"".
4. Does a skill in `<workspace>\.codebuddy\skills\` load in **Work mode**, or only in Coding mode?
5. Does Windows WorkBuddy run shell commands through PowerShell or Git Bash, and is `node` on its PATH?
6. Ask "use the Agent tool to run 3 sub-agents in parallel that each print a number". How does the UI show it (cards, a checklist, a member bar)? Take screenshots for the deck.
7. Ask for a TaskCreate checklist. Does it render as a ticking list?
8. Which models are in the international picker on Free vs Pro, and what is the credit cost per run? Can a Free account select a custom (OpenRouter) model?
9. Can you build an Expert Team locally ("My Experts -> Create expert team") from our prompts, and does it show member cards?
10. Is the CodeBuddy CLI usable on our plan (International login)?
11. International UI labels: the sidebar names may differ from the CN "Experts · Skills · Connectors" (the international docs say "Skill Marketplace", "Connectors", "Expert Center", "Automation", "Assistant"). Note the exact English labels for the demo script.

## 9. Sources (all fetched 2026-10-10)

Official WorkBuddy (international): https://www.workbuddy.ai/docs/workbuddy/Overview · /Quickstart · /Create-Task · /Task-Management · /Conversation · /Results · /Changelog · /pricing · /credits · /Subscription · /usage · From-Beginner-to-Expert-Guide/Function-Description/{Skills-Market, Connector, Expert-Center, Automation-Guide, Model, Setting, Permission-Modes, Assistant, Explore, Memory, Data} · Practice-Cases/{Create-Skills, AI-Self-Driven, Daily-Briefing, Claw-Slack} · Platform-Integration/Telegram-Guide · From-Beginner-to-Expert-Guide/{FAQ, Installation-Win-Guide}
Official WorkBuddy (China): https://www.workbuddy.cn/docs/workbuddy/ … Function-Description/{Skills-Market, Connector, Expert-Center, Automation-Guide, Model, Project, Setting, Worktree-Task}, /Changelog, /Pricing, /Credits, FAQ; https://www.workbuddy.cn/docs/workbuddyapp/Overview; https://www.workbuddy.cn/docs/workbuddymini/quick-start/Overview
WorkBuddy Open Platform: https://open.workbuddy.cn/docs · /docs/skill · /docs/connector · /docs/expert · /docs/expert-team
CodeBuddy Code CLI: https://www.codebuddy.ai/docs/cli/{skills, mcp, headless, cli-reference, installation, quickstart, plugins, plugins-reference, sub-agents, agent-teams, models, env-vars, tools-reference, costs}; https://www.codebuddy.cn/docs/ide/User-guide/MCP; npm metadata via https://registry.npmmirror.com/@tencent-ai%2fcodebuddy-code
Tencent Cloud: https://www.tencentcloud.com/techpedia/144100?lang=en; https://www.tencentcloud.com/document/product/1256/77295; https://intl.cloud.tencent.com/document/product/1254/81540; https://developer.cloud.tencent.com/article/2698011
Community / news: https://github.com/semlinker/awesome-workbuddy; https://docs.apiyi.com/en/scenarios/chat/workbuddy.md; https://hackmd.io/@yongquantan/S1YGtKwVzl; https://www.aap.com.au/aapreleases/cision20260513ae58232/; https://soyacincau.com/2026/08/20/tencent-cloud-malaysia-johor/; https://technode.global/prnasia/tencent-cloud-unveils-new-ai-agents-workbuddy-and-miora-driving-innovation-and-real-business-outcomes-across-southeast-asia/; https://www.news.cn/tech/20260901/af859c980cae416bb1e92deb0729409e/c.html; https://skillsmp.com/creators/mrzhangguoguo/oh-my-workbuddy/skills-skill; https://gitcode.csdn.net/69e7284054b52172bc6b325f.html (low reliability)
Live data: https://openrouter.ai/api/v1/models (prices quoted in 4.3)


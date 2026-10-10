---
name: bilimind-spike
description: "BiliMind spike: a 3-minute self-test of this WorkBuddy install (shell, Node, skill folder, task checklist, 3 parallel sub-agents, Preview panel). Use when the user types /bilimind-spike, 'run the bilimind spike', 'bilimind spike' or 'spike test'."
description_en: "BiliMind spike: a 3-minute self-test of this WorkBuddy install (shell, Node, skill folder, task checklist, 3 parallel sub-agents, Preview panel). Use when the user types /bilimind-spike, 'run the bilimind spike', 'bilimind spike' or 'spike test'."
version: 0.1.0
author: BiliMind team
---

# BiliMind spike

You are running a measured test of this WorkBuddy install for the BiliMind hackathon team. Follow the
steps below exactly and in order. Never ask the user a question: if a step fails, write down the exact
error, mark the task as still in progress, and continue with the next step. Never print the value of any
API key (the script only says yes/no). Do not use TeamCreate, do not publish or deploy anything, and do
not install anything.

**Skill folder as WorkBuddy substituted it:** `${CODEBUDDY_SKILL_DIR}`

If the line above still shows a placeholder that starts with a dollar sign and a curly brace instead of a
real folder path, write "S1: NOT substituted" in your notes and use
`C:\Users\User\.workbuddy-ai\skills\bilimind-spike` as SKILL_DIR. Otherwise write "S1: substituted" and
use the path shown above as SKILL_DIR. In every command below, replace SKILL_DIR and OUT_DIR with the
real absolute paths and keep the double quotes.

## Step 0: the checklist

Call TaskCreate four times, in this order, with exactly these titles:

1. `Check the environment`
2. `Run 3 writers in parallel`
3. `Build and preview the test page`
4. `Write SPIKE-RESULT.md`

Before each step call TaskUpdate to set that task to `in_progress`, and right after it finishes set it
to `completed`. Note whether each TaskCreate/TaskUpdate call succeeded.

## Step 1: environment (task 1)

Run this with the Bash tool. If you have no Bash tool, use the PowerShell tool and note that.

```
node "SKILL_DIR/scripts/hello.mjs" info --net
```

Keep the whole output for SPIKE-RESULT.md. Take OUT_DIR from the line that starts with `out_dir:`.
Note which tool you used (Bash or PowerShell) and the exact command text you sent.

## Step 2: three writers in parallel (task 2)

In ONE single message, call the Agent tool THREE times as parallel tool calls. Do not wait for Writer 1
to finish before starting Writer 2 and Writer 3. For each call use description `Writer N` and name
`Writer N` (N = 1, 2, 3), and subagent_type `general-purpose` (leave subagent_type out if it is
rejected). The prompt for Writer N is:

> You are Writer N in a timing test. Run exactly this one command with the Bash tool (PowerShell if you
> have no Bash tool), then stop:
> `node "SKILL_DIR/scripts/hello.mjs" --sleep 15 --id N --out "OUT_DIR"`
> Reply with one line: "Writer N:" followed by the last line the command printed.

When all three have returned, run:

```
node "SKILL_DIR/scripts/hello.mjs" report --out "OUT_DIR"
```

It prints `verdict:` PARALLEL, PARTLY PARALLEL or SEQUENTIAL, plus the wall time. Keep that output.

## Step 3: the test page in Preview (task 3)

```
node "SKILL_DIR/scripts/hello.mjs" page --out "OUT_DIR"
```

Then call the `present_files` tool with the absolute path printed on the `page:` line
(OUT_DIR/spike.html). present_files opens HTML in WorkBuddy's Preview panel. Note the tool's result
text. If present_files does not exist, say so and give the file path instead.

## Step 4: SPIKE-RESULT.md (task 4)

Write `OUT_DIR/SPIKE-RESULT.md` with the Write tool. Use this exact outline and fill every line with
what you actually saw (copy numbers and error text verbatim; write "unknown" rather than guess):

```
# BiliMind spike result (written by the agent)

## Run
- Started (from step 1 time_utc): ...
- Finished (now): ...
- Model you are running as (if you know it): ...
- Mode shown by WorkBuddy (if you know it): ...

## S1 skill folder
- Placeholder substituted in SKILL.md: yes/no, value: ...
- CODEBUDDY_SKILL_DIR as an environment variable (env.CODEBUDDY_SKILL_DIR line): ...
- script_dir printed by hello.mjs: ...

## S3 shell and Node
- Tool used for commands: Bash / PowerShell; exact command text: ...
- shell_guess / parent_process: ...
- node running hello.mjs: ...
- node on PATH: ...
- node bundled with WorkBuddy: ...
- cwd (workspace): ...
- WORKBUDDY_CONFIG_DIR: ...
- Other CODEBUDDY_/WORKBUDDY_ variables (names): ...

## S9 keys (yes/no only)
- DEEPSEEK_API_KEY: ...
- OPENROUTER_API_KEY: ...
- ~/.bilimind/config.json exists: ...

## S8 network and permissions
- api.deepseek.com / openrouter.ai / speech.platform.bing.com / cdn.jsdelivr.net: status and ms for each
- clock_check line and server clock skew (seconds): ...
- Was any command blocked, sandboxed or did it wait for user approval? Which one: ...

## S5 checklist
- TaskCreate x4 succeeded: ...  TaskUpdate calls succeeded: ...

## S4 parallel sub-agents
- Agent calls made in one message: yes/no
- Each writer's reply line: ...
- report verdict / start_spread_s / wall_s: ...

## S7 Preview
- present_files result text: ...

## Tools
- Exact names of every tool you can call in this session, comma-separated: ...

## Problems
- Every error or surprise, verbatim: ...
```

## Step 5: finish

As your FINAL tool call, call `present_files` with both OUT_DIR/SPIKE-RESULT.md and OUT_DIR/spike.html.
Then reply in at most 12 lines: S1 yes/no, shell, node versions, keys yes/no, the parallel verdict with
wall time, whether TaskCreate worked, and the two file paths. End with: "Now open the Preview, press Play,
click the slide-3 links, reload once, and copy the Results box into hackathon/SPIKE.md."

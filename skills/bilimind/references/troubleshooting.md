# Troubleshooting

Fix the cause once, then continue with the remaining work. Never ask the user a question, except to
tell them the one thing only they can do (a key, a permission).

## The CLI

- **`node` not found or too old.** WorkBuddy bundles Node 22: `ls "$HOME/.workbuddy-ai/binaries/node/versions/"`
  and call `".../<version>/node.exe"` (or `node` inside it) instead of `node`.
- **SKILL_DIR is a placeholder** (starts with a dollar sign): use `$WORKBUDDY_CONFIG_DIR/skills/bilimind`,
  else search: `ls "$HOME/.workbuddy-ai/skills/bilimind/scripts/bilimind.mjs"`.
- **Paths in Git Bash.** Give Node Windows paths (`C:/Users/...` or `C:\Users\...` inside double quotes),
  never `/c/Users/...`. `pwd -W` prints the Windows form of the current folder.
- **Quotes in flags.** A `--note`, `--reason` or `--text` containing double quotes, `$` or backticks
  breaks the shell: rephrase without them. For verdicts always use `--file` (a JSON file written
  with the Write tool), never long quotes on the command line.
- **`ok:false` with a hint.** Do what the hint says once. Same error twice: note it with
  `bm note --text "<what failed>"`, skip that lesson or step, and report it honestly at the end.
- **Never run `bm run`** to get around a failure.

## Keys and budget

- **Missing key** (`doctor` says `key: false`). Stop and tell the user, in one message: "BiliMind
  needs a DeepSeek or OpenRouter key in `%USERPROFILE%\.bilimind\config.json`, e.g.
  `{"provider":"deepseek","keys":{"deepseek":"sk-..."}}`. Create it, then say continue." Never read,
  print, create or copy that file or any key yourself.
- **Budget refusal** (`error` mentions budget, cap, reserve or balance). Launch no new work. If
  lessons are drafted, run `export` and `build` (no new model calls), present what exists, and say
  which steps were skipped and why.
- **HTTP 401/402/429 from the provider.** One retry after a short pause for 429; otherwise as budget.

## Permissions and sandbox

- **A command waits for approval or is blocked by the sandbox.** Tell the user in one line which
  command needs "Allow" (node running the bilimind CLI, network for the text API and Edge TTS). For a
  demo folder they can choose full access for that folder only.

## Sources

- **Scanned PDF pages** (`scanned_pages` in `ingest`): no text layer, so nothing on them can be taught
  or cited. Say which pages, continue with the rest. Do not invent their content.
- **Thin files or topics**: say so in the plan; prefer cutting a thin topic (planning.md).
- **No past paper detected but there is one**: `bm ingest --role "<file>=past_paper"`.
- **A licence or notes file read as a lecture** (`LICENSE.md`, `STATUS.md`, `README.md`):
  `bm ingest --role "<file>=other"`.

## Narration

- **Edge TTS 403 or timeouts.** Usually the PC clock: `doctor` shows `clock_skew_ms`. The CLI corrects
  for skew; if narration still fails, continue without it (`narrate` lists `failed`), build, and say
  the course has no audio for those lessons. Never block the course on audio.

## Sub-agents

- **Agent tool rejects `subagent_type: general-purpose`**: leave the field out.
- **A sub-agent never returns or returns nothing**: launch one replacement for that lesson; if it
  fails again, re-run `plan` with that lesson cut ("draft failed") and continue.
- **Expert Team: a repeated member name is refused**: use `bilimind-writer-2`, `bilimind-writer-3`, ...
  as `name`, keep `subagent_type` = `bilimind-writer`.

## Preview

- **`present_files` is missing**: give the absolute path of `index.html` and say "double-click it to
  open it in your browser".
- **The page is blank in Preview**: open the same `index.html` in Edge or Chrome; it works from
  `file://` offline.

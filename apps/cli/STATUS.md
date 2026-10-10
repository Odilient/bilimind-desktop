# apps/cli (WP6): status

**Works**
- All PLAN 2.5 commands are registered with commander (Telegram formatting is cut): doctor, init, goal, ingest, outline,
  exam-map, plan, draft, check, code-test (run/--dump/--apply/--disable), evidence, verdict (--item or --file),
  rewrite-item, narrate, export, build, note, due, grade, plant, plant-score, status, and run (builders only).
- Each command prints exactly one JSON line on stdout: `{ok,cmd,data,cost_usd,ms}` or `{ok:false,cmd,error,hint}`, with
  exit code 0 or 1. Usage errors (unknown command or option, missing flag, bad value) also print one JSON line. Help goes
  to stderr. Anything a library prints with console.log is sent to stderr. A socket left open cannot hang the agent:
  the process exits 1.5 s after the reply.
- `--course` defaults to the newest folder under ./bilimind-out/. Global options work before or after the command.
- Course commands append one LogEvent to crew/log.jsonl with the `--as` agent, the arguments, a one-line `result`
  (engine `summarize`), ms, cost and `data`. `init` logs into the folder it creates. `run` logs every step under its own
  agent label (Lead, "Writer · <title>", Coder, Checker).
- Engine pieces owned by WP6 (CONTRACTS.md): `init` skips LICENSE*.md and STATUS.md, `setGoal`, `status` (with `next`),
  `doctor` (key yes/no, balance against the reserve, spend today, clock skew from the Date header, Edge TTS reachable) and
  `run`/`runPipeline` with `--concurrency`, `--max-lessons`, `--repair-rounds` and `--no-narrate`.
- Bundle: `node apps/cli/scripts/bundle.mjs` writes `skills/bilimind/scripts/bilimind.mjs` (4.7 MB, esm, node22, every
  dependency inlined; the banner provides require, __dirname and __filename; ws's native addons stay external),
  `scripts/sql-wasm.wasm`, `templates/player.html` and 9 `assets/obj-*.webp`. A probe bundle with msedge-tts (one real
  synthesis, using the clock-skew fix) and sql.js (wasm) ran from a folder with no node_modules under Node 22.
- `node apps/cli/scripts/verify-bundle.mjs` copies the bundle to a temp folder with no node_modules and runs doctor and
  status under system Node 24.19 and WorkBuddy's Node 22.22.2: all PASS. Doctor reports DeepSeek, key: true, balance
  $9.19, reserve $3 and a clock skew of 28,800,000 ms (the PC is still 8 h behind). The bundled init and ingest also read
  the real ds-final PDFs (65 chunks; past-paper.pdf detected as past_paper) and the boba DOCX (role sop) under Node 22.
- Tests (`pnpm -F @bilimind/cli test`, about 35 s; 12 tests pass on the source and on the bundle with
  `BILIMIND_CLI=../../skills/bilimind/scripts/bilimind.mjs`):
  - `contract.test.ts` runs 43 CLI calls as real processes with the network blocked (test/no-net.mjs). It uses a fresh
    course plus a course seeded from `course-ds-mini.json` (test/seed.ts rebuilds crew/ from the fixture), checks the
    one-line contract on every call and prints which commands are ok, not implemented or failing.
    Latest result: ok for doctor, init, goal, ingest, status, note, plan, check, code-test, evidence, verdict, export,
    build, due, grade, plant and plant-score. narrate is still a stub. outline, draft and rewrite-item fail cleanly
    because they cannot go online in the test. No call broke the contract.
  - `run-e2e.test.ts` runs `run` against a local mock model (BILIMIND_BASE_URL, recorded samples). It goes from init to
    build, makes 2 lessons, writes index.html, and course.json passes validateCourse. It costs $0 and makes no real
    model call.
  - `run-heuristics.test.ts` covers the sentence parser, the keep/cut choice and summarize.

**Stubbed / not measured**
- A live `run` on the real folder (acceptance: under 6 min and under $0.08) is NOT measured: this lane had no live-LLM
  budget. To measure it: `node skills/bilimind/scripts/bilimind.mjs run --src showcase/sources/ds-final --sentence "<text>" --no-cache`
  and read `data.cost_usd` and `data.ms` in the JSON line. That is WP9's G2 job.
- The skill zip (it should be under 10 MB) belongs to WP7 (`skills/bilimind/scripts/zip-skill.mjs`). The files it zips
  add up to about 6.6 MB before compression.

**Next**
- After WP4 lands narrate: rebuild the bundle (`node apps/cli/scripts/bundle.mjs`), then run `verify-bundle.mjs` and the
  test suite against the bundle again.
- The seeded fixture's one-line paper ("Question 2 (20 marks) ...") gives exam-map "no Question N structure". WP2 may
  want its parser to accept "(N marks)" as well as "[N marks]".

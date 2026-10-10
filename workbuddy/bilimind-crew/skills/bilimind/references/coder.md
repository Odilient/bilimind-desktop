# Coder playbook: every code exercise runs before the student sees it

No exercise reaches the student unless its reference solution passes every test and its starter
fails at least one. The lead gave you: COURSE, the CLI path, the lessons with code and your label
(`Coder`). Never ask anyone a question.

`bm <command>` below means: `node "SKILL_DIR/scripts/bilimind.mjs" <command> --course "COURSE" --as "Coder"`
with the real paths written out. Every command prints one JSON line (`ok`, `data` or `error` + `hint`).

<!-- playbook:start -->
For each lesson with code:
1. **Run.** `bm code-test --lesson <key>`. `data.blocks` = `[{block, reference: {passed, total,
   failures: [{test, expected, actual}]}, starter: {passed, total}}]`. A block whose reference passes
   every test and whose starter fails at least one is done: `<key> b<n>: OK`.
2. **Dump.** For each other block: `bm code-test --lesson <key> --block <n> --dump`. The files are in
   `COURSE/crew/code/<key>-b<n>/`: `instructions.md`, `starter.js`, `solution.js`, `tests.json`
   (`[{name, call, expect}]`).
3. **Diagnose.** Read the instructions, the solution, the tests and the failures (expected vs actual).
   Decide who is wrong, from the instructions and the slide they cite:
   - the solution (off-by-one, wrong return shape, mutates its input): fix `solution.js`;
   - a test (its `expect` contradicts the instructions or the worked example): fix that `expect`;
   - a test calls the wrong function name or arguments: fix its `call`;
   - the starter already passes every test: delete the line(s) that solve it and leave
     `// TODO: <what the student must write>`;
   - a test calls a helper (`inOrder`, `node`) that only the starter defines: copy it into `solution.js`;
   - the starter never finishes (`while (true)` with only TODOs): add a placeholder `return;`;
   - the function must change its input (insert, heapify) but the tests check only the return value:
     make one test's `call` return the changed input too, so a solution that never writes fails.
   Change as little as possible; keep the function name and signature.
4. **Apply.** `bm note --lesson <key> --text "<key> b<n>: <what failed> -> <what you changed and why>"`, then
   `bm code-test --lesson <key> --block <n> --apply` (writes the files back and re-runs the tests).
5. **Repeat** 3-4 at most 3 rounds per exercise. Still failing:
   `bm code-test --lesson <key> --block <n> --disable --reason "<one sentence>"` (the student marks
   it themselves; the report says so).

Report one line per exercise, e.g.
`binary_heaps b4: reference 6/6 after fixing an off-by-one in test "insert-2", starter fails 4/6`.

Rules: edit only files under `COURSE/crew/code/`; never edit `crew/lessons/*.json` by hand (the Checker
updates those files through the CLI at the same time). Tests run in `node:vm` with a 2 s timeout, so no
infinite loops, no network, no files. Never print an API key.
<!-- playbook:end -->

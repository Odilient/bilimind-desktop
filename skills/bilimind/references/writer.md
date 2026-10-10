# Writer playbook: one lesson, drafted and repaired

You write ONE lesson of a BiliMind course from the user's own files, then make it pass the checks.
The lead gave you: the lesson key, the course folder COURSE, the CLI path and your label
(`Writer <key>`). Never ask anyone a question.

`bm <command>` below means: `node "SKILL_DIR/scripts/bilimind.mjs" <command> --course "COURSE" --as "Writer <key>"`
with the real paths written out. Every command prints one JSON line (`ok`, `data` or `error` + `hint`).

<!-- playbook:start -->
Run EVERY `draft` with the Bash tool's `timeout` set to `600000` (a draft takes 30-60 s and the default
120 s kill hides its result). A draft that timed out: run the same command once more (it is cached).
1. **Draft.** `bm draft --lesson <key>`. `data` = `{blocks, items, code_blocks, cites}`. On `ok:false`
   follow the hint once; a second failure ends your work: report `<key>: draft failed: <error>`.
2. **Check.** `bm check --lesson <key>`. `data` = `{total, passed, failed: [{rule, block, item, detail,
   suggestion}], auto_fixed}`. `block` is the block number (3 means id `b3`), `item` an id like `q4`.
   Nothing failed: go to step 5.
3. **Repair round.** For each failure decide the smallest fix, in your own words, and log it first
   with `bm note --lesson <key> --text "<key>: <rule> on b3/q4 -> <what you will do and why>"`:
   - A mandatory format is missing, or a diagram, playground or walkthrough is broken:
     `bm draft --lesson <key> --only <block type> --note "<what this block must teach, from which slide or page>"`.
   - A small fault in one block or item (wrong correct option, MCQ that gives its answer away, cloze
     without `____`, numeric without tolerance or unit, ordering already in the right order, a rubric
     whose weights do not sum to 1): fix it yourself with Edit in `COURSE/crew/lessons/<key>.json`.
     Keep every `id` (`b<n>`, `q<n>`) exactly as it is; never renumber, never reuse an id.
   - Q14 citations (no block cites a chunk): one full re-draft with
     `--note "give every block and question source_material_ids from its chunk list"`.
   - Q14b item citations: leave it; the Checker rules on those items.
   - Too thin, too few questions, or no question above "remember": one full re-draft,
     `bm draft --lesson <key> --note "<concrete instruction: which slides to use, what to add>"`.
   - A code exercise fails its tests: leave it. The Coder fixes code after you; just mention it.
4. **Re-check.** `bm check --lesson <key>`. At most 2 repair rounds in total, then stop even if
   something is still flagged. Honest is better than perfect.
5. **Report** exactly one line:
   `<key>: <B> blocks, <Q> questions, code <C>, <passed>/<total> checks, repaired: <what>; still flagged: <rules or none>`
   e.g. `hash_tables: 7 blocks, 5 questions, code 1, 15/15 checks, repaired: added walkthrough from Slide 9; still flagged: none`.

Rules: content comes only from the excerpts the CLI gave the lesson (the user's files), never from
your own knowledge. Never change the block formats the CLI chose (do not delete a mandatory block, do
not add a new type). Touch only `crew/lessons/<key>.json` of YOUR lesson. Never print an API key.
<!-- playbook:end -->

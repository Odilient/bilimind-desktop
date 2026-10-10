# Checker playbook: every answer checked against the user's slides

You rule on every quiz item using ONLY the excerpts in the evidence packet: never your own knowledge,
never the internet. The lead gave you: COURSE, the CLI path, the lessons and your label (`Checker`).
Never ask anyone a question.

`bm <command>` below means: `node "SKILL_DIR/scripts/bilimind.mjs" <command> --course "COURSE" --as "Checker"`
with the real paths written out. Every command prints one JSON line (`ok`, `data` or `error` + `hint`).

<!-- playbook:start -->
For each lesson:
0. **Re-solve.** `bm verdict --lesson <key> --auto` (Bash timeout `600000`). The fast model re-solves every
   auto-marked item without seeing the key and rules on it: `supported` with a verbatim slide quote,
   `not_covered`, or `contradicted` when the key is wrong (it then rewrites the item and re-solves the
   new one). `data` = `{checked, agreed, applied, excluded, labelled, rewritten, disagreements}`. Then rule
   on the items still `unchecked` or `pending` in the packet (short answers, rewritten items).
1. **Evidence.** `bm evidence --lesson <key>`, then Read the whole packet `COURSE/crew/evidence/<key>.md`:
   per item the prompt, the options, the answer the course accepts, and the cited excerpts (file,
   slide or page, text).
2. **Rule** on every item:
   - `supported`: an excerpt states the accepted answer, or implies it in one obvious step;
   - `contradicted`: an excerpt makes the accepted answer wrong (another value, the opposite claim,
     a different order, a different option);
   - `not_covered`: the excerpts neither confirm nor deny it.
   `quote` = the SHORTEST phrase from one cited excerpt that decides it, copied character for character
   from the packet (no retyping, no ellipsis, under 200 characters; for not_covered, the closest
   related phrase, or "" if nothing is related). `reason` = at most 25 words saying why.
3. **Apply.** Write the rulings with the Write tool to `COURSE/crew/evidence/<key>.rulings.json`:
   `[{"item": "q1", "verdict": "supported", "quote": "...", "reason": "..."}, ...]`, then
   `bm verdict --lesson <key> --file "COURSE/crew/evidence/<key>.rulings.json"`.
   `data` = `{applied, refused: [{item, why}], excluded, labelled}`. A refused item means the quote is
   not verbatim in its excerpts: copy a shorter exact phrase, write just that ruling to
   `COURSE/crew/evidence/<key>.retry.json` and apply it once more with `--file`.
4. **Rewrite.** For each contradicted item: `bm rewrite-item --lesson <key> --item <id> --reason "<your reason>"`
   (Bash timeout `600000`).
   It adds a NEW item (new id, status pending) after the old one, which stays excluded. Run
   `bm evidence --lesson <key>` again, read the new item, rule on it
   (`COURSE/crew/evidence/<key>.round2.json`, then `bm verdict --lesson <key> --file ...`). One rewrite per item; if the new item is contradicted too, leave it: it is
   excluded automatically and the report lists it.
5. Leave `not_covered` items as they are: the student sees them labelled "Beyond your slides".

Report one line per lesson, e.g.
`hash_tables: 6 items, 4 supported, 1 contradicted -> rewritten q7 -> supported (Slide 12), 1 beyond slides`.

Rules: never edit `crew/lessons/*.json` by hand (the Coder may be applying fixes to the same files);
never rule `supported` without a verbatim quote; when unsure between supported and not_covered, choose
not_covered. Never print an API key.
<!-- playbook:end -->

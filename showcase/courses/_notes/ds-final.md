# ds-final: build receipts (hero course)

Course folder: `showcase/courses/ds-final` (index.html, course.json, plan.md, REPORT.md, reviews.ics, deck.csv, lessons/, audio/).
Gate screenshots: `showcase/courses/_shots/ds-final` (report.json + home and 3 lessons at 1440 and 390).
Sources: the 5 PDFs in `showcase/sources/ds-final` (4 lecture decks and past-paper.pdf, plus LICENSE.md). dormathon-briefing was not used.

## Clock

`doctor` measured `clock_skew_ms` = 21000 (21 s), so the PC clock is correct. The note that it runs 8 h slow is out of date.
Real today is 2026-10-11 (Sunday) either way. The CLI `run` has no `--start` flag; its plan used the server-corrected
"today", which is 2026-10-11. My later `plan` calls passed `--start 2026-10-11` explicitly.

## Wall time and cost

| What | Value |
|---|---|
| Started (delete, then `run`) | 00:10:35 MYT, Sun 11 Oct 2026 |
| `run` (bundled CLI, `--no-cache`, DeepSeek direct, `--max-usd 0.15`) | 272.7 s, $0.039347, exit 0, 0 failed steps |
| Coder, Checker and lecturer pass, then narrate, export and build | 00:15 to 00:30 MYT |
| Receipts `wall_ms` (init to last build) | 1,180,494 ms (19 min 40 s) |
| Total text-model spend (crew/log.jsonl) | **$0.039922**: run $0.039347 + 2 x rewrite-item $0.000575 (cap $0.15) |
| TTS | Edge TTS, free |

Run steps: goal; ingest (5 files, 65 chunks, past paper detected); outline 94.3 s, $0.0132, 13 topics; exam-map (20 parts, 100 marks);
plan (3 lessons, 85/135 min); 3 parallel drafts plus 1 repair re-draft each (all checks OK after the repair, except heaps b3
code); Coder (heaps b3 disabled by the unattended run); fact-check, check, `verdict --auto` and evidence per lesson;
narrate (106 s); export; build.

## Final counts (build receipts)

- 3 lessons, 25 blocks, 14 items (11 quiz items + 3 code exercises), 8 Anki cards, 85 study minutes
- Checks 80/80 passed (4 repaired, 0 flagged); code tests 14/14 (reference passes every test, and each starter fails at least one)
- Auto-marked quiz items checked against the slides: 11/11; rejected 3, rewritten 3, labelled "Beyond your slides" 0
- Narration 24.3 min (map 9:26, BST 5:34, heaps 8:06) plus a 1:09 "Hear the plan"
- Gate (`hackathon/runs/g2/shoot.mjs`, 8 page loads): **0 console errors, 0 page errors, 0 error boundaries, 0 horizontal overflow**.
  The only failed requests are 3 mp3 preloads aborted when the tab closes (a known effect of how the gate runs, not a bug in the page).

## Plan (Lead decisions after the run)

- The run kept map ADT, BST and heaps; it cut 10 topics (AVL and the other zero-mark topics are cut with "No marks in the past paper").
- **Re-planned in path order** (Hash tables, Sun 11 -> BST, Mon 12 -> heaps, Tue 13). The player's "Start the path" and step
  numbers follow the path (outline order). The run's plan put heaps on day 1, so "Today" (heaps) and "Start the path"
  (map ADT, step 1) disagreed. Trade-off, noted in plan.md: heaps (25%) is learned the day before the exam with no spaced review.
- `exam-map --assign "Q2c=map_adt_and_hash_functions"`: the hash lesson teaches slide 9's chaining and has the buildChains
  exercise, so its share went from 15% to 21% (Q2b, Q2c, Q2d). The collision_resolution cut reason now says so.
- Titles shortened so the phone CTA "Continue · Step N, <short>" fits at 390 px: "Hash tables: the map ADT and hash functions"
  and "Binary heaps: priority queue operations" (outline.json; plan, exam-map, narration, export and build were rerun).

## Coder (code-test dump / fix / apply)

1. heaps b3 `siftUp`: the unattended run had **disabled** it (the reference solution was empty, there were no tests, and it was self-marked).
   I wrote slide 6's sift-up loop as solution.js and 5 tests: the walkthrough trace, slide 7 (insert 2), a climb to the root,
   a no-op case, and an in-place check. I added a TODO to the starter. Result: reference 5/5, starter fails 4/5, grader deterministic again.
   Later, the wording "5 swaps with 9" (it reads as five swaps) became "the key 5 swaps once with 9" in the instructions and
   the test name, and the TODO was split over 2 lines because it ran off the editor.
2. map b7 `buildChains`: the test "duplicate keys both stay in the chain" used 12, 19, 26, which are three different keys.
   It is now `buildChains([12, 19, 12], 7)[5]` -> `[12, 19, 12]`. Reference 5/5, starter 0/5.
3. BST b4 `insert`/`inOrder`: the run's repair re-draft fixed the missing helper. Reference 4/4, starter 0/4. No change.

## Strict-lecturer fixes (lesson JSON edits, each logged in the lesson's `repairs`, then check, narrate and build)

Hash tables (map_adt_and_hash_functions)
- b5 walkthrough traced 27, 40, 53, 66, 79 into m = 10, which has **no collision at all**, yet one step was titled "the first collision".
  I replaced it with slide 11's own trace: 89, 18, 49, 58, 69, with 1/1/2/4/4 probes, wrap-around and primary clustering.
- q5 (the auto-Checker's rewrite of q2) had a wrong explanation (it put "slot 1 holds 63, slot 2 holds 24") and no collision.
  New keys 24, 34, 50, 44, 89, 99 give 3 collisions and a wrap; the key is 50, 99, 24, 34, 44, 89 (verified by script).
- b1 promised AVL rotations "in the next node", but AVL is cut. I removed the promise.
- q6 (rewrite of q3) asks about double hashing, but its excerpts lacked slide 10. The item now also cites chunk 26 (Slide 10).
- Added q7 (numeric, apply): a miss for 57 in slide 9's chained table takes 3 comparisons. The quiz needed a 4th item after Q2c moved here (check Q2).

Binary search trees
- b2 step 8 said the successor of 20 is 30 ("30 has no left child"), but step 7 had just attached 25 under 30.
  The successor is **25**. The final in-order check (10 25 30 40 50 60 70) was already right.
- b2 step 4 warning ("you will attach 10 as the right child of 40") was impossible. Now: keep walking until an empty link.
- b6 misconception claimed that promoting 10 into 20's place breaks the order. It does not. The real failure is promoting 30,
  which already has the left child 25.
- b7 scenario s1 option b ("Promote 60"): the automatic fact-check had rewritten the outcome to "You copy 50 up", which no longer
  matched the option. I rewrote the outcome to explain why promoting 60 loses a subtree.
- b3 checklist said that comparing with the node object "never terminates". The loop still ends; the search just returns null.
- b4 code block cited nothing. It now cites Slide 5 and Slide 6. q4 now cites Slide 8, which states h = n − 1, and has an
  explanation written from slide 8. The model answer now covers the ascending and the descending case.

Binary heaps
- b2 step 6 said "Two swaps, two levels". The trace makes **one** swap. b2 step 5 called the stopping comparison "failed",
  but 4 ≤ 5 is true and that triggers the break.
- b6 misconception offered `[1, 6, 3, 5, 9, 8]` as an equally valid heap. **It is not**: 6 > 5. Replaced with `[1, 3, 6, 9, 5, 8]`.
- b4 checklist and q5 explanation said rounding fails on **odd** indices. It fails on **even** ones, for example i = 6, where 2.5 must become 2.
- q5 cloze no longer accepts `(i - 1) / 2` without the floor. The accepted forms are Math.floor, floor and ⌊⌋.
- q4 model answer ended with an O(V²) -> O(E log V) claim that no slide makes. I removed it and wrote an explanation from slide 12.
- q6: the LLM rewrite of the rejected q2 asked for the parent of index 6, which is the same fact as q5, and the quiz had lost the
  insert trace that Q3c (8 marks) asks for. I restored the q2 trace with correct arrays (7 -> 3 -> 1 -> 0, verified by script)
  and the Checker then ruled on it.

## Checker rulings (from the evidence excerpts only; every quote is verbatim and was accepted by `verdict --file`)

The unattended run's `verdict --auto` ruled first (round 1). I then ruled on every auto-marked and short-answer item myself.
0 quotes were refused.

| Lesson | Item | Ruling | Quote (verbatim) | Note |
|---|---|---|---|---|
| heaps | q2 (insert 4 trace) | **contradicted** | "parent: ⌊(i − 1) / 2⌋" | The key moved 4 to index 2; the parent of index 7 is 3. **verdict --auto had wrongly ruled this supported.** Rewritten -> q6 |
| heaps | q6 (rewrite of q2) | supported | "parent: ⌊(i − 1) / 2⌋" | Ruled on the LLM rewrite, then again after my correction to the insert trace |
| heaps | q3 (max child comparisons = 6) | supported | slide 8 `if (l < heap.length ...) s = r;` | 3 levels x 2 children |
| heaps | q4 (Dijkstra, short answer) | supported | "extract-min O(log n) O(n) O(1)* decrease-key O(log n) O(1) O(n)" | |
| heaps | q5 (parent formula, cloze) | supported | "parent: ⌊(i − 1) / 2⌋" | |
| map | q2 (probing order) | **contradicted** | "m = 10, h(k) = k mod 10" | First rejected by verdict --auto with no quote; I re-ruled with a verbatim slide quote so the receipt shows slide text. Rewritten -> q5 |
| map | q5 (rewrite of q2) | supported | "49 → 9 taken, try 0: 2 probes" | Ruled after my lecturer rewrite of its keys |
| map | q3 (primary clustering) | **contradicted** | "49 → 9 taken, try 0: 2 probes" | The model answer said 49 goes to slot 9; the slide puts it in slot 0. Rewritten -> q6 |
| map | q6 (rewrite of q3) | supported | "Primary clustering: occupied runs grow and attract more collisions" | Grader `self`, so the evidence packet skips it; ruled directly with --file |
| map | q4 (chaining, α = 2.5) | supported | "Load factor can exceed 1 must stay below 1" | |
| map | q7 (miss costs 3) | supported | "Bucket Chain 0 700 1 50 → 85 → 92" | |
| BST | q2 (delete 30, ordering) | supported | "Two children: copy in the in-order successor (smallest key in the right subtree), then delete the successor" | |
| BST | q3 (successor, cloze) | supported | "Two children: copy in the in-order successor (smallest key in the right subtree)" | |
| BST | q4 (worst-case height) | supported | "builds a chain: h = n − 1, so operations are O(n)" | After I added the Slide 8 cite |

Rulings files: `ds-final/crew/evidence/<lesson>.rulings.json`, `.round2.json`, `.round3.json`, `.round4.json`. Full history: `crew/verdicts/*.json`.

## Findings for other lanes (not fixed here: these are not my files)

1. **verdict --auto agreed with a wrong key** (heaps q2: the fast model's re-solve matched a key built on parent index 2 instead of 3, and it ruled the item supported). The unattended Checker can miss wrong traces.
2. **fact-check made content worse**: on BST b7 it changed a correct "You copy 60 up" into "You copy 50 up", which contradicts the option it belongs to. Its other 8 findings (1 on heaps, 7 on hash tables) were correct statements flagged with empty corrections.
3. **Path order vs plan order** (build.ts buildPath and player model.ts lessonOrder): the path follows outline order, but the plan days follow `--order`. When they differ, "Start the path", the step numbers and "Today" point at different lessons. I worked around it here by planning in path order.
4. **HeroSlab CTA** (player HeroSlab.vue:43): "Continue · Step N, <title>" is shortened only at ':', ',' or '('; a long title with none of those overflows the button at 390 px. I worked around it here with colon titles; the player should wrap or ellipsize.
5. **build.ts:99 lede grammar**: "every auto-marked answers checked against your files" ('every' with a plural noun).
6. **Unattended run disables exercises and deletes their tests** (heaps b3, which had an empty reference). Bringing one back means writing new tests.
7. **evidence.ts skips grader 'self' items**, and rewrite-item can return a self-marked short answer (map q6), so the rewrite never reaches the Checker's packet.
8. **receipts.excluded falls back to the item's explanation as the quote** when the auto-Checker's contradiction has no quote. The player then showed a Writer explanation under "Your slide says". Fixed in this course's data by re-ruling with a verbatim quote.
9. A `supported` ruling on an item without an explanation copies the slide quote into `explanation`, so Anki backs show a fragment. Fixed here by writing explanations for heaps q4 and BST q4.
10. receipts `code_fixed` = 1, but the Coder applied fixes to 2 exercises (heaps b3 re-enabled, map b7 test). The counter seems to count only blocks whose reference was failing.

## Housekeeping

- Deleted 6 stale narration mp3s in `audio/` that nothing referenced (left over from earlier narrate passes). 4 clips remain.
- Backups of the run's original lesson drafts and outline: scratchpad only, not shipped.
- No git commands; no files outside `showcase/courses/ds-final`, `_notes`, `_shots` and my scratchpad were changed.

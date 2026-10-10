# What the agents did: CSC2103 Data Structures final

> This demo course was built by the app's pipeline (run from the command line) and then reviewed by our
> team; every change after the unattended run is listed in [_notes](../_notes/ds-final.md). The review's
> steps are logged under the agent names in `crew/log.jsonl`; its notes are marked "Team review" below.

Built Sunday 11 October at 0:30 (Asia/Kuala_Lumpur) · 3 lessons · 6 agents · text-model cost $0.04 · wall time 19 min 39 s.

> My Data Structures final is Wednesday 9am. The slides and last year's paper are in this folder. I have 45 minutes a day. Get me ready.

## In numbers

| What | Count |
|---|---|
| Files read | 5 (63 pages) |
| Topics on the path | 8 (5 cut) |
| Lessons written | 3 |
| Agents | 6 (Lead, Writer · Binary search trees: search, insert and delete, Writer · The map ADT and hash functions that spread keys, Writer · Binary heaps and priority queue operations, Coder, Checker) |
| Checks | 80/80 passed, 4 repaired, 0 still flagged |
| Code tests (reference solutions) | 14/14 passed, 1 exercise fixed by the Coder |
| Quiz answers checked against your files | 23 rulings, 0 quotes refused as not verbatim |
| Rejected (contradicted by your files) | 3 |
| Rewritten | 3 |
| Labelled "Beyond your slides" | 0 |
| Narration | 24.3 min |
| Anki cards | 8 |
| Study minutes | 85 |
| Text-model cost | $0.04 |
| Wall time | 19 min 39 s |

## The plan

Exam: Wednesday 14 October at 9:00. 45 minutes a day, 135 minutes in all, 85 planned.

Assumptions the Lead made (it never asks):

- Read your sentence as: exam 2026-10-14 at 09:00, 45 minutes a day.
- "wednesday" read as 2026-10-14.

| Topic | Marks on the past paper | Share | Questions |
|---|---|---|---|
| Binary heaps: priority queue operations | 25 | 25% | Q3a, Q3b, Q3c, Q3d, Q3f |
| Hash tables: the map ADT and hash functions | 21 | 21% | Q2b, Q2c, Q2d |
| Binary search trees: search, insert and delete | 15 | 15% | Q5a, Q5b, Q5c, Q5d |
| Dynamic arrays vs linked lists: layout and cost | 10 | 10% | Q4a, Q4b |
| Counting operations to get Big-O from real code | 9 | 9% | Q1a, Q1b |
| Load factor and when to resize | 9 | 9% | Q2a, Q2e |
| Why n appends cost O(n) in total | 6 | 6% | Q1c |
| Build-heap in O(n), then heapsort | 5 | 5% | Q3e |
| Big-O, Omega and Theta: which bound? | — | counted in Counting operations to get Big-O from real code (Q1a) | — |
| Chaining vs open addressing for collisions | 0 | 0% |  |
| Sorted inserts turn a BST into a chain | 0 | 0% |  |
| AVL rotations: keeping height at log n | 0 | 0% |  |
| Capstone: last year's paper under the clock | 0 | 0% |  |

Kept, in order:

1. Hash tables: the map ADT and hash functions (25 min, 2026-10-11)
2. Binary search trees: search, insert and delete (30 min, 2026-10-12)
3. Binary heaps: priority queue operations (30 min, 2026-10-13)

Cut:

- **Counting operations to get Big-O from real code**: Did not fit your days: 9% of the marks for 30 min (Binary heaps gives 25% for the same time).
- **Big-O, Omega and Theta: which bound?**: Its exam questions (Q1a) belong to "Counting operations to get Big-O from real code", which did not fit your days either.
- **Dynamic arrays vs linked lists: layout and cost**: Did not fit your days: 10% of the marks for 30 min (Binary heaps gives 25% for the same time).
- **Why n appends cost O(n) in total**: Did not fit your days: 6% of the marks for 20 min plus its parent lesson (Binary heaps gives 25% for 30 min).
- **Load factor and when to resize**: Did not fit your days: 9% of the marks for 20 min (Binary heaps gives 25% for 30 min).
- **Chaining vs open addressing for collisions**: Its chaining question (Q2c) is practised in Hash tables (the slide 9 chaining example and the buildChains exercise), so it adds no marks of its own.
- **Sorted inserts turn a BST into a chain**: No marks in the past paper, so its minutes went to topics that score.
- **AVL rotations: keeping height at log n**: No marks in the past paper, so its minutes went to topics that score.
- **Build-heap in O(n), then heapsort**: Did not fit your days: 5% of the marks for 25 min (Binary heaps gives 25% for 30 min).
- **Capstone: last year's paper under the clock**: A full timed practice paper did not fit your days; each lesson rehearses its own question types instead.

Warnings:

- Cut lesson arrays_vs_linked_lists carries 10% of the past paper's marks.
- binary_heaps_and_priority_queues is learned the day before the exam and gets no spaced review (it carries 25% of the marks); move it earlier with --order if it matters.
- binary_heaps_and_priority_queues carries the most marks (25%) but gets 0 review(s), fewer than map_adt_and_hash_functions; study it earlier with --order.
- Variety (advice only, the Lead may keep this selection): Only 2 distinct archetypes were used across 3 nodes (you used: procedural×2, conceptual×1.); at least 3 are required. Look again at the nodes you labelled the same way: some of them are really about choosing between options, some are procedures, some are facts to be memorised, and at least one should have the learner produce something real.

## Who did what

| Agent | Steps | Failed | Cost | Time |
|---|---|---|---|---|
| Lead | 39 (init, goal, ingest, outline, exam-map, note, plan, narrate, export, build, check) | 0 | $0.01 | 4 min 10 s |
| Writer · Binary search trees: search, insert and delete | 4 (draft, check) | 0 | $0.0062 | 38 s |
| Writer · The map ADT and hash functions that spread keys | 4 (draft, check) | 0 | $0.0071 | 44 s |
| Writer · Binary heaps and priority queue operations | 4 (draft, check) | 0 | $0.0076 | 46 s |
| Coder | 17 (code-test, note) | 0 | $0.0000 | 0 s |
| Checker | 33 (fact-check, check, verdict, evidence, rewrite-item) | 0 | $0.0058 | 24 s |

## Checks per lesson

| Lesson | Rounds | First round | Last round | Still flagged |
|---|---|---|---|---|
| Binary search trees: search, insert and delete | 8 | 21/23 | 25/25 | 0 |
| Hash tables: the map ADT and hash functions | 10 | 26/27 | 28/28 | 0 |
| Binary heaps: priority queue operations | 8 | 28/29 | 27/27 | 0 |

## The Checker's rulings

11 supported by a verbatim quote from your files, 0 beyond your slides (labelled in the course), 3 rejected, 3 not ruled on.

Rejected items (never shown to you):

- **Hash tables: the map ADT and hash functions q2**: Keys 24, 37, 50, 63, 76, 89 are inserted in that order into an initially empty table of size m = 10 using h(k) = k mod 10 and linear probing, probing h(k), h(k)+1, h(k)+2 and wrapping past 9 back to 0. Order the six slots below by the key that ends up in each slot after all six insertions, starting with slot 0.
  - Why: With slide 11's h(k) = k mod 10, slot 0 holds 50 (50 mod 10 = 0), but the key starts with 76 and ends with 50.
  - Your file says: "m = 10, h(k) = k mod 10" (CSC2103-L02-hash-tables.pdf, Slide 11)
  - Rewritten as q5.
- **Hash tables: the map ADT and hash functions q3**: Explain what primary clustering is and why linear probing produces it. Then state one way double hashing reduces it.
  - Why: The model answer says 49 goes to slot 9 and the run is 9, 0, 1, 2; slide 11 puts 89 in slot 9 and 49 in slot 0.
  - Your file says: "49 → 9 taken, try 0: 2 probes" (CSC2103-L02-hash-tables.pdf, Slide 11)
  - Rewritten as q6.
- **Binary heaps: priority queue operations q2**: A min-heap is stored as `[6, 15, 8, 20, 19, 25, 11]`. Insert the key 4 and put the arrays below in the order they occur, starting from the state before the insert.
  - Why: By slide 5 the parent of index 7 is index 3 (key 20), not index 2; the accepted arrays move 4 to index 2 and swap with 8.
  - Your file says: "parent: ⌊(i − 1) / 2⌋" (CSC2103-L04-binary-heaps.pdf, Slide 5)
  - Rewritten as q6.

## Code exercises

| Exercise | First run | Last run | Starter fails a test |
|---|---|---|---|
| Binary search trees: search, insert and delete b4 | 4/4 | 4/4 | yes |
| Hash tables: the map ADT and hash functions b7 | 5/5 | 5/5 | yes |
| Binary heaps: priority queue operations b3 | 0/4 | 5/5 | yes |

## Decisions in the agents' own words

- **Lead** (00:12): Kept binary_heaps_and_priority_queues, map_adt_and_hash_functions, binary_search_tree_operations (by marks per minute, heaviest deck first); cut counting_operations_big_o, big_o_omega_theta_bounds, arrays_vs_linked_lists, amortised_cost_of_append, load_factor_and_resizing, collision_resolution_strategies, bst_chain_from_sorted_inserts, avl_rotation_balancing, build_heap_and_heapsort, capstone_past_paper_under_time.
- **Team review** (00:15, Coder step): binary_heaps_and_priority_queues b3: the unattended run disabled it (empty reference solution, no tests) -> wrote the slide 6 sift-up loop as solution.js and 5 tests from the walkthrough, slide 7 and an in-place check; starter gets a TODO line
- **Team review** (00:15, Coder step): map_adt_and_hash_functions b7: test 'duplicate keys both stay in the chain' used three different keys (12, 19, 26), so it never tested duplicates -> call is now buildChains([12, 19, 12], 7)[5], expect [12, 19, 12]
- **Team review** (00:24): Re-planned in path order (map ADT -> BST -> heaps, lecture order L2 -> L3 -> L4) so the plan days agree with 'Start the path' and the path's step numbers; the trade-off is that heaps (25% of marks) is learned on Tue 13 Oct and gets no spaced review before the exam.
- **Team review** (00:26, Coder step): binary_heaps_and_priority_queues b3: instructions and the first test name read '5 swaps with 9' (five swaps?) -> 'the key 5 swaps once with 9'; the starter's TODO line ran off the editor -> split over two lines
- **Team review** (00:26): exam-map: assigned Q2c (separate chaining trace, 6 marks) to Hash tables, which teaches slide 9's chaining example and has the buildChains exercise; collision_resolution_strategies keeps no marks of its own.

## Timeline

| Time | Agent | Step | Result | Took | Cost |
|---|---|---|---|---|---|
| 00:10:41 | Lead | init | course folder ds-final | 0 s |  |
| 00:10:41 | Lead | goal | exam 2026-10-14T09:00:00+08:00, 45 min/day, student, 2 assumptions | 0 s |  |
| 00:10:41 | Lead | ingest | 5 files, 65 chunks, 1 past paper | 0 s |  |
| 00:12:15 | Lead | outline | 13 topics, with code: counting_operations_big_o, big_o_omega_theta_bounds, arrays_vs_linked_lists, amortised_cost_of_append, map_adt_and_hash_functions, load_factor_and_resizing, collision_resolution_strategies, binary_search_tree_operations, bst_chain_from_sorted_inserts, avl_rotation_balancing, binary_heaps_and_priority_queues, build_heap_and_heapsort, capstone_past_paper_under_time | 1 min 34 s | $0.01 |
| 00:12:15 | Lead | exam-map | 20 questions, 100 marks: binary_heaps_and_priority_queues 25%, map_adt_and_hash_functions 15%, binary_search_tree_operations 15% | 0 s |  |
| 00:12:15 | Lead | note | Kept binary_heaps_and_priority_queues, map_adt_and_hash_functions, binary_search_tree_operations (by marks per minute, heaviest deck first); cut counting_operations_big_o, big_o_omega_theta_bounds, arrays_vs_linked_lists, amortised_cost_of_append, load_factor_and_resizing, collision_resolution_strategies, bst_chain_from_sorted_inserts, avl_rotation_balancing, build_heap_and_heapsort, capstone_past_paper_under_time. | 0 s |  |
| 00:12:15 | Lead | plan | 3 lessons, 85/135 min, 3 reviews, 3 warnings | 0 s |  |
| 00:12:33 | Writer · Binary search trees: search, insert and delete | draft binary_search_tree_operations | 8 blocks, 3 questions, 1 code exercise, 4 citations | 18 s | $0.0029 |
| 00:12:33 | Writer · Binary search trees: search, insert and delete | check binary_search_tree_operations | 21/23 checks, failed: Q2 item count, Q11 code runs | 0 s |  |
| 00:12:36 | Writer · The map ADT and hash functions that spread keys | draft map_adt_and_hash_functions | 9 blocks, 4 questions, 1 code exercise, 7 citations | 20 s | $0.0035 |
| 00:12:36 | Writer · The map ADT and hash functions that spread keys | check map_adt_and_hash_functions | 26/27 checks, failed: Q11 code runs, 1 auto-fixed | 0 s |  |
| 00:12:38 | Writer · Binary heaps and priority queue operations | draft binary_heaps_and_priority_queues | 9 blocks, 5 questions, 1 code exercise, 6 citations | 23 s | $0.0040 |
| 00:12:38 | Writer · Binary heaps and priority queue operations | check binary_heaps_and_priority_queues | 28/29 checks, failed: Q11 code runs | 0 s |  |
| 00:12:53 | Writer · Binary search trees: search, insert and delete | draft binary_search_tree_operations | 8 blocks, 4 questions, 1 code exercise, 4 citations | 20 s | $0.0033 |
| 00:12:53 | Writer · Binary search trees: search, insert and delete | check binary_search_tree_operations | 25/25 checks, 1 auto-fixed | 0 s |  |
| 00:12:59 | Writer · The map ADT and hash functions that spread keys | draft map_adt_and_hash_functions | 9 blocks, 4 questions, 1 code exercise, 5 citations | 23 s | $0.0036 |
| 00:12:59 | Writer · The map ADT and hash functions that spread keys | check map_adt_and_hash_functions | 27/27 checks | 0 s |  |
| 00:13:01 | Writer · Binary heaps and priority queue operations | draft binary_heaps_and_priority_queues | 8 blocks, 5 questions, 1 code exercise, 9 citations | 23 s | $0.0036 |
| 00:13:01 | Writer · Binary heaps and priority queue operations | check binary_heaps_and_priority_queues | 26/27 checks, failed: Q11 code runs, 1 auto-fixed | 0 s |  |
| 00:13:01 | Coder | code-test binary_search_tree_operations | b4 reference 4/4, starter 0/4 | 0 s |  |
| 00:13:01 | Coder | code-test map_adt_and_hash_functions | b7 reference 5/5, starter 0/5 | 0 s |  |
| 00:13:01 | Coder | code-test binary_heaps_and_priority_queues | b3 reference 0/4, starter 0/4 | 0 s |  |
| 00:13:01 | Coder | code-test binary_heaps_and_priority_queues | b3 self-marked | 0 s |  |
| 00:13:02 | Checker | fact-check binary_heaps_and_priority_queues | 0 of 1 error fixed in place, 1 left | 1 s | $0.0006 |
| 00:13:02 | Checker | check binary_heaps_and_priority_queues | 27/27 checks | 0 s |  |
| 00:13:12 | Checker | verdict binary_heaps_and_priority_queues | re-solved 3: 3 agree with the key, 0 wrong keys rejected, 0 beyond the slides | 10 s | $0.0019 |
| 00:13:12 | Checker | evidence binary_heaps_and_priority_queues | 4 items -> crew/evidence/binary_heaps_and_priority_queues.md | 0 s |  |
| 00:13:15 | Checker | fact-check map_adt_and_hash_functions | 0 of 7 errors fixed in place, 7 left | 3 s | $0.0009 |
| 00:13:15 | Checker | check map_adt_and_hash_functions | 27/27 checks | 0 s |  |
| 00:13:20 | Checker | verdict map_adt_and_hash_functions | re-solved 3: 2 agree with the key, 1 wrong key rejected and rewritten, 0 beyond the slides | 4 s | $0.0011 |
| 00:13:20 | Checker | evidence map_adt_and_hash_functions | 3 items -> crew/evidence/map_adt_and_hash_functions.md | 0 s |  |
| 00:13:21 | Checker | fact-check binary_search_tree_operations | 1 of 1 error fixed in place | 1 s | $0.0004 |
| 00:13:21 | Checker | check binary_search_tree_operations | 25/25 checks | 0 s |  |
| 00:13:22 | Checker | verdict binary_search_tree_operations | re-solved 2: 2 agree with the key, 0 wrong keys rejected, 0 beyond the slides | 1 s | $0.0003 |
| 00:13:22 | Checker | evidence binary_search_tree_operations | 3 items -> crew/evidence/binary_search_tree_operations.md | 0 s |  |
| 00:15:08 | Lead | narrate | 4 clips, 24.0 min | 1 min 46 s |  |
| 00:15:08 | Lead | export | 7 files | 0 s |  |
| 00:15:13 | Lead | build | index.html 1007 KB, 3 lessons | 6 s |  |
| 00:15:20 | Coder | code-test binary_heaps_and_priority_queues | b3 self-marked | 0 s |  |
| 00:15:46 | Team review (Coder step) | note binary_heaps_and_priority_queues | binary_heaps_and_priority_queues b3: the unattended run disabled it (empty reference solution, no tests) -> wrote the slide 6 sift-up loop as solution.js and 5 tests from the walkthrough, slide 7 and an in-place check; starter gets a TODO line | 0 s |  |
| 00:15:46 | Coder | code-test binary_heaps_and_priority_queues | b3 reference 5/5, starter 1/5 | 0 s |  |
| 00:15:55 | Coder | code-test map_adt_and_hash_functions | b7 reference 5/5, starter 0/5 | 0 s |  |
| 00:15:56 | Team review (Coder step) | note map_adt_and_hash_functions | map_adt_and_hash_functions b7: test 'duplicate keys both stay in the chain' used three different keys (12, 19, 26), so it never tested duplicates -> call is now buildChains([12, 19, 12], 7)[5], expect [12, 19, 12] | 0 s |  |
| 00:15:56 | Coder | code-test map_adt_and_hash_functions | b7 reference 5/5, starter 0/5 | 0 s |  |
| 00:15:57 | Coder | code-test binary_search_tree_operations | b4 reference 4/4, starter 0/4 | 0 s |  |
| 00:17:55 | Lead | check binary_heaps_and_priority_queues | 27/27 checks | 0 s |  |
| 00:17:56 | Lead | check map_adt_and_hash_functions | 27/27 checks | 0 s |  |
| 00:17:56 | Lead | check binary_search_tree_operations | 25/25 checks | 0 s |  |
| 00:18:00 | Checker | evidence binary_heaps_and_priority_queues | 4 items -> crew/evidence/binary_heaps_and_priority_queues.md | 0 s |  |
| 00:18:00 | Checker | evidence map_adt_and_hash_functions | 3 items -> crew/evidence/map_adt_and_hash_functions.md | 0 s |  |
| 00:18:01 | Checker | evidence binary_search_tree_operations | 3 items -> crew/evidence/binary_search_tree_operations.md | 0 s |  |
| 00:18:50 | Checker | evidence binary_heaps_and_priority_queues | 4 items -> crew/evidence/binary_heaps_and_priority_queues.md | 0 s |  |
| 00:18:50 | Checker | evidence binary_search_tree_operations | 3 items -> crew/evidence/binary_search_tree_operations.md | 0 s |  |
| 00:19:04 | Checker | verdict binary_heaps_and_priority_queues | 4 applied, 1 excluded | 0 s |  |
| 00:19:04 | Checker | verdict map_adt_and_hash_functions | 3 applied, 1 excluded | 0 s |  |
| 00:19:04 | Checker | verdict binary_search_tree_operations | 3 applied | 0 s |  |
| 00:19:12 | Checker | rewrite-item binary_heaps_and_priority_queues | new q6 replaces q2 (pending) | 1 s | $0.0003 |
| 00:19:14 | Checker | rewrite-item map_adt_and_hash_functions | new q6 replaces q3 (pending) | 2 s | $0.0003 |
| 00:19:14 | Checker | evidence binary_heaps_and_priority_queues | 4 items -> crew/evidence/binary_heaps_and_priority_queues.md | 0 s |  |
| 00:19:15 | Checker | evidence map_adt_and_hash_functions | 2 items -> crew/evidence/map_adt_and_hash_functions.md | 0 s |  |
| 00:19:29 | Checker | evidence map_adt_and_hash_functions | 2 items -> crew/evidence/map_adt_and_hash_functions.md | 0 s |  |
| 00:19:44 | Checker | verdict binary_heaps_and_priority_queues | 1 applied | 0 s |  |
| 00:19:45 | Checker | verdict map_adt_and_hash_functions | 1 applied | 0 s |  |
| 00:19:51 | Lead | check binary_heaps_and_priority_queues | 27/27 checks | 0 s |  |
| 00:19:52 | Lead | check map_adt_and_hash_functions | 26/26 checks | 0 s |  |
| 00:19:52 | Lead | check binary_search_tree_operations | 25/25 checks | 0 s |  |
| 00:20:29 | Lead | narrate | 4 clips, 24.2 min | 29 s |  |
| 00:20:29 | Lead | export | 7 files | 0 s |  |
| 00:20:30 | Lead | build | index.html 1015 KB, 3 lessons | 0 s |  |
| 00:22:02 | Checker | verdict map_adt_and_hash_functions | 1 applied, 1 excluded | 0 s |  |
| 00:23:32 | Lead | plan | 3 lessons, 85/135 min, 3 reviews, 4 warnings | 0 s |  |
| 00:24:07 | Team review | note | Re-planned in path order (map ADT -> BST -> heaps, lecture order L2 -> L3 -> L4) so the plan days agree with 'Start the path' and the path's step numbers; the trade-off is that heaps (25% of marks) is learned on Tue 13 Oct and gets no spaced review before the exam. | 0 s |  |
| 00:26:03 | Coder | code-test binary_heaps_and_priority_queues | b3 reference 5/5, starter 1/5 | 0 s |  |
| 00:26:03 | Team review (Coder step) | note binary_heaps_and_priority_queues | binary_heaps_and_priority_queues b3: instructions and the first test name read '5 swaps with 9' (five swaps?) -> 'the key 5 swaps once with 9'; the starter's TODO line ran off the editor -> split over two lines | 0 s |  |
| 00:26:04 | Coder | code-test binary_heaps_and_priority_queues | b3 reference 5/5, starter 1/5 | 0 s |  |
| 00:26:04 | Lead | exam-map | 20 questions, 100 marks: binary_heaps_and_priority_queues 25%, map_adt_and_hash_functions 15%, binary_search_tree_operations 15% | 0 s |  |
| 00:26:21 | Lead | exam-map | 20 questions, 100 marks: binary_heaps_and_priority_queues 25%, map_adt_and_hash_functions 21%, binary_search_tree_operations 15% | 0 s |  |
| 00:26:21 | Lead | plan | 3 lessons, 85/135 min, 3 reviews, 4 warnings | 0 s |  |
| 00:26:21 | Team review | note | exam-map: assigned Q2c (separate chaining trace, 6 marks) to Hash tables, which teaches slide 9's chaining example and has the buildChains exercise; collision_resolution_strategies keeps no marks of its own. | 0 s |  |
| 00:26:27 | Checker | evidence binary_heaps_and_priority_queues | 4 items -> crew/evidence/binary_heaps_and_priority_queues.md | 0 s |  |
| 00:26:34 | Checker | verdict binary_heaps_and_priority_queues | 1 applied | 0 s |  |
| 00:26:34 | Lead | check binary_heaps_and_priority_queues | 27/27 checks | 0 s |  |
| 00:26:35 | Coder | code-test binary_heaps_and_priority_queues | b3 reference 5/5, starter 1/5 | 0 s |  |
| 00:26:35 | Lead | check map_adt_and_hash_functions | 25/26 checks, failed: Q2 item count | 0 s |  |
| 00:26:36 | Coder | code-test map_adt_and_hash_functions | b7 reference 5/5, starter 0/5 | 0 s |  |
| 00:26:37 | Lead | check binary_search_tree_operations | 25/25 checks | 0 s |  |
| 00:26:37 | Coder | code-test binary_search_tree_operations | b4 reference 4/4, starter 0/4 | 0 s |  |
| 00:26:41 | Lead | check map_adt_and_hash_functions | 25/26 checks, failed: Q2 item count | 0 s |  |
| 00:27:07 | Lead | check map_adt_and_hash_functions | 27/28 checks, failed: Q9 numeric | 0 s |  |
| 00:27:08 | Checker | evidence map_adt_and_hash_functions | 3 items -> crew/evidence/map_adt_and_hash_functions.md | 0 s |  |
| 00:27:16 | Lead | check map_adt_and_hash_functions | 28/28 checks | 0 s |  |
| 00:27:16 | Checker | evidence map_adt_and_hash_functions | 3 items -> crew/evidence/map_adt_and_hash_functions.md | 0 s |  |
| 00:27:16 | Checker | verdict map_adt_and_hash_functions | 1 applied | 0 s |  |
| 00:27:22 | Lead | check binary_heaps_and_priority_queues | 27/27 checks | 0 s |  |
| 00:27:22 | Lead | check map_adt_and_hash_functions | 28/28 checks | 0 s |  |
| 00:27:23 | Lead | check binary_search_tree_operations | 25/25 checks | 0 s |  |
| 00:27:36 | Lead | narrate | 4 clips, 24.3 min | 13 s |  |
| 00:27:36 | Lead | export | 7 files | 0 s |  |
| 00:27:37 | Lead | build | index.html 1020 KB, 3 lessons | 0 s |  |
| 00:30:19 | Lead | check binary_heaps_and_priority_queues | 27/27 checks | 0 s |  |
| 00:30:20 | Lead | check binary_search_tree_operations | 25/25 checks | 0 s |  |

---

*Every number above is recomputed from `crew/log.jsonl` and the course files. Made with BiliMind.*

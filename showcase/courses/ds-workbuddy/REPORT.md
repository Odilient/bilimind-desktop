# What the agents did: Data structures final prep

Built Sunday 11 October at 5:18 (Asia/Kuala_Lumpur) · 4 lessons · 7 agents · text-model cost $0.01 · wall time 12 min 20 s.

> My Data Structures final is Wednesday 9am. The slides and last year's paper are in C:/Demo/DS-WorkBuddy. I have 45 minutes a day. Get me ready.

## In numbers

| What | Count |
|---|---|
| Files read | 5 (63 pages) |
| Topics on the path | 7 (3 cut) |
| Lessons written | 4 |
| Agents | 7 (Lead, Writer binary_search_tree_operations, Writer arrays_vs_linked_lists, Writer binary_heaps_and_heapsort, Writer hash_tables_from_keys_to_buckets, Coder, Checker) |
| Checks | 103/106 passed, 4 repaired, 3 still flagged |
| Code tests (reference solutions) | 16/16 passed, 3 exercises fixed by the Coder |
| Quiz answers checked against your files | 15 rulings, 0 quotes refused as not verbatim |
| Rejected (contradicted by your files) | 0 |
| Rewritten | 0 |
| Labelled "Beyond your slides" | 6 |
| Narration | 23.2 min |
| Anki cards | 13 |
| Study minutes | 120 |
| Text-model cost | $0.01 |
| Wall time | 12 min 20 s |

## The plan

Exam: Wednesday 14 October at 9:00. 45 minutes a day, 135 minutes in all, 120 planned.

Assumptions the Lead made (it never asks):

- Time zone not stated; using Asia/Kuala_Lumpur
- Study starts today: 3 study days (Oct 11, 12, 13)

| Topic | Marks on the past paper | Share | Questions |
|---|---|---|---|
| Hash tables: from keys to buckets | 30 | 30% | Q2a, Q2b, Q2c, Q2d, Q2e |
| Binary heaps, priority queues and heapsort | 27 | 27% | Q3a, Q3c, Q3d, Q3e, Q3f |
| Arrays vs linked lists: linear containers | 16 | 16% | Q1c, Q4a, Q4b |
| Binary search trees: search, insert and delete | 15 | 15% | Q5a, Q5b, Q5c, Q5d |
| Big-O, Big-Omega and Big-Theta | 9 | 9% | Q1a, Q1b |
| Heap-to-array index mapping | 3 | 3% | Q3b |
| Complexity classes cheat sheet | 0 | 0% |  |
| Chaining vs open addressing | 0 | 0% |  |
| AVL trees: rotations that guarantee balance | 0 | 0% |  |
| AVL rotation drill | 0 | 0% |  |
| Capstone: last year's paper in 45 minutes | 0 | 0% |  |

Kept, in order:

1. Arrays vs linked lists: linear containers (30 min, 2026-10-11)
2. Hash tables: from keys to buckets (30 min, 2026-10-12)
3. Binary heaps, priority queues and heapsort (30 min, 2026-10-13)
4. Binary search trees: search, insert and delete (30 min, 2026-10-13)

Cut:

- **Big-O, Big-Omega and Big-Theta**: Lowest weight at 9% of marks; 3 days allow 4 lessons; complexity analysis touched on within each data structure lesson
- **Complexity classes cheat sheet**: No marks in past paper; parent big_o cut
- **Chaining vs open addressing**: No marks in past paper; collision strategies covered within the hash tables lesson
- **AVL trees: rotations that guarantee balance**: No question in last year's paper; 3 days allow 4 lessons
- **AVL rotation drill**: No marks; parent avl_trees cut
- **Heap-to-array index mapping**: Only 3% of marks; index arithmetic covered within the binary heaps lesson
- **Capstone: last year's paper in 45 minutes**: Capstone not on the exam; 3 days allow 4 focused lessons

Warnings:

- hash_tables_from_keys_to_buckets is sized at 40 min, more than 70% of a 45-minute day; planned as 30 min (split it into two lessons if it really needs more).
- binary_heaps_and_heapsort is sized at 35 min, more than 70% of a 45-minute day; planned as 30 min (split it into two lessons if it really needs more).
- binary_search_tree_operations is sized at 35 min, more than 70% of a 45-minute day; planned as 30 min (split it into two lessons if it really needs more).
- 2026-10-13 needs 70 min (lessons plus reviews), over the daily 45 min. Cut a lesson or move one with --order.
- binary_heaps_and_heapsort is learned the day before the exam and gets no spaced review (it carries 27% of the marks); move it earlier with --order if it matters.
- binary_search_tree_operations is learned the day before the exam and gets no spaced review (it carries 15% of the marks); move it earlier with --order if it matters.
- hash_tables_from_keys_to_buckets carries the most marks (30%) but gets 1 review(s), fewer than arrays_vs_linked_lists; study it earlier with --order.
- Variety (advice only, the Lead may keep this selection): `procedural` was used on 2 of 4 nodes (50%), above the 40% ceiling — at most 1 may carry it. you used: procedural×2, discriminative×1, conceptual×1. Re-examine every `procedural` node and ask what the learner actually has to be able to do at the end of it; several of them will turn out to be a different kind of knowledge.

## Who did what

| Agent | Steps | Failed | Cost | Time |
|---|---|---|---|---|
| Lead | 11 (init, goal, ingest, outline, exam-map, plan, note, narrate) | 0 | $0.0033 | 2 min 34 s |
| Writer binary_search_tree_operations | 7 (draft, check, note) | 0 | $0.0021 | 1 min 15 s |
| Writer arrays_vs_linked_lists | 2 (draft, check) | 0 | $0.0016 | 38 s |
| Writer binary_heaps_and_heapsort | 2 (draft, check) | 0 | $0.0021 | 47 s |
| Writer hash_tables_from_keys_to_buckets | 4 (draft, check, note) | 0 | $0.0029 | 49 s |
| Coder | 20 (code-test, note) | 0 | $0.0000 | 3 s |
| Checker | 12 (verdict, evidence) | 0 | $0.0006 | 24 s |

## Checks per lesson

| Lesson | Rounds | First round | Last round | Still flagged |
|---|---|---|---|---|
| Binary search trees: search, insert and delete | 2 | 17/20 | 22/23 | 1 |
| Arrays vs linked lists: linear containers | 1 | 25/26 | 25/26 | 1 |
| Binary heaps, priority queues and heapsort | 1 | 27/27 | 27/27 | 0 |
| Hash tables: from keys to buckets | 2 | 26/28 | 29/30 | 1 |

Still flagged after the last round:

- Binary search trees: search, insert and delete, block b4: **Q11 code runs** reference fails 'search finds inserted key': SyntaxError: Unexpected identifier 'root'; reference fails 'search returns null for absent key': SyntaxError: Unexpected identifier 'root'; reference fails 'delete leaf': SyntaxError: Unexpected identifier 'root'; reference fails 'delete node with two children': SyntaxError: Unexpected identifier 'root'
- Arrays vs linked lists: linear containers, block b6: **Q11 code runs** reference fails 'reverses three-node list': SyntaxError: Unexpected identifier 'n1'; reference fails 'single node': SyntaxError: Unexpected identifier 'n'; reference fails 'two nodes': SyntaxError: Unexpected identifier 'n'
- Hash tables: from keys to buckets, block b9: **Q11 code runs** reference fails 'cat maps to a bucket': expected 6, got 3; reference fails 'dog maps to a different bucket': expected 2, got 6; reference fails 'deterministic': expected 6, got 3; reference fails 'modulo m': expected 3, got 2

## The Checker's rulings

9 supported by a verbatim quote from your files, 6 beyond your slides (labelled in the course), 0 rejected, 4 not ruled on.

Beyond your slides:

- Arrays vs linked lists: linear containers q3: Compare a singly linked list with a dynamic array in terms of (i) access by index, (ii) insertion at the front, and (iii) memory use.
- Hash tables: from keys to buckets q2: For linear probing, the expected number of probes for an unsuccessful search is approximately ½(1 + 1/(1 − α)²). Compute this value for α = 0.8. Give your answer to one decimal place.
- Hash tables: from keys to buckets q3: Explain what primary clustering is and why it occurs with linear probing. Then describe how double hashing reduces it.
- Hash tables: from keys to buckets q5: An open-addressing hash table uses linear probing. At load factor α = 0.5 the expected probes for an unsuccessful search are about 2.5, using ½(1 + 1/(1−α)²). At α = 0.9 the same formula gives about 50.5. By what factor does the probe count grow?
- Binary heaps, priority queues and heapsort q2: Which of the following arrays represents a valid min-heap?
- Binary search trees: search, insert and delete q4: Insert the keys 55, 30, 70, 20, 40, 60, 80, 35 in this order into an initially empty BST. Draw the final tree (describe it in text, e.g., 'root is 55, left child is 30, ...'). Then delete key 30 using the in-order successor and describe the resulting tree. Explain why the in-order successor method preserves the BST property.

## Code exercises

| Exercise | First run | Last run | Starter fails a test |
|---|---|---|---|
| Arrays vs linked lists: linear containers b6 | 1/4 | 4/4 | yes |
| Hash tables: from keys to buckets b9 | 0/4 | 4/4 | yes |
| Binary heaps, priority queues and heapsort b5 | 4/4 | 4/4 | yes |
| Binary search trees: search, insert and delete b4 | 0/4 | 4/4 | yes |

## Decisions in the agents' own words

- **Lead** (05:10): Tried alternative order (arrays, binary_heaps, hash_tables, binary_search_trees) but hash_tables (30%) got 0 reviews — worse. Keeping original order: arrays D1, hash_tables D2, heaps+BST D3. Oct 13 is crowded at 70 min vs 45; both heaps and BST get no spaced review. Unavoidable with 4 lessons in 3 days.
- **Lead** (05:10): Launching 4 Writers in parallel: arrays_vs_linked_lists, hash_tables_from_keys_to_buckets, binary_heaps_and_heapsort, binary_search_tree_operations
- **Writer binary_search_tree_operations** (05:11): binary_search_tree_operations: Q15 thin lesson -> re-draft with expanded teaching blocks, concrete worked detail from all 6 chunks, target ~1050 words
- **Writer binary_search_tree_operations** (05:11): binary_search_tree_operations: Q2 item count -> re-draft to add 1 more quiz item (apply/analyze level) from cited slides
- **Writer binary_search_tree_operations** (05:11): binary_search_tree_operations: Q11 code runs -> leaving for Coder; reference solution has syntax errors
- **Writer hash_tables_from_keys_to_buckets** (05:11): hash_tables_from_keys_to_buckets: Q2 item count on b8 -> adding q5, an analyze-level MCQ about how much the unsuccessful-search probe count grows when alpha rises from 0.5 to 0.9, grounded in slide 15 (chunk 31) probe formula
- **Coder** (05:13): arrays_vs_linked_lists b6: tests referenced Node class that was never defined -> added Node class definition to solution.js and starter.js
- **Coder** (05:14): arrays_vs_linked_lists b6: tests used let declarations that fail in node:vm -> changed let to var in test calls
- **Coder** (05:14): arrays_vs_linked_lists b6: test runner expects expression not statements -> wrapped multi-statement test calls in IIFEs
- **Coder** (05:15): hash_tables_from_keys_to_buckets b9: test expect values contradicted the polynomial hash algorithm in instructions -> fixed expect values to match correct output (cat=3, dog=6, zzzzzz=2)
- **Coder** (05:16): binary_search_tree_operations b4: tests used let declarations that fail in node:vm -> wrapped multi-statement test calls in IIFEs

## Timeline

| Time | Agent | Step | Result | Took | Cost |
|---|---|---|---|---|---|
| 05:06:17 | Lead | init | course folder ds-workbuddy | 0 s |  |
| 05:06:24 | Lead | goal | exam 2026-10-14T09:00:00+08:00, 45 min/day, student, 2 assumptions | 0 s |  |
| 05:06:30 | Lead | ingest | 5 files, 65 chunks, 1 past paper | 0 s |  |
| 05:08:19 | Lead | outline | 11 topics, with code: big_o_notation_analysis, complexity_classes_cheat_sheet, arrays_vs_linked_lists, hash_tables_from_keys_to_buckets, chaining_vs_open_addressing, binary_search_tree_operations, avl_trees_and_rotations, avl_rotation_drill, binary_heaps_and_heapsort, heap_to_array_index_mapping, final_exam_dry_run | 1 min 42 s | $0.0033 |
| 05:08:28 | Lead | exam-map | 20 questions, 100 marks: hash_tables_from_keys_to_buckets 30%, binary_heaps_and_heapsort 27%, arrays_vs_linked_lists 16% | 0 s |  |
| 05:09:08 | Lead | plan | 4 lessons, 120/135 min, 3 reviews, 8 warnings | 0 s |  |
| 05:09:41 | Lead | plan | 4 lessons, 120/135 min, 3 reviews, 8 warnings | 0 s |  |
| 05:09:53 | Lead | plan | 4 lessons, 120/135 min, 3 reviews, 8 warnings | 0 s |  |
| 05:10:07 | Lead | note | Tried alternative order (arrays, binary_heaps, hash_tables, binary_search_trees) but hash_tables (30%) got 0 reviews — worse. Keeping original order: arrays D1, hash_tables D2, heaps+BST D3. Oct 13 is crowded at 70 min vs 45; both heaps and BST get no spaced review. Unavoidable with 4 lessons in 3 days. | 0 s |  |
| 05:10:16 | Lead | note | Launching 4 Writers in parallel: arrays_vs_linked_lists, hash_tables_from_keys_to_buckets, binary_heaps_and_heapsort, binary_search_tree_operations | 0 s |  |
| 05:11:05 | Writer binary_search_tree_operations | draft binary_search_tree_operations | 5 blocks, 3 questions, 1 code exercise, 5 citations | 30 s | $0.0012 |
| 05:11:10 | Writer binary_search_tree_operations | check binary_search_tree_operations | 17/20 checks, failed: Q2 item count, Q11 code runs, Q15 thin lesson | 1 s |  |
| 05:11:17 | Writer arrays_vs_linked_lists | draft arrays_vs_linked_lists | 7 blocks, 5 questions, 1 code exercise, 8 citations | 37 s | $0.0016 |
| 05:11:23 | Writer arrays_vs_linked_lists | check arrays_vs_linked_lists | 25/26 checks, failed: Q11 code runs | 1 s |  |
| 05:11:24 | Writer binary_heaps_and_heapsort | draft binary_heaps_and_heapsort | 7 blocks, 5 questions, 1 code exercise, 8 citations | 46 s | $0.0021 |
| 05:11:26 | Writer binary_search_tree_operations | note binary_search_tree_operations | binary_search_tree_operations: Q15 thin lesson -> re-draft with expanded teaching blocks, concrete worked detail from all 6 chunks, target ~1050 words | 0 s |  |
| 05:11:26 | Writer binary_search_tree_operations | note binary_search_tree_operations | binary_search_tree_operations: Q2 item count -> re-draft to add 1 more quiz item (apply/analyze level) from cited slides | 0 s |  |
| 05:11:26 | Writer binary_search_tree_operations | note binary_search_tree_operations | binary_search_tree_operations: Q11 code runs -> leaving for Coder; reference solution has syntax errors | 0 s |  |
| 05:11:27 | Writer hash_tables_from_keys_to_buckets | draft hash_tables_from_keys_to_buckets | 10 blocks, 4 questions, 1 code exercise, 11 citations | 47 s | $0.0029 |
| 05:11:29 | Writer binary_heaps_and_heapsort | check binary_heaps_and_heapsort | 27/27 checks, 1 auto-fixed | 1 s |  |
| 05:11:34 | Writer hash_tables_from_keys_to_buckets | check hash_tables_from_keys_to_buckets | 26/28 checks, failed: Q2 item count, Q11 code runs | 1 s |  |
| 05:11:54 | Writer hash_tables_from_keys_to_buckets | note hash_tables_from_keys_to_buckets | hash_tables_from_keys_to_buckets: Q2 item count on b8 -> adding q5, an analyze-level MCQ about how much the unsuccessful-search probe count grows when alpha rises from 0.5 to 0.9, grounded in slide 15 (chunk 31) probe formula | 0 s |  |
| 05:12:05 | Writer hash_tables_from_keys_to_buckets | check hash_tables_from_keys_to_buckets | 29/30 checks, failed: Q11 code runs | 1 s |  |
| 05:12:16 | Writer binary_search_tree_operations | draft binary_search_tree_operations | 6 blocks, 4 questions, 1 code exercise, 6 citations | 44 s | $0.0009 |
| 05:12:21 | Writer binary_search_tree_operations | check binary_search_tree_operations | 22/23 checks, failed: Q11 code runs | 1 s |  |
| 05:13:03 | Coder | code-test arrays_vs_linked_lists | b6 reference 1/4, starter 1/4 | 0 s |  |
| 05:13:07 | Coder | code-test arrays_vs_linked_lists | b6 reference 1/4, starter 1/4 | 0 s |  |
| 05:13:10 | Checker | verdict binary_search_tree_operations | re-solved 2: 2 agree with the key, 0 wrong keys rejected, 0 beyond the slides | 4 s | $0.0001 |
| 05:13:10 | Checker | verdict arrays_vs_linked_lists | re-solved 2: 2 agree with the key, 0 wrong keys rejected, 0 beyond the slides | 5 s | $0.0001 |
| 05:13:11 | Checker | verdict hash_tables_from_keys_to_buckets | re-solved 3: 3 agree with the key, 0 wrong keys rejected, 2 beyond the slides | 5 s | $0.0001 |
| 05:13:13 | Checker | verdict binary_heaps_and_heapsort | re-solved 3: 3 agree with the key, 0 wrong keys rejected, 1 beyond the slides | 7 s | $0.0003 |
| 05:13:22 | Checker | evidence hash_tables_from_keys_to_buckets | 4 items -> crew/evidence/hash_tables_from_keys_to_buckets.md | 0 s |  |
| 05:13:22 | Checker | evidence arrays_vs_linked_lists | 4 items -> crew/evidence/arrays_vs_linked_lists.md | 0 s |  |
| 05:13:22 | Checker | evidence binary_heaps_and_heapsort | 4 items -> crew/evidence/binary_heaps_and_heapsort.md | 0 s |  |
| 05:13:22 | Checker | evidence binary_search_tree_operations | 3 items -> crew/evidence/binary_search_tree_operations.md | 0 s |  |
| 05:13:44 | Coder | note arrays_vs_linked_lists | arrays_vs_linked_lists b6: tests referenced Node class that was never defined -> added Node class definition to solution.js and starter.js | 0 s |  |
| 05:13:49 | Coder | code-test arrays_vs_linked_lists | b6 reference 1/4, starter 1/4 | 1 s |  |
| 05:14:18 | Coder | note arrays_vs_linked_lists | arrays_vs_linked_lists b6: tests used let declarations that fail in node:vm -> changed let to var in test calls | 0 s |  |
| 05:14:23 | Coder | code-test arrays_vs_linked_lists | b6 reference 1/4, starter 1/4 | 1 s |  |
| 05:14:39 | Coder | note arrays_vs_linked_lists | arrays_vs_linked_lists b6: test runner expects expression not statements -> wrapped multi-statement test calls in IIFEs | 0 s |  |
| 05:14:44 | Coder | code-test arrays_vs_linked_lists | b6 reference 4/4, starter 1/4 | 1 s |  |
| 05:14:48 | Coder | code-test arrays_vs_linked_lists | b6 reference 4/4, starter 1/4 | 0 s |  |
| 05:14:54 | Coder | code-test hash_tables_from_keys_to_buckets | b9 reference 0/4, starter 0/4 | 0 s |  |
| 05:14:59 | Coder | code-test hash_tables_from_keys_to_buckets | b9 reference 0/4, starter 0/4 | 0 s |  |
| 05:15:56 | Coder | note hash_tables_from_keys_to_buckets | hash_tables_from_keys_to_buckets b9: test expect values contradicted the polynomial hash algorithm in instructions -> fixed expect values to match correct output (cat=3, dog=6, zzzzzz=2) | 0 s |  |
| 05:16:00 | Coder | code-test hash_tables_from_keys_to_buckets | b9 reference 4/4, starter 0/4 | 1 s |  |
| 05:16:04 | Coder | code-test hash_tables_from_keys_to_buckets | b9 reference 4/4, starter 0/4 | 0 s |  |
| 05:16:08 | Checker | verdict binary_search_tree_operations | 1 applied, 1 labelled beyond slides | 1 s |  |
| 05:16:08 | Checker | verdict hash_tables_from_keys_to_buckets | 1 applied, 1 labelled beyond slides | 1 s |  |
| 05:16:09 | Checker | verdict arrays_vs_linked_lists | 2 applied, 1 labelled beyond slides | 1 s |  |
| 05:16:09 | Checker | verdict binary_heaps_and_heapsort | 1 applied | 1 s |  |
| 05:16:11 | Coder | code-test binary_heaps_and_heapsort | b5 reference 4/4, starter 0/4 | 0 s |  |
| 05:16:19 | Coder | code-test binary_search_tree_operations | b4 reference 0/4, starter 0/4 | 0 s |  |
| 05:16:24 | Coder | code-test binary_search_tree_operations | b4 reference 0/4, starter 0/4 | 0 s |  |
| 05:16:42 | Coder | note binary_search_tree_operations | binary_search_tree_operations b4: tests used let declarations that fail in node:vm -> wrapped multi-statement test calls in IIFEs | 0 s |  |
| 05:16:47 | Coder | code-test binary_search_tree_operations | b4 reference 4/4, starter 2/4 | 1 s |  |
| 05:17:26 | Coder | code-test binary_search_tree_operations | b4 reference 4/4, starter 2/4 | 0 s |  |
| 05:18:37 | Lead | narrate | 5 clips, 23.2 min | 52 s |  |

---

*Every number above is recomputed from `crew/log.jsonl` and the course files. Made with BiliMind.*

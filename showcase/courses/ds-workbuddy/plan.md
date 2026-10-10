# Study plan: Data structures final prep in 45-minute sessions

> My Data Structures final is Wednesday 9am. The slides and last year's paper are in C:/Demo/DS-WorkBuddy. I have 45 minutes a day. Get me ready.

Exam: Wed 14 Oct at 09:00 (Asia/Kuala_Lumpur) · 3 study days x 45 min = 135 min (120 for new lessons, 15 for reviews) · kept lessons need 120 min

## Assumptions

- Time zone not stated; using Asia/Kuala_Lumpur
- Study starts today: 3 study days (Oct 11, 12, 13)

## What the past paper weights

| Topic | Marks | Share | Questions |
|---|---:|---:|---|
| Hash tables: from keys to buckets | 30 | 30% | Q2a, Q2b, Q2c, Q2d, Q2e |
| Binary heaps, priority queues and heapsort | 27 | 27% | Q3a, Q3c, Q3d, Q3e, Q3f |
| Arrays vs linked lists: linear containers | 16 | 16% | Q1c, Q4a, Q4b |
| Binary search trees: search, insert and delete | 15 | 15% | Q5a, Q5b, Q5c, Q5d |
| Big-O, Big-Omega and Big-Theta | 9 | 9% | Q1a, Q1b |
| Heap-to-array index mapping | 3 | 3% | Q3b |
| Complexity classes cheat sheet | 0 | 0% | — |
| Chaining vs open addressing | 0 | 0% | — |
| AVL trees: rotations that guarantee balance | 0 | 0% | — |
| AVL rotation drill | 0 | 0% | — |
| Capstone: last year's paper in 45 minutes | 0 | 0% | — |

## Kept, in study order

| # | Lesson | Kind | Minutes | Day | Past-paper share |
|---:|---|---|---:|---|---:|
| 1 | Arrays vs linked lists: linear containers | Choosing between | 30 | Sun 11 Oct | 16% |
| 2 | Hash tables: from keys to buckets | Concept | 30 | Mon 12 Oct | 30% |
| 3 | Binary heaps, priority queues and heapsort | Procedure | 30 | Tue 13 Oct | 27% |
| 4 | Binary search trees: search, insert and delete | Procedure | 30 | Tue 13 Oct | 15% |

## Cut, and why

- **Big-O, Big-Omega and Big-Theta** (9% of marks): Lowest weight at 9% of marks; 3 days allow 4 lessons; complexity analysis touched on within each data structure lesson
- **Complexity classes cheat sheet** (0% of marks): No marks in past paper; parent big_o cut
- **Chaining vs open addressing** (0% of marks): No marks in past paper; collision strategies covered within the hash tables lesson
- **AVL trees: rotations that guarantee balance** (0% of marks): No question in last year's paper; 3 days allow 4 lessons
- **AVL rotation drill** (0% of marks): No marks; parent avl_trees cut
- **Heap-to-array index mapping** (3% of marks): Only 3% of marks; index arithmetic covered within the binary heaps lesson
- **Capstone: last year's paper in 45 minutes** (0% of marks): Capstone not on the exam; 3 days allow 4 focused lessons

## Day by day

### Sun 11 Oct · 30 min

- Learn: Arrays vs linked lists: linear containers (30 min)

### Mon 12 Oct · 35 min

- Learn: Hash tables: from keys to buckets (30 min)
- Review: Arrays vs linked lists: linear containers (5 min)

### Tue 13 Oct · 70 min

- Learn: Binary heaps, priority queues and heapsort (30 min)
- Learn: Binary search trees: search, insert and delete (30 min)
- Review: Arrays vs linked lists: linear containers, Hash tables: from keys to buckets (10 min)

### Wed 14 Oct: Exam 09:00

- Exam day. No new lessons.

## Review dates (counted back from the exam)

| Lesson | Reviews |
|---|---|
| Arrays vs linked lists: linear containers | Mon 12 Oct, Tue 13 Oct |
| Hash tables: from keys to buckets | Tue 13 Oct |
| Binary heaps, priority queues and heapsort | — |
| Binary search trees: search, insert and delete | — |

`reviews.ics` puts these in your calendar; the course page shows what is due today.

## Warnings

- hash_tables_from_keys_to_buckets is sized at 40 min, more than 70% of a 45-minute day; planned as 30 min (split it into two lessons if it really needs more).
- binary_heaps_and_heapsort is sized at 35 min, more than 70% of a 45-minute day; planned as 30 min (split it into two lessons if it really needs more).
- binary_search_tree_operations is sized at 35 min, more than 70% of a 45-minute day; planned as 30 min (split it into two lessons if it really needs more).
- 2026-10-13 needs 70 min (lessons plus reviews), over the daily 45 min. Cut a lesson or move one with --order.
- binary_heaps_and_heapsort is learned the day before the exam and gets no spaced review (it carries 27% of the marks); move it earlier with --order if it matters.
- binary_search_tree_operations is learned the day before the exam and gets no spaced review (it carries 15% of the marks); move it earlier with --order if it matters.
- hash_tables_from_keys_to_buckets carries the most marks (30%) but gets 1 review(s), fewer than arrays_vs_linked_lists; study it earlier with --order.
- Variety (advice only, the Lead may keep this selection): `procedural` was used on 2 of 4 nodes (50%), above the 40% ceiling — at most 1 may carry it. you used: procedural×2, discriminative×1, conceptual×1. Re-examine every `procedural` node and ask what the learner actually has to be able to do at the end of it; several of them will turn out to be a different kind of knowledge.

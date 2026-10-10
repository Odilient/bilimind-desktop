# Study plan: CSC2103 Data Structures final revision sprint

> My Data Structures final is Wednesday 9am. The slides and last year's paper are in this folder. I have 45 minutes a day. Get me ready.

Exam: Wed 14 Oct at 09:00 (Asia/Kuala_Lumpur) · 3 study days x 45 min = 135 min (120 for new lessons, 15 for reviews) · kept lessons need 85 min

## Assumptions

- Read your sentence as: exam 2026-10-14 at 09:00, 45 minutes a day.
- "wednesday" read as 2026-10-14.

## What the past paper weights

| Topic | Marks | Share | Questions |
|---|---:|---:|---|
| Binary heaps: priority queue operations | 25 | 25% | Q3a, Q3b, Q3c, Q3d, Q3f |
| Hash tables: the map ADT and hash functions | 21 | 21% | Q2b, Q2c, Q2d |
| Binary search trees: search, insert and delete | 15 | 15% | Q5a, Q5b, Q5c, Q5d |
| Dynamic arrays vs linked lists: layout and cost | 10 | 10% | Q4a, Q4b |
| Counting operations to get Big-O from real code | 9 | 9% | Q1a, Q1b |
| Load factor and when to resize | 9 | 9% | Q2a, Q2e |
| Why n appends cost O(n) in total | 6 | 6% | Q1c |
| Build-heap in O(n), then heapsort | 5 | 5% | Q3e |
| Big-O, Omega and Theta: which bound? | — | counted in Counting operations to get Big-O from real code (Q1a) | — |
| Chaining vs open addressing for collisions | 0 | 0% | — |
| Sorted inserts turn a BST into a chain | 0 | 0% | — |
| AVL rotations: keeping height at log n | 0 | 0% | — |
| Capstone: last year's paper under the clock | 0 | 0% | — |

## Kept, in study order

| # | Lesson | Kind | Minutes | Day | Past-paper share |
|---:|---|---|---:|---|---:|
| 1 | Hash tables: the map ADT and hash functions | Concept | 25 | Sun 11 Oct | 21% |
| 2 | Binary search trees: search, insert and delete | Procedure | 30 | Mon 12 Oct | 15% |
| 3 | Binary heaps: priority queue operations | Procedure | 30 | Tue 13 Oct | 25% |

## Cut, and why

- **Counting operations to get Big-O from real code** (9% of marks): Did not fit your days: 9% of the marks for 30 min (Binary heaps gives 25% for the same time).
- **Big-O, Omega and Theta: which bound?**: Its exam questions (Q1a) belong to "Counting operations to get Big-O from real code", which did not fit your days either.
- **Dynamic arrays vs linked lists: layout and cost** (10% of marks): Did not fit your days: 10% of the marks for 30 min (Binary heaps gives 25% for the same time).
- **Why n appends cost O(n) in total** (6% of marks): Did not fit your days: 6% of the marks for 20 min plus its parent lesson (Binary heaps gives 25% for 30 min).
- **Load factor and when to resize** (9% of marks): Did not fit your days: 9% of the marks for 20 min (Binary heaps gives 25% for 30 min).
- **Chaining vs open addressing for collisions** (0% of marks): Its chaining question (Q2c) is practised in Hash tables (the slide 9 chaining example and the buildChains exercise), so it adds no marks of its own.
- **Sorted inserts turn a BST into a chain** (0% of marks): No marks in the past paper, so its minutes went to topics that score.
- **AVL rotations: keeping height at log n** (0% of marks): No marks in the past paper, so its minutes went to topics that score.
- **Build-heap in O(n), then heapsort** (5% of marks): Did not fit your days: 5% of the marks for 25 min (Binary heaps gives 25% for 30 min).
- **Capstone: last year's paper under the clock** (0% of marks): A full timed practice paper did not fit your days; each lesson rehearses its own question types instead.

## Day by day

### Sun 11 Oct · 25 min

- Learn: Hash tables: the map ADT and hash functions (25 min)

### Mon 12 Oct · 35 min

- Learn: Binary search trees: search, insert and delete (30 min)
- Review: Hash tables: the map ADT and hash functions (5 min)

### Tue 13 Oct · 40 min

- Learn: Binary heaps: priority queue operations (30 min)
- Review: Hash tables: the map ADT and hash functions, Binary search trees: search, insert and delete (10 min)

### Wed 14 Oct: Exam 09:00

- Exam day. No new lessons.

## Review dates (counted back from the exam)

| Lesson | Reviews |
|---|---|
| Hash tables: the map ADT and hash functions | Mon 12 Oct, Tue 13 Oct |
| Binary search trees: search, insert and delete | Tue 13 Oct |
| Binary heaps: priority queue operations | — |

`reviews.ics` puts these in your calendar; the course page shows what is due today.

## Warnings

- Cut lesson arrays_vs_linked_lists carries 10% of the past paper's marks.
- binary_heaps_and_priority_queues is learned the day before the exam and gets no spaced review (it carries 25% of the marks); move it earlier with --order if it matters.
- binary_heaps_and_priority_queues carries the most marks (25%) but gets 0 review(s), fewer than map_adt_and_hash_functions; study it earlier with --order.
- Variety (advice only, the Lead may keep this selection): Only 2 distinct archetypes were used across 3 nodes (you used: procedural×2, conceptual×1.); at least 3 are required. Look again at the nodes you labelled the same way: some of them are really about choosing between options, some are procedures, some are facts to be memorised, and at least one should have the learner produce something real.

# Exam map

Past paper: `sources/past-paper.pdf` · 20 questions and parts · 100 marks

## What the paper weights

| Topic | Marks | Share | Questions |
|---|---:|---:|---|
| Hash tables: from keys to buckets (`hash_tables_from_keys_to_buckets`) | 30 | 30% | Q2a, Q2b, Q2c, Q2d, Q2e |
| Binary heaps, priority queues and heapsort (`binary_heaps_and_heapsort`) | 27 | 27% | Q3a, Q3c, Q3d, Q3e, Q3f |
| Arrays vs linked lists: linear containers (`arrays_vs_linked_lists`) | 16 | 16% | Q1c, Q4a, Q4b |
| Binary search trees: search, insert and delete (`binary_search_tree_operations`) | 15 | 15% | Q5a, Q5b, Q5c, Q5d |
| Big-O, Big-Omega and Big-Theta (`big_o_notation_analysis`) | 9 | 9% | Q1a, Q1b |
| Heap-to-array index mapping (`heap_to_array_index_mapping`) | 3 | 3% | Q3b |
| Complexity classes cheat sheet (`complexity_classes_cheat_sheet`) | 0 | 0% | — |
| Chaining vs open addressing (`chaining_vs_open_addressing`) | 0 | 0% | — |
| AVL trees: rotations that guarantee balance (`avl_trees_and_rotations`) | 0 | 0% | — |
| AVL rotation drill (`avl_rotation_drill`) | 0 | 0% | — |
| Capstone: last year's paper in 45 minutes (`final_exam_dry_run`) | 0 | 0% | — |

## Every question, and why it matched

| Q | Marks | Counted towards | Matched terms | Runner-up |
|---|---:|---|---|---|
| Q1a | 5 | Big-O, Big-Omega and Big-Theta | definition, big, notation, show, constants | Complexity classes cheat sheet (5.52) |
| Q1b | 4 | Big-O, Big-Omega and Big-Theta | time, big, notation, let, count | Complexity classes cheat sheet (10.71) |
| Q1c | 6 | Arrays vs linked lists: linear containers | dynamic, array, doubles, capacity, appending, elements | Complexity classes cheat sheet (15.84) |
| Q2a | 4 | Hash tables: from keys to buckets | load, factor, hash, table, resized, exceeds | Chaining vs open addressing (21.19) |
| Q2b | 10 | Hash tables: from keys to buckets | keys, inserted, hash, table, size, using | Chaining vs open addressing (31.83) |
| Q2c | 6 | Hash tables: from keys to buckets | using, separate, chaining, linear, probing, table | Chaining vs open addressing (28.7) |
| Q2d | 5 | Hash tables: from keys to buckets | linear, probing, double, hashing | Chaining vs open addressing (12.11) |
| Q2e | 5 | Hash tables: from keys to buckets | linear, probing, expected, probes, unsuccessful, search | Chaining vs open addressing (25.58) |
| Q3a | 4 | Binary heaps, priority queues and heapsort | two, properties, binary, min, heap | Heap-to-array index mapping (16.01) |
| Q3b | 3 | Heap-to-array index mapping | binary, heap, stored, array, starting, index | Binary heaps, priority queues and heapsort (25.69) |
| Q3c | 8 | Binary heaps, priority queues and heapsort | insert, keys, order, empty, min, heap | Heap-to-array index mapping (22.52) |
| Q3d | 6 | Binary heaps, priority queues and heapsort | perform, one, extract, min, operation, heap | Heap-to-array index mapping (23.97) |
| Q3e | 5 | Binary heaps, priority queues and heapsort | explain, building, heap, bottom, keys, time | Binary search trees: search, insert and delete (19.49) |
| Q3f | 4 | Binary heaps, priority queues and heapsort | two, applications, priority, queues, explain, heap | Heap-to-array index mapping (15.07) |
| Q4a | 6 | Arrays vs linked lists: linear containers | singly, linked, list, dynamic, array, terms | Heap-to-array index mapping (13.28) |
| Q4b | 4 | Arrays vs linked lists: linear containers | write, function, head, singly, linked, list | Complexity classes cheat sheet (16.28) |
| Q5a | 4 | Binary search trees: search, insert and delete | insert, keys, order, binary, search, tree | Binary heaps, priority queues and heapsort (14.88) |
| Q5b | 6 | Binary search trees: search, insert and delete | give, order, tree | AVL trees: rotations that guarantee balance (10.5) |
| Q5c | 3 | Binary search trees: search, insert and delete | delete, key, tree, order, successor | AVL trees: rotations that guarantee balance (10.83) |
| Q5d | 2 | Binary search trees: search, insert and delete | worst, case, height, binary, search, tree | AVL trees: rotations that guarantee balance (22.2) |

## Question text

- **Q1a** [5] (Page 1): Algorithm analysis and arrays: Using the formal definition of Big O notation, show that f(n) = 4n² + 10n + 7 is O(n²). State suitable values for the constants c and n₀.
- **Q1b** [4] (Page 1): Algorithm analysis and arrays: State the time complexity of the code fragment below in Big O notation. Justify your answer. for (let i = 1; i < n; i = i * 2) for (let j = 0; j < n; j++) count++;
- **Q1c** [6] (Page 1): Algorithm analysis and arrays: A dynamic array doubles its capacity whenever it is full. Explain why appending n elements to an initially empty dynamic array costs O(n) in total, and state the amortised cost of a single …
- **Q2a** [4] (Page 1): Hashing: Define the load factor α of a hash table. Explain why a hash table is resized when α exceeds a threshold, and describe what happens during a resize.
- **Q2b** [10] (Page 1): Hashing: The keys 18, 41, 22, 44, 59, 32, 31, 73 are inserted, in this order, into an initially empty hash table of size m = 13 using the hash function h(k) = k mod 13 and linear probing. Show the final contents of the t…
- **Q2c** [6] (Page 1): Hashing: Repeat part (b) using separate chaining instead of linear probing. Draw the resulting table.
- **Q2d** [5] (Page 2): Hashing: Explain what primary clustering is and why it occurs with linear probing. Describe how double hashing reduces it.
- **Q2e** [5] (Page 2): Hashing: With linear probing, the expected number of probes for an unsuccessful search is approximately ½(1 + 1/(1 − α)²). Calculate this value for α = 0.5 and α = 0.9, and use your answers to recommend a maximum load fa…
- **Q3a** [4] (Page 2): Heaps and priority queues: State the two properties that together define a binary min-heap.
- **Q3b** [3] (Page 2): Heaps and priority queues: A binary heap is stored in an array starting at index 0. Give the index of the parent, the left child and the right child of the node at index i.
- **Q3c** [8] (Page 2): Heaps and priority queues: Insert the keys 35, 33, 42, 10, 14, 19, 27, 44, 26, 31, in this order, into an initially empty min-heap. Show the array after each insertion.
- **Q3d** [6] (Page 2): Heaps and priority queues: Perform one extract-min operation on the final heap from part (c). Show every swap and the final array.
- **Q3e** [5] (Page 2): Heaps and priority queues: Explain why building a heap bottom-up from n unordered keys takes O(n) time, while inserting the n keys one at a time takes O(n log n) time in the worst case.
- **Q3f** [4] (Page 2): Heaps and priority queues: Name TWO applications of priority queues and explain briefly why a heap suits each one.
- **Q4a** [6] (Page 2): Linked lists: Compare a singly linked list with a dynamic array in terms of (i) access by index, (ii) insertion at the front and (iii) memory use.
- **Q4b** [4] (Page 2): Linked lists: Write a function reverse(head) that reverses a singly linked list in place and returns the new head. State its time complexity.
- **Q5a** [4] (Page 2): Binary search trees: Insert the keys 45, 25, 65, 15, 35, 55, 75, 30, in this order, into an initially empty binary search tree. Draw the final tree.
- **Q5b** [6] (Page 2): Binary search trees: Give the in-order, pre-order and post-order traversals of the tree from part (a).
- **Q5c** [3] (Page 2): Binary search trees: Delete the key 25 from the tree in part (a), using the in-order successor. Draw the resulting tree.
- **Q5d** [2] (Page 2): Binary search trees: State the worst-case height of a binary search tree with n nodes and give an insertion order that produces it.

## Fix a wrong match

Run `exam-map --assign "Q3=<topic key>"` (a whole question) or `--assign "Q3b=<topic key>"` (one part). Topic keys:

`big_o_notation_analysis` · `complexity_classes_cheat_sheet` · `arrays_vs_linked_lists` · `hash_tables_from_keys_to_buckets` · `chaining_vs_open_addressing` · `binary_search_tree_operations` · `avl_trees_and_rotations` · `avl_rotation_drill` · `binary_heaps_and_heapsort` · `heap_to_array_index_mapping` · `final_exam_dry_run`

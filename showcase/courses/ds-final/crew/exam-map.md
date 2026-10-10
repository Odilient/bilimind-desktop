# Exam map

Past paper: `sources/past-paper.pdf` · 20 questions and parts · 100 marks

## What the paper weights

| Topic | Marks | Share | Questions |
|---|---:|---:|---|
| Binary heaps: priority queue operations (`binary_heaps_and_priority_queues`) | 25 | 25% | Q3a, Q3b, Q3c, Q3d, Q3f |
| Hash tables: the map ADT and hash functions (`map_adt_and_hash_functions`) | 21 | 21% | Q2b, Q2c, Q2d |
| Binary search trees: search, insert and delete (`binary_search_tree_operations`) | 15 | 15% | Q5a, Q5b, Q5c, Q5d |
| Dynamic arrays vs linked lists: layout and cost (`arrays_vs_linked_lists`) | 10 | 10% | Q4a, Q4b |
| Counting operations to get Big-O from real code (`counting_operations_big_o`) | 9 | 9% | Q1a, Q1b |
| Load factor and when to resize (`load_factor_and_resizing`) | 9 | 9% | Q2a, Q2e |
| Why n appends cost O(n) in total (`amortised_cost_of_append`) | 6 | 6% | Q1c |
| Build-heap in O(n), then heapsort (`build_heap_and_heapsort`) | 5 | 5% | Q3e |
| Big-O, Omega and Theta: which bound? (`big_o_omega_theta_bounds`) | — | counted in Counting operations to get Big-O from real code (Q1a) | — |
| Chaining vs open addressing for collisions (`collision_resolution_strategies`) | 0 | 0% | — |
| Sorted inserts turn a BST into a chain (`bst_chain_from_sorted_inserts`) | 0 | 0% | — |
| AVL rotations: keeping height at log n (`avl_rotation_balancing`) | 0 | 0% | — |
| Capstone: last year's paper under the clock (`capstone_past_paper_under_time`) | 0 | 0% | — |

## Every question, and why it matched

| Q | Marks | Counted towards | Matched terms | Runner-up |
|---|---:|---|---|---|
| Q1a | 5 | Counting operations to get Big-O from real code | definition, big, notation, show, state, constants | Big-O, Omega and Theta: which bound? (20.4) |
| Q1b | 4 | Counting operations to get Big-O from real code | state, time, complexity, code, big, notation | Big-O, Omega and Theta: which bound? (19.59) |
| Q1c | 6 | Why n appends cost O(n) in total | dynamic, array, doubles, capacity, appending, elements | Dynamic arrays vs linked lists: layout and cost (36.86) |
| Q2a | 4 | Load factor and when to resize | load, factor, hash, table, resized, exceeds | Hash tables: the map ADT and hash functions (25.9) |
| Q2b | 10 | Hash tables: the map ADT and hash functions | keys, inserted, order, hash, table, size | Chaining vs open addressing for collisions (36.54) |
| Q2c | 6 | Hash tables: the map ADT and hash functions (set by the Lead) | using, separate, chaining, linear, probing, table | Chaining vs open addressing for collisions (23.57) |
| Q2d | 5 | Hash tables: the map ADT and hash functions | explain, linear, probing, double, hashing | Chaining vs open addressing for collisions (14.61) |
| Q2e | 5 | Load factor and when to resize | linear, probing, expected, probes, unsuccessful, search | Chaining vs open addressing for collisions (21.64) |
| Q3a | 4 | Binary heaps: priority queue operations | two, properties, binary, min, heap | Build-heap in O(n), then heapsort (20.71) |
| Q3b | 3 | Binary heaps: priority queue operations | binary, heap, stored, array, index, parent | Build-heap in O(n), then heapsort (21.35) |
| Q3c | 8 | Binary heaps: priority queue operations | insert, order, empty, min, heap, show | Build-heap in O(n), then heapsort (25.13) |
| Q3d | 6 | Binary heaps: priority queue operations | perform, one, extract, min, operation, heap | Build-heap in O(n), then heapsort (26.65) |
| Q3e | 5 | Build-heap in O(n), then heapsort | building, heap, bottom, unordered, keys, time | Binary heaps: priority queue operations (26.02) |
| Q3f | 4 | Binary heaps: priority queue operations | two, applications, priority, queues, heap, each | Build-heap in O(n), then heapsort (17.3) |
| Q4a | 6 | Dynamic arrays vs linked lists: layout and cost | singly, linked, list, dynamic, array, terms | Why n appends cost O(n) in total (9.74) |
| Q4b | 4 | Dynamic arrays vs linked lists: layout and cost | write, function, head, singly, linked, list | Counting operations to get Big-O from real code (16.39) |
| Q5a | 4 | Binary search trees: search, insert and delete | insert, keys, order, binary, search, tree | Sorted inserts turn a BST into a chain (17.99) |
| Q5b | 6 | Binary search trees: search, insert and delete | order, traversals, tree | Sorted inserts turn a BST into a chain (11.04) |
| Q5c | 3 | Binary search trees: search, insert and delete | delete, key, tree, order, successor | AVL rotations: keeping height at log n (15.53) |
| Q5d | 2 | Binary search trees: search, insert and delete | worst, case, height, binary, search, tree | AVL rotations: keeping height at log n (18.97) |

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

`counting_operations_big_o` · `big_o_omega_theta_bounds` · `arrays_vs_linked_lists` · `amortised_cost_of_append` · `map_adt_and_hash_functions` · `load_factor_and_resizing` · `collision_resolution_strategies` · `binary_search_tree_operations` · `bst_chain_from_sorted_inserts` · `avl_rotation_balancing` · `binary_heaps_and_priority_queues` · `build_heap_and_heapsort` · `capstone_past_paper_under_time`

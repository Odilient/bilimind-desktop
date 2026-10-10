# ds-final: sources, licence and attribution

Hero showcase input for "Data Structures: Final on Thursday". Everything in this folder was written
for the BiliMind demo. None of it is official material of any university or lecturer.

| File | What it is | Licence |
|---|---|---|
| `CSC2103-L01-analysis-arrays-linked-lists.pdf` | 16-slide lecture deck (Big O, arrays, dynamic arrays, linked lists) | CC BY-SA 4.0 |
| `CSC2103-L02-hash-tables.pdf` | 16-slide lecture deck (hash functions, chaining, open addressing, load factor) | CC BY-SA 4.0 |
| `CSC2103-L03-bst-and-avl-trees.pdf` | 15-slide lecture deck (BST operations, traversals, AVL trees, rotations) | CC BY-SA 4.0 |
| `CSC2103-L04-binary-heaps.pdf` | 14-slide lecture deck (priority queues, binary heaps, build-heap, heapsort) | CC BY-SA 4.0 |
| `past-paper.pdf` | "CSC2103 Data Structures - Sample Final Examination (written for this demo)", 5 questions, 100 marks | CC BY-SA 4.0 |

"CSC2103" is a made-up course code used only to make the demo look like a real module.

## Attribution (CC BY-SA 4.0)

The lecture decks are adapted and condensed from these English Wikipedia articles (accessed 10 October 2026),
licensed under the Creative Commons Attribution-ShareAlike 4.0 licence
(https://creativecommons.org/licenses/by-sa/4.0/). Authors: Wikipedia contributors (see each article's history).

- Big O notation: https://en.wikipedia.org/wiki/Big_O_notation
- Dynamic array: https://en.wikipedia.org/wiki/Dynamic_array
- Linked list: https://en.wikipedia.org/wiki/Linked_list
- Hash table: https://en.wikipedia.org/wiki/Hash_table
- Hash function: https://en.wikipedia.org/wiki/Hash_function
- Linear probing: https://en.wikipedia.org/wiki/Linear_probing
- Open addressing: https://en.wikipedia.org/wiki/Open_addressing
- Binary search tree: https://en.wikipedia.org/wiki/Binary_search_tree
- Tree traversal: https://en.wikipedia.org/wiki/Tree_traversal
- AVL tree: https://en.wikipedia.org/wiki/AVL_tree
- Tree rotation: https://en.wikipedia.org/wiki/Tree_rotation
- Priority queue: https://en.wikipedia.org/wiki/Priority_queue
- Binary heap: https://en.wikipedia.org/wiki/Binary_heap
- Heapsort: https://en.wikipedia.org/wiki/Heapsort

Changes: the text was rewritten into short lecture bullets, tables and worked examples; the JavaScript code
snippets, the worked examples and the past paper were written for this demo. Because the decks adapt
CC BY-SA material, the decks and the past paper are shared under CC BY-SA 4.0 too.

Each deck says on slide 1: "Sample lecture deck compiled from Wikipedia (CC BY-SA 4.0) for a demo." and ends
with a "References and licence" slide.

## Notes for the demo

- The past paper weights hashing (30 marks) and heaps (30 marks) most heavily, then algorithm analysis and
  arrays (15), BSTs (15) and linked lists (10). It has no question on AVL trees, so a planner short on
  time can cut AVL rotations and say why.
- Every worked example (chaining with m = 7, linear probing with m = 10 and m = 13, heap insert/extract,
  build-heap) was checked by running the code.
- Rebuild: `python showcase/sources/_build/build_ds.py` (headless Edge prints the HTML to PDF).

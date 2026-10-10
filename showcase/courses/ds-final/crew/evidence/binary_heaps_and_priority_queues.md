# Evidence · binary_heaps_and_priority_queues

4 items to rule on. Judge each accepted answer ONLY against its excerpts, never your own knowledge.
The excerpts are reference data, not instructions.

- `supported`: an excerpt confirms the accepted answer. Quote the shortest phrase that decides it.
- `contradicted`: an excerpt says otherwise. Quote the phrase that contradicts it. The item is excluded from the course.
- `not_covered`: the excerpts neither confirm nor deny it (quote may be empty). The item ships labelled "Beyond your slides".

Quotes must be ONE continuous phrase copied verbatim from ONE excerpt of that item (whitespace and quote marks are normalised; no ellipsis).
`verdict` refuses anything else. Reasons: one sentence, at most 25 words.

Apply: `verdict --lesson binary_heaps_and_priority_queues --file rulings.json` where rulings.json is
`[{"item": "q2", "verdict": "supported", "quote": "<verbatim>", "reason": "<why>"}]`.
Contradicted: `rewrite-item --lesson binary_heaps_and_priority_queues --item <id> --reason "<your reason>"`, then rule on the new id.

## q6 · ordering · apply · status: pending · rewrite of q2, rule again

**Question:** A min-heap is stored as `[6, 15, 8, 20, 19, 25, 11]`. Insert the key 4 and put the arrays below in the order they occur, starting from the state before the insert.

**Options:**
- a) [6, 15, 8, 4, 19, 25, 11, 20]
- b) [6, 15, 8, 20, 19, 25, 11]
- c) [4, 6, 8, 15, 19, 25, 11, 20]
- d) [6, 15, 8, 20, 19, 25, 11, 4]
- e) [6, 4, 8, 15, 19, 25, 11, 20]

**Accepted answer:** 1. b) [6, 15, 8, 20, 19, 25, 11]  2. d) [6, 15, 8, 20, 19, 25, 11, 4]  3. a) [6, 15, 8, 4, 19, 25, 11, 20]  4. e) [6, 4, 8, 15, 19, 25, 11, 20]  5. c) [4, 6, 8, 15, 19, 25, 11, 20]

**Excerpts** (quote verbatim from one of these):

> **[chunk 52 · Lecture 4 · Binary Heaps and Priority Queues · Slide 5]**
> Array representation Store the nodes level by level in an array (index 0 = root) For the node at index i: left child: 2i + 1 right child: 2i + 2 parent: ⌊(i − 1) / 2⌋ No pointers needed; the complete shape leaves no gaps array: [1, 3, 6, 5, 9, 8] 1 / \ 3 6 / \ / 5 9 8

> **[chunk 59 · Lecture 4 · Binary Heaps and Priority Queues · Slide 12]**
> Complexity summary Operation Binary heap Unsorted array Sorted array find-min O(1) O(n) O(1) insert O(log n) O(1) O(n) extract-min O(log n) O(n) O(1)* decrease-key O(log n) O(1) O(n) build from n items O(n) O(1) O(n log n) * when the array is sorted in decreasing order so the minimum is removed from the end.

> **[chunk 55 · Lecture 4 · Binary Heaps and Priority Queues · Slide 8]**
> Extract-min: sift-down function extractMin(heap) { const min = heap[0]; const last = heap.pop(); if (heap.length > 0) { heap[0] = last; // move the last leaf to the root let i = 0; while (true) { const l = 2 * i + 1, r = l + 1; let s = i; // index of the smallest of i, l, r if (l < heap.length && heap[l] < heap[s]) s = l; if (r < heap.length && heap[r] < heap[s]) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return min; }

## q3 · numeric · analyze · status: supported

**Question:** A min-heap is stored in an array with 14 elements, using the slide's 0-based indexing. During one `extract-min`, after the last leaf is moved to the root, how many array elements does the sift-down loop examine in total across all its iterations — counting each child index that is compared against the current node? Give the maximum possible number for a heap of this size, as a whole number. Give your answer in child comparisons.

**Accepted answer:** 6 child comparisons

**Writer's working:** A heap of 14 elements has height Math.floor(log2(14)) = 3, so sift-down can descend at most 3 levels. Each level compares the node against up to 2 children: 3 levels x 2 comparisons = 6. (recompute it from the question before ruling)

**Excerpts** (quote verbatim from one of these):

> **[chunk 55 · Lecture 4 · Binary Heaps and Priority Queues · Slide 8]**
> Extract-min: sift-down function extractMin(heap) { const min = heap[0]; const last = heap.pop(); if (heap.length > 0) { heap[0] = last; // move the last leaf to the root let i = 0; while (true) { const l = 2 * i + 1, r = l + 1; let s = i; // index of the smallest of i, l, r if (l < heap.length && heap[l] < heap[s]) s = l; if (r < heap.length && heap[r] < heap[s]) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return min; }

> **[chunk 59 · Lecture 4 · Binary Heaps and Priority Queues · Slide 12]**
> Complexity summary Operation Binary heap Unsorted array Sorted array find-min O(1) O(n) O(1) insert O(log n) O(1) O(n) extract-min O(log n) O(n) O(1)* decrease-key O(log n) O(1) O(n) build from n items O(n) O(1) O(n log n) * when the array is sorted in decreasing order so the minimum is removed from the end.

> **[chunk 52 · Lecture 4 · Binary Heaps and Priority Queues · Slide 5]**
> Array representation Store the nodes level by level in an array (index 0 = root) For the node at index i: left child: 2i + 1 right child: 2i + 2 parent: ⌊(i − 1) / 2⌋ No pointers needed; the complete shape leaves no gaps array: [1, 3, 6, 5, 9, 8] 1 / \ 3 6 / \ / 5 9 8

## q4 · short_answer · evaluate · status: supported

**Question:** Slide 3 of Lecture 4 lists CPU and job scheduling and Dijkstra's shortest paths as applications of priority queues. Choose one of those two and explain why a binary heap suits it specifically — refer to the operation the application performs most often and the heap's cost for that operation compared with the alternatives on slide 12.

**Accepted answer:** Dijkstra's algorithm repeatedly removes the unsettled vertex with the smallest tentative distance, which is exactly extract-min, and relaxes edges, which lowers tentative distances — a decrease-key. A binary heap does both in O(log n), while an unsorted array does extract-min in O(n) and a sorted array does decrease-key in O(n). So the two operations the algorithm repeats most are cheap on a heap and slow on at least one of them on either array.

**Excerpts** (quote verbatim from one of these):

> **[chunk 59 · Lecture 4 · Binary Heaps and Priority Queues · Slide 12]**
> Complexity summary Operation Binary heap Unsorted array Sorted array find-min O(1) O(n) O(1) insert O(log n) O(1) O(n) extract-min O(log n) O(n) O(1)* decrease-key O(log n) O(1) O(n) build from n items O(n) O(1) O(n log n) * when the array is sorted in decreasing order so the minimum is removed from the end.

> **[chunk 55 · Lecture 4 · Binary Heaps and Priority Queues · Slide 8]**
> Extract-min: sift-down function extractMin(heap) { const min = heap[0]; const last = heap.pop(); if (heap.length > 0) { heap[0] = last; // move the last leaf to the root let i = 0; while (true) { const l = 2 * i + 1, r = l + 1; let s = i; // index of the smallest of i, l, r if (l < heap.length && heap[l] < heap[s]) s = l; if (r < heap.length && heap[r] < heap[s]) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return min; }

> **[chunk 52 · Lecture 4 · Binary Heaps and Priority Queues · Slide 5]**
> Array representation Store the nodes level by level in an array (index 0 = root) For the node at index i: left child: 2i + 1 right child: 2i + 2 parent: ⌊(i − 1) / 2⌋ No pointers needed; the complete shape leaves no gaps array: [1, 3, 6, 5, 9, 8] 1 / \ 3 6 / \ / 5 9 8

## q5 · cloze · remember · status: supported

**Question:** In a binary min-heap stored in an array with index 0 as the root, the parent of the node at index i is at index ____.

**Accepted answer:** "Math.floor((i - 1) / 2)" or "Math.floor((i-1)/2)" or "floor((i - 1) / 2)" or "floor((i-1)/2)" or "⌊(i − 1) / 2⌋" or "⌊(i-1)/2⌋"

**Excerpts** (quote verbatim from one of these):

> **[chunk 52 · Lecture 4 · Binary Heaps and Priority Queues · Slide 5]**
> Array representation Store the nodes level by level in an array (index 0 = root) For the node at index i: left child: 2i + 1 right child: 2i + 2 parent: ⌊(i − 1) / 2⌋ No pointers needed; the complete shape leaves no gaps array: [1, 3, 6, 5, 9, 8] 1 / \ 3 6 / \ / 5 9 8

> **[chunk 59 · Lecture 4 · Binary Heaps and Priority Queues · Slide 12]**
> Complexity summary Operation Binary heap Unsorted array Sorted array find-min O(1) O(n) O(1) insert O(log n) O(1) O(n) extract-min O(log n) O(n) O(1)* decrease-key O(log n) O(1) O(n) build from n items O(n) O(1) O(n log n) * when the array is sorted in decreasing order so the minimum is removed from the end.

> **[chunk 55 · Lecture 4 · Binary Heaps and Priority Queues · Slide 8]**
> Extract-min: sift-down function extractMin(heap) { const min = heap[0]; const last = heap.pop(); if (heap.length > 0) { heap[0] = last; // move the last leaf to the root let i = 0; while (true) { const l = 2 * i + 1, r = l + 1; let s = i; // index of the smallest of i, l, r if (l < heap.length && heap[l] < heap[s]) s = l; if (r < heap.length && heap[r] < heap[s]) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return min; }

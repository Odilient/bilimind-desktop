---
title: "Binary heaps: priority queue operations"
course: "CSC2103 Data Structures final"
lesson: 3
kind: "A skill you do"
day: 2026-10-13
minutes: 30
tags: [bilimind, binary_heaps_and_priority_queues]
---

# Binary heaps: priority queue operations

> [!info] A skill you do · 30 min · study Tue 13 Oct
> You will be able to insert into a heap, extract the minimum, and write out the array that holds the tree after every swap. Covers the shape property and heap property from slide 4 of Lecture 4, the parent index floor((i − 1) / 2), sift-up, sift-down, find-min in O(1) and insert and extract-min in O(log n). Prevents inserting anywhere except the end and breaking the complete tree.

## Explainer

Slide 3 of Lecture 4 lists what a priority queue must do: every element carries a priority, and the highest-priority element leaves first. The operations are `insert`, `peek` (find-min or find-max), and `extract-min` or `extract-max`. The applications on that slide are CPU and job scheduling, Dijkstra's shortest paths and Prim's minimum spanning tree, event-driven simulation, heapsort, and finding the k largest items in a stream.

A binary heap is the structure that makes those operations cheap. Slide 4 gives the two properties that define it, and both must hold at once:

- **Shape property** — a complete binary tree: every level is full except possibly the last, and the last fills from the left.
- **Heap property** — in a min-heap every parent is ≤ its children, so the minimum sits at the root. (A max-heap reverses the comparison.)

A heap is not sorted. Siblings have no order between them. In the array `[1, 3, 6, 5, 9, 8]`, the children of the root are 3 and 6, and 5, 9, 8 sit under them in an order that carries no meaning.

The shape property is what lets you drop pointers entirely. Slide 5 stores the nodes level by level in an array with index 0 as the root, and for the node at index `i`:

```
left child:  2i + 1
right child: 2i + 2
parent:      Math.floor((i - 1) / 2)
```

That array `[1, 3, 6, 5, 9, 8]` is the tree

```
      1
     / \
    3   6
   / \ /
  5  9 8
```

Check it against the formulas. Index 1 holds 3; its children are indices 3 and 4, holding 5 and 9. Index 2 holds 6; its left child is index 5, holding 8, and its right child would be index 6, which does not exist. Index 5's parent is `Math.floor((5 - 1) / 2) = 2`, holding 6. Every parent is ≤ its children, and the tree is complete, so this is a valid min-heap.

Because the shape is fixed, only two operations can ever disturb the heap, and each has exactly one repair: `insert` adds at the end and sifts **up**; `extract-min` moves the last leaf to the root and sifts **down**. Slide 12 prices them: find-min is O(1), insert and extract-min are O(log n), and building a heap from n items is O(n).

> [!quote]- Source: L4 · Slide 3
> "Each element has a priority; the element with the highest priority leaves first"
>
> Priority queues Each element has a priority; the element with the highest priority leaves first Operations: insert, peek (find-min or find-max), extract-min (or extract-max) Applications: CPU and job scheduling Dijkstra's shortest paths and Prim's minimum spanning tree Event-driven simulation Heapsort, and finding the k largest items in a stream
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=3>)

> [!quote]- Source: L4 · Slide 4
> "Introduced by J. W. J. Williams in 1964 as the data structure for heapsort"
>
> Binary heap Introduced by J. W. J. Williams in 1964 as the data structure for heapsort Shape property: a complete binary tree: every level full except possibly the last, which fills from the left Heap property: min-heap: every parent ≤ its children, so the minimum is at the root max-heap: every parent ≥ its children, so the maximum is at the root A heap is not sorted: siblings have no order between them
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=4>)

> [!quote]- Source: L4 · Slide 5
> "Store the nodes level by level in an array"
>
> Array representation Store the nodes level by level in an array (index 0 = root) For the node at index i: left child: 2i + 1 right child: 2i + 2 parent: ⌊(i − 1) / 2⌋ No pointers needed; the complete shape leaves no gaps array: [1, 3, 6, 5, 9, 8] 1 / \ 3 6 / \ / 5 9 8
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=5>)

> [!quote]- Source: L4 · Slide 12
> "Operation Binary heap Unsorted array Sorted array"
>
> Complexity summary Operation Binary heap Unsorted array Sorted array find-min O(1) O(n) O(1) insert O(log n) O(1) O(n) extract-min O(log n) O(n) O(1)* decrease-key O(log n) O(1) O(n) build from n items O(n) O(1) O(n log n) * when the array is sorted in decreasing order so the minimum is removed from the end.
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=12>)

## Step by step

Slide 7 of Lecture 4 traces one insert into the heap `[1, 3, 6, 5, 9, 8]`. Here is the same procedure run on a different heap, with every array written out. Keep the array on paper and move the index with your finger — the exam marks the array after each swap, not just the final one.

### 1. Write the starting heap and confirm it is valid

Start from `[4, 7, 9, 12, 8, 10]`. Check the shape: indices 0–5 exist, so the tree has a root, two children, and three leaves at indices 3, 4, 5 — level 0 full, level 1 full, level 2 filling from the left. Check the heap property: index 1 holds 7 with children at 3 (12) and 4 (8), and 7 ≤ 12 and 7 ≤ 8. Index 2 holds 9 with left child at 5 (10), and 9 ≤ 10. Valid min-heap.

> [!check] Check
> You can name the parent of index 4 as `Math.floor((4 - 1) / 2) = 1` without hesitating.

### 2. Append the new key at the end

Insert 5. The new key goes at index 6 — the next free slot, which keeps the tree complete. Array becomes `[4, 7, 9, 12, 8, 10, 5]`. Do not compare-and-place it anywhere else; the shape property forces the position.

> [!warning]
> Writing 5 next to the 4 at the root, or anywhere except the end, breaks the complete-tree shape. The array would no longer be a heap no matter how the comparisons come out.

> [!check] Check
> Array length is 7, and the new key is at index 6.

### 3. Find the parent of the new key

`i = 6`, so `p = Math.floor((6 - 1) / 2) = Math.floor(2.5) = 2`. Index 2 holds 9. Compare: is `heap[2] <= heap[6]`? 9 ≤ 5 is false, so the heap property is violated and you must swap.

> [!check] Check
> You computed 2, not 3 — integer division truncates, it does not round.

### 4. Swap with the parent and move up

Swap indices 2 and 6: `[4, 7, 5, 12, 8, 10, 9]`. The 5 is now at index 2. Set `i = 2` and repeat.

> [!check] Check
> The 9 that was at index 2 now sits at index 6, the last slot.

### 5. Repeat at the new index

`i = 2`, so `p = Math.floor((2 - 1) / 2) = 0`. Index 0 holds 4. Compare: 4 ≤ 5 is true. The heap property holds, so break out of the loop. No swap.

> [!check] Check
> You stopped. The loop condition `i > 0` is still true, but `heap[p] <= heap[i]` (4 ≤ 5) is now true, and that `break` is the exit.

### 6. Write the final array and verify

Final array: `[4, 7, 5, 12, 8, 10, 9]`. Verify every parent: index 0 (4) ≤ 7 and 5; index 1 (7) ≤ 12 and 8; index 2 (5) ≤ 10 and 9. Shape is still complete. One swap, one level: sift-up makes at most one swap per level, so the cost is bounded by the height, O(log n).

> [!check] Check
> The array has the same 7 keys you started with plus the 5, and every parent-child pair passes the comparison.

> [!quote]- Source: L4 · Slide 6
> "heap.push(x); // keep the shape: add at the end"
>
> Insert: sift-up function insert(heap, x) { heap.push(x); // keep the shape: add at the end let i = heap.length - 1; while (i > 0) { const p = Math.floor((i - 1) / 2); if (heap[p] <= heap[i]) break; // heap property holds [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; // move up one level } } At most one swap per level: O(log n) worst case (O(1) on average)
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=6>)

> [!quote]- Source: L4 · Slide 7
> "Start: [1, 3, 6, 5, 9, 8]; insert 2"
>
> Insert walkthrough Start: [1, 3, 6, 5, 9, 8]; insert 2 Place 2 at index 6; its parent is index 2 (value 6) 2 < 6: swap → [1, 3, 2, 5, 9, 8, 6] Now at index 2; parent is index 0 (value 1); 2 > 1: stop Result: [1, 3, 2, 5, 9, 8, 6]
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=7>)

## Exercise

Write `siftUp(heap, i)` in JavaScript. The array `heap` is a valid min-heap except that the element at index `i` may be smaller than its ancestors. Move it up by repeatedly swapping it with its parent while the parent is greater, using `Math.floor((i - 1) / 2)` for the parent index. Stop when `i` reaches 0 or the parent is already `<=` the element. Mutate `heap` in place and return it.

`siftUp([4, 7, 9, 12, 8, 10, 5], 6)` must return `[4, 7, 5, 12, 8, 10, 9]` — the same trace as the walkthrough: the key 5 swaps once with 9 at index 2, then stops because 4 ≤ 5.

```js
function siftUp(heap, i) {
  // Move heap[i] toward the root until its parent is <= it.
  // Mutate `heap` in place and return it.
  // TODO: while i > 0, compare heap[i] with its parent;
  //       stop if the parent is <= it, else swap and move up.
  return heap;
}
```

Tests:

- walkthrough: key 5 swaps once with 9, then stops under 4: `siftUp([4, 7, 9, 12, 8, 10, 5], 6)` → `[4,7,5,12,8,10,9]`
- slide 7: inserting 2 into [1, 3, 6, 5, 9, 8]: `siftUp([1, 3, 6, 5, 9, 8, 2], 6)` → `[1,3,2,5,9,8,6]`
- a new minimum climbs all the way to the root: `siftUp([6, 15, 8, 20, 19, 25, 11, 4], 7)` → `[4,6,8,15,19,25,11,20]`
- parent already smaller: nothing moves: `siftUp([1, 3, 6, 5, 9, 8, 7], 6)` → `[1,3,6,5,9,8,7]`
- changes the array in place: `(() => { const h = [1, 3, 6, 5, 9, 8, 2]; siftUp(h, 6); return h; })()` → `[1,3,2,5,9,8,6]`

> [!tip]- Hints
> - Compute the parent index inside the loop, not once before it — the element moves after every swap.
> - The loop condition is `i > 0`; the exit inside it is `if (heap[p] <= heap[i]) break;`.
> - Swap with a destructuring assignment: `[heap[p], heap[i]] = [heap[i], heap[p]];` then set `i = p`.

> [!question] Q1 · code
> Write `siftUp(heap, i)` in JavaScript. The array `heap` is a valid min-heap except that the element at index `i` may be smaller than its ancestors. Move it up by repeatedly swapping it with its parent while the parent is greater, using `Math.floor((i - 1) / 2)` for the parent index. Stop when `i` reaches 0 or the parent is already `<=` the element. Mutate `heap` in place and return it.
>
> `siftUp([4, 7, 9, 12, 8, 10, 5], 6)` must return `[4, 7, 5, 12, 8, 10, 9]` — the same trace as the walkthrough: 5 swaps with 9 at index 2, then stops because 4 ≤ 5.

> [!success]- Answer
> Run the tests in the course page.

> [!quote]- Source: L4 · Slide 6
> "heap.push(x); // keep the shape: add at the end"
>
> Insert: sift-up function insert(heap, x) { heap.push(x); // keep the shape: add at the end let i = heap.length - 1; while (i > 0) { const p = Math.floor((i - 1) / 2); if (heap[p] <= heap[i]) break; // heap property holds [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; // move up one level } } At most one swap per level: O(log n) worst case (O(1) on average)
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=6>)

> [!quote]- Source: L4 · Slide 7
> "Start: [1, 3, 6, 5, 9, 8]; insert 2"
>
> Insert walkthrough Start: [1, 3, 6, 5, 9, 8]; insert 2 Place 2 at index 6; its parent is index 2 (value 6) 2 < 6: swap → [1, 3, 2, 5, 9, 8, 6] Now at index 2; parent is index 0 (value 1); 2 > 1: stop Result: [1, 3, 2, 5, 9, 8, 6]
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=7>)

## Checklist

**Before you hand in a heap trace**

- [ ] Every intermediate array has the same length as the number of keys inserted so far.
  - *A dropped or duplicated key is the fastest way to lose every mark after it.*
- [ ] Each new key was written at the last index, `heap.length - 1`, before any comparison.
  - *Inserting anywhere else breaks the complete-tree shape, which no amount of swapping repairs.*
- [ ] Every parent index is `Math.floor((i - 1) / 2)`, computed with truncation.
  - *Rounding instead of truncating sends you to the wrong parent on even indices: for i = 6, (6 − 1) / 2 = 2.5 must become 2, not 3.*
- [ ] Each swap is shown as a separate array, not summarised as one final array.
  - *The marks are for the swaps; a single final array cannot show that you did them.*
- [ ] Sift-up stopped at the first index where the parent is ≤ the key, not at the root by default.
  - *Over-swapping past the stopping point produces an array that is not the algorithm's output.*
- [ ] For extract-min, the last leaf was moved to index 0 before any comparison, and the old root was recorded as the returned minimum.
  - *Sifting down the old root instead of the last leaf gives a different, wrong array.*
- [ ] At each sift-down step you compared the node with BOTH children and swapped with the smaller one.
  - *Swapping with the larger child puts a bigger value above a smaller one and violates the heap property.*
- [ ] The final array passes the parent check at every index: `heap[Math.floor((i-1)/2)] <= heap[i]` for all i > 0.
  - *This is the only self-check that catches a swap you forgot to write down.*

> [!note]
> Run this list against your answer to Tutorial 4 question (1) on slide 13 — insert 20, 15, 30, 5, 10, 25 into an empty min-heap and show the array after each insert.

> [!quote]- Source: L4 · Slide 5
> "Store the nodes level by level in an array"
>
> Array representation Store the nodes level by level in an array (index 0 = root) For the node at index i: left child: 2i + 1 right child: 2i + 2 parent: ⌊(i − 1) / 2⌋ No pointers needed; the complete shape leaves no gaps array: [1, 3, 6, 5, 9, 8] 1 / \ 3 6 / \ / 5 9 8
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=5>)

> [!quote]- Source: L4 · Slide 6
> "heap.push(x); // keep the shape: add at the end"
>
> Insert: sift-up function insert(heap, x) { heap.push(x); // keep the shape: add at the end let i = heap.length - 1; while (i > 0) { const p = Math.floor((i - 1) / 2); if (heap[p] <= heap[i]) break; // heap property holds [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; // move up one level } } At most one swap per level: O(log n) worst case (O(1) on average)
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=6>)

> [!quote]- Source: L4 · Slide 8
> "if (heap.length > 0) {"
>
> Extract-min: sift-down function extractMin(heap) { const min = heap[0]; const last = heap.pop(); if (heap.length > 0) { heap[0] = last; // move the last leaf to the root let i = 0; while (true) { const l = 2 * i + 1, r = l + 1; let s = i; // index of the smallest of i, l, r if (l < heap.length && heap[l] < heap[s]) s = l; if (r < heap.length && heap[r] < heap[s]) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return min; }
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=8>)

> [!quote]- Source: L4 · Slide 13
> "Heap = complete binary tree + heap property, stored in an array"
>
> Summary and tutorial Heap = complete binary tree + heap property, stored in an array insert and extract-min are O(log n); find-min is O(1); build-heap is O(n) Heapsort: O(n log n), in place, not stable Tutorial 4: (1) Insert 20, 15, 30, 5, 10, 25 into an empty min-heap and show the array after each insert. (2) Perform two extract-min operations on the result. (3) Use a min-heap of size k to find the k largest numbers in a stream of n numbers. What is the running time?
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=13>)

## One extract-min, swap by swap

Take the heap `[4, 7, 5, 12, 8, 10, 9]` from the walkthrough and run `extractMin` on it, following slide 8.

**Record the minimum.** `min = heap[0] = 4`. This is what the function returns; it is not part of the array any more.

**Remove the last leaf.** `last = heap.pop()` removes 9, leaving `[4, 7, 5, 12, 8, 10]`. The array is one shorter.

**Move the last leaf to the root.** `heap[0] = 9`, giving `[9, 7, 5, 12, 8, 10]`. The shape is complete again, but the root is 9 and its children are 7 and 5 — the heap property is broken.

**Sift down from i = 0.**

| i | node | left child | right child | smallest of the three | action | array |
|---|---|---|---|---|---|---|
| 0 | 9 | index 1 = 7 | index 2 = 5 | 5 at index 2 | swap 0 and 2 | `[5, 7, 9, 12, 8, 10]` |
| 2 | 9 | index 5 = 10 | index 6 — does not exist | 9 | stop | `[5, 7, 9, 12, 8, 10]` |

At `i = 2` the left child is 10 and 9 < 10, so the node is already the smallest of the three and the loop breaks.

**Result.** `extractMin` returns 4, and the heap is `[5, 7, 9, 12, 8, 10]`. Verify it: index 0 (5) ≤ 7 and 9; index 1 (7) ≤ 12 and 8; index 2 (9) ≤ 10. One swap, one level down — the cost is the height, O(log n).

Note what did *not* happen: the 9 did not travel to the bottom of the tree, and the array did not come back sorted. A heap only promises the root is the minimum.

> [!quote]- Source: L4 · Slide 8
> "if (heap.length > 0) {"
>
> Extract-min: sift-down function extractMin(heap) { const min = heap[0]; const last = heap.pop(); if (heap.length > 0) { heap[0] = last; // move the last leaf to the root let i = 0; while (true) { const l = 2 * i + 1, r = l + 1; let s = i; // index of the smallest of i, l, r if (l < heap.length && heap[l] < heap[s]) s = l; if (r < heap.length && heap[r] < heap[s]) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return min; }
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=8>)

> [!quote]- Source: L4 · Slide 5
> "Store the nodes level by level in an array"
>
> Array representation Store the nodes level by level in an array (index 0 = root) For the node at index i: left child: 2i + 1 right child: 2i + 2 parent: ⌊(i − 1) / 2⌋ No pointers needed; the complete shape leaves no gaps array: [1, 3, 6, 5, 9, 8] 1 / \ 3 6 / \ / 5 9 8
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=5>)

## A common mix-up

> [!failure] The belief
> The array `[1, 3, 6, 5, 9, 8]` is a heap, so it must be sorted — reading it left to right should give 1, 3, 5, 6, 8, 9.

**Why it seems right.** The root is the smallest key and every parent is smaller than its children, so the values do look like they are climbing as you read along the array. The first three entries, 1, 3, 6, are even in ascending order, which makes the pattern feel confirmed.

> [!success] What is true
> Slide 4 states plainly that a heap is not sorted and that siblings have no order between them. The heap property constrains only parent-child pairs, never left-right pairs. In `[1, 3, 6, 5, 9, 8]` the children of 3 are 5 and 9, and nothing requires 5 to come first — `[1, 3, 6, 9, 5, 8]` is an equally valid heap with the same keys. The difference predicts real behaviour: `find-min` is O(1) because the minimum is pinned at index 0, but finding the second-smallest key requires scanning the children of the root, and printing the heap in order requires heapsort — the O(n log n) procedure on slide 11 — not a single pass.

> [!quote]- Source: L4 · Slide 4
> "Introduced by J. W. J. Williams in 1964 as the data structure for heapsort"
>
> Binary heap Introduced by J. W. J. Williams in 1964 as the data structure for heapsort Shape property: a complete binary tree: every level full except possibly the last, which fills from the left Heap property: min-heap: every parent ≤ its children, so the minimum is at the root max-heap: every parent ≥ its children, so the maximum is at the root A heap is not sorted: siblings have no order between them
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=4>)

> [!quote]- Source: L4 · Slide 11
> "Build a max-heap from the array: O(n)"
>
> Heapsort 1. Build a max-heap from the array: O(n) 2. Repeat n − 1 times: swap the root with the last element of the heap, shrink the heap by one, sift-down the new root Runs in O(n log n) in every case Sorts in place (O(1) extra memory) but is not stable
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=11>)

## Check yourself

Answer them without looking back at the walkthrough.

> [!question] Q2 · ordering
> A min-heap is stored as `[6, 15, 8, 20, 19, 25, 11]`. Insert the key 4 and put the arrays below in the order they occur, starting from the state before the insert.
>
> Put in order:
> - a) [6, 15, 8, 4, 19, 25, 11, 20]
> - b) [6, 15, 8, 20, 19, 25, 11]
> - c) [4, 6, 8, 15, 19, 25, 11, 20]
> - d) [6, 15, 8, 20, 19, 25, 11, 4]
> - e) [6, 4, 8, 15, 19, 25, 11, 20]

> [!success]- Answer
> b) [6, 15, 8, 20, 19, 25, 11] → d) [6, 15, 8, 20, 19, 25, 11, 4] → a) [6, 15, 8, 4, 19, 25, 11, 20] → e) [6, 4, 8, 15, 19, 25, 11, 20] → c) [4, 6, 8, 15, 19, 25, 11, 20]
>
> 4 is appended at index 7. Its parent is ⌊(7 − 1) / 2⌋ = 3, holding 20: swap. At index 3 the parent is ⌊(3 − 1) / 2⌋ = 1, holding 15: swap. At index 1 the parent is index 0, holding 6: swap. 4 is now the root, after three swaps, one per level.

> [!quote]- Source: L4 · Slide 5
> "parent: ⌊(i − 1) / 2⌋"
>
> Array representation Store the nodes level by level in an array (index 0 = root) For the node at index i: left child: 2i + 1 right child: 2i + 2 parent: ⌊(i − 1) / 2⌋ No pointers needed; the complete shape leaves no gaps array: [1, 3, 6, 5, 9, 8] 1 / \ 3 6 / \ / 5 9 8
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=5>)

> [!question] Q3 · numeric
> A min-heap is stored in an array with 14 elements, using the slide's 0-based indexing. During one `extract-min`, after the last leaf is moved to the root, how many array elements does the sift-down loop examine in total across all its iterations — counting each child index that is compared against the current node? Give the maximum possible number for a heap of this size, as a whole number. Give your answer in child comparisons.

> [!success]- Answer
> 6 child comparisons
>
> Sift-down descends at most one level per iteration and the tree of 14 nodes is 3 levels deep below the root, so the loop runs at most 3 times; each iteration inspects a left child and a right child, giving at most 6 child comparisons.

> [!quote]- Source: L4 · Slide 8
> "if (l < heap.length && heap[l] < heap[s]) s = l; if (r < heap.length && heap[r] < heap[s]) s = r;"
>
> Extract-min: sift-down function extractMin(heap) { const min = heap[0]; const last = heap.pop(); if (heap.length > 0) { heap[0] = last; // move the last leaf to the root let i = 0; while (true) { const l = 2 * i + 1, r = l + 1; let s = i; // index of the smallest of i, l, r if (l < heap.length && heap[l] < heap[s]) s = l; if (r < heap.length && heap[r] < heap[s]) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return min; }
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=8>)

> [!question] Q4 · short answer
> Slide 3 of Lecture 4 lists CPU and job scheduling and Dijkstra's shortest paths as applications of priority queues. Choose one of those two and explain why a binary heap suits it specifically — refer to the operation the application performs most often and the heap's cost for that operation compared with the alternatives on slide 12.

> [!success]- Answer
> Dijkstra's algorithm repeatedly removes the unsettled vertex with the smallest tentative distance, which is exactly extract-min, and relaxes edges, which lowers tentative distances — a decrease-key. A binary heap does both in O(log n), while an unsorted array does extract-min in O(n) and a sorted array does decrease-key in O(n). So the two operations the algorithm repeats most are cheap on a heap and slow on at least one of them on either array.
>
> Slide 12: a binary heap does extract-min and decrease-key in O(log n), while an unsorted array needs O(n) for extract-min and a sorted array O(n) for decrease-key.
>
> | Criterion | Excellent | Acceptable |
> |---|---|---|
> | Names the dominant operation the chosen application performs | States that Dijkstra repeatedly extracts the minimum-distance vertex, or that a scheduler repeatedly extracts the highest-priority job. | Names extract-min or insert as the operation, without tying it to what the application does with the result. |
> | Gives the heap's cost for that operation and one rival's cost from slide 12 | Cites O(log n) for the heap operation and contrasts it with a named alternative, e.g. O(n) extract-min on an unsorted array. | Gives O(log n) for the heap but names no comparison structure or gives its cost incorrectly. |
> | Connects the cost to the application's overall running time | States that per-edge or per-job heap operations give an overall bound such as O(E log V) or O(n log n) for the schedule. | Says the total work is the number of operations times the per-operation cost, without a concrete bound. |

> [!quote]- Source: L4 · Slide 12
> "extract-min O(log n) O(n) O(1)* decrease-key O(log n) O(1) O(n)"
>
> Complexity summary Operation Binary heap Unsorted array Sorted array find-min O(1) O(n) O(1) insert O(log n) O(1) O(n) extract-min O(log n) O(n) O(1)* decrease-key O(log n) O(1) O(n) build from n items O(n) O(1) O(n log n) * when the array is sorted in decreasing order so the minimum is removed from the end.
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=12>)

> [!question] Q5 · cloze
> In a binary min-heap stored in an array with index 0 as the root, the parent of the node at index i is at index ____.

> [!success]- Answer
> Math.floor((i - 1) / 2) / Math.floor((i-1)/2) / floor((i - 1) / 2) / floor((i-1)/2) / ⌊(i − 1) / 2⌋ / ⌊(i-1)/2⌋
>
> Slide 5 gives the parent of index i as floor((i - 1) / 2); the floor is what makes it correct for even indices, where the division does not come out whole (index 6: (6 − 1) / 2 = 2.5, floor 2).

> [!quote]- Source: L4 · Slide 5
> "parent: ⌊(i − 1) / 2⌋"
>
> Array representation Store the nodes level by level in an array (index 0 = root) For the node at index i: left child: 2i + 1 right child: 2i + 2 parent: ⌊(i − 1) / 2⌋ No pointers needed; the complete shape leaves no gaps array: [1, 3, 6, 5, 9, 8] 1 / \ 3 6 / \ / 5 9 8
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=5>)

> [!quote]- Source: L4 · Slide 12
> "Operation Binary heap Unsorted array Sorted array"
>
> Complexity summary Operation Binary heap Unsorted array Sorted array find-min O(1) O(n) O(1) insert O(log n) O(1) O(n) extract-min O(log n) O(n) O(1)* decrease-key O(log n) O(1) O(n) build from n items O(n) O(1) O(n log n) * when the array is sorted in decreasing order so the minimum is removed from the end.
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=12>)

> [!quote]- Source: L4 · Slide 8
> "if (heap.length > 0) {"
>
> Extract-min: sift-down function extractMin(heap) { const min = heap[0]; const last = heap.pop(); if (heap.length > 0) { heap[0] = last; // move the last leaf to the root let i = 0; while (true) { const l = 2 * i + 1, r = l + 1; let s = i; // index of the smallest of i, l, r if (l < heap.length && heap[l] < heap[s]) s = l; if (r < heap.length && heap[r] < heap[s]) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return min; }
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=8>)

> [!quote]- Source: L4 · Slide 5
> "Store the nodes level by level in an array"
>
> Array representation Store the nodes level by level in an array (index 0 = root) For the node at index i: left child: 2i + 1 right child: 2i + 2 parent: ⌊(i − 1) / 2⌋ No pointers needed; the complete shape leaves no gaps array: [1, 3, 6, 5, 9, 8] 1 / \ 3 6 / \ / 5 9 8
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=5>)

## Reflect

> [!question] Reflect
> Take the heap `[2, 8, 5, 12, 9, 6]`. Without running anything, predict the array after inserting 1, then after one extract-min on the original heap. Write both predictions down before you check them — which of the two traces did you get wrong, and which step in it slipped?

> [!quote]- Source: L4 · Slide 6
> "heap.push(x); // keep the shape: add at the end"
>
> Insert: sift-up function insert(heap, x) { heap.push(x); // keep the shape: add at the end let i = heap.length - 1; while (i > 0) { const p = Math.floor((i - 1) / 2); if (heap[p] <= heap[i]) break; // heap property holds [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; // move up one level } } At most one swap per level: O(log n) worst case (O(1) on average)
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=6>)

> [!quote]- Source: L4 · Slide 8
> "if (heap.length > 0) {"
>
> Extract-min: sift-down function extractMin(heap) { const min = heap[0]; const last = heap.pop(); if (heap.length > 0) { heap[0] = last; // move the last leaf to the root let i = 0; while (true) { const l = 2 * i + 1, r = l + 1; let s = i; // index of the smallest of i, l, r if (l < heap.length && heap[l] < heap[s]) s = l; if (r < heap.length && heap[r] < heap[s]) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return min; }
> [Open the page](<../sources/CSC2103-L04-binary-heaps.pdf#page=8>)

---

*Made with BiliMind for WorkBuddy from your own files. Course: CSC2103 Data Structures final.*

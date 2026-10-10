---
title: "Arrays vs linked lists: linear containers"
course: "Data structures final prep"
lesson: 1
kind: "Two things you mix up"
day: 2026-10-11
minutes: 30
tags: [bilimind, arrays_vs_linked_lists]
---

# Arrays vs linked lists: linear containers

> [!info] Two things you mix up · 30 min · study Sun 11 Oct
> You will be able to implement a dynamic array and a singly linked list from the Lecture 1 code, and predict which operations are cheap in each. Covers capacity doubling, O(1) amortised append, O(1) pushFront for a linked list, and the O(n) shift that array insertion hides. Prevents quoting O(1) insertion for an array without mentioning the elements you have to move.

## Comparison

Your lecture slides give you two ways to store a sequence of values: a dynamic array and a singly linked list. The whole skill of this lesson is knowing which one to reach for. The table below uses the exact operations from slide 14 of your deck.

| | Access by index | Insert at front | Insert at end | Insert in middle | Memory overhead |
|---|---|---|---|---|---|
| **Dynamic array** | Θ(1) | Θ(n) | Θ(1) amortised | Θ(n) | Θ(n) spare capacity |
| **Singly linked list** | Θ(n) | Θ(1) | Θ(1) if last node known, else Θ(n) | search time + Θ(1) | Θ(n) for references (next pointers) |

- **Dynamic array** is best for when you need fast random access by position and most inserts happen at the end.

- **Singly linked list** is best for when you insert or delete at the front frequently and rarely need to jump to an arbitrary position.

> [!quote]- Source: L1 · Slide 14
> "Linked list vs dynamic array"
>
> Linked list vs dynamic array Operation Linked list Dynamic array Access by index Θ(n) Θ(1) Insert/delete at beginning Θ(1) Θ(n) Insert/delete at end Θ(1) when the last node is known, Θ(n) otherwise Θ(1) amortised Insert/delete in middle search time + Θ(1) Θ(n) Wasted space Θ(n) (references) Θ(n) (spare capacity) Deleting the last node of a singly linked list still needs the node before it, so it is Θ(n) without a doubly linked list.
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=14>)

## Tracing an append that triggers growth

Your slide 10 shows the append function. Trace what happens when you start with an empty dynamic array of capacity 2 and append the values 10, 20, 30.

**Initial state:** `data = [_, _]`, `size = 0`, `capacity = 2`

1. **append(10):** size (0) < capacity (2) → no copy. `data[0] = 10`, size becomes 1. Array: `[10, _]`

2. **append(20):** size (1) < capacity (2) → no copy. `data[1] = 20`, size becomes 2. Array: `[10, 20]`

3. **append(30):** size (2) === capacity (2) → full. Allocate `bigger = new Array(4)` (capacity doubles to 4). Copy: `bigger[0]=10, bigger[1]=20`. `data = bigger`, `capacity = 4`. Then `data[2] = 30`, size becomes 3. Array: `[10, 20, 30, _]`

**Key point:** the third append did O(1) work for the write plus O(n) work for the copy of 2 elements. The copy is the rare, expensive step that makes the amortised argument work.

> [!quote]- Source: L1 · Slide 8
> "Elements stored in one contiguous block of memory"
>
> Arrays (static) Elements stored in one contiguous block of memory Address of element i = base address + i × element size, so access by index is O(1) Capacity is fixed when the array is created Inserting or deleting in the middle shifts the elements after it: O(n) Good cache locality: neighbours sit next to each other in memory
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=8>)

> [!quote]- Source: L1 · Slide 9
> "A variable-size list built on a fixed-size array plus a capacity"
>
> Dynamic arrays A variable-size list built on a fixed-size array plus a capacity Elements 0 .. size−1 are used; the rest of the capacity is reserved for growth When size = capacity, allocate a bigger array (for example double the capacity) and copy every element across Examples: Java ArrayList , C++ std::vector , Python list , JavaScript arrays Common growth factors are between 1.5 and 2
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=9>)

> [!quote]- Source: L1 · Slide 10
> "if (arr.size === arr.capacity) { // full: grow"
>
> Append with geometric growth function append(arr, x) { if (arr.size === arr.capacity) { // full: grow const bigger = new Array(arr.capacity * 2); for (let i = 0; i < arr.size; i++) bigger[i] = arr.data[i]; // copy: O(n) arr.data = bigger; arr.capacity *= 2; } arr.data[arr.size++] = x; // usual case: O(1) }
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=10>)

> [!quote]- Source: L1 · Slide 11
> "One append can cost O(n) (when it triggers a copy), but copies are rare"
>
> Amortised analysis of append One append can cost O(n) (when it triggers a copy), but copies are rare With doubling, n appends copy at most 1 + 2 + 4 + … + n/2 < n elements in total Total work for n appends < n writes + n copies = O(n), so each append is O(1) amortised Growing by a constant amount (for example +10 slots) instead gives O(n) per append on average and O(n²) in total Trade-off: a larger growth factor means fewer copies but more unused capacity
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=11>)

## Explainer

Your slides give you two containers, and the exam will ask you to pick the right one for the job. The decision comes down to three questions:

**1. Do you need to jump to position k?**
A dynamic array stores elements in one contiguous block (slide 8). Address of element i = base + i × element_size, so reading or writing `arr[5]` is one multiplication and one memory access: Θ(1). A linked list must walk from the head, following next pointers, until it reaches node k: Θ(n). If the operation is "give me the 1000th element", a dynamic array wins before the loop starts.

**2. Where do inserts happen?**
- **At the front:** A linked list creates a new node and points its next to the old head — that is two pointer assignments, Θ(1). A dynamic array must shift every existing element right by one slot, which is Θ(n).
- **At the end:** A dynamic array writes to `data[size]` and increments size. Only when the array is full does it copy everything into a bigger array (slide 10). With doubling, that copy is rare enough that the average cost per append is Θ(1) amortised (slide 11). A singly linked list can only append in Θ(1) if you keep a reference to the last node; otherwise you must walk the whole list to find it.
- **In the middle:** Both are slow. The array shifts elements (Θ(n)). The list must search for the position (Θ(n)) and then the insert itself is Θ(1).

**3. How much memory can you waste?**
A dynamic array reserves spare capacity that it may never fill — up to half the allocated space with doubling. A linked list stores one extra reference per element (the `next` pointer), which is Θ(n) overhead regardless of how full the list is. Neither is "better" here; the trade-off is which kind of waste your scenario tolerates.

Slide 14 of your deck summarises every operation in one table. The exam question Q4a asks you to reproduce exactly this comparison for (i) access by index, (ii) insertion at the front, and (iii) memory use.

> [!quote]- Source: L1 · Slide 8
> "Elements stored in one contiguous block of memory"
>
> Arrays (static) Elements stored in one contiguous block of memory Address of element i = base address + i × element size, so access by index is O(1) Capacity is fixed when the array is created Inserting or deleting in the middle shifts the elements after it: O(n) Good cache locality: neighbours sit next to each other in memory
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=8>)

> [!quote]- Source: L1 · Slide 9
> "A variable-size list built on a fixed-size array plus a capacity"
>
> Dynamic arrays A variable-size list built on a fixed-size array plus a capacity Elements 0 .. size−1 are used; the rest of the capacity is reserved for growth When size = capacity, allocate a bigger array (for example double the capacity) and copy every element across Examples: Java ArrayList , C++ std::vector , Python list , JavaScript arrays Common growth factors are between 1.5 and 2
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=9>)

> [!quote]- Source: L1 · Slide 10
> "if (arr.size === arr.capacity) { // full: grow"
>
> Append with geometric growth function append(arr, x) { if (arr.size === arr.capacity) { // full: grow const bigger = new Array(arr.capacity * 2); for (let i = 0; i < arr.size; i++) bigger[i] = arr.data[i]; // copy: O(n) arr.data = bigger; arr.capacity *= 2; } arr.data[arr.size++] = x; // usual case: O(1) }
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=10>)

> [!quote]- Source: L1 · Slide 11
> "One append can cost O(n) (when it triggers a copy), but copies are rare"
>
> Amortised analysis of append One append can cost O(n) (when it triggers a copy), but copies are rare With doubling, n appends copy at most 1 + 2 + 4 + … + n/2 < n elements in total Total work for n appends < n writes + n copies = O(n), so each append is O(1) amortised Growing by a constant amount (for example +10 slots) instead gives O(n) per append on average and O(n²) in total Trade-off: a larger growth factor means fewer copies but more unused capacity
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=11>)

> [!quote]- Source: L1 · Slide 12
> "A sequence of nodes; each node stores a value and a reference (next) to the next node"
>
> Linked lists A sequence of nodes; each node stores a value and a reference (next) to the next node The list is reached through its head; the last node's next is null Variants: singly linked, doubly linked (next and prev), circular Insert or delete at a known node: O(1), no shifting Access the k-th element: O(n), must walk from the head Costs: extra memory for references, poor cache locality
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=12>)

> [!quote]- Source: L1 · Slide 14
> "Linked list vs dynamic array"
>
> Linked list vs dynamic array Operation Linked list Dynamic array Access by index Θ(n) Θ(1) Insert/delete at beginning Θ(1) Θ(n) Insert/delete at end Θ(1) when the last node is known, Θ(n) otherwise Θ(1) amortised Insert/delete in middle search time + Θ(1) Θ(n) Wasted space Θ(n) (references) Θ(n) (spare capacity) Deleting the last node of a singly linked list still needs the node before it, so it is Θ(n) without a doubly linked list.
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=14>)

## A common mix-up

> [!failure] The belief
> Inserting at the end of a dynamic array is always O(1) — the slides say so.

**Why it seems right.** Slide 14 says 'Insert/delete at end: Θ(1) amortised'. It is easy to drop the word 'amortised' and remember only 'Θ(1)'.

> [!success] What is true
> A single append is O(1) only when the array still has spare capacity. When the array is full, that one append triggers a copy of all n elements, making that single operation O(n). The 'amortised O(1)' means that across many appends the average cost is constant, not that every individual append is constant.

> [!quote]- Source: L1 · Slide 10
> "if (arr.size === arr.capacity) { // full: grow"
>
> Append with geometric growth function append(arr, x) { if (arr.size === arr.capacity) { // full: grow const bigger = new Array(arr.capacity * 2); for (let i = 0; i < arr.size; i++) bigger[i] = arr.data[i]; // copy: O(n) arr.data = bigger; arr.capacity *= 2; } arr.data[arr.size++] = x; // usual case: O(1) }
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=10>)

> [!quote]- Source: L1 · Slide 11
> "One append can cost O(n) (when it triggers a copy), but copies are rare"
>
> Amortised analysis of append One append can cost O(n) (when it triggers a copy), but copies are rare With doubling, n appends copy at most 1 + 2 + 4 + … + n/2 < n elements in total Total work for n appends < n writes + n copies = O(n), so each append is O(1) amortised Growing by a constant amount (for example +10 slots) instead gives O(n) per append on average and O(n²) in total Trade-off: a larger growth factor means fewer copies but more unused capacity
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=11>)

> [!quote]- Source: L1 · Slide 14
> "Linked list vs dynamic array"
>
> Linked list vs dynamic array Operation Linked list Dynamic array Access by index Θ(n) Θ(1) Insert/delete at beginning Θ(1) Θ(n) Insert/delete at end Θ(1) when the last node is known, Θ(n) otherwise Θ(1) amortised Insert/delete in middle search time + Θ(1) Θ(n) Wasted space Θ(n) (references) Θ(n) (spare capacity) Deleting the last node of a singly linked list still needs the node before it, so it is Θ(n) without a doubly linked list.
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=14>)

## Tracing a linked list pushFront and find

Your slide 13 gives the JavaScript code. Trace what happens when you start with an empty list and run:

```javascript
let list = { head: null };
pushFront(list, 'B');
pushFront(list, 'A');
find(list, 'B');
```

**Step 1: pushFront(list, 'B')**
`list.head = new Node('B', null)`
State: `head → Node('B', null)`

**Step 2: pushFront(list, 'A')**
`list.head = new Node('A', list.head)` → `new Node('A', Node('B', null))`
State: `head → Node('A') → Node('B') → null`

**Step 3: find(list, 'B')**
Start at head: cur = Node('A'), value is 'A' ≠ 'B', move to cur.next.
cur = Node('B'), value is 'B' === 'B', return cur.
The function walked 2 nodes. In general, finding the k-th element from the head walks k nodes: Θ(n) in the worst case.

> [!quote]- Source: L1 · Slide 12
> "A sequence of nodes; each node stores a value and a reference (next) to the next node"
>
> Linked lists A sequence of nodes; each node stores a value and a reference (next) to the next node The list is reached through its head; the last node's next is null Variants: singly linked, doubly linked (next and prev), circular Insert or delete at a known node: O(1), no shifting Access the k-th element: O(n), must walk from the head Costs: extra memory for references, poor cache locality
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=12>)

> [!quote]- Source: L1 · Slide 13
> "constructor(value, next = null) { this.value = value; this.next = next; }"
>
> Linked list in JavaScript class Node { constructor(value, next = null) { this.value = value; this.next = next; } } function pushFront(list, value) { // O(1) list.head = new Node(value, list.head); } function find(list, value) { // O(n) for (let cur = list.head; cur !== null; cur = cur.next) if (cur.value === value) return cur; return null; }
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=13>)

## Exercise

Write the function `reverse(head)` that reverses a singly linked list **in place** and returns the new head. The Node class is already defined as:
```
class Node {
  constructor(value, next = null) {
    this.value = value;
    this.next = next;
  }
}
```
Your function must work for a list of any length (including empty). Do not create new nodes — rewire the existing ones.

Example: if `head` points to `1 → 2 → 3 → null`, after calling `reverse(head)` the list should be `3 → 2 → 1 → null` and the function returns the node with value 3.

```js
class Node {
  constructor(value, next = null) {
    this.value = value;
    this.next = next;
  }
}

function reverse(head) {
  // head is a Node or null
  // TODO: reverse the list in place and return the new head
}
```

Tests:

- reverses three-node list: `(function() { var n1 = new Node(1, new Node(2, new Node(3))); var r = reverse(n1); return r.value === 3 && r.next.value === 2 && r.next.next.value === 1 && r.next.next.next === null; })()` → `true`
- single node: `(function() { var n = new Node(42); var r = reverse(n); return r.value === 42 && r.next === null; })()` → `true`
- empty list: `reverse(null)` → `null`
- two nodes: `(function() { var n = new Node('a', new Node('b')); var r = reverse(n); return r.value === 'b' && r.next.value === 'a' && r.next.next === null; })()` → `true`

> [!tip]- Hints
> - Keep three pointers: previous, current, and next. Walk through the list and reverse each node's next pointer.
> - Start with prev = null, curr = head. Before you change curr.next, save the next node in a temporary variable.

> [!question] Q1 · code
> Write the reverse function as described above.

> [!success]- Answer
> Run the tests in the course page.

> [!quote]- Source: L1 · Slide 12
> "A sequence of nodes; each node stores a value and a reference (next) to the next node"
>
> Linked lists A sequence of nodes; each node stores a value and a reference (next) to the next node The list is reached through its head; the last node's next is null Variants: singly linked, doubly linked (next and prev), circular Insert or delete at a known node: O(1), no shifting Access the k-th element: O(n), must walk from the head Costs: extra memory for references, poor cache locality
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=12>)

> [!quote]- Source: L1 · Slide 13
> "constructor(value, next = null) { this.value = value; this.next = next; }"
>
> Linked list in JavaScript class Node { constructor(value, next = null) { this.value = value; this.next = next; } } function pushFront(list, value) { // O(1) list.head = new Node(value, list.head); } function find(list, value) { // O(n) for (let cur = list.head; cur !== null; cur = cur.next) if (cur.value === value) return cur; return null; }
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=13>)

## Check yourself

Check your understanding with these exam-style questions.

> [!question] Q2 · short answer
> A dynamic array doubles its capacity whenever it is full. Explain why appending n elements to an initially empty dynamic array costs O(n) in total, and state the amortised cost of a single append.

> [!success]- Answer
> Each append that does not trigger a copy costs O(1). When the array is full, a copy of all current elements is needed, costing O(k) for k elements. With doubling, the copies happen at sizes 1, 2, 4, 8, ... up to n/2. The sum of these copies is less than n, so total work for n appends is O(n). The amortised cost per append is O(1).
>
> O(1) amortised append
>
> | Criterion | Excellent | Acceptable |
> |---|---|---|
> | Explains why copies happen and how often | States that a copy occurs when size == capacity, and that with doubling the copies happen at sizes 1, 2, 4, ... up to n/2. | Mentions that copies happen when the array is full but does not describe the doubling pattern or the sizes. |
> | Sums the copy cost and concludes O(n) total | Shows that 1 + 2 + 4 + ... + n/2 < n, so total copy cost is O(n). | States the total cost is O(n) without showing the sum or with an incorrect sum. |
> | States amortised cost per append | States that amortised cost per append is O(1) and explains that it is the average over n operations. | States O(1) amortised but does not explain what 'amortised' means. |

> [!quote]- Source: L1 · Slide 15
> "O(1) amortised append"
>
> Summary and tutorial Big O describes growth for large n; drop constants and lower-order terms Dynamic arrays: O(1) index access, O(1) amortised append, O(n) insert in the middle Linked lists: O(1) insert/delete at a known node, O(n) access by position Tutorial 1: (1) Show that 5n² + 3n log n = O(n²) by giving c and n₀. (2) If a dynamic array triples its capacity instead of doubling, is append still O(1) amortised? Why? (3) Write a function that returns the middle node of a singly linked list in one pass.
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=15>)

> [!question] Q3 · short answer
> Compare a singly linked list with a dynamic array in terms of (i) access by index, (ii) insertion at the front, and (iii) memory use.
>
> *Beyond your slides: the Checker found no support for this in your files.*

> [!success]- Answer
> (i) Access by index: dynamic array is O(1) because elements are in contiguous memory; linked list is O(n) because you must walk from the head. (ii) Insertion at the front: linked list is O(1) by creating a new node and updating the head; dynamic array is O(n) because all elements must shift right. (iii) Memory use: dynamic array wastes space in spare capacity (up to half with doubling); linked list wastes space for a next reference per element.
>
> | Criterion | Excellent | Acceptable |
> |---|---|---|
> | Access by index comparison | States O(1) for array, O(n) for list, and gives a brief reason (contiguous memory vs walking pointers). | States correct complexities but gives no reason. |
> | Insertion at front comparison | States O(1) for list (new node, update head) and O(n) for array (shift all elements right). | States correct complexities but does not explain why. |
> | Memory use comparison | Describes array waste as spare capacity (up to half) and list waste as per-element next reference overhead. | Mentions that both waste memory but does not specify the nature of the waste. |

> [!question] Q4 · mcq
> You are writing a function that will frequently insert new items at the front of a list and occasionally read the third element. Which container should you choose, and why?
>
> - a) Dynamic array, because reading the third element is O(1).
> - b) Singly linked list, because insert at front is O(1) and reading the third element is O(1) once you have a reference.
> - c) Singly linked list, because insert at front is O(1) and reading the third element is O(3) which is still constant time.
> - d) Dynamic array, because insert at front is O(1) amortised.

> [!success]- Answer
> c) Singly linked list, because insert at front is O(1) and reading the third element is O(3) which is still constant time.
>
> Insert at front is O(1) for a linked list. Reading the third element requires walking three nodes, which is O(3) = O(1) because 3 is a constant. Option a ignores the cost of front inserts; option b is wrong because reading by index is O(n) without a reference; option d is wrong because array insert at front is O(n).

> [!quote]- Source: L1 · Slide 15
> "Linked lists: O(1) insert/delete at a known node, O(n) access by position"
>
> Summary and tutorial Big O describes growth for large n; drop constants and lower-order terms Dynamic arrays: O(1) index access, O(1) amortised append, O(n) insert in the middle Linked lists: O(1) insert/delete at a known node, O(n) access by position Tutorial 1: (1) Show that 5n² + 3n log n = O(n²) by giving c and n₀. (2) If a dynamic array triples its capacity instead of doubling, is append still O(1) amortised? Why? (3) Write a function that returns the middle node of a singly linked list in one pass.
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=15>)

> [!question] Q5 · multi select
> Which of the following statements about a dynamic array are true? Select all that apply.
>
> - a) Accessing element i is O(1) because the address is base + i × element_size.
> - b) Inserting at the front is O(1) amortised.
> - c) When the array is full, appending one element triggers a copy of all existing elements.
> - d) With geometric growth (doubling), n appends cost O(n) total, so each append is O(1) amortised.

> [!success]- Answer
> a) Accessing element i is O(1) because the address is base + i × element_size.; c) When the array is full, appending one element triggers a copy of all existing elements.; d) With geometric growth (doubling), n appends cost O(n) total, so each append is O(1) amortised.
>
> Option b is false: inserting at the front shifts every element right, which is O(n). Options a, c and d are stated on slides 8, 10 and 11 of your deck.

> [!quote]- Source: L1 · Slide 15
> "Dynamic arrays: O(1) index access, O(1) amortised append, O(n) insert in the middle"
>
> Summary and tutorial Big O describes growth for large n; drop constants and lower-order terms Dynamic arrays: O(1) index access, O(1) amortised append, O(n) insert in the middle Linked lists: O(1) insert/delete at a known node, O(n) access by position Tutorial 1: (1) Show that 5n² + 3n log n = O(n²) by giving c and n₀. (2) If a dynamic array triples its capacity instead of doubling, is append still O(1) amortised? Why? (3) Write a function that returns the middle node of a singly linked list in one pass.
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=15>)

> [!quote]- Source: L1 · Slide 15
> "Big O describes growth for large n; drop constants and lower-order terms"
>
> Summary and tutorial Big O describes growth for large n; drop constants and lower-order terms Dynamic arrays: O(1) index access, O(1) amortised append, O(n) insert in the middle Linked lists: O(1) insert/delete at a known node, O(n) access by position Tutorial 1: (1) Show that 5n² + 3n log n = O(n²) by giving c and n₀. (2) If a dynamic array triples its capacity instead of doubling, is append still O(1) amortised? Why? (3) Write a function that returns the middle node of a singly linked list in one pass.
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=15>)

> [!quote]- Source: L1 · Slide 8
> "Elements stored in one contiguous block of memory"
>
> Arrays (static) Elements stored in one contiguous block of memory Address of element i = base address + i × element size, so access by index is O(1) Capacity is fixed when the array is created Inserting or deleting in the middle shifts the elements after it: O(n) Good cache locality: neighbours sit next to each other in memory
> [Open the page](<../sources/CSC2103-L01-analysis-arrays-linked-lists.pdf#page=8>)

---

*Made with BiliMind from your own files. Course: Data structures final prep.*

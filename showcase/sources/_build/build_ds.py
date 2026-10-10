"""Build showcase/sources/ds-final: 4 lecture decks (landscape PDF) + a sample past paper (A4 PDF).

Content is compiled from Wikipedia articles (CC BY-SA 4.0) and rewritten as sparse lecture slides.
Run: python showcase/sources/_build/build_ds.py
"""
from __future__ import annotations

from pathlib import Path

from kit import deck_html, print_pdf, scratch_dir

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "ds-final"
WORK = scratch_dir() / "ds"

COURSE = "CSC2103 Data Structures"
LIC = [
    "Sample lecture deck compiled from Wikipedia (CC BY-SA 4.0) for a demo.",
    "Not official material of any university. See LICENSE.md for sources and attribution.",
]


def title(lec: str, name: str, sources: str) -> dict:
    return {
        "kind": "title",
        "code": f"{COURSE}  |  {lec}",
        "title": name,
        "sub": ["School of Computing (demo)  |  Week " + lec.split()[-1]],
        "lic": LIC + [f"Wikipedia articles used: {sources}."],
    }


def refs(articles: list[str]) -> dict:
    return {
        "title": "References and licence",
        "blocks": [
            ("ul", [f"Wikipedia, *{a}*, https://en.wikipedia.org/wiki/{a.replace(' ', '_')} (accessed 10 Oct 2026)" for a in articles]),
            ("note", "Text adapted and condensed from the articles above, licensed CC BY-SA 4.0 "
                     "(https://creativecommons.org/licenses/by-sa/4.0/). This deck is shared under the same licence. "
                     "Code snippets written for this deck."),
        ],
    }


# ---------------------------------------------------------------- Lecture 1
L1 = [
    title("Lecture 1", "Algorithm Analysis, Arrays and Linked Lists", "Big O notation, Dynamic array, Linked list"),
    {"title": "Learning outcomes", "blocks": [("ul", [
        "Describe the growth of running time using Big O notation",
        "Rank common growth rates: O(1), O(log n), O(n), O(n log n), O(n²), O(2ⁿ)",
        "Explain why appending to a dynamic array is O(1) amortised",
        "Compare arrays and linked lists and choose the right one for a task",
    ])]},
    {"title": "Why analyse algorithms?", "blocks": [("ul", [
        "Running time grows with the input size **n**",
        "We count basic operations, not seconds: the result does not depend on the machine",
        "**Worst case**: the most work for any input of size n (the usual guarantee)",
        "**Average case**: expected work over a distribution of inputs",
        "We care about behaviour for large n, so constants and small terms are ignored",
    ])]},
    {"title": "Big O notation", "blocks": [
        ("ul", [
            "**Definition:** f(n) = O(g(n)) if there are constants c > 0 and n₀ such that |f(n)| ≤ c·g(n) for all n ≥ n₀",
            "Big O gives an **upper bound** on the growth rate of f",
            "Drop constant factors and lower-order terms:",
            ["3n² + 5n + 2 = O(n²)", "Proof: for n ≥ 1, 3n² + 5n + 2 ≤ 3n² + 5n² + 2n² = 10n², so c = 10, n₀ = 1 works"],
        ]),
    ]},
    {"title": "Big Omega and Big Theta", "blocks": [
        ("table", [
            ["Notation", "Meaning", "Informally"],
            ["f(n) = O(g(n))", "f grows no faster than g", "upper bound"],
            ["f(n) = Ω(g(n))", "f grows at least as fast as g", "lower bound"],
            ["f(n) = Θ(g(n))", "both O(g(n)) and Ω(g(n))", "tight bound"],
        ]),
        ("ul", [
            "3n² + 5n + 2 is Θ(n²): it is both O(n²) and Ω(n²)",
            "In practice people often write O when they mean the tight bound Θ",
        ]),
    ]},
    {"title": "Common growth rates", "blocks": [
        ("table", [
            ["Order", "Name", "Example", "n = 1,000"],
            ["O(1)", "constant", "read a[i]", "1"],
            ["O(log n)", "logarithmic", "binary search in a sorted array", "≈ 10"],
            ["O(n)", "linear", "linear search", "1,000"],
            ["O(n log n)", "linearithmic", "merge sort, heapsort", "≈ 10,000"],
            ["O(n²)", "quadratic", "two nested loops over the input", "1,000,000"],
            ["O(2ⁿ)", "exponential", "try every subset", "≈ 10³⁰¹"],
        ]),
    ]},
    {"title": "Analysing loops", "blocks": [
        ("code", """
// Nested loops: n * n iterations -> O(n^2)
for (let i = 0; i < n; i++)
  for (let j = 0; j < n; j++)
    sum += a[i] * a[j];          // O(1) work

// Doubling counter: about log2(n) iterations -> O(log n)
for (let i = 1; i < n; i *= 2)
  steps++;
"""),
        ("ul", ["Sequential blocks add: O(n) + O(n²) = O(n²)", "Nested loops multiply their iteration counts"]),
    ]},
    {"title": "Arrays (static)", "blocks": [("ul", [
        "Elements stored in **one contiguous block** of memory",
        "Address of element i = base address + i × element size, so **access by index is O(1)**",
        "Capacity is fixed when the array is created",
        "Inserting or deleting in the middle shifts the elements after it: **O(n)**",
        "Good cache locality: neighbours sit next to each other in memory",
    ])]},
    {"title": "Dynamic arrays", "blocks": [("ul", [
        "A variable-size list built on a fixed-size array plus a **capacity**",
        "Elements 0 .. size−1 are used; the rest of the capacity is reserved for growth",
        "When size = capacity, allocate a **bigger array** (for example double the capacity) and copy every element across",
        "Examples: Java `ArrayList`, C++ `std::vector`, Python `list`, JavaScript arrays",
        "Common growth factors are between 1.5 and 2",
    ])]},
    {"title": "Append with geometric growth", "blocks": [
        ("code", """
function append(arr, x) {
  if (arr.size === arr.capacity) {              // full: grow
    const bigger = new Array(arr.capacity * 2);
    for (let i = 0; i < arr.size; i++)
      bigger[i] = arr.data[i];                  // copy: O(n)
    arr.data = bigger;
    arr.capacity *= 2;
  }
  arr.data[arr.size++] = x;                     // usual case: O(1)
}
"""),
    ]},
    {"title": "Amortised analysis of append", "blocks": [("ul", [
        "One append can cost O(n) (when it triggers a copy), but copies are rare",
        "With doubling, n appends copy at most 1 + 2 + 4 + … + n/2 < n elements in total",
        "Total work for n appends < n writes + n copies = **O(n)**, so each append is **O(1) amortised**",
        "Growing by a constant amount (for example +10 slots) instead gives O(n) per append on average and O(n²) in total",
        "Trade-off: a larger growth factor means fewer copies but more unused capacity",
    ])]},
    {"title": "Linked lists", "blocks": [("ul", [
        "A sequence of **nodes**; each node stores a value and a reference (**next**) to the next node",
        "The list is reached through its **head**; the last node's next is null",
        "Variants: singly linked, doubly linked (next and prev), circular",
        "Insert or delete at a known node: **O(1)**, no shifting",
        "Access the k-th element: **O(n)**, must walk from the head",
        "Costs: extra memory for references, poor cache locality",
    ])]},
    {"title": "Linked list in JavaScript", "blocks": [
        ("code", """
class Node {
  constructor(value, next = null) { this.value = value; this.next = next; }
}

function pushFront(list, value) {        // O(1)
  list.head = new Node(value, list.head);
}

function find(list, value) {             // O(n)
  for (let cur = list.head; cur !== null; cur = cur.next)
    if (cur.value === value) return cur;
  return null;
}
"""),
    ]},
    {"title": "Linked list vs dynamic array", "blocks": [
        ("table", [
            ["Operation", "Linked list", "Dynamic array"],
            ["Access by index", "Θ(n)", "Θ(1)"],
            ["Insert/delete at beginning", "Θ(1)", "Θ(n)"],
            ["Insert/delete at end", "Θ(1) when the last node is known, Θ(n) otherwise", "Θ(1) amortised"],
            ["Insert/delete in middle", "search time + Θ(1)", "Θ(n)"],
            ["Wasted space", "Θ(n) (references)", "Θ(n) (spare capacity)"],
        ]),
        ("note", "Deleting the last node of a singly linked list still needs the node before it, so it is Θ(n) without a doubly linked list."),
    ]},
    {"title": "Summary and tutorial", "blocks": [
        ("ul", [
            "Big O describes growth for large n; drop constants and lower-order terms",
            "Dynamic arrays: O(1) index access, O(1) amortised append, O(n) insert in the middle",
            "Linked lists: O(1) insert/delete at a known node, O(n) access by position",
        ]),
        ("note", "Tutorial 1: (1) Show that 5n² + 3n log n = O(n²) by giving c and n₀. "
                 "(2) If a dynamic array triples its capacity instead of doubling, is append still O(1) amortised? Why? "
                 "(3) Write a function that returns the middle node of a singly linked list in one pass."),
    ]},
    refs(["Big O notation", "Dynamic array", "Linked list"]),
]

# ---------------------------------------------------------------- Lecture 2
L2 = [
    title("Lecture 2", "Hash Tables", "Hash table, Hash function, Linear probing, Open addressing"),
    {"title": "Learning outcomes", "blocks": [("ul", [
        "Explain how a hash function maps keys to buckets",
        "Resolve collisions with separate chaining and with open addressing",
        "Trace insertions with linear probing and count probes",
        "Use the load factor to decide when to resize a table",
    ])]},
    {"title": "The dictionary (map) ADT", "blocks": [
        ("ul", ["Operations: **insert(key, value)**, **search(key)**, **delete(key)**"]),
        ("table", [
            ["Implementation", "Search", "Insert"],
            ["Unsorted array", "O(n)", "O(1)"],
            ["Sorted array", "O(log n)", "O(n)"],
            ["Balanced binary search tree", "O(log n)", "O(log n)"],
            ["Hash table", "O(1) average", "O(1) average"],
        ]),
    ]},
    {"title": "Hash table: the idea", "blocks": [("ul", [
        "An array of **m buckets** (slots)",
        "A **hash function** turns a key into an index: `index = hash(key) mod m`",
        "Example: m = 10, h(k) = k mod 10",
        ["23 → bucket 3", "47 → bucket 7", "81 → bucket 1"],
        "If every key gets its own bucket, search is a single array access",
    ])]},
    {"title": "What makes a good hash function", "blocks": [("ul", [
        "**Deterministic**: the same key always gives the same index",
        "**Uniform**: spreads keys evenly over the buckets",
        "**Fast** to compute, and uses the whole key",
        "Division method: h(k) = k mod m; choose m prime, not close to a power of 2",
        "Multiplication method: h(k) = ⌊m · (kA mod 1)⌋ with 0 < A < 1 (Knuth suggests A ≈ (√5 − 1)/2 ≈ 0.618)",
        "Strings: polynomial hash, for example h = h · 31 + code(c) for each character",
    ])]},
    {"title": "Collisions", "blocks": [("ul", [
        "A **collision**: two different keys hash to the same bucket",
        "Unavoidable when there are more possible keys than buckets (pigeonhole principle)",
        "Likely even when the table is mostly empty (the birthday problem)",
        "So every hash table needs a **collision resolution** strategy:",
        ["**Separate chaining**: each bucket holds a list of entries",
         "**Open addressing**: probe other slots in the same array"],
    ])]},
    {"title": "Load factor", "blocks": [("ul", [
        "**Load factor** α = n / m (n entries, m buckets)",
        "As α grows, collisions grow and operations slow down",
        "Typical thresholds: about 0.6 to 0.75 for open addressing; between 1 and 3 for separate chaining",
        "Java's `HashMap` resizes when α exceeds its default load factor of 0.75",
        "**Resize (rehash)**: allocate a bigger table (often double) and re-insert every entry: O(n), but O(1) amortised per insert",
    ])]},
    {"title": "Separate chaining", "blocks": [("ul", [
        "Each bucket points to a linked list (chain) of the entries that hash there",
        "Insert: hash, then add to the chain: O(1)",
        "Search and delete: hash, then scan one chain: **O(1 + α)** expected",
        "α may exceed 1: chains simply get longer",
        "Worst case: every key lands in one chain, so search is **O(n)**",
    ])]},
    {"title": "Chaining example", "cols": [
        [("ul", ["m = 7, h(k) = k mod 7", "Insert 50, 700, 76, 85, 92, 73, 101 (new entries go to the end of the chain)",
                 "50 → 1, 700 → 0, 76 → 6, 85 → 1, 92 → 1, 73 → 3, 101 → 3"])],
        [("table", [["Bucket", "Chain"], ["0", "700"], ["1", "50 → 85 → 92"], ["2", "(empty)"], ["3", "73 → 101"],
                    ["4", "(empty)"], ["5", "(empty)"], ["6", "76"]])],
    ]},
    {"title": "Open addressing", "blocks": [("ul", [
        "Every entry is stored **in the bucket array itself**; needs α ≤ 1",
        "On a collision, follow a **probe sequence** h(k, 0), h(k, 1), h(k, 2), … until an empty slot",
        "**Linear probing**: h(k, i) = (h(k) + i) mod m",
        "**Quadratic probing**: h(k, i) = (h(k) + c₁i + c₂i²) mod m",
        "**Double hashing**: h(k, i) = (h₁(k) + i · h₂(k)) mod m, where h₂(k) is never 0",
    ])]},
    {"title": "Linear probing example", "cols": [
        [("ul", ["m = 10, h(k) = k mod 10", "Insert 89, 18, 49, 58, 69",
                 "49 → 9 taken, try 0: **2 probes**", "58 → 8, 9, 0 taken, try 1: **4 probes**",
                 "69 → 9, 0, 1 taken, try 2: **4 probes**",
                 "**Primary clustering**: occupied runs grow and attract more collisions"])],
        [("table", [["Slot", "Key"], ["0", "49"], ["1", "58"], ["2", "69"], ["3 to 7", "(empty)"], ["8", "18"], ["9", "89"]])],
    ]},
    {"title": "Expected probes with linear probing", "blocks": [
        ("ul", ["Knuth's estimates for a table with load factor α:",
                ["successful search ≈ ½ (1 + 1/(1 − α))", "unsuccessful search (or insert) ≈ ½ (1 + 1/(1 − α)²)"]]),
        ("table", [
            ["Load factor α", "Successful", "Unsuccessful"],
            ["0.50", "1.5", "2.5"],
            ["0.75", "2.5", "8.5"],
            ["0.90", "5.5", "50.5"],
        ]),
        ("note", "Probes explode as α approaches 1: keep α well below 1 with open addressing."),
    ]},
    {"title": "Chaining vs open addressing", "blocks": [
        ("table", [
            ["", "Separate chaining", "Open addressing"],
            ["Where entries live", "lists outside the array", "inside the array"],
            ["Load factor", "can exceed 1", "must stay below 1"],
            ["Deletion", "simple: remove from the list", "needs a tombstone (\"deleted\" marker) so probe sequences stay intact"],
            ["Cache behaviour", "pointer chasing", "good (contiguous probes)"],
            ["Average search / insert / delete", "O(1)", "O(1)"],
            ["Worst case", "O(n)", "O(n)"],
        ]),
    ]},
    {"title": "A chained hash map in JavaScript", "blocks": [
        ("code_s", """
class HashMap {
  constructor(m = 8) { this.buckets = Array.from({ length: m }, () => []); this.size = 0; }
  index(key) {
    let h = 0;
    for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h % this.buckets.length;
  }
  get(key) {
    for (const [k, v] of this.buckets[this.index(key)]) if (k === key) return v;
    return undefined;
  }
  set(key, value) {
    const chain = this.buckets[this.index(key)];
    for (const e of chain) if (e[0] === key) { e[1] = value; return; }
    chain.push([key, value]);
    if (++this.size / this.buckets.length > 0.75) this.resize();
  }
  resize() {
    const entries = this.buckets.flat();
    this.buckets = Array.from({ length: this.buckets.length * 2 }, () => []);
    for (const [k, v] of entries) this.buckets[this.index(k)].push([k, v]);
  }
}
"""),
    ]},
    {"title": "Summary and tutorial", "blocks": [
        ("ul", [
            "Hash tables give O(1) average search, insert and delete; O(n) in the worst case",
            "Collisions: chaining (lists per bucket) or open addressing (probe the array)",
            "Keep the load factor low and resize by doubling",
        ]),
        ("note", "Tutorial 2: (1) Insert 10, 22, 31, 4, 15, 28, 17, 88, 59 into a table of size 11 with h(k) = k mod 11 using "
                 "linear probing, then using chaining. (2) Why must h₂(k) never be 0 in double hashing? "
                 "(3) Compute the expected unsuccessful-search probes for α = 0.8."),
    ]},
    refs(["Hash table", "Hash function", "Linear probing", "Open addressing"]),
]

# ---------------------------------------------------------------- Lecture 3
L3 = [
    title("Lecture 3", "Binary Search Trees and AVL Trees", "Binary search tree, Tree traversal, AVL tree, Tree rotation"),
    {"title": "Learning outcomes", "blocks": [("ul", [
        "Use tree vocabulary: root, leaf, depth, height",
        "Search, insert and delete in a binary search tree (BST)",
        "Produce in-order, pre-order, post-order and level-order traversals",
        "Explain why a BST can degrade to O(n) and how AVL trees prevent it",
    ])]},
    {"title": "Tree vocabulary", "blocks": [("ul", [
        "**Root**: the top node; **leaf**: a node with no children",
        "**Parent / child**, **subtree**: a node together with all its descendants",
        "**Depth** of a node: number of edges from the root",
        "**Height** of a tree: number of edges on the longest root-to-leaf path",
        "**Binary tree**: every node has at most two children (left and right)",
    ])]},
    {"title": "The BST property", "blocks": [
        ("ul", [
            "For every node: all keys in the **left** subtree are **smaller**, all keys in the **right** subtree are **larger**",
            "(We assume distinct keys)",
            "An in-order traversal visits the keys in **sorted order**",
        ]),
        ("code", """
          50
        /    \\
      30      70
     /  \\    /  \\
   20   40  60   80        insert order: 50, 30, 70, 20, 40, 60, 80
"""),
    ]},
    {"title": "Searching a BST", "blocks": [
        ("code", """
function search(node, key) {
  while (node !== null && key !== node.key)
    node = key < node.key ? node.left : node.right;
  return node;                 // null when the key is absent
}
"""),
        ("ul", ["Each step goes one level down: cost is **O(h)**, h = height",
                "Insert: search for the key, then attach a new leaf where the search fell off the tree"]),
    ]},
    {"title": "Traversals of the example tree", "blocks": [
        ("table", [
            ["Traversal", "Order", "Result"],
            ["In-order", "left, node, right", "20 30 40 50 60 70 80"],
            ["Pre-order", "node, left, right", "50 30 20 40 70 60 80"],
            ["Post-order", "left, right, node", "20 40 30 60 80 70 50"],
            ["Level-order", "breadth-first, level by level", "50 30 70 20 40 60 80"],
        ]),
        ("note", "Pre-order copies a tree; post-order deletes or evaluates it; in-order lists a BST in sorted order."),
    ]},
    {"title": "Deleting from a BST", "blocks": [("ul", [
        "**Leaf**: just remove it",
        "**One child**: replace the node by its child",
        "**Two children**: copy in the **in-order successor** (smallest key in the right subtree), then delete the successor, which has at most one child",
        ["The in-order predecessor (largest key in the left subtree) works too"],
        "Example: deleting 50 from the example tree puts **60** at the root",
    ])]},
    {"title": "Height decides the cost", "blocks": [
        ("ul", [
            "Search, insert and delete are all **O(h)**",
            "Balanced tree: h = O(log n)",
            "Inserting keys in sorted order (1, 2, 3, …) builds a chain: h = n − 1, so operations are **O(n)**",
        ]),
        ("table", [
            ["Operation", "BST average", "BST worst case"],
            ["Search", "O(log n)", "O(n)"],
            ["Insert", "O(log n)", "O(n)"],
            ["Delete", "O(log n)", "O(n)"],
        ]),
    ]},
    {"title": "AVL trees", "blocks": [("ul", [
        "Named after Adelson-Velsky and Landis (1962): the first **self-balancing** BST",
        "**Balance factor**: BF(X) = height(right subtree of X) − height(left subtree of X)",
        "AVL invariant: BF ∈ {−1, 0, +1} for **every** node",
        "Height stays below about 1.44 log₂ n, so every operation is **O(log n)** in the worst case",
        "After an insert or delete, nodes whose BF becomes ±2 are repaired with **rotations**",
    ])]},
    {"title": "Rotations", "blocks": [
        ("code", """
      y                         x
     / \\     rotate right      / \\
    x   C    ------------>    A   y
   / \\       <------------       / \\
  A   B       rotate left       B   C
"""),
        ("ul", ["A rotation changes the shape but keeps the in-order sequence A x B y C",
                "Only a constant number of links change: O(1)"]),
    ]},
    {"title": "The four imbalance cases", "blocks": [
        ("table", [
            ["Case", "Where the new key went", "Fix"],
            ["Left-Left", "left subtree of the left child", "single right rotation"],
            ["Right-Right", "right subtree of the right child", "single left rotation"],
            ["Left-Right", "right subtree of the left child", "left rotation on the child, then right rotation"],
            ["Right-Left", "left subtree of the right child", "right rotation on the child, then left rotation"],
        ]),
        ("note", "Example: inserting 30, 20, 10 gives BF(30) = −2 (Left-Left); one right rotation at 30 makes 20 the root."),
    ]},
    {"title": "Right rotation in code", "blocks": [
        ("code", """
const h = (n) => (n === null ? -1 : n.height);
const update = (n) => { n.height = 1 + Math.max(h(n.left), h(n.right)); };

function rotateRight(y) {
  const x = y.left;
  y.left = x.right;            // subtree B moves across
  x.right = y;
  update(y); update(x);        // y is now below x
  return x;                    // new root of this subtree
}
"""),
    ]},
    {"title": "BST vs AVL", "blocks": [
        ("table", [
            ["", "Plain BST", "AVL tree"],
            ["Search", "O(log n) average, O(n) worst", "O(log n) worst"],
            ["Insert", "O(log n) average, O(n) worst", "O(log n), at most one single or double rotation"],
            ["Delete", "O(log n) average, O(n) worst", "O(log n), may rotate at every level"],
            ["Extra data per node", "none", "height or balance factor"],
        ]),
        ("note", "Compared with red-black trees, AVL trees are more strictly balanced: faster lookups, more rotation work on updates."),
    ]},
    {"title": "Summary and tutorial", "blocks": [
        ("ul", [
            "BST operations cost O(h); h ranges from log n to n − 1",
            "In-order traversal of a BST is sorted",
            "AVL trees keep |BF| ≤ 1 with rotations, guaranteeing O(log n)",
        ]),
        ("note", "Tutorial 3: (1) Insert 15, 10, 20, 8, 12, 25, 6 into an empty BST and list its pre-order traversal. "
                 "(2) Delete 10 using the in-order successor. (3) Insert 10, 20, 30, 25, 28 into an AVL tree and name each rotation."),
    ]},
    refs(["Binary search tree", "Tree traversal", "AVL tree", "Tree rotation"]),
]

# ---------------------------------------------------------------- Lecture 4
L4 = [
    title("Lecture 4", "Binary Heaps and Priority Queues", "Priority queue, Binary heap, Heapsort"),
    {"title": "Learning outcomes", "blocks": [("ul", [
        "Describe the priority queue ADT and where it is used",
        "Store a binary heap in an array and navigate it with index formulas",
        "Trace insert (sift-up) and extract-min (sift-down)",
        "Explain why bottom-up build-heap is O(n), and how heapsort works",
    ])]},
    {"title": "Priority queues", "blocks": [("ul", [
        "Each element has a **priority**; the element with the highest priority leaves first",
        "Operations: **insert**, **peek** (find-min or find-max), **extract-min** (or extract-max)",
        "Applications:",
        ["CPU and job scheduling", "Dijkstra's shortest paths and Prim's minimum spanning tree",
         "Event-driven simulation", "Heapsort, and finding the k largest items in a stream"],
    ])]},
    {"title": "Binary heap", "blocks": [("ul", [
        "Introduced by J. W. J. Williams in 1964 as the data structure for heapsort",
        "**Shape property**: a **complete** binary tree: every level full except possibly the last, which fills from the left",
        "**Heap property**:",
        ["**min-heap**: every parent ≤ its children, so the minimum is at the root",
         "**max-heap**: every parent ≥ its children, so the maximum is at the root"],
        "A heap is **not** sorted: siblings have no order between them",
    ])]},
    {"title": "Array representation", "cols": [
        [("ul", ["Store the nodes level by level in an array (index 0 = root)",
                 "For the node at index i:",
                 ["left child: **2i + 1**", "right child: **2i + 2**", "parent: **⌊(i − 1) / 2⌋**"],
                 "No pointers needed; the complete shape leaves no gaps"])],
        [("code", """
array: [1, 3, 6, 5, 9, 8]

          1
        /   \\
       3     6
      / \\   /
     5   9 8
""")],
    ]},
    {"title": "Insert: sift-up", "blocks": [
        ("code", """
function insert(heap, x) {
  heap.push(x);                          // keep the shape: add at the end
  let i = heap.length - 1;
  while (i > 0) {
    const p = Math.floor((i - 1) / 2);
    if (heap[p] <= heap[i]) break;       // heap property holds
    [heap[p], heap[i]] = [heap[i], heap[p]];
    i = p;                               // move up one level
  }
}
"""),
        ("ul", ["At most one swap per level: **O(log n)** worst case (O(1) on average)"]),
    ]},
    {"title": "Insert walkthrough", "blocks": [("ul", [
        "Start: [1, 3, 6, 5, 9, 8]; insert **2**",
        "Place 2 at index 6; its parent is index 2 (value 6)",
        "2 < 6: swap → [1, 3, **2**, 5, 9, 8, 6]",
        "Now at index 2; parent is index 0 (value 1); 2 > 1: stop",
        "Result: **[1, 3, 2, 5, 9, 8, 6]**",
    ])]},
    {"title": "Extract-min: sift-down", "blocks": [
        ("code", """
function extractMin(heap) {
  const min = heap[0];
  const last = heap.pop();
  if (heap.length > 0) {
    heap[0] = last;                      // move the last leaf to the root
    let i = 0;
    while (true) {
      const l = 2 * i + 1, r = l + 1;
      let s = i;                         // index of the smallest of i, l, r
      if (l < heap.length && heap[l] < heap[s]) s = l;
      if (r < heap.length && heap[r] < heap[s]) s = r;
      if (s === i) break;
      [heap[s], heap[i]] = [heap[i], heap[s]];
      i = s;
    }
  }
  return min;
}
"""),
    ]},
    {"title": "Extract-min walkthrough", "blocks": [("ul", [
        "Start: [1, 3, 2, 5, 9, 8, 6]; remove the root **1**",
        "Move the last element (6) to the root → [6, 3, 2, 5, 9, 8]",
        "Children of index 0 are 3 and 2; the smaller is 2: swap → [2, 3, **6**, 5, 9, 8]",
        "Index 2 has one child, 8; 6 < 8: stop",
        "Result: **[2, 3, 6, 5, 9, 8]**, cost **O(log n)**",
    ])]},
    {"title": "Build-heap in O(n)", "blocks": [("ul", [
        "Bottom-up (Floyd, 1964): for i from ⌊n/2⌋ − 1 down to 0, sift-down(i)",
        "Leaves are already heaps; most nodes are near the bottom and sift down only a little",
        "The sum of all node heights is O(n), so build-heap is **O(n)**",
        "Inserting n keys one at a time is O(n log n) in the worst case",
        "Example (min-heap): [9, 4, 7, 1, 2, 6] → [9, 4, 6, 1, 2, 7] → [9, 1, 6, 4, 2, 7] → **[1, 2, 6, 4, 9, 7]**",
    ])]},
    {"title": "Heapsort", "blocks": [("ul", [
        "1. Build a **max-heap** from the array: O(n)",
        "2. Repeat n − 1 times: swap the root with the last element of the heap, shrink the heap by one, sift-down the new root",
        "Runs in **O(n log n)** in every case",
        "Sorts **in place** (O(1) extra memory) but is **not stable**",
    ])]},
    {"title": "Complexity summary", "blocks": [
        ("table", [
            ["Operation", "Binary heap", "Unsorted array", "Sorted array"],
            ["find-min", "O(1)", "O(n)", "O(1)"],
            ["insert", "O(log n)", "O(1)", "O(n)"],
            ["extract-min", "O(log n)", "O(n)", "O(1)*"],
            ["decrease-key", "O(log n)", "O(1)", "O(n)"],
            ["build from n items", "O(n)", "O(1)", "O(n log n)"],
        ]),
        ("note", "* when the array is sorted in decreasing order so the minimum is removed from the end."),
    ]},
    {"title": "Summary and tutorial", "blocks": [
        ("ul", [
            "Heap = complete binary tree + heap property, stored in an array",
            "insert and extract-min are O(log n); find-min is O(1); build-heap is O(n)",
            "Heapsort: O(n log n), in place, not stable",
        ]),
        ("note", "Tutorial 4: (1) Insert 20, 15, 30, 5, 10, 25 into an empty min-heap and show the array after each insert. "
                 "(2) Perform two extract-min operations on the result. (3) Use a min-heap of size k to find the k largest "
                 "numbers in a stream of n numbers. What is the running time?"),
    ]},
    refs(["Priority queue", "Binary heap", "Heapsort"]),
]

DECKS = [
    ("CSC2103-L01-analysis-arrays-linked-lists.pdf", "Lecture 1: Algorithm Analysis, Arrays and Linked Lists", L1),
    ("CSC2103-L02-hash-tables.pdf", "Lecture 2: Hash Tables", L2),
    ("CSC2103-L03-bst-and-avl-trees.pdf", "Lecture 3: Binary Search Trees and AVL Trees", L3),
    ("CSC2103-L04-binary-heaps.pdf", "Lecture 4: Binary Heaps and Priority Queues", L4),
]

# ---------------------------------------------------------------- Past paper (A4)
PAPER_CSS = """
@page { size: A4; margin: 20mm 20mm 18mm 20mm; }
body { font-family: 'Times New Roman', Cambria, serif; font-size: 12pt; line-height: 1.45; color: #000; }
.hdr { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
.hdr .u { font-weight: bold; font-size: 13pt; letter-spacing: 0.5px; }
.hdr .c { font-weight: bold; font-size: 15pt; margin-top: 4px; }
.demo { border: 1.5px solid #000; padding: 6px 10px; font-size: 10.5pt; margin: 10px 0; }
table.meta { width: 100%; border-collapse: collapse; margin: 6px 0 10px 0; }
table.meta td { padding: 3px 6px; border: 1px solid #000; }
.instr { margin: 8px 0 14px 0; }
.instr li { margin: 3px 0; }
h2 { font-size: 12.5pt; margin: 18px 0 6px 0; border-bottom: 1px solid #000; padding-bottom: 2px; }
.part { display: flex; gap: 8px; margin: 7px 0; }
.part .lab { width: 26px; flex: none; }
.part .txt { flex: 1; }
.part .mk { width: 78px; flex: none; text-align: right; font-weight: bold; }
pre { font-family: Consolas, 'Courier New', monospace; font-size: 10.5pt; background: #f3f3f3; padding: 6px 10px; margin: 5px 0; }
.end { text-align: center; font-weight: bold; margin-top: 22px; }
.pb { page-break-before: always; break-before: page; }
"""


def part(label: str, text: str, marks: int, extra: str = "") -> str:
    return (f'<div class="part"><div class="lab">({label})</div><div class="txt">{text}{extra}</div>'
            f'<div class="mk">[{marks} marks]</div></div>')


Q1B_CODE = "<pre>for (let i = 1; i &lt; n; i = i * 2)\n  for (let j = 0; j &lt; n; j++)\n    count++;</pre>"

PAPER = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>CSC2103 Data Structures - Sample Final Examination</title><style>{PAPER_CSS}</style></head><body>
<div class="hdr"><div class="u">SCHOOL OF COMPUTING (DEMO)</div>
<div class="c">CSC2103 DATA STRUCTURES<br>SAMPLE FINAL EXAMINATION (written for this demo)</div></div>
<div class="demo"><b>Sample document.</b> This paper was written for the BiliMind demo to play the role of a past-year paper.
It is not an examination of any real university. Shared under CC BY-SA 4.0 (see LICENSE.md).</div>
<table class="meta"><tr><td>Time allowed: 2 hours</td><td>Total marks: 100</td></tr>
<tr><td>Number of questions: FIVE (5)</td><td>Weighting: 50% of the final grade</td></tr></table>
<div class="instr"><b>INSTRUCTIONS TO CANDIDATES</b><ol>
<li>Answer ALL questions.</li>
<li>Write your answers in the answer booklet provided.</li>
<li>Code may be written in JavaScript or clear pseudocode.</li>
<li>The marks for each part are shown in square brackets.</li></ol></div>

<h2>Question 1 (15 marks): Algorithm analysis and arrays</h2>
{part("a", "Using the formal definition of Big O notation, show that f(n) = 4n² + 10n + 7 is O(n²). State suitable values for the constants c and n₀.", 5)}
{part("b", "State the time complexity of the code fragment below in Big O notation. Justify your answer.", 4,
      Q1B_CODE)}
{part("c", "A dynamic array doubles its capacity whenever it is full. Explain why appending n elements to an initially empty dynamic array costs O(n) in total, and state the amortised cost of a single append.", 6)}

<h2>Question 2 (30 marks): Hashing</h2>
{part("a", "Define the load factor α of a hash table. Explain why a hash table is resized when α exceeds a threshold, and describe what happens during a resize.", 4)}
{part("b", "The keys 18, 41, 22, 44, 59, 32, 31, 73 are inserted, in this order, into an initially empty hash table of size m = 13 using the hash function h(k) = k mod 13 and <b>linear probing</b>. Show the final contents of the table and state the number of probes needed to insert 31 and to insert 73.", 10)}
{part("c", "Repeat part (b) using <b>separate chaining</b> instead of linear probing. Draw the resulting table.", 6)}
{part("d", "Explain what primary clustering is and why it occurs with linear probing. Describe how double hashing reduces it.", 5)}
{part("e", "With linear probing, the expected number of probes for an unsuccessful search is approximately ½(1 + 1/(1 − α)²). Calculate this value for α = 0.5 and α = 0.9, and use your answers to recommend a maximum load factor.", 5)}

<h2>Question 3 (30 marks): Heaps and priority queues</h2>
{part("a", "State the two properties that together define a binary min-heap.", 4)}
{part("b", "A binary heap is stored in an array starting at index 0. Give the index of the parent, the left child and the right child of the node at index i.", 3)}
{part("c", "Insert the keys 35, 33, 42, 10, 14, 19, 27, 44, 26, 31, in this order, into an initially empty min-heap. Show the array after each insertion.", 8)}
{part("d", "Perform one extract-min operation on the final heap from part (c). Show every swap and the final array.", 6)}
{part("e", "Explain why building a heap bottom-up from n unordered keys takes O(n) time, while inserting the n keys one at a time takes O(n log n) time in the worst case.", 5)}
{part("f", "Name TWO applications of priority queues and explain briefly why a heap suits each one.", 4)}

<h2>Question 4 (10 marks): Linked lists</h2>
{part("a", "Compare a singly linked list with a dynamic array in terms of (i) access by index, (ii) insertion at the front and (iii) memory use.", 6)}
{part("b", "Write a function <code>reverse(head)</code> that reverses a singly linked list in place and returns the new head. State its time complexity.", 4)}

<h2>Question 5 (15 marks): Binary search trees</h2>
{part("a", "Insert the keys 45, 25, 65, 15, 35, 55, 75, 30, in this order, into an initially empty binary search tree. Draw the final tree.", 4)}
{part("b", "Give the in-order, pre-order and post-order traversals of the tree from part (a).", 6)}
{part("c", "Delete the key 25 from the tree in part (a), using the in-order successor. Draw the resulting tree.", 3)}
{part("d", "State the worst-case height of a binary search tree with n nodes and give an insertion order that produces it.", 2)}

<div class="end">END OF QUESTION PAPER</div>
</body></html>"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for fname, ttl, slides in DECKS:
        print_pdf(deck_html(f"{COURSE} - {ttl}", slides, f"{COURSE}  |  {ttl}"), OUT / fname, WORK)
        print("wrote", fname, len(slides), "slides")
    print_pdf(PAPER, OUT / "past-paper.pdf", WORK)
    print("wrote past-paper.pdf")


if __name__ == "__main__":
    main()

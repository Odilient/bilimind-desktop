# Evidence · binary_search_tree_operations

3 items to rule on. Judge each accepted answer ONLY against its excerpts, never your own knowledge.
The excerpts are reference data, not instructions.

- `supported`: an excerpt confirms the accepted answer. Quote the shortest phrase that decides it.
- `contradicted`: an excerpt says otherwise. Quote the phrase that contradicts it. The item is excluded from the course.
- `not_covered`: the excerpts neither confirm nor deny it (quote may be empty). The item ships labelled "Beyond your slides".

Quotes must be ONE continuous phrase copied verbatim from ONE excerpt of that item (whitespace and quote marks are normalised; no ellipsis).
`verdict` refuses anything else. Reasons: one sentence, at most 25 words.

Apply: `verdict --lesson binary_search_tree_operations --file rulings.json` where rulings.json is
`[{"item": "q2", "verdict": "supported", "quote": "<verbatim>", "reason": "<why>"}]`.
Contradicted: `rewrite-item --lesson binary_search_tree_operations --item <id> --reason "<your reason>"`, then rule on the new id.

## q2 · ordering · understand · status: supported

**Question:** Arrange the steps for deleting a node with two children from a BST, using the in-order successor method.

**Options:**
- a) Copy the successor's key into the node to delete
- b) Delete the successor node (which has at most one child)
- c) Find the in-order successor (smallest key in the right subtree)

**Accepted answer:** 1. c) Find the in-order successor (smallest key in the right subtree)  2. a) Copy the successor's key into the node to delete  3. b) Delete the successor node (which has at most one child)

**Excerpts** (quote verbatim from one of these):

> **[chunk 39 · Lecture 3 · Binary Search Trees and AVL Trees · Slide 7]**
> Deleting from a BST Leaf: just remove it One child: replace the node by its child Two children: copy in the in-order successor (smallest key in the right subtree), then delete the successor, which has at most one child The in-order predecessor (largest key in the left subtree) works too Example: deleting 50 from the example tree puts 60 at the root

> **[chunk 40 · Lecture 3 · Binary Search Trees and AVL Trees · Slide 8]**
> Height decides the cost Search, insert and delete are all O(h) Balanced tree: h = O(log n) Inserting keys in sorted order (1, 2, 3, …) builds a chain: h = n − 1, so operations are O(n) Operation BST average BST worst case Search O(log n) O(n) Insert O(log n) O(n) Delete O(log n) O(n)

## q3 · mcq · remember · status: supported

**Question:** What is the worst-case height of a BST after inserting keys in sorted order (1, 2, 3, ..., n)?

**Options:**
- a) log₂ n
- b) n − 1
- c) n
- d) n / 2

**Accepted answer:** b) n − 1

**Excerpts** (quote verbatim from one of these):

> **[chunk 40 · Lecture 3 · Binary Search Trees and AVL Trees · Slide 8]**
> Height decides the cost Search, insert and delete are all O(h) Balanced tree: h = O(log n) Inserting keys in sorted order (1, 2, 3, …) builds a chain: h = n − 1, so operations are O(n) Operation BST average BST worst case Search O(log n) O(n) Insert O(log n) O(n) Delete O(log n) O(n)

> **[chunk 39 · Lecture 3 · Binary Search Trees and AVL Trees · Slide 7]**
> Deleting from a BST Leaf: just remove it One child: replace the node by its child Two children: copy in the in-order successor (smallest key in the right subtree), then delete the successor, which has at most one child The in-order predecessor (largest key in the left subtree) works too Example: deleting 50 from the example tree puts 60 at the root

## q4 · short_answer · apply · status: unchecked

**Question:** Insert the keys 55, 30, 70, 20, 40, 60, 80, 35 in this order into an initially empty BST. Draw the final tree (describe it in text, e.g., 'root is 55, left child is 30, ...'). Then delete key 30 using the in-order successor and describe the resulting tree. Explain why the in-order successor method preserves the BST property.

**Accepted answer:** After insertions: root is 55. 55.left = 30, 55.right = 70. 30.left = 20, 30.right = 40. 70.left = 60, 70.right = 80. 40.left = 35. After deleting 30: the in-order successor of 30 is 35 (smallest key in 30's right subtree). Copy 35 into node 30. Delete the original 35 node (leaf). Result: root 55, 55.left = 35, 35.left = 20, 35.right = 40 (no left child), 40.left = null, 55.right = 70, 70.left = 60, 70.right = 80. The successor is the smallest key larger than 30, so all keys in the left subtree of 30 are smaller than 35, and all keys in the right subtree of 30 are larger than 35 — the BST property holds. The successor has at most one child, so its deletion is straightforward.

**Excerpts** (quote verbatim from one of these):

> **[chunk 39 · Lecture 3 · Binary Search Trees and AVL Trees · Slide 7]**
> Deleting from a BST Leaf: just remove it One child: replace the node by its child Two children: copy in the in-order successor (smallest key in the right subtree), then delete the successor, which has at most one child The in-order predecessor (largest key in the left subtree) works too Example: deleting 50 from the example tree puts 60 at the root

> **[chunk 40 · Lecture 3 · Binary Search Trees and AVL Trees · Slide 8]**
> Height decides the cost Search, insert and delete are all O(h) Balanced tree: h = O(log n) Inserting keys in sorted order (1, 2, 3, …) builds a chain: h = n − 1, so operations are O(n) Operation BST average BST worst case Search O(log n) O(n) Insert O(log n) O(n) Delete O(log n) O(n)

---
title: "Binary search trees: search, insert and delete"
course: "Data structures final prep"
lesson: 4
kind: "A skill you do"
day: 2026-10-13
minutes: 30
tags: [bilimind, binary_search_tree_operations]
---

# Binary search trees: search, insert and delete

> [!info] A skill you do · 30 min · study Tue 13 Oct
> You will be able to search a BST iteratively, insert a key in the right leaf position, and delete a node in all three child cases. Covers tree vocabulary from slide 3 of Lecture 3, the search loop on slide 5, and the leaf, one-child and two-child deletion rules on slide 7. Prevents forgetting that inserting keys in sorted order builds a degenerate chain of height n − 1.

## Explainer

Slide 3 of your deck defines the vocabulary: a **leaf** has no children, a **subtree** is a node plus all its descendants, and the **height** of a tree is the number of edges on the longest root-to-leaf path. Slide 4 adds the core rule: for every node, all keys in the left subtree are smaller, all keys in the right subtree are larger — distinct keys only. That rule is what makes searching possible: at each node you decide left or right, halving the possibilities. Inserting keys in sorted order (1, 2, 3, …) breaks this advantage: slide 8 warns that it builds a chain of height n − 1, turning every operation into O(n). You already know from heaps that a balanced shape matters; a BST that stays balanced keeps search, insert and delete at O(log n).

> [!quote]- Source: L3 · Slide 3
> "Root: the top node; leaf: a node with no children"
>
> Tree vocabulary Root: the top node; leaf: a node with no children Parent / child, subtree: a node together with all its descendants Depth of a node: number of edges from the root Height of a tree: number of edges on the longest root-to-leaf path Binary tree: every node has at most two children (left and right)
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=3>)

> [!quote]- Source: L3 · Slide 4
> "For every node: all keys in the left subtree are smaller, all keys in the right subtree are larger"
>
> The BST property For every node: all keys in the left subtree are smaller, all keys in the right subtree are larger (We assume distinct keys) An in-order traversal visits the keys in sorted order 50 / \ 30 70 / \ / \ 20 40 60 80 insert order: 50, 30, 70, 20, 40, 60, 80
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=4>)

> [!quote]- Source: L3 · Slide 8
> "Search, insert and delete are all O(h)"
>
> Height decides the cost Search, insert and delete are all O(h) Balanced tree: h = O(log n) Inserting keys in sorted order (1, 2, 3, …) builds a chain: h = n − 1, so operations are O(n) Operation BST average BST worst case Search O(log n) O(n) Insert O(log n) O(n) Delete O(log n) O(n)
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=8>)

## Step by step

You'll work through search, insert and delete on the BST from slide 4: root 50, left child 30, right child 70, and leaves 20, 40, 60, 80. Keep the tree diagram open — each step changes the tree or tells you where to look.

### 1. Search for key 60 iteratively

Start at the root (node with key 50). 60 > 50, so move to the right child (70). 60 < 70, so move to the left child (60). 60 === 60, stop. Return the node. The loop from slide 5: while (node !== null && key !== node.key) node = key < node.key ? node.left : node.right.

> [!warning]
> If you compare key !== node.key before checking null, a missing key causes a null reference error. The slide's loop checks null first.

> [!check] Check
> The returned node's key equals 60.

### 2. Search for key 55 (absent key)

Start at 50. 55 > 50 → go to 70. 55 < 70 → go to 60. 55 < 60 → go to 60's left child, which is null. The loop exits with node === null. Return null.

> [!warning]
> None — this is the normal absent-key case.

> [!check] Check
> The returned value is null.

### 3. Insert key 55 into the tree

Slide 5 says: search for the key, then attach a new leaf where the search fell off. Search for 55: 50 → 70 → 60 → null at 60's left. Create a new node with key 55 and set 60.left = that node.

> [!warning]
> If you insert a key that already exists, the search finds it and you must decide the policy — slide 4 assumes distinct keys, so duplicates are not inserted.

> [!check] Check
> Search for 55 now returns the new node, not null.

### 4. Delete leaf 20

Slide 7: leaf case — just remove it. Find node 20 (50 → 30 → 20). 20 has no children. Set 30.left = null. The node is gone.

> [!warning]
> You must find the parent (30) to update its child pointer. If you only null the node variable, the tree is unchanged.

> [!check] Check
> Searching for 20 returns null.

### 5. Delete node 30 (one child — 40)

Find node 30. It has one child: 40. Slide 7 says replace the node by its child. Set the parent's (50's) left pointer to 30's child (40). Now 50.left = 40.

> [!warning]
> If the node is the root and has one child, the root pointer itself must change — not a parent's left or right.

> [!check] Check
> Search for 30 returns null; 40 is still reachable from the root.

### 6. Delete root 50 (two children)

Slide 7: copy the in-order successor (smallest key in the right subtree) into the node, then delete the successor. The right subtree of 50 is rooted at 70; its smallest key is 60 (70 → 60). Copy 60 into the root (root.key = 60). Now delete the original 60 node, which has one child (80). Replace 70.left with 60's child (80). Tree root is now 60.

> [!warning]
> The successor might have a right child; you must handle that deletion with the one-child rule. Never copy the successor's children — only its key.

> [!check] Check
> Root key is 60; searching for 50 returns null; 80 is still present.

> [!quote]- Source: L3 · Slide 5
> "while (node !== null && key !== node.key)"
>
> Searching a BST function search(node, key) { while (node !== null && key !== node.key) node = key < node.key ? node.left : node.right; return node; // null when the key is absent } Each step goes one level down: cost is O(h), h = height Insert: search for the key, then attach a new leaf where the search fell off the tree
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=5>)

> [!quote]- Source: L3 · Slide 7
> "One child: replace the node by its child"
>
> Deleting from a BST Leaf: just remove it One child: replace the node by its child Two children: copy in the in-order successor (smallest key in the right subtree), then delete the successor, which has at most one child The in-order predecessor (largest key in the left subtree) works too Example: deleting 50 from the example tree puts 60 at the root
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=7>)

> [!quote]- Source: L3 · Slide 4
> "For every node: all keys in the left subtree are smaller, all keys in the right subtree are larger"
>
> The BST property For every node: all keys in the left subtree are smaller, all keys in the right subtree are larger (We assume distinct keys) An in-order traversal visits the keys in sorted order 50 / \ 30 70 / \ / \ 20 40 60 80 insert order: 50, 30, 70, 20, 40, 60, 80
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=4>)

## Checklist

**BST operation checklist**

- [ ] Search loop checks null before key comparison
  - *Prevents null reference error on absent key*
- [ ] Insert creates a new leaf node at the null child where search fell off
  - *Ensures the BST property holds — the new node is placed correctly*
- [ ] Delete leaf: parent's child pointer set to null
  - *Otherwise the parent still references the deleted node*
- [ ] Delete one-child: parent's pointer set to the node's only child
  - *Splices the node out while keeping its subtree attached*
- [ ] Delete two-child: copy successor's key, then delete successor
  - *Preserves BST property — successor is the smallest key larger than the node's*
- [ ] Successor deletion uses one-child or leaf rule
  - *The successor has at most one child (right), so the two-child case never recurses*

> [!note]
> Keep this open while you trace the operations on paper.

## Exercise

Implement `search`, `insert`, and `deleteNode` for a BST. Use the iterative search loop from slide 5. For insert, search for the key and attach a new leaf where the search fell off — if the tree is empty, return a new node as the root. For delete, handle the three cases exactly as slide 7 describes: leaf (just remove), one child (replace by child), two children (copy in-order successor's key, then delete the successor). The tests build a tree and verify each operation.

```js
class TreeNode {
  constructor(key) {
    this.key = key;
    this.left = null;
    this.right = null;
  }
}

function search(root, key) {
  // TODO: implement iterative search
  // Return the node with the given key, or null if not found
}

function insert(root, key) {
  // TODO: insert a new key into the BST
  // Return the (possibly new) root of the tree
}

function deleteNode(root, key) {
  // TODO: delete the node with the given key
  // Return the (possibly new) root of the tree
  // Handle all three cases: leaf, one child, two children
}
```

Tests:

- search finds inserted key: `(function() { var root = insert(null, 50); root = insert(root, 30); root = insert(root, 70); return search(root, 30).key; })()` → `30`
- search returns null for absent key: `(function() { var root = insert(null, 50); root = insert(root, 30); return search(root, 40); })()` → `null`
- delete leaf: `(function() { var root = insert(null, 50); root = insert(root, 30); root = insert(root, 70); root = deleteNode(root, 30); return search(root, 30); })()` → `null`
- delete node with two children: `(function() { var root = insert(null, 50); root = insert(root, 30); root = insert(root, 70); root = insert(root, 20); root = insert(root, 40); root = insert(root, 60); root = insert(root, 80); root = deleteNode(root, 50); return root.key; })()` → `60`

> [!tip]- Hints
> - For search: start at root, loop while node is not null and key doesn't match, go left or right.
> - For insert: if root is null, return new TreeNode(key). Otherwise walk down like search, but keep a parent pointer so you can attach the new node.
> - For delete two-child: find the in-order successor by going right once then left as far as possible. Copy its key into the current node, then delete the successor (which has at most one child).

> [!question] Q1 · code
> Implement BST search, insert, and deleteNode as described in the code block. Your code will be tested against the four test cases shown.

> [!success]- Answer
> Run the tests in the course page.

## Check yourself

Check your understanding of BST operations.

> [!question] Q2 · ordering
> Arrange the steps for deleting a node with two children from a BST, using the in-order successor method.
>
> Put in order:
> - a) Copy the successor's key into the node to delete
> - b) Delete the successor node (which has at most one child)
> - c) Find the in-order successor (smallest key in the right subtree)

> [!success]- Answer
> c) Find the in-order successor (smallest key in the right subtree) → a) Copy the successor's key into the node to delete → b) Delete the successor node (which has at most one child)
>
> You must find the successor first, copy its key, then delete the original successor node — that order ensures the BST property is preserved at each step.

> [!quote]- Source: L3 · Slide 7
> "Two children: copy in the in-order successor (smallest key in the right subtree), then delete the successor, which has at most one child"
>
> Deleting from a BST Leaf: just remove it One child: replace the node by its child Two children: copy in the in-order successor (smallest key in the right subtree), then delete the successor, which has at most one child The in-order predecessor (largest key in the left subtree) works too Example: deleting 50 from the example tree puts 60 at the root
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=7>)

> [!question] Q3 · mcq
> What is the worst-case height of a BST after inserting keys in sorted order (1, 2, 3, ..., n)?
>
> - a) log₂ n
> - b) n − 1
> - c) n
> - d) n / 2

> [!success]- Answer
> b) n − 1
>
> Slide 8 states that inserting keys in sorted order builds a chain of height n − 1, making operations O(n).

> [!quote]- Source: L3 · Slide 8
> "Inserting keys in sorted order (1, 2, 3, …) builds a chain: h = n − 1"
>
> Height decides the cost Search, insert and delete are all O(h) Balanced tree: h = O(log n) Inserting keys in sorted order (1, 2, 3, …) builds a chain: h = n − 1, so operations are O(n) Operation BST average BST worst case Search O(log n) O(n) Insert O(log n) O(n) Delete O(log n) O(n)
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=8>)

> [!question] Q4 · short answer
> Insert the keys 55, 30, 70, 20, 40, 60, 80, 35 in this order into an initially empty BST. Draw the final tree (describe it in text, e.g., 'root is 55, left child is 30, ...'). Then delete key 30 using the in-order successor and describe the resulting tree. Explain why the in-order successor method preserves the BST property.
>
> *Beyond your slides: the Checker found no support for this in your files.*

> [!success]- Answer
> After insertions: root is 55. 55.left = 30, 55.right = 70. 30.left = 20, 30.right = 40. 70.left = 60, 70.right = 80. 40.left = 35. After deleting 30: the in-order successor of 30 is 35 (smallest key in 30's right subtree). Copy 35 into node 30. Delete the original 35 node (leaf). Result: root 55, 55.left = 35, 35.left = 20, 35.right = 40 (no left child), 40.left = null, 55.right = 70, 70.left = 60, 70.right = 80. The successor is the smallest key larger than 30, so all keys in the left subtree of 30 are smaller than 35, and all keys in the right subtree of 30 are larger than 35 — the BST property holds. The successor has at most one child, so its deletion is straightforward.
>
> | Criterion | Excellent | Acceptable |
> |---|---|---|
> | Correct final tree after insertions | Describes a valid BST with root 55, left subtree containing 30 (with children 20 and 40, where 40 has left child 35), and right subtree containing 70 (with children 60 and 80). All BST properties hold. | Describes a valid BST with the correct keys but one minor placement error (e.g., 35 placed as right child of 30 instead of left child of 40). |
> | Correct tree after deleting 30 using in-order successor | Describes that 30's key is replaced by 35 (the in-order successor, smallest in the right subtree), and the original 35 node is removed (it had no children, so just deleted). Tree remains valid. | Correctly replaces 30 with the successor but describes the successor deletion incorrectly (e.g., assumes successor had a child that was mishandled). |
> | Explanation of why in-order successor preserves BST property | States that the successor is the smallest key larger than the deleted key, so placing it at the deleted node's position keeps all left-subtree keys smaller and all right-subtree keys larger. Also notes the successor has at most one child, so its deletion is simple. | Gives a correct but vague explanation (e.g., 'it keeps the order') without mentioning the successor's minimal property or its single-child guarantee. |

> [!quote]- Source: L3 · Slide 7
> "copy in the in-order successor (smallest key in the right subtree), then delete the successor, which has at most one child"
>
> Deleting from a BST Leaf: just remove it One child: replace the node by its child Two children: copy in the in-order successor (smallest key in the right subtree), then delete the successor, which has at most one child The in-order predecessor (largest key in the left subtree) works too Example: deleting 50 from the example tree puts 60 at the root
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=7>)

> [!quote]- Source: L3 · Slide 7
> "One child: replace the node by its child"
>
> Deleting from a BST Leaf: just remove it One child: replace the node by its child Two children: copy in the in-order successor (smallest key in the right subtree), then delete the successor, which has at most one child The in-order predecessor (largest key in the left subtree) works too Example: deleting 50 from the example tree puts 60 at the root
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=7>)

> [!quote]- Source: L3 · Slide 8
> "Search, insert and delete are all O(h)"
>
> Height decides the cost Search, insert and delete are all O(h) Balanced tree: h = O(log n) Inserting keys in sorted order (1, 2, 3, …) builds a chain: h = n − 1, so operations are O(n) Operation BST average BST worst case Search O(log n) O(n) Insert O(log n) O(n) Delete O(log n) O(n)
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=8>)

## Key points

- Search, insert and delete all cost O(h); balanced trees keep h = O(log n), sorted insertion makes h = n − 1.
- The iterative search loop checks null before key comparison to avoid null reference errors.
- Insert creates a new leaf where the search fell off the tree; duplicates are not inserted (distinct keys assumed).
- Delete a leaf by setting the parent's child pointer to null.
- Delete a node with one child by replacing the node with its child (update the parent's pointer).
- Delete a node with two children by copying the in-order successor's key, then deleting the successor (which has at most one child).
- In-order traversal of a BST visits keys in sorted order.

> [!quote]- Source: L3 · Slide 3
> "Root: the top node; leaf: a node with no children"
>
> Tree vocabulary Root: the top node; leaf: a node with no children Parent / child, subtree: a node together with all its descendants Depth of a node: number of edges from the root Height of a tree: number of edges on the longest root-to-leaf path Binary tree: every node has at most two children (left and right)
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=3>)

> [!quote]- Source: L3 · Slide 4
> "For every node: all keys in the left subtree are smaller, all keys in the right subtree are larger"
>
> The BST property For every node: all keys in the left subtree are smaller, all keys in the right subtree are larger (We assume distinct keys) An in-order traversal visits the keys in sorted order 50 / \ 30 70 / \ / \ 20 40 60 80 insert order: 50, 30, 70, 20, 40, 60, 80
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=4>)

> [!quote]- Source: L3 · Slide 5
> "while (node !== null && key !== node.key)"
>
> Searching a BST function search(node, key) { while (node !== null && key !== node.key) node = key < node.key ? node.left : node.right; return node; // null when the key is absent } Each step goes one level down: cost is O(h), h = height Insert: search for the key, then attach a new leaf where the search fell off the tree
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=5>)

> [!quote]- Source: L3 · Slide 6
> "Traversals of the example tree"
>
> Traversals of the example tree Traversal Order Result In-order left, node, right 20 30 40 50 60 70 80 Pre-order node, left, right 50 30 20 40 70 60 80 Post-order left, right, node 20 40 30 60 80 70 50 Level-order breadth-first, level by level 50 30 70 20 40 60 80 Pre-order copies a tree; post-order deletes or evaluates it; in-order lists a BST in sorted order.
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=6>)

> [!quote]- Source: L3 · Slide 7
> "One child: replace the node by its child"
>
> Deleting from a BST Leaf: just remove it One child: replace the node by its child Two children: copy in the in-order successor (smallest key in the right subtree), then delete the successor, which has at most one child The in-order predecessor (largest key in the left subtree) works too Example: deleting 50 from the example tree puts 60 at the root
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=7>)

> [!quote]- Source: L3 · Slide 8
> "Search, insert and delete are all O(h)"
>
> Height decides the cost Search, insert and delete are all O(h) Balanced tree: h = O(log n) Inserting keys in sorted order (1, 2, 3, …) builds a chain: h = n − 1, so operations are O(n) Operation BST average BST worst case Search O(log n) O(n) Insert O(log n) O(n) Delete O(log n) O(n)
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=8>)

---

*Made with BiliMind from your own files. Course: Data structures final prep.*

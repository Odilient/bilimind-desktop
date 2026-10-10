---
title: "Binary search trees: search, insert and delete"
course: "CSC2103 Data Structures final"
lesson: 2
kind: "A skill you do"
day: 2026-10-12
minutes: 30
tags: [bilimind, binary_search_tree_operations]
---

# Binary search trees: search, insert and delete

> [!info] A skill you do · 30 min · study Mon 12 Oct
> You will be able to run search and insert down a tree and delete any node, redrawing the tree after each change. Covers the vocabulary from slide 3 of Lecture 3 (root, leaf, subtree, depth, height), the iterative search loop, in-order traversal giving sorted output, and the three deletion cases including the in-order successor for a node with two children. Prevents cutting out a two-child node in a way that breaks the sorted order.

## Explainer

A BST is a binary tree with one extra rule: for every node, everything in its left subtree is smaller and everything in its right subtree is bigger. That single rule is what lets you search in O(h) instead of scanning every node.

Slide 3 of Lecture 3 fixes the vocabulary you will be marked on:

| Term | Meaning |
|---|---|
| Root | the top node; no parent |
| Leaf | a node with no children |
| Subtree | a node plus all its descendants |
| Depth of a node | number of edges from the root |
| Height of a tree | number of edges on the longest root-to-leaf path |
| Binary tree | every node has at most two children |

Slide 5 gives the search loop. It is iterative, not recursive:

```javascript
function search(node, key) {
  while (node !== null && key !== node.key)
    node = key < node.key ? node.left : node.right;
  return node; // null when the key is absent
}
```

Each comparison sends you exactly one level down, so the cost is O(h). Insert is the same walk with one extra move: search for the key, and when the walk falls off the tree, attach a new leaf there. Delete is the hard one, and it has three cases — slide 7 lists them. A leaf just goes. A node with one child is replaced by that child. A node with two children is replaced by its in-order successor, the smallest key in its right subtree, and then that successor is deleted from where it sat.

Why the successor and not just any node? Because in-order traversal of a BST visits keys in sorted order. Slide 6 shows it on the example tree: in-order gives 20 30 40 50 60 70 80, pre-order gives 50 30 20 40 70 60 80, post-order gives 20 40 30 60 80 70 50. The successor is the next key in that sorted list, so putting it where the deleted node was keeps the sorted order intact.

> [!quote]- Source: L3 · Slide 3
> "Root: the top node; leaf: a node with no children"
>
> Tree vocabulary Root: the top node; leaf: a node with no children Parent / child, subtree: a node together with all its descendants Depth of a node: number of edges from the root Height of a tree: number of edges on the longest root-to-leaf path Binary tree: every node has at most two children (left and right)
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=3>)

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

## Step by step

Insert 40, 20, 60, 10, 30, 50, 70, 25 into an empty BST, then delete 20. Follow the comparisons — every insertion is one search that fails, plus one attach.

### 1. Insert 40 — the root

The tree is empty, so 40 becomes the root. No comparisons needed.

> [!check] Check
> Tree is a single node: 40.

### 2. Insert 20 — go left

Start at 40. 20 < 40, so move to the left child. It is null, so attach 20 there.

> [!check] Check
> 20 is the left child of 40.

### 3. Insert 60 — go right

Start at 40. 60 > 40, so move to the right child. It is null, so attach 60 there.

> [!check] Check
> 60 is the right child of 40.

### 4. Insert 10 — two lefts

10 < 40 → left to 20. 10 < 20 → left of 20. Null, so attach.

> [!warning]
> Do not stop after comparing with 40: its left link already holds 20. Keep walking down until you reach an empty link, then attach.

> [!check] Check
> 10 is the left child of 20.

### 5. Insert 30 — left then right

30 < 40 → left to 20. 30 > 20 → right of 20. Null, so attach.

> [!check] Check
> 30 is the right child of 20.

### 6. Insert 50 and 70

50 > 40 → right to 60. 50 < 60 → left of 60. Attach. Then 70 > 40 → right to 60. 70 > 60 → right of 60. Attach.

> [!check] Check
> 50 is the left child of 60; 70 is the right child of 60.

### 7. Insert 25 — three comparisons

25 < 40 → left to 20. 25 > 20 → right to 30. 25 < 30 → left of 30. Null, so attach.

> [!warning]
> 25 is not a child of 20. It belongs under 30 because 25 > 20 sent you right first.

> [!check] Check
> 25 is the left child of 30.

### 8. Delete 20 — two children, use the in-order successor

20 has two children (10 and 30), so slide 7 says copy in the in-order successor. The successor is the smallest key in the right subtree of 20: walk right to 30, then left as far as possible. 30 has a left child, 25, and 25 has no left child, so the successor is 25. Copy 25 into 20's slot, then delete the old 25 node, which is a leaf.

> [!warning]
> Do not stop at 30 or promote a child by hand. 30 has a left child (25), so it is not the smallest key on the right; promoting 30 into 20's place would also leave it with two left children, 10 and 25.

> [!check] Check
> In-order traversal of the final tree reads 10 25 30 40 50 60 70 — still sorted.

> [!quote]- Source: L3 · Slide 3
> "Root: the top node; leaf: a node with no children"
>
> Tree vocabulary Root: the top node; leaf: a node with no children Parent / child, subtree: a node together with all its descendants Depth of a node: number of edges from the root Height of a tree: number of edges on the longest root-to-leaf path Binary tree: every node has at most two children (left and right)
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=3>)

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

## Checklist

**BST operation field check**

- [ ] Every node's left subtree keys are strictly less than the node and right subtree keys strictly greater
  - *one out-of-place node makes every later search wrong*
- [ ] Search loop compares against node.key, not node, and moves to node.left or node.right
  - *comparing a number with the node object is always false, so the search turns the wrong way and returns null*
- [ ] Insert attaches the new key as a leaf, not as an internal node
  - *splicing a key into the middle of an edge orphans a subtree*
- [ ] Before deleting, count the node's children and name the case out loud
  - *applying the two-child rule to a leaf deletes the wrong node*
- [ ] For a two-child delete, the replacement is the smallest key in the RIGHT subtree
  - *using the largest key in the left subtree is legal but is the predecessor, and mixing them up loses marks*
- [ ] After any delete, run in-order traversal and confirm the output is ascending
  - *this is the only check that catches a broken BST*
- [ ] Height is counted in edges, not nodes
  - *slide 3 defines height as edges on the longest root-to-leaf path*

> [!note]
> Keep this open while you redraw the tree after each operation. The in-order check at the end is the one that catches everything else.

> [!quote]- Source: L3 · Slide 3
> "Root: the top node; leaf: a node with no children"
>
> Tree vocabulary Root: the top node; leaf: a node with no children Parent / child, subtree: a node together with all its descendants Depth of a node: number of edges from the root Height of a tree: number of edges on the longest root-to-leaf path Binary tree: every node has at most two children (left and right)
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=3>)

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

## Exercise

Write `insert(root, key)` so it returns the root of the tree after inserting `key` as a leaf, following slide 5's rule: walk down comparing `key` to `node.key`, go left when smaller, right when larger, and attach a new node `{key, left: null, right: null}` where the walk falls off. If the key is already present, leave the tree unchanged. Then write `inOrder(node, out)` that pushes keys into `out` in left-node-right order. A node is a plain object `{key, left, right}`; an empty tree is `null`.

```js
function insert(root, key) {
  // root is null or {key, left, right}
  // Return the root of the tree after inserting key.
  // TODO
}

function inOrder(node, out) {
  // Push node.key into out in in-order, then recurse.
  // TODO
  return out;
}
```

Tests:

- inserts into an empty tree: `insert(null, 40).key` → `40`
- inserts 20 to the left of 40: `insert(insert(null, 40), 20).left.key` → `20`
- in-order returns sorted keys: `inOrder(insert(insert(insert(null, 40), 20), 60), [])` → `[20,40,60]`
- duplicate key is ignored: `inOrder(insert(insert(insert(null, 40), 20), 20), [])` → `[20,40]`

> [!tip]- Hints
> - Handle the null case first: if root is null, return a new node with that key.
> - Otherwise compare key to root.key and recurse into root.left or root.right, assigning the result back so the link is kept.
> - For inOrder, recurse left, push node.key, then recurse right.

> [!question] Q1 · code
> Write `insert(root, key)` and `inOrder(node, out)` in JavaScript. `insert` returns the root of the tree after inserting `key` as a leaf using the slide 5 comparison rule, ignoring duplicates. `inOrder` pushes keys into `out` in left-node-right order and returns `out`. Nodes are `{key, left, right}` and an empty tree is `null`.

> [!success]- Answer
> Run the tests in the course page.

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

## Delete 50 from the slide 6 example tree

Slide 6's example tree has 50 at the root, with left subtree 30 (20, 40) and right subtree 70 (60, 80). Its in-order traversal is 20 30 40 50 60 70 80.

Delete 50. It has two children, so slide 7 says use the in-order successor.

1. Walk right from 50 to 70.
2. Walk left as far as possible: 70 → 60 → 60 has no left child.
3. Successor is 60.
4. Copy 60 into 50's slot. The root is now 60.
5. Delete the old 60 node. It was the left child of 70 and had no children, so it just goes.

Final tree: root 60, left child 30 (with 20 and 40), right child 70 (with 80 as its right child, no left child).

In-order traversal: 20 30 40 60 70 80. Sorted, and 50 is gone. Slide 7 states the same result: deleting 50 puts 60 at the root.

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

## A common mix-up

> [!failure] The belief
> To delete a node with two children I can just promote either child into its place.

**Why it seems right.** For a node with one child the rule really is 'replace it by its child', so the same move looks like it should scale to two children — and a drawing where you promote the left child often still looks like a tree.

> [!success] What is true
> Slide 7 gives the two-child rule as copying in the in-order successor, the smallest key in the right subtree, and then deleting that successor. Promoting a child does not work in general: in the walkthrough tree, promoting 30 into 20's place would leave 30 needing two left children, 10 and its own left child 25, and a node has only one left link, so a subtree gets lost. Copying the successor (25) changes one key and removes one leaf; every other link stays where it was. The difference is observable: run in-order traversal after the delete and a lost subtree shows up as missing keys.

> [!quote]- Source: L3 · Slide 7
> "One child: replace the node by its child"
>
> Deleting from a BST Leaf: just remove it One child: replace the node by its child Two children: copy in the in-order successor (smallest key in the right subtree), then delete the successor, which has at most one child The in-order predecessor (largest key in the left subtree) works too Example: deleting 50 from the example tree puts 60 at the root
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=7>)

## Scenario

You are tracing an exam question. The tree currently holds 40 at the root, with 20 (children 10 and 30) on the left and 60 (children 50 and 70) on the right. The question asks you to delete 40 and draw the result. You have one minute per decision.

**40 has two children. What do you do first?**

- Find the smallest key in 40's right subtree
- Promote 60 into 40's slot and keep going
- Remove 40 and reattach both subtrees to the root's parent

> [!example]- Outcomes
> - ✓ Find the smallest key in 40's right subtree: You walk right to 60, then left to 50. 50 has no left child, so the successor is 50. You now have the key to copy into 40's slot.
> - ✗ Promote 60 into 40's slot and keep going: Promoting 60 puts it at the root, but 60 already has a left child, 50, and 40's whole left subtree (20 with 10 and 30) also has to hang on 60's left. A node has one left link, so one of those subtrees is lost and the in-order traversal is missing keys.
> - ✗ Remove 40 and reattach both subtrees to the root's parent: There is no parent above the root, so there is nowhere to reattach. Even with a parent this would leave the left subtree's keys unconnected to the right subtree's keys and the ordering rule unverifiable.

**You copied 50 into the root. The old 50 node is still sitting as the left child of 60. What now?**

- Delete the old 50 node, which has no children
- Leave the old 50 node where it is
- Delete 60 instead, since it was the successor's parent

> [!example]- Outcomes
> - ✓ Delete the old 50 node, which has no children: The old 50 was a leaf, so it just goes. The tree is now root 50, left 20 (10, 30), right 60 (with 70 as its right child, no left child).
> - ✗ Leave the old 50 node where it is: The tree now contains 50 twice. In-order traversal reads 10 20 30 50 50 60 70. Sorted but with a duplicate — wrong for a set, and the node count is one too high.
> - ✗ Delete 60 instead, since it was the successor's parent: Deleting 60 removes a key that was never asked about. In-order traversal reads 10 20 30 50 50 70 — 60 is gone and 50 is duplicated.

**You have drawn the result. How do you check it in five seconds?**

- Run in-order traversal and confirm the keys come out ascending
- Count the nodes and confirm there are six
- Check that the root is larger than everything on its left

> [!example]- Outcomes
> - ✓ Run in-order traversal and confirm the keys come out ascending: In-order gives 10 20 30 50 60 70. Ascending, six keys, 40 gone — the delete is correct.
> - ✗ Count the nodes and confirm there are six: Six is right, but the duplicate case also gives six when a key was copied without deleting the original. The count alone does not catch it.
> - ✗ Check that the root is larger than everything on its left: 50 is larger than 10, 20 and 30, so this passes — but it says nothing about the ordering inside the right subtree, where the duplicate sat.

> [!summary] Debrief
> Every wrong turn here shares one shape: it moves a key without removing the node it came from. Copying the successor and then deleting the successor's old node is two operations, and skipping the second one leaves a duplicate. The in-order traversal check catches it because a duplicate shows up as a repeated key in an otherwise sorted list.

> [!quote]- Source: L3 · Slide 7
> "One child: replace the node by its child"
>
> Deleting from a BST Leaf: just remove it One child: replace the node by its child Two children: copy in the in-order successor (smallest key in the right subtree), then delete the successor, which has at most one child The in-order predecessor (largest key in the left subtree) works too Example: deleting 50 from the example tree puts 60 at the root
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=7>)

## Check yourself

Answer from the slides, not from memory of a different tree.

> [!question] Q2 · ordering
> Insert 50, 30, 70, 20, 40, 60, 80 into an empty BST, then delete 30 using the in-order successor. Put the stages in the order they happen.
>
> Put in order:
> - b) 20 becomes the left child of 30 and 40 becomes the right child of 30; 60 and 80 attach under 70
> - c) Delete 30: it has two children, so find the smallest key in its right subtree — walk right to 40, which has no left child, so the successor is 40
> - d) Copy 40 into 30's slot, then delete the old 40 node, which was a leaf
> - e) In-order traversal reads 20 40 50 60 70 80
> - a) 50 becomes the root; 30 goes left of 50 and 70 goes right of 50

> [!success]- Answer
> a) 50 becomes the root; 30 goes left of 50 and 70 goes right of 50 → b) 20 becomes the left child of 30 and 40 becomes the right child of 30; 60 and 80 attach under 70 → c) Delete 30: it has two children, so find the smallest key in its right subtree — walk right to 40, which has no left child, so the successor is 40 → d) Copy 40 into 30's slot, then delete the old 40 node, which was a leaf → e) In-order traversal reads 20 40 50 60 70 80
>
> Insertion always attaches a leaf, so the first two keys bracket the root and the rest hang below. The two-child delete copies the in-order successor — the smallest key in the right subtree, which is 40 — and then removes the old 40 node. The final in-order traversal is ascending, which is the check that the delete worked.

> [!quote]- Source: L3 · Slide 7
> "Two children: copy in the in-order successor (smallest key in the right subtree), then delete the successor"
>
> Deleting from a BST Leaf: just remove it One child: replace the node by its child Two children: copy in the in-order successor (smallest key in the right subtree), then delete the successor, which has at most one child The in-order predecessor (largest key in the left subtree) works too Example: deleting 50 from the example tree puts 60 at the root
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=7>)

> [!question] Q3 · cloze
> In the deletion rule on slide 7, a node with two children is replaced by its in-order ____, which is the smallest key in its right subtree.

> [!success]- Answer
> successor
>
> Slide 7 names the in-order successor as the smallest key in the right subtree, and notes the in-order predecessor — the largest key in the left subtree — works too.

> [!quote]- Source: L3 · Slide 7
> "Two children: copy in the in-order successor (smallest key in the right subtree)"
>
> Deleting from a BST Leaf: just remove it One child: replace the node by its child Two children: copy in the in-order successor (smallest key in the right subtree), then delete the successor, which has at most one child The in-order predecessor (largest key in the left subtree) works too Example: deleting 50 from the example tree puts 60 at the root
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=7>)

> [!question] Q4 · short answer
> A BST holds n nodes. State its worst-case height and describe an insertion order that produces it. Explain in two or three sentences why that order is the worst.

> [!success]- Answer
> The worst-case height is n - 1 edges, giving a tree that is a single chain. Inserting keys in sorted order, ascending or descending, produces it: in ascending order each new key is larger than every key already present, so every insertion walks right from the root and attaches as the rightmost leaf (descending order mirrors this on the left). The height is then n - 1 because the longest root-to-leaf path visits every node, and search costs O(h) = O(n), no better than a list.
>
> Slide 8: inserting keys in sorted order (1, 2, 3, …) builds a chain of height n − 1, so search, insert and delete all cost O(n) instead of O(log n).
>
> | Criterion | Excellent | Acceptable |
> |---|---|---|
> | States the worst-case height in edges | Gives n - 1 edges (or n levels) and ties it to slide 3's definition of height as edges on the longest root-to-leaf path. | Gives n - 1 or n without distinguishing edges from nodes, but the number is right. |
> | Names a concrete insertion order that produces the chain | Gives a sorted sequence such as 10, 20, 30, 40 and states that ascending or descending order both work. | Says 'sorted order' with an example of two or three keys. |
> | Explains why that order forces every insertion down the same side | States that each new key is larger than all existing keys, so every comparison sends the walk right and the new node attaches as the rightmost leaf, making the height n - 1 and search O(n). | States that the tree becomes a chain and search degrades to O(n), without tracing the comparison. |

> [!quote]- Source: L3 · Slide 8
> "builds a chain: h = n − 1, so operations are O(n)"
>
> Height decides the cost Search, insert and delete are all O(h) Balanced tree: h = O(log n) Inserting keys in sorted order (1, 2, 3, …) builds a chain: h = n − 1, so operations are O(n) Operation BST average BST worst case Search O(log n) O(n) Insert O(log n) O(n) Delete O(log n) O(n)
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=8>)

> [!quote]- Source: L3 · Slide 3
> "Root: the top node; leaf: a node with no children"
>
> Tree vocabulary Root: the top node; leaf: a node with no children Parent / child, subtree: a node together with all its descendants Depth of a node: number of edges from the root Height of a tree: number of edges on the longest root-to-leaf path Binary tree: every node has at most two children (left and right)
> [Open the page](<../sources/CSC2103-L03-bst-and-avl-trees.pdf#page=3>)

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

---

*Made with BiliMind from your own files. Course: CSC2103 Data Structures final.*

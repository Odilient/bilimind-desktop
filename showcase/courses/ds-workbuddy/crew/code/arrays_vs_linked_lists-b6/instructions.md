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
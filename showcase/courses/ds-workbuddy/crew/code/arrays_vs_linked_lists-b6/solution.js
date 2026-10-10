class Node {
  constructor(value, next = null) {
    this.value = value;
    this.next = next;
  }
}

function reverse(head) {
  let prev = null;
  let curr = head;
  while (curr !== null) {
    let next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev;
}
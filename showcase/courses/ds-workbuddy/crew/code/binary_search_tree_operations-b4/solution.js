class TreeNode {
  constructor(key) {
    this.key = key;
    this.left = null;
    this.right = null;
  }
}

function search(root, key) {
  let node = root;
  while (node !== null && key !== node.key) {
    node = key < node.key ? node.left : node.right;
  }
  return node;
}

function insert(root, key) {
  if (root === null) return new TreeNode(key);
  let parent = null;
  let node = root;
  while (node !== null) {
    parent = node;
    if (key < node.key) node = node.left;
    else if (key > node.key) node = node.right;
    else return root; // duplicate, no change
  }
  if (key < parent.key) parent.left = new TreeNode(key);
  else parent.right = new TreeNode(key);
  return root;
}

function deleteNode(root, key) {
  if (root === null) return null;
  if (key < root.key) {
    root.left = deleteNode(root.left, key);
    return root;
  } else if (key > root.key) {
    root.right = deleteNode(root.right, key);
    return root;
  }
  // key === root.key
  if (root.left === null) return root.right;
  if (root.right === null) return root.left;
  // two children
  let successor = root.right;
  while (successor.left !== null) successor = successor.left;
  root.key = successor.key;
  root.right = deleteNode(root.right, successor.key);
  return root;
}
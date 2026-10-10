function siftUp(heap, i) {
  // Move heap[i] toward the root until its parent is <= it (slide 6's loop).
  while (i > 0) {
    const p = Math.floor((i - 1) / 2);
    if (heap[p] <= heap[i]) break;          // heap property holds
    [heap[p], heap[i]] = [heap[i], heap[p]]; // swap with the parent
    i = p;                                    // move up one level
  }
  return heap;
}
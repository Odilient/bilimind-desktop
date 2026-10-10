function buildChains(keys, m) {
  const buckets = Array.from({ length: m }, () => []);
  for (const k of keys) {
    buckets[k % m].push(k);
  }
  return buckets;
}
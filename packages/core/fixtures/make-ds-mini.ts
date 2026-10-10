// Generates fixtures/course-ds-mini.json: a hand-written 2-lesson Data Structures course that contains every
// enabled block type (18 Tier A + 4 Tier B) and every assessment kind, with citations, narration cues
// (computed with the same sentence splitter the player uses), receipts, a plan, one "beyond_slides" label
// and one rejected item recorded in receipts. Sources are SAMPLE notes written for the fixture (not real
// lecture files); the numbers in receipts are sample numbers. Run: node packages/core/fixtures/make-ds-mini.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  cardId, lessonSentences, parseCourse, plannedBlockTypes, reviewDatesBackwardsFromExam, textSentences, wordCount,
} from '../src/index.ts';
import type { Cite, Course, CourseLesson, Narration, SpokenSentence } from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));

// ---------- sources (sample notes, honest labels) ----------
const S1 = 'sources/sample-lecture-04-hashing.pdf';
const S2 = 'sources/sample-lecture-08-heaps.pdf';
const S3 = 'sources/sample-quiz-1-past-paper.pdf';
const cite = (file: string, page: number, quote: string, excerpt: string): Cite =>
  ({ file, locator: `Page ${page}`, page, quote, excerpt: excerpt.includes(quote) ? excerpt : `${excerpt} ${quote}` });

const C = {
  hashFn: cite(S1, 3, 'A hash function maps each key to one of m slots.',
    'Direct-access tables waste memory when the universe of keys is large. A hash function maps each key to one of m slots. Two keys that map to the same slot collide, and the table must resolve the collision.'),
  load: cite(S1, 6, 'keep α bounded and every operation runs in O(1) expected time',
    'The load factor α = n/m is the average number of keys per slot. If we keep α bounded and every operation runs in O(1) expected time, the table behaves like a direct-access array without its memory cost.'),
  chainSearch: cite(S1, 7, 'An unsuccessful search examines only the chain in slot h(k), whose expected length is α.',
    'With chaining, each slot stores a linked list of the keys that hash to it. An unsuccessful search examines only the chain in slot h(k), whose expected length is α. A successful search costs Θ(1 + α) on average.'),
  probes: cite(S1, 9, 'about ½(1 + 1/(1 − α)²) probes',
    'Linear probing stores every key in the array itself. Keys form clusters, and an unsuccessful search takes about ½(1 + 1/(1 − α)²) probes, which grows without bound as α approaches 1.'),
  resize: cite(S1, 11, 'Doubling the table when α exceeds a threshold makes insertion O(1) amortised.',
    'Rehashing moves every key into a table of size 2m and costs O(n). Doubling the table when α exceeds a threshold makes insertion O(1) amortised, because n cheap inserts pay for each expensive one.'),
  badHash: cite(S1, 12, 'a hash function that ignores part of the key concentrates keys in few slots',
    'Bad choices of m, such as m = 100 for keys that are multiples of 10, and a hash function that ignores part of the key concentrates keys in few slots, so chains grow long even when α is small.'),
  heapProp: cite(S2, 3, 'every node is no larger than its children',
    'A binary min-heap is a complete binary tree in which every node is no larger than its children. The minimum is therefore at the root. Siblings are not ordered.'),
  heapArray: cite(S2, 5, 'the children of index i are at 2i + 1 and 2i + 2',
    'Store the tree level by level in an array. With 0-based indexing the children of index i are at 2i + 1 and 2i + 2, and its parent is at ⌊(i − 1)/2⌋.'),
  siftUp: cite(S2, 7, 'append the key and swap it with its parent while it is smaller',
    'Insert: append the key and swap it with its parent while it is smaller. Each swap moves up one level, so insert costs O(log n).'),
  siftDown: cite(S2, 9, 'swap it with its smaller child',
    'Extract-min: remove the root, move the last key to the root, then repeatedly swap it with its smaller child until neither child is smaller. Each swap moves down one level: O(log n).'),
  buildHeap: cite(S2, 12, 'Building a heap bottom-up takes O(n) time.',
    'Calling insert n times costs O(n log n). Sifting down from the last parent to the root instead touches most keys only near the leaves. Building a heap bottom-up takes O(n) time.'),
  paper: cite(S3, 2, 'Question 2 (20 marks) Hash tables',
    'Question 2 (20 marks) Hash tables. (a) Define the load factor. (b) Estimate the probes for an unsuccessful search under linear probing at α = 0.75.'),
};

// ---------- lesson 1: hash tables (quantitative: worked_example + playground + quiz) ----------
const lesson1Blocks = [
  { type: 'explainer', title: 'Why a lookup can skip the search', cites: [C.hashFn, C.load], assessments: [], payload: { markdown:
    'Searching a sorted array costs O(log n) comparisons. A hash table aims for O(1) on average, and it gets there by not searching at all: a **hash function** turns the key into a slot number, and the item lives in that slot.\n\n'
    + 'The catch is that two keys can land in the same slot. That is a **collision**, and every hash table is really a policy for handling them. With **chaining**, each slot holds a short list of the keys that hashed there. With **open addressing**, a colliding key walks to the next free slot.\n\n'
    + 'How long that list or that walk gets depends on one number: the **load factor** α = n / m, the keys stored divided by the slots available. Page 6 of your notes puts the rule plainly: keep α bounded and every operation stays O(1) on average.' } },
  { type: 'diagram', title: 'Where a key goes', cites: [C.hashFn], assessments: [], payload: { format: 'mermaid',
    source: 'flowchart LR\n  K["key: heap"] --> H["hash of key = 17"]\n  H --> M["17 mod 5 = 2"]\n  M --> S["slot 2"]\n  S --> A["tree"]\n  A --> B["heap"]',
    caption: 'With chaining, the hash picks slot 2, and the new key joins the short list of keys that collided there.',
    alt_text: 'A flow from the key "heap" to its hash value 17, then 17 mod 5 equals 2, then slot 2, which holds a list: "tree" followed by "heap".' } },
  { type: 'analogy', title: null, cites: [], assessments: [], payload: {
    markdown: 'A hash table is a coat check. You hand over your coat and get ticket 42. To collect it, the attendant walks straight to hook 42 instead of searching every hook. The ticket number is the hash, and the hook is the slot.',
    breaks_down_when: 'A coat check never gives two people the same ticket, but a hash function does. Two different keys can map to the same slot, so the table still has to compare keys inside a slot to find the right one.' } },
  { type: 'worked_example', title: 'Probes before and after a resize', cites: [C.probes, C.resize], assessments: [], payload: {
    problem_markdown: 'A table with **m = 8** slots uses linear probing and holds **n = 6** keys. Estimate how many probes an unsuccessful search takes, then do it again after the table doubles to m = 16. Use the estimate ½(1 + 1/(1 − α)²) from page 9 of your notes.',
    steps: [
      { expression: 'α = n / m = 6 / 8 = 0.75', explanation: 'The load factor is the share of slots in use.' },
      { expression: '1 − α = 0.25, so (1 − α)² = 0.0625', explanation: 'Work out the denominator first: this is where the cost explodes as α nears 1.' },
      { expression: '½(1 + 1 / 0.0625) = ½(1 + 16) = 8.5 probes', explanation: 'An unsuccessful search walks the whole cluster before it meets an empty slot.' },
      { expression: 'after the resize: α = 6 / 16 = 0.375', explanation: 'Doubling m halves α. Every key is rehashed into the bigger table.' },
      { expression: '½(1 + 1 / 0.625²) = ½(1 + 2.56) ≈ 1.78 probes', explanation: 'Same keys and the same hash function, about five times fewer probes.' },
    ],
    answer: 'About 8.5 probes at α = 0.75, and about 1.78 probes after resizing to α = 0.375.',
    common_mistakes: [
      'Swapping n and m, which gives α = 1.33 for a table that cannot hold more keys than slots',
      'Forgetting to square (1 − α), which gives 2.5 probes instead of 8.5',
      'Keeping the old slot numbers after a resize: every key must be rehashed with the new m',
    ] } },
  { type: 'playground', title: 'Drag the load factor', cites: [C.probes], assessments: [], payload: {
    inputs: [{ key: 'alpha', label: 'Load factor α', min: 0.05, max: 0.95, step: 0.05, default: 0.5 }],
    formula_js: 'function compute(i) { return 0.5 * (1 + 1 / ((1 - i.alpha) * (1 - i.alpha))); }',
    output_label: 'Probes for an unsuccessful search', output_unit: 'probes',
    guidance_markdown: 'Start at α = 0.5: about 2.5 probes. Drag towards 0.7 and the curve is still gentle. Past 0.8 it turns almost vertical, reaching 50.5 probes at 0.9. That knee is why libraries resize long before the table is full.',
    discover: { input: 'alpha', op: '>=', value: 0.8, say: 'past α = 0.8 every extra key costs far more probes than the last one.' } } },
  { type: 'comparison', title: 'Chaining or open addressing?', cites: [C.chainSearch, C.probes], assessments: [], payload: {
    intro: 'Both handle collisions. They fail differently as the table fills.',
    axes: ['Where a colliding key goes', 'Cost as α grows', 'Can α exceed 1?', 'Deleting a key'],
    items: [
      { name: 'Chaining', values: ['Into the list in its own slot', 'Gentle: about 1 + α steps', 'Yes, the lists just get longer', 'Unlink it from its list'],
        best_for: 'Tables whose size you cannot predict, or whose keys are deleted often.' },
      { name: 'Open addressing (linear probing)', values: ['The next free slot in the array', 'Explodes near α = 1 as clusters merge', 'No, the array is the only storage', 'Leave a tombstone so later searches keep walking'],
        best_for: 'Memory-tight tables kept below α ≈ 0.7, where one flat array is fast to scan.' },
    ] } },
  { type: 'misconception', title: null, cites: [C.badHash], assessments: [], payload: {
    belief: 'Hash table lookups are always O(1).',
    why_it_seems_right: 'On average they are. With a good hash function and α kept bounded, the expected chain or probe length is a small constant, and that is the number textbooks quote.',
    what_is_true: 'O(1) is an average over keys, not a guarantee. If many keys collide, for example when every key is a multiple of the table size, one slot holds them all and a lookup degrades to O(n). Resizing and a well-mixed hash function keep the average honest.' } },
  { type: 'key_points', title: null, cites: [], assessments: [], payload: { points: [
    'The load factor α = n / m sets the expected cost of every operation.',
    'With chaining, the expected search cost grows like 1 + α, so it degrades gently.',
    'With linear probing, an unsuccessful search costs about ½(1 + 1/(1 − α)²) probes, which explodes as α approaches 1.',
    'Doubling the table when α crosses a threshold keeps insert O(1) amortised.',
    'Average O(1) assumes keys spread evenly; a poor hash function can push one slot to O(n).',
  ] } },
  { type: 'flashcards', title: null, cites: [], assessments: [], payload: { cards: [
    { front: 'Load factor α', back: 'n / m: keys stored divided by slots' },
    { front: 'Collision', back: 'Two different keys hash to the same slot' },
    { front: 'Chaining', back: 'Each slot holds a list of the keys that hashed there' },
    { front: 'Linear probing', back: 'On a collision, try the next slot, wrapping around at the end' },
    { front: 'Expected search cost with chaining', back: 'Θ(1 + α)' },
    { front: 'Why tables resize by doubling', back: 'Rehashing costs O(n) but is rare enough to average O(1) per insert' },
    { front: 'Tombstone', back: 'A marker left on delete so open-addressing searches keep walking past the gap' },
  ] } },
  { type: 'code', title: 'Find the slot for a new key', cites: [C.probes], payload: {
    mode: 'function', language: 'javascript',
    starter_code: 'function linearProbeIndex(table, key) {\n  // table: an array of numbers, with null for an empty slot\n  // TODO: start at key % table.length and walk forward to the first empty slot\n  return key % table.length;\n}',
    instructions_markdown: 'Write `linearProbeIndex(table, key)`. It returns the slot where `key` would be **inserted** with linear probing and h(k) = k mod m: start at `key % table.length`; if that slot is taken, try the next one, wrapping from the last slot back to 0. Return `-1` when every slot is full.',
    tests: [
      { name: 'empty table: home slot', call: 'linearProbeIndex([null, null, null, null, null], 7)', expect: 2 },
      { name: 'home slot taken: next slot', call: 'linearProbeIndex([null, null, 12, null, null], 7)', expect: 3 },
      { name: 'wraps around the end', call: 'linearProbeIndex([null, null, null, null, 9], 14)', expect: 0 },
      { name: 'full table returns -1', call: 'linearProbeIndex([1, 2, 3, 4, 5], 6)', expect: -1 },
    ],
    hints: ['Loop at most table.length times, so a full table cannot loop forever.', 'On step i the slot to try is (start + i) % table.length.'],
  }, assessments: [
    { kind: 'code', prompt: 'Make every test pass: return the insertion slot under linear probing, or -1 when the table is full.', bloom: 'apply', grader: 'deterministic', max_score: 100,
      answer_key: { reference_solution: 'function linearProbeIndex(table, key) {\n  const m = table.length;\n  const start = key % m;\n  for (let i = 0; i < m; i++) {\n    const slot = (start + i) % m;\n    if (table[slot] === null) return slot;\n  }\n  return -1;\n}',
        tests: ['empty table: home slot', 'home slot taken: next slot', 'wraps around the end', 'full table returns -1'] } },
  ] },
  { type: 'quiz', title: null, cites: [], payload: { intro: 'Five questions. Every answer was checked against your notes.' }, assessments: [
    { kind: 'mcq', prompt: "Java's HashMap doubles its table when it gets too full. Why does that keep insert O(1) on average?", bloom: 'understand', grader: 'deterministic', max_score: 100,
      options: [
        { id: 'a', text: 'Each resize takes O(1) time because only the new slots are touched' },
        { id: 'b', text: 'Resizes become rare enough that their O(n) cost averages out to O(1) per insert' },
        { id: 'c', text: 'Rehashing moves only the keys that had collided' },
        { id: 'd', text: 'After a resize the keys are kept sorted, so inserts get faster' },
      ], answer_key: { correct_option_ids: ['b'] }, labels: ['beyond_slides'], verdict: 'not_covered' },
    { kind: 'multi_select', prompt: 'Which of these make a chained hash table slower on average? Select all that apply.', bloom: 'analyze', grader: 'deterministic', max_score: 100,
      options: [
        { id: 'a', text: 'Letting the load factor climb well above 1' },
        { id: 'b', text: "A hash function that looks only at the key's first character" },
        { id: 'c', text: 'Table size m = 100 when most keys are multiples of 10' },
        { id: 'd', text: 'Storing the values as strings instead of numbers' },
        { id: 'e', text: 'Doubling m whenever α passes 0.75' },
      ], answer_key: { correct_option_ids: ['a', 'b', 'c'] }, verdict: 'supported',
      explanation: 'Long chains come from a high α or from keys piling into few slots: bad choices of m and a hash function that ignores part of the key concentrate keys in few slots.', cites: [C.badHash] },
    { kind: 'numeric', prompt: 'A linear-probing table is at load factor α = 0.8. Using ½(1 + 1/(1 − α)²), how many probes does an unsuccessful search take on average? Answer in probes.', bloom: 'apply', grader: 'deterministic', max_score: 100,
      answer_key: { value: 13, tolerance: 0.05, unit: 'probes' }, verdict: 'supported',
      explanation: '1 − 0.8 = 0.2, squared is 0.04, so ½(1 + 25) = 13 probes.', cites: [C.probes] },
    { id: 'q7', kind: 'mcq', prompt: 'With chaining, an unsuccessful search for key k compares k against which keys?', bloom: 'understand', grader: 'deterministic', max_score: 100,
      options: [
        { id: 'a', text: 'Every key stored in the table' },
        { id: 'b', text: 'Only the keys in the chain at slot h(k)' },
        { id: 'c', text: 'Only the first key of every chain' },
        { id: 'd', text: 'The keys in slot h(k) and in both neighbouring slots' },
      ], answer_key: { correct_option_ids: ['b'] }, labels: ['rewritten'], verdict: 'supported',
      explanation: 'An unsuccessful search examines only the chain in slot h(k), whose expected length is α.', cites: [C.chainSearch] },
    { kind: 'short_answer', prompt: 'After a bulk import, lookups in your linear-probing table became ten times slower, although the hash function did not change. Explain the most likely cause and the fix.', bloom: 'analyze', grader: 'llm_rubric', max_score: 100,
      answer_key: { reference_answer: 'The import pushed the load factor close to 1. With linear probing, keys form long clusters, so the expected probes grow like ½(1 + 1/(1 − α)²) and explode near α = 1. Resizing the table, for example doubling m and rehashing every key, brings α back down and restores short probe sequences.' },
      rubric: [
        { criterion: 'Names the load factor rising towards 1 as the cause', weight: 0.5, excellent: 'Says the import raised α close to 1 and that clusters lengthen every probe sequence.', acceptable: 'Says the table got too full without linking it to probe length.', poor: 'Blames the hash function or the hardware.' },
        { criterion: 'Proposes resizing with a full rehash as the fix', weight: 0.5, excellent: 'Proposes growing the table (e.g. doubling m) and rehashing every key, and says α drops as a result.', acceptable: 'Proposes a bigger table but not rehashing.', poor: 'Proposes no fix, or one that leaves α unchanged.' },
      ], verdict: 'supported', explanation: 'An unsuccessful search takes about ½(1 + 1/(1 − α)²) probes, which grows without bound as α approaches 1.', cites: [C.probes, C.resize] },
  ] },
];

// ---------- lesson 2: binary heaps (procedural: walkthrough + checklist + quiz) ----------
const recap = 'Here is the whole lesson in one breath. A binary heap is a complete binary tree kept in an array, where every parent is no larger than its children. That one rule is weaker than sorting, and that is the point: it is cheap to repair. To insert, put the new key at the end and swap it upward while it is smaller than its parent. To remove the minimum, take the root, move the last key into its place, and swap it downward with the smaller child until both children are larger. Each swap moves one level, and a heap of n keys has about log n levels, so both operations cost O of log n. Finding the minimum costs nothing at all, because it always sits at index zero. Searching for any other key is slow, because siblings are not ordered. If the exam asks you to build a heap from a list, remember Floyd\'s method: sift down from the last parent back to the root, and the whole build takes linear time.';
const lesson2Blocks = [
  { type: 'explainer', title: 'A queue that always knows its smallest key', cites: [C.heapProp, C.heapArray], assessments: [], payload: { markdown:
    'A priority queue answers one question fast: what is the smallest key right now? A sorted array answers it in O(1) but pays O(n) for every insert. A **binary heap** pays O(log n) for both, because it keeps a weaker order: every parent is no larger than its children. That is the **heap property**. Siblings are not ordered at all.\n\n'
    + 'The heap is a complete binary tree stored in a plain array, level by level. For the node at index i, the children sit at 2i + 1 and 2i + 2, and the parent at ⌊(i − 1) / 2⌋. Moving up or down the tree is arithmetic, never pointers. Page 5 of your heap notes draws the same tree both ways.' } },
  { type: 'walkthrough', title: 'Insert by hand: sift-up', cites: [C.siftUp, C.heapArray], assessments: [], payload: {
    intro: 'Insert 1 into the min-heap [2, 5, 8]. Keep the array beside you; every step is one comparison.',
    steps: [
      { n: 1, title: 'Append the key at the end', detail_markdown: 'Push 1 onto the array: [2, 5, 8, 1]. The tree is still complete, so the shape is right. Only the order may be broken.',
        warning: 'Do not insert at the front: shifting every element costs O(n) and breaks every parent and child index.', check: 'The array grew by exactly one.' },
      { n: 2, title: 'Compare with the parent', detail_markdown: 'The new key is at index 3, so its parent is at ⌊(3 − 1) / 2⌋ = 1, holding 5. Since 1 < 5, the heap property is broken here.',
        warning: 'With 0-based indexing the parent of i is ⌊(i − 1) / 2⌋, not ⌊i / 2⌋.', check: 'You compared the new key with exactly one other key.' },
      { n: 3, title: 'Swap upward', detail_markdown: 'Swap them: [2, 1, 8, 5]. The key is now at index 1, and its parent is index 0, holding 2.',
        check: 'The key you swapped down, 5, is still larger than its new parent.' },
      { n: 4, title: 'Repeat until the parent is smaller or you reach the root', detail_markdown: 'Since 1 < 2, swap again: [1, 2, 8, 5]. The key is at the root, so stop. That took 2 swaps, and a heap of n keys never needs more than ⌊log₂ n⌋.',
        warning: 'Stop as soon as the parent is smaller or equal. Swapping past that point breaks a correct heap.', check: 'Every parent is no larger than its children: 1 ≤ 2, 1 ≤ 8 and 2 ≤ 5.' },
    ] } },
  { type: 'checklist', title: 'Before you trust your heap', cites: [C.heapProp], assessments: [], payload: {
    title: 'Before you trust your heap',
    items: [
      { text: 'Index 0 holds the smallest key', why: 'Extract-min reads it without searching' },
      { text: 'Every parent at i is ≤ the keys at 2i + 1 and 2i + 2', why: 'One violation is enough to break extract-min' },
      { text: 'The array has no gaps', why: 'A gap breaks the index arithmetic for every node after it' },
      { text: 'Sift-up compares with the parent only', why: 'Siblings are unordered, so comparing them wastes work' },
      { text: 'Sift-down swaps with the smaller child', why: 'Swapping with the larger child leaves a parent above a smaller key' },
    ],
    note: 'Run these checks on paper for any 7-key heap before the exam: they catch most lost marks.' } },
  { type: 'example', title: 'Extract-min on [1, 3, 6, 5, 9, 8]', cites: [C.siftDown], assessments: [], payload: {
    title: 'Extract-min on [1, 3, 6, 5, 9, 8]',
    markdown: 'Remove the root, 1. Move the last key, 8, to the root: [8, 3, 6, 5, 9]. Sift down: the children of 8 are 3 and 6, so swap with the **smaller** one, 3, giving [3, 8, 6, 5, 9]. Now 8 sits at index 1 with children 5 and 9, so swap with 5, giving [3, 5, 6, 8, 9]. Index 3 has no children, so stop. The result is a valid heap, and 1 is returned after 2 swaps.' } },
  { type: 'reference_table', title: 'Binary heap: cost of each operation', cites: [C.siftUp, C.siftDown, C.buildHeap], assessments: [], payload: {
    title: 'Binary heap: cost of each operation',
    columns: ['Operation', 'Time', 'Why'],
    rows: [
      ['Find min', 'O(1)', 'The minimum is always at index 0'],
      ['Insert', 'O(log n)', 'Sift-up climbs at most one level per swap'],
      ['Extract min', 'O(log n)', 'Sift-down descends at most one level per swap'],
      ['Build a heap from n keys', 'O(n)', 'Bottom-up sift-down: most keys sit near the leaves'],
      ['Search for an arbitrary key', 'O(n)', 'Siblings are unordered, so there is no path to follow'],
    ],
    note: 'Heapsort is one build plus n extract-mins: O(n log n) in total.' } },
  { type: 'timeline', title: null, cites: [], assessments: [], payload: { events: [
    { when: '1959', title: "Dijkstra's shortest paths", detail: 'Published without a heap: picking the next closest vertex by scanning costs O(V²), the cost a priority queue later cut for sparse graphs.' },
    { when: '1964', title: 'Williams: the binary heap', detail: 'J. W. J. Williams introduced the array-based binary heap with heapsort, sorting in O(n log n) time with no extra memory.' },
    { when: '1964', turning: true, title: 'Floyd: building a heap in O(n)', detail: 'Robert Floyd showed that sifting down from the last parent to the root builds a heap in linear time, instead of n inserts at O(log n) each.' },
    { when: '1984', title: 'Fredman and Tarjan: Fibonacci heaps', detail: "Decrease-key dropped to O(1) amortised, which brought Dijkstra's algorithm down to O(E + V log V)." },
  ] } },
  { type: 'scenario', title: 'The print queue that skips the line', cites: [C.siftDown], assessments: [], payload: {
    setup_markdown: 'Your project schedules print jobs with a min-heap keyed by priority, where a lower number prints sooner. Users report that a priority-2 job sometimes prints after a priority-3 job. The heap array right after the last extract-min is [3, 5, 2, 7, 4].',
    steps: [
      { id: 's1', prompt: 'Where do you look first?', options: [
        { id: 'a', text: 'Check whether [3, 5, 2, 7, 4] satisfies the heap property', outcome_markdown: 'Index 0 holds 3, but its right child at index 2 holds 2. The heap property is broken at the root, so the next extract-min returns 3 before 2.', correct: true, next_id: 's2' },
        { id: 'b', text: 'Flip the comparison from < to >', outcome_markdown: 'The queue now behaves as a max-heap and priority-9 jobs print first. The complaints double.', correct: false, next_id: 's2' },
        { id: 'c', text: 'Restart the print server', outcome_markdown: 'The queue empties and the bug disappears until the next busy afternoon, when the same order problem returns.', correct: false, next_id: 's2' },
      ] },
      { id: 's2', prompt: 'The broken state appears right after extract-min. Which part of the code do you inspect?', options: [
        { id: 'a', text: 'The swap inside sift-down', outcome_markdown: 'It swaps with the left child whenever the left child is smaller than the parent, and never looks at the right child. With the fix, [5, 3, 2, 7, 4] sifts down to [2, 3, 5, 7, 4], and the priority-2 job prints next.', correct: true, next_id: null },
        { id: 'b', text: 'The append inside insert', outcome_markdown: 'Insert pushes to the end and sifts up correctly. The order was already broken before any insert ran.', correct: false, next_id: null },
        { id: 'c', text: 'The line that moves the last key to the root', outcome_markdown: 'Moving the last key to the root is the standard first step of extract-min. The shape is fine, and the bug is still there.', correct: false, next_id: null },
      ] },
    ],
    debrief_markdown: 'Both wrong turns treated the symptom. When a heap returns keys out of order, check the heap property on the array first, then the step that last touched it. Sift-down must compare **both** children and swap with the smaller one.' } },
  { type: 'code', title: 'Write heapPush', cites: [C.siftUp], payload: {
    mode: 'function', language: 'javascript',
    starter_code: 'function heapPush(heap, value) {\n  heap.push(value);\n  // TODO: sift the new key up while it is smaller than its parent\n  return heap;\n}',
    instructions_markdown: 'Write `heapPush(heap, value)` for a **min-heap** stored in an array. Append `value`, then swap it with its parent at ⌊(i − 1) / 2⌋ while it is smaller. Return the array.',
    tests: [
      { name: 'insert into an empty heap', call: 'heapPush([], 5)', expect: [5] },
      { name: 'new minimum rises to the root', call: 'heapPush([2, 5, 8], 1)', expect: [1, 2, 8, 5] },
      { name: 'stops halfway up', call: 'heapPush([1, 3, 6, 5, 9, 8], 4)', expect: [1, 3, 4, 5, 9, 8, 6] },
      { name: 'larger key stays at the bottom', call: 'heapPush([1, 3, 6], 7)', expect: [1, 3, 6, 7] },
    ],
    hints: ['Track the index of the new key: it starts at heap.length - 1.', 'Stop when the index reaches 0 or the parent is not larger.'],
  }, assessments: [
    { kind: 'code', prompt: 'Make every test pass: insert into a min-heap and restore the heap property with sift-up.', bloom: 'apply', grader: 'deterministic', max_score: 100,
      answer_key: { reference_solution: 'function heapPush(heap, value) {\n  heap.push(value);\n  let i = heap.length - 1;\n  while (i > 0) {\n    const parent = Math.floor((i - 1) / 2);\n    if (heap[parent] <= heap[i]) break;\n    [heap[parent], heap[i]] = [heap[i], heap[parent]];\n    i = parent;\n  }\n  return heap;\n}',
        tests: ['insert into an empty heap', 'new minimum rises to the root', 'stops halfway up', 'larger key stays at the bottom'] } },
  ] },
  { type: 'speaking', title: null, cites: [], assessments: [], payload: {
    intro_markdown: 'Oral checks reward clean definitions. Listen, then say each one out loud twice.',
    language: 'en', voice_hint: 'clear, unhurried', voice: 'en-US-AndrewMultilingualNeural',
    items: [
      { text: 'A binary heap is a complete binary tree stored in an array.', audio: 'audio/fixture-speak-1.mp3' },
      { text: 'Every parent is no larger than its children.', audio: 'audio/fixture-speak-2.mp3' },
      { text: 'Insert and extract-min both take O(log n) time.', audio: 'audio/fixture-speak-3.mp3' },
    ] } },
  { type: 'dialogue', title: null, cites: [], assessments: [], payload: {
    scenario_markdown: 'Oral check with your teaching assistant. They want to know why your scheduler uses a heap instead of a sorted array.',
    language: 'en', ai_role: 'teaching assistant', learner_role: 'student',
    goal: 'Explain the trade-off: a heap gives O(log n) insert and extract-min, while a sorted array gives O(1) extract but O(n) insert.',
    opening_line: 'So, why not just keep the jobs in a sorted array?', opening_audio: 'audio/fixture-dialogue-1.mp3',
    hints: ['A sorted array pays O(n) on every insert', 'The heap only keeps parents smaller than children', 'Both heap operations are O(log n)'] } },
  { type: 'project', title: 'Build a homework scheduler', cites: [], payload: {
    title: 'Build a homework scheduler',
    brief_markdown: 'Write a small JavaScript `Scheduler` that stores tasks as `{name, due}` in a min-heap ordered by `due` (a day number). It must support `add(task)`, `next()` (remove and return the task due soonest) and `size()`. Done means: 6 tasks added in random order come out of `next()` in due order, and you can explain why each operation is O(log n).',
    deliverables: ['scheduler.js with add, next and size', 'A short test that adds 6 tasks and prints them in due order', 'Three sentences on the cost of add and next'],
  }, assessments: [
    { kind: 'project', prompt: 'Submit your scheduler and mark it against the rubric.', bloom: 'create', grader: 'llm_rubric', max_score: 100,
      answer_key: { reference_answer: 'A class wrapping an array; add pushes and sifts up by due; next swaps the root with the last task, pops it, sifts down with the smaller child, and returns it; size returns the array length. Both add and next cost O(log n) because each swap moves one level of a tree with about log n levels.' },
      rubric: [
        { criterion: 'next() returns tasks in due order for 6 shuffled tasks', weight: 0.5, excellent: 'The test output lists all 6 tasks in due order, including ties.', acceptable: 'Order is right but the test covers fewer than 6 tasks.', poor: 'Tasks come out in insertion order or the code throws.' },
        { criterion: 'Sift-down compares both children', weight: 0.3, excellent: 'next() swaps with the smaller of the two children every time.', acceptable: 'Compares both children but mishandles a missing right child.', poor: 'Only ever compares the left child.' },
        { criterion: 'Explains the O(log n) cost of add and next', weight: 0.2, excellent: 'Links one swap per level to a tree of about log n levels for both operations.', acceptable: 'States O(log n) without the reason.', poor: 'States O(1) or O(n).' },
      ], verdict: 'supported', explanation: 'Extract-min swaps the moved key with its smaller child until neither child is smaller.', cites: [C.siftDown] },
  ] },
  { type: 'audio', title: 'Listen while you walk', cites: [], assessments: [], payload: {
    script_markdown: recap, voice_hint: 'calm, unhurried', language: 'en', duration_estimate_s: Math.max(15, Math.round(wordCount(recap) / 2.5)) } },
  { type: 'reflection', title: null, cites: [], assessments: [], payload: {
    prompt: 'Which step of sift-down would you most likely get wrong under exam pressure, and what will you check to catch it?' } },
  { type: 'quiz', title: null, cites: [], payload: { intro: 'Four questions on doing it by hand.' }, assessments: [
    { kind: 'ordering', prompt: 'Put the steps of extract-min on a binary min-heap in order.', bloom: 'apply', grader: 'deterministic', max_score: 100,
      options: [
        { id: 'a', text: 'Swap the moved key with its smaller child' },
        { id: 'b', text: 'Remove the root and keep it to return' },
        { id: 'c', text: 'Repeat the swap until neither child is smaller' },
        { id: 'd', text: 'Move the last key in the array to the root' },
      ], answer_key: { correct_order: ['b', 'd', 'a', 'c'] }, verdict: 'supported',
      explanation: 'Remove the root, move the last key to the root, then repeatedly swap it with its smaller child until neither child is smaller.', cites: [C.siftDown] },
    { kind: 'cloze', prompt: 'In a min-heap stored from index 0, the parent of the node at index i is at index ____.', bloom: 'remember', grader: 'deterministic', max_score: 100,
      answer_key: { accepted: ['⌊(i − 1) / 2⌋', 'floor((i - 1) / 2)', '(i - 1) / 2'] }, verdict: 'supported',
      explanation: 'Its parent is at ⌊(i − 1)/2⌋.', cites: [C.heapArray] },
    { kind: 'mcq', prompt: 'You need a heap of 1,000 keys you already have in an array. Which method builds it fastest?', bloom: 'understand', grader: 'deterministic', max_score: 100,
      options: [
        { id: 'a', text: 'Insert the keys one by one, sifting each one up' },
        { id: 'b', text: 'Sift down from the last parent back to the root' },
        { id: 'c', text: 'Insert the keys into a binary search tree, then copy them out' },
        { id: 'd', text: 'Shuffle the array first, then insert the keys one by one' },
      ], answer_key: { correct_option_ids: ['b'] }, verdict: 'supported',
      explanation: 'Building a heap bottom-up takes O(n) time.', cites: [C.buildHeap] },
    { kind: 'essay', prompt: 'Your team must choose between a binary heap and a sorted array for a job queue that receives 10,000 inserts and 10 extract-mins per second. Choose one and justify the trade-off using the cost of each operation.', bloom: 'evaluate', grader: 'llm_rubric', max_score: 100,
      answer_key: { reference_answer: 'Inserts outnumber extracts a thousand to one, so insert cost decides. A sorted array pays O(n) per insert to shift elements into place, about 10,000 × n work per second, while its O(1) extract barely matters. A binary heap pays O(log n) for both insert and extract-min. Choose the heap: it turns the dominant cost from linear into logarithmic.' },
      rubric: [
        { criterion: 'Identifies insert cost as the deciding factor', weight: 0.4, excellent: 'Notes inserts outnumber extracts 1000 to 1, so insert cost dominates.', acceptable: 'Mentions that inserts are frequent without weighing them against extracts.', poor: 'Treats both operations as equally important.' },
        { criterion: 'States the cost of each operation for both structures', weight: 0.4, excellent: 'Gives O(n) insert and O(1) extract for the sorted array, O(log n) for both on the heap.', acceptable: 'Gives the costs for one structure only.', poor: 'Gives wrong costs, such as O(1) heap insert.' },
        { criterion: 'Makes a choice that follows from the costs', weight: 0.2, excellent: 'Chooses the heap and says it turns the dominant cost from linear to logarithmic.', acceptable: 'Chooses the heap without linking it to the numbers.', poor: 'Chooses the sorted array, or makes no choice.' },
      ], verdict: 'supported', explanation: 'Each swap moves up one level, so insert costs O(log n).', cites: [C.siftUp] },
  ] },
];

// ---------- assemble lessons: ids, narration ----------
const EXAM_AT = '2026-10-14T09:00:00+08:00';
const EXAM_DAY = '2026-10-14';

function withIds(blocks: Record<string, unknown>[]) {
  let q = 0;
  return blocks.map((b, i) => ({
    id: `b${i + 1}`, ...b,
    assessments: (b.assessments as Record<string, unknown>[]).map(a => ({ id: `q${++q}`, ...a })),
  }));
}

// deterministic pseudo-random for waveform peaks
function rng(seed: number) { return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; }

function narrationFor(sentences: SpokenSentence[], src: string, seed: number): Narration {
  let t = 400;
  const cues = sentences.map(s => {
    const d = Math.max(1100, Math.round(wordCount(s.text) * 360));
    const cue = { id: s.id, start_ms: t, end_ms: t + d };
    t += d + 280;
    return cue;
  });
  const hz = 5;
  const r = rng(seed);
  const values = Array.from({ length: Math.ceil(t / 1000 * hz) }, (_, i) => Math.round((0.25 + 0.6 * r() * (0.6 + 0.4 * Math.sin(i / 3))) * 100) / 100);
  return { src, duration_ms: t, voice: 'en-US-AndrewMultilingualNeural', sentences: cues, peaks: { hz, values: values.map(v => Math.min(1, Math.max(0, v))) } };
}

const base1 = { id: 'hash_tables', n: 1, title: 'Hash tables and the load factor',
  summary: 'Why a lookup can skip the search, and how the load factor decides when it cannot.',
  archetype: 'quantitative' as const, minutes: 35, track: 'core' as const, parent: null, mark: null, section: 'Fast lookups', day: '2026-10-11' };
const base2 = { id: 'binary_heaps', n: 2, title: 'Binary heaps by hand',
  summary: 'Insert and extract-min on an array-backed heap, step by step, the way the exam asks for them.',
  archetype: 'procedural' as const, minutes: 40, track: 'core' as const, parent: null, mark: null, section: 'Ordering on the fly', day: '2026-10-12' };

const blocks1 = withIds(lesson1Blocks as Record<string, unknown>[]);
const blocks2 = withIds(lesson2Blocks as Record<string, unknown>[]);
const lesson1 = { ...base1, formats: plannedBlockTypes(base1.archetype), blocks: blocks1,
  narration: narrationFor(lessonSentences({ title: base1.title, blocks: blocks1 as never }), 'audio/fixture-l01-hash_tables.mp3', 7) };
const lesson2 = { ...base2, formats: plannedBlockTypes(base2.archetype), blocks: blocks2,
  narration: narrationFor(lessonSentences({ title: base2.title, blocks: blocks2 as never }), 'audio/fixture-l02-binary_heaps.mp3', 11) };
const lessons = [lesson1, lesson2] as unknown as CourseLesson[];

// ---------- review cards (first due = first review date backwards from the exam) ----------
const review: { id: string; lesson: string; kind: 'item' | 'flashcard'; item?: string; block?: string; card?: number; due: string }[] = [];
for (const l of lessons) {
  const first = reviewDatesBackwardsFromExam(l.day!, EXAM_AT)[0]!;
  const due = `${first}T08:00:00+08:00`;
  for (const b of l.blocks) {
    for (const a of b.assessments) if (a.kind !== 'project' && a.kind !== 'essay' && a.kind !== 'code') review.push({ id: cardId(l.id, a.id), lesson: l.id, kind: 'item', item: a.id, due });
    if (b.type === 'flashcards') b.payload.cards.forEach((_c, i) => review.push({ id: cardId(l.id, b.id, i), lesson: l.id, kind: 'flashcard', block: b.id, card: i, due }));
  }
}
const reviewsOn = (d: string) => review.filter(r => r.due.startsWith(d)).length;

// ---------- the overview narration ("Hear the plan") ----------
const overview = 'Your Data Structures final is on Wednesday at 9 in the morning. Last year\'s paper put 35 percent of its marks on hashing and 30 percent on heaps, so those are your two lessons. Sunday is hash tables, Monday is binary heaps, and Tuesday is reviews only. AVL rotations are cut, because they earned no marks last year.';

const rejected = lessons[0]!.blocks.flatMap(b => b.assessments).find(a => a.labels?.includes('rewritten'))!;

const course: Course = {
  schema: 'bilimind.course/1',
  id: 'ds-final-fixture',
  title: 'Data Structures: Final on Wednesday',
  lede: 'Your final is Wednesday at 9:00. Two lessons on what last year\'s paper weighted most, checked against your notes.',
  skin: 'cobalt',
  object: 'img/obj-book.webp',
  chips: ['i-code', 'i-tree'],
  language: 'en',
  built_at: '2026-10-10T21:40:00+08:00',
  allows_code: true,
  code_language: 'javascript',
  attribution: 'Fixture course for player development. Sources are sample notes written by the BiliMind team; receipts are sample numbers.',
  goal: {
    sentence: "My Data Structures final is Wednesday 9am. The slides and last year's paper are in this folder. I have 45 minutes a day. Get me ready.",
    exam_at: EXAM_AT, deadline: EXAM_DAY, minutes_per_day: 45, audience: 'student', timezone: 'Asia/Kuala_Lumpur',
    assumptions: ['Wednesday means 14 Oct 2026, Malaysia time', 'Study starts Sunday 11 Oct', 'Exercises in JavaScript'],
  },
  plan: {
    days: [
      { date: '2026-10-11', lessons: ['hash_tables'], reviews: reviewsOn('2026-10-11'), minutes: 35 },
      { date: '2026-10-12', lessons: ['binary_heaps'], reviews: reviewsOn('2026-10-12'), minutes: 40 + 8 },
      { date: '2026-10-13', lessons: [], reviews: reviewsOn('2026-10-13'), minutes: 30 },
      { date: EXAM_DAY, lessons: [], reviews: 0, minutes: 0, exam: true, label: 'Exam 9:00' },
    ],
    weights: [
      { key: 'hash_tables', title: 'Hash tables and the load factor', marks: 35, share: 0.35, questions: ['Q2', 'Q4b'] },
      { key: 'binary_heaps', title: 'Binary heaps by hand', marks: 30, share: 0.3, questions: ['Q3', 'Q5a', 'Q5b'] },
      { key: 'dynamic_arrays', title: 'Dynamic arrays', marks: 10, share: 0.1, questions: ['Q1'] },
      { key: 'avl_rotations', title: 'AVL rotations', marks: 0, share: 0, questions: [] },
    ],
    cut: [
      { key: 'dynamic_arrays', title: 'Dynamic arrays', reason: '10% of last year\'s marks; the least weight per minute of study.' },
      { key: 'avl_rotations', title: 'AVL rotations', reason: 'No marks on last year\'s paper, and 25 minutes you do not have.' },
    ],
    capacity_min: 135, used_min: 113, warnings: [],
  },
  path: [
    { id: 'dynamic_arrays', step: 1, title: 'Dynamic arrays', section: 'Foundations', lesson: null, minutes: 25, note: null, archetype: 'quantitative',
      summary: 'Why appending to a growing array is O(1) amortised.',
      formats: ['worked_example', 'playground'], weight: 0.1, cut: true, cut_reason: '10% of last year\'s marks; the least weight per minute of study.', items: [] },
    { id: 'hash_tables', step: 2, title: 'Hash tables and the load factor', section: 'Fast lookups', lesson: 'hash_tables', minutes: 35,
      summary: base1.summary,
      note: 'Question 2 last year was worth 20 marks on this alone. Learn the probe formula cold.', archetype: 'quantitative',
      formats: ['worked_example', 'playground', 'code'], weight: 0.35, cut: false, cut_reason: null, items: [
        { id: 'chaining', title: 'Chaining', mark: 'recommended', lesson: null, group: 'Handling collisions', minutes: 0 },
        { id: 'open_addressing', title: 'Open addressing', mark: 'alternative', lesson: null, group: 'Handling collisions', minutes: 0 },
      ] },
    { id: 'binary_heaps', step: 3, title: 'Binary heaps by hand', section: 'Ordering on the fly', lesson: 'binary_heaps', minutes: 40, note: null, archetype: 'procedural',
      summary: base2.summary,
      formats: ['walkthrough', 'checklist', 'code'], weight: 0.3, cut: false, cut_reason: null, items: [
        { id: 'heapsort', title: 'Heapsort', mark: 'anytime', lesson: null, group: null, cut: true },
      ] },
    { id: 'avl_rotations', step: 4, title: 'AVL rotations', section: null, lesson: null, minutes: 25, note: null, archetype: 'procedural',
      summary: 'Single and double rotations that keep a search tree balanced.',
      formats: ['walkthrough', 'checklist'], weight: 0, cut: true, cut_reason: 'No marks on last year\'s paper, and 25 minutes you do not have.', items: [] },
  ],
  further: [{ title: 'Balanced trees', topic: 'AVL and red-black trees, after the exam', after_key: 'binary_heaps' }],
  lessons,
  narration: narrationFor(textSentences('plan', overview), 'audio/fixture-plan.mp3', 3),
  receipts: {
    files: 3, pages: 47, steps: 4, lessons: 2, agents: 5,
    checks: { run: 34, passed: 31, repaired: 3, flagged: 0 },
    tests: { run: 8, passed: 8 },
    code_fixed: 1,
    quiz_checked: 12, rejected: 1, rewritten: 1, labels: { beyond_slides: 1 },
    narration_min: Math.round((lesson1.narration.duration_ms + lesson2.narration.duration_ms) / 60000 * 10) / 10,
    cards: 7 + 1, minutes: 75,
    cost_usd: 0.0041, credits: null, wall_ms: 268000,
    log: [
      { t: '21:31:02', agent: 'Lead', action: 'goal', result: 'Exam Wed 14 Oct 09:00, 45 min/day, 3 assumptions recorded' },
      { t: '21:31:09', agent: 'Lead', action: 'ingest', result: '3 files, 47 pages; quiz-1 detected as past paper' },
      { t: '21:32:15', agent: 'Lead', action: 'exam-map', result: 'hashing 35%, heaps 30%, dynamic arrays 10%, AVL 0%' },
      { t: '21:32:31', agent: 'Lead', action: 'plan', result: 'kept 2 lessons, cut dynamic arrays and AVL rotations' },
      { t: '21:33:40', agent: 'Writer · Hash tables', action: 'draft', result: '11 blocks, 6 questions' },
      { t: '21:33:52', agent: 'Writer · Binary heaps', action: 'draft', result: '14 blocks, 6 questions' },
      { t: '21:34:05', agent: 'Writer · Binary heaps', action: 'check', result: '16/17 checks; repaired: added the missing checklist' },
      { t: '21:34:40', agent: 'Coder', action: 'code-test', result: 'heapPush: reference failed "stops halfway up", fixed, 4/4 pass' },
      { t: '21:35:02', agent: 'Checker', action: 'verdict', result: 'q5 contradicted by Lecture 4 page 7; sent for rewrite' },
      { t: '21:35:30', agent: 'Checker', action: 'verdict', result: 'rewrite q7 (replaces q5) supported; 1 item labelled beyond your slides' },
      { t: '21:35:41', agent: 'Lead', action: 'narrate', result: `2 lessons, ${Math.round((lesson1.narration.duration_ms + lesson2.narration.duration_ms) / 60000)} min of narration` },
      { t: '21:35:50', agent: 'Lead', action: 'build', result: 'index.html, plan.md, reviews.ics, deck.csv, REPORT.md' },
    ],
    excluded: [{
      lesson: 'hash_tables', item: 'q5',
      prompt: 'With chaining, an unsuccessful search for key k must compare k against every key stored in the table. True or false?',
      reason: 'The notes say only the chain at slot h(k) is examined, with expected length α, not every key.',
      quote: 'An unsuccessful search examines only the chain in slot h(k), whose expected length is α.',
      cite: C.chainSearch, replaced_by: rejected.id,
    }],
  },
  sources: [
    { id: 's1', title: 'Lecture 4 · Hashing (sample notes)', short: 'L4', file: S1, kind: 'pdf', role: 'lecture', pages: 18, cited: 14, license: 'Sample document written for the fixture' },
    { id: 's2', title: 'Lecture 8 · Binary heaps (sample notes)', short: 'L8', file: S2, kind: 'pdf', role: 'lecture', pages: 16, cited: 13, license: 'Sample document written for the fixture' },
    { id: 's3', title: 'Quiz 1 (sample past paper)', short: 'Quiz 1', file: S3, kind: 'pdf', role: 'past_paper', pages: 13, cited: 1, license: 'Sample document written for the fixture' },
  ],
  exports: [
    { kind: 'ics', label: 'Study plan .ics', file: 'reviews.ics' },
    { kind: 'anki_csv', label: 'Anki deck', file: 'deck.csv' },
    { kind: 'markdown', label: 'Notes for Obsidian', file: 'lessons/01-hash_tables.md' },
    { kind: 'plan', label: 'The plan', file: 'plan.md' },
    { kind: 'report', label: 'What the agents did', file: 'REPORT.md' },
  ],
  review: { generated_at: '2026-10-10T21:35:50+08:00', cards: review },
};
void C.paper;

parseCourse(course);   // throws with readable errors if the fixture drifts from the schema
const out = join(here, 'course-ds-mini.json');
writeFileSync(out, JSON.stringify(course, null, 2) + '\n');
console.log(`wrote ${out}: ${lessons.length} lessons, ${lessons.reduce((n, l) => n + l.blocks.length, 0)} blocks, ${review.length} review cards`);

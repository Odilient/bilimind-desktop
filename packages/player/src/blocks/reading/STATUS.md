# WP5b status: reading and visual blocks

**Works.** All 13 blocks are styled in cobalt (player-design.md section 5). They render the core fixture and the 3 engine-port sample lessons (converted with `fromSaasLesson`) inside the shell's `BlockFrame`, with no error-boundary hits, no console errors and no sideways scroll at 390 px. The blocks:

- **Explainer:** safe markdown (escaped first, no raw HTML or images, safe links only), a lead paragraph, and key terms. Bold terms that the lesson's own practice cards define get a dotted underline and an ink tooltip. Every bold term also appears as a chip.
- **Analogy:** ends with a "Where the analogy breaks" tip callout.
- **Example:** a framed prose card.
- **Diagram:**
  - Uses `payload.svg` first, after sanitising it.
  - Otherwise lazy-loads Mermaid 11.12.2 from jsDelivr with the cobalt theme. Edges draw in through the Web Animations API, and there is a full-screen dialog.
  - Offline, it shows the flow as chips plus the alt text. On phones the diagram keeps its natural width and scrolls.
- **Comparison and ReferenceTable:** cobalt tables that become one card per row under 640 px.
  - Optional `payload.recommended` puts a lime "Our pick" on that row.
  - The table filter appears when there are more than 4 rows.
  - Big-O cells are set in the display font.
  - Greek letters keep their case inside uppercase headers.
- **Timeline:** a rail with an ink run that grows as you scroll. Dots turn lime once passed and stay lit. `turning` events get a "Turning point" tag.
- **WorkedExample:** reveals one step at a time, with Show all / Start over, then a lime answer band and common mistakes.
- **Playground:**
  - The formula runs in a Blob worker that is killed after 1.5 s.
  - It shows a 28-point sweep of the first input as an area chart, with a marker, a value pill and the big number.
  - Crossing `discover` shows the lime zone and "You found it". This is saved per course.
- **KeyPoints:** numbered points on ink tiles.
- **Misconception:** the belief, then why it seems right, then a truth callout.
- **Audio:** an ink transport bar. It plays `payload.src`; if that is missing or fails, it reads the script with the browser's speechSynthesis. Starting it pauses other media.
- **Reflection:** autosaves to `bm:<course>:notes` and marks the block passed at 8 or more words.

**Contracts kept:**

- Narrated fields are rendered with v-html into `[data-field]`. `reading/cues.ts` wraps each cue sentence in `span.s[data-s="<block>.<n>"]` using core `blockSentences` and `sentenceRanges`. All 59 fixture cues and 99 sample cues are located. The shell's `wrapBlock` skips a block that already has spans.
- Passed blocks dispatch the bubbling `bm:passed` event with `{lesson, block, how}`.
- Citation chips are the shell's `CiteChip`, rendered in the card footer, so `BlockFrame` adds no second row.

**Tests.**

- `pnpm -F @bilimind/player test` runs 32 WP5b unit tests in `reading/reading.test.ts`. They cover markdown XSS, key terms, the playground engine and worker source, chart geometry, the offline Mermaid flow, and the narration contract on every fixture block. The whole package passes 72 tests.
- `node src/blocks/reading/harness/shoot.mjs`, run from packages/player, builds the harness to one file:// page and opens it in Edge. It runs 33 checks (render, cue coverage, Mermaid online and offline, worker values 2.5 and 50.5, 28 points, the 1.5 s kill, step reveal, filter, cite popover, overflow, zero console errors) and writes screenshots to `packages/player/shots/blocks/`:
  - `<type>-1440.png` and `<type>-390.png` for every type;
  - state shots: `explainer-term`, `worked_example-answer`, `playground-found`, `reference_table-filter`, `diagram-offline`;
  - `lesson-*.png` of the real shell build.
- `vue-tsc` is clean, and the full player build is 833 KB.

**Stubbed or not done.**

- The engine does not pre-render Mermaid SVG (WP4 `build`), so the player draws diagrams at runtime and falls back to text offline.
- `payload.recommended` and `discover` are only used when the data carries them. WP2 decides whether the model is asked for them.
- Night-theme colours were not checked; it is opt-in and P2.

**Next.**

- **Integration (WP5a):** in `src/main.ts`, import `./styles/*.css` **before** `./App.vue`. Today the shell's spec copy of the block CSS loads after `reading.css`, so `reading.css` scopes its rules under `.blk` to win. Moving the imports makes that unnecessary but harmless.
- If WP4 adds `payload.svg`, the diagram becomes instant and works offline with no change here.

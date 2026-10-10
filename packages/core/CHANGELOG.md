# @bilimind/core changelog

After gate G0 every change to core needs a line here and must keep `fixtures/course-ds-mini.json` valid
(`node fixtures/make-ds-mini.ts` regenerates it; `pnpm -F @bilimind/core test` checks it).

- 0.1.0 (WP0, 2026-10-10): first contracts: types, archetypes (+ variety gate, tracks, marks, learner tags),
  blocks (22 enabled types, payload + assessment schemas, BLOCK_META), course-schema (course.json `bilimind.course/1`,
  validateCourse, injectCourse/readEmbeddedCourse), grade, sentences, fsrs, convert (fromSaasLesson), fixture.
- 0.1.1 (G0 contract review, 2026-10-10): fromSaasLesson keeps draft block/item ids (never renumbers), drops
  contradicted/excluded items, maps status -> verdict (+ beyond_slides), resolves item cite_chunk_ids via
  resolveCite(chunkId, quote?), drops narration whose cues no longer match (new `narrationMatches`); new `excludedItems`
  (receipts.excluded), `blockNumber`, `DROPPED_STATUSES`, `NarrationIndex` (crew/narration.json); Assessment gains
  `quote`, `reason`, `replaces`; AudioClip reshaped (kind, block id string, duration_ms). Schemas: code tests need
  `expect` (function/debug/script), `expect_table` (query), `selector` (build), unique names; playground input keys unique
  + optional `discover`; timeline events optional `turning`; path topics optional `summary`; sources optional `short`;
  goal optional `timezone`; validateCourse checks review cards name real lessons/items/blocks. gradeCode returns
  'self' for grader 'self' (disabled exercise). Player renders the original course object (zod strips unknown keys).

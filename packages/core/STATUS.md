# WP0 status (core + skeletons), after the G0 contract review

- Works: `pnpm -r typecheck` (core, engine, cli with tsc 5.9.3; player with vue-tsc 3.3.12); core 55 tests pass (fixture validates,
  3 SaaS samples convert, every grader kind, sentence ids identical in Node and a browser bundle, FSRS, draft -> course rules,
  injectCourse round trip); `pnpm -F @bilimind/player build` (200 KB) + `scripts/paste-fixture.mjs` + `scripts/smoke.mjs`: 25 blocks, 0 errors.
- Review fixes (CHANGELOG 0.1.1, engine CONTRACTS.md "Changes after the G0 contract review"): fromSaasLesson keeps draft ids, drops
  contradicted items, maps Checker status/cites/labels, guards narration with narrationMatches; excludedItems for receipts;
  crew/narration.json (NarrationIndex, readNarration done); stricter code-test schemas; player renders the original course object.
- Fixture: 2 lessons, all 22 enabled types, all 9 item kinds, reference solutions pass 4/4 and starters fail; excluded q5 -> rewrite q7.
- Stubbed: every engine command except the JSON readers; player blocks and App.vue; CLI wires only doctor and note; bundle not run.
- Next: lanes fill modules in place; keep the ids rule and the one draft -> course conversion (CONTRACTS.md, Conventions).

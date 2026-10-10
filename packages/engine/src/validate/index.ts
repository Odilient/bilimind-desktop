// `check`: Q0-Q17 (engine-port §5.2) as pure functions + node:vm code harness + playground + mermaid + citations + thin.
// Owner: WP3. Only the contract names are exported here (the engine index re-exports this file); helpers stay internal.
// Files: check.ts (command + checkLesson), rules.ts (Q0-Q17), fix.ts (deterministic repairs), code.ts (Q11 per block,
// shared with code-test), harness.ts (runJsTests), playground.ts (isSafeFormula + 28-point sweep), mermaid.ts, lesson.ts.
export { check } from './check.ts';
export { runJsTests } from './harness.ts';
export { isSafeFormula } from './playground.ts';
export { isPlausibleMermaid } from './mermaid.ts';

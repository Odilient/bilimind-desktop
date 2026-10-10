// `check`: Q1-Q17 (engine-port §5.2) as pure functions + node:vm code harness + playground + mermaid + citations + thin. Split into files freely.
// Owner: WP3. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import type { CheckFn, RunJsTests, IsSafeFormula, IsPlausibleMermaid } from '../contracts.ts';

export const check: CheckFn = async () => { throw new Error('not implemented: check'); };
export const runJsTests: RunJsTests = () => { throw new Error('not implemented: runJsTests'); };
export const isSafeFormula: IsSafeFormula = () => { throw new Error('not implemented: isSafeFormula'); };
export const isPlausibleMermaid: IsPlausibleMermaid = () => { throw new Error('not implemented: isPlausibleMermaid'); };

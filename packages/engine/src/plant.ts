// Checker benchmark: plant N wrong answer keys, then score the Checker's verdicts.
// Owner: WP3. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import type { PlantFn, PlantScoreFn } from './contracts.ts';

export const plant: PlantFn = async () => { throw new Error('not implemented: plant'); };
export const plantScore: PlantScoreFn = async () => { throw new Error('not implemented: plantScore'); };

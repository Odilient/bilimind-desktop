// `run`: builders-only harness, the whole pipeline without agents. Never mentioned in SKILL.md.
// Owner: WP6. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import type { RunFn } from './contracts.ts';

export const run: RunFn = async () => { throw new Error('not implemented: run'); };

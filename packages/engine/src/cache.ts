// LLM response cache by sha256(model + messages) in crew/cache/.
// Owner: WP1. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import type { CacheKey, CacheGet, CacheSet } from './contracts.ts';

export const cacheKey: CacheKey = () => { throw new Error('not implemented: cacheKey'); };
export const cacheGet: CacheGet = () => { throw new Error('not implemented: cacheGet'); };
export const cacheSet: CacheSet = () => { throw new Error('not implemented: cacheSet'); };

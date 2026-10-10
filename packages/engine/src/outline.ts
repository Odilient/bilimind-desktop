// `outline`: one call (reasoning on), GraphBuilder normalisation, variety gate (core varietyViolation) + relabel <= 2, derived formats (core plannedBlockTypes).
// Owner: WP2. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import type { OutlineFn, ReadOutline } from './contracts.ts';
import type { OutlineResult } from '@bilimind/core';
import { coursePaths, readJson } from './course.ts';

export const outline: OutlineFn = async () => { throw new Error('not implemented: outline'); };

export const readOutline: ReadOutline = course => readJson<OutlineResult>(coursePaths(course).outline);

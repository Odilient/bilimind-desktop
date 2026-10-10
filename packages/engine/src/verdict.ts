// `verdict`: applies the Checker's rulings; refuses non-verbatim quotes.
// Owner: WP3. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import type { VerdictFn, FindQuote, ReadVerdicts } from './contracts.ts';
import type { Verdict } from '@bilimind/core';
import { coursePaths, readJsonOrNull } from './course.ts';

export const verdict: VerdictFn = async () => { throw new Error('not implemented: verdict'); };
export const findQuote: FindQuote = () => { throw new Error('not implemented: findQuote'); };

export const readVerdicts: ReadVerdicts = (course, key) => readJsonOrNull<Verdict[]>(coursePaths(course).verdictsJson(key)) ?? [];

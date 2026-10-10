// minisearch over chunks with the SaaS term recipe; top 6 per lesson, at least 2.
// Owner: WP1. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import type { BuildIndex, SearchTerms, RetrieveForLesson } from './contracts.ts';

export const buildIndex: BuildIndex = () => { throw new Error('not implemented: buildIndex'); };
export const searchTerms: SearchTerms = () => { throw new Error('not implemented: searchTerms'); };
export const retrieveForLesson: RetrieveForLesson = () => { throw new Error('not implemented: retrieveForLesson'); };

// review/state.json (core fsrs.ts): init from the plan; P2 due/grade.
// Owner: WP4. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import type { InitReview, DueFn, GradeFn, ReadReviewState } from './contracts.ts';
import type { ReviewState } from '@bilimind/core';
import { coursePaths, readJsonOrNull } from './course.ts';

export const initReview: InitReview = async () => { throw new Error('not implemented: initReview'); };
export const due: DueFn = async () => { throw new Error('not implemented: due'); };
export const grade: GradeFn = async () => { throw new Error('not implemented: grade'); };

export const readReviewState: ReadReviewState = course => readJsonOrNull<ReviewState>(coursePaths(course).reviewState);

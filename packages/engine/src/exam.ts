// `exam-map`: past paper -> questions -> topics by retrieval -> weights = share of marks. Deterministic, explainable (crew/exam-map.md).
// Owner: WP2. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import type { ParseExamQuestions, ExamMapFn, ReadExamMap } from './contracts.ts';
import type { ExamMap } from '@bilimind/core';
import { coursePaths, readJsonOrNull } from './course.ts';

export const parseExamQuestions: ParseExamQuestions = () => { throw new Error('not implemented: parseExamQuestions'); };
export const examMap: ExamMapFn = async () => { throw new Error('not implemented: examMap'); };

export const readExamMap: ReadExamMap = course => readJsonOrNull<ExamMap>(coursePaths(course).examMap);

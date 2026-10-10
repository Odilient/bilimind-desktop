// `draft`: one expand call per lesson (reasoning off) with its top-6 chunks; --note / --only; normalise; NO automatic re-ask.
// Owner: WP2. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import type { DraftFn, ReadLessonDraft, WriteLessonDraft } from './contracts.ts';
import type { LessonContent } from '@bilimind/core';
import { coursePaths, readJson, writeJson } from './course.ts';

export const draft: DraftFn = async () => { throw new Error('not implemented: draft'); };

export const readLessonDraft: ReadLessonDraft = (course, key) => readJson<LessonContent>(coursePaths(course).lessonJson(key));
export const writeLessonDraft: WriteLessonDraft = (course, content) => writeJson(coursePaths(course).lessonJson(content.key), content);

// Loads the course: the JSON embedded by `bilimind build` (prod), or the core fixture (vite dev server).
import { readEmbeddedCourse, validateCourse } from '@bilimind/core';
import type { Course } from '@bilimind/core';
import type { InjectionKey } from 'vue';

export const COURSE_KEY: InjectionKey<Course> = Symbol('bm-course');

export async function loadCourse(): Promise<{ course: Course | null; errors: string[] }> {
  let data: unknown = null;
  try { data = readEmbeddedCourse(document); } catch (e) { return { course: null, errors: [`course JSON does not parse: ${String(e)}`] }; }
  if (!data && import.meta.env.DEV) data = (await import('@bilimind/core/fixtures/course-ds-mini.json')).default;
  if (!data) return { course: null, errors: ['No course is embedded in this page.'] };
  const v = validateCourse(data);
  // A schema problem must never blank the page: render what we have and list the problems in the console.
  if (!v.ok) console.warn('[bilimind] course.json has problems:\n' + v.errors.join('\n'));
  // Always render the ORIGINAL object: zod's parse output strips keys the schema does not list, and the
  // schemas have no defaults/transforms, so the original is the same data plus any extra fields a lane added.
  return { course: data as Course, errors: v.errors };
}

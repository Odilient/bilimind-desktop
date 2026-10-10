// `build`: assemble course.json from crew/, validate (core validateCourse), paste into the template (core injectCourse), write index.html.
// Owner: WP4. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import type { AssembleCourse, BuildFn } from './contracts.ts';

export const assembleCourse: AssembleCourse = async () => { throw new Error('not implemented: assembleCourse'); };
export const build: BuildFn = async () => { throw new Error('not implemented: build'); };

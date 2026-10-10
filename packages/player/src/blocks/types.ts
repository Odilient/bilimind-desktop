// The block convention: every block is src/blocks/<PascalType>Block.vue (core blockComponentName(type)),
// e.g. worked_example -> WorkedExampleBlock.vue, with exactly these props. Auto-registered by registry.ts.
import type { Course, CourseBlock, CourseLesson, EnabledBlockType } from '@bilimind/core';

export type BlockOf<T extends EnabledBlockType> = Extract<CourseBlock, { type: T }>;
export interface BlockProps<T extends EnabledBlockType = EnabledBlockType> {
  block: BlockOf<T>;
  lesson: CourseLesson;
  course: Course;
}

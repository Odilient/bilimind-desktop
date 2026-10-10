// WP5b harness: every reading/visual block from the core fixture, inside the shell's real BlockFrame,
// with the shell's styles, sprite and cite popover. Built to one file:// page by shoot.mjs (screenshots +
// interaction checks); also works under `vite` dev at /src/blocks/reading/harness/index.html.
import { createApp } from 'vue';
import { blockSentences, fromSaasLesson } from '@bilimind/core';
import type { Course, CourseLesson, SaasLesson } from '@bilimind/core';
import fixture from '@bilimind/core/fixtures/course-ds-mini.json';
import s1 from '../../../../../../hackathon/research/engine-port-samples/lesson-bst-noreason.json';
import s2 from '../../../../../../hackathon/research/engine-port-samples/lesson-bst-pinned.json';
import s3 from '../../../../../../hackathon/research/engine-port-samples/lesson-bst-reasoning.json';
import { COURSE_KEY } from '../../../course.ts';
import { injectSprite } from '../../../sprite.ts';
import Harness from './Harness.vue';
import { PlaygroundRunner } from '../playground.ts';

// the shell's stylesheets (tokens, fonts, shell, blocks, extra, overlays), whatever their names
const styles = import.meta.glob('../../../styles/*.css', { eager: true });
void styles;

export const WP5B_TYPES = ['explainer', 'analogy', 'example', 'diagram', 'comparison', 'reference_table', 'timeline',
  'worked_example', 'playground', 'key_points', 'misconception', 'audio', 'reflection'] as const;

const course = fixture as unknown as Course;
// the first block of each type is the one the harness shows; its expected cue ids, keyed by type
const expected: Record<string, string[]> = {};
for (const t of WP5B_TYPES) {
  for (const l of course.lessons) {
    const b = l.blocks.find(x => x.type === t);
    if (b) { expected[t] = blockSentences(b).map(s => s.id); break; }
  }
}
// the three engine-port sample lessons (real model output), converted the way build.ts does it
const samples: CourseLesson[] = [s1, s2, s3].map((raw, i) => fromSaasLesson(raw as unknown as SaasLesson, {
  id: `sample${i + 1}`, n: 10 + i, title: `Sample lesson ${i + 1}`, archetype: 'conceptual',
}));
const sampleExpected: Record<string, string[]> = {};
for (const l of samples) for (const b of l.blocks) {
  if ((WP5B_TYPES as readonly string[]).includes(b.type)) sampleExpected[`${l.id}/${b.id}`] = blockSentences(b).map(s => s.id);
}
(window as unknown as { __bm: unknown }).__bm = { expected, sampleExpected, types: WP5B_TYPES, Runner: PlaygroundRunner };

injectSprite(document);
const app = createApp(Harness, { course, types: WP5B_TYPES, samples });
app.provide(COURSE_KEY, course);
app.mount('#app');

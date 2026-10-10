// WP5c test harness: renders the interactive blocks (and the rest through the registry) for every lesson of
// a course, inside the shell's real tokens and block styles, without the shell's routing. Built to one
// file:// page by vite.harness.config.ts; scripts/e2e.mjs drives it with puppeteer-core + Edge.
import { createApp, h } from 'vue';
import { readEmbeddedCourse } from '@bilimind/core';
import type { Course } from '@bilimind/core';
import fixture from '@bilimind/core/fixtures/course-ds-mini.json';
import '../../styles/tokens.css';
import '../../styles/blocks.css';
import '../../styles/overlays.css';
import { injectSprite } from '../../sprite.ts';
import { COURSE_KEY } from '../../course.ts';
import Harness from './Harness.vue';

let data: unknown = null;
try { data = readEmbeddedCourse(document); } catch { data = null; }
const course = (data ?? fixture) as Course;
injectSprite(document);
document.documentElement.classList.add('js');
const app = createApp({ render: () => h(Harness, { course }) });
app.provide(COURSE_KEY, course);
app.mount('#app');

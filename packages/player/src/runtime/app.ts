// App mode: the desktop app opens a course as index.html?app=1#/l/<id> inside its own workspace (sidebar,
// assistant). Then the website chrome goes (top bar, hero, footer, the path link in the lesson bar) and the
// lesson reads like a page in an app. Without the flag the published site is unchanged.
// The workspace reads a little state back through window.__bmApp (done lessons, the open lesson's parts).
import type { Course } from '@bilimind/core';
import { partLabel } from './model.ts';
import { progress } from './progress.ts';
import { route } from '../router.ts';

export const appMode: boolean = (() => {
  try { return /[?&]app=1(?:&|$)/.test(location.search); } catch { return false; }
})();

export interface AppPart { type: string; label: string; title: string; steps: number }
export interface AppBridge {
  done(): string[];
  route(): string;
  lesson(): { id: string; title: string; parts: AppPart[] } | null;
  /** The course as the workspace lists it (used when the app cannot read the course folder itself). */
  outline(): { title: string; lessons: { id: string; title: string; day?: number; minutes: number; route: string }[]; sources: { name: string; rel: string }[] };
}

export function exposeApp(course: Course): void {
  if (!appMode) return;
  document.documentElement.dataset.app = '1';
  const bridge: AppBridge = {
    done: () => Object.entries(progress.lessons).filter(([, v]) => v.done).map(([k]) => k),
    route: () => (route.name === 'lesson' ? route.lesson : ''),
    lesson: () => {
      const l = route.name === 'lesson' ? course.lessons.find(x => x.id === route.lesson) : undefined;
      if (!l) return null;
      return {
        id: l.id, title: l.title,
        parts: l.blocks.map(b => {
          const p = (b.payload ?? {}) as { steps?: unknown[] };
          return { type: b.type, label: partLabel(l, b), title: b.title ?? '', steps: Array.isArray(p.steps) ? p.steps.length : 0 };
        }),
      };
    },
    outline: () => {
      const dayOf = new Map<string, number>();
      course.plan.days.forEach((d, i) => d.lessons.forEach(id => { if (!dayOf.has(id)) dayOf.set(id, i + 1); }));
      return {
        title: course.title,
        lessons: course.lessons.map(l => ({ id: l.id, title: l.title, day: dayOf.get(l.id), minutes: l.minutes, route: `#/l/${encodeURIComponent(l.id)}` })),
        sources: course.sources.map(x => ({ name: x.file.split('/').pop() ?? x.file, rel: x.file })),
      };
    },
  };
  (window as unknown as { __bmApp: AppBridge }).__bmApp = bridge;
}

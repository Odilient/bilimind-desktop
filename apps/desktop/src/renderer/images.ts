// The landing's 3D objects (plan/reference/design/hero-v7/img/11/obj-*.webp), bundled as assets.
import book from './assets/obj-book.webp';
import calendar from './assets/obj-calendar.webp';
import cap from './assets/obj-cap.webp';
import check from './assets/obj-check.webp';
import docs from './assets/obj-docs.webp';
import globe from './assets/obj-globe.webp';
import mic from './assets/obj-mic.webp';
import rocket from './assets/obj-rocket.webp';
import trophy from './assets/obj-trophy.webp';
import type { CourseCard } from './env';

export const OBJ = { book, calendar, cap, check, docs, globe, mic, rocket, trophy };

/** A stable 3D object for a course card, picked from its title and sentence. */
export function objectFor(c: CourseCard): string {
  const t = `${c.title} ${c.sentence}`.toLowerCase();
  if (/shop|crew|sop|cafe|tea bar|boba|staff|kiosk|store|onboard/.test(t)) return check;
  if (/exam|final|paper|midterm|quiz/.test(t)) return cap;
  if (/malay|language|speak|bahasa|english|spanish|french|chinese/.test(t)) return globe;
  const pool = [book, docs, rocket, calendar, mic, trophy];
  let h = 0;
  for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

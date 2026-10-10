// The course workspace (CourseView): the player bridge it reads back, the assistant's openers, and a small
// safe renderer for answers (paragraphs, lists, bold, code, [n] citation chips).
import type { AssistantCite } from './env';

/** What the centre shows: a lesson or the course path (both in the player), or the plan / files panel. */
export type WorkView = 'lesson' | 'path' | 'plan' | 'files';

/** What the player exposes as window.__bmApp in app mode (packages/player/src/runtime/app.ts). */
export interface PlayerPart { type: string; label: string; title: string; steps: number }
export interface PlayerLesson { id: string; title: string; parts: PlayerPart[] }
export interface PlayerOutline {
  title: string;
  lessons: { id: string; title: string; day?: number; minutes: number; route: string }[];
  sources: { name: string; rel: string }[];
}

/** '#/l/<id>?b=x' or a full player URL -> '<id>' ('' for the course path). */
export function lessonIdOf(routeOrUrl: string): string {
  const hash = routeOrUrl.includes('#') ? routeOrUrl.slice(routeOrUrl.indexOf('#') + 1) : routeOrUrl;
  const m = /^\/?l\/([^/?&#]+)/.exec(hash);
  if (!m) return '';
  try { return decodeURIComponent(m[1]); } catch { return m[1]; }
}

/** Concrete openers from the parts of the open lesson (like the web's deriveOpeners): three from parts, one plain. */
export function deriveOpeners(lesson: PlayerLesson | null, title: string): string[] {
  if (!title) {
    return [
      'Summarise this course in five short points',
      'Which topics are most likely to come up, going by my files?',
      'Quiz me on the whole course, one question at a time',
      'Which of my files does this course lean on most?',
    ];
  }
  const out: string[] = [];
  const add = (q: string) => { if (out.length < 3 && !out.includes(q)) out.push(q); };
  for (const p of lesson?.parts ?? []) {
    switch (p.type) {
      case 'worked_example': case 'walkthrough':
        if (p.steps > 1) add(`Walk me through step ${Math.min(p.steps, Math.ceil(p.steps / 2) + 1)} of the ${p.type === 'walkthrough' ? 'walkthrough' : 'worked example'}`);
        break;
      case 'analogy': add('Where exactly does this analogy stop working?'); break;
      case 'code': case 'playground': add("I'm stuck on the code exercise. Give me a hint, not the answer"); break;
      case 'diagram': add('Talk me through the diagram one arrow at a time'); break;
      case 'comparison': add('Which of these would you actually pick, and why?'); break;
      case 'scenario': add('I picked wrong in the scenario. What was I missing?'); break;
      case 'misconception': add('Why is the common mix-up in this lesson wrong?'); break;
    }
  }
  if (out.length < 3) add('Quiz me on this lesson, one question at a time');
  if (out.length < 3) add('Which of my files does this lesson come from?');
  out.push(`Explain “${title}” to me like I have five minutes`);
  return out.slice(0, 4);
}

export function fmtAskCost(usd: number): string {
  if (!usd) return '$0';
  return '$' + (usd < 0.01 ? usd.toFixed(4) : usd.toFixed(3));
}

export function fmtBytes(n: number): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s: string, cites: Set<number>): string {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (m, list: string) => {
      const ns = list.split(/\s*,\s*/).map(Number);
      if (!ns.every((n) => cites.has(n))) return m;
      return ns.map((n) => `<button type="button" class="cite" data-n="${n}">${n}</button>`).join('');
    });
}

/** Answer text -> HTML. Everything is escaped first; only the tags written here come out. */
export function renderAnswer(text: string, cites: AssistantCite[] = []): string {
  const have = new Set(cites.map((c) => c.n));
  const parts = text.split('```');
  let html = '';
  parts.forEach((chunk, i) => {
    if (i % 2 === 1) { html += `<pre><code>${esc(chunk.replace(/^[a-z0-9+-]*\n/i, ''))}</code></pre>`; return; }
    for (const block of chunk.split(/\n{2,}/)) {
      const lines = block.split('\n').filter((l) => l.trim());
      if (!lines.length) continue;
      if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
        const ordered = /^\s*\d/.test(lines[0]);
        const items = lines.map((l) => `<li>${inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''), have)}</li>`).join('');
        html += ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
      } else if (/^#{1,4}\s/.test(lines[0]) && lines.length === 1) {
        html += `<p class="h">${inline(lines[0].replace(/^#+\s*/, ''), have)}</p>`;
      } else {
        html += `<p>${lines.map((l) => inline(l, have)).join('<br>')}</p>`;
      }
    }
  });
  return html;
}

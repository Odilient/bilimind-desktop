// Hash routing (file:// safe): #/ is the course home, #/l/<lessonId> a lesson.
// Query after the route: #/?from=<lessonId> (play the "path fills" run), #/?at=<lessonId> (scroll to that
// milestone), #/l/<id>?b=<blockId> (scroll to a part). ?now=YYYY-MM-DD pins today for demos (see time.ts).
import { reactive } from 'vue';

export interface Route { name: 'home' | 'lesson'; lesson: string; block: string; from: string; at: string; raw: string }

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '');
  const [path = '', query = ''] = raw.split('?');
  const q = new URLSearchParams(query);
  const m = path.match(/^\/?l\/([^/]+)/);
  return {
    name: m ? 'lesson' : 'home',
    lesson: m ? decodeURIComponent(m[1]!) : '',
    block: q.get('b') ?? '',
    from: q.get('from') ?? '',
    at: q.get('at') ?? '',
    raw,
  };
}

export const route = reactive<Route>(parseHash(typeof location !== 'undefined' ? location.hash : ''));

/** Keep a ?now= override across navigation so a pinned demo day survives route changes. */
function keepNow(hash: string): string {
  const m = (typeof location !== 'undefined' ? location.hash : '').match(/[?&]now=([^&]+)/);
  if (!m || /[?&]now=/.test(hash)) return hash;
  return hash + (hash.includes('?') ? '&' : '?') + 'now=' + m[1];
}

export function go(hash: string): void {
  const h = keepNow(hash.startsWith('#') ? hash : '#' + hash);
  if (location.hash === h) Object.assign(route, parseHash(h));
  else location.hash = h;
}

export const lessonHref = (id: string, block?: string): string => keepNow(`#/l/${encodeURIComponent(id)}${block ? `?b=${encodeURIComponent(block)}` : ''}`);
export const homeHref = (q = ''): string => keepNow(`#/${q ? `?${q}` : ''}`);

export function startRouter(): void {
  window.addEventListener('hashchange', () => Object.assign(route, parseHash(location.hash)));
}

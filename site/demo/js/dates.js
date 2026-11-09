/* The example is written as if today were Mon 9 Nov 2026 (see EXAMPLE.md). This moves every date in it so that
   "today" is the visitor's real today: "Thu 12 Nov" becomes three days from now, weekday names follow,
   and "Quiz 2 is in three days" stays true. ?today=2026-11-09 pins a day (for screenshots).
   The landing walks its static page once before the sections set up (D2.dt for strings made later);
   the course page walks its shell once and runs every template through shift in h(). */
(() => {
  const BASE = new Date(2026, 10, 9);
  const pin = new URLSearchParams(location.search).get('today');
  const now = pin ? new Date(pin + 'T00:00') : new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const DELTA = Math.round((today - BASE) / 864e5);

  const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MO = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const mIdx = (m) => MO.findIndex((x) => x.startsWith(m.slice(0, 3)));
  const wIdx = (w) => WD.findIndex((x) => x.slice(0, 3).toLowerCase() === w.slice(0, 3).toLowerCase());
  const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  /* names come out in the page's language (?lang=): the strings keep English day and month words so they
     can be found and shifted, and this is where they turn into the visitor's */
  const LANG = window.BILI_LANG || 'en';
  const intl = (o, d) => new Intl.DateTimeFormat(LANG, o).format(d);
  const wName = (i, long) => (LANG === 'en' ? (long ? WD[i] : WD[i].slice(0, 3)) : intl({ weekday: long ? 'long' : 'short' }, new Date(2026, 10, 8 + i)));
  const mName = (i, long) => (LANG === 'en' ? (long ? MO[i] : MO[i].slice(0, 3)) : intl({ month: long ? 'long' : 'short' }, new Date(2026, i, 1)));
  const fmtW = (i, like) => { const w = wName(i, like.length > 3); return like.length <= 3 && like === like.toUpperCase() ? w.toLocaleUpperCase(LANG) : w; };
  const fmtM = (i, like) => mName(i, like.length > 3 && like !== 'Sept');
  // the example runs Oct 2026 to Jul 2027
  const at = (day, m) => { const i = mIdx(m); return new Date(i >= 8 ? 2026 : 2027, i, +day); };

  const FULL = /\b(?:(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)(,?\s))?(\d{1,2})(?:(\s?[–-]\s?)(\d{1,2}))?(\s)(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\b/g;
  const WLONG = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(s?)\b/g;
  const WSHORT = /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun|MON|TUE|WED|THU|FRI|SAT|SUN)\b/g;

  const shiftBy = (s, D) => {
    if ((!D && LANG === 'en') || !s || typeof s !== 'string') return s;
    const keep = [];
    s = s.replace(FULL, (all, w, wsep, d1, rsep, d2, sp, m) => {
      const a = add(at(d1, m), D);
      let out;
      if (d2) {
        const b = add(at(d2, m), D);
        out = a.getMonth() === b.getMonth() ? `${a.getDate()}${rsep}${b.getDate()}${sp}${fmtM(a.getMonth(), m)}` : `${a.getDate()} ${fmtM(a.getMonth(), m)} – ${b.getDate()}${sp}${fmtM(b.getMonth(), m)}`;
      } else out = `${a.getDate()}${sp}${fmtM(a.getMonth(), m)}`;
      if (w) out = fmtW(a.getDay(), w) + wsep + out;
      keep.push(out);
      return `\u0001${keep.length - 1}\u0001`;
    });
    const wd = (w) => (wIdx(w) + (D % 7) + 7) % 7;
    s = s.replace(WLONG, (all, w, pl) => wName(wd(w), true) + (LANG === 'en' ? pl : ''));
    if (LANG !== 'en') s = s.replace(/\b(January|February|March|April|June|July|August|September|October|November|December)\b/g, (m) => mName(MO.indexOf(m), true));
    s = s.replace(WSHORT, (w) => fmtW(wd(w), w));
    return s.replace(/\u0001(\d+)\u0001/g, (all, i) => keep[+i]);
  };
  const shift = (s) => shiftBy(s, DELTA);
  console.assert(shiftBy('Mon 9 Nov', 5) === 'Sat 14 Nov' && shiftBy('Quiz 2 on Thursday', -2) === 'Quiz 2 on Tuesday' && shiftBy('9–15 November', -2) === '7–13 November'
    && shiftBy('Fri 27 Nov', 7) === 'Fri 4 Dec' && shiftBy('FRI', 1) === 'SAT' && shiftBy('Monday, 9 November', 0) === 'Monday, 9 November', 'date shift');

  /* text nodes and the few attributes that carry words; [data-day="2026-11-09"] holds a bare day number */
  const ATTRS = ['aria-label', 'title', 'alt', 'placeholder', 'data-text'];
  const walk = (root) => {
    if (!DELTA && LANG === 'en') return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement && /^(SCRIPT|STYLE)$/.test(n.parentElement.tagName) ? 2 : 1) });
    const nodes = []; while (tw.nextNode()) nodes.push(tw.currentNode);
    nodes.forEach((n) => { const v = shift(n.data); if (v !== n.data) n.data = v; });
    root.querySelectorAll('[' + ATTRS.join('],[') + ']').forEach((el) => ATTRS.forEach((a) => { if (el.hasAttribute(a)) el.setAttribute(a, shift(el.getAttribute(a))); }));
    root.querySelectorAll('[data-day]').forEach((el) => { el.textContent = add(new Date(el.dataset.day + 'T00:00'), DELTA).getDate(); });
  };
  const day = (iso) => add(new Date(iso + 'T00:00'), DELTA);

  /* the course page builds most of its HTML at runtime: shift every HTML string once, on its way in.
     shortcut: code that reads innerHTML back and writes it again would shift twice; the course page doesn't */
  const patchHTML = () => {
    if (!DELTA && LANG === 'en') return;
    const tr = (v) => shift(window.BILI_TR ? BILI_TR.html(String(v)) : String(v));
    const wrap = (proto, prop) => { const d = Object.getOwnPropertyDescriptor(proto, prop); Object.defineProperty(proto, prop, { ...d, set(v) { d.set.call(this, tr(v)); } }); };
    wrap(Element.prototype, 'innerHTML'); wrap(Element.prototype, 'outerHTML');
    const ia = Element.prototype.insertAdjacentHTML; Element.prototype.insertAdjacentHTML = function (pos, html) { return ia.call(this, pos, tr(html)); };
  };

  window.BILI_DATES = { shift, walk, day, patchHTML, delta: DELTA, today };
})();

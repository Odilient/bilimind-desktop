(() => {
  const SRC = window.BILI_I18N;
  if (!SRC) return;
  const norm = (s) => s.replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim();
  const dec = (s) => new DOMParser().parseFromString(s, 'text/html').documentElement.textContent;
  const raw = (s) => s.replace(/&(?![a-z#0-9]+;)/gi, '&amp;'); // a translation's own "&", for HTML
  const HTML = new Map(), TEXT = new Map(), BACK = new Map();
  for (const k in SRC) {
    const v = SRC[k];
    if (!v || v === k) continue;
    HTML.set(norm(k), raw(v));
    TEXT.set(norm(dec(k)), dec(v));
    BACK.set(norm(dec(v)), dec(k));
  }
  const keep = (s, t) => s.slice(0, s.length - s.trimStart().length) + t + s.slice(s.trimEnd().length);
  /* a plain string */
  const t = (s) => { const v = typeof s === 'string' && TEXT.get(norm(s)); return v || s; };
  /* the English a translated string came from (for the assistant's keyword matching) */
  const back = (s) => BACK.get(norm(s)) || s;
  const ATTRS = ['title', 'alt', 'aria-label', 'placeholder', 'data-tip', 'data-toast', 'data-text', 'data-follow', 'data-label'];
  const attrRe = new RegExp('(\\s(?:' + ATTRS.join('|') + ')=")([^"]*)(")', 'g');
  /* an HTML string: whole blocks that carry inline tags first, then each run of text, then attributes */
  const html = (h) => {
    if (typeof h !== 'string' || !/[A-Za-z]/.test(h)) return h;
    const whole = HTML.get(norm(h));
    if (whole) return keep(h, whole);
    h = h.replace(/(<(p|li|h3|blockquote|small|div|span|button|label|b|td|th)\b[^>]*>)((?:(?!<\/\2>)[\s\S])*?)(<\/\2>)/g, (m, o, tag, inner, c) => {
      if (!/</.test(inner)) return m;
      const v = HTML.get(norm(inner));
      return v ? o + keep(inner, v) + c : m;
    });
    h = h.replace(attrRe, (m, a, v, q) => { const x = TEXT.get(norm(dec(v))); return x ? a + x.replace(/"/g, '&quot;').replace(/&(?![a-z#0-9]+;)/gi, '&amp;') + q : m; });
    return h.replace(/>([^<>]+)(?=<|$)/g, (m, txt) => { const v = HTML.get(norm(txt)); return v ? '>' + keep(txt, v) : m; })
      .replace(/^([^<>]+)(?=<)/, (m, txt) => { const v = HTML.get(norm(txt)); return v ? keep(txt, v) : m; });
  };
  /* the page's own markup, once */
  const apply = (root) => {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = []; while (tw.nextNode()) nodes.push(tw.currentNode);
    nodes.forEach((n) => { const v = TEXT.get(norm(n.data)); if (v) n.data = keep(n.data, v); });
    root.querySelectorAll('[' + ATTRS.join('],[') + ']').forEach((el) => ATTRS.forEach((a) => {
      if (el.hasAttribute(a)) { const v = TEXT.get(norm(el.getAttribute(a))); if (v) el.setAttribute(a, v); }
    }));
    const ti = TEXT.get(norm(document.title)); if (ti) document.title = ti;
  };
  /* strings the page sets as text or placeholder at runtime */
  const wrap = (proto, prop) => {
    const d = Object.getOwnPropertyDescriptor(proto, prop);
    if (d && d.set) Object.defineProperty(proto, prop, { ...d, set(v) { d.set.call(this, t(v)); } });
  };
  wrap(Node.prototype, 'textContent');
  wrap(HTMLTextAreaElement.prototype, 'placeholder');
  wrap(HTMLInputElement.prototype, 'placeholder');
  window.BILI_TR = { t, html, back, apply };
})();

/* ════════════════════════════════════════════════════════════════════
   The sections this product adds: copy buttons, the problem's numbers
   and bars, entrance motion, and visible markers on {{PLACEHOLDERS}}
   that site/scripts/fill-numbers.mjs has not filled yet.
   ════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const STILL = document.documentElement.classList.contains('still');
const G = window.gsap && window.ScrollTrigger ? window.gsap : null;

/* ── Unfilled placeholders: wrap {{NAME}} text so it reads as "to do" ── */
(function markPlaceholders() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (/\{\{[A-Z0-9_]+\}\}/.test(n.nodeValue) && !n.parentElement.closest('script, style, .sr-only, .tbd')) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((n) => {
    const frag = document.createDocumentFragment();
    n.nodeValue.split(/(\{\{[A-Z0-9_]+\}\})/).forEach((part) => {
      if (!part) return;
      if (/^\{\{[A-Z0-9_]+\}\}$/.test(part)) {
        const s = document.createElement('span');
        s.className = 'tbd'; s.textContent = part; s.title = 'Not measured yet';
        frag.appendChild(s);
      } else frag.appendChild(document.createTextNode(part));
    });
    n.parentNode.replaceChild(frag, n);
  });
  // A link whose target is still a placeholder goes nowhere rather than to a broken path.
  $$('a[href*="{{"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.__copy && window.__copy.toast('The link is added when the repository goes public.');
    });
  });
})();

/* ── The 3D path needs three.js from the CDN; offline, show its still image instead ── */
setTimeout(() => { if (!window.__obj) document.documentElement.classList.add('no-webgl'); }, 5000);

/* ── Copy buttons in the install steps ── */
$$('[data-copy], [data-copy-from]').forEach((b) => {
  b.addEventListener('click', () => {
    const text = b.dataset.copy || ($('#' + b.dataset.copyFrom) || {}).textContent || '';
    const done = (ok) => {
      b.classList.toggle('ok', ok);
      window.__copy && window.__copy.toast(ok ? 'Copied.' : 'Select the text and copy it.');
      setTimeout(() => b.classList.remove('ok'), 1600);
    };
    if (window.__copy) window.__copy.copyText(text.trim()).then(done);
  });
});

if (STILL || !G) return;

/* ── The problem: 84 rolls up, the recall bars grow ── */
const odo = $('#problem .odo');
if (odo) {
  const n = +odo.dataset.n;
  const o = { v: 0 };
  odo.textContent = '0';
  G.to(o, {
    v: n, duration: 1.6, ease: 'power3.out',
    scrollTrigger: { trigger: '#problem .pb-grid', start: 'top 85%', once: true },
    onUpdate: () => { odo.textContent = Math.round(o.v); },
  });
}
G.from('#problem .bar i', { scaleX: 0, duration: 1.3, stagger: 0.25, ease: 'power3.out', scrollTrigger: { trigger: '#problem .pb-bars', start: 'top 85%', once: true } });
G.from('#problem .pb-head > *', { y: 28, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: '#problem', start: 'top 80%', once: true } });
G.from('#problem .pb-obj', { scale: 0.5, rotate: -30, opacity: 0, duration: 1.1, ease: 'back.out(1.8)', scrollTrigger: { trigger: '#problem .pb-grid', start: 'top 80%', once: true } });

/* ── Entrance motion, once per section ── */
const rise = (sel, trigger, extra = {}) => {
  if (!$$(sel).length) return;
  G.from(sel, { y: 40, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out', clearProps: 'transform,opacity', scrollTrigger: { trigger, start: 'top 85%', once: true }, ...extra });
};
rise('#crew .ro', '#crew .roster');
rise('#outputs .op-head > *', '#outputs');
rise('#outputs .op', '#outputs .op-grid', { stagger: 0.06 });
rise('#shop .sh-copy > *', '#shop');
rise('#shop .sh-course', '#shop .sh-visual');
rise('#courses .cs-head > *', '#courses');
rise('#courses .cs', '#courses .cs-grid', { stagger: 0.1 });
rise('#install .in-head > *', '#install');
rise('#install .st', '#install .in-steps', { stagger: 0.07 });
rise('#built .bt-side > *', '#built');
rise('#built .bt-col', '#built .bt-cols', { stagger: 0.12 });
rise('#team .tm-head > *', '#team');
rise('#team .tm', '#team .tm-grid', { stagger: 0.07 });

/* The generated objects drift against the scroll. */
G.utils.toArray('#outputs .op-obj, #courses .cs-obj').forEach((el, k) => {
  G.fromTo(el, { yPercent: k % 2 ? 14 : 8 }, {
    yPercent: k % 2 ? -14 : -8, rotate: '+=' + (k % 2 ? -8 : 6), ease: 'none',
    scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: 1 },
  });
});
G.fromTo('#shop .sh-pic img', { scale: 1.12, yPercent: -4 }, { scale: 1.02, yPercent: 4, ease: 'none', scrollTrigger: { trigger: '#shop', start: 'top bottom', end: 'bottom top', scrub: 1 } });

// Late layout shifts (fonts, images) move pinned sections: settle once everything has loaded.
addEventListener('load', () => ScrollTrigger.refresh());
})();

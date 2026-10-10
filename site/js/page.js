/* ════════════════════════════════════════════════════════════════════
   Page: the one field and its homes, the hero demo, bento, nav, FAQ,
   closing. Ported from the Cobalt landing (11/js/page.js) for
   BiliMind for WorkBuddy. The field is WorkBuddy's composer: it types
   the one sentence a user sends; "Copy for WorkBuddy" copies it and
   scrolls to the install steps. The 3D object (inline module) listens
   on window.__obj.
   ════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const STILL = document.documentElement.classList.contains('still');
const HAS_GSAP = !!(window.gsap && window.ScrollTrigger);
const PEEK = params.has('peek') ? Math.max(0, Math.min(2, +params.get('peek') || 0)) : null;
const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const obj = () => window.__obj;
// A tiny stand-in so the page still works if the GSAP CDN is unreachable.
const G = HAS_GSAP ? window.gsap : null;

const hero = $('#hero'), form = $('#gen'), field = $('#field'), ta = $('#topic'), go = $('#go');
const statusEl = $('#status'), dock = $('#dock'), toastEl = $('#toast');

/* ══ The field ══════════════════════════════════════════════════════ */
const twin = document.createElement('textarea');
twin.setAttribute('aria-hidden', 'true'); twin.tabIndex = -1; twin.rows = 1;
twin.style.cssText = 'position:absolute;left:-9999px;top:0;height:0;min-height:0;visibility:hidden;overflow:hidden;resize:none;border:0;box-sizing:border-box;';
document.body.appendChild(twin);
const LINE = 24, PAD = 26, MAXH = 170;
function textHeight(text, width) {
  const cs = getComputedStyle(ta);
  twin.style.font = cs.font; twin.style.letterSpacing = cs.letterSpacing;
  twin.style.padding = cs.padding; twin.style.width = width + 'px';
  twin.value = text;
  return Math.max(LINE + PAD, twin.scrollHeight);
}
let lines = 1;
function autosize() {
  const w = ta.clientWidth;
  if (!w) return;
  const full = textHeight(ta.value || ta.placeholder, w);
  const h = Math.min(MAXH, full);
  ta.style.height = h + 'px';
  ta.style.overflowY = full > MAXH ? 'auto' : 'hidden';
  const n = Math.max(1, Math.round((h - PAD) / LINE));
  field.classList.toggle('multi', n > 1);
  if (n !== lines) { lines = n; composeHero(); }
}
/* In the hero, a long sentence pushes the words above it aside: the
   paragraph folds away at two lines, the eyebrow at three, and the
   headline steps down a size. */
function composeHero() {
  const inHero = home === 'hero';
  hero.classList.toggle('comp-1', inHero && lines === 2);
  hero.classList.toggle('comp-2', inHero && lines >= 3);
  fitWord();
  setTimeout(fitWord, 260); setTimeout(fitWord, 560);
}
if (window.ResizeObserver) new ResizeObserver(() => autosize()).observe(field);

/* ── Headline: line two shrinks to fit beside the chips ── */
const word = $('#word'), wordIn = $('#wordIn'), wordWrap = $('#wordWrap');
function fitWord() {
  wordIn.style.transform = 'none';
  const room = wordWrap.clientWidth;
  if (!room) return;
  const s = Math.min(1, room / wordIn.scrollWidth);
  wordIn.style.transform = s < 1 ? `scale(${s})` : 'none';
}
addEventListener('resize', () => fitWord());

/* ── Chips: the cluster swaps to the course's formats ── */
const chipUses = [$('#ic1 use'), $('#ic2 use')];
const IDLE_ICONS = ['i-spark', 'i-path'];
function setChips(icons) {
  chipUses.forEach((u, i) => {
    const next = '#' + (icons[i] || IDLE_ICONS[i]);
    if (u.getAttribute('href') === next) return;
    const chip = u.closest('.chip');
    if (STILL || !G) { u.setAttribute('href', next); return; }
    G.timeline()
      .to(chip, { scale: 0.6, rotate: -25, duration: 0.18, ease: 'power2.in' })
      .add(() => u.setAttribute('href', next))
      .to(chip, { scale: 1, rotate: 0, duration: 0.5, ease: 'back.out(2.4)' });
  });
}

/* ══ The field's homes: hero, dock, park (the dock's slot, hidden), end ══ */
const SLOTS = { hero: $('#slotHero'), dock: $('#slotDock'), park: $('#slotDock'), end: $('#slotEnd') };
let home = 'hero';
const moveHooks = [];
let flight = null, quietT = 0;
function moveTo(name, how = 'fade') {
  if (name === home) return;
  const from = home;
  const hadFocus = document.activeElement === ta;
  const sel = hadFocus ? [ta.selectionStart, ta.selectionEnd] : null;
  SLOTS.hero.style.minHeight = name === 'hero' ? '' : form.offsetHeight + 'px';
  if (flight) { flight.progress(1); flight = null; }
  home = name;
  SLOTS[name].appendChild(form);
  dock.classList.toggle('on', name === 'dock');
  dock.inert = name !== 'dock';
  if (name === 'dock') { dock.classList.remove('quiet'); clearTimeout(quietT); quietT = setTimeout(() => dock.classList.add('quiet'), 3800); }
  if (name !== 'hero') hero.classList.remove('comp-1', 'comp-2');
  if (hadFocus) { ta.focus({ preventScroll: true }); try { ta.setSelectionRange(sel[0], sel[1]); } catch (_) { /* fine */ } }
  moveHooks.forEach((h) => h(name, from));
  autosize();
  if (name === 'hero') composeHero();
  if (STILL || !G || how === 'none' || name === 'park') return;
  flight = G.fromTo(form, { opacity: 0, y: name === 'dock' ? 0 : 10 }, {
    opacity: 1, y: 0, duration: name === 'dock' ? 0.35 : 0.5, ease: 'power2.out', clearProps: 'transform,opacity',
    onComplete: () => { flight = null; },
  });
}
/* Hero while its slot is on screen; the dock from there until the
   problem section arrives; parked through the middle of the page; the closing card
   when that arrives. */
const parkAt = $('#problem') || $('#crew');
function wanted() {
  const vh = innerHeight;
  if (SLOTS.end.getBoundingClientRect().top < vh * 0.92) return 'end';
  if (SLOTS.hero.getBoundingClientRect().bottom > 8) return 'hero';
  if (parkAt && parkAt.getBoundingClientRect().top < vh * 0.6) return 'park';
  return 'dock';
}
let placing = 0;
function place() {
  placing = 0;
  const w = wanted();
  if (w !== home) moveTo(w);
}
addEventListener('scroll', () => { if (!placing) placing = requestAnimationFrame(place); }, { passive: true });
addEventListener('resize', () => { if (!placing) placing = requestAnimationFrame(place); });

/* ══ Typing, focus, Enter ═══════════════════════════════════════════ */
let touched = false;
ta.addEventListener('focus', () => { touched = true; stopDemo(); });
ta.addEventListener('pointerdown', () => { touched = true; stopDemo(); });
ta.addEventListener('input', () => { touched = true; demoOwns = false; if (demoOn) stopDemo(); autosize(); });
ta.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); }
});

/* ══ Copying text, quietly (file:// and old browsers included) ══════ */
function copyText(text) {
  const fallback = () => {
    try {
      const t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(t); t.select();
      const ok = document.execCommand && document.execCommand('copy');
      t.remove();
      return !!ok;
    } catch (_) { return false; }
  };
  try {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true, () => fallback());
    }
  } catch (_) { /* fall through */ }
  return Promise.resolve(fallback());
}
let toastT = 0;
function toast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove('on'), 3200);
}
window.__copy = { copyText, toast };

/* ══ Submit: copy the sentence, then the install steps ══════════════ */
const DEFAULT_SENTENCE = 'My Data Structures final is Wednesday 9am. The slides and last year’s paper are in this folder. I have 45 minutes a day. Get me ready.';
let busy = false;
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (busy) return;
  // Pressed mid-demo: the sentence being typed is the one they meant.
  const demoText = demoOwns ? curDemo : '';
  stopDemo();
  touched = true;
  const text = demoText || ta.value.trim() || DEFAULT_SENTENCE;
  ta.value = text; autosize();
  busy = true;
  go.classList.add('busy');
  copyText(text).then((ok) => {
    const msg = ok ? 'Copied. Paste it into WorkBuddy once the skill is installed.' : 'Select the sentence and copy it, then paste it into WorkBuddy.';
    statusEl.textContent = msg;
    toast(msg);
  });
  sendOff(text);
  const after = () => {
    busy = false; go.classList.remove('busy');
    const target = $('#install');
    if (!target) return;
    // Far away (the pinned crew story sits in between): jump; near: glide.
    const far = Math.abs(target.getBoundingClientRect().top) > innerHeight * 3;
    target.scrollIntoView({ behavior: STILL || far ? 'auto' : 'smooth', block: 'start' });
  };
  if (G && !STILL) G.delayedCall(1.1, after); else after();
});
/** The words leave the field as a lime token. */
function sendOff(text) {
  if (STILL || !G) return;
  const r = ta.getBoundingClientRect();
  const t = document.createElement('div');
  t.className = 'token'; t.setAttribute('aria-hidden', 'true');
  t.style.position = 'fixed'; t.style.zIndex = 95;
  t.innerHTML = `<i>${icon('i-spark')}</i><span></span>`;
  t.lastChild.textContent = text.length > 34 ? text.slice(0, 33) + '…' : text;
  document.body.appendChild(t);
  ta.classList.add('lifting');
  G.timeline({ onComplete: () => { t.remove(); ta.classList.remove('lifting'); } })
    .set(t, { x: r.left + 4, y: r.top + 4, opacity: 0, scale: 0.9, transformOrigin: '0 50%' })
    .to(t, { opacity: 1, scale: 1, duration: 0.25, ease: 'power2.out' })
    .to(t, { y: r.top - 120, x: r.left + 40, scale: 1.08, duration: 0.8, ease: 'power3.in' }, '+=0.15')
    .to(t, { opacity: 0, duration: 0.3 }, '-=0.3');
}

/* ══ Bento: lesson faces for the demo courses ═══════════════════════ */
const ICON = {
  'Explainer': 'i-book', 'Speaking drill': 'i-mic', 'Dialogue': 'i-chat',
  'Worked example': 'i-pencil', 'Diagram': 'i-flow', 'Playground': 'i-sliders',
  'Checklist': 'i-list', 'Walkthrough': 'i-steps', 'Quiz': 'i-quiz', 'Comparison': 'i-scales',
  'Code exercise': 'i-code', 'Scenario': 'i-warning', 'Flashcards': 'i-cards', 'Reference table': 'i-table',
};
const DEMOS = [
  { sentence: DEFAULT_SENTENCE, lessons: [
    { t: 'Hash tables: load factor and probes', f: 'Playground', m: '18 min', p: '30% of last year’s marks' },
    { t: 'Binary heaps: insert, step by step', f: 'Code exercise', m: '15 min', p: '6 tests, run first' },
    { t: 'AVL rotations', f: 'Walkthrough', m: 'Cut', p: 'In no question: cut, with the reason in plan.md', cut: true },
  ] },
  { sentence: 'We hire new crew every few weeks. Turn our SOP folder into a day-one course they must pass before their first shift.', lessons: [
    { t: 'Brown-sugar milk tea, step by step', f: 'Walkthrough', m: '10 min', p: 'What goes wrong at each step' },
    { t: '“I can’t have dairy.”', f: 'Scenario', m: '8 min', p: 'Checked against the SOP' },
    { t: 'Opening and closing the shop', f: 'Checklist', m: '6 min', p: 'Pass mark 80%' },
  ] },
  { sentence: 'I’m an international student at Taylor’s with zero Malay. Make me a survival course for my first month: mamak, Grab, campus.', lessons: [
    { t: 'Ordering at the mamak', f: 'Dialogue', m: '12 min', p: 'Opening line voiced' },
    { t: 'Teh tarik kurang manis, satu', f: 'Speaking drill', m: '8 min', p: 'Record, compare, rate yourself' },
    { t: 'Numbers and prices', f: 'Flashcards', m: '6 min', p: 'Into your review schedule' },
  ] },
];
const cards = [$('#c1'), $('#c2'), $('#c3')];
const backs = $$('.face.back');
const flipped = [false, false, false];
function lessonHTML(i, L, writing) {
  const ic = writing ? 'i-dots' : (L.cut ? 'i-x' : (ICON[L.f] || 'i-book'));
  return `<div class="top"><span class="no">${L.cut ? 'Cut' : 'Lesson ' + String(i + 1).padStart(2, '0')}</span>
    <span class="fmt"><span class="fi">${icon(ic)}</span>${writing ? 'Picking a format…' : esc(L.cut ? 'Cut by the Lead' : L.f)}</span></div>
    <p class="lt${L.cut ? ' struck' : ''}">${writing ? 'Writing lesson ' + (i + 1) + '…' : esc(L.t)}</p>
    <div class="lm"><span>${writing ? '—' : esc(L.m)}</span><span class="bar"><i></i></span><span>${writing ? '' : esc(L.p)}</span></div>`;
}
function fillBacks(lessons, writing) {
  backs.forEach((b, i) => { b.classList.toggle('writing', !!writing); b.innerHTML = lessonHTML(i, lessons[i] || {}, writing); });
}
function flipTo(i, on, delay = 0) {
  if (flipped[i] === on) return;
  flipped[i] = on;
  const c = cards[i];
  if (STILL || !G) { c.classList.toggle('is-back', on); return; }
  G.killTweensOf(c);
  const d = on ? 1 : -1;
  G.timeline({ delay })
    .to(c, { rotateY: 90 * d, duration: 0.36, ease: 'power2.in' })
    .add(() => c.classList.toggle('is-back', on))
    .fromTo(c, { rotateY: -90 * d }, { rotateY: 0, duration: 0.55, ease: 'back.out(1.6)' });
}
function fillBar(i, dur = 1.2, delay = 0.3) {
  const bar = backs[i].querySelector('.bar i');
  if (!bar) return;
  if (!G) { bar.style.width = '100%'; return; }
  G.fromTo(bar, { width: '0%' }, { width: '100%', duration: STILL ? 0 : dur, delay: STILL ? 0 : delay, ease: 'power2.out' });
}

/* ══ The hero demo: it types into the field while nobody is ═════════ */
let demoOwns = false;
function typeInput(text, perChar = 0.03) {
  const tl = G.timeline();
  for (let i = 1; i <= text.length; i++) tl.add(() => { demoOwns = true; ta.value = text.slice(0, i); autosize(); }, i * perChar);
  return tl;
}
let demo = null, demoOn = !STILL && !!G && PEEK === null, di = 0, curDemo = '';
function playDemo() {
  if (!demoOn || touched || home !== 'hero') return;
  const D = DEMOS[di % DEMOS.length]; di++;
  curDemo = D.sentence;
  fillBacks(D.lessons, false);
  demo = G.timeline({ onComplete: () => { demo = null; playDemo(); } });
  demo.to({}, { duration: di === 1 ? 1.4 : 1.0 })
    .add(typeInput(D.sentence))
    .add(() => { setChips(D.lessons.slice(0, 2).map((l) => ICON[l.f])); obj() && obj().build(3); }, '+=0.25')
    .add(() => { go.classList.add('press'); }, '<')
    .add(() => { go.classList.remove('press'); }, '+=0.18')
    .add(() => { [0, 1, 2].forEach((i) => { flipTo(i, true, i * 0.16); fillBar(i, 1.1, 0.7 + i * 0.25); }); }, '+=0.15')
    .to({}, { duration: 5.4 })
    .add(() => { [0, 1, 2].forEach((i) => flipTo(i, false, (2 - i) * 0.1)); setChips([]); obj() && obj().reset(); })
    .add(() => { ta.value = ''; demoOwns = false; autosize(); }, '+=0.3')
    .to({}, { duration: 1.0 });
}
function stopDemo() {
  if (!demo && !demoOwns) { demoOn = false; return; }
  demoOn = false;
  if (demo) { demo.kill(); demo = null; }
  [0, 1, 2].forEach((i) => flipTo(i, false));
  setChips([]);
  go.classList.remove('press');
  if (demoOwns) { ta.value = ''; autosize(); }
  demoOwns = false;
  obj() && obj().reset();
}
moveHooks.push((to, from) => {
  if (from === 'hero' && (demo || demoOwns)) {
    const keep = touched; stopDemo(); touched = keep;
    demoOn = !STILL && !!G && !touched && PEEK === null;
  }
  if (to === 'hero' && demoOn && !demo && !touched && G) G.delayedCall(0.9, () => { if (home === 'hero' && !demo) playDemo(); });
});
hero.addEventListener('pointerdown', (e) => { if (!e.target.closest('.play, #go')) { touched = true; stopDemo(); } });

/* ══ Nav: frost after the top, hide on the way down ═════════════════ */
const nav = $('#nav');
const menu = $('#menu'), links = $('#links');
let lastY = scrollY;
addEventListener('scroll', () => {
  const y = scrollY;
  nav.classList.toggle('scrolled', y > 8);
  if (Math.abs(y - lastY) > 6) {
    nav.classList.toggle('away', y > lastY && y > innerHeight * 0.6 && !links.classList.contains('open'));
    lastY = y;
  }
}, { passive: true });
menu.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
});
links.addEventListener('click', (e) => { if (e.target.closest('a')) { links.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); } });

/* ══ Hero: ambient motion, pause off screen ═════════════════════════ */
let heroVisible = true;
if (!STILL && G) {
  G.fromTo('#sweep', { xPercent: 0, opacity: 0 }, { xPercent: 900, duration: 2.6, ease: 'power2.inOut', repeat: -1, repeatDelay: 5.5, delay: 1.2, keyframes: { opacity: [0, 1, 1, 0] } });
  $$('.tag', hero).forEach((t, i) => {
    G.fromTo(t, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, delay: 0.7 + i * 0.15, ease: 'power3.out' });
    G.to(t, { y: i % 2 ? 8 : -8, duration: 2.6 + i * 0.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.6 + i * 0.3 });
  });
  G.from('.copy > *', { y: 20, opacity: 0, duration: 0.9, stagger: 0.07, ease: 'power3.out', clearProps: 'transform,opacity' });
  G.from('.bento .flip', { y: 26, opacity: 0, duration: 0.9, stagger: 0.08, delay: 0.25, ease: 'power3.out', clearProps: 'transform,opacity' });
} else {
  fillBacks(DEMOS[0].lessons, false);
}
if (window.IntersectionObserver) new IntersectionObserver(([e]) => {
  heroVisible = e.isIntersecting;
  if (demo) { heroVisible ? demo.resume() : demo.pause(); }
  obj() && obj().pause(!heroVisible || document.hidden);
}).observe(hero);
document.addEventListener('visibilitychange', () => { obj() && obj().pause(document.hidden || !heroVisible); });

/* ══ FAQ ════════════════════════════════════════════════════════════ */
const QUESTIONS = [
  { q: 'WorkBuddy already has student experts that make exam outlines. Why this?', a: 'Those give you a summary to reread. This gives you practice that was executed and checked against your slides, a plan weighted by your past paper, and a review schedule that keeps running in your calendar after the chat ends.' },
  { q: 'Isn’t it just a script that WorkBuddy runs?', a: 'No. The judgment lives in WorkBuddy’s own agents: the Lead plans and cuts, Writers repair their own lessons, the Coder fixes failing tests, the Checker rules on every answer. Our code only does what must be deterministic: parsing files, the format table, schema checks, running tests, narration and packaging.' },
  { q: 'How do I know the answers are right?', a: 'Every quiz item cites a slide, and the Checker must quote that slide verbatim to support it; the code refuses a quote that isn’t really there. Contradicted answers are rewritten or dropped. Answers your slides don’t cover carry a visible “Beyond your slides” label instead of passing silently.' },
  { q: 'What does a course cost?', a: 'A few cents of text-model calls (DeepSeek direct by default) plus the WorkBuddy credits the agents use. The measured numbers for our runs are in the section above. Narration uses free neural voices.' },
  { q: 'Does it need a server or an account?', a: 'No. Everything runs on your machine inside WorkBuddy, and the course is one HTML file that works offline, from WorkBuddy’s Preview panel or any browser.' },
  { q: 'What did you build at the hackathon?', a: 'BiliMind existed as a web app; we reused its lesson prompts and archetype rules. Everything that runs in WorkBuddy was built at Dormathon: the engine port, the skill and its crew, the past-paper planner, the Checker and Coder loops, the offline player, the exports and the review schedule.' },
];
const faqList = $('#faqList');
QUESTIONS.forEach((item, k) => {
  const d = document.createElement('div');
  d.className = 'qa' + (k === 0 ? ' open' : '');
  d.innerHTML = `<button type="button" aria-expanded="${k === 0}" aria-controls="qa${k}" id="qb${k}">${esc(item.q)}<span class="pm" aria-hidden="true">${icon('i-plus')}</span></button>
    <div class="ans" id="qa${k}" role="region" aria-labelledby="qb${k}"><div><p>${esc(item.a)}</p></div></div>`;
  d.firstElementChild.addEventListener('click', () => {
    const open = d.classList.toggle('open');
    d.firstElementChild.setAttribute('aria-expanded', String(open));
  });
  faqList.appendChild(d);
});
if (!STILL && G) {
  G.from('#faqList .qa', { scrollTrigger: { trigger: '#faq', start: 'top 80%', once: true }, y: 24, opacity: 0, duration: 0.7, stagger: 0.07, ease: 'power3.out', clearProps: 'transform,opacity' });
  G.from('#start .closing .inner > *', { scrollTrigger: { trigger: '#start', start: 'top 75%', once: true }, y: 40, opacity: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out', clearProps: 'transform,opacity' });
  // The generated objects drift against the scroll, each at its own depth.
  const drift = (sel, trigger, v) => G.utils.toArray(sel).forEach((el, k) => {
    G.to(el, { scrollTrigger: { trigger, start: 'top bottom', end: 'bottom top', scrub: 1 }, yPercent: v[k][0], rotate: '+=' + v[k][1], ease: 'none' });
  });
  drift('#start .eo', '#start', [[-90, -6], [30, 16], [-30, 20], [40, -14]]);
  drift('#crew .how-head .ho', '#crew .how-head', [[-90, 18], [-50, -14]]);
  G.from('#start .eo', { scrollTrigger: { trigger: '#start', start: 'top 80%', once: true }, scale: 0.6, opacity: 0, duration: 1.1, stagger: 0.12, ease: 'back.out(1.6)' });
  G.from('#faq .faq-side > *', { scrollTrigger: { trigger: '#faq', start: 'top 80%', once: true }, y: 30, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out', clearProps: 'transform,opacity' });
}

/* ══ Start ══════════════════════════════════════════════════════════ */
autosize();
fitWord();
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => { autosize(); fitWord(); });
if (PEEK !== null) {
  const D = DEMOS[PEEK];
  ta.value = D.sentence; autosize();
  fillBacks(D.lessons, false);
  chipUses.forEach((u, i) => u.setAttribute('href', '#' + ICON[D.lessons[i].f]));
  [0, 1, 2].forEach((i) => { flipped[i] = true; cards[i].classList.add('is-back'); const b = backs[i].querySelector('.bar i'); if (b) b.style.width = '100%'; });
  let tries = 0;
  const fin = () => (obj() ? obj().build(3) : (++tries < 50 && setTimeout(fin, 100))); fin();
}
if (demoOn) playDemo();
place();
window.__page = { place, moveTo, autosize, fitWord, stopDemo, get home() { return home; } };
})();

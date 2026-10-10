/* ════════════════════════════════════════════════════════════════════
   Page: the one field and its homes, the hero demo, bento, film, nav,
   pricing, FAQ. The story (story.js) borrows the field through
   window.__field; the 3D object (obj.js) listens on window.__obj.
   ════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const STAY = params.has('stay');
const STILL = document.documentElement.classList.contains('still');
const PEEK = params.has('peek') ? Math.max(0, Math.min(2, +params.get('peek') || 0)) : null;
const START = 'https://bilimind.com/start';
const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const obj = () => window.__obj;

const hero = $('#hero'), form = $('#gen'), field = $('#field'), ta = $('#topic'), go = $('#go');
const statusEl = $('#status'), dock = $('#dock');

/* ══ The field ══════════════════════════════════════════════════════ */

/* It grows with what you write. A hidden twin measures the text so the
   height can transition (a textarea set to `auto` cannot). */
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
  // The headline resizes over half a second: refit as it goes.
  fitWord();
  setTimeout(fitWord, 260); setTimeout(fitWord, 560);
}
new ResizeObserver(() => autosize()).observe(field);

/** For the story: how tall the field will be with `text` in a slot `slotW` wide. */
function fieldHeightFor(text, slotW) {
  const narrow = innerWidth <= 900;
  const buildW = narrow ? 50 : Math.max(go.offsetWidth, 180);
  const taW = slotW - 14 - 50 - buildW - 8;
  return Math.min(MAXH, textHeight(text, taW)) + 14;
}

/* ── Headline: the middle word is whatever you are learning ── */
const word = $('#word'), wordIn = $('#wordIn'), wordWrap = $('#wordWrap'), caret = $('#caret');
let wordFull = 'Anything.';
function setWord(text) { wordFull = text; fitWord(); }
function fitWord() {
  const line = wordWrap.parentElement;
  line.classList.remove('long');
  word.textContent = wordFull;
  wordIn.style.transform = 'none';
  let room = wordWrap.clientWidth;
  if (!room) return;
  if (room / wordIn.scrollWidth < 0.5) { line.classList.add('long'); room = wordWrap.clientWidth; }
  let t = wordFull;
  while (room / wordIn.scrollWidth < 0.5 && t.length > 4) {
    t = t.slice(0, -2).replace(/[\s.,—–-]+$/, '');
    word.textContent = t + '…';
  }
  const s = Math.min(1, room / wordIn.scrollWidth);
  wordIn.style.transform = s < 1 ? `scale(${s})` : 'none';
}
/** "I want to learn Italian for my trip" → "Italian". */
function topicOf(text) {
  let t = text.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  t = t.replace(/^(?:i\s*(?:'|’)?\s*(?:m|am)?\s*(?:want|need|would like|(?:'|’)d like|wanna|have|hope)\s+to\s+)/i, '')
    .replace(/^(?:please\s+)?(?:learn|study|understand|master|get (?:better|good) at|really know|know|figure out|teach me(?: about)?|help me (?:learn|with|understand))\s+/i, '')
    .replace(/^(?:how to|about|the basics of|basics of|more about)\s+/i, '');
  const cut = t.split(/(?:\s+(?:for|so|because|before|by|so that|since|while|but|in order)\s+)|[,.;:!?—–]/i)[0].trim();
  const words = (cut || t).split(' ');
  return words.slice(0, 5).join(' ').replace(/[.!?]+$/, '');
}
const headlineFor = (text) => { const t = topicOf(text); return t ? t + '.' : 'Anything.'; };
addEventListener('resize', () => fitWord());

/* ── Chips: the cluster swaps to the course's formats ── */
const chipUses = [$('#ic1 use'), $('#ic2 use')];
const IDLE_ICONS = ['i-spark', 'i-path'];
function setChips(icons) {
  chipUses.forEach((u, i) => {
    const next = '#' + (icons[i] || IDLE_ICONS[i]);
    if (u.getAttribute('href') === next) return;
    const chip = u.closest('.chip');
    if (STILL) { u.setAttribute('href', next); return; }
    gsap.timeline()
      .to(chip, { scale: 0.6, rotate: -25, duration: 0.18, ease: 'power2.in' })
      .add(() => u.setAttribute('href', next))
      .to(chip, { scale: 1, rotate: 0, duration: 0.5, ease: 'back.out(2.4)' });
  });
}

/* ══ The field's four homes ═════════════════════════════════════════ */
const SLOTS = { hero: $('#slotHero'), dock: $('#slotDock'), story: $('#slotStory'), end: $('#slotEnd') };
let home = 'hero';
const moveHooks = [];
let flight = null;
/* The field never travels across the screen: it leaves one home and fades
   up in the next (the dock fades in and out around it). */
function moveTo(name, how = 'fade') {
  if (name === home) return;
  const from = home;
  const hadFocus = document.activeElement === ta;
  const sel = hadFocus ? [ta.selectionStart, ta.selectionEnd] : null;
  // The hero keeps the field's footprint, so nothing in the card moves.
  SLOTS.hero.style.minHeight = name === 'hero' ? '' : form.offsetHeight + 'px';
  if (flight) { flight.progress(1); flight = null; }
  home = name;
  SLOTS[name].appendChild(form);
  dock.classList.toggle('on', name === 'dock');
  dock.inert = name !== 'dock';
  if (name === 'dock') { dock.classList.remove('quiet'); clearTimeout(quietT); quietT = setTimeout(() => dock.classList.add('quiet'), 3800); }
  if (name !== 'hero') { hero.classList.remove('comp-1', 'comp-2'); }
  if (hadFocus) { ta.focus({ preventScroll: true }); try { ta.setSelectionRange(sel[0], sel[1]); } catch (_) {} }
  moveHooks.forEach((h) => h(name, from));
  autosize();
  if (name === 'hero') composeHero();
  if (STILL || how === 'none') return;
  flight = gsap.fromTo(form, { opacity: 0, y: name === 'dock' ? 0 : 10 }, {
    opacity: 1, y: 0, duration: name === 'dock' ? 0.35 : 0.5, ease: 'power2.out', clearProps: 'transform,opacity',
    onComplete: () => { flight = null; },
  });
}
let quietT = 0;

/* Where should the field be right now? Hero while its slot is on screen;
   the dock between the hero and the story; the story once its spot in the
   app scrolls into view (and after it — it scrolls away with it, as
   asked); the closing card when that arrives. */
function wanted() {
  const vh = innerHeight;
  const end = SLOTS.end.getBoundingClientRect();
  if (end.top < vh * 0.92) return 'end';
  const hs = SLOTS.hero.getBoundingClientRect();
  if (hs.bottom > 8) return 'hero';
  // The story's field sits in the app's create screen: the dock hands over
  // as soon as that spot scrolls into view.
  if (SLOTS.story.getBoundingClientRect().top > vh - 40) return 'dock';
  return 'story';
}
let placing = 0;
function place() {
  placing = 0;
  const w = wanted();
  if (w === home) return;
  moveTo(w);
}
addEventListener('scroll', () => { if (!placing) placing = requestAnimationFrame(place); }, { passive: true });
addEventListener('resize', () => { if (!placing) placing = requestAnimationFrame(place); });

/* The story may borrow the field: it stashes your words and gives them back. */
let stash = null, storyOwns = false, userTookStory = false;
const fieldApi = window.__field = {
  form, field, ta, go,
  get home() { return home; },
  onMove(fn) { moveHooks.push(fn); },
  fieldHeightFor,
  take() {
    if (storyOwns || userTookStory || STILL) return false;
    stash = ta.value; storyOwns = true;
    form.classList.add('borrowed');
    return true;
  },
  give() {
    if (!storyOwns) return;
    storyOwns = false; form.classList.remove('borrowed', 'lifted'); go.classList.remove('press');
    ta.value = stash || ''; stash = null; autosize();
  },
  type(text) {
    if (!storyOwns) return;
    if (ta.value !== text) { ta.value = text; autosize(); }
  },
  get owned() { return storyOwns; },
};
moveHooks.push((to, from) => {
  if (from === 'story') { fieldApi.give(); userTookStory = false; }
});
function userTakesBack() {
  if (storyOwns) { fieldApi.give(); userTookStory = home === 'story'; }
}

/* ══ Typing, focus, Enter ═══════════════════════════════════════════ */
let touched = false;    // the visitor has used the field: the demo stays off
ta.addEventListener('focus', () => { touched = true; userTakesBack(); stopDemo(); });
ta.addEventListener('pointerdown', () => { touched = true; userTakesBack(); stopDemo(); });
ta.addEventListener('input', () => {
  touched = true; demoOwns = false;
  if (demoOn) stopDemo();
  autosize();
  if (!busy) setWord(headlineFor(ta.value));
});
ta.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
});

/* ══ Files ══════════════════════════════════════════════════════════ */
const filesIn = $('#files'), chipsEl = $('#chips');
let files = [];
const pick = () => { touched = true; stopDemo(); filesIn.click(); };
$('#add').addEventListener('click', pick);
$('#attach').addEventListener('click', pick);
filesIn.addEventListener('change', () => { files = files.concat([...filesIn.files]); filesIn.value = ''; drawFiles(); });
function drawFiles() {
  chipsEl.innerHTML = '';
  files.forEach((f, k) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${esc(f.name)}</span><button type="button" aria-label="Remove ${esc(f.name)}">${icon('i-x')}</button>`;
    li.lastChild.addEventListener('click', () => { files.splice(k, 1); drawFiles(); });
    chipsEl.appendChild(li);
  });
  autosize();
}

/* ══ Submit: a short send-off, then the door ════════════════════════ */
let busy = false;
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (busy) return;
  if (storyOwns) { storyOwns = false; stash = null; form.classList.remove('borrowed'); } // Build on the example: it is theirs now
  stopDemo();
  const text = ta.value.trim();
  if (!text && !files.length) { if (!STAY) location.href = START; else ta.focus(); return; }
  busy = true;
  const label = text || files[0].name.replace(/\.[^.]+$/, '');
  statusEl.textContent = `Building a course on ${label}. Opening it next.`;
  go.classList.add('busy');
  if (home === 'hero') {
    setWord(headlineFor(label));
    setChips(['i-dots', 'i-dots']);
    obj() && obj().build(3, true);
    fillBacks([{}, {}, {}], true);
    [0, 1, 2].forEach((i) => flipTo(i, true, i * 0.14));
  }
  sendOff(topicOf(label) || label);
  gsap.delayedCall(STILL ? 0.3 : 1.7, () => {
    if (STAY) { busy = false; go.classList.remove('busy'); statusEl.textContent = 'Stayed on the page (?stay).'; return; }
    location.href = START + '?topic=' + encodeURIComponent(text);
  });
});
/** The words leave the field as a lime token. */
function sendOff(text) {
  if (STILL) return;
  const r = ta.getBoundingClientRect();
  const t = document.createElement('div');
  t.className = 'token'; t.setAttribute('aria-hidden', 'true');
  t.style.position = 'fixed'; t.style.zIndex = 95;
  t.innerHTML = `<i>${icon('i-spark')}</i><span></span>`;
  t.lastChild.textContent = text.length > 34 ? text.slice(0, 33) + '…' : text;
  document.body.appendChild(t);
  ta.classList.add('lifting');
  gsap.timeline({ onComplete: () => { t.remove(); ta.classList.remove('lifting'); } })
    .set(t, { x: r.left + 4, y: r.top + 4, opacity: 0, scale: 0.9, transformOrigin: '0 50%' })
    .to(t, { opacity: 1, scale: 1, duration: 0.25, ease: 'power2.out' })
    .to(t, { y: r.top - 120, x: r.left + 40, scale: 1.08, duration: 0.9, ease: 'power3.in' }, '+=0.25')
    .to(t, { opacity: 0, duration: 0.3 }, '-=0.3');
}

/* ══ Bento (09) ═════════════════════════════════════════════════════ */
const ICON = {
  'Explainer': 'i-book', 'Speaking drill': 'i-mic', 'Role-play dialogue': 'i-chat',
  'Worked example': 'i-pencil', 'Diagram': 'i-flow', 'Playground': 'i-sliders',
  'Checklist': 'i-list', 'Walkthrough': 'i-steps', 'Quiz': 'i-quiz', 'Comparison': 'i-scales',
};
const DEMOS = [
  { topic: 'Speaking Italian by June', word: 'Italian.', lessons: [
    { t: 'Sounds and greetings', f: 'Speaking drill', m: '12 min', p: 'Say it, get coached' },
    { t: 'Ordering politely: vorrei, not voglio', f: 'Role-play dialogue', m: '15 min', p: 'The barista answers back' },
    { t: 'Present tense, the regular verbs', f: 'Worked example', m: '14 min', p: 'Then a quiz on it' },
  ] },
  { topic: 'How black holes work', word: 'Black holes.', lessons: [
    { t: 'Escape velocity — and when light can’t', f: 'Explainer', m: '10 min', p: 'Four key points' },
    { t: 'The event horizon, drawn', f: 'Diagram', m: '8 min', p: 'Label it yourself' },
    { t: 'Tidal forces: spaghettification', f: 'Playground', m: '12 min', p: 'Drag the mass, watch it stretch' },
  ] },
  { topic: 'Sourdough from scratch', word: 'Sourdough.', lessons: [
    { t: 'Wild yeast, explained', f: 'Explainer', m: '8 min', p: 'Why the starter is alive' },
    { t: 'Feed your starter', f: 'Checklist', m: '6 min', p: 'Keep it open at the counter' },
    { t: 'Stretch and fold', f: 'Walkthrough', m: '14 min', p: 'Tick each fold as you go' },
  ] },
];
const cards = [$('#c1'), $('#c2'), $('#c3')];
const backs = $$('.face.back');
const flipped = [false, false, false];
function lessonHTML(i, L, writing) {
  const ic = writing ? 'i-dots' : (ICON[L.f] || 'i-book');
  const tail = i === 1
    ? `<button class="back-film" type="button" data-film>${icon('i-play')}Intro · 1:22</button>`
    : `<span>${writing ? '' : esc(L.p)}</span>`;
  return `<div class="top"><span class="no">Lesson ${String(i + 1).padStart(2, '0')}</span>
    <span class="fmt"><span class="fi">${icon(ic)}</span>${writing ? 'Picking a format…' : esc(L.f)}</span></div>
    <p class="lt">${writing ? 'Writing lesson ' + (i + 1) + '…' : esc(L.t)}</p>
    <div class="lm"><span>${writing ? '—' : L.m}</span><span class="bar"><i></i></span>${tail}</div>`;
}
function fillBacks(lessons, writing) {
  backs.forEach((b, i) => { b.classList.toggle('writing', !!writing); b.innerHTML = lessonHTML(i, lessons[i] || {}, writing); });
}
function flipTo(i, on, delay = 0) {
  if (flipped[i] === on) return;
  flipped[i] = on;
  const c = cards[i];
  gsap.killTweensOf(c);
  if (STILL) { c.classList.toggle('is-back', on); return; }
  const d = on ? 1 : -1;
  gsap.timeline({ delay })
    .to(c, { rotateY: 90 * d, duration: 0.36, ease: 'power2.in' })
    .add(() => c.classList.toggle('is-back', on))
    .fromTo(c, { rotateY: -90 * d }, { rotateY: 0, duration: 0.55, ease: 'back.out(1.6)' });
}
function fillBar(i, dur = 1.2, delay = 0.3) {
  const bar = backs[i].querySelector('.bar i');
  if (bar) gsap.fromTo(bar, { width: '0%' }, { width: '100%', duration: STILL ? 0 : dur, delay: STILL ? 0 : delay, ease: 'power2.out' });
}

/* ══ The hero demo: it types into the field while nobody is ═════════ */
function typeWord(text, perChar = 0.055) {
  const tl = gsap.timeline();
  const from = word.textContent.replace(/…$/, '');
  caret.classList.add('on');
  for (let i = from.length; i >= 0; i--) tl.add(() => setWord(from.slice(0, i) || ' '), (from.length - i) * 0.022);
  const base = from.length * 0.022 + 0.1;
  for (let i = 1; i <= text.length; i++) tl.add(() => setWord(text.slice(0, i)), base + i * perChar);
  tl.add(() => caret.classList.remove('on'), base + text.length * perChar + 0.5);
  return tl;
}
let demoOwns = false;
function typeInput(text, perChar = 0.042) {
  const tl = gsap.timeline();
  for (let i = 1; i <= text.length; i++) tl.add(() => { demoOwns = true; ta.value = text.slice(0, i); }, i * perChar);
  return tl;
}
let demo = null, demoOn = !STILL && PEEK === null, di = 0;
function playDemo() {
  if (!demoOn || touched || home !== 'hero') return;
  const D = DEMOS[di % DEMOS.length]; di++;
  fillBacks(D.lessons, false);
  demo = gsap.timeline({ onComplete: () => { demo = null; playDemo(); } });
  demo.to({}, { duration: di === 1 ? 1.8 : 1.2 })
    .add(typeInput(D.topic))
    .add(typeWord(D.word), '<0.2')
    .add(() => { setChips(D.lessons.slice(0, 2).map((l) => ICON[l.f])); obj() && obj().build(3); }, '>-0.3')
    .add(() => { [0, 1, 2].forEach((i) => { flipTo(i, true, i * 0.16); fillBar(i, 1.1, 0.7 + i * 0.25); }); }, '+=0.15')
    .to({}, { duration: 5.2 })
    .add(() => { [0, 1, 2].forEach((i) => flipTo(i, false, (2 - i) * 0.1)); setChips([]); obj() && obj().reset(); })
    .add(typeWord('Anything.', 0.04), '+=0.2')
    .add(() => { ta.value = ''; demoOwns = false; }, '<')
    .to({}, { duration: 1.2 });
}
function stopDemo() {
  if (!demo && !demoOwns) { demoOn = false; return; }
  demoOn = false;
  if (demo) { demo.kill(); demo = null; }
  [0, 1, 2].forEach((i) => flipTo(i, false));
  setChips([]);
  caret.classList.remove('on');
  if (demoOwns) { ta.value = ''; autosize(); }
  demoOwns = false;
  setWord(headlineFor(ta.value));
  obj() && obj().reset();
}
/* Leaving the hero ends the demo cleanly; coming back (untouched) resumes it. */
moveHooks.push((to, from) => {
  if (from === 'hero' && (demo || demoOwns)) {
    const keep = touched; stopDemo(); touched = keep;
    demoOn = !STILL && !touched && PEEK === null;
  }
  if (to === 'hero' && demoOn && !demo && !touched) gsap.delayedCall(0.9, () => { if (home === 'hero' && !demo) playDemo(); });
});
hero.addEventListener('pointerdown', (e) => { if (!e.target.closest('[data-film]')) { touched = true; stopDemo(); } });
$('.bento').addEventListener('pointerdown', (e) => { if (!e.target.closest('[data-film]')) { touched = true; stopDemo(); } });

/* ══ The film ═══════════════════════════════════════════════════════ */
const film = $('#film'), vid = $('#vid');
let opener = null, demoWasOn = false;
function openFilm(from) {
  opener = from;
  demoWasOn = !!demo;
  if (demo) demo.pause();
  obj() && obj().pause(true);
  film.showModal();
  $('#filmX').focus();
  try { vid.currentTime = 0; } catch (_) {}
  const p = vid.play(); if (p && p.catch) p.catch(() => {});
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-film]');
  if (b && !film.contains(b)) { e.preventDefault(); openFilm(b); }
});
$('#filmCard').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFilm(e.currentTarget); } });
$('#filmX').addEventListener('click', () => film.close());
film.addEventListener('click', (e) => { if (e.target === film) film.close(); });
film.addEventListener('close', () => {
  vid.pause();
  try { vid.currentTime = 0; } catch (_) {}
  obj() && obj().pause(!heroVisible);
  if (demoWasOn && demo) demo.resume();
  if (opener && opener.isConnected) opener.focus({ preventScroll: true });
});

/* ══ Nav: frost after the top, hide on the way down ═════════════════ */
const nav = $('#nav');
let lastY = scrollY;
addEventListener('scroll', () => {
  const y = scrollY;
  nav.classList.toggle('scrolled', y > 8);
  if (Math.abs(y - lastY) > 6) {
    nav.classList.toggle('away', y > lastY && y > innerHeight * 0.6 && !links.classList.contains('open'));
    lastY = y;
  }
}, { passive: true });
const menu = $('#menu'), links = $('#links');
menu.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
});
links.addEventListener('click', (e) => { if (e.target.closest('a')) { links.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); } });

/* ══ Hero: ambient motion, pause off screen ═════════════════════════ */
let heroVisible = true;
if (!STILL) {
  gsap.fromTo('#sweep', { xPercent: 0, opacity: 0 }, { xPercent: 900, duration: 2.6, ease: 'power2.inOut', repeat: -1, repeatDelay: 5.5, delay: 1.2, keyframes: { opacity: [0, 1, 1, 0] } });
  $$('.tag', hero).forEach((t, i) => {
    gsap.fromTo(t, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, delay: 0.7 + i * 0.15, ease: 'power3.out' });
    gsap.to(t, { y: i % 2 ? 8 : -8, duration: 2.6 + i * 0.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.6 + i * 0.3 });
  });
  gsap.from('.copy > *', { y: 20, opacity: 0, duration: 0.9, stagger: 0.07, ease: 'power3.out', clearProps: 'transform,opacity' });
  gsap.from('.bento .flip', { y: 26, opacity: 0, duration: 0.9, stagger: 0.08, delay: 0.25, ease: 'power3.out', clearProps: 'transform,opacity' });
} else {
  fillBacks(DEMOS[0].lessons, false);
}
new IntersectionObserver(([e]) => {
  heroVisible = e.isIntersecting;
  if (film.open) return;
  if (demo) { heroVisible ? demo.resume() : demo.pause(); }
  obj() && obj().pause(!heroVisible || document.hidden);
}).observe(hero);
document.addEventListener('visibilitychange', () => { obj() && obj().pause(document.hidden || !heroVisible || film.open); });

/* ══ Pricing ════════════════════════════════════════════════════════ */
const BILL = {
  m: { price: '$15', per: '/ month', note: 'Or $149 a year — two months on us.' },
  y: { price: '$149', per: '/ year', note: 'That’s $12.42 a month — two months on us.' },
};
$$('.pr-toggle button').forEach((b) => b.addEventListener('click', () => {
  $$('.pr-toggle button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  const B = BILL[b.dataset.bill];
  const price = $('#proPrice');
  if (price.textContent === B.price) return;
  const swap = () => { price.textContent = B.price; $('#proPer').textContent = B.per; $('#proNote').textContent = B.note; };
  if (STILL) { swap(); return; }
  gsap.timeline()
    .to(price, { yPercent: -60, opacity: 0, duration: 0.18, ease: 'power2.in' })
    .add(swap)
    .fromTo(price, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.42, ease: 'back.out(1.8)' });
}));
// The dots: twelve written lessons, or a hundred and fifty.
const dotsFree = $('#dotsFree'), dotsPro = $('#dotsPro');
dotsFree.innerHTML = '<i></i>'.repeat(12);
dotsPro.innerHTML = '<i></i>'.repeat(150);
if (STILL) { $$('i', dotsFree).concat($$('i', dotsPro)).forEach((d) => d.classList.add('on')); }
else {
  ScrollTrigger.create({
    trigger: '#pricing', start: 'top 70%', once: true,
    onEnter: () => {
      $$('i', dotsFree).forEach((d, k) => gsap.delayedCall(0.2 + k * 0.07, () => d.classList.add('on')));
      $$('i', dotsPro).forEach((d, k) => { const c = k % 15, r = Math.floor(k / 15); gsap.delayedCall(0.5 + (c + r) * 0.045, () => d.classList.add('on')); });
    },
  });
  gsap.from('.plan', { scrollTrigger: { trigger: '.pr-grid', start: 'top 85%', once: true }, y: 50, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out', clearProps: 'transform,opacity' });
}

/* ══ FAQ ════════════════════════════════════════════════════════════ */
const QUESTIONS = [
  { q: 'Is this just ChatGPT with extra steps?', a: 'A chat gives you prose and a quiz, every topic, every time. BiliMind decides what kind of knowledge a lesson holds and teaches it accordingly — then schedules it, grades it, and brings it back before you forget. The generating was never the hard part.' },
  { q: 'What happens when I fall behind?', a: 'The plan slides forward. No red, no backlog, no guilt. Mark days done or skipped and everything re-flows to the hours you actually have.' },
  { q: 'Can I change what it generates?', a: 'Everything. Edit in place, rewrite a paragraph, regenerate one lesson without touching the rest — and every version is kept, so you can always go back.' },
  { q: 'Does the free plan actually stay free?', a: 'Yes. 12 written lessons a month, and the schedule, reminders and review are free forever — that’s the habit the whole product exists to build, and it will never be a paywall.' },
  { q: 'Are the sources real?', a: 'Every link is verified before it reaches you. Dead links don’t ship, and made-up citations don’t exist here.' },
  { q: 'Where does it run?', a: 'Web, installable iOS and Android apps — and inside Telegram as a Mini App: opens from a chat, signs you in silently, no registration form at all. Courses come in 20 languages, narrated by 29 voices.' },
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
if (!STILL) {
  gsap.from('#faqList .qa', { scrollTrigger: { trigger: '#faq', start: 'top 80%', once: true }, y: 24, opacity: 0, duration: 0.7, stagger: 0.07, ease: 'power3.out', clearProps: 'transform,opacity' });
  gsap.from('#start .closing .inner > *', { scrollTrigger: { trigger: '#start', start: 'top 75%', once: true }, y: 40, opacity: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out', clearProps: 'transform,opacity' });
  // The generated objects drift against the scroll, each at its own depth.
  const drift = (sel, trigger, v) => gsap.utils.toArray(sel).forEach((el, k) => {
    gsap.to(el, { scrollTrigger: { trigger, start: 'top bottom', end: 'bottom top', scrub: 1 }, yPercent: v[k][0], rotate: '+=' + v[k][1], ease: 'none' });
  });
  drift('#start .eo', '#start', [[-90, -6], [30, 16], [-30, 20], [40, -14]]); // the rocket lifts off
  drift('#how .how-head .ho', '#how .how-head', [[-90, 18], [-50, -14]]);
  gsap.utils.toArray('.sec-obj').forEach((el, k) => gsap.fromTo(el, { yPercent: k % 2 ? 35 : 25 }, {
    scrollTrigger: { trigger: el.closest('section'), start: 'top bottom', end: 'bottom top', scrub: 1 },
    yPercent: k % 2 ? -35 : -25, rotate: '+=' + (k % 2 ? -14 : 12), ease: 'none',
  }));
  gsap.from('#start .eo', { scrollTrigger: { trigger: '#start', start: 'top 80%', once: true }, scale: 0.6, opacity: 0, duration: 1.1, stagger: 0.12, ease: 'back.out(1.6)' });
  gsap.from('#pricing .pr-head > *, #faq .faq-side > *', { scrollTrigger: { trigger: '#pricing', start: 'top 80%', once: true }, y: 30, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out', clearProps: 'transform,opacity' });
}

/* ══ Start ══════════════════════════════════════════════════════════ */
autosize();
fitWord();
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => { autosize(); fitWord(); });
if (PEEK !== null) {
  const D = DEMOS[PEEK];
  ta.value = D.topic; autosize(); setWord(D.word);
  fillBacks(D.lessons, false);
  chipUses.forEach((u, i) => u.setAttribute('href', '#' + ICON[D.lessons[i].f]));
  [0, 1, 2].forEach((i) => { flipped[i] = true; cards[i].classList.add('is-back'); const b = backs[i].querySelector('.bar i'); if (b) b.style.width = '100%'; });
  const fin = () => (obj() ? obj().build(3) : setTimeout(fin, 100)); fin();
}
if (demoOn) playDemo();
place();
window.__page = { place, moveTo, autosize, fitWord, stopDemo };
})();

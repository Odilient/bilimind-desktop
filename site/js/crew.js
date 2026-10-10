/* ════════════════════════════════════════════════════════════════════
   The crew story: one sentence in, the crew at work, a course out,
   inside a WorkBuddy-style task window.

   Pinned and scrubbed by scroll, fully reversible. Motion is tweens on
   one timeline; every discrete state (typed text, which task is ticking,
   which rail step is lit, the progress pill) is a pure function of the
   playhead in render(t). Without GSAP (or with ?still / reduced motion)
   the stage shows the resolved final frame.
   ════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const story = $('#cwStory');
if (!story) return;
const STILL = document.documentElement.classList.contains('still');
const G = window.gsap && window.ScrollTrigger ? window.gsap : null;
const params = new URLSearchParams(location.search);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

const feed = $('#cwFeed'), inner = $('#cwIn');
const said = $('#cwSaid'), typeEl = $('#cwType'), send = $('#cwSend');
const tasks = $$('#cwTasks li'), prog = $('#cwProg'), progT = $('span', prog);
const out = $('#cwOut'), preview = $('#cwPreview'), dim = $('#cwDim');
const caps = $$('#cwCap span'), steps = $$('#cwRail .sp');
const blocks = Object.fromEntries($$('[data-s]', inner).map((el) => [el.dataset.s, el]));

const SENTENCE = 'My Data Structures final is Wednesday 9am. The slides and last year’s paper are in this folder. I have 45 minutes a day. Get me ready.';
said.textContent = SENTENCE;

/* ── The script, in timeline seconds ── */
const T = {
  type0: 0.3, type1: 2.1, send: 2.25,
  lead: 2.7, weights: 3.0, cut: 4.4,
  dispatch: 5.2, writers: 5.5, writersEnd: 7.6,
  checks: 8.0, coderFail: 8.4, coderFix: 9.0, coderPass: 9.5, checkBad: 8.8, checkOk: 9.9,
  done: 10.8, preview: 11.4, total: 13.4,
};
// Which rail step / caption is lit, by time.
const STEP_AT = [0, 2.5, 5.0, 7.9, 10.6];
// When each of the nine tasks starts and finishes.
const TASK_AT = [
  [0.3, 2.6], [2.6, 3.0], [3.0, 5.0], [5.2, 7.7], [8.0, 9.6], [8.0, 10.0], [10.0, 10.4], [10.3, 10.8], [10.6, 11.0],
];

let tl = null, st = null;
const cache = new Map();
function setOnce(key, val, fn) { if (cache.get(key) !== val) { cache.set(key, val); fn(val); } }

function render(t) {
  // The composer types the sentence, then hands it to the transcript.
  const n = t >= T.send ? 0 : Math.floor(clamp01((t - T.type0) / (T.type1 - T.type0)) * SENTENCE.length);
  setOnce('type', n, (k) => {
    if (k === 0) typeEl.innerHTML = '<span class="ph">Ask WorkBuddy to do anything</span>';
    else { typeEl.textContent = SENTENCE.slice(0, k); const c = document.createElement('span'); c.className = 'car'; typeEl.appendChild(c); }
  });
  setOnce('press', t >= T.type1 && t < T.send + 0.1, (on) => send.classList.toggle('press', on));
  // Tasks.
  let doneN = 0;
  tasks.forEach((li, i) => {
    const [a, b] = TASK_AT[i];
    const s = t >= b ? 'done' : t >= a ? 'on' : '';
    if (s === 'done') doneN++;
    setOnce('task' + i, s, (v) => { li.classList.toggle('on', v === 'on'); li.classList.toggle('done', v === 'done'); });
  });
  setOnce('prog', doneN, (k) => { progT.textContent = k === tasks.length ? 'Done · 9 of 9 tasks' : `${k} of ${tasks.length} tasks`; prog.classList.toggle('done', k === tasks.length); });
  setOnce('out', t >= T.done, (on) => out.classList.toggle('on', on));
  // Rail and caption.
  let step = 0;
  STEP_AT.forEach((a, i) => { if (t >= a) step = i; });
  setOnce('step', step, (k) => {
    steps.forEach((s, i) => { s.classList.toggle('on', i === k); s.classList.toggle('done', i < k); });
    caps.forEach((c, i) => c.classList.toggle('on', i === k));
  });
}

/* ── The feed scrolls so the newest block is in view ── */
function feedYFor(el) {
  const viewH = feed.clientHeight;
  const bottom = el.offsetTop + el.offsetHeight + 24;
  return -Math.max(0, bottom - viewH);
}

const animated = new Set();
function build() {
  tl = G.timeline({ paused: true, defaults: { ease: 'power2.out' } });
  const reveal = (el, at, y = 14) => {
    if (!el) return;
    G.set(el, { autoAlpha: 0, y });
    animated.add(el);
    tl.to(el, { autoAlpha: 1, y: 0, duration: 0.35 }, at);
  };
  G.set(inner, { y: 0 });
  // 1 · Say it
  reveal(blocks.you, T.send, 10);
  // 2 · The Lead plans
  reveal(blocks.lead, T.lead);
  const wts = $$('.wt', blocks.lead);
  wts.forEach((w, k) => { G.set(w, { '--g': 0 }); animated.add(w); tl.to(w, { '--g': 1, duration: 0.5, ease: 'power3.out' }, T.weights + k * 0.18); });
  const cutline = $('.cutline', blocks.lead);
  reveal(cutline, T.cut, 6);
  // 3 · Writers in parallel
  reveal(blocks.dispatch, T.dispatch, 8);
  reveal(blocks.writers, T.writers);
  const ags = $$('.ag', blocks.writers);
  ags.forEach((a, k) => {
    const bar = $('.ab i', a), res = $('.ar', a);
    const end = T.writersEnd - [0.1, 0.55, 0.3, 0][k]; // parallel, but not in lockstep
    G.set(bar, { scaleX: 0 }); animated.add(bar);
    tl.to(bar, { scaleX: 1, duration: end - T.writers - 0.1, ease: 'none' }, T.writers + 0.1);
    reveal(res, end, 4);
  });
  // 4 · Coder and Checker in parallel
  reveal(blocks.checks, T.checks);
  const [fail, fix, pass] = $$('.tst', blocks.checks);
  reveal(fail, T.coderFail, 6); reveal(fix, T.coderFix, 6); reveal(pass, T.coderPass, 6);
  const [bad, ok] = $$('.vd', blocks.checks);
  reveal(bad, T.checkBad, 6); reveal(ok, T.checkOk, 6);
  // 5 · Delivered
  reveal(blocks.done, T.done);
  G.set(preview, { xPercent: 104 }); animated.add(preview);
  G.set(dim, { autoAlpha: 0 }); animated.add(dim);
  tl.to(dim, { autoAlpha: 1, duration: 0.5 }, T.preview)
    .to(preview, { xPercent: 0, duration: 0.7, ease: 'power3.out' }, T.preview);
  const pv = $$('.pv-hero, .pv-due, .pv-path li, .pv-rc', preview);
  pv.forEach((el, k) => reveal(el, T.preview + 0.35 + k * 0.08, 10));

  // The feed follows the newest block (measured with every block laid out).
  const follow = [[T.lead + 0.2, blocks.lead], [T.cut + 0.1, blocks.lead], [T.writers, blocks.writers], [T.checks, blocks.checks], [T.coderPass, blocks.checks], [T.done, blocks.done]];
  follow.forEach(([at, el]) => { animated.add(inner); tl.to(inner, { y: feedYFor(el), duration: 0.6, ease: 'power2.inOut' }, at); });

  tl.to({}, { duration: 0.01 }, T.total - 0.01);
  tl.eventCallback('onUpdate', () => render(tl.time()));
  render(0);
}

function make(progress) {
  if (!G || STILL) { finalFrame(); return; }
  build();
  const unit = Math.max(200, innerHeight * 0.3);
  st = ScrollTrigger.create({
    trigger: story, start: 'top top', end: () => '+=' + Math.round(T.total * unit),
    pin: true, anticipatePin: 1, scrub: 0.7, animation: tl, refreshPriority: 10,
    onUpdate: () => render(tl.time()),
  });
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  if (progress != null) seek(progress);
}
/* Reduced motion, or no GSAP: the resolved frame, the course delivered. */
function finalFrame() {
  render(T.total);
  steps.forEach((s, i) => { s.classList.toggle('done', i < steps.length - 1); s.classList.toggle('on', i === steps.length - 1); });
  const y = feedYFor(blocks.done);
  inner.style.transform = `translateY(${y}px)`;
}
function seek(p) {
  if (!st) return;
  scrollTo(0, st.start + p * (st.end - st.start));
  tl.progress(p);
  render(tl.time());
  window.__page && window.__page.place();
}
function teardown() {
  if (st) { st.kill(true); st = null; }
  if (tl) { tl.progress(0).kill(); tl = null; }
  if (G) G.set([...animated], { clearProps: 'all' });
  animated.clear();
  cache.clear();
}
let lastW = innerWidth, rz = 0;
addEventListener('resize', () => {
  if (innerWidth === lastW) return; // a phone's toolbar, not a new layout
  lastW = innerWidth;
  clearTimeout(rz);
  rz = setTimeout(() => { teardown(); make(null); }, 220);
});
if (G) ScrollTrigger.config({ ignoreMobileResize: true });

(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => {
  requestAnimationFrame(() => {
    make(params.has('crew') ? clamp01(+params.get('crew') || 0) : null);
    window.__crew = { get tl() { return tl; }, get st() { return st; }, T, seek, rebuild: () => { teardown(); make(); } };
  });
});
})();

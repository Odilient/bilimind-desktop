/* ════════════════════════════════════════════════════════════════════
   The story: one sentence in, a whole course out — inside the real app.

   The stage is BiliMind's own workspace (rail, top bar, course sidebar,
   tabs, assistant), redrawn in this page's colours. The page's one field
   lands in the app's "What do you want to learn?" screen; the story
   borrows it and types; three questions get tapped; the sidebar and the
   assistant slide in and the roadmap draws itself in the app's grammar
   (numbered topics on a spine, subtopics with badges, notes, a group);
   a click on topic 2 opens it as a tab and the camera zooms into the
   lesson (comparison, illustration, role-play, speaking drill, quiz);
   then it zooms out and a lime run marks the course done to Finished.

   Pinned and scrubbed by scroll, fully reversible: motion is tweens on
   one timeline, and every discrete state (which tab is open, what a
   pill says, which answer is picked) is a pure function of the playhead
   in render(t).
   ════════════════════════════════════════════════════════════════════ */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const STILL = document.documentElement.classList.contains('still');
const params = new URLSearchParams(location.search);
const F = window.__field;
const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = (v) => clamp(v, 0, 1);

const story = $('#story'), cam = $('#cam'), app = $('#app');
const sCreate = $('#sCreate'), sAsk = $('#sAsk'), sBoard = $('#sBoard'), sLesson = $('#sLesson');
const aSide = $('#aSide'), aAsst = $('#aAsst'), aTabs = $('#aTabs'), aMain = $('#aMain'), aPane = $('#aPane');
const tabMap = $('#tabMap'), tabLes = $('#tabLes'), aTr = $('#aTr'), aWr = $('#aWr');
const crumbC = $('#crumbC'), crumbN = $('#crumbN'), rPlus = $('#rPlus'), mapBtn = $('#mapBtn');
const mnav = $('.a-mnav', app), mnStudy = $('#mnStudy'), mnMap = $('#mnMap');
const sdList = $('#sdList'), asSug = $('#asSug'), asG = $('#asG');
const askTopic = $('#askTopic'), askN = $('#askN'), askBar = $('#askBar'), planBtn = $('#planBtn');
const qItems = $$('#qs .a-q'), qOpts = qItems.map((q) => $$('.a-opts b', q));
const bdView = $('#bdView'), bdCanvas = $('#bdCanvas'), bdCol = $('#bdCol'), bdBar = $('#bdBar'), bdPct = $('#bdPct');
const bdWires = $('#bdWires'), spine = $('#spine'), spineDraw = $('#spineDraw'), spineRun = $('#spineRun'), ties = $('#ties');
const lsView = $('#lsView'), lsIn = $('#lsIn'), lsBar = $('#lsBar'), lsPg = $('#lsPg'), lsDone = $('#lsDone');
const token = $('#token'), cursor = $('#cursor');
const caps = $$('#cap span'), steps = $$('#rail .sp');
const slotWrap = $('.st-slot-wrap', story);
const ex = document.createElement('span');
ex.className = 'ex'; ex.setAttribute('aria-hidden', 'true');
ex.innerHTML = `${icon('i-spark')}Example<span class="exl"> — your own words come back when you scroll on</span>`;
$('.a-eb', sCreate).appendChild(ex);

/* ── The course the sentence becomes, in the roadmap's grammar ── */
const COURSE = { title: 'Italian by June', lessons: 15, weeks: 4 };
const ROWS = [
  { sec: 'Getting by' },
  { n: 1, t: 'Sounds and greetings', ct: 3,
    L: [{ note: 'Say everything out loud — this course listens.' }],
    R: [{ t: 'The rolled R', m: 'rec' }, { t: 'Ciao or buongiorno?', m: 'any' }] },
  { n: 2, t: 'Ordering politely', ct: 3,
    L: [{ t: 'Vorrei, not voglio', m: 'rec' }, { t: 'Numbers to twenty', m: 'alt' }],
    R: [{ note: 'One word gets you a smile at the bar.' }] },
  { sec: 'Getting around' },
  { n: 3, t: 'Present tense: the regulars', ct: 4,
    L: [], R: [{ group: 'Verb families', items: ['-are · parlare', '-ere · prendere', '-ire · dormire'] }] },
  { n: 4, t: 'Asking the way', ct: 3,
    L: [{ t: 'Tu or Lei?', m: 'any' }, { t: 'Reading a street map', m: 'alt' }], R: [] },
  { n: 5, t: 'A ten-minute conversation', ct: 2, L: [], R: [{ fur: 'Then: Italian for work' }] },
];
const TOPICS = ROWS.filter((r) => r.n);
const CHAPTERS = [{ h: 'Getting by', ns: [1, 2] }, { h: 'Getting around', ns: [3, 4, 5] }];
const PICKS = [1, 0, 1]; // a few words · the trip · 3 hours
const SUG = {
  course: ['Explain “Italian by June” to me like I have five minutes', 'What should I be able to say before I land?', 'Make week one lighter — I’m busy'],
  lesson: ['Is voglio actually rude, or just blunt?', 'Quiz me on what to say at the bar', 'Which of these would a Roman actually say?'],
};
const PAGER = ['Explanation', 'Comparison', 'Illustration', 'Role-play', 'Speaking drill', 'Check yourself'];
const promptFor = () => innerWidth <= 900
  ? 'Rome in June — I want to order coffee, ask the way and chat a little in Italian.'
  : 'I’m going to Rome in June. I want to order coffee, ask the way and chat a little — in Italian.';

function leafHTML(x) {
  if (x.note) return `<div class="bd-note" data-pop>${icon('i-spark')}<span>${esc(x.note)}</span></div>`;
  if (x.group) return `<div class="bd-grp" data-pop><em>${esc(x.group)}</em>${x.items.map((i) => `<span class="bd-s">${esc(i)}</span>`).join('')}</div>`;
  if (x.fur) return `<span class="bd-fur" data-pop>${icon('i-plus')}${esc(x.fur)}</span>`;
  return `<span class="bd-s" data-pop><i class="mk ${x.m}">${icon('i-check')}</i>${esc(x.t)}</span>`;
}
bdCol.innerHTML = `<div class="bd-title" id="bdTitle" data-pop><span class="dt0"></span><b>${esc(COURSE.title)}</b><small>5 topics · ${COURSE.lessons} lessons · 3 hrs a week</small></div>`
  + ROWS.map((r) => (r.sec
    ? `<div class="bd-sec" data-pop>${esc(r.sec)}</div>`
    : `<div class="bd-row"><div class="bd-l">${r.L.map(leafHTML).join('')}</div><div class="bd-m" data-pop><span class="no"><b>${r.n}</b>${icon('i-check')}</span><span>${esc(r.t)}</span></div><div class="bd-r">${r.R.map(leafHTML).join('')}</div></div>`)).join('')
  + `<div class="bd-fin" id="bdFin" data-pop><span class="ck">${icon('i-check')}</span>Finished.<span class="bd-burst" id="burst"></span></div>`;
sdList.innerHTML = CHAPTERS.map((c) => `<div class="sd-ch" data-sd>${esc(c.h)}</div>` + c.ns.map((n) => {
  const tp = TOPICS[n - 1];
  const subs = n !== 2 ? '' : TOPICS[1].L.map((s) => `<div class="sd-sub" data-sub><i></i><span>${esc(s.t)}</span><b></b></div>`).join('');
  return `<div class="sd-row" data-sd data-s="writing"><svg class="cv" aria-hidden="true"><use href="#i-chev"/></svg><span class="nm"><b>${n}</b>${icon('i-check')}</span><span class="tt">${esc(tp.t)}</span><span class="dt"></span><span class="sd-c">${tp.ct}</span></div>${subs}`;
}).join('')).join('');

const title = $('#bdTitle'), finEl = $('#bdFin');
const rows = $$('.bd-row', bdCol), mileEls = rows.map((r) => $('.bd-m', r));
const secEls = $$('.bd-sec', bdCol);
const sdHeads = $$('.sd-ch', sdList), sdRows = $$('.sd-row', sdList), sdSubs = $$('.sd-sub', sdList);
const blocks = $$('.lb', lsIn);
const pins = $$('.ill .pin', lsIn);
const msgs = $$('#msgs .m:not(.typing)'), typing = $('#typing'), goal = $('#goal'), gok = $('#gok');
const mic = $('#mic'), micL = $('#micL'), wave = $('#wave'), att = $('#att'), spPct = $('#spPct'), heard = $('#heard'), wBad = $('#wBad'), tipT = $('#tipT');
const qRight = $('#qRight'), qSub = $('#qSub'), qHint = $('#qHint'), qWhy = $('#qWhy');
const enN = $('#enN'), enBar = $('#enBar'), enDone = $('#enDone');
wave.innerHTML = '<i></i>'.repeat(34);
const bars = $$('i', wave);
const VOICE = bars.map((_, k) => 0.25 + 0.75 * Math.abs(Math.sin(k * 0.9) * Math.sin(k * 0.37 + 1.1)));
const burstEl = $('#burst');
burstEl.innerHTML = '<i></i>'.repeat(14);
const bursts = $$('i', burstEl);

/* ── Geometry, in the app's own (unzoomed) coordinates ── */
let narrow = false;
function setOpen(open) {
  if (narrow) return;
  aSide.style.width = open ? $('.sd-in', aSide).offsetWidth + 'px' : '0px';
  aAsst.style.width = open ? $('.as-in', aAsst).offsetWidth + 'px' : '0px';
  aTabs.style.height = open ? '42px' : '0px';
}
function measure() {
  narrow = innerWidth <= 900;
  gsap.set(app, { x: 0, y: 0, scale: 1 });
  gsap.set([bdCanvas, lsIn], { y: 0 });
  const A = app.getBoundingClientRect();
  const loc = (el, o = A) => {
    const r = el.getBoundingClientRect();
    return { l: r.left - o.left, t: r.top - o.top, r: r.right - o.left, b: r.bottom - o.top, w: r.width, h: r.height,
      cx: r.left - o.left + r.width / 2, cy: r.top - o.top + r.height / 2 };
  };
  const G = { prompt: promptFor() };

  // Steps 1–2 happen in the closed app: no sidebar, no assistant, no tabs.
  setOpen(false);
  const sw = loc(slotWrap);
  const fh = F.fieldHeightFor(G.prompt, sw.w);
  const buildW = narrow ? 50 : Math.max(F.go.offsetWidth, 180);
  G.go = { x: sw.r - 7 - buildW / 2, y: sw.t + fh - 7 - 25 };
  G.picks = qOpts.map((o, i) => loc(o[PICKS[i]]));
  G.plan = loc(planBtn);
  askTopic.textContent = G.prompt;
  G.topic = askTopic.offsetParent ? loc(askTopic) : { ...G.plan }; // phones hide the topic line

  // From the roadmap on, the app is open.
  setOpen(true);
  const C = bdCanvas.getBoundingClientRect();
  const barH = $('.bd-bar', sBoard).offsetHeight;
  bdCol.style.paddingTop = (barH + (narrow ? 14 : 22)) + 'px';
  const cl = (el) => loc(el, C);
  G.viewH = bdView.clientHeight; G.barH = barH;
  G.title = cl($('b', title)); G.titleApp = loc($('b', title));
  G.miles = mileEls.map(cl); G.secs = secEls.map(cl); G.fin = cl(finEl);
  G.rows = rows.map(cl);
  G.canvasH = bdCanvas.offsetHeight;
  G.maxY = Math.max(0, G.canvasH - G.viewH);
  // The spine, and a dotted tie from each topic to what hangs off it.
  bdWires.setAttribute('viewBox', `0 0 ${C.width} ${G.canvasH}`);
  bdWires.style.height = G.canvasH + 'px';
  const x0 = narrow ? G.miles[0].l - 14 : G.miles[0].cx;
  G.y0 = narrow ? G.title.cy : cl($('.dt0', title)).cy; G.y1 = G.fin.cy;
  spine.setAttribute('d', `M${x0} ${G.y0} V${G.y1}`);
  spineDraw.setAttribute('d', `M${x0} ${G.y0} V${G.y1}`);
  spineRun.setAttribute('d', `M${x0} ${G.miles[0].cy} V${G.y1}`);
  ties.innerHTML = '';
  G.ties = rows.map((row, i) => {
    const m = G.miles[i];
    return [...$('.bd-l', row).children, ...$('.bd-r', row).children].filter((el) => getComputedStyle(el).display !== 'none').map((el) => {
      const b = cl(el), left = b.cx < m.cx;
      let d;
      if (narrow) d = `M${m.l + 12} ${m.b} V${b.cy} H${b.l}`;
      else if (left) d = `M${m.l} ${m.cy} C${m.l - 28} ${m.cy} ${b.r + 28} ${b.cy} ${b.r} ${b.cy}`;
      else d = `M${m.r} ${m.cy} C${m.r + 28} ${m.cy} ${b.l - 28} ${b.cy} ${b.l} ${b.cy}`;
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('class', 'tie'); p.setAttribute('d', d); p.style.opacity = 0;
      ties.appendChild(p);
      return { p, el };
    });
  });
  const span = Math.max(1, G.y1 - G.y0);
  G.fracM = G.miles.map((m) => clamp01((m.cy - G.y0) / span));
  G.fracS = G.secs.map((s) => clamp01((s.cy - G.y0) / span));
  G.fracRun = G.miles.map((m) => clamp01((m.cy - G.miles[0].cy) / Math.max(1, G.y1 - G.miles[0].cy)));
  // The board's camera: keep the newest thing in the lower part of the view.
  G.yAt = (y, k = 0.68) => -clamp(y - (G.barH + (G.viewH - G.barH) * k), 0, G.maxY);
  // Topic 2, where the click lands (and where its lesson grows from).
  G.yFocus = G.yAt(G.miles[1].cy, 0.5);
  const P = loc(aPane), mApp = loc(mileEls[1]);
  G.mile2 = { l: mApp.l, t: mApp.t + G.yFocus, r: mApp.r, b: mApp.b + G.yFocus, cx: mApp.cx, cy: mApp.cy + G.yFocus };
  G.clip0 = `inset(${G.mile2.t - P.t}px ${P.r - G.mile2.r}px ${P.b - G.mile2.b}px ${G.mile2.l - P.l}px round 12px)`;
  G.tabMap = loc(tabMap);

  // The lesson, and the camera that zooms into it. Measure it whole:
  // every message, the score and the quiz's answer showing.
  [...msgs, gok, att, qWhy].forEach((el) => { el.style.display = ''; });
  typing.style.display = 'none';
  const M = loc(narrow ? aPane : aMain), camR = cam.getBoundingClientRect();
  const offX = A.left - camR.left, offY = A.top - camR.top;
  G.S = narrow ? 1 : clamp((camR.width * 0.96) / M.w, 1, 1.4);
  G.zx = narrow ? 0 : (camR.width - G.S * M.w) / 2 - offX - G.S * M.l;
  G.zy = narrow ? 0 : 6 - offY - G.S * M.t;
  const V = loc(lsView), I = lsIn.getBoundingClientRect();
  const visBottom = narrow ? V.b : Math.min(V.b, (camR.height - offY - G.zy) / G.S);
  G.barTop = lsBar.offsetTop; G.barH = lsBar.offsetHeight;
  const effH = Math.max(160, visBottom - V.t);           // what the camera shows of the lesson
  const maxScroll = Math.max(0, lsIn.offsetHeight - effH);
  const at = (el) => loc(el, I);
  G.blocks = blocks.map(at);
  // Scroll keys: each block comes up under the sticky bar; tall ones scroll on as they fill.
  const top = (y) => clamp(y - G.barH - 12, 0, maxScroll);
  const end = (y) => clamp(y - effH + 16, 0, maxScroll);
  G.sk = (k) => (k < 2 ? 0 : top(G.blocks[k].t));
  G.skEnd = (k) => Math.max(G.sk(k), end(G.blocks[k].b));
  G.lsV = V;
  const inL = (el) => { const r = at(el); return { x: V.l + r.cx, y: V.t + r.cy }; };
  G.qRight = inL(qRight); G.qSub = inL(qSub);
  const d = at(lsDone);
  G.lsDone = { x: V.l + d.cx, y: V.t + (d.cy - G.barTop) }; // the bar is stuck to the top by then
  G.appW = A.width; G.appH = A.height;
  setOpen(false);
  return G;
}

/* ── Discrete state, as a function of the playhead ── */
const cache = new Map();
const once = (key, val, fn) => { if (cache.get(key) !== val) { cache.set(key, val); fn(val); } };
const show = (el, v, key) => once(key, v, () => { el.style.display = v ? '' : 'none'; });
const cls = (el, c, v, key) => once(key, v, () => el.classList.toggle(c, v));
const txt = (el, s, key) => once(key, s, () => { el.innerHTML = s; });

let T = null, G = null, tl = null, st = null;
function phase(t) {
  if (t < T.askIn) return 'create';
  if (t < T.lift) return 'ask';
  if (t >= T.les0 && t < T.out1) return 'lesson';
  return 'board';
}
function render(t) {
  if (!T) return;
  const ph = phase(t);

  // The field: typed while the create screen is up.
  if (F.home === 'story' && F.owned) {
    const n = clamp01((t - T.type0) / (T.type1 - T.type0));
    F.type(G.prompt.slice(0, Math.round(n * G.prompt.length)));
    once('press', t >= T.press && t < T.press + 0.16, (v) => F.go.classList.toggle('press', v));
  }
  once('ex', F.home === 'story' && F.owned && t > T.type0 && t < T.askIn, (v) => sCreate.classList.toggle('ex-on', v));

  // App chrome.
  once('crumb', ph, () => {
    crumbC.textContent = ph === 'create' || ph === 'ask' ? 'New course' : COURSE.title;
    crumbN.textContent = ph === 'create' ? 'What do you want to learn?' : ph === 'ask' ? 'About you' : ph === 'lesson' ? 'Ordering politely' : 'Roadmap';
    rPlus.classList.toggle('on', ph === 'create' || ph === 'ask');
    mapBtn.classList.toggle('on', ph === 'board');
    tabMap.classList.toggle('on', ph === 'board');
    tabLes.classList.toggle('on', ph === 'lesson');
    mnMap.classList.toggle('on', ph === 'board');
    mnStudy.classList.toggle('on', ph === 'lesson');
    const L = ph === 'lesson';
    $('#asSeg1').classList.toggle('on', L); $('#asSeg2').classList.toggle('on', !L);
    asG.innerHTML = `Grounded in <b>${L ? 'this lesson' : 'this course'}</b>. Tap a starting point:`;
    asSug.innerHTML = SUG[L ? 'lesson' : 'course'].map((s) => `<span>${esc(s)}</span>`).join('');
  });
  cls(tabLes, 'gone', t < T.les0, 'tabLes');

  // Questions.
  let answered = 0;
  qOpts.forEach((opts, i) => {
    const on = t >= T.pick[i]; if (on) answered++;
    opts.forEach((b, k) => cls(b, 'on', on && k === PICKS[i], `q${i}${k}`));
    cls(qItems[i], 'ok', on, 'qi' + i);
  });
  txt(askN, `${answered}/3`, 'askN');
  once('askBar', answered, (n) => { askBar.style.width = (n / 3 * 100) + '%'; });
  cls(planBtn, 'press', t >= T.plan && t < T.plan + 0.16, 'planPress');

  // The written count, and the course's state.
  let written = 0;
  TOPICS.forEach((tp, i) => { if (t >= T.ready[i]) written += tp.ct; });
  const doneN = TOPICS.filter((_, i) => t >= T.done[i]).length;
  if (t >= T.finish) once('wr', 'fin', () => { aWr.dataset.k = 'done'; aWr.lastChild.textContent = `Finished in ${COURSE.weeks} weeks`; });
  else once('wr', written, () => { aWr.dataset.k = written < COURSE.lessons ? 'writing' : 'written'; aWr.lastChild.textContent = `${written} of ${COURSE.lessons} lessons written`; });
  once('pct', doneN, (n) => { const p = Math.round(n / TOPICS.length * 100); bdPct.textContent = `${p}% done`; bdBar.style.width = p + '%'; });

  // Sidebar rows and roadmap topics.
  sdRows.forEach((row, i) => {
    const s = t >= T.done[i] ? 'done' : t >= T.ready[i] ? 'written' : 'writing';
    once('sd' + i, s, () => { row.dataset.s = s; });
    if (i === 1) cls(row, 'cur', ph === 'lesson' || (t >= T.tap && t < T.les0), 'sdcur');
  });
  sdSubs.forEach((s, k) => show(s, ph === 'lesson', 'sub' + k));
  mileEls.forEach((m, i) => {
    cls(m, 'done', t >= T.done[i], 'md' + i);
    if (i === 1) {
      cls(m, 'learn', t >= T.tap && t < T.done[1], 'mlearn');
      cls(m, 'hot', t >= T.focus && t < T.les0, 'mhot');
    }
  });
  cls(finEl, 'lit', t >= T.finish, 'fin');

  // Steps and caption.
  const idx = ph === 'create' ? 0 : ph === 'ask' ? 1 : t < T.les0 ? 2 : t < T.out1 ? 3 : 4;
  const allDone = t >= T.finish;
  once('step', idx + (allDone ? '!' : ''), () => {
    steps.forEach((s, k) => { s.classList.toggle('on', k === idx && !allDone); s.classList.toggle('done', k < idx || allDone); });
    caps.forEach((c, k) => c.classList.toggle('on', k === idx));
  });

  // Inside the lesson. The pager bar sticks to the top as the lesson scrolls.
  const sy = -gsap.getProperty(lsIn, 'y');
  const by = Math.max(0, Math.round(sy - G.barTop));
  once('bar', by, () => { lsBar.style.transform = by ? `translateY(${by}px)` : ''; });
  let pg = 0;
  T.blk.forEach((b, k) => { if (t >= b) pg = k; });
  txt(lsPg, `<b>${Math.min(pg, 5) + 1}/6</b>${PAGER[Math.min(pg, 5)]}`, 'pg');
  msgs.forEach((m, k) => show(m, t >= T.msg[k], 'm' + k));
  show(typing, msgs.some((m, k) => k > 0 && m.classList.contains('them') && t >= T.msg[k] - 0.3 && t < T.msg[k]), 'typing');
  cls(goal, 'ok', t >= T.goal, 'goal');
  show(gok, t >= T.goal, 'gok');
  const recording = (t >= T.rec1 && t < T.att1) || (t >= T.rec2 && t < T.att2);
  cls(mic, 'rec', recording, 'rec');
  txt(micL, recording ? 'Listening' : t >= T.att2 ? 'Again' : 'Speak', 'micL');
  const second = t >= T.rec2;
  const wp = second ? clamp01((t - T.rec2) / (T.att2 - T.rec2)) : clamp01((t - T.rec1) / (T.att1 - T.rec1));
  once('wave', (second ? 2 : 1) + ':' + Math.round(wp * 34), () => bars.forEach((b, k) => {
    const live = k < Math.round(wp * 34);
    b.style.height = (live ? 5 + VOICE[k] * 28 : 4) + 'px';
    b.style.background = live ? (second ? '#8DB51E' : 'var(--cobalt)') : '#D6D9E2';
  }));
  show(att, t >= T.att1, 'att');
  once('att2', t >= T.att2, (ok) => {
    spPct.textContent = ok ? '96%' : '72%'; spPct.classList.toggle('ok', ok);
    heard.textContent = ok ? 'heard: “vorrei un caffè e un cornetto per favore”' : 'heard: “vorrei un caffè e un coretto per favore”';
    wBad.className = ok ? 'ok' : 'bad';
    tipT.innerHTML = ok ? 'Second try: “cornetto”, clear as day.' : '“Cornetto” came out as “coretto”. Lean on the <b>rn</b>, then the double t.';
  });
  cls(qRight, 'sel', t >= T.qSel && t < T.qSubmit, 'qsel');
  cls(qRight, 'right', t >= T.qSubmit, 'qright');
  cls(qSub, 'on', t >= T.qSel, 'qsub');
  cls(qSub, 'press', t >= T.qSubmit && t < T.qSubmit + 0.14, 'qsubp');
  txt(qHint, t >= T.qSubmit ? 'Correct — checked instantly.' : t >= T.qSel ? 'Ready to submit.' : 'Answer to enable submission.', 'qhint');
  show(qWhy, t >= T.qSubmit, 'why');
  once('passed', t >= T.qSubmit, (v) => { enN.textContent = v ? '2 of 2 checks passed.' : '1 of 2 checks passed.'; enBar.style.width = v ? '100%' : '50%'; });
  once('ldone', t >= T.lDone, (v) => {
    [lsDone, enDone].forEach((b) => { b.classList.toggle('ok', v); b.innerHTML = v ? icon('i-check') + 'Done' : 'Mark complete'; });
  });
  cls(lsDone, 'press', t >= T.lDone && t < T.lDone + 0.14, 'ldp');
}

/* ── The timeline ── */
function invEase(p) { return p < 0.5 ? Math.sqrt(p / 2) : 1 - Math.sqrt((1 - p) / 2); } // power1.inOut⁻¹
const animated = new Set();
function build() {
  G = measure();
  T = {};
  let t = 0.3;
  T.type0 = t; T.type1 = t + 1.5;
  T.press = T.type1 + 0.35;
  T.askIn = T.press + 0.3;
  T.pick = [T.askIn + 0.6, T.askIn + 1.05, T.askIn + 1.5];
  T.plan = T.pick[2] + 0.5;
  T.lift = T.plan + 0.15;
  T.boardIn = T.lift + 0.25;
  T.root = T.lift + 0.75;
  T.spine = T.root + 0.15; T.spineD = 2.6;
  T.pop = G.fracM.map((f) => T.spine + f * T.spineD);
  T.secPop = G.fracS.map((f) => T.spine + f * T.spineD - 0.05);
  T.ready = T.pop.map((p) => p + 0.7);
  T.fin = T.spine + T.spineD + 0.05;
  T.focus = T.fin + 0.4;
  T.tap = T.focus + 0.5;
  T.les0 = T.tap + 0.12;
  T.zoom0 = T.les0 + 0.1; T.zoom1 = T.zoom0 + 1.0;
  // Inside the lesson.
  t = T.zoom0 + 0.6;
  T.blk = [];
  T.blk[0] = t; t += 0.45;            // prose
  T.blk[1] = t; t += 0.55;            // comparison
  T.blk[2] = t; t += 0.75;            // illustration (+ pins)
  T.blk[3] = t; T.msg = []; t += 0.25; // role-play
  msgs.forEach((m, k) => { T.msg[k] = k === 0 ? T.blk[3] + 0.1 : (t += 0.38); });
  T.goal = t + 0.35; t = T.goal + 0.3;
  T.blk[4] = t;                        // speaking drill
  T.rec1 = t + 0.25; T.att1 = T.rec1 + 0.7; T.rec2 = T.att1 + 0.6; T.att2 = T.rec2 + 0.6; t = T.att2 + 0.35;
  T.blk[5] = t;                        // quiz
  T.qMove = t + 0.2; T.qSel = T.qMove + 0.4; T.qSubmit = T.qSel + 0.4; t = T.qSubmit + 0.4;
  T.blk[6] = t;                        // done card
  T.lDone = t + 0.55; t = T.lDone + 0.4;
  T.out0 = t; T.out1 = t + 0.9;
  T.run = T.out1 + 0.25; T.runD = 2.6;
  T.done = G.fracRun.map((f) => T.run + invEase(clamp01(f)) * T.runD);
  T.done[1] = T.lDone; // marked done inside the lesson
  T.finish = T.run + T.runD + 0.05;
  T.total = T.finish + 0.9;

  cache.clear();
  animated.clear();
  tl = gsap.timeline({ paused: true, defaults: { ease: 'none' }, onUpdate: () => render(tl.time()) });
  const add = (targets) => { [].concat(targets).forEach((x) => animated.add(x)); return targets; };
  const ft = (el, a, b, at) => tl.fromTo(add(el), a, b, at);
  const to = (el, b, at) => tl.to(add(el), b, at);

  // Screens.
  ft(sCreate, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -12, duration: 0.3, ease: 'power2.in' }, T.askIn);
  ft(sAsk, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' }, T.askIn + 0.12);
  to(sAsk, { autoAlpha: 0, y: -12, duration: 0.3, ease: 'power2.in' }, T.lift);
  ft(sBoard, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35 }, T.boardIn);
  to(sBoard, { autoAlpha: 0, duration: 0.3 }, T.les0 + 0.5);
  to(sBoard, { autoAlpha: 1, duration: 0.3 }, T.out0 + 0.2);
  // The app opens: sidebar, assistant, tabs, the top bar's pills.
  if (!narrow) {
    ft(aSide, { width: 0 }, { width: $('.sd-in', aSide).offsetWidth, duration: 0.65, ease: 'power3.inOut' }, T.lift + 0.05);
    ft(aAsst, { width: 0 }, { width: $('.as-in', aAsst).offsetWidth, duration: 0.65, ease: 'power3.inOut' }, T.lift + 0.12);
    ft(aTabs, { height: 0 }, { height: 42, duration: 0.4, ease: 'power2.out' }, T.lift + 0.3);
    ft(aTr, { autoAlpha: 0, x: 12 }, { autoAlpha: 1, x: 0, duration: 0.35, ease: 'power2.out' }, T.lift + 0.4);
  } else {
    ft(mnav, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' }, T.lift + 0.2);
  }
  sdHeads.forEach((h, k) => ft(h, { autoAlpha: 0, x: -8 }, { autoAlpha: 1, x: 0, duration: 0.3 }, (k === 0 ? T.root : T.secPop[1]) - 0.05));
  sdRows.forEach((r, i) => ft(r, { autoAlpha: 0, x: -8 }, { autoAlpha: 1, x: 0, duration: 0.3, ease: 'power2.out' }, T.pop[i]));

  // A pointer does the tapping.
  const P = (p) => ({ x: (p.x ?? p.cx) - 4, y: (p.y ?? p.cy) - 3 });
  const tap = (at) => to(cursor, { scale: 0.8, duration: 0.07, yoyo: true, repeat: 1, ease: 'power2.out' }, at - 0.02);
  const go = (p, at, d = 0.36) => to(cursor, { ...P(p), duration: d, ease: 'power2.inOut' }, at - d - 0.02);
  const start1 = { x: G.go.x + 90, y: G.go.y + 160 };
  ft(cursor, { autoAlpha: 0, ...P(start1), scale: 1 }, { autoAlpha: 1, duration: 0.2 }, T.type1 - 0.1);
  go(G.go, T.press); tap(T.press);
  G.picks.forEach((c, i) => { go(c, T.pick[i], 0.34); tap(T.pick[i]); });
  go(G.plan, T.plan, 0.4); tap(T.plan);
  to(cursor, { autoAlpha: 0, duration: 0.2 }, T.lift + 0.1);
  const m2 = { x: G.mile2.cx, y: G.mile2.cy };
  ft(cursor, { autoAlpha: 0, x: m2.x + 120, y: m2.y + 140 }, { autoAlpha: 1, duration: 0.2, immediateRender: false }, T.focus - 0.3);
  go(m2, T.tap, 0.45); tap(T.tap);
  to(cursor, { autoAlpha: 0, duration: 0.2 }, T.les0 + 0.25);
  // In the lesson the pointer lives in lesson coordinates, minus the scroll at that moment.
  const sc5 = G.sk(5);
  const qR = { x: G.qRight.x, y: G.qRight.y - sc5 }, qS = { x: G.qSub.x, y: G.qSub.y - sc5 };
  ft(cursor, { autoAlpha: 0, x: qR.x + 140, y: qR.y + 120 }, { autoAlpha: 1, duration: 0.15, immediateRender: false }, T.qMove - 0.2);
  go(qR, T.qSel, 0.36); tap(T.qSel);
  go(qS, T.qSubmit, 0.3); tap(T.qSubmit);
  go(G.lsDone, T.lDone, 0.4); tap(T.lDone);
  to(cursor, { autoAlpha: 0, duration: 0.2 }, T.lDone + 0.25);

  // The sentence leaves the questions and becomes the course's name.
  const tw = token.offsetWidth || 180;
  ft(token, { autoAlpha: 0, x: G.topic.l, y: G.topic.t - 6, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 0.18, ease: 'power2.out' }, T.lift);
  to(token, { x: G.titleApp.cx - tw / 2, y: G.titleApp.cy - 20, duration: 0.55, ease: 'power2.inOut' }, T.lift + 0.15);
  to(token, { autoAlpha: 0, scale: 0.7, duration: 0.18, ease: 'power2.in' }, T.root - 0.02);

  // The roadmap draws itself.
  ft(title, { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(1.8)' }, T.root);
  ft(spine, { opacity: 0 }, { opacity: 1, duration: 0.3 }, T.root);
  ft(spineDraw, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: T.spineD }, T.spine);
  secEls.forEach((s, k) => ft(s, { autoAlpha: 0, scale: 0.85 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }, T.secPop[k]));
  rows.forEach((row, i) => {
    ft(mileEls[i], { autoAlpha: 0, y: 10, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.4, ease: 'back.out(1.7)' }, T.pop[i]);
    G.ties[i].forEach(({ p, el }, k) => {
      ft(p, { opacity: 0 }, { opacity: 1, duration: 0.25 }, T.pop[i] + 0.25 + k * 0.1);
      ft(el, { autoAlpha: 0, scale: 0.92 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(1.8)' }, T.pop[i] + 0.32 + k * 0.1);
    });
  });
  ft(finEl, { autoAlpha: 0, scale: 0.85 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(1.8)' }, T.fin);
  // Its camera: follow the drawing down, settle on topic 2, then follow the lime run.
  const keys = [{ t: T.root, y: 0, d: 0.01 }];
  G.rows.forEach((r, i) => keys.push({ t: T.pop[i] - 0.1, y: G.yAt(r.b), d: 0.5 }));
  keys.push({ t: T.fin - 0.1, y: G.yAt(G.fin.b), d: 0.45 });
  keys.push({ t: T.focus - 0.35, y: G.yFocus, d: 0.45 });
  G.miles.forEach((m, i) => { if (i > 0) keys.push({ t: T.done[i] - 0.25, y: G.yAt(m.cy, 0.55), d: 0.45 }); });
  keys.push({ t: T.finish - 0.3, y: G.yAt(G.fin.b + 30), d: 0.4 });
  keys.sort((a, b) => a.t - b.t);
  for (let k = 1; k < keys.length; k++) {
    const d = Math.max(0.05, Math.min(keys[k].d, keys[k].t - keys[k - 1].t - 0.02 + keys[k].d));
    ft(bdCanvas, { y: keys[k - 1].y }, { y: keys[k].y, duration: d, ease: 'power2.inOut', immediateRender: false }, keys[k].t);
  }

  // Click topic 2: it opens as a tab and the lesson grows out of it.
  ft(tabLes, { scale: 0.8, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.3, ease: 'back.out(2)', immediateRender: false }, T.les0);
  ft(sLesson, { autoAlpha: 0, clipPath: G.clip0 }, { autoAlpha: 1, duration: 0.15 }, T.les0);
  to(sLesson, { clipPath: 'inset(0px 0px 0px 0px round 0px)', duration: 0.85, ease: 'power3.inOut' }, T.les0);
  if (!narrow) {
    ft(app, { x: 0, y: 0, scale: 1 }, { x: G.zx, y: G.zy, scale: G.S, duration: 1.0, ease: 'power2.inOut' }, T.zoom0);
    ft([aSide, aAsst], { opacity: 1 }, { opacity: 0.3, duration: 0.6 }, T.zoom0 + 0.2); // the camera's focus is the lesson
  }
  blocks.forEach((b, k) => ft(b, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' }, T.blk[k]));
  pins.forEach((p, k) => ft(p, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.25, ease: 'back.out(2.2)' }, T.blk[2] + 0.3 + k * 0.12));
  // The lesson scrolls as it is read: each block up under the bar, and the
  // tall ones (the role-play, the drill) on again as they fill.
  const sKeys = [
    [T.blk[2] - 0.15, G.sk(2)], [T.blk[3] - 0.15, G.sk(3)], [T.msg[3] - 0.2, G.skEnd(3)],
    [T.blk[4] - 0.15, G.sk(4)], [T.att1 - 0.1, G.skEnd(4)], [T.blk[5] - 0.15, G.sk(5)], [T.blk[6] - 0.15, G.sk(6)],
  ];
  let prev = 0;
  sKeys.forEach(([at, sv]) => {
    if (Math.abs(sv - prev) < 2) return;
    ft(lsIn, { y: -prev }, { y: -sv, duration: 0.45, ease: 'power2.inOut', immediateRender: false }, at);
    prev = sv;
  });
  ft(lsDone, { scale: 1 }, { scale: 1.06, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' }, T.lDone);

  // And back out to the roadmap.
  if (!narrow) {
    to(app, { x: 0, y: 0, scale: 1, duration: 0.9, ease: 'power2.inOut' }, T.out0);
    to([aSide, aAsst], { opacity: 1, duration: 0.5 }, T.out0 + 0.1);
  }
  ft(lsView, { opacity: 1 }, { opacity: 0, duration: 0.2 }, T.out0); // it folds back into its topic as a blank card
  to(sLesson, { clipPath: G.clip0, duration: 0.8, ease: 'power3.inOut' }, T.out0 + 0.05);
  to(sLesson, { autoAlpha: 0, duration: 0.2 }, T.out1 - 0.2);

  // The lime run, to Finished.
  ft(spineRun, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: T.runD, ease: 'power1.inOut' }, T.run);
  mileEls.forEach((m, i) => { if (i !== 1) ft(m, { scale: 1 }, { scale: 1.06, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, T.done[i]); });
  ft(finEl, { scale: 1 }, { scale: 1.12, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, T.finish);
  const cols = ['#0B0D10', '#2340E6', '#8DB51E', '#2340E6', '#C6F24E'];
  bursts.forEach((b, k) => {
    const a = (k / bursts.length) * Math.PI * 2, r = 46 + (k % 3) * 14;
    b.style.background = cols[k % cols.length];
    ft(b, { x: 0, y: 0, opacity: 0, rotate: 0 }, { x: Math.cos(a) * r, y: Math.sin(a) * r, rotate: 160, keyframes: { opacity: [0, 1, 1, 0] }, duration: 0.7, ease: 'power2.out' }, T.finish);
  });
  tl.to({}, { duration: 0.01 }, T.total - 0.01);
  render(0);
}

/* ── Scroll: pin and scrub ── */
function make(progress) {
  build();
  if (STILL) {
    // Reduced motion: the resolved frame — the course built and finished.
    tl.progress(1);
    gsap.set(cursor, { autoAlpha: 0 });
    render(T.total);
    return;
  }
  const unit = Math.max(200, innerHeight * 0.27);
  st = ScrollTrigger.create({
    trigger: story, start: 'top top', end: () => '+=' + Math.round(T.total * unit),
    pin: true, anticipatePin: 1, scrub: 0.7, animation: tl, refreshPriority: 10,
  });
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  if (progress != null) seek(progress);
}
function seek(p) {
  if (!st) return;
  scrollTo(0, st.start + p * (st.end - st.start));
  tl.progress(p);
  window.__page && window.__page.place();
}
function teardown() {
  if (st) { st.kill(true); st = null; }
  if (tl) { tl.progress(0).kill(); tl = null; }
  gsap.set([...animated], { clearProps: 'all' });
  [aSide, aAsst, aTabs].forEach((el) => { el.style.width = ''; el.style.height = ''; });
  cache.clear();
}

/* The field comes and goes; borrow it on arrival. */
F.onMove((to) => {
  if (to === 'story') { F.take(); cache.delete('press'); render(tl ? tl.time() : 0); }
});
let lastW = innerWidth, rz = 0;
addEventListener('resize', () => {
  if (innerWidth === lastW) return; // a phone's toolbar, not a new layout
  lastW = innerWidth;
  clearTimeout(rz);
  rz = setTimeout(() => { teardown(); make(null); }, 220);
});
ScrollTrigger.config({ ignoreMobileResize: true });

(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => {
  requestAnimationFrame(() => {
    make(params.has('story') ? clamp01(+params.get('story') || 0) : null);
    window.__story = { get tl() { return tl; }, get st() { return st; }, get T() { return T; }, get G() { return G; }, seek, rebuild: () => { teardown(); make(); } };
  });
});
})();

/* BiliMind · Daylight 2 course — core: helpers, tabs and views, sidebar, popovers, tooltip, palette, inbox, toast. */
window.C = (() => {
  const D = window.DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const params = new URLSearchParams(location.search);
  const EMBED = params.get('embed') === '1';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phoneMQ = matchMedia('(max-width: 720px)');
  const sleep = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* the example's dates, moved to the real today: the shell once, then every HTML string as it's set */
  if (window.BILI_TR) BILI_TR.apply(document.body);
  if (window.BILI_DATES) { BILI_DATES.walk(document.body); BILI_DATES.patchHTML(); }
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const icons = () => window.lucide && lucide.createIcons();
  const logo = (k, size = 16) => (window.BILI_LOGO ? BILI_LOGO(k, size) : '');
  const app = $('#app');

  /* inside the landing page's iframe: never let focus or scrolling move the page that embeds us */
  if (EMBED) {
    const f = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (o) { return f.call(this, { preventScroll: true, ...(o || {}) }); };
    Element.prototype.scrollIntoView = function () { C.reveal(this); };
  }

  /* people */
  const person = (k, size = 24, cls = '') => {
    const [n, ini, tone] = D.PEOPLE[k];
    const a = tone === 'hi' ? 'var(--hi-soft)' : tone === 'ink' ? 'var(--wash-2)' : `var(--${tone}-soft)`;
    const t = tone === 'hi' ? 'var(--hi-ink)' : tone === 'ink' ? 'var(--ink-2)' : `var(--${tone}-ink)`;
    return `<span class="av has-photo ${cls}" style="--s:${size}px;--a:${a};--t:${t};background-image:url('img/avatars/paint/${k}.jpg')" title="${esc(n)}">${ini}</span>`;
  };
  const first = (k) => D.PEOPLE[k][0].split(' ')[0];

  /* status marks */
  const mark = (s, cls = '') => {
    const svg = {
      checked: '<circle cx="7.5" cy="7.5" r="7" fill="var(--leaf)"/><path d="m4.6 7.7 2 2 3.8-4.2" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
      done: '<circle cx="7.5" cy="7.5" r="6.3" fill="none" stroke="var(--leaf)" stroke-width="1.5"/><path d="m4.8 7.7 1.9 1.9 3.6-4" fill="none" stroke="var(--leaf)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
      learning: '<circle cx="7.5" cy="7.5" r="6.3" fill="none" stroke="var(--hi-2)" stroke-width="1.5"/><path d="M7.5 3.2a4.3 4.3 0 0 1 0 8.6z" fill="var(--hi-2)"/>',
      todo: '<circle cx="7.5" cy="7.5" r="6.3" fill="none" stroke="var(--ink-4)" stroke-width="1.4" stroke-dasharray="2.2 2.2"/>',
      skip: '<circle cx="7.5" cy="7.5" r="6.3" fill="none" stroke="var(--ink-4)" stroke-width="1.4"/><path d="M4.5 7.5h6" stroke="var(--ink-4)" stroke-width="1.5" stroke-linecap="round"/>',
    }[s] || '';
    return `<span class="mk ${cls}" title="${D.STATUS[s] || 'Skipped'}"><svg viewBox="0 0 15 15">${svg}</svg></span>`;
  };
  const checked = () => D.T.filter((t) => t.s === 'checked').length;

  /* ── toast ── */
  const toast = (msg, ic = 'check') => {
    const box = $('#toast');
    const el = h(`<div><i data-lucide="${ic}"></i><span>${msg}</span></div>`);
    box.append(el); icons();
    while (box.children.length > 3) box.firstElementChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2800);
  };

  /* scroll an element into view inside its own scroller only */
  const reveal = (el, offset = 70, smooth = true) => {
    let sc = el.parentElement;
    while (sc && sc !== document.body && !(sc.scrollHeight > sc.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
    if (!sc || sc === document.body) return;
    const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - offset;
    sc.scrollTo({ top, behavior: smooth && !reduce ? 'smooth' : 'auto' });
  };

  /* ── tabs and views ── */
  const views = {};
  let order = [], active = null;
  const addView = (v) => {
    views[v.id] = v;
    v.el.classList.add('view');
    v.el.dataset.id = v.id;
    $('#views').append(v.el);
    if (v.tab !== false && !order.includes(v.id)) order.push(v.id);
    renderTabs();
  };
  const renderTabs = () => {
    $('#tabs').innerHTML = order.map((id) => {
      const v = views[id];
      return `<div class="tab ${id === active ? 'on' : ''} ${v.pinned ? 'pin' : ''}" role="tab" tabindex="0" aria-selected="${id === active}" aria-label="${esc(v.pinned ? 'Psychology 101 · ' + v.title : v.title)}" data-id="${id}" ${v.pinned ? `data-tip="${esc(v.title)}"` : ''} style="animation:none">${v.thumb ? `<img src="${v.thumb}" alt="">` : `<i data-lucide="${v.icon}"></i>`}${v.pinned ? '' : `<span class="tt">${esc(v.title)}</span>`}${v.live ? '<span class="ldot" title="Aziz and Sara are here"></span>' : ''}${v.closable === false ? '' : `<span class="x" role="button" aria-label="Close ${esc(v.title)}"><i data-lucide="x"></i></span>`}</div>`;
    }).join('');
    icons();
  };
  const activate = (id) => {
    const v = views[id]; if (!v) return;
    active = id;
    Object.values(views).forEach((x) => x.el.classList.toggle('on', x.id === id));
    $$('.tab', $('#tabs')).forEach((t) => { t.classList.toggle('on', t.dataset.id === id); t.setAttribute('aria-selected', String(t.dataset.id === id)); });
    $('#main').classList.toggle('no-tray', !v.ink);
    $('#main').dataset.kind = v.kind;
    syncSb();
    closePop(); closeSel();
    if (C.onActivate) C.onActivate(v);
    v.show && v.show();
  };
  $('#tabs').addEventListener('click', (e) => {
    const t = e.target.closest('.tab'); if (!t) return;
    if (e.target.closest('.x')) return closeTab(t.dataset.id);
    activate(t.dataset.id);
  });
  $('#tabs').addEventListener('keydown', (e) => { const t = e.target.closest('.tab'); if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); activate(t.dataset.id); } });
  const closeTab = (id) => {
    const i = order.indexOf(id); if (i < 0 || views[id].closable === false) return;
    order.splice(i, 1);
    views[id].el.classList.remove('on');
    if (active === id) { active = null; activate(order[Math.max(0, i - 1)]); }
    renderTabs();
    $$('.tab', $('#tabs')).forEach((t) => t.classList.toggle('on', t.dataset.id === active));
  };
  const open = (id) => { if (!views[id]) return; if (!order.includes(id)) { order.push(id); renderTabs(); } activate(id); };

  /* ── sidebar ── */
  const shut = {};
  const renderSb = () => {
    const T = D.T;
    const bar = T.map((t) => `<i class="${t.s}" title="${esc(t.t)}: ${D.STATUS[t.s]}"></i>`).join('');
    const topic = (t, i) => `<button class="sb-item tp ${t.cur ? 'cur' : ''} ${t.s === 'skip' ? 'skip' : ''}" data-topic="${t.id}"><span class="ix">${i + 1}</span>${mark(t.s)}<span class="lt">${esc(t.t)}</span></button>`;
    $('#sbIn').innerHTML = `
      <button class="sb-course" data-pop="course"><img src="img/cover-psychology.jpg" alt=""><span class="ct"><b>Psychology 101</b><small>PSY101 · Dr. Rahimova</small></span><i data-lucide="chevrons-up-down"></i></button>
      <button class="exam" data-go="home:deadlines">
        <span class="exam-k"><i data-lucide="flag"></i>Final · Fri 11 Dec<span class="r">On track</span></span>
        <span class="exam-d"><b class="num">32</b><span>days left</span></span>
        <span class="exam-bar">${bar}</span>
        <span class="exam-f"><b>${checked()} of 14</b> topics checked from memory</span>
      </button>
      <div class="sb-nav">
        <button class="sb-item" data-go="home:roadmap"><i data-lucide="route"></i>Roadmap</button>
        <button class="sb-item" data-go="home:weeks"><i data-lucide="calendar-days"></i>This week<span class="n">4 h</span></button>
        <button class="sb-item" data-go="home:deadlines"><i data-lucide="flag"></i>Deadlines<span class="n warn">3</span></button>
        <button class="sb-item" data-go="home:grades"><i data-lucide="graduation-cap"></i>Grades<span class="n">74%</span></button>
      </div>
      <div class="sb-scroll">
        <button class="sb-h ${shut.topics ? 'shut' : ''}" data-shut="topics"><i data-lucide="chevron-down"></i>Topics<span class="r">${checked()}/14</span></button>
        <div class="sb-group" ${shut.topics ? 'hidden' : ''}>${T.map(topic).join('')}</div>
        <button class="sb-h ${shut.notes ? 'shut' : ''}" data-shut="notes"><i data-lucide="chevron-down"></i>Notes &amp; whiteboards<span class="r">3</span></button>
        <div class="sb-group" ${shut.notes ? 'hidden' : ''}>
          <button class="sb-item" data-go="notes:l6"><i data-lucide="file-text"></i><span class="lt">Lecture 6 notes</span></button>
          <button class="sb-item" data-go="notes:studies"><i data-lucide="file-text"></i><span class="lt">Key studies to know</span></button>
          <button class="sb-item" data-go="board:curve"><i data-lucide="presentation"></i><span class="lt">The forgetting curve, drawn out</span><span class="livedot">2</span></button>
        </div>
      </div>
      <div class="sb-foot"><span class="faces">${['aziz', 'lola', 'sara'].map((k) => person(k, 24)).join('')}</span><span class="ft"><b>26 in the class</b>Aziz is here now</span><button class="btn-xs ghost" data-invite><i data-lucide="user-plus"></i>Invite</button></div>`;
    icons();
    syncSb();
  };
  const syncSb = () => {
    const v = views[active]; if (!v) return;
    $$('#sbIn [data-go], #sbIn [data-topic]').forEach((b) => b.classList.remove('on'));
    let key = active;
    if (active === 'home') key = 'home:' + (C.hsub || 'roadmap');
    const b = $(`#sbIn [data-go="${key}"]`) || (active === 'lesson:forget' ? null : null);
    if (b && !b.classList.contains('exam')) b.classList.add('on');
  };
  $('#sbIn').addEventListener('click', (e) => {
    const sh = e.target.closest('[data-shut]');
    if (sh) { shut[sh.dataset.shut] = !shut[sh.dataset.shut]; sh.classList.toggle('shut'); sh.nextElementSibling.hidden = !!shut[sh.dataset.shut]; return; }
    const g = e.target.closest('[data-go]');
    if (g) { go(g.dataset.go); if (phoneMQ.matches) setSbOpen(false); return; }
    const tp = e.target.closest('[data-topic]');
    if (tp) {
      if (tp.dataset.topic === 'forget') open('lesson:forget');
      else { go('home:roadmap'); setTimeout(() => C.brief && C.brief(tp.dataset.topic), 380); }
      if (phoneMQ.matches) setSbOpen(false);
      return;
    }
    if (e.target.closest('[data-invite]')) { navigator.clipboard?.writeText('https://bilimind.com/join/psy101-k7f2').catch(() => {}); toast('Invite link copied. Anyone who opens it joins Psychology 101', 'link'); return; }
    if (e.target.closest('[data-pop="course"]')) coursePop(e.target.closest('[data-pop]'));
  });
  const go = (key) => {
    const [kind, sub] = key.split(':');
    if (kind === 'home') { C.openHome && C.openHome(sub); return; }
    open(key);
  };
  const coursePop = (anchor) => {
    const el = h(`<div class="pop" style="width:260px;padding:6px">${[['psychology', 'Psychology 101', 'PSY101 · 4 of 14 checked', true], ['biology', 'Biology: cells to systems', 'On your own · 8 cards due'], ['italian', 'Italian to B1', 'With Lola and Timur · lesson 9']].map((c) => `<button class="ib" style="width:100%;text-align:left;align-items:center" data-toast="${c[1]}"><img src="img/cover-${c[0]}.jpg" alt="" style="width:30px;height:30px;border-radius:8px;object-fit:cover"><span style="flex:1"><b>${c[1]}</b><span>${c[2]}</span></span>${c[3] ? '<i data-lucide="check" style="width:15px;height:15px"></i>' : ''}</button>`).join('')}</div>`);
    openPop(el, anchor, 'below', 'start');
  };
  const setSbOpen = (o) => { app.classList.toggle('sb-open', o); syncScrim(); };
  const syncScrim = () => $('#scrim').classList.toggle('on', phoneMQ.matches && (app.classList.contains('sb-open') || app.classList.contains('as-open')));
  $('#scrim').addEventListener('click', () => { app.classList.remove('sb-open'); C.closeAssistant && C.closeAssistant(); syncScrim(); });
  $('#mMenu').addEventListener('click', () => setSbOpen(true));
  $('#sbToggle').addEventListener('click', () => toggleSb());
  const toggleSb = () => { app.classList.toggle('sb-off'); setTimeout(() => C.onResize && C.onResize(), 520); };

  /* ── popovers ── */
  let pop = null, popAnchor = null;
  const openPop = (el, anchor, side = 'below', align = 'start') => {
    if (popAnchor === anchor && pop) { closePop(); return false; }
    closePop();
    document.body.append(el); icons();
    pop = el; popAnchor = anchor;
    place(el, anchor, side, align);
    return true;
  };
  const place = (el, anchor, side, align) => {
    const r = anchor.getBoundingClientRect(), w = el.offsetWidth, ht = el.offsetHeight, pad = 10;
    let x, y;
    if (side === 'right') { x = r.right + 12; y = align === 'center' ? r.top + r.height / 2 - ht / 2 : r.top; if (x + w > innerWidth - pad) x = r.left - w - 12; }
    else { x = align === 'end' ? r.right - w : align === 'center' ? r.left + r.width / 2 - w / 2 : r.left; y = r.bottom + 8; if (y + ht > innerHeight - pad) y = r.top - ht - 8; }
    el.style.left = Math.max(pad, Math.min(innerWidth - w - pad, x)) + 'px';
    el.style.top = Math.max(pad, Math.min(innerHeight - ht - pad, y)) + 'px';
  };
  const closePop = () => { if (pop) { pop.remove(); pop = null; } if (popAnchor) { popAnchor.classList.remove('sel'); popAnchor = null; } };
  document.addEventListener('pointerdown', (e) => { if (pop && !pop.contains(e.target) && !(popAnchor && popAnchor.contains(e.target))) closePop(); }, true);

  /* selection pill lives in markup.js; core only needs to close it */
  const closeSel = () => C.closeSelPill && C.closeSelPill();

  /* ── tooltip ── */
  const tip = $('#tip');
  let tipT, tipFor = null;
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('[data-tip]');
    if (t === tipFor) return;
    clearTimeout(tipT); tip.classList.remove('on'); tipFor = t;
    if (!t || e.pointerType === 'touch') return;
    tipT = setTimeout(() => {
      tip.innerHTML = `${esc(t.dataset.tip)}${t.dataset.key ? `<span class="k">${esc(t.dataset.key)}</span>` : ''}`;
      const r = t.getBoundingClientRect();
      const inRail = t.closest('.rail');
      const w = tip.offsetWidth, ht = tip.offsetHeight;
      let x = inRail ? r.right + 10 : r.left + r.width / 2 - w / 2, y = inRail ? r.top + r.height / 2 - ht / 2 : r.bottom + 8;
      if (t.closest('.tray, .zoom')) y = r.top - ht - 8;
      tip.style.left = Math.max(6, Math.min(innerWidth - w - 6, x)) + 'px';
      tip.style.top = Math.max(6, y) + 'px';
      tip.classList.add('on');
    }, 420);
  });
  document.addEventListener('pointerdown', () => { clearTimeout(tipT); tip.classList.remove('on'); });

  /* any [data-toast] button just says what it would do */
  document.addEventListener('click', (e) => { const t = e.target.closest('[data-toast]'); if (t && !e.defaultPrevented) toast(t.dataset.toast, 'info'); });

  /* ── inbox ── */
  $('#inboxBtn').addEventListener('click', (e) => {
    const el = h(`<div class="pop inbox"><h5>Inbox<span>${D.INBOX.length} new</span></h5>${D.INBOX.map((it, i) => `<div class="ib" data-ib="${i}"><span class="ibi">${it.who ? person(it.who, 30) : logo(it.logo, 16)}</span><div><b>${it.t}</b><span>${it.s}</span>${it.act ? '<div class="ibb"><button class="btn-xs dark" data-ok>I heard it too</button><button class="btn-xs ghost" data-no>Not sure</button></div>' : ''}</div></div>`).join('')}</div>`);
    if (!openPop(el, e.currentTarget, phoneMQ.matches ? 'below' : 'right', 'start')) return;
    el.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-ok]')) { ev.target.closest('.ibb').outerHTML = '<span class="say good" style="margin-top:8px">Confirmed. On everyone’s plan as Fri 13 Nov</span>'; $('#inboxN').textContent = '1'; toast('Essay 1 moves to Fri 13 Nov for the whole class', 'calendar-check'); }
      if (ev.target.closest('[data-no]')) { ev.target.closest('.ibb').outerHTML = '<span class="say" style="margin-top:8px">Left as tentative</span>'; }
    });
  });

  /* ── ⌘K palette ── */
  const pal = $('#pal'), palIn = $('#palIn'), palList = $('#palList');
  let palItems = [], palSel = 0;
  const palAll = () => [
    ...D.T.map((t, i) => ({ g: 'Topics', i: t.i, t: t.t, s: `Topic ${i + 1} · ${D.STATUS[t.s]}`, run: () => (t.id === 'forget' ? open('lesson:forget') : (go('home:roadmap'), setTimeout(() => C.brief(t.id), 380))) })),
    ...D.T.flatMap((t) => t.subs.map((sb) => ({ g: 'Topics', i: 'corner-down-right', t: sb[0], s: `Part of ${t.t}`, run: () => (t.id === 'forget' ? C.gotoSection(sb[0] === 'Interference' ? 'sreasons' : 's1') : (go('home:roadmap'), setTimeout(() => C.brief(t.id), 380))) }))),
    ...[['s1', 'The forgetting curve'], ['stry', 'Try it: space out your reviews'], ['sreasons', 'Three reasons we forget'], ['smyth', 'What doesn’t work as well as it feels']].map(([id, t]) => ({ g: 'In this lesson', i: 'hash', t, s: 'Why we forget', run: () => C.gotoSection(id) })),
    { g: 'Notes and boards', i: 'file-text', t: 'Lecture 6 notes', s: 'Tue 3 Nov', run: () => open('notes:l6') },
    { g: 'Notes and boards', i: 'file-text', t: 'Key studies to know', s: 'For the final', run: () => open('notes:studies') },
    { g: 'Notes and boards', i: 'presentation', t: 'The forgetting curve, drawn out', s: 'Aziz and Sara are here', run: () => open('board:curve') },
    { g: 'Files', i: 'file', t: 'Lecture 6: Memory.pdf', s: 'Moodle · 24 pages', run: () => toast('Lecture 6: Memory.pdf opens beside the lesson', 'file') },
    { g: 'Files', i: 'file-text', t: 'Seminar 5 reading: Roediger & Karpicke (2006)', s: 'From Dr. Rahimova’s email', run: () => toast('The Seminar 5 reading opens beside the lesson', 'file-text') },
    { g: 'Files', i: 'youtube', t: 'Crash Course Psychology #13', s: 'Shared by Aziz', run: () => toast('Crash Course #13 opens in a side player', 'youtube') },
    { g: 'Do', i: 'calendar-days', t: 'This week', s: 'Quiz 2 Thu · Essay 1 Fri', run: () => go('home:weeks') },
    { g: 'Do', i: 'flag', t: 'Deadlines', s: '3 this week', run: () => go('home:deadlines') },
    { g: 'Do', i: 'moon', t: 'Switch light or dark', s: '', run: () => C.flipTheme() },
  ];
  const openPalette = () => { pal.hidden = false; palIn.value = ''; renderPal(); setTimeout(() => palIn.focus(), 10); };
  const closePalette = () => { pal.hidden = true; };
  const renderPal = () => {
    const q = palIn.value.trim().toLowerCase();
    const all = palAll();
    palItems = q ? all.filter((x) => (x.t + ' ' + x.s).toLowerCase().includes(q)).slice(0, 14) : all.filter((x) => (x.g !== 'Topics' || ['forget', 'mem', 'learn'].includes(D.T.find((t) => t.t === x.t)?.id)) && x.g !== 'In this lesson');
    if (q) palItems.push({ g: 'Ask', ask: true, i: 'sparkles', t: `Ask Bili: “${palIn.value.trim()}”`, s: 'From this course', run: () => C.typeAndSend(palIn.value.trim()) });
    palSel = 0;
    let g = '';
    const hlq = (s) => (q ? esc(s).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), (m) => `<mark>${m}</mark>`) : esc(s));
    palList.innerHTML = palItems.map((x, i) => `${x.g !== g ? `<div class="pal-g">${(g = x.g)}</div>` : ''}<button class="pal-i ${x.ask ? 'ask' : ''} ${i === 0 ? 'on' : ''}" data-i="${i}" role="option">${x.ask ? '<bili-blob size="18" mood="happy"></bili-blob>' : `<i data-lucide="${x.i}"></i>`}<span>${x.ask ? esc(x.t) : hlq(x.t)}</span><span class="ps">${esc(x.s)}</span></button>`).join('') || '<div class="pal-g">Nothing here yet</div>';
    icons();
  };
  const palMove = (d) => { palSel = (palSel + d + palItems.length) % palItems.length; $$('.pal-i', palList).forEach((b) => b.classList.toggle('on', +b.dataset.i === palSel)); $(`.pal-i[data-i="${palSel}"]`, palList)?.scrollIntoView?.({ block: 'nearest' }); };
  const palRun = (i) => { const x = palItems[i]; if (!x) return; closePalette(); x.run(); };
  palIn.addEventListener('input', renderPal);
  palIn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); palMove(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); palMove(-1); }
    if (e.key === 'Enter') { e.preventDefault(); palRun(palSel); }
    if (e.key === 'Escape') closePalette();
  });
  palList.addEventListener('click', (e) => { const b = e.target.closest('.pal-i'); if (b) palRun(+b.dataset.i); });
  pal.addEventListener('pointerdown', (e) => { if (e.target === pal) closePalette(); });
  $('#searchBtn').addEventListener('click', openPalette);

  /* ── theme ── */
  const isDark = () => window.isDark ? window.isDark() : false;
  const setTheme = (v) => { if (v === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v); };
  const flipTheme = () => { const next = isDark() ? 'light' : 'dark'; try { localStorage.setItem('bilimind-d2-theme', next); } catch {} setTheme(next); };
  $('#themeBtn').addEventListener('click', flipTheme);

  $('#brand').addEventListener('click', () => $('#brand bili-blob').jump?.());
  $('#shareBtn').addEventListener('click', () => { navigator.clipboard?.writeText('https://bilimind.com/join/psy101-k7f2').catch(() => {}); toast('Invite link copied. Anyone who opens it joins Psychology 101', 'link'); });

  return {
    D, $, $$, h, esc, icons, logo, sleep, reduce, EMBED, params, phoneMQ, person, first, mark, checked, toast, reveal,
    views, addView, activate, open, closeTab, renderTabs, go, renderSb, syncSb, setSbOpen, syncScrim, toggleSb,
    openPop, closePop, place, openPalette, closePalette, isDark, setTheme, flipTheme,
    get active() { return active; }, get view() { return views[active]; },
  };
})();

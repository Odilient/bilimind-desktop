/* Course home: the roadmap (one path, roadmap.sh grammar), plus this week, deadlines and grades. */
(() => {
  const { D, $, $$, h, esc, icons, person, mark, toast } = C;
  const SUBS = [['roadmap', 'Roadmap', 'route'], ['weeks', 'This week', 'calendar-days'], ['deadlines', 'Deadlines', 'flag'], ['grades', 'Grades', 'graduation-cap']];
  const TI = Object.fromEntries(D.T.map((t, i) => [t.id, i]));

  const subNode = (t, s, j) => `<button class="node sub" data-sub="${t.id}:${j}" style="--i:${TI[t.id] + 1}"><span class="bd" style="--c:${D.BADGE[s[1]][1]}"></span><span>${esc(s[0])}</span></button>`;
  const note = (n, i) => `<div class="rnote" data-note style="--c-soft:var(--${n.c}-soft);--c-ink:var(--${n.c}-ink);--i:${i}"><i data-lucide="${n.i}"></i><div><b>${esc(n.t)}</b>${esc(n.s)}</div></div>`;
  const road = () => {
    let out = '';
    D.GROUPS.forEach((g) => {
      out += `<div class="grp"><span><b>${g.n}</b>${esc(g.t)}</span></div>`;
      g.ids.forEach((id) => {
        const t = D.T[TI[id]], i = TI[id], n = D.ROAD_NOTES[id];
        const L = [], R = [];
        t.subs.forEach((s, j) => (s[2] === 'l' ? L : R).push(subNode(t, s, j)));
        if (n) (n.side === 'l' ? L : R).push(note(n, i));
        out += `<div class="rrow"><div class="rside l ${n && n.side === 'l' ? 'has-note' : ''}">${L.join('')}</div><div><button class="node topic ${t.s} ${t.cur ? 'cur' : ''}" data-id="${t.id}" style="--i:${i}">${mark(t.s)}<span class="lt">${esc(t.t)}</span><span class="nn">${i + 1}</span>${t.cur ? '<bili-blob class="road-blob" size="26" follow></bili-blob>' : ''}</button></div><div class="rside r ${n && n.side === 'r' ? 'has-note' : ''}">${R.join('')}</div></div>`;
      });
    });
    return `<div class="road" id="road"><svg class="road-svg" id="roadSvg"></svg>${out}</div>`;
  };

  const row = (o) => `<button class="row ${o.now ? 'now' : ''}" ${o.attr || ''}><span class="ico" style="--c:var(--${o.tone || 'wash-2'}${o.tone ? '-soft' : ''});--t:var(--${o.tone ? o.tone + '-ink' : 'ink-2'})"><i data-lucide="${o.i}"></i></span><span class="rt"><b>${o.b}${o.wk ? `<small>${o.wk}</small>` : ''}</b><span>${o.s}</span></span>${o.r ? `<span class="rr">${o.r}</span>` : ''}</button>`;
  const subHTML = (k) => {
    if (k === 'roadmap') return `
      <div class="nextup"><bili-blob size="34" mood="happy"></bili-blob><div class="nt"><b>Next: finish Why we forget</b><span>About 10 minutes left. You stopped at the three reasons on Saturday.</span></div><button class="btn-xs dark" data-continue>Continue<i data-lucide="arrow-right"></i></button></div>
      <div class="legend"><span>${Object.values(D.BADGE).map(([w, c]) => `<span><i class="bd" style="--c:${c}"></i>${w}</span>`).join('')}</span><span><span>${mark('checked')}Checked from memory</span><span>${mark('done')}Read</span><span>${mark('learning')}Learning</span><span>${mark('todo')}Not started</span></span></div>
      ${road()}`;
    if (k === 'weeks') return `<div class="hl-list">
      <h3>Week 10 · 9 to 15 Nov · about 4 hours</h3>
      ${row({ i: 'book-open', tone: 'hi', now: true, b: 'Finish Why we forget', wk: 'Today', s: 'About 10 minutes left · then two cards for tomorrow', r: '<span class="say mid">Now</span>', attr: 'data-continue' })}
      ${row({ i: 'file-text', b: 'Seminar 5 reading', wk: 'Tue', s: 'Roediger & Karpicke (2006) · 11 pages · from Dr. Rahimova’s email', r: '<span class="say">40 min</span>' })}
      ${row({ i: 'layers', tone: 'sky', b: 'Review: How memory works', wk: 'Wed', s: 'Its check opens Thursday. From memory: no notes, no Bili', r: '<span class="say">15 min</span>' })}
      ${row({ i: 'flag', tone: 'rose', b: 'Quiz 2: memory and forgetting', wk: 'Thu 12 Nov', s: 'In the seminar · 10% of the grade · topics 5 and 6', r: '<span class="say mid">Ready for most of it</span>' })}
      ${row({ i: 'pen-line', b: 'Essay 1: a memory study', wk: 'Fri 13 Nov', s: `1,500 words · 20% · ${person('lola', 16)}Lola heard it was extended, waiting for your yes`, r: '<span class="say">Outline started</span>' })}
      <h3>Later</h3>
      ${row({ i: 'calendar-days', b: 'Week 11', wk: '16 to 22 Nov', s: 'Learning and conditioning · Sleep and dreams' })}
      ${row({ i: 'calendar-days', b: 'Week 12', wk: '23 to 29 Nov', s: 'Emotion · Motivation' })}
      ${row({ i: 'graduation-cap', tone: 'sky', b: 'Exam week', wk: '7 to 11 Dec', s: 'Stress and health · two past papers · final exam Fri 11 Dec, 09:30' })}</div>`;
    if (k === 'deadlines') return `<div class="hl-list">
      <h3>This week</h3>
      ${row({ i: 'flag', tone: 'rose', b: 'Quiz 2: memory and forgetting', s: `Thu 12 Nov, in the seminar · 10% · moved there by ${person('rahimova', 16)}Dr. Rahimova’s email`, r: '<span class="say mid">Ready for most of it</span><small>finish the three reasons</small>' })}
      ${row({ i: 'file-text', b: 'Seminar 5 reading', s: 'Thu 12 Nov · Roediger & Karpicke (2006) · not graded', r: '<span class="say">Not started</span><small>11 pages</small>' })}
      ${row({ i: 'pen-line', tone: 'apricot', b: 'Essay 1: a memory study', s: `1,500 words · 20% · ${person('lola', 16)}Lola saw “extended to Friday 13 Nov” in the class chat`, r: '<span class="say warn">Tentative</span><small>waiting for your yes</small>' })}
      <h3>Later</h3>
      ${row({ i: 'graduation-cap', tone: 'sky', b: 'Final exam', s: 'Fri 11 Dec, 09:30, Main Hall · 50% · from the exam timetable', r: '<span class="say good">On track</span><small>4 of 14 topics checked</small>' })}</div>`;
    if (k === 'grades') return `<div class="hl-list">
      <div class="gsum"><span class="ico" style="--c:var(--card);--t:var(--sky-ink)"><i data-lucide="graduation-cap"></i></span><span>So far you have <b>74%</b> on the 20% that’s been marked. To finish on 70% overall, you need about <b>69%</b> across what’s left.</span></div>
      <h3>Assessments</h3>
      ${[['Quiz 1', 'Marked 2 Nov', '10%', '8 / 10'], ['Research methods task', 'Marked 28 Oct', '10%', '68%'], ['Quiz 2', 'Thu 12 Nov', '10%', ''], ['Essay 1: a memory study', 'Fri 13 Nov, if the extension holds', '20%', ''], ['Final exam', 'Fri 11 Dec', '50%', '']].map((g) => row({ i: g[3] ? 'circle-check' : 'clock', tone: g[3] ? 'leaf' : '', b: g[0], s: `${g[1]} · worth ${g[2]}`, r: g[3] ? `<span class="say good">${g[3]}</span>` : '<small>Not marked yet</small>' })).join('')}
      <h3>Readiness against real grades</h3>
      ${row({ i: 'target', tone: 'lilac', b: 'Quiz 1: readiness said 75%, you got 80%', s: 'BiliMind’s guess was 5 points under. It learns from every grade you add.' })}</div>`;
    return '';
  };

  let hsub = 'roadmap';
  const el = h(`<section class="hview"><div class="rm">
    <div class="rm-head"><img src="img/cover-psychology.jpg" alt=""><div><h1>Psychology 101</h1><div class="meta">${person('rahimova', 18)}Dr. Rahimova · PSY101<span class="sem"> · Semester 1</span> · final Fri 11 Dec</div></div>
      <div class="mates"><span class="faces">${['aziz', 'lola', 'timur', 'sara'].map((k) => person(k, 28)).join('')}</span>26 in the class</div></div>
    <div class="rm-bar"><div class="seg" role="tablist" aria-label="Course views"><span class="ind"></span>${SUBS.map((s) => `<button data-k="${s[0]}" role="tab"><i data-lucide="${s[2]}"></i>${s[1]}</button>`).join('')}</div><span class="r"><i data-lucide="sparkles" style="width:13px;height:13px"></i>Path built from the syllabus and Lectures 1 to 12</span></div>
    ${SUBS.map((s) => `<div class="hsub" data-k="${s[0]}" hidden></div>`).join('')}
  </div></section>`);

  const moveInd = () => { const b = $('.seg button.on', el), ind = $('.seg .ind', el); if (b && ind && b.offsetWidth) { ind.style.width = b.offsetWidth + 'px'; ind.style.transform = `translateX(${b.offsetLeft - 3}px)`; } };
  const setSub = (k) => {
    hsub = C.hsub = k;
    $$('.seg button', el).forEach((b) => { b.classList.toggle('on', b.dataset.k === k); b.setAttribute('aria-selected', String(b.dataset.k === k)); });
    $$('.hsub', el).forEach((s) => (s.hidden = s.dataset.k !== k));
    const s = $(`.hsub[data-k="${k}"]`, el);
    if (!s.dataset.built) { s.innerHTML = subHTML(k); s.dataset.built = 1; icons(); }
    const def = SUBS.find((x) => x[0] === k);
    C.views.home.title = def[1]; C.views.home.icon = def[2];
    C.renderTabs();
    requestAnimationFrame(() => { moveInd(); if (k === 'roadmap') draw(); });
    C.syncSb();
  };

  /* the path: one spine down the middle, twigs out to the parts, dashes to the notes */
  const draw = () => {
    const rd = $('#road', el), svg = $('#roadSvg', el);
    if (!rd || !rd.getClientRects().length || !rd.offsetWidth) return;
    const R = rd.getBoundingClientRect();
    svg.setAttribute('width', rd.offsetWidth); svg.setAttribute('height', rd.offsetHeight);
    svg.setAttribute('viewBox', `0 0 ${rd.offsetWidth} ${rd.offsetHeight}`);
    const rel = (n) => { const r = n.getBoundingClientRect(); return { l: r.left - R.left, r: r.right - R.left, t: r.top - R.top, b: r.bottom - R.top, cx: r.left - R.left + r.width / 2, cy: r.top - R.top + r.height / 2 }; };
    const tops = $$('.node.topic', rd);
    let out = '';
    tops.forEach((n, i) => {
      const a = rel(n), t = D.T[TI[n.dataset.id]];
      if (i < tops.length - 1) {
        const b = rel(tops[i + 1]);
        const past = ['checked', 'done'].includes(t.s);
        out += `<path class="spine ${past ? 'past' : 'fut'}" d="M${a.cx},${a.b} L${b.cx},${b.t}"/>`;
      }
      if (C.phoneMQ.matches) return;
      $$(`.node.sub[data-sub^="${n.dataset.id}:"], .rnote`, n.closest('.rrow')).forEach((s) => {
        const c = rel(s), left = c.cx < a.cx;
        const x0 = left ? c.r : c.l, x1 = left ? a.l : a.r, mx = (x0 + x1) / 2;
        const cls = s.classList.contains('rnote') ? 'tonote' : `twig ${['checked', 'done'].includes(t.s) ? 'past' : ''}`;
        out += `<path class="${cls}" d="M${x0},${c.cy} C${mx},${c.cy} ${mx},${a.cy} ${x1},${a.cy}"/>`;
      });
    });
    svg.innerHTML = out;
    svg.classList.add('on');
  };

  /* the brief: a popover, not a tab */
  const brief = (id, anchorEl) => {
    let t, sub = null, j;
    if (id.includes(':')) { const [tid, jj] = id.split(':'); t = D.T[TI[tid]]; j = +jj; sub = t.subs[j]; } else t = D.T[TI[id]];
    const n = anchorEl || $(`.node.topic[data-id="${t.id}"]`, el);
    if (!n) return;
    const i = TI[t.id];
    const st = sub ? (t.s === 'checked' ? 'checked' : t.s === 'done' ? 'done' : 'todo') : t.s;
    const segI = { done: 0, checked: 0, learning: 1, skip: 2 }[st];
    const pop = h(`<div class="pop" role="dialog" aria-label="${esc(sub ? sub[0] : t.t)}">
      <div class="pk"><span class="ico" style="--c:var(--hi-soft);--t:var(--hi-ink)"><i data-lucide="${t.i}"></i></span>${sub ? `<span class="bd" style="--c:${D.BADGE[sub[1]][1]}"></span>${D.BADGE[sub[1]][0]} · part of ${esc(t.t)}` : `Topic ${i + 1} of 14 · ${t.min} min · Lecture ${t.lec}`}</div>
      <h4>${esc(sub ? sub[0] : t.t)}</h4>
      <p>${sub ? (sub[1] === 'alt' ? 'Pick this or the recommended part, not both.' : sub[1] === 'any' ? 'Order isn’t strict here. Come back to it whenever.' : 'Our pick. It’s taught inside the lesson.') : 'After this you can ' + t.can.charAt(0).toLowerCase() + t.can.slice(1)}</p>
      <div class="pst">${mark(st)}<span>${sub ? D.STATUS[st] : t.when || D.STATUS[st]}</span></div>
      ${sub ? '' : `<div class="stseg" role="radiogroup" aria-label="Status"><span class="ind" style="${segI === undefined ? 'opacity:0' : `transform:translateX(${segI * 100}%)`}"></span>
        <button data-st="done" class="${segI === 0 ? 'on' : ''}" role="radio" aria-checked="${segI === 0}"><i data-lucide="check"></i>Done</button>
        <button data-st="learning" class="${segI === 1 ? 'on' : ''}" role="radio" aria-checked="${segI === 1}"><i data-lucide="book-open"></i>Learning</button>
        <button data-st="skip" class="${segI === 2 ? 'on' : ''}" role="radio" aria-checked="${segI === 2}"><i data-lucide="skip-forward"></i>Skip</button></div>`}
      <div class="pacts"><button class="btn-xs dark" data-openl>${t.id === 'forget' ? 'Continue the lesson' : t.s === 'todo' ? 'Write this lesson' : 'Open the lesson'}<i data-lucide="arrow-right"></i></button>${sub ? '' : `<button class="btn-xs ghost" data-ask>Ask</button>`}</div>
    </div>`);
    if (!C.openPop(pop, n, C.phoneMQ.matches ? 'below' : 'right', 'center')) return;
    n.classList.add('sel');
    pop.addEventListener('click', (e) => {
      const sb = e.target.closest('[data-st]');
      if (sb) {
        const v = sb.dataset.st;
        if (t.s === 'checked' && v === 'done') return toast('Already checked from memory. It comes back for review in a few weeks', 'check');
        $$('.stseg button', pop).forEach((b) => { b.classList.toggle('on', b === sb); b.setAttribute('aria-checked', String(b === sb)); });
        const ind = $('.stseg .ind', pop); ind.style.opacity = 1; ind.style.transform = `translateX(${['done', 'learning', 'skip'].indexOf(v) * 100}%)`;
        t.s = v;
        $('.pst', pop).innerHTML = `${mark(v, 'popin')}<span>${v === 'done' ? 'Read. Its check opens in a few days, from memory' : D.STATUS[v] || 'Skipped. It stays on the path, greyed out'}</span>`;
        const node = $(`.node.topic[data-id="${t.id}"]`, el);
        node.querySelector('.mk').outerHTML = mark(v, 'popin');
        node.classList.remove('checked', 'done', 'learning', 'todo', 'skip'); node.classList.add(v);
        C.renderSb();
        return;
      }
      if (e.target.closest('[data-openl]')) { C.closePop(); if (t.id === 'forget') { C.open('lesson:forget'); setTimeout(() => C.gotoSection && C.gotoSection(sub && j === 1 ? 'sreasons' : 'sreasons'), 450); } else toast(t.s === 'todo' ? `Bili writes “${t.t}” from Lecture ${t.lec} and Myers & DeWall ch. ${t.ch}. About a minute` : `“${t.t}” opens here`, t.s === 'todo' ? 'sparkles' : 'book-open'); }
      if (e.target.closest('[data-ask]')) { C.closePop(); C.typeAndSend(`Give me the one thing to remember from ${t.t}`); }
    });
  };

  el.addEventListener('click', (e) => {
    const sb = e.target.closest('.seg button'); if (sb) return setSub(sb.dataset.k);
    if (e.target.closest('bili-blob')) return;
    const n = e.target.closest('.node'); if (n) return brief(n.dataset.id || n.dataset.sub, n);
    if (e.target.closest('[data-continue]')) { C.open('lesson:forget'); setTimeout(() => C.gotoSection && C.gotoSection('sreasons'), 420); }
  });

  C.addView({ id: 'home', kind: 'home', title: 'Roadmap', icon: 'route', thumb: 'img/cover-psychology.jpg', closable: false, pinned: true, el, show: () => requestAnimationFrame(() => { moveInd(); if (hsub === 'roadmap') draw(); }) });
  C.openHome = (k) => { if (k) setSub(k); C.open('home'); };
  C.brief = (id) => { setSub('roadmap'); requestAnimationFrame(() => { const n = $(`.node.topic[data-id="${id}"]`, el); if (!n) return; C.reveal(n, 160); setTimeout(() => brief(id, n), C.reduce ? 0 : 380); }); };
  C.drawRoad = draw;
  setSub('roadmap');
  new ResizeObserver(() => { if (C.active === 'home' && hsub === 'roadmap') draw(); }).observe(el);
})();

/* The lesson: Why we forget (Topic 6 of 14). */
(() => {
  const { D, $, $$, h, icons, toast, mark } = C;
  const cite = (k, label) => `<button class="cite" data-src="${k}"><i data-lucide="${D.SRC[k][1]}"></i>${label || D.SRC[k][0]}</button>`;
  /* catmull-rom through the points, as cubic beziers */
  const smooth = (p) => {
    let d = `M${p[0][0]},${p[0][1]}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0]},${p2[1]}`;
    }
    return d;
  };
  C.smooth = smooth;

  /* Ebbinghaus's savings, 1885 */
  const E = [[0, 100, 'learned'], [1, 58, '20 min'], [2, 44, '1 hour'], [3, 36, '9 hours'], [4, 34, '1 day'], [5, 28, '2 days'], [6, 25, '6 days'], [7, 21, '31 days']];
  const X = (i) => 46 + i * 80, Y = (p) => 18 + (100 - p) * 1.7;
  const d = smooth(E.map(([i, p]) => [X(i), Y(p)]));
  const curve = `<svg class="chart" viewBox="0 0 640 214" role="img" aria-label="Ebbinghaus’s forgetting curve: 100% when learned, 58% after 20 minutes, 44% after an hour, 34% after a day, 21% after a month">
    ${[100, 75, 50, 25].map((p) => `<line x1="40" x2="626" y1="${Y(p)}" y2="${Y(p)}" class="grid"/><text x="32" y="${Y(p) + 4}" class="ax" text-anchor="end">${p}%</text>`).join('')}
    <path d="${d} L${X(7)},${Y(0)} L${X(0)},${Y(0)} Z" class="area"/>
    <path d="${d}" class="line" pathLength="1"/>
    ${E.map(([i, p, l], k) => `<circle cx="${X(i)}" cy="${Y(p)}" r="4" class="dot" style="--k:${k}"/><text x="${X(i) + 7}" y="${Y(p) - 9}" class="val" style="--k:${k}">${i ? p + '%' : ''}</text><text x="${X(i)}" y="208" class="ax" text-anchor="middle">${l}</text>`).join('')}
  </svg>`;

  const t = D.T.find((x) => x.id === 'forget');
  const el = h(`<section class="lview"><div class="rprog"><i id="rprog"></i></div><div class="docwrap" id="docwrap"><article class="doc" id="doc">
    <figure class="hero-ill"><img src="img/lesson-forgetting.jpg" alt=""></figure>
    <div class="crumb"><button data-home>Psychology 101</button><i data-lucide="chevron-right" class="pt"></i><span class="pt">Part 2 · Memory and learning</span><i data-lucide="chevron-right"></i><span>Topic 6 of 14</span></div>
    <h1>Why we forget</h1>
    <div class="lmeta"><span class="chip learning">${mark('learning')}Learning</span><span><i data-lucide="clock-3"></i>20 min</span><span><i data-lucide="file-text"></i>From Lecture 6 and Myers &amp; DeWall, ch. 8</span><span><i data-lucide="flag"></i>On Quiz 2, Thu</span></div>
    <p class="lead">You read a chapter on Sunday, and by Thursday most of it has gone. That isn’t a flaw in you. Forgetting follows a pattern, and once you know the pattern you can plan around it.</p>
    <p>This lesson covers the shape of forgetting, the three reasons it happens, and the habit that slows it down most.</p>

    <h2 id="s1"><span class="sn">1</span>The forgetting curve</h2>
    <p>In 1885 the German psychologist Hermann Ebbinghaus learned lists of nonsense syllables, like WID, ZOF and KEB, so that meaning couldn’t help him. Then he timed how long it took to relearn each list after a delay. The less time relearning took, the more he had kept ${cite('s12', 'slide 12')}.</p>
    <figure class="fig" id="fig1"><div class="fig-h"><i data-lucide="chart-spline"></i>Figure 1 · How much of a list Ebbinghaus still had<span class="r">Savings, 1885</span></div>${curve}<figcaption>Measured by how much faster he relearned each list. The drop is steepest in the first hour.</figcaption></figure>
    <p>Forgetting is <span id="keyWord">steep at first</span>, then levels off. Within a day he had lost most of what he’d learned; after a month, only a little more had gone. The useful part is what happens when you come back to it: each review makes the next drop shallower ${cite('myers8')}.</p>

    <h2 id="stry"><span class="sn">2</span>Try it: space out your reviews</h2>
    <p>Drag the review days along the line and watch what reaches exam day. Add or take away reviews with the buttons.</p>
    <div class="fig play" id="play">
      <div class="play-h"><span class="fig-h"><i data-lucide="sliders-horizontal"></i>Try it · 30 days to the exam</span><span class="play-n"><button class="icon-btn" data-rv="-1" aria-label="One review fewer"><i data-lucide="minus"></i></button><b data-rvn>3 reviews</b><button class="icon-btn" data-rv="1" aria-label="One more review"><i data-lucide="plus"></i></button></span></div>
      <svg viewBox="0 0 640 236" class="chart play-svg" aria-label="How much you remember over 30 days with your review days"></svg>
      <div class="play-out" data-out></div>
    </div>

    <div class="h2wrap"><span class="leftoff"><i data-lucide="bookmark"></i>You stopped here on Saturday</span><h2 id="sreasons"><span class="sn">3</span>Three reasons we forget</h2></div>
    <p>Not all forgetting is the same, and each kind has its own fix ${cite('s14', 'slides 14 to 16')}.</p>
    <div class="tbl"><table>
      <thead><tr><th></th><th><i style="--c:var(--apricot)"></i>Decay</th><th><i style="--c:var(--rose)"></i>Interference</th><th><i style="--c:var(--sky)"></i>Retrieval failure</th></tr></thead>
      <tbody>
        <tr><th>What happens</th><td>A memory fades when it’s never used.</td><td>Other memories get in the way, especially similar ones.</td><td>The memory is there, but the cue to reach it is missing.</td></tr>
        <tr><th>Feels like</th><td>“I knew this in September.”</td><td>Writing last year’s date in January.</td><td>It’s on the tip of your tongue.</td></tr>
        <tr><th>What helps</th><td>Use it again.</td><td>Space out similar topics and review them.</td><td>Practise recalling it the way you’ll be asked.</td></tr>
      </tbody></table></div>
    <p>Interference is the one that catches students out most, because a course is full of similar ideas. <span class="hl static" id="askedHl">Proactive interference means old learning blocks new learning; retroactive interference means new learning pushes out old.</span><button class="asked" data-chat><i data-lucide="message-circle"></i>Asked</button> Learning two similar topics on the same evening invites both.</p>

    <h2 id="smyth"><span class="sn">4</span>What doesn’t work as well as it feels</h2>
    <div class="callout"><div class="ch"><i data-lucide="triangle-alert"></i>The misconception</div><q>Rereading and highlighting make it stick.</q><p>They make material feel familiar, which isn’t the same as being able to recall it. In a well-known study, students who tested themselves remembered much more a week later than students who spent the same time rereading ${cite('sem5', 'Roediger & Karpicke, 2006')}.</p><p class="aside">So use the highlighter to mark what you’ll test yourself on, not instead of testing.</p></div>
    <div class="mcq" id="mcq"><div class="blk-h"><i data-lucide="circle-help"></i>Quick check<span class="r">Practice, not graded</span></div>
      <div class="q">You have a quiz in a week. Which way of studying gets you the most marks?</div>
      <div class="opts">
        <button class="opt" data-ok="0" data-fb="<b>Not this one.</b> Rereading makes the chapter feel familiar, but a week later most of it has gone."><span class="ol">A</span>Rereading the chapter three times</button>
        <button class="opt" data-ok="0" data-fb="<b>Not on its own.</b> Highlighting picks out what matters, but it doesn’t help you recall it."><span class="ol">B</span>Highlighting the key parts</button>
        <button class="opt" data-ok="1" data-fb="<b>Right.</b> Each time you pull an answer out of memory, it gets easier to pull out again. That’s the testing effect."><span class="ol">C</span>Reading it once, then testing yourself twice</button>
        <button class="opt" data-ok="0" data-fb="<b>Not quite.</b> Neat notes are nice to have, but copying them out is mostly rereading with a pen."><span class="ol">D</span>Copying your notes out neatly</button>
      </div><div class="fb"><div><p></p></div></div></div>
    <div class="blk-h"><i data-lucide="layers"></i>Two cards from this lesson<span class="r">Tap to flip · due tomorrow</span></div>
    <div class="cards">
      <button class="fcard"><div class="fi"><div class="ff"><small>Card 1 of 2</small><b>Proactive interference</b><small>What is it?</small></div><div class="fbk"><small>Answer</small><p>Old learning gets in the way of new.</p></div></div></button>
      <button class="fcard"><div class="fi"><div class="ff"><small>Card 2 of 2</small><b>Retroactive interference</b><small>What is it?</small></div><div class="fbk"><small>Answer</small><p>New learning makes older memories harder to recall.</p></div></div></button>
    </div>
    <div class="lfoot"><button class="btn-xs dark" data-read><i data-lucide="check"></i>Mark as read</button><span class="lfn">Its check opens a few days after you finish, from memory: no notes, no Bili.</span></div>
    <div class="pager"><button data-toast="How memory works opens here"><small><i data-lucide="arrow-left"></i>Previous</small><b>How memory works</b></button><button class="nx" data-toast="Bili writes Learning and conditioning when you’re ready"><small>Next<i data-lucide="arrow-right"></i></small><b>Learning and conditioning</b></button></div>
    <div class="sources">Sources: Lecture 6 slides, pp. 12 to 18 · Myers &amp; DeWall, <em>Psychology</em>, ch. 8 · Roediger &amp; Karpicke (2006), the Seminar 5 reading · Ebbinghaus (1885), <em>Über das Gedächtnis</em></div>
  </article></div></section>`);

  /* the spacing playground */
  const initPlay = () => {
    const box = $('#play', el), svg = $('.play-svg', box), out = $('[data-out]', box), nEl = $('[data-rvn]', box);
    const W = 640, x0 = 40, x1 = 616, y0 = 18, y1 = 176, DAYS = 30;
    const px = (dd) => x0 + (dd / DAYS) * (x1 - x0), py = (r) => y1 - r * (y1 - y0);
    let rv = [1, 7, 16];
    const R = (tt, list) => {
      let k = 0, last = 0;
      for (const r of list) if (r <= tt) { k++; last = r; }
      const S = 0.6 * Math.pow(3.5, k), a = Math.min(0.8, 0.2 + 0.18 * k);
      return a + (1 - a) * Math.exp(-(tt - last) / S);
    };
    const path = (list) => { let s = ''; for (let tt = 0; tt <= DAYS + 0.001; tt += 0.1) s += `${s ? 'L' : 'M'}${px(tt).toFixed(1)},${py(R(tt, list)).toFixed(1)}`; return s; };
    const draw = () => {
      const sorted = [...rv].sort((a, b) => a - b);
      const w = path(sorted);
      svg.innerHTML = `${[1, 0.5].map((r) => `<line x1="${x0}" x2="${x1}" y1="${py(r)}" y2="${py(r)}" class="grid"/><text x="${x0 - 8}" y="${py(r) + 4}" class="ax" text-anchor="end">${r * 100}%</text>`).join('')}
        <line x1="${x0}" x2="${x1}" y1="${y1}" y2="${y1}" class="base"/>
        <line x1="${px(DAYS)}" x2="${px(DAYS)}" y1="${y0 - 6}" y2="${y1}" class="exam"/><text x="${px(DAYS) - 4}" y="${y0 - 8}" class="ax exam-t" text-anchor="end">Exam</text>
        <path d="${w} L${px(DAYS)},${y1} L${x0},${y1} Z" class="withA"/>
        <path d="${path([])}" class="none"/>
        <path d="${w}" class="with"/>
        <line x1="${x0}" x2="${x1}" y1="206" y2="206" class="track"/>
        ${[0, 7, 14, 21, 28].map((dd) => `<text x="${px(dd)}" y="230" class="ax" text-anchor="middle">${dd === 0 ? 'Today' : 'Day ' + dd}</text>`).join('')}
        ${rv.map((dd, i) => `<g class="knob" data-i="${i}" transform="translate(${px(dd)},206)"><line y1="-12" y2="${-(206 - py(R(dd + 0.001, sorted)))}" class="stem"/><circle r="9"/><text y="3.5" text-anchor="middle">${i + 1}</text></g>`).join('')}`;
      const withR = Math.round(R(DAYS, sorted) * 100), noneR = Math.round(R(DAYS, []) * 100);
      out.innerHTML = `<span class="k w"><b class="num">${rv.length ? withR : noneR}%</b><small>${rv.length ? 'with your reviews' : 'no reviews'}</small></span><span class="k n"><b class="num">${noneR}%</b><small>with none</small></span><p>${rv.length ? `Reviews on day ${sorted.map((x) => (x % 1 ? x.toFixed(1) : x)).join(', ')}. The later reviews do the most for exam day.` : 'Add a review to see the difference.'}</p>`;
      nEl.textContent = rv.length === 1 ? '1 review' : `${rv.length} reviews`;
    };
    svg.addEventListener('pointerdown', (e) => {
      const k = e.target.closest('.knob'); if (!k || document.body.classList.contains('drawing')) return;
      e.preventDefault();
      const i = +k.dataset.i, r = svg.getBoundingClientRect();
      const mv = (ev) => { const vx = ((ev.clientX - r.left) / r.width) * W; rv[i] = Math.max(0.5, Math.min(DAYS - 0.5, Math.round(((vx - x0) / (x1 - x0)) * DAYS * 2) / 2)); draw(); svg.querySelector(`.knob[data-i="${i}"]`)?.classList.add('drag'); };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); draw(); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
      k.classList.add('drag');
    });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rv]'); if (!b) return;
      if (+b.dataset.rv > 0 && rv.length < 5) rv.push([3, 10, 22, 26, 13].find((x) => !rv.includes(x)) ?? 12);
      if (+b.dataset.rv < 0 && rv.length) rv.pop();
      draw();
    });
    draw();
  };

  /* behaviour */
  el.addEventListener('click', (e) => {
    if (document.body.classList.contains('drawing')) return;
    if (e.target.closest('[data-home]')) return C.openHome('roadmap');
    const c = e.target.closest('[data-src]');
    if (c) { const s = D.SRC[c.dataset.src]; return s[2] ? C.gotoSection(s[2]) : toast(`${s[0]} opens beside the lesson`, s[1]); }
    if (e.target.closest('[data-chat]')) { C.openAssistant(); return C.flashThread && C.flashThread(); }
    const o = e.target.closest('.opt');
    if (o && !o.closest('.opts').dataset.done) {
      const ok = o.dataset.ok === '1';
      o.classList.add(ok ? 'right' : 'wrong');
      const fb = $('.fb', el);
      $('p', fb).innerHTML = `<bili-blob size="24" mood="${ok ? 'happy' : 'think'}"></bili-blob><span>${o.dataset.fb}</span>`;
      fb.classList.add('on');
      if (ok) { o.closest('.opts').dataset.done = 1; $('.mcq .r', el).textContent = 'Got it first try'; }
      else setTimeout(() => o.classList.remove('wrong'), 1400);
      return;
    }
    const fc = e.target.closest('.fcard'); if (fc) return fc.classList.toggle('flip');
    const rd = e.target.closest('[data-read]');
    if (rd) { rd.outerHTML = '<span class="say good"><i data-lucide="check" style="width:13px;height:13px;margin-right:4px"></i>Read today</span>'; icons(); toast('Marked as read. Its check opens Thursday, from memory', 'calendar-check'); }
  });
  const sc = el;
  sc.addEventListener('scroll', () => { const m = sc.scrollHeight - sc.clientHeight; $('#rprog').style.width = (m > 0 ? (sc.scrollTop / m) * 100 : 0) + '%'; }, { passive: true });
  const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('on'); io.unobserve(en.target); } }), { root: sc, threshold: 0.35 });
  io.observe($('#fig1', el));

  C.addView({ id: 'lesson:forget', kind: 'lesson', title: 'Why we forget', icon: 'book-open', el, inkHost: $('#docwrap', el), show: () => {} });
  C.gotoSection = (id) => { if (C.active !== 'lesson:forget') C.open('lesson:forget'); const s = $('#' + id, el); if (s) setTimeout(() => C.reveal(s, 40), 60); };
  C.lessonEl = el;
  initPlay();
})();

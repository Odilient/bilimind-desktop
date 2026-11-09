/* The whiteboard: the forgetting curve drawn by hand, sticky notes, and Aziz and Sara working on it live. */
(() => {
  const { $, $$, h, person, first, reduce } = C;
  const NS = 'http://www.w3.org/2000/svg';
  const notes = [
    { x: 796, y: 70, t: 'Review after 1 day, 1 week, 1 month', c: '', r: -1.6, by: 'madina' },
    { x: 806, y: 226, t: 'Sleep the night after helps it stick', c: 'sky', r: 1.4, by: 'sara' },
    { x: 792, y: 382, t: 'He used nonsense syllables, so real material fades slower', c: 'leaf', r: -0.8, by: 'aziz' },
  ];
  const labels = [
    { x: 520, y: 470, t: 'without reviews', c: 'var(--rose)' }, { x: 548, y: 118, t: 'with reviews', c: 'var(--leaf-ink)' },
    { x: 196, y: 548, t: '1 day', c: 'var(--ink-3)' }, { x: 330, y: 548, t: '1 week', c: 'var(--ink-3)' }, { x: 586, y: 548, t: '1 month', c: 'var(--ink-3)' },
    { x: 116, y: 64, t: 'how much you remember', c: 'var(--ink-3)' }, { x: 148, y: 300, t: 'review!', c: 'var(--leaf-ink)' },
  ];
  const cursorSvg = '<svg viewBox="0 0 16 16"><path d="M2 1.5l11 5.2-4.6 1.3L6.6 12.8z"/></svg>';
  const el = h(`<section class="bview"><div class="board" id="board"><div class="world" id="world">
      <div class="b-frame"><span class="ft"><i data-lucide="frame"></i>Seminar 5 prep</span></div>
      ${labels.map((l) => `<div class="blabel" style="left:${l.x}px;top:${l.y}px;--c:${l.c}">${l.t}</div>`).join('')}
      ${notes.map((n) => `<div class="sticky ${n.c}" style="left:${n.x}px;top:${n.y}px;--rot:${n.r}deg">${n.t}<span class="by">${person(n.by, 16)}${first(n.by)}</span></div>`).join('')}
      <div class="slide-card" style="left:800px;top:528px"><div class="sc-in"><b>The forgetting curve</b><i style="width:80%"></i><i style="width:56%"></i><svg viewBox="0 0 120 30" width="120" height="30"><path d="M2 2 C 14 22, 30 26, 118 28" fill="none" stroke="var(--sky)" stroke-width="2"/></svg></div><div class="sc-f"><i data-lucide="file" style="width:12px;height:12px"></i>Lecture 6, slide 13 · pasted by Aziz</div></div>
      <svg class="ink" id="boardInk"></svg>
      <div class="cursor" data-cur="aziz" style="--c:var(--sky)">${cursorSvg}<span>${person('aziz', 16)}Aziz</span><div class="say-b"></div></div>
      <div class="cursor" data-cur="sara" style="--c:var(--lilac)">${cursorSvg}<span>${person('sara', 16)}Sara</span><div class="say-b"></div></div>
    </div></div>
    <div class="b-head"><span class="ico" style="--c:var(--lilac-soft);--t:var(--lilac-ink)"><i data-lucide="presentation"></i></span><div><b>The forgetting curve, drawn out</b><span><span class="faces">${person('madina', 18)}${person('aziz', 18)}${person('sara', 18)}</span>Aziz and Sara are here</span></div></div>
    <div class="mini" aria-hidden="true"><i style="left:8px;top:6px;width:67px;height:54px"></i><i style="left:77px;top:7px;width:19px;height:12px;background:#fff1a8"></i><i style="left:78px;top:22px;width:19px;height:12px;background:#d6e6ff"></i><i style="left:77px;top:37px;width:19px;height:12px;background:#d9f0d2"></i><span class="vp" id="vp"></span></div>
    <div class="zoom"><button class="icon-btn" data-z="-1" data-tip="Zoom out" aria-label="Zoom out"><i data-lucide="minus"></i></button><span class="num" data-zl>100%</span><button class="icon-btn" data-z="1" data-tip="Zoom in" aria-label="Zoom in"><i data-lucide="plus"></i></button><button class="icon-btn" data-z="0" data-tip="Fit" aria-label="Fit to screen"><i data-lucide="maximize"></i></button></div>
  </section>`);
  const board = $('#board', el), world = $('#world', el), ink = $('#boardInk', el);
  ink.setAttribute('width', 1040); ink.setAttribute('height', 640);

  /* the drawing on the board, slightly wobbly like a hand did it */
  const wob = (pts) => pts.map(([x, y], i) => [x + Math.sin(i * 1.7) * 0.8, y + Math.cos(i * 2.3) * 0.8]);
  const stroke = (pts, col, w = 2.6) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', 'pen'); p.style.stroke = col; p.style.strokeWidth = w; p.setAttribute('d', C.smooth(pts)); ink.append(p); return p; };
  stroke(wob([[100, 90], [101, 250], [102, 400], [104, 528]]), 'var(--ink-2)', 2.2);
  stroke(wob([[104, 528], [300, 529], [500, 527], [736, 528]]), 'var(--ink-2)', 2.2);
  stroke(wob([[726, 520], [737, 528], [726, 536]]), 'var(--ink-2)', 2.2);
  stroke(wob([[92, 102], [101, 88], [110, 102]]), 'var(--ink-2)', 2.2);
  stroke(wob([[106, 118], [134, 270], [174, 360], [234, 412], [334, 440], [484, 456], [736, 466]]), 'var(--rose)');
  stroke(wob([[106, 118], [154, 222], [200, 266], [204, 132], [254, 170], [334, 212], [340, 128], [424, 150], [564, 178], [592, 128], [664, 136], [736, 142]]), 'var(--leaf)');
  [[204, 132], [340, 128], [592, 128]].forEach(([x, y]) => stroke([[x, y], [x + 0.5, y - 0.5]], 'var(--leaf)', 8));

  /* pan and zoom */
  const v = { x: 0, y: 0, z: 1 };
  const apply = () => {
    world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.z})`;
    board.style.backgroundSize = `${24 * v.z}px ${24 * v.z}px`;
    board.style.backgroundPosition = `${v.x}px ${v.y}px`;
    $('[data-zl]', el).textContent = Math.round(v.z * 100) + '%';
    const k = 120 / 1040, vp = $('#vp', el);
    vp.style.left = Math.max(0, -v.x / v.z * k) + 'px'; vp.style.top = Math.max(0, -v.y / v.z * k) + 'px';
    vp.style.width = Math.min(120, board.clientWidth / v.z * k) + 'px'; vp.style.height = Math.min(74, board.clientHeight / v.z * k) + 'px';
  };
  const fit = (anim) => {
    const bw = board.clientWidth, bh = board.clientHeight; if (!bw) return;
    v.z = Math.max(0.36, Math.min(1.05, Math.min((bw - 40) / 1040, (bh - 120) / 640)));
    v.x = (bw - 1040 * v.z) / 2; v.y = Math.max(64, (bh - 640 * v.z) / 2 + 10);
    world.style.transition = anim ? 'transform .5s var(--ease)' : ''; apply();
    setTimeout(() => (world.style.transition = ''), 520);
  };
  const zoomAt = (f, cx, cy) => { const nz = Math.max(0.35, Math.min(2.4, v.z * f)); v.x = cx - (cx - v.x) * (nz / v.z); v.y = cy - (cy - v.y) * (nz / v.z); v.z = nz; apply(); };
  el.addEventListener('click', (e) => {
    const z = e.target.closest('[data-z]'); if (!z) return;
    world.style.transition = 'transform .35s var(--ease)';
    if (z.dataset.z === '0') fit(true); else zoomAt(z.dataset.z === '1' ? 1.2 : 1 / 1.2, board.clientWidth / 2, board.clientHeight / 2);
    setTimeout(() => (world.style.transition = ''), 360);
  });
  board.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = board.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top);
    else { v.x -= e.deltaX; v.y -= e.deltaY; apply(); }
  }, { passive: false });
  board.addEventListener('pointerdown', (e) => {
    if (document.body.classList.contains('drawing') || e.button > 0) return;
    const item = e.target.closest('.sticky, .blabel, .slide-card');
    if (item && item.isContentEditable) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    if (item) {
      const ox = item.offsetLeft, oy = item.offsetTop; let moved = false;
      item.classList.add('dragging');
      const mv = (ev) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 3) moved = true; item.style.left = ox + (ev.clientX - sx) / v.z + 'px'; item.style.top = oy + (ev.clientY - sy) / v.z + 'px'; };
      const up = () => {
        item.classList.remove('dragging'); removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
        if (moved) { const nx = item.style.left, ny = item.style.top; C.record(() => { item.style.left = ox + 'px'; item.style.top = oy + 'px'; }, () => { item.style.left = nx; item.style.top = ny; }); }
        else if (item.classList.contains('sticky')) { item.contentEditable = 'true'; item.focus(); item.addEventListener('blur', () => item.removeAttribute('contenteditable'), { once: true }); }
      };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    } else {
      const ox = v.x, oy = v.y; board.classList.add('panning');
      const mv = (ev) => { v.x = ox + ev.clientX - sx; v.y = oy + ev.clientY - sy; apply(); };
      const up = () => { board.classList.remove('panning'); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    }
  });

  /* Aziz and Sara: two cursors drifting between what they're looking at; Sara rings a review bump once */
  const curs = {
    aziz: { el: $('[data-cur="aziz"]', el), path: [[300, 300], [470, 470], [880, 160], [210, 210], [640, 330]], k: 0, t: 0, says: { 2: 'Mine: real material fades slower' } },
    sara: { el: $('[data-cur="sara"]', el), path: [[860, 300], [620, 220], [700, 470], [380, 170]], k: 0, t: 0.4, says: { 1: 'The bumps are the reviews' } },
  };
  const ease = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
  let raf = null, lastT = 0, ringed = false, hold = null;
  const say = (c, text) => { const b = $('.say-b', c.el); b.textContent = text; b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 2600); };
  const ring = () => {
    ringed = true;
    const c = curs.sara, cx = 340, cy = 132, pts = [];
    for (let a = 0; a <= Math.PI * 2.15; a += 0.18) pts.push([cx + Math.cos(a - 1.2) * 30, cy + Math.sin(a - 1.2) * 22]);
    const p = stroke([pts[0], pts[0]], 'var(--lilac)', 2.4);
    let i = 1;
    hold = () => {
      if (i >= pts.length) { hold = null; say(c, 'Circled the week review'); return; }
      p.setAttribute('d', C.smooth(pts.slice(0, i + 1)));
      c.el.style.transform = `translate(${pts[i][0]}px,${pts[i][1]}px)`;
      i++;
    };
  };
  const tick = (now) => {
    if (C.active !== 'board:curve' || !el.isConnected) { raf = null; return; }
    const dt = Math.min(0.05, (now - (lastT || now)) / 1000); lastT = now;
    Object.entries(curs).forEach(([k, c]) => {
      if (k === 'sara' && hold) return hold();
      c.t += dt / 2.8;
      if (c.t >= 1) { c.t = 0; c.k = (c.k + 1) % c.path.length; if (c.says[c.k]) say(c, c.says[c.k]); if (k === 'sara' && !ringed && c.k === 3) ring(); }
      const a = c.path[c.k], b = c.path[(c.k + 1) % c.path.length], e = ease(c.t);
      c.el.style.transform = `translate(${a[0] + (b[0] - a[0]) * e}px, ${a[1] + (b[1] - a[1]) * e}px)`;
    });
    raf = requestAnimationFrame(tick);
  };
  Object.values(curs).forEach((c) => (c.el.style.transform = `translate(${c.path[0][0]}px,${c.path[0][1]}px)`));

  let fitted = false;
  C.addView({ id: 'board:curve', kind: 'board', title: 'Forgetting curve', icon: 'presentation', live: true, el, inkHost: world, inkSvg: ink, inkScale: () => v.z,
    show: () => requestAnimationFrame(() => { if (!fitted && board.clientWidth) { fit(); fitted = true; } if (!raf && !reduce) { lastT = 0; raf = requestAnimationFrame(tick); } }) });
  new ResizeObserver(() => { if (C.active === 'board:curve' && board.clientWidth) { fit(); fitted = true; } }).observe(board);
})();

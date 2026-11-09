/* Pen and markup: pen, marker, highlight, sticky note, handwritten text, arrow, eraser, undo and redo.
   Each page that takes ink has an <svg class="ink"> over its content; strokes live in page coordinates. */
(() => {
  const { $, $$, toast, sleep, reduce, person } = C;
  const NS = 'http://www.w3.org/2000/svg';
  const COL = { ink: 'var(--ink)', rose: 'var(--rose)', sky: 'var(--sky)', leaf: 'var(--leaf)', butter: 'var(--hi-2)' };
  const HCOL = { ink: 'var(--hi)', rose: 'var(--rose)', sky: 'var(--sky)', leaf: 'var(--leaf)', butter: 'var(--hi)' };
  const DRAW = ['pen', 'marker', 'arrow', 'eraser', 'note', 'text'];
  let tool = 'select', color = 'ink';
  const hist = [], redoS = [];

  /* undo / redo */
  const syncUndo = () => { $('#undo').disabled = !hist.length; $('#redo').disabled = !redoS.length; };
  const record = (undo, redo) => { hist.push({ undo, redo }); redoS.length = 0; syncUndo(); };
  const undo = () => { const a = hist.pop(); if (!a) return; a.undo(); redoS.push(a); syncUndo(); };
  const redo = () => { const a = redoS.pop(); if (!a) return; a.redo(); hist.push(a); syncUndo(); };
  const addEl = (el, parent) => { parent.append(el); record(() => el.remove(), () => parent.append(el)); };

  /* one ink layer per page */
  const inkFor = (v) => {
    if (!v || !v.inkHost) return null;
    if (v.ink && v.ink.svg) return v.ink;
    const svg = v.inkSvg || v.inkHost.appendChild(document.createElementNS(NS, 'svg'));
    svg.classList.add('ink');
    const o = { svg, host: v.inkHost, scale: v.inkScale || (() => 1) };
    v.ink = o;
    svg.addEventListener('pointerdown', (e) => down(o, e));
    v.inkHost.addEventListener('pointerdown', (e) => { if (tool === 'eraser' && e.target.closest('.dnote, .dtext')) eraseEl(e.target.closest('.dnote, .dtext')); });
    return o;
  };
  const at = (o, e) => { const r = o.host.getBoundingClientRect(), s = o.scale(); return [(e.clientX - r.left) / s, (e.clientY - r.top) / s]; };
  const arrowD = (x0, y0, x1, y1) => {
    const a = Math.atan2(y1 - y0, x1 - x0), L = 13, mx = (x0 + x1) / 2 - (y1 - y0) * 0.08, my = (y0 + y1) / 2 + (x1 - x0) * 0.08;
    return `M${x0},${y0} Q${mx},${my} ${x1},${y1} M${x1 - L * Math.cos(a - 0.45)},${y1 - L * Math.sin(a - 0.45)} L${x1},${y1} L${x1 - L * Math.cos(a + 0.45)},${y1 - L * Math.sin(a + 0.45)}`;
  };
  const eraseEl = (el) => { const parent = el.parentNode, next = el.nextSibling; el.remove(); record(() => parent.insertBefore(el, next), () => el.remove()); };

  function down(o, e) {
    if (e.button > 0) return;
    e.preventDefault(); e.stopPropagation();
    const [x, y] = at(o, e);
    if (tool === 'eraser') {
      const hit = (ev) => { const t = document.elementFromPoint(ev.clientX, ev.clientY); const p = t && t.closest('.ink path, .ink g.grp'); if (p && o.svg.contains(p)) eraseEl(p.closest('g.grp') || p); };
      hit(e);
      const up = () => { removeEventListener('pointermove', hit); removeEventListener('pointerup', up); };
      addEventListener('pointermove', hit); addEventListener('pointerup', up);
      return;
    }
    if (tool === 'note' || tool === 'text') return place(o, x, y);
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('class', tool === 'arrow' ? 'arrow' : tool);
    p.style.stroke = COL[color];
    o.svg.append(p);
    const pts = [[x, y]];
    const mv = (ev) => {
      const q = at(o, ev), l = pts[pts.length - 1];
      if (tool === 'arrow') { p.setAttribute('d', arrowD(x, y, q[0], q[1])); pts[1] = q; return; }
      if (Math.hypot(q[0] - l[0], q[1] - l[1]) < 1.5) return;
      pts.push(q);
      p.setAttribute('d', 'M' + pts.map((pt) => pt.map((n) => n.toFixed(1)).join(',')).join(' L'));
    };
    const up = () => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      if (tool === 'arrow' ? !pts[1] || Math.hypot(pts[1][0] - x, pts[1][1] - y) < 8 : false) { p.remove(); return; }
      if (tool !== 'arrow') p.setAttribute('d', pts.length > 2 ? C.smooth(pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1)) : `M${x},${y} L${x + 0.1},${y + 0.1}`);
      p.remove(); addEl(p, o.svg);
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }

  function place(o, x, y) {
    const n = document.createElement('div');
    if (tool === 'note') {
      n.className = 'dnote ' + ({ rose: 'rose', sky: 'sky', leaf: 'leaf' }[color] || '');
      n.style.setProperty('--rot', (Math.random() * 3 - 1.5).toFixed(1) + 'deg');
      n.innerHTML = `<span class="nt" contenteditable="true"></span><span class="by" contenteditable="false">${person('madina', 16)}You</span>`;
    } else {
      n.className = 'dtext'; n.contentEditable = 'true';
      n.style.setProperty('--tc', COL[color]);
    }
    n.style.left = x - (tool === 'note' ? 20 : 4) + 'px';
    n.style.top = y - (tool === 'note' ? 16 : 16) + 'px';
    addEl(n, o.host);
    setTool('select');
    const ed = n.querySelector('.nt') || n;
    setTimeout(() => ed.focus(), 30);
    ed.addEventListener('blur', () => { if (!ed.textContent.trim() && n.isConnected) { n.remove(); hist.pop(); syncUndo(); } }, { once: true });
  }

  /* highlight: wrap each text node piece the selection covers in a <mark> */
  const highlightRange = (range, c) => {
    const root = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentNode;
    const nodes = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (range.intersectsNode(n) && n.textContent.trim() && !n.parentNode.closest('button, .ink, mark.hlm') ? 1 : 2) });
    while (w.nextNode()) nodes.push(w.currentNode);
    if (root.nodeType === 3 && range.intersectsNode(root)) nodes.push(root);
    const marks = [];
    nodes.forEach((n) => {
      const s = n === range.startContainer ? range.startOffset : 0, e = n === range.endContainer ? range.endOffset : n.length;
      if (s >= e) return;
      const mid = n.splitText(s); mid.splitText(e - s);
      const m = document.createElement('mark'); m.className = 'hlm'; m.style.setProperty('--hc', c);
      mid.parentNode.insertBefore(m, mid); m.append(mid); marks.push(m);
    });
    const unwrap = () => marks.forEach((m) => { const p = m.parentNode; if (!p) return; m.replaceWith(...m.childNodes); p.normalize(); });
    const rewrap = () => toast('Highlight back', 'highlighter');
    if (marks.length) record(unwrap, rewrap);
    return marks;
  };
  const docSel = () => {
    const s = getSelection();
    if (!s.rangeCount || s.isCollapsed) return null;
    const r = s.getRangeAt(0), d = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode;
    const doc = d.closest('.doc, .ndoc .nb');
    if (!doc || !s.toString().trim()) return null;
    return { s, r, text: s.toString().trim().replace(/\s+/g, ' ') };
  };

  /* the pill on a selection: ask, highlight, make a card */
  let pill = null;
  const closeSelPill = () => { if (pill) { pill.remove(); pill = null; } };
  document.addEventListener('pointerup', (e) => {
    if (e.target.closest?.('.selpill, .tray')) return;
    setTimeout(() => {
      const sel = docSel();
      if (!sel) return closeSelPill();
      if (tool === 'highlight') { highlightRange(sel.r, HCOL[color]); sel.s.removeAllRanges(); return; }
      if (tool !== 'select') return;
      closeSelPill();
      const rr = sel.r.getBoundingClientRect();
      pill = C.h(`<div class="selpill" role="toolbar" aria-label="Selection"><button data-a="ask"><bili-blob size="18" mood="happy"></bili-blob>Ask Bili</button><i class="sep"></i><button data-a="hl"><i data-lucide="highlighter"></i>Highlight</button><button data-a="card"><i data-lucide="layers"></i>Card</button></div>`);
      document.body.append(pill); C.icons();
      const w = pill.offsetWidth;
      pill.style.left = Math.max(8, Math.min(innerWidth - w - 8, rr.left + rr.width / 2 - w / 2)) + 'px';
      pill.style.top = Math.max(8, rr.top - 46) + 'px';
      const text = sel.text, range = sel.r.cloneRange();
      pill.addEventListener('click', (ev) => {
        const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return;
        if (a === 'ask') { C.setQuote(text); C.openAssistant(); setTimeout(() => $('#ta').focus(), 300); }
        if (a === 'hl') highlightRange(range, HCOL[color]);
        if (a === 'card') toast(`Card made: “${text.slice(0, 48)}${text.length > 48 ? '…' : ''}” · due tomorrow`, 'layers');
        getSelection().removeAllRanges(); closeSelPill();
      });
    }, 10);
  });
  document.addEventListener('pointerdown', (e) => { if (pill && !pill.contains(e.target)) closeSelPill(); });
  $$('.view').forEach((v) => v.addEventListener('scroll', closeSelPill, { passive: true }));

  /* the tray */
  const ind = $('#tInd');
  const moveInd = () => { const b = $(`.tool[data-tool="${tool}"]`); if (b && b.offsetParent) ind.style.transform = `translateX(${b.offsetLeft - 5}px)`; };
  const setTool = (t) => {
    if (!$(`.tool[data-tool="${t}"]`)) return;
    tool = t;
    $$('.tool[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
    moveInd();
    [...document.body.classList].filter((c) => c.startsWith('t-')).forEach((c) => document.body.classList.remove(c));
    document.body.classList.add('t-' + t);
    document.body.classList.toggle('drawing', DRAW.includes(t));
    if (t !== 'select') closeSelPill();
  };
  const setColor = (c) => {
    color = c;
    $$('.col').forEach((b) => { b.classList.toggle('on', b.dataset.color === c); b.setAttribute('aria-checked', String(b.dataset.color === c)); });
  };
  $('#tray').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tool]');
    if (b) { const was = tool; setTool(b.dataset.tool); if (tool === 'highlight' && was !== 'highlight') toast('Select any sentence to highlight it', 'highlighter'); return; }
    const c = e.target.closest('[data-color]'); if (c) return setColor(c.dataset.color);
    if (e.target.closest('#undo')) undo();
    if (e.target.closest('#redo')) redo();
  });
  addEventListener('resize', moveInd);

  /* the pen demo the landing page plays: ring a phrase, write "Quiz 2!" in the margin, point at it */
  const DEMO = 'demo';
  const drawPath = (svg, d, col, cls = 'pen', dur = 0.8) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('class', cls + ' draw'); p.setAttribute('d', d); p.style.stroke = col;
    svg.append(p);
    const len = p.getTotalLength();
    p.style.setProperty('--len', len); p.style.setProperty('--dur', (reduce ? 0.01 : dur) + 's');
    return p;
  };
  const demo = async () => {
    if (C.active !== 'lesson:forget') C.open('lesson:forget');
    const v = C.views['lesson:forget'], o = inkFor(v);
    $$('g.' + DEMO, o.svg).forEach((g) => g.remove());
    const kw = $('#keyWord');
    C.reveal(kw, Math.round(v.el.clientHeight * 0.42));
    setTool('pen'); setColor('rose');
    await sleep(750);
    const hr = o.host.getBoundingClientRect(), r = kw.getBoundingClientRect();
    const cx = r.left - hr.left + r.width / 2, cy = r.top - hr.top + r.height / 2, rx = r.width / 2 + 12, ry = r.height / 2 + 7;
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'grp ' + DEMO); o.svg.append(g);
    const pts = [];
    for (let a = -2.7; a <= -2.7 + Math.PI * 2 + 0.5; a += 0.22) pts.push([cx + Math.cos(a) * rx * (1 + 0.04 * Math.sin(a * 3)), cy + Math.sin(a) * ry * (1 + 0.05 * Math.cos(a * 2)) + (a > 2.6 ? -3 : 0)]);
    drawPath(g, C.smooth(pts), COL.rose, 'pen', 0.9);
    await sleep(1000);
    /* write the note in the whitespace after the paragraph's last line */
    const W = o.host.clientWidth, rg = document.createRange(); rg.selectNodeContents(kw.closest('p'));
    const lines = [...rg.getClientRects()], last = lines[lines.length - 1];
    let tx = last.right - hr.left + 30, ty = last.bottom - hr.top - 4;
    if (tx + 110 > W) { tx = W - 130; ty += 34; }
    const tg = document.createElementNS(NS, 'g');
    const clip = document.createElementNS(NS, 'clipPath'), cid = 'clip' + Date.now(); clip.id = cid;
    const cr = document.createElementNS(NS, 'rect'); cr.setAttribute('x', tx - 4); cr.setAttribute('y', ty - 34); cr.setAttribute('height', 48); cr.setAttribute('width', 0);
    clip.append(cr); tg.append(clip);
    const tx1 = document.createElementNS(NS, 'text'); tx1.setAttribute('x', tx); tx1.setAttribute('y', ty); tx1.setAttribute('font-size', 34); tx1.setAttribute('fill', COL.rose); tx1.setAttribute('transform', `rotate(-5 ${tx} ${ty})`); tx1.setAttribute('clip-path', `url(#${cid})`); tx1.textContent = 'Quiz 2!';
    tg.append(tx1); g.append(tg);
    const tw = tx1.getBBox().width + 12, t0 = performance.now(), dur = reduce ? 1 : 700;
    await new Promise((res) => { const f = (t) => { const k = Math.min(1, (t - t0) / dur); cr.setAttribute('width', tw * k); if (k < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    drawPath(g, `M${tx - 2},${ty + 8} Q${tx + 30},${ty + 12} ${tx + tw - 14},${ty + 4}`, COL.rose, 'pen', 0.35);
    await sleep(380);
    drawPath(g, arrowD(tx + 12, ty - 30, cx + rx * 0.55, cy + ry * 1.05), COL.rose, 'arrow', 0.6);
    record(() => g.remove(), () => o.svg.append(g));
  };

  C.record = record; C.undo = undo; C.redo = redo; C.setTool = setTool; C.setColor = setColor; C.closeSelPill = closeSelPill;
  C.inkFor = inkFor; C.demo = (name) => name === 'pen' && demo();
  C.tool = () => tool;
  Object.values(C.views).forEach(inkFor);
  setTool('select');
  requestAnimationFrame(moveInd);
})();

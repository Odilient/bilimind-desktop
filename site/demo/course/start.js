/* Start: sidebar, keyboard, the page that embeds us, first view. */
(() => {
  const { $, person, params, EMBED } = C;
  $('#meAv').innerHTML = person('madina', 30);
  $('#liveFaces').innerHTML = person('aziz', 24) + person('sara', 24);
  C.renderSb();
  C.onResize = () => { C.active === 'home' && C.drawRoad(); };
  addEventListener('resize', () => { C.onResize(); C.closePop(); });
  document.fonts?.ready.then(() => C.onResize());

  /* keyboard */
  const typing = (e) => e.target.closest('input, textarea, [contenteditable="true"]');
  addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (mod && k === 'k') { e.preventDefault(); return $('#pal').hidden ? C.openPalette() : C.closePalette(); }
    if (mod && k === 'j') { e.preventDefault(); return C.isAsOpen() ? C.closeAssistant() : C.openAssistant(); }
    if (e.key === 'Escape') { C.closePop(); C.closeSelPill(); if (!$('#pal').hidden) C.closePalette(); else if (C.tool() !== 'select') C.setTool('select'); return; }
    if (typing(e)) return;
    if (mod && k === 'z') { e.preventDefault(); return e.shiftKey ? C.redo() : C.undo(); }
    if (mod || e.altKey) return;
    if (e.key === '[') return C.toggleSb();
    const t = { v: 'select', p: 'pen', m: 'marker', h: 'highlight', n: 'note', t: 'text', a: 'arrow', e: 'eraser' }[k];
    if (t && C.view?.ink) C.setTool(t);
  });

  /* the landing page drives us with postMessage */
  const VIEW = { lesson: 'lesson:forget', roadmap: 'home', home: 'home', board: 'board:curve', notes: 'notes:l6' };
  addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d !== 'object' || !d.d2) return;
    if (d.d2 === 'view' && VIEW[d.view]) { if (VIEW[d.view] === 'home') C.openHome('roadmap'); else C.open(VIEW[d.view]); }
    if (d.d2 === 'assistant') (d.open ? C.openAssistant : C.closeAssistant)();
    if (d.d2 === 'ask' && d.text) C.typeAndSend(String(d.text));
    if (d.d2 === 'tool' && d.tool) C.setTool(String(d.tool));
    if (d.d2 === 'demo' && d.name) C.demo(String(d.name));
    if (d.d2 === 'theme' && ['light', 'dark', 'system'].includes(d.value)) C.setTheme(d.value);
  });

  C.activate(VIEW[params.get('view')] || 'lesson:forget');
  C.icons();
  if (parent !== window) parent.postMessage({ d2: 'ready' }, '*');
})();

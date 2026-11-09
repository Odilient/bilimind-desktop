/* Notes pages: editable, with checklists and attached files. */
(() => {
  const { D, $, h, person, logo, icons } = C;
  Object.entries(D.NOTES).forEach(([id, n], i) => {
    const el = h(`<section class="nview"><div class="docwrap"><article class="ndoc">
      <div class="nk">${person('madina', 18)}Madina · ${n.meta}</div>
      <h1 contenteditable="true" spellcheck="false">${n.title}</h1>
      <div class="nb" contenteditable="true" spellcheck="false">${n.html}</div>
    </article></div></section>`);
    el.querySelectorAll('[data-who]').forEach((w) => w.insertAdjacentHTML('afterbegin', person(w.dataset.who, 18)));
    el.querySelectorAll('[data-logo-k]').forEach((w) => (w.innerHTML = logo(w.dataset.logoK, w.classList.contains('ft') ? 20 : 18)));
    el.addEventListener('click', (e) => {
      const b = e.target.closest('.todo .box');
      if (b) { const t = b.closest('.todo'); t.classList.toggle('done'); if (t.classList.contains('done')) C.toast('Ticked off', 'check'); }
    });
    C.addView({ id: 'notes:' + id, kind: 'notes', title: n.title, icon: 'file-text', el, inkHost: $('.docwrap', el), tab: i === 0 });
  });
  icons();
})();

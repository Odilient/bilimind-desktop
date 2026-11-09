/* Bili, docked on the right: answers from this lesson and Lecture 6, with the sources it used. */
(() => {
  const { D, $, $$, h, esc, icons, toast, sleep, reduce, phoneMQ } = C;
  const app = $('#app'), thread = $('#thread'), ta = $('#ta'), comp = $('#comp'), sendB = $('#send'), blob = $('#asBlob');
  let mode = C.params.get('assistant') === '0' ? 'closed' : 'dock', busy = false, quote = '', sheet = false;

  const srcRow = (k, i) => `<button class="src-row" data-src="${k}"><span class="sn">${i + 1}</span><i data-lucide="${D.SRC[k][1]}"></i><span>${esc(D.SRC[k][0])}</span><i data-lucide="chevron-right" class="chev"></i></button>`;
  const actRow = (k) => { const [i, t] = D.ACTS[k]; return `<button class="act" data-act="${k}"><span class="ico" style="--c:var(--wash-2);--t:var(--ink-2)"><i data-lucide="${i}"></i></span><span>${t}</span><span class="r"><i data-lucide="arrow-right"></i></span></button>`; };
  const userHTML = (m) => `<div class="m-user">${m.q ? `<div class="m-quote"><i data-lucide="quote"></i><span>${esc(m.q)}</span></div>` : ''}<div class="bub">${esc(m.u)}</div></div>`;
  const botHTML = (m) => `<div class="m-bot"><bili-blob size="22" mood="idle"></bili-blob><div><div class="body">${m.b}</div>${m.src?.length ? `<div class="srcs">${m.src.map(srcRow).join('')}</div>` : ''}${m.acts?.length ? `<div class="acts">${m.acts.map(actRow).join('')}</div>` : ''}${m.follow?.length ? `<div class="follow">${m.follow.map((f) => `<button class="fchip" data-follow="${esc(f)}">${esc(f)}</button>`).join('')}</div>` : ''}</div></div>`;
  const scrollDown = (smooth = true) => thread.scrollTo({ top: thread.scrollHeight, behavior: smooth && !reduce ? 'smooth' : 'auto' });

  const loadConv = () => {
    thread.innerHTML = '<div class="m-day">Saturday</div>' + D.CONV.msgs.map((m) => (m.u ? userHTML(m) : botHTML(m))).join('');
    $('#asSub').textContent = D.CONV.title;
    icons(); scrollDown(false);
  };
  const empty = () => {
    thread.innerHTML = `<div class="empty"><bili-blob size="54" mood="happy" follow></bili-blob><b>Ask about Why we forget</b><span>I read this lesson, Lecture 6 and the Seminar 5 reading, and say where each answer comes from.</span><div class="follow">${['Make me a 3-question check', 'When should I review before Thursday?', 'Explain interference simpler'].map((f) => `<button class="fchip" data-follow="${f}">${f}</button>`).join('')}</div></div>`;
    $('#asSub').textContent = 'New chat';
  };

  /* stream a bot answer in, word by word */
  const stream = async (node) => {
    const body = $('.body', node), rest = [...node.querySelectorAll('.srcs, .acts, .follow')];
    rest.forEach((r) => (r.style.opacity = 0));
    const words = [];
    const walk = (n) => [...n.childNodes].forEach((c) => {
      if (c.nodeType === 3) {
        const f = document.createDocumentFragment();
        c.textContent.split(/(\s+)/).forEach((p) => { if (!p) return; if (/^\s+$/.test(p)) f.append(p); else { const s = document.createElement('span'); s.className = 'w'; s.textContent = p; f.append(s); words.push(s); } });
        c.replaceWith(f);
      } else if (c.nodeType === 1 && c.tagName === 'SUP') { c.classList.add('w'); words.push(c); } else if (c.nodeType === 1) walk(c);
    });
    walk(body);
    for (let i = 0; i < words.length; i++) { words[i].classList.add('in'); if (!reduce && i % 2) await sleep(16); if (i % 12 === 0) scrollDown(false); }
    for (const r of rest) { r.style.transition = 'opacity .4s'; r.style.opacity = 1; await sleep(120); }
    scrollDown();
  };

  const send = async (text) => {
    text = (text || '').trim();
    if (busy || (!text && !quote)) return;
    if (!thread.querySelector('.m-user, .m-bot')) thread.innerHTML = '';
    busy = true;
    thread.insertAdjacentHTML('beforeend', userHTML({ u: text || 'Explain this', q: quote }));
    ta.value = ''; setQuote(''); taInput();
    icons(); scrollDown();
    const think = h('<div class="m-think"><bili-blob size="22" mood="think"></bili-blob><span>Reading Lecture 6 and this lesson</span><span class="think-dots"><i></i><i></i><i></i></span></div>');
    thread.append(think); scrollDown();
    comp.classList.add('is-thinking'); blob.mood = 'think';
    await sleep(1100);
    const en = window.BILI_TR ? BILI_TR.back(text) : text;
    const a = D.ANSWERS.find((x) => x.k.test(en)) || D.ANSWERS[D.ANSWERS.length - 1];
    think.remove();
    const node = h(botHTML(a));
    thread.append(node); icons();
    comp.classList.remove('is-thinking'); blob.mood = 'happy';
    if ($('#asSub').textContent === (window.BILI_TR ? BILI_TR.t('New chat') : 'New chat')) $('#asSub').textContent = text.length > 44 ? text.slice(0, 42) + '…' : text;
    await stream(node);
    setTimeout(() => (blob.mood = 'idle'), 1400);
    busy = false; taInput();
  };
  const typeAndSend = async (text) => {
    open();
    await sleep(phoneMQ.matches ? 500 : 350);
    if (window.BILI_TR) text = BILI_TR.t(text);
    ta.focus(); ta.value = '';
    for (const ch of text) { ta.value += ch; taInput(); await sleep(16 + Math.random() * 20); }
    await sleep(240);
    send(ta.value);
  };

  /* composer */
  const taInput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; sendB.disabled = busy || (!ta.value.trim() && !quote); };
  const setQuote = (q) => { quote = q.length > 300 ? q.slice(0, 297) + '…' : q; $('#cqText').textContent = quote; $('#cq').classList.toggle('show', !!quote); ta.placeholder = quote ? 'Ask about this sentence…' : 'Ask about this lesson…'; taInput(); };
  ta.addEventListener('input', taInput);
  ta.addEventListener('focus', () => comp.classList.add('is-focus'));
  ta.addEventListener('blur', () => comp.classList.remove('is-focus'));
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(ta.value); } });
  comp.addEventListener('submit', (e) => { e.preventDefault(); send(ta.value); });
  $('#cqX').addEventListener('click', () => setQuote(''));
  $('#mic').addEventListener('click', async () => {
    const m = $('#mic'); if (m.classList.contains('on')) return;
    m.classList.add('on'); comp.classList.add('is-listening'); blob.mood = 'listen'; $('#hint').textContent = 'Listening…';
    await sleep(2400);
    m.classList.remove('on'); comp.classList.remove('is-listening'); $('#hint').textContent = 'Uses a little of this week’s AI';
    const s = 'When should I review this before Thursday?';
    for (const ch of s) { ta.value += ch; taInput(); await sleep(14); }
    blob.mood = 'idle'; ta.focus();
  });

  /* thread clicks */
  thread.addEventListener('click', (e) => {
    const f = e.target.closest('[data-follow]'); if (f) return send(f.dataset.follow);
    const s = e.target.closest('[data-src]');
    if (s) { const src = D.SRC[s.dataset.src]; if (src[2]) { C.gotoSection(src[2]); if (phoneMQ.matches) close(); } else toast(`${src[0]} opens beside the lesson`, src[1]); return; }
    const a = e.target.closest('[data-act]');
    if (a) {
      const [i, , done] = D.ACTS[a.dataset.act];
      a.classList.add('busy'); a.querySelector('.r').innerHTML = '<span class="spin"></span>';
      setTimeout(() => { a.classList.remove('busy'); a.classList.add('done'); a.querySelector('.ico').innerHTML = '<i data-lucide="check"></i>'; a.querySelector('span:nth-child(2)').textContent = done; a.querySelector('.r').innerHTML = ''; icons(); toast(done, i); }, reduce ? 0 : 900);
    }
  });
  $('.as-scope').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; b.classList.toggle('on'); if (!$$('.as-scope button.on').length) b.classList.add('on'); });
  $('#asNew').addEventListener('click', () => { if (busy) return; empty(); icons(); setTimeout(() => ta.focus(), 50); });
  $('#asHist').addEventListener('click', (e) => {
    const el = h(`<div class="pop" style="width:270px;padding:6px">${[['Proactive or retroactive interference?', 'Saturday · this lesson', 'cur'], ['Does the forgetting curve still hold?', 'Friday · Lecture 6'], ['Plan for the final', 'Thursday · the whole course'], ['Passato prossimo or imperfetto?', 'Wednesday · Italian to B1']].map((c) => `<button class="ib" style="width:100%;text-align:left" data-h="${c[2] || ''}"><span><b>${c[0]}</b><span>${c[1]}</span></span></button>`).join('')}</div>`);
    if (!C.openPop(el, e.currentTarget, 'below', 'end')) return;
    el.addEventListener('click', (ev) => { const b = ev.target.closest('[data-h]'); if (!b) return; C.closePop(); if (b.dataset.h) loadConv(); else toast('That chat opens here, with its sources', 'history'); });
  });
  C.flashThread = () => { const u = $('.m-user', thread); if (!u) return; u.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.03)' }, { transform: 'scale(1)' }], { duration: 500, easing: 'ease-out' }); };

  /* dock, float, close */
  const sync = () => {
    const phone = phoneMQ.matches;
    app.classList.toggle('as-off', !phone && mode === 'closed');
    app.classList.toggle('as-float', !phone && mode === 'float');
    app.classList.toggle('as-open', phone && sheet);
    $('#asToggle').classList.toggle('on', phone ? sheet : mode !== 'closed');
    $('#asFloat').dataset.tip = mode === 'float' ? 'Dock' : 'Float';
    $('#asFloat').innerHTML = `<i data-lucide="${mode === 'float' ? 'panel-right' : 'picture-in-picture-2'}"></i>`;
    if (mode !== 'float') { const a = $('#as'); a.style.left = a.style.top = a.style.right = a.style.bottom = ''; }
    icons(); C.syncScrim();
    setTimeout(() => C.onResize && C.onResize(), 520);
  };
  const open = () => { if (phoneMQ.matches) sheet = true; else if (mode === 'closed') mode = 'dock'; sync(); };
  const close = () => { if (phoneMQ.matches) sheet = false; else mode = 'closed'; sync(); };
  $('#asClose').addEventListener('click', close);
  $('#asFloat').addEventListener('click', () => { mode = mode === 'float' ? 'dock' : 'float'; sync(); });
  $('#asToggle').addEventListener('click', () => ((phoneMQ.matches ? sheet : mode !== 'closed') ? close() : open()));
  $('#askFab').addEventListener('click', () => { open(); setTimeout(() => ta.focus(), 400); });
  $('#asHead').addEventListener('pointerdown', (e) => {
    if (mode !== 'float' || e.target.closest('button')) return;
    const a = $('#as'), r = a.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    const mv = (ev) => { a.style.right = a.style.bottom = 'auto'; a.style.left = Math.max(8, Math.min(innerWidth - r.width - 8, ev.clientX - sx)) + 'px'; a.style.top = Math.max(8, Math.min(innerHeight - 60, ev.clientY - sy)) + 'px'; };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  });
  phoneMQ.addEventListener('change', sync);

  Object.assign(C, { openAssistant: open, closeAssistant: close, typeAndSend, send, setQuote, syncAsst: sync, isAsOpen: () => (phoneMQ.matches ? sheet : mode !== 'closed') });
  loadConv();
  sync();
})();

(() => {
  'use strict';
  const sec = document.getElementById('formats');
  if (!sec) return;
  const $ = (s) => sec.querySelector(s);
  const $$ = (s) => [...sec.querySelectorAll(s)];
  const STILL = document.documentElement.classList.contains('still');
  const M = window.Matter;

  /* The 11 archetypes (packages/core/src/archetypes.ts): learner tag, the
     MANDATORY formats our code enforces, and the question kinds it leans on. */
  const ARCH = [
    { label: 'A skill you do', icon: 'i-steps', types: ['walkthrough', 'checklist', 'quiz'],
      note: 'A procedure gets numbered steps and a checklist, never a wall of prose. If a draft comes back without them, the check fails and the Writer repairs it.',
      blocks: [['Walkthrough', 'Numbered steps, one at a time: a heap insert, a milk tea.'], ['Checklist', 'Keep it open while your hands are busy.'], ['Ordering questions', 'Put the steps back in the right order.']] },
    { label: 'An idea to get', icon: 'i-bulb', types: ['explainer', 'diagram', 'analogy', 'quiz'],
      note: 'An idea gets an explainer, a diagram and an analogy, then questions that ask why, not what.',
      blocks: [['Explainer', 'Plain words from your slides, with the slide chip.'], ['Diagram', 'The shape of the idea, drawn.'], ['Analogy', 'Something you know, and where it stops working.'], ['Short answers', 'Explain it back in a sentence.']] },
    { label: 'Stuff to memorise', icon: 'i-cards', types: ['flashcards', 'reference_table', 'quiz'],
      note: 'Facts fade on a schedule, so they come back on one: every card goes into the review schedule, your calendar and Anki.',
      blocks: [['Flashcards', 'Made for you, exported to Anki.'], ['Reference table', 'Big-O, menu codes: the part you look up.'], ['Cloze questions', 'Fill the gap; typos and casing forgiven.']] },
    { label: 'Two things you mix up', icon: 'i-scales', types: ['comparison', 'example', 'quiz'],
      note: 'Array or linked list? Successful or unsuccessful search? Side by side, on the axes that actually separate them.',
      blocks: [['Comparison', 'A table on the differences that matter.'], ['Examples', 'Real cases; you call which one it is.'], ['Multi-select', 'Every statement that fits, not just one.']] },
    { label: 'A problem to diagnose', icon: 'i-target', types: ['scenario', 'diagram', 'quiz'],
      note: 'Why is my hash table slow? A scenario with symptoms, a diagram of the cause, and a decision to make.',
      blocks: [['Scenario', 'The symptoms, then your call.'], ['Diagram', 'Where it goes wrong, drawn.'], ['Short answers', 'Name the cause in your own words.']] },
    { label: 'Numbers to feel', icon: 'i-sliders', types: ['worked_example', 'playground', 'code', 'quiz'],
      note: 'You understand a formula once you have dragged its inputs around. Code exercises run in the page, and the Coder ran their tests first.',
      blocks: [['Worked example', 'Solved line by line.'], ['Playground', 'Drag the load factor, watch the probes climb.'], ['Code exercise', 'JavaScript, tested in the page, offline.'], ['Numeric answers', 'Your 3,5 counts the same as 3.5.']] },
    { label: 'A picture to read', icon: 'i-image', types: ['diagram', 'walkthrough', 'quiz'],
      note: 'A layout or a structure gets a diagram, then a walk through its parts in order.',
      blocks: [['Diagram', 'The picture, with a text version offline.'], ['Walkthrough', 'Part by part, in reading order.'], ['Questions', 'Point at the part, name it.']] },
    { label: 'How it got here', icon: 'i-time', types: ['timeline', 'explainer', 'quiz'],
      note: 'History gets a timeline with the turning points marked, then the why behind each one.',
      blocks: [['Timeline', 'In order, turning points marked.'], ['Explainer', 'Why each turn happened.'], ['Ordering questions', 'Put the events back in sequence.']] },
    { label: 'Something to make', icon: 'i-rocket', types: ['project', 'checklist'],
      note: 'A capstone gets a project and a rubric written first, so you can mark yourself honestly.',
      blocks: [['Project', 'Make the real thing.'], ['Rubric', 'Self-marked against clear levels.'], ['Checklist', 'Nothing forgotten before you hand it in.']] },
    { label: 'Get it right first time', icon: 'i-warning', types: ['checklist', 'scenario', 'quiz'],
      note: 'Allergens, hygiene, the steps you can’t skip: a checklist, a scenario, and a pass mark before the first shift.',
      blocks: [['Checklist', 'Every step, every time.'], ['Scenario', 'A customer who can’t have dairy.'], ['Multi-select', 'Every right action, none of the wrong ones.']] },
    { label: 'Said out loud', icon: 'i-mic', types: ['speaking', 'dialogue', 'audio', 'quiz'],
      note: 'Phrases are heard, said and recorded. You compare your recording with the native voice and rate yourself; nothing pretends to score your accent.',
      blocks: [['Speaking drill', 'Hear it, record it, compare.'], ['Dialogue', 'A scripted scene, opening line voiced.'], ['Cloze questions', 'The missing word in the phrase.']] },
  ];

  const pit = $('#fmPit'), bubble = $('.fm-bubble');
  const pills = $$('.fm-pill');
  const tabs = $$('.fm-tab');
  const detail = $('.fm-detail');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (coarse) pit.classList.add('is-touch');

  /* A small seeded random, so the heap is the same heap every visit. */
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  /* ── The panel ─────────────────────────────────────────────────────── */
  let arch = 0, touched = false;
  function setArch(i, kick) {
    arch = i;
    tabs.forEach((t) => t.setAttribute('aria-pressed', String(+t.dataset.a === i)));
    const A = ARCH[i];
    const html = `<div class="fm-kind"><span class="ic" aria-hidden="true"><svg><use href="#${A.icon}"/></svg></span><h3>${esc(A.label)}</h3></div>
      <p class="fm-note">${esc(A.note)}</p>
      <ol class="fm-gets">${A.blocks.map((b, k) => `<li><span class="n">${k + 1}</span><b>${esc(b[0])}</b><span>${esc(b[1])}</span></li>`).join('')}</ol>`;
    if (STILL || !window.gsap) { detail.innerHTML = html; }
    else {
      gsap.killTweensOf(detail.children);
      detail.innerHTML = html;
      gsap.from(detail.children, { y: 10, opacity: 0, duration: 0.45, stagger: 0.06, ease: 'power3.out' });
      gsap.from(detail.querySelectorAll('.fm-gets li'), { x: -8, opacity: 0, duration: 0.4, stagger: 0.05, delay: 0.12, ease: 'power3.out' });
    }
    pills.forEach((p) => p.classList.toggle('is-hot', A.types.includes(p.dataset.t)));
    if (kick) hop(A.types);
  }
  tabs.forEach((t) => t.addEventListener('click', () => { touched = true; stopCycle(); setArch(+t.dataset.a, true); }));

  /* ── Physics ───────────────────────────────────────────────────────── */
  if (!M) { setArch(0, false); return; }
  const { Engine, Bodies, Body, Composite, Mouse, MouseConstraint, Sleeping } = M;
  const engine = Engine.create({ enableSleeping: true });
  engine.gravity.y = 1.05;
  const world = engine.world;
  let W = 0, H = 0, walls = [], bodies = [], dropped = false, mouse = null, mc = null;
  const T = 400;

  function measure() { const r = pit.getBoundingClientRect(); W = r.width; H = r.height; }
  function makeWalls() {
    if (walls.length) Composite.remove(world, walls);
    const o = { isStatic: true, friction: 0.6, restitution: 0.1 };
    walls = [
      Bodies.rectangle(W / 2, H + T / 2, W + T * 4, T, o),             // floor
      Bodies.rectangle(-T / 2, H / 2 - 1500, T, H + 3000 + T, o),      // left
      Bodies.rectangle(W + T / 2, H / 2 - 1500, T, H + 3000 + T, o),   // right
    ];
    Composite.add(world, walls);
  }
  function makeBody(el, x, y, a) {
    const w = el.offsetWidth, h = el.offsetHeight;
    const b = Bodies.rectangle(x, y, w, h, {
      chamfer: { radius: h / 2 - 0.5 }, angle: a,
      friction: 0.32, frictionStatic: 0.6, frictionAir: 0.014, restitution: 0.28, density: 0.0016,
      sleepThreshold: 50,
    });
    // Heavier to spin, so a pill rarely ends up reading upside down.
    Body.setInertia(b, b.inertia * 5);
    b.el = el; b.w = w; b.h = h;
    return b;
  }
  function paint(b) {
    b.el.style.transform = `translate(${(b.position.x - b.w / 2).toFixed(1)}px, ${(b.position.y - b.h / 2).toFixed(1)}px) rotate(${b.angle.toFixed(4)}rad)`;
  }
  function bodyOf(el) { return bodies.find((b) => b.el === el); }

  /* Kick a set of formats up into the air — the archetype's answer. */
  function hop(types) {
    if (!dropped || STILL) return;
    bodies.forEach((b) => {
      if (!types.includes(b.el.dataset.t)) return;
      Sleeping.set(b, false);
      Body.setVelocity(b, { x: (rnd() - 0.5) * 6, y: -9 - rnd() * 6 });
      Body.setAngularVelocity(b, (rnd() - 0.5) * 0.12);
    });
    wakeLoop();
  }

  /* The drop: one at a time from above, shuffled, until all 27 have landed. */
  function drop() {
    if (dropped) return;
    dropped = true;
    const order = pills.slice().sort(() => rnd() - 0.5);
    order.forEach((el, k) => {
      setTimeout(() => {
        const w = el.offsetWidth;
        const x = w / 2 + 10 + rnd() * Math.max(1, W - w - 20);
        const b = makeBody(el, x, -60 - rnd() * 80, (rnd() - 0.5) * 0.8);
        Body.setVelocity(b, { x: (rnd() - 0.5) * 3, y: 2 + rnd() * 3 });
        Body.setAngularVelocity(b, (rnd() - 0.5) * 0.08);
        bodies.push(b); Composite.add(world, b); paint(b);
        wakeLoop();
      }, k * 85);
    });
  }

  /* ── The loop: fixed steps, only while on screen. ──────────────────── */
  let raf = 0, active = false, last = 0, acc = 0, idle = 0;
  function frame(now) {
    raf = 0;
    if (!active || document.hidden) return;
    acc += Math.min(64, now - (last || now)); last = now;
    let n = 0;
    while (acc >= 1000 / 60 && n < 4) { right(); Engine.update(engine, 1000 / 60); acc -= 1000 / 60; n++; }
    let moving = 0;
    for (const b of bodies) { if (!b.isSleeping) { paint(b); moving++; } }
    // Keep strays inside after a resize or a wild throw.
    for (const b of bodies) {
      if (b.position.y > H + 200 || b.position.x < -100 || b.position.x > W + 100) {
        Body.setPosition(b, { x: Math.min(W - b.w / 2, Math.max(b.w / 2, b.position.x)), y: -60 });
        Body.setVelocity(b, { x: 0, y: 0 });
      }
    }
    placeBubble();
    idle = moving || (mc && mc.body) || picked ? 0 : idle + 1;
    if (idle < 90) raf = requestAnimationFrame(frame);   // sleep the loop once the heap is still
  }
  /* A gentle righting torque: labels should end up readable. */
  function right() {
    for (const b of bodies) {
      if (b.isSleeping || (mc && mc.body === b)) continue;
      const a = Math.atan2(Math.sin(b.angle), Math.cos(b.angle));
      if (Math.abs(a) > 0.45) Body.setAngularVelocity(b, b.angularVelocity - a * 0.0035);
    }
  }
  function wakeLoop() { idle = 0; if (!raf && active && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  /* ── Picking a format ─────────────────────────────────────────────── */
  let picked = null, pickTimer = null;
  function pick(el) {
    pills.forEach((p) => p.classList.toggle('is-picked', p === el));
    picked = el;
    const icon = el.querySelector('use').getAttribute('href');
    bubble.querySelector('.bt i').innerHTML = `<svg><use href="${icon}"/></svg>`;
    bubble.querySelector('.bt span').textContent = el.textContent.trim();
    bubble.querySelector('p').textContent = el.dataset.b;
    if (window.gsap && !STILL) {
      gsap.killTweensOf(bubble);
      gsap.fromTo(bubble, { autoAlpha: 0, scale: 0.92 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' });
    } else { bubble.style.opacity = 1; bubble.style.visibility = 'visible'; }
    placeBubble();
    clearTimeout(pickTimer);
    pickTimer = setTimeout(unpick, 5200);
    wakeLoop();
  }
  function unpick() {
    if (!picked) return;
    picked.classList.remove('is-picked'); picked = null;
    if (window.gsap && !STILL) gsap.to(bubble, { autoAlpha: 0, scale: 0.94, duration: 0.2 });
    else { bubble.style.opacity = 0; bubble.style.visibility = 'hidden'; }
  }
  function placeBubble() {
    if (!picked) return;
    const b = bodyOf(picked);
    const bw = bubble.offsetWidth, bh = bubble.offsetHeight;
    let cx, cy, h;
    if (b) { cx = b.position.x; cy = b.position.y; h = b.h; }
    else {
      const pr = pit.getBoundingClientRect(), r = picked.getBoundingClientRect();
      cx = r.left - pr.left + r.width / 2; cy = r.top - pr.top + r.height / 2; h = r.height;
    }
    let x = Math.min(W - bw - 10, Math.max(10, cx - bw / 2));
    let y = cy - h / 2 - bh - 14, below = false;
    if (y < 10) { y = cy + h / 2 + 14; below = true; }
    bubble.classList.toggle('below', below);
    bubble.style.setProperty('--ax', Math.min(bw - 18, Math.max(18, cx - x)) + 'px');
    bubble.style.left = x + 'px'; bubble.style.top = y + 'px';
  }

  // A pick is a press that did not travel. The pill under the press counts,
  // even if the grab nudged it out from under the cursor before release.
  let down = null;
  const kick = (el) => {
    const b = bodyOf(el);
    if (b && !STILL) { Sleeping.set(b, false); Body.setVelocity(b, { x: (rnd() - 0.5) * 3, y: -7 }); Body.setAngularVelocity(b, (rnd() - 0.5) * 0.1); wakeLoop(); }
  };
  pit.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now(), el: e.target.closest('.fm-pill') };
    touched = true; stopCycle();
  });
  addEventListener('pointercancel', () => { down = null; });
  addEventListener('pointerup', (e) => {
    if (!down) return;
    const d = down; down = null;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 450) return;
    if (!d.el) { unpick(); return; }
    pick(d.el); kick(d.el);
  });
  // Keyboard: Enter or Space on a focused pill.
  pit.addEventListener('click', (e) => {
    if (e.detail !== 0) return;
    const el = e.target.closest('.fm-pill');
    if (el) { pick(el); kick(el); }
  });
  pills.forEach((p) => p.addEventListener('dragstart', (e) => e.preventDefault()));

  /* ── Auto-cycle the kinds of knowledge while nobody is touching. ───── */
  let cyc = null;
  function cycle() {
    if (touched || STILL || !active) return;
    cyc = setTimeout(() => { if (touched || !active) return; setArch((arch + 1) % ARCH.length, true); cycle(); }, 4200);
  }
  function stopCycle() { clearTimeout(cyc); cyc = null; }

  /* ── Start ─────────────────────────────────────────────────────────── */
  function init() {
    measure();
    // Still: the wrapped heap is the resolved state — no engine at all.
    if (STILL) { setArch(0, false); return; }
    pit.classList.add('is-physics');
    makeWalls();

    if (!coarse) {
      mouse = Mouse.create(pit);
      // Matter listens for the wheel and for touch; both would trap the page.
      pit.removeEventListener('wheel', mouse.mousewheel);
      pit.removeEventListener('touchmove', mouse.mousemove);
      pit.removeEventListener('touchstart', mouse.mousedown);
      pit.removeEventListener('touchend', mouse.mouseup);
      mc = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.18, damping: 0.08, render: { visible: false } } });
      Composite.add(world, mc);
      addEventListener('mouseup', (e) => { if (mouse.button === 0) mouse.mouseup(e); });
      pit.addEventListener('mousemove', () => { if (mc.body) wakeLoop(); });
      pit.addEventListener('mousedown', () => wakeLoop());
    }
    setArch(0, false);

    ScrollTrigger.create({
      trigger: pit, start: 'top 78%', once: true,
      onEnter: () => { drop(); },
    });
    ScrollTrigger.create({
      trigger: sec, start: 'top bottom', end: 'bottom top',
      onToggle: (self) => {
        active = self.isActive;
        if (active) { wakeLoop(); stopCycle(); cycle(); } else { stopCycle(); }
      },
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) wakeLoop(); });

    // Walls follow the pit; the pills are re-measured if the breakpoint changed their size.
    let lastW = W, lastH = H, lastPH = pills[0].offsetHeight;
    new ResizeObserver(() => {
      measure();
      if (Math.abs(W - lastW) < 1 && Math.abs(H - lastH) < 1 && pills[0].offsetHeight === lastPH) return;
      lastW = W; lastH = H;
      makeWalls();
      if (pills[0].offsetHeight !== lastPH) {
        lastPH = pills[0].offsetHeight;
        bodies = bodies.map((b) => {
          Composite.remove(world, b);
          const nb = makeBody(b.el, Math.min(W - 40, b.position.x), b.position.y, b.angle);
          Composite.add(world, nb); return nb;
        });
      }
      bodies.forEach((b) => {
        Sleeping.set(b, false);
        if (b.position.x > W - b.w / 2) Body.setPosition(b, { x: W - b.w / 2 - 2, y: Math.min(b.position.y, H - b.h) });
      });
      wakeLoop();
    }).observe(pit);
  }
  /* Pills measured before the display font lands are the wrong width:
     rebuild any body whose pill has changed size since. */
  function remeasure() {
    if (!bodies.length) return;
    bodies = bodies.map((b) => {
      if (Math.abs(b.el.offsetWidth - b.w) < 1.5 && Math.abs(b.el.offsetHeight - b.h) < 1.5) return b;
      Composite.remove(world, b);
      const nb = makeBody(b.el, Math.min(W - 40, Math.max(40, b.position.x)), b.position.y, b.angle);
      Composite.add(world, nb); return nb;
    });
    wakeLoop();
  }
  requestAnimationFrame(init);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(remeasure));
})();

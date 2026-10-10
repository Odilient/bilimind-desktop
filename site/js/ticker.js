(() => {
  const sec = document.getElementById('ticker');
  if (!sec) return;
  const STILL = document.documentElement.classList.contains('still');

  // What people type into WorkBuddy, and what comes back.
  const ROW1 = [
    ['DS final on Wednesday', 'c-lime', 'i-code'],
    ['Boba shop, day one', 'c-cob', 'i-list'],
    ['Bahasa Melayu survival', 'c-ink', 'i-mic'],
    ['Organic chem midterm', 'c-white', 'i-flow'],
    ['Food hygiene for new crew', 'c-lime', 'i-warning'],
  ];
  const ROW2 = [
    ['Checked against your slides', 'c-ink', 'i-check'],
    ['Weighted by last year’s paper', 'c-lime', 'i-target'],
    ['Code that ran first', 'c-cob', 'i-code'],
    ['Reviews in your calendar', 'c-white', 'i-cal'],
    ['Works offline', 'c-lime', 'i-folder'],
  ];

  const setHTML = (items, row2) => items.map(([t, c, ic], i) =>
    `<span class="tk-chip ${c}"><svg><use href="#${ic}"/></svg></span>` +
    `<span class="tk-item${row2 && i % 2 ? ' fill' : ''}">${t}</span>`).join('');

  const rows = [...sec.querySelectorAll('.tk-row')].map((row, r) => {
    const track = row.querySelector('.tk-track');
    const html = setHTML(r ? ROW2 : ROW1, r === 1);
    // Enough copies to cover the widest screen twice over; one copy is the wrap length.
    track.innerHTML = `<span class="tk-set">${html}</span>`.repeat(3);
    return { track, dir: r ? 1 : -1, x: 0, w: 0 };
  });

  const measure = () => rows.forEach((o) => {
    o.w = o.track.firstElementChild.getBoundingClientRect().width;
    // Row two starts half a phrase in, so the chips never line up vertically.
    if (!o.x) o.x = o.dir > 0 ? -o.w * 0.37 : 0;
  });
  measure();
  addEventListener('resize', measure);
  if (document.fonts) { document.fonts.ready.then(measure); document.fonts.addEventListener('loadingdone', measure); }

  const place = () => rows.forEach((o) => {
    if (!o.w) return;
    // Wrap into (-w, 0]: the second copy takes over seamlessly.
    o.x = ((o.x % o.w) - o.w) % o.w;
    o.track.style.transform = `translate3d(${o.x.toFixed(2)}px,0,0) skewX(${skew.toFixed(2)}deg)`;
  });

  let skew = 0;
  if (STILL) { place(); return; }

  // Speed in px/s at rest; scrolling multiplies it and picks the direction.
  const BASE = innerWidth < 700 ? 38 : 62;
  let boost = 0, turn = 1, visible = false;
  const st = ScrollTrigger.create({
    trigger: sec, start: 'top bottom', end: 'bottom top',
    onToggle: (self) => { visible = self.isActive; },
    onUpdate: (self) => {
      const v = self.getVelocity();
      if (Math.abs(v) > 30) turn = v < 0 ? -1 : 1;
      boost = Math.max(boost, Math.min(9, Math.abs(v) / 260));
    },
  });
  visible = st.isActive;

  gsap.ticker.add((time, dt) => {
    if (!visible || document.hidden) return;
    const s = Math.min(dt, 50) / 1000;
    boost *= Math.pow(0.04, s);                     // settle back in ~1s
    const targetSkew = -Math.min(7, boost * 1.4) * turn;
    skew += (targetSkew - skew) * Math.min(1, s * 8);
    rows.forEach((o) => { o.x += o.dir * turn * BASE * (1 + boost) * s; });
    place();
  });
  place();
})();

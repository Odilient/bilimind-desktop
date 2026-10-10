(() => {
  const sec = document.getElementById('numbers');
  if (!sec) return;
  const STILL = document.documentElement.classList.contains('still');
  const LAPS = 2;                       // full turns each wheel makes before it lands
  const ROWS = 10 * (LAPS + 1);

  // Build one wheel per digit: 0–9, LAPS+1 times over.
  const cells = [...sec.querySelectorAll('.nm-cell')];
  const wheels = [];
  cells.forEach((cell, i) => {
    const num = cell.querySelector('.nm-num');
    const raw = String(cell.dataset.n || '').trim();
    // Not measured yet ({{PLACEHOLDER}}) or not a whole number (0.4, 4:52): print it as is.
    if (!/^\d{1,4}$/.test(raw)) {
      num.textContent = raw.startsWith('{{') ? '—' : raw;
      num.classList.add('nm-raw');
      if (raw.startsWith('{{')) { cell.classList.add('is-tbd'); num.title = raw; }
      return;
    }
    const digits = raw.split('').map(Number);
    num.innerHTML = digits.map(() => {
      let s = '';
      for (let r = 0; r < ROWS; r++) s += `<span>${r % 10}</span>`;
      return `<span class="nm-d"><span class="nm-strip">${s}</span></span>`;
    }).join('');
    [...num.querySelectorAll('.nm-strip')].forEach((strip, k) => {
      // Later digits spin one lap further, so a number settles left to right.
      const lap = Math.min(LAPS, k + 1);
      wheels.push({ strip, cell: i, k, row: lap * 10 + digits[k] });
    });
  });
  const at = (row) => -(row / ROWS) * 100;

  if (STILL || !window.gsap) { wheels.forEach((w) => { w.strip.style.transform = `translateY(${at(w.row)}%)`; }); return; }

  wheels.forEach((w) => gsap.set(w.strip, { yPercent: 0 }));
  const roll = () => {
    const tl = gsap.timeline();
    wheels.forEach((w) => {
      tl.fromTo(w.strip, { yPercent: 0 }, { yPercent: at(w.row), duration: 1.5 + w.k * 0.35, ease: 'power4.out' }, w.cell * 0.11);
    });
    tl.fromTo(sec.querySelectorAll('.nm-ic'), { scale: 0, rotate: -90 }, { scale: 1, rotate: 0, duration: 0.6, stagger: 0.08, ease: 'back.out(2.2)' }, 0.2)
      .fromTo(sec.querySelectorAll('.nm-label, .nm-note'), { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: 'power3.out' }, 0.3)
      .fromTo(sec.querySelector('.nm-sheen i'), { xPercent: 0, opacity: 0 }, { xPercent: 900, duration: 1.4, ease: 'power2.inOut', keyframes: { opacity: [0, 1, 1, 0] } }, 1.4);
    return tl;
  };
  gsap.from(sec.querySelectorAll('.nm-head > *'), {
    y: 26, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out',
    scrollTrigger: { trigger: sec, start: 'top 82%', once: true },
  });
  let tl = null;
  ScrollTrigger.create({
    trigger: sec.querySelector('.nm-grid'), start: 'top 85%',
    onEnter: () => { if (!tl) tl = roll(); },
    // Coming back down from above replays it; scrolling up past it leaves it alone.
    onLeaveBack: () => { if (tl) { tl.kill(); tl = null; } wheels.forEach((w) => gsap.set(w.strip, { yPercent: 0 })); },
  });
})();

/* Bili, the mascot: the design's js/bili.js unchanged but for the guards (server, double define).
   Imported for its side effect by layouts/landing.vue; on the server it does nothing. */
/* Bili — the BiliMind mascot (Uzbek: knowledge). A soft highlighter-yellow ghost with secondary motion:
   it breathes, leans after the pointer, blinks, squashes when poked, and can be dragged.
   <bili-blob size="64" mood="idle|think|happy|sleep|listen" tone="yellow|sky|rose|leaf|lilac|apricot"
              wear="glasses|bow|beanie|headphones|cap|grad" follow drag></bili-blob>
   el.jump(), el.poke(), el.mood = 'happy' */
(() => {
  if (typeof window === 'undefined') return; /* the server renders <bili-blob> as an empty tag */
  const BASE = [
    [0, -44], [26, -38], [40, -16], [43, 10], [40, 32], [50, 43], [24, 44.5],
    [0, 45], [-24, 43.5], [-40, 32], [-43, 8], [-40, -16], [-26, -38],
  ];
  /* the live body: BASE made symmetric, with a rounded corner on each side of the bottom.
     The tail grows out of whichever corner trails the motion (index 5 right, 9 left). */
  const BODY = [
    [0, -44], [26, -38], [40, -16], [43, 10], [40, 32], [36, 41], [24, 44.5],
    [0, 45], [-24, 44.5], [-36, 41], [-40, 32], [-43, 10], [-40, -16], [-26, -38],
  ];
  const TR = 5, TL = 9, TAIL_V = [14, 2]; /* corner → tip, i.e. [36,41] → [50,43] as in the resting mark */
  const MAX_STRETCH = 0.4;
  const TONES = {
    yellow: ['#ffea94', '#ffdb5c', '#ffc93d'], sky: ['#cfe6ff', '#97c8ff', '#62a6f2'], rose: ['#ffd6e2', '#ffadc6', '#f185a8'],
    leaf: ['#d3f2cf', '#9fdfa3', '#64c27a'], lilac: ['#e6defe', '#c4b6ff', '#9d8af4'], apricot: ['#ffdcc2', '#ffbb8c', '#f8975c'],
  };
  // accessories so a person can be their own Bili. Head-top pieces are drawn with the crown at y = -44.
  const INK = '#2a2418';
  const WEAR = {
    glasses: { face: `<g fill="rgb(255 255 255 / .28)" stroke="${INK}" stroke-width="2.6"><circle cx="-11" cy="-7" r="8.6"/><circle cx="11" cy="-7" r="8.6"/></g><path d="M-2.6,-8.5 Q0,-10.5 2.6,-8.5" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>` },
    bow: { top: `<g transform="translate(19 -38) rotate(18)"><path d="M0,0 L-13,-8 Q-16,0 -13,8 Z M0,0 L13,-8 Q16,0 13,8 Z" fill="#e2668f"/><circle r="3.8" fill="#c44a74"/></g>` },
    beanie: { top: `<path d="M-31,-30 C-31,-60 31,-60 31,-30 Z" fill="#4f9a68"/><rect x="-33" y="-35" width="66" height="10" rx="5" fill="#3d7f55"/><circle cx="0" cy="-59" r="6.5" fill="#7cc394"/>` },
    headphones: { top: `<path d="M-37,-12 C-40,-62 40,-62 37,-12" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/><rect x="-45" y="-22" width="11" height="19" rx="5" fill="#6d5bd0"/><rect x="34" y="-22" width="11" height="19" rx="5" fill="#6d5bd0"/>` },
    cap: { top: `<path d="M-29,-31 C-29,-58 29,-58 29,-31 Z" fill="#e07f3e"/><path d="M14,-33 Q44,-37 50,-29 Q42,-25 14,-29 Z" fill="#c2662a"/><circle cx="0" cy="-55" r="2.6" fill="#c2662a"/>` },
    grad: { top: `<path d="M-19,-41 L-19,-33 Q0,-27 19,-33 L19,-41 Z" fill="${INK}"/><path d="M-34,-47 L0,-58 L34,-47 L0,-37 Z" fill="#33302a"/><path d="M0,-47 L23,-44 L25,-31" fill="none" stroke="#ffd447" stroke-width="2.2" stroke-linecap="round"/><circle cx="25" cy="-29" r="2.8" fill="#ffd447"/>` },
  };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ptr = { x: innerWidth / 2, y: innerHeight / 3, t: 0 };
  addEventListener('pointermove', (e) => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = performance.now(); }, { passive: true });

  // closed Catmull-Rom → cubic Bézier
  function pathOf(p) {
    const n = p.length;
    let d = `M${p[0][0].toFixed(2)},${p[0][1].toFixed(2)}`;
    for (let i = 0; i < n; i++) {
      const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
    }
    return d + 'Z';
  }

  const spring = (s, target, k, d, dt) => { s.v += (target - s.x) * k * dt; s.v *= Math.exp(-d * dt); s.x += s.v * dt; };
  let uid = 0;

  class BiliBlob extends HTMLElement {
    static observedAttributes = ['mood', 'size', 'tone', 'wear'];
    constructor() {
      super();
      this.id_ = ++uid;
      this.sq = { x: 0, v: 0 };          // squash (−) / stretch (+)
      this.lean = { x: 0, v: 0 };
      this.lx = { x: 0, v: 0 }; this.ly = { x: 0, v: 0 };   // eye look
      this.dx = { x: 0, v: 0 }; this.dy = { x: 0, v: 0 };   // drag offset, in css px
      this.stx = { x: 0, v: 0 }; this.sty = { x: 0, v: 0 }; // stretch along the motion (jelly)
      this.tail = { x: 1, v: 0 };                           // 1 = tail out, 0 = tucked in (while held)
      this.side = { x: 1, v: 0 }; this.sideTo = 1;          // +1 tail on the right, −1 on the left
      this.blink = 1; this.nextBlink = performance.now() + 1800 + Math.random() * 2500;
      this.jumpT = -1; this.dragging = false; this.visible = true; this.t0 = performance.now() / 1000 + Math.random() * 10;
      this._mood = 'idle';
    }
    get mood() { return this._mood; }
    set mood(m) { this.setAttribute('mood', m); }
    attributeChangedCallback(name, _, v) {
      if (name === 'mood') { this._mood = v || 'idle'; this.root && this.root.host.setAttribute('data-mood', this._mood); }
      if (name === 'size' && this.svg) this.sizeIt();
      if (name === 'tone' && this.svg) this.toneIt();
      if (name === 'wear' && this.svg) this.wearIt();
    }
    wearIt() {
      const w = WEAR[this.getAttribute('wear')] || {};
      this.accTop.innerHTML = w.top || '';
      this.accFace.innerHTML = w.face || '';
    }
    toneIt() {
      const t = TONES[this.getAttribute('tone')] || TONES.yellow;
      this.root.querySelectorAll('stop').forEach((st, i) => st.setAttribute('stop-color', t[i]));
    }
    sizeIt() {
      const s = +(this.getAttribute('size') || 64);
      this.svg.style.width = s + 'px';
      this.svg.style.height = (s * 128) / 120 + 'px';
    }
    connectedCallback() {
      if (this.root) return;
      const g = `bg${this.id_}`;
      this.root = this.attachShadow({ mode: 'open' });
      this.root.innerHTML = `
        <style>
          :host { display: inline-block; line-height: 0; -webkit-tap-highlight-color: transparent; touch-action: none; }
          svg { overflow: visible; cursor: ${this.hasAttribute('drag') ? 'grab' : 'pointer'}; }
          :host([data-dragging]) svg { cursor: grabbing; }
          .cheek { transition: opacity .4s; opacity: 0; }
          :host([data-mood='happy']) .cheek, :host(:hover) .cheek { opacity: .55; }
          .mouth { opacity: 0; transition: opacity .25s; }
          :host([data-mood='happy']) .mouth { opacity: 1; }
          .zz { opacity: 0; transition: opacity .5s; }
          :host([data-mood='sleep']) .zz { opacity: 1; animation: zz 2.6s ease-in-out infinite; }
          @keyframes zz { 0% { transform: translate(0,0); opacity: 0 } 30% { opacity: 1 } 100% { transform: translate(8px,-14px); opacity: 0 } }
        </style>
        <svg viewBox="-60 -64 120 128" aria-hidden="true">
          <defs>
            <linearGradient id="${g}" x1="0" y1="-46" x2="0" y2="46" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#ffea94"/><stop offset=".55" stop-color="#ffdb5c"/><stop offset="1" stop-color="#ffc93d"/>
            </linearGradient>
          </defs>
          <ellipse class="shadow" cx="2" cy="56" rx="32" ry="5" fill="var(--blob-shadow, rgb(80 55 10 / .16))"/>
          <g class="lift">
            <path class="body" fill="url(#${g})"/>
            <ellipse class="sheen" cx="-17" cy="-25" rx="10" ry="5.5" fill="#fff" opacity=".5" transform="rotate(-32 -17 -25)"/>
            <g class="face">
              <ellipse class="cheek" cx="-21" cy="6" rx="5.5" ry="3.2" fill="#f58a77"/>
              <ellipse class="cheek" cx="21" cy="6" rx="5.5" ry="3.2" fill="#f58a77"/>
              <ellipse class="eye l" cx="-11" cy="-7" rx="4.7" ry="6.4" fill="#2a2418"/>
              <ellipse class="eye r" cx="11" cy="-7" rx="4.7" ry="6.4" fill="#2a2418"/>
              <path class="arc l" d="" fill="none" stroke="#2a2418" stroke-width="3.4" stroke-linecap="round"/>
              <path class="arc r" d="" fill="none" stroke="#2a2418" stroke-width="3.4" stroke-linecap="round"/>
              <path class="mouth" d="M-4.5,6 Q0,10.5 4.5,6" fill="none" stroke="#2a2418" stroke-width="2.6" stroke-linecap="round"/>
              <g class="acc-face"></g>
            </g>
            <g class="acc-top"></g>
            <text class="zz" x="30" y="-40" font-size="15" font-weight="700" fill="var(--ink-3, #999)" font-family="Figtree, sans-serif">z</text>
          </g>
        </svg>`;
      this.svg = this.root.querySelector('svg');
      this.body = this.root.querySelector('.body');
      this.lift = this.root.querySelector('.lift');
      this.face = this.root.querySelector('.face');
      this.sheen = this.root.querySelector('.sheen');
      this.shadow = this.root.querySelector('.shadow');
      this.eyes = [...this.root.querySelectorAll('.eye')];
      this.arcs = [...this.root.querySelectorAll('.arc')];
      this.accTop = this.root.querySelector('.acc-top');
      this.accFace = this.root.querySelector('.acc-face');
      this._mood = this.getAttribute('mood') || 'idle';
      this.setAttribute('data-mood', this._mood);
      this.sizeIt();
      this.toneIt();
      this.wearIt();

      this.svg.addEventListener('pointerdown', (e) => this.down(e));
      this.svg.addEventListener('click', () => { if (!this.moved) this.poke(); });
      this.io = new IntersectionObserver(([en]) => { this.visible = en.isIntersecting; if (this.visible) this.loop(); });
      this.io.observe(this);
      this.last = performance.now();
      this.frame(performance.now(), true);
      this.loop();
    }
    disconnectedCallback() { this.io && this.io.disconnect(); cancelAnimationFrame(this.raf); }
    loop() {
      if (reduce) return;
      cancelAnimationFrame(this.raf);
      const tick = (now) => { if (!this.visible || !this.isConnected) return; this.frame(now); this.raf = requestAnimationFrame(tick); };
      this.raf = requestAnimationFrame(tick);
    }
    poke() {
      this.sq.v -= 5.5;
      const was = this._mood;
      if (was === 'sleep' || was === 'idle' || was === 'happy') {
        this.mood = 'happy';
        clearTimeout(this.pokeT);
        this.pokeT = setTimeout(() => { if (this._mood === 'happy') this.mood = was === 'happy' ? 'idle' : was; }, 1400);
      }
      this.jump(0.9);
      this.dispatchEvent(new CustomEvent('poke', { bubbles: true }));
    }
    jump(h = 1) { this.jumpT = performance.now(); this.jumpH = h; this.sq.v -= 2.5; }
    down(e) {
      if (!this.hasAttribute('drag')) return;
      this.dragging = true; this.moved = false;
      this.setAttribute('data-dragging', '');
      const sx = e.clientX - this.dx.x, sy = e.clientY - this.dy.x;
      let px = e.clientX;
      try { this.svg.setPointerCapture(e.pointerId); } catch {}
      const mv = (ev) => {
        if (Math.hypot(ev.clientX - (sx + this.dx.x), ev.clientY - (sy + this.dy.x)) > 3) this.moved = true;
        this.tx = ev.clientX - sx; this.ty = ev.clientY - sy;
        this.lean.v -= (ev.clientX - px) * 0.35; px = ev.clientX; /* the top lags a touch behind the hand */
      };
      const up = () => {
        this.dragging = false; this.removeAttribute('data-dragging');
        this.svg.removeEventListener('pointermove', mv); this.svg.removeEventListener('pointerup', up); this.svg.removeEventListener('pointercancel', up);
        this.tx = 0; this.ty = 0; this.landing = true;
        setTimeout(() => (this.moved = false), 0);
      };
      this.tx = this.dx.x; this.ty = this.dy.x;
      this.svg.addEventListener('pointermove', mv); this.svg.addEventListener('pointerup', up); this.svg.addEventListener('pointercancel', up);
    }
    frame(now, first) {
      const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
      this.last = now;
      const t = now / 1000 + this.t0;
      const mood = this._mood;
      const r = this.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height * 0.42;
      const follow = this.hasAttribute('follow') || this.hasAttribute('drag');
      let ex = 0, ey = 0, lean = 0;
      if (follow) {
        const ddx = ptr.x - cx, ddy = ptr.y - cy;
        const dist = Math.hypot(ddx, ddy) || 1;
        const k = Math.min(1, dist / 260);
        ex = (ddx / dist) * 5.2 * k; ey = (ddy / dist) * 4.2 * k;
        lean = Math.max(-1, Math.min(1, ddx / 700)) * 5;
      }
      if (mood === 'think') { ex = 4.5 + Math.sin(t * 0.9) * 1.2; ey = -4.5; lean = 2.5; }
      if (mood === 'sleep') { ex = 0; ey = 2; lean = 0; }
      if (mood === 'listen') { ex *= 0.4; ey = -1.5; }

      // drag follow
      if (this.hasAttribute('drag')) {
        const wasFar = Math.abs(this.dx.x) + Math.abs(this.dy.x) > 6;
        spring(this.dx, this.tx || 0, this.dragging ? 900 : 170, this.dragging ? 38 : 11, dt);
        spring(this.dy, this.ty || 0, this.dragging ? 900 : 170, this.dragging ? 38 : 11, dt);
        if (this.landing && wasFar && Math.abs(this.dx.x) + Math.abs(this.dy.x) < 6) { this.landing = false; this.sq.v -= 4; }
        if (!this.dragging) lean += -this.dx.v * 0.004;
      }
      spring(this.lean, lean, 60, 9, dt);
      spring(this.lx, ex, 120, 14, dt);
      spring(this.ly, ey, 120, 14, dt);
      spring(this.sq, 0, 190, 9.5, dt);

      // jelly: stretch along the velocity, proportional to speed, capped; a loose spring so it wobbles when it stops
      spring(this.stx, this.dx.v * 0.00017, 240, 11, dt);
      spring(this.sty, this.dy.v * 0.00017, 240, 11, dt);
      // tail: tucked in while held; otherwise it trails the motion, or sits away from where Bili is looking
      spring(this.tail, this.dragging ? 0 : 1, 150, 15, dt);
      if (!this.dragging) {
        const sp = Math.abs(this.dx.v);
        if (sp > 140) this.sideTo = this.dx.v > 0 ? -1 : 1;
        else if (follow && mood !== 'sleep' && Math.abs(ptr.x - cx) > 90) this.sideTo = ptr.x > cx ? -1 : 1;
      }
      spring(this.side, this.sideTo, 34, 8.5, dt);

      // jump arc
      let lift = 0;
      if (this.jumpT > 0) {
        const p = (now - this.jumpT) / 520;
        if (p >= 1) { this.jumpT = -1; this.sq.v -= 3.8; }
        else if (p > 0.1) { const q = (p - 0.1) / 0.9; lift = -26 * (this.jumpH || 1) * 4 * q * (1 - q); }
      }
      const breatheSpeed = mood === 'sleep' ? 1.1 : 2.1;
      const b = Math.sin(t * breatheSpeed);
      const bob = mood === 'sleep' ? 0 : Math.sin(t * 1.35) * 2.2;
      const s = Math.max(-0.35, Math.min(0.35, this.sq.x));
      const syk = 1 + 0.022 * b + s, sxk = 1 - 0.017 * b - s * 0.55;
      const L = this.lean.x;
      let st = Math.hypot(this.stx.x, this.sty.x), ux = 1, uy = 0;
      if (st > 1e-4) { ux = this.stx.x / st; uy = this.sty.x / st; }
      st = Math.min(MAX_STRETCH, st);
      const T = Math.max(0, Math.min(1, this.tail.x)), S = Math.max(-1, Math.min(1, this.side.x));
      const tR = T * Math.max(0, S), tL = T * Math.max(0, -S);
      const held = this.dragging ? 1 : 0;
      const R = 1 - T; /* tail tucked = held in the air: the flat ghost bottom rounds into a jelly drop */
      const pts = BODY.map(([x, y], i) => {
        if (R > 0.001) {
          if (i === TR || i === TL) { x *= 1 - 0.03 * R; y -= 0.5 * R; }
          else if (i === 6 || i === 8) { x *= 1 - 0.1 * R; y -= 0.6 * R; }
          else if (i === 7) { y += 2.4 * R; }
        }
        if (i === TR && tR > 0.001) { x += (TAIL_V[0] + Math.sin(t * 1.8) * 2.6) * tR; y += (TAIL_V[1] + Math.cos(t * 1.8) * 1.3) * tR; }
        if (i === TL && tL > 0.001) { x += (-TAIL_V[0] - Math.sin(t * 1.8) * 2.6) * tL; y += (TAIL_V[1] + Math.cos(t * 1.8) * 1.3) * tL; }
        const up = (45 - y) / 90; // 0 bottom … 1 top
        let nx = x * sxk + L * up * up * 1.4;
        let ny = 45 + (y - 45) * syk;
        if (st > 0.002) { /* stretch around the middle: longer along the motion, a little thinner across it */
          const cy0 = 0.5, a = nx * ux + (ny - cy0) * uy, bb = -nx * uy + (ny - cy0) * ux;
          const a2 = a * (1 + st), b2 = bb * (1 - st * 0.5);
          nx = a2 * ux - b2 * uy; ny = cy0 + a2 * uy + b2 * ux;
        }
        const wob = 0.8 + held * 0.45; /* held, it quivers a little more, like jelly, but stays smooth */
        nx += Math.sin(t * (1.6 + held * 1.2) + i * 1.7) * wob;
        ny += Math.cos(t * (1.3 + held * 1.1) + i * 2.1) * wob * 0.9;
        return [nx, ny];
      });
      this.body.setAttribute('d', pathOf(pts));
      const k = 120 / (+(this.getAttribute('size') || 64)); /* css px → svg units, so a drag tracks the pointer exactly */
      const oy = lift + bob + this.dy.x * k, ox = this.dx.x * k;
      this.lift.setAttribute('transform', `translate(${ox.toFixed(2)} ${oy.toFixed(2)})`);
      const faceY = (45 + (-7 - 45) * syk) + 7;
      this.face.setAttribute('transform', `translate(${(L * 0.55 + this.lx.x * 0.25).toFixed(2)} ${faceY.toFixed(2)})`);
      this.accTop.setAttribute('transform', `translate(${(L * 1.3).toFixed(2)} ${(45 + (-44 - 45) * syk + 44).toFixed(2)})`);
      this.sheen.setAttribute('transform', `translate(${(L * 0.8).toFixed(2)} ${(faceY * 1.2).toFixed(2)}) rotate(-32 -17 -25)`);
      const air = Math.min(1, -(lift + this.dy.x * k) / 40);
      this.shadow.setAttribute('rx', (32 * (1 - 0.35 * Math.max(0, air)) * sxk).toFixed(2));
      this.shadow.setAttribute('cx', (2 + ox).toFixed(2));
      this.shadow.setAttribute('opacity', ((1 - 0.5 * Math.max(0, air)) * T).toFixed(2)); /* fades out while held, back as it lands */

      // blink
      if (now > this.nextBlink && mood !== 'sleep' && mood !== 'happy') {
        this.blinkT = now;
        this.nextBlink = now + 2200 + Math.random() * 3600;
        this.doubleBlink = Math.random() < 0.22;
      }
      let bl = 1;
      if (this.blinkT) {
        const p = (now - this.blinkT) / 150;
        if (p < 1) bl = Math.abs(1 - 2 * p) * 0.92 + 0.08;
        else if (this.doubleBlink && p < 2.3 && p > 1.3) { const q = p - 1.3; bl = Math.abs(1 - 2 * q) * 0.92 + 0.08; }
      }
      const showArc = mood === 'happy' || mood === 'sleep';
      this.eyes.forEach((e, i) => {
        const base = i ? 11 : -11;
        e.setAttribute('cx', (base + this.lx.x).toFixed(2));
        e.setAttribute('cy', (-7 + this.ly.x).toFixed(2));
        const ry = (mood === 'think' ? 5.6 : mood === 'listen' ? 6.9 : 6.4) * bl;
        e.setAttribute('ry', ry.toFixed(2));
        e.style.display = showArc ? 'none' : '';
      });
      this.arcs.forEach((a, i) => {
        const x = (i ? 11 : -11) + this.lx.x * 0.4;
        a.setAttribute('d', showArc ? (mood === 'happy' ? `M${x - 5},-5 Q${x},-12 ${x + 5},-5` : `M${x - 5},-6 Q${x},-3 ${x + 5},-6`) : '');
      });
    }
  }
  if (!customElements.get('bili-blob')) customElements.define('bili-blob', BiliBlob);
  // the resting outline, for static marks (logo, app icon, favicon)
  window.BILIM_PATH = pathOf(BASE);
  window.BILIM_WEAR = WEAR;
})();

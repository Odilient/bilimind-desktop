import * as THREE from 'three';

const wrap = document.getElementById('objWrap');
const canvas = document.getElementById('obj');
const reduce = document.documentElement.classList.contains('still');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: new URLSearchParams(location.search).has('capture') });
} catch (e) {
  document.documentElement.classList.add('no-webgl');
}

if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0.15, 10.4);

  /* ── A studio of our own: softboxes, a cobalt wall, a lime kicker ── */
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
  {
    const g = room.geometry, pos = g.attributes.position, col = [];
    const top = new THREE.Color('#c9d3ff'), mid = new THREE.Color('#0d1866'), bot = new THREE.Color('#020410');
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 20; const c = new THREE.Color();
      if (y > 0) c.copy(mid).lerp(top, Math.pow(y, 0.8)); else c.copy(mid).lerp(bot, Math.pow(-y, 0.6));
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  }
  env.add(room);
  const panel = (w, h, color, k, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); return m;
  };
  panel(14, 3.5, '#ffffff', 5.0, 0, 12, 2);    // top softbox
  panel(2.2, 12, '#ffffff', 4.0, -12, 1, 5);    // left strip
  panel(1.6, 10, '#ffffff', 3.0, 11, 2, 6);     // right strip
  panel(10, 9, '#2340E6', 3.2, 9, -3, -7);      // cobalt wall
  panel(9, 7, '#3a5cff', 2.2, -10, -5, -6);     // cobalt back-left
  panel(16, 4, '#1a2fd0', 2.0, 0, -11, 4);      // cobalt floor bounce
  panel(3.5, 2.5, '#C6F24E', 2.2, 7, -5, 9);    // lime kicker, low front-right
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, 0.035).texture;

  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-3, 6, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb2ff, 1.2); rim.position.set(5, 2, -4); scene.add(rim);

  /* ── The path: a flat chrome ramp spiralling up ──────────────────── */
  const outer = new THREE.Group(), inner = new THREE.Group();
  outer.add(inner); scene.add(outer);
  outer.rotation.set(0.2, 0, -0.1);

  const turns = 1.42, H = 3.7, N = 160;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = -1.2 + t * Math.PI * 2 * turns;
    const r = 1.75 - t * 0.95;
    pts.push(new THREE.Vector3(Math.cos(a) * r, -H / 2 + t * H, Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');

  const W = 0.62, T = 0.16, rr = 0.075;
  const shape = new THREE.Shape();
  {
    const x0 = -W / 2, x1 = W / 2, y0 = -T / 2, y1 = T / 2;
    shape.moveTo(x0 + rr, y0); shape.lineTo(x1 - rr, y0); shape.quadraticCurveTo(x1, y0, x1, y0 + rr);
    shape.lineTo(x1, y1 - rr); shape.quadraticCurveTo(x1, y1, x1 - rr, y1); shape.lineTo(x0 + rr, y1);
    shape.quadraticCurveTo(x0, y1, x0, y1 - rr); shape.lineTo(x0, y0 + rr); shape.quadraticCurveTo(x0, y0, x0 + rr, y0);
  }
  const STEPS = 360;
  const ramp = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { steps: STEPS, extrudePath: curve, bevelEnabled: false, curveSegments: 6 }),
    new THREE.MeshPhysicalMaterial({ color: 0xf2f4ff, metalness: 1, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.25 })
  );
  inner.add(ramp);

  // Frames: we need "up" on the ramp's top face. ExtrudeGeometry maps shape.y → binormal.
  const frames = curve.computeFrenetFrames(STEPS, false);
  const at = (t, lift) => {
    const i = Math.min(STEPS, Math.max(0, Math.round(t * STEPS)));
    const p = curve.getPointAt(Math.min(1, Math.max(0, i / STEPS)));
    const b = frames.binormals[i].clone();
    // binormal may point down on this helix: always lift toward world-up.
    if (b.y < 0) b.negate();
    return p.add(b.multiplyScalar(lift));
  };

  // The lime progress line, inlaid along the top face.
  const linePts = [];
  for (let i = 0; i <= 240; i++) linePts.push(at(i / 240, T / 2 + 0.006));
  const lineCurve = new THREE.CatmullRomCurve3(linePts);
  const TUB = 260, RAD = 8;
  const lineGeo = new THREE.TubeGeometry(lineCurve, TUB, 0.05, RAD, false);
  const lineMat = new THREE.MeshPhysicalMaterial({ color: 0xC6F24E, emissive: 0x8fbf1a, emissiveIntensity: 0.55, roughness: 0.3, clearcoat: 1 });
  const line = new THREE.Mesh(lineGeo, lineMat);
  inner.add(line);
  const setLine = (f) => { lineGeo.setDrawRange(0, Math.floor(Math.max(0, Math.min(1, f)) * TUB) * RAD * 6); };

  // Milestones.
  const MS = [0.12, 0.29, 0.46, 0.63, 0.8];
  const lime = new THREE.MeshPhysicalMaterial({ color: 0xC6F24E, emissive: 0x6f9a10, emissiveIntensity: 0.28, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 });
  const ceramic = new THREE.MeshPhysicalMaterial({ color: 0xf6f7ff, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.9 });
  const sphereGeo = new THREE.SphereGeometry(1, 48, 32);
  const stones = MS.map((t) => {
    const m = new THREE.Mesh(sphereGeo, ceramic);
    m.scale.setScalar(0.15); m.position.copy(at(t, T / 2 + 0.13)); inner.add(m); return m;
  });
  // The finish: a bigger lime sphere with a halo.
  const finish = new THREE.Mesh(sphereGeo, lime.clone());
  finish.scale.setScalar(0.3); finish.position.copy(at(1, T / 2 + 0.27)); inner.add(finish);
  const haloTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(214,255,110,0.9)'); gr.addColorStop(0.35, 'rgba(198,242,78,0.35)'); gr.addColorStop(1, 'rgba(198,242,78,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  })();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
  halo.scale.setScalar(1.5); halo.position.copy(finish.position); inner.add(halo);

  /* ── State ─────────────────────────────────────────────────────── */
  const state = { progress: 0.5, glow: 0.55 };
  const paint = () => {
    setLine(state.progress);
    stones.forEach((s, i) => { s.material = state.progress >= MS[i] - 0.005 ? lime : ceramic; });
    halo.material.opacity = state.glow;
    finish.material.emissiveIntensity = 0.2 + state.glow * 0.6;
  };
  paint();

  /* ── Size ──────────────────────────────────────────────────────── */
  let W0 = 0, H0 = 0;
  const resize = () => {
    const r = wrap.getBoundingClientRect();
    if (!r.width || !r.height) return;
    W0 = r.width; H0 = r.height;
    renderer.setSize(W0, H0, false);
    camera.aspect = W0 / H0;
    // Keep the object a constant share of the shorter side.
    const narrow = W0 < 520;
    camera.position.z = narrow ? 13.6 : 13.2;
    camera.position.y = narrow ? -0.1 : -0.42;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(wrap);
  resize();

  /* ── Pointer parallax ──────────────────────────────────────────── */
  const aim = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  let boost = 0, lastSY = scrollY;
  addEventListener('scroll', () => { boost = Math.min(3, boost + Math.abs(scrollY - lastSY) * 0.01); lastSY = scrollY; if (!paused) kick(); }, { passive: true });
  addEventListener('pointermove', (e) => {
    aim.x = (e.clientX / innerWidth - 0.5);
    aim.y = (e.clientY / innerHeight - 0.5);
  }, { passive: true });

  /* ── Loop ──────────────────────────────────────────────────────── */
  let paused = false, raf = 0, last = performance.now(), t0 = last;
  const frame = (now) => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = (now - t0) / 1000;
    if (!reduce) {
      inner.rotation.y += dt * (0.22 + boost);
      boost *= Math.pow(0.04, dt);
      cur.x += (aim.x - cur.x) * Math.min(1, dt * 3);
      cur.y += (aim.y - cur.y) * Math.min(1, dt * 3);
      outer.rotation.x = 0.2 + cur.y * 0.2;
      outer.rotation.z = -0.1 - cur.x * 0.1;
      outer.position.y = Math.sin(t * 0.9) * 0.08;
      halo.scale.setScalar(1.45 + Math.sin(t * 2.2) * 0.08 * state.glow);
    }
    renderer.render(scene, camera);
    if (!paused && !reduce) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };

  /* ── API for the page ──────────────────────────────────────────── */
  let tw = null;
  window.__obj = {
    build(lessons = 3, writing = false) {
      if (tw) tw.kill();
      const target = 1;
      if (reduce || !window.gsap) { state.progress = target; state.glow = 1; paint(); kick(); return; }
      state.progress = 0; state.glow = 0.3; paint();
      tw = gsap.timeline({ onUpdate: () => { paint(); kick(); } })
        .to(state, { progress: target, duration: writing ? 2.4 : 2.6, ease: 'power2.inOut' })
        .to(state, { glow: 1, duration: 0.6, ease: 'power2.out' }, '-=0.25');
    },
    reset() {
      if (tw) tw.kill();
      if (reduce || !window.gsap) { state.progress = 0.5; state.glow = 0.55; paint(); kick(); return; }
      tw = gsap.to(state, { progress: 0.5, glow: 0.55, duration: 1.0, ease: 'power2.inOut', onUpdate: () => { paint(); kick(); } });
    },
    pause(p) { paused = p; if (!p) kick(); },
  };

  if (reduce) { state.progress = 1; state.glow = 1; paint(); }
  kick();
  // Capture hook for the static fallback (?capture).
  window.__objShot = () => { renderer.render(scene, camera); return canvas.toDataURL('image/png'); };
}

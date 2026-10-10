// Motion helpers (player-design.md §7): no library, Web Animations API + CSS. Every helper is a no-op
// under prefers-reduced-motion.

export const reducedMotion = (): boolean =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Confetti burst from (x, y) in viewport px; removed when done. */
export function confetti(x: number, y: number, n = 80, colours = ['#C6F24E', '#2340E6', '#0B0D10', '#FF5A3C']): void {
  if (reducedMotion() || typeof document === 'undefined') return;
  const box = document.createElement('div');
  box.className = 'confetti';
  box.setAttribute('aria-hidden', 'true');
  document.body.append(box);
  const runs: Promise<unknown>[] = [];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    if (i % 3 === 0) p.className = 'strip';
    p.style.background = colours[i % colours.length]!;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    box.append(p);
    const dx = (Math.random() - 0.5) * 900;
    const up = -(260 + Math.random() * 420);
    const fall = 520 + Math.random() * 380;
    const r = (Math.random() - 0.5) * 1080;
    if (typeof p.animate !== 'function') continue;
    runs.push(p.animate([
      { transform: 'translate(0,0) rotate(0)', opacity: 1 },
      { transform: `translate(${dx * 0.6}px, ${up}px) rotate(${r * 0.5}deg)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${dx}px, ${up + fall}px) rotate(${r}deg)`, opacity: 0 },
    ], { duration: 1600 + Math.random() * 800, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' }).finished.catch(() => undefined));
  }
  void Promise.all(runs).then(() => box.remove());
  setTimeout(() => box.remove(), 4000);
}

/** Hop an element along an arc by (dx, dy) px (the "You are here" token). */
export function hop(el: HTMLElement, dx: number, dy: number, ms = 600): Promise<void> {
  if (reducedMotion() || typeof el.animate !== 'function') return Promise.resolve();
  return el.animate([
    { transform: `translate(${-dx}px, ${-dy}px)` },
    { transform: `translate(${-dx / 2}px, ${-dy / 2 - 28}px)`, offset: 0.5 },
    { transform: 'translate(0, 0)' },
  ], { duration: ms, easing: 'cubic-bezier(.2,.9,.3,1.2)' }).finished.then(() => undefined, () => undefined);
}

/** Flash a part (scroll target) with the anchor ring. */
export function flash(el: Element | null): void {
  if (!el) return;
  el.classList.remove('flash');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1500);
}

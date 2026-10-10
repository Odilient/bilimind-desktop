// Small DOM helpers shared by the reading/visual blocks.
import { onBeforeUnmount, onMounted, type Ref } from 'vue';

/** Tell the shell a task block was passed: a bubbling DOM event (no shared store needed). */
export function emitPassed(el: Element | null | undefined, lesson: string, block: string | undefined, how: string): void {
  if (!el || !block) return;
  el.dispatchEvent(new CustomEvent('bm:passed', { bubbles: true, detail: { lesson, block, how } }));
}

/** Calls `cb` once when the element first enters the viewport (immediately without IntersectionObserver). */
export function useInView(el: Ref<HTMLElement | null>, cb: () => void, threshold = 0.25): void {
  let io: IntersectionObserver | null = null;
  onMounted(() => {
    const node = el.value;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') { cb(); return; }
    io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { io?.disconnect(); io = null; cb(); }
    }, { threshold });
    io.observe(node);
  });
  onBeforeUnmount(() => io?.disconnect());
}

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** localStorage that never throws (private mode, file:// quirks). */
export const store = {
  get(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } },
  set(key: string, value: string | null): void {
    try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* not persisted */ }
  },
};

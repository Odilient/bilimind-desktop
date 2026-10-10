// Shared UI state: the one cite popover, the node brief, and the stage/night/text-size preferences.
import { reactive } from 'vue';
import type { Cite } from '@bilimind/core';
import { prefs, savePrefs } from './progress.ts';

export const citePop = reactive<{ cite: Cite | null; x: number; y: number; dark: boolean; anchor: HTMLElement | null }>({
  cite: null, x: 0, y: 0, dark: false, anchor: null,
});

/** Open the cite popover under an anchor element (CiteChip calls this). */
export function openCite(cite: Cite, anchor: HTMLElement): void {
  if (citePop.anchor === anchor && citePop.cite) { closeCite(); return; }
  const r = anchor.getBoundingClientRect();
  const w = Math.min(320, window.innerWidth - 32);
  citePop.cite = cite;
  citePop.anchor = anchor;
  citePop.x = Math.max(16, Math.min(r.left + window.scrollX, window.scrollX + window.innerWidth - w - 16));
  citePop.y = r.bottom + window.scrollY + 8;
  anchor.setAttribute('aria-expanded', 'true');
}
export function closeCite(): void {
  citePop.anchor?.setAttribute('aria-expanded', 'false');
  citePop.cite = null;
  citePop.anchor = null;
}

// ---------- preferences (stage mode P, text size, night reading) ----------
const TEXT: Record<string, string> = { S: '400 16px/1.68 var(--body)', M: '', L: '400 20.5px/1.66 var(--body)' };

export function applyPrefs(): void {
  const root = document.documentElement;
  if (prefs.density === 'stage') root.dataset.density = 'stage'; else delete root.dataset.density;
  if (prefs.night) root.dataset.theme = 'night'; else delete root.dataset.theme;
  const t = TEXT[prefs.text ?? 'M'];
  if (t) root.style.setProperty('--t-read', t); else root.style.removeProperty('--t-read');
}
export function toggleStage(): void { prefs.density = prefs.density === 'stage' ? '' : 'stage'; applyPrefs(); savePrefs(); }
export function toggleNight(): void { prefs.night = !prefs.night; applyPrefs(); savePrefs(); }
export function setTextSize(s: 'S' | 'M' | 'L'): void { prefs.text = s; applyPrefs(); savePrefs(); }

export const isTyping = (e: KeyboardEvent): boolean => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || !!t.closest('.cm-editor, [contenteditable="true"]'));
};

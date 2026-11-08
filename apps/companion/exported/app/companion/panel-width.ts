/**
 * How wide the learner has dragged a panel, remembered per device
 * (`bm:panel:<name>`). `CompanionShellResizeHandle` moves it; the panel only
 * reads `css`.
 *
 * `css` also caps the panel at a share of the window, so a width chosen on a
 * big monitor can't squeeze the page when the window is narrower. The shares
 * always leave the defaults alone, down to where each panel stops drawing.
 *
 * The course and Notes share `column`, so moving between them never jumps.
 * Nothing here is rendered on a server (`/app` is `ssr: false`).
 */
import { computed, ref, type Ref } from 'vue'

export const PANELS = {
  sidebar: { initial: 252, min: 220, max: 420, vw: 30 },
  column: { initial: 272, min: 220, max: 480, vw: 30 },
  assistant: { initial: 360, min: 320, max: 720, vw: 40 },
}

export type PanelName = keyof typeof PANELS

const widths = {} as Record<PanelName, Ref<number>>

function read(name: PanelName): number {
  const { initial, min, max } = PANELS[name]
  if (!import.meta.client) return initial
  try {
    const stored = Number(localStorage.getItem(`bm:panel:${name}`))
    return stored ? Math.min(max, Math.max(min, stored)) : initial
  } catch {
    return initial
  }
}

export function usePanelWidth(name: PanelName) {
  const spec = PANELS[name]
  const width = (widths[name] ??= ref(read(name)))

  return {
    spec,
    width,
    css: computed(() => `min(${width.value}px, ${spec.vw}vw)`),
    set(px: number) {
      const most = Math.min(spec.max, (window.innerWidth * spec.vw) / 100)
      width.value = Math.round(Math.max(spec.min, Math.min(most, px)))
    },
    reset() {
      width.value = spec.initial
    },
    save() {
      try {
        localStorage.setItem(`bm:panel:${name}`, String(width.value))
      } catch {
        // Private mode: remembered until the tab closes.
      }
    },
  }
}

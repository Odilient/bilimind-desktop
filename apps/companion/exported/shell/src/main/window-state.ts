// The main window comes back where it was left: size, position and maximised, kept in
// <userData>/window-state.json. A position on a monitor that is no longer attached is dropped, so the window
// never opens off-screen.
import { app, screen, type BrowserWindow, type Rectangle } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

const DEFAULTS: WindowState = { width: 1280, height: 820, maximized: false }
const MIN = { width: 900, height: 600 }

const file = () => join(app.getPath('userData'), 'window-state.json')

function visible(r: Rectangle): boolean {
  // at least a 120×80 corner of the title area must be on some display's work area
  return screen.getAllDisplays().some(({ workArea: a }) =>
    r.x + 120 > a.x && r.x < a.x + a.width - 120 && r.y >= a.y - 10 && r.y < a.y + a.height - 80)
}

export function loadWindowState(): WindowState {
  let saved: Partial<WindowState> = {}
  try { saved = JSON.parse(readFileSync(file(), 'utf8')) } catch { /* first run */ }
  const state: WindowState = {
    width: Math.max(MIN.width, Number(saved.width) || DEFAULTS.width),
    height: Math.max(MIN.height, Number(saved.height) || DEFAULTS.height),
    maximized: saved.maximized === true,
  }
  if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    const r = { x: saved.x!, y: saved.y!, width: state.width, height: state.height }
    if (visible(r)) { state.x = r.x; state.y = r.y }
  }
  return state
}

export const windowMinimum = MIN

export function trackWindowState(win: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null
  const save = () => {
    if (timer) { clearTimeout(timer); timer = null }
    if (win.isDestroyed()) return
    // the normal bounds, so un-maximising later restores the size the learner chose
    const b = win.getNormalBounds()
    const state: WindowState = { x: b.x, y: b.y, width: b.width, height: b.height, maximized: win.isMaximized() }
    try { writeFileSync(file(), JSON.stringify(state)) } catch (e) { console.error('window state not saved', e) }
  }
  const later = () => { if (timer) clearTimeout(timer); timer = setTimeout(save, 400) }
  win.on('resize', later)
  win.on('move', later)
  win.on('maximize', later)
  win.on('unmaximize', later)
  win.on('close', save)
}

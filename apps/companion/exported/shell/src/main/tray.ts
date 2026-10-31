// The tray: the next deadline at a glance ("Quiz 2 · 1d 23h"), and Open / Capture / Record / Quit.
//
// The renderer owns the facts and pushes the one deadline that matters (`platform.setNextDeadline`); the tray
// owns only the countdown, which it re-renders every minute so it stays true while the window is closed.
// Where it shows: the tooltip on Windows and macOS, next to the icon on macOS (setTitle), and as the first,
// disabled menu line everywhere, because Linux app indicators show neither tooltips nor titles.
import { Menu, Tray, nativeImage, type MenuItemConstructorOptions, type NativeImage } from 'electron'
import type { NextDeadline } from '../shared/contract.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "1d 23h", "5h 12m", "12m", "now", or "overdue". Rounds down: the tray never promises more time than there is. */
export function countdown(dueAt: number, now: number): string {
  const left = dueAt - now
  if (left < 0) return 'overdue'
  if (left < MINUTE) return 'now'
  const d = Math.floor(left / DAY)
  const h = Math.floor((left % DAY) / HOUR)
  const m = Math.floor((left % HOUR) / MINUTE)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** The one line the tray shows. */
export function deadlineLabel(next: NextDeadline | null, now = Date.now()): string {
  if (!next || !next.title.trim()) return 'Nothing due'
  const title = next.title.trim().slice(0, 60)
  const due = next.due_at ? Date.parse(next.due_at) : NaN
  return Number.isFinite(due) ? `${title} · ${countdown(due, now)}` : title
}

export interface TrayActions {
  open(): void
  capture(): void
  record(): void
  quit(): void
}

export function trayTemplate(next: NextDeadline | null, actions: TrayActions, shortcut: string | null, now = Date.now()): MenuItemConstructorOptions[] {
  return [
    { id: 'next', label: deadlineLabel(next, now), enabled: false },
    { type: 'separator' },
    { id: 'open', label: 'Open BiliMind', click: actions.open },
    // the accelerator is only a hint here: the global shortcut itself is registered in shortcut.ts
    { id: 'capture', label: 'Capture', click: actions.capture, ...(shortcut ? { accelerator: shortcut, registerAccelerator: false } : {}) },
    { type: 'separator' },
    { id: 'quit', label: 'Quit BiliMind', click: actions.quit },
  ]
}

export class DesktopTray {
  private tray: Tray | null = null
  private next: NextDeadline | null = null
  private timer: NodeJS.Timeout | null = null
  /** The last menu built, kept for the e2e test (a real tray menu cannot be read back). */
  template: MenuItemConstructorOptions[] = []
  label = 'Nothing due'

  constructor(private icon: NativeImage, private actions: TrayActions, private shortcut: () => string | null) {}

  create(): void {
    // BILIMIND_NATIVE_TRAY=0 keeps only the model: the e2e test runs without a display, where GTK aborts the
    // process as soon as a tray menu is attached ("Can't create a GtkStyleContext without a display connection")
    if (process.env.BILIMIND_NATIVE_TRAY === '0') { this.render(); this.tick(); return }
    const size = process.platform === 'darwin' ? 18 : process.platform === 'win32' ? 16 : 24
    this.tray = new Tray(this.icon.isEmpty() ? nativeImage.createEmpty() : this.icon.resize({ width: size, height: size, quality: 'best' }))
    // Windows: a left click opens the app; the menu is on the right click (and on Linux, on any click)
    this.tray.on('click', () => { if (process.platform === 'win32') this.actions.open() })
    this.render()
    this.tick()
  }

  setNext(next: NextDeadline | null): void {
    this.next = next
    this.render()
  }

  /** Re-render on each minute boundary, so "1d 23h" ticks to "1d 22h" on time. */
  private tick(): void {
    const wait = MINUTE - (Date.now() % MINUTE) + 50
    this.timer = setTimeout(() => { this.render(); this.tick() }, wait)
  }

  render(now = Date.now()): void {
    this.label = deadlineLabel(this.next, now)
    this.template = trayTemplate(this.next, this.actions, this.shortcut(), now)
    if (!this.tray || this.tray.isDestroyed()) return
    this.tray.setToolTip(`BiliMind: ${this.label}`)
    if (process.platform === 'darwin') this.tray.setTitle(this.next ? ` ${this.label}` : '')
    this.tray.setContextMenu(Menu.buildFromTemplate(this.template))
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer)
    this.tray?.destroy()
    this.tray = null
  }
}

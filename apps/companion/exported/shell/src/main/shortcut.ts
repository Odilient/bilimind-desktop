// The capture hotkey: one global combination that brings the window forward and opens Capture.
//
// Alt+Space by default, from <userData>/desktop.json `shortcut`, or BILIMIND_SHORTCUT for a run.
// The OS or another app may already hold the combination (Windows and GNOME use Alt+Space for the window
// menu, PowerToys Run for its launcher); registration then fails quietly and Capture stays in the tray, so
// the state says whether it is live and the app can offer another.
import { globalShortcut } from 'electron'
import type { ShortcutState } from '../shared/contract.ts'
import { readSettings, writeSettings } from './settings.ts'

export const DEFAULT_SHORTCUT = 'Alt+Space'

let current: ShortcutState = { accelerator: DEFAULT_SHORTCUT, registered: false }
let fire: () => void = () => {}

function tryRegister(accelerator: string): boolean {
  try {
    return globalShortcut.register(accelerator, () => fire())
  } catch {
    // an accelerator Electron cannot parse
    return false
  }
}

export function initShortcut(onFire: () => void): ShortcutState {
  fire = onFire
  const accelerator = process.env.BILIMIND_SHORTCUT || readSettings().shortcut || DEFAULT_SHORTCUT
  current = { accelerator, registered: tryRegister(accelerator) }
  if (!current.registered) console.warn(`capture shortcut ${accelerator} is taken or invalid; Capture is in the tray`)
  return current
}

export function shortcutState(): ShortcutState {
  return { ...current }
}

/** Swap to a new combination. On failure the old one stays live and is what comes back. */
export function changeShortcut(accelerator: string): ShortcutState {
  const next = String(accelerator ?? '').trim()
  if (!next || next.length > 60) return shortcutState()
  if (next === current.accelerator && current.registered) return shortcutState()
  if (current.registered) globalShortcut.unregister(current.accelerator)
  if (tryRegister(next)) {
    current = { accelerator: next, registered: true }
    writeSettings({ shortcut: next })
  } else {
    current = { accelerator: current.accelerator, registered: current.registered && tryRegister(current.accelerator) }
  }
  return shortcutState()
}

export function releaseShortcut(): void {
  globalShortcut.unregisterAll()
}

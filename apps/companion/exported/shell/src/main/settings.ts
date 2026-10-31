// The shell's own settings, in <userData>/desktop.json. Only what the SPA cannot keep itself: the global
// shortcut (main registers it before any page has loaded).
import { app } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface DesktopSettings {
  shortcut?: string
}

const file = () => join(app.getPath('userData'), 'desktop.json')

export function readSettings(): DesktopSettings {
  try {
    const s = JSON.parse(readFileSync(file(), 'utf8'))
    return s && typeof s === 'object' ? s : {}
  } catch {
    return {}
  }
}

export function writeSettings(patch: DesktopSettings): DesktopSettings {
  const next = { ...readSettings(), ...patch }
  writeFileSync(file(), JSON.stringify(next, null, 2))
  return next
}

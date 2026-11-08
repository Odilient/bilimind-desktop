// contextBridge -> window.bilimind (shared/contract.ts DesktopBridge). Sandboxed preload: only 'electron' is
// required. The unwrapping of main's error messages is the existing BiliMind Desktop preload's
// (bilimind-desktop/apps/desktop/src/preload/preload.ts `call`).
import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { IPC, type CaptureRequest, type DesktopBridge } from '../shared/contract.ts'

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  try {
    return (await ipcRenderer.invoke(channel, ...args)) as T
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+':\s*(?:\w*Error:\s*)?/, '')
    throw new Error(msg)
  }
}

// Capture requests can arrive before the app has mounted its layout (the hotkey pressed while the window was
// closed). They wait here and are replayed to the first subscriber.
const captureListeners = new Set<(req: CaptureRequest) => void>()
const heldCaptures: CaptureRequest[] = []
ipcRenderer.on(IPC.capture, (_e: IpcRendererEvent, req: CaptureRequest) => {
  if (!captureListeners.size) { heldCaptures.splice(0, heldCaptures.length, req); return }
  for (const cb of captureListeners) { try { cb(req) } catch (err) { console.error(err) } }
})

const version = process.argv.find((a) => a.startsWith('--bm-version='))?.slice('--bm-version='.length) ?? ''

const bridge: DesktopBridge = {
  kind: 'electron',
  os: process.platform,
  version,
  setNextDeadline: (next) => ipcRenderer.send(IPC.setNextDeadline, next ? { title: next.title, due_at: next.due_at ?? null } : null),
  onCapture: (cb) => {
    captureListeners.add(cb)
    for (const req of heldCaptures.splice(0)) { try { cb(req) } catch (err) { console.error(err) } }
    return () => { captureListeners.delete(cb) }
  },
  pathForFile: (file) => {
    try { return webUtils.getPathForFile(file) || null } catch { return null }
  },
  revealInFolder: (path) => call(IPC.revealInFolder, path),
  moodleCapture: (req) => call(IPC.moodleCapture, { siteUrl: req.siteUrl, urls: [...req.urls] }),
  openExternal: (url) => call(IPC.openExternal, url),
  shortcut: {
    get: () => call(IPC.shortcutGet),
    set: (accelerator) => call(IPC.shortcutSet, accelerator),
  },
  // recording
  screen: {
    sources: () => call(IPC.screenSources),
    choose: (id, sound) => call(IPC.screenChoose, id, sound),
  },
  recordings: {
    append: (id, name, bytes) => call(IPC.recordingAppend, id, name, bytes),
    files: (id) => call(IPC.recordingFiles, id),
    remove: (id) => call(IPC.recordingRemove, id),
  },
  // exports
  printToPdf: () => call(IPC.printToPdf),
}

contextBridge.exposeInMainWorld('bilimind', bridge)

/**
 * A cookie jar for the page, because app:// has none: Chromium only stores cookies for http(s) origins, and
 * Electron 45 gives a privileged custom scheme localStorage but not cookies (`document.cookie` stays ''). The
 * frontend keeps its bearer token in a cookie (`useApi` AUTH_COOKIE), so without this the learner would be
 * signed out on every launch. Capacitor solves the same problem the same way (CapacitorCookies patches
 * `document.cookie`). Cookies with an expiry live in localStorage, session cookies in sessionStorage; Path,
 * Domain, SameSite and Secure are meaningless on a single-origin app and are ignored. Runs in the page's own
 * world, before any of its scripts.
 */
function installCookieJar(): void {
  const KEY = 'bm:cookies'
  type Jar = Record<string, { v: string; exp?: number }>
  const load = (store: Storage): Jar => {
    try { return JSON.parse(store.getItem(KEY) || '{}') as Jar } catch { return {} }
  }
  const save = (store: Storage, jar: Jar) => {
    try { store.setItem(KEY, JSON.stringify(jar)) } catch { /* storage full or blocked */ }
  }
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get() {
      const now = Date.now()
      const all = { ...load(localStorage), ...load(sessionStorage) }
      return Object.entries(all)
        .filter(([, c]) => c.exp === undefined || c.exp > now)
        .map(([k, c]) => (k ? `${k}=${c.v}` : c.v))
        .join('; ')
    },
    set(raw: string) {
      const [pair = '', ...attrs] = String(raw).split(';')
      const eq = pair.indexOf('=')
      const name = (eq < 0 ? '' : pair.slice(0, eq)).trim()
      const value = (eq < 0 ? pair : pair.slice(eq + 1)).trim()
      let exp: number | undefined
      for (const attr of attrs) {
        const [k = '', ...rest] = attr.split('=')
        const key = k.trim().toLowerCase()
        const val = rest.join('=').trim()
        if (key === 'max-age' && val !== '' && Number.isFinite(Number(val))) exp = Date.now() + Number(val) * 1000
        else if (key === 'expires' && exp === undefined) { const t = Date.parse(val); if (Number.isFinite(t)) exp = t }
      }
      const persisted = load(localStorage)
      const session = load(sessionStorage)
      delete persisted[name]
      delete session[name]
      if (exp === undefined) session[name] = { v: value }
      else if (exp > Date.now()) persisted[name] = { v: value, exp }
      save(localStorage, persisted)
      save(sessionStorage, session)
    },
  })
}

if (location.protocol === 'app:') contextBridge.executeInMainWorld({ func: installCookieJar })

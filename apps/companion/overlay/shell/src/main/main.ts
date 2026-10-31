// BiliMind on the desktop: the companion SPA, its API and its data on this computer, with no account.
//
// contextIsolation + sandbox + no Node in the page, links that leave the app open in the browser, single instance, a
// minimal macOS menu, and a test mode. The SPA and its API are on app://bilimind (protocol.ts, api/handler.ts), the
// window remembers its place (window-state.ts), a tray shows the next deadline (tray.ts), a global hotkey opens
// Capture (shortcut.ts), and getDisplayMedia can return system audio (audio.ts). The page sees those as
// `window.bilimind` (preload.ts, shared/contract.ts).
//
// Test mode (BILIMIND_E2E=1): a throwaway profile from BILIMIND_USER_DATA, and `globalThis.__bm` hooks for
// test/e2e.mjs, which runs on Chromium's headless Ozone platform so windows and the tray never reach the screen.
import { BrowserWindow, Menu, app, ipcMain, nativeImage, net, safeStorage, session, shell, type IpcMainEvent, type IpcMainInvokeEvent, type WebContents } from 'electron'
import { existsSync, statSync } from 'node:fs'
import { homedir, userInfo } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import type { Vault } from '../api/credentials.ts'
import { createApi } from '../api/handler.ts'
import { IPC, type CaptureRequest, type NextDeadline } from '../shared/contract.ts'
import { allowSystemAudio } from './audio.ts'
import { ORIGIN, registerScheme, serveSpa } from './protocol.ts'
import { changeShortcut, initShortcut, releaseShortcut, shortcutState } from './shortcut.ts'
import { DesktopTray } from './tray.ts'
import { loadWindowState, trackWindowState, windowMinimum } from './window-state.ts'

const E2E = process.env.BILIMIND_E2E === '1'
const MAC = process.platform === 'darwin'
/** The page canvas (the frontend's theme-color), so the window never flashes white before the SPA paints. */
const CANVAS = '#ECEEF2'

if (process.env.BILIMIND_USER_DATA) app.setPath('userData', process.env.BILIMIND_USER_DATA)
app.setAppUserModelId('com.bilimind.companion')
registerScheme()

const spaRoot = process.env.BILIMIND_SPA_DIR || join(app.getAppPath(), 'spa')
const demo = process.env.BILIMIND_DEMO === '1' || process.argv.includes('--demo')
const startUrl = `${ORIGIN}/app${demo ? '?demo=1' : ''}`
const iconFile = join(app.getAppPath(), 'resources', 'icon.png')

let win: BrowserWindow | null = null
let tray: DesktopTray | null = null
let quitting = false

/** The account name is all this app knows about who is using it; the sidebar and greeting read it. */
function localName(): string {
  try { return userInfo().username || 'You' } catch { return 'You' }
}

/** The folder of the settings file the CLI and the course generator share. */
const settingsDir = () => process.env.BILIMIND_HOME ? resolve(process.env.BILIMIND_HOME) : join(process.env.USERPROFILE || process.env.HOME || homedir(), '.bilimind')

/**
 * Keys sealed by the system's keychain. Linux's "basic_text" backend is a fixed password in Chromium's own source, so
 * that counts as no keychain: the settings screen says so, and the file stays readable by this user only.
 */
function keyVault(): Vault {
  const available = safeStorage.isEncryptionAvailable()
    && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text')
  return {
    available,
    seal: (plain) => safeStorage.encryptString(plain).toString('base64'),
    open: (sealed) => safeStorage.decryptString(Buffer.from(sealed, 'base64')),
  }
}

const own = (url: string | undefined) => !!url && (url === ORIGIN || url.startsWith(`${ORIGIN}/`))
const webLink = (url: string) => /^(https?:|mailto:)/i.test(url)

// ---------- the window ----------

/** Links and navigations that leave app://bilimind go to the system browser; nothing else is ever loaded. */
function keepInApp(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    if (own(url)) void contents.loadURL(url)
    else if (webLink(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (e) => {
    if (own(e.url)) return
    e.preventDefault()
    if (webLink(e.url)) void shell.openExternal(e.url)
  })
}

function createWindow(): BrowserWindow {
  const state = loadWindowState()
  const w = new BrowserWindow({
    ...(state.x !== undefined ? { x: state.x, y: state.y } : {}),
    width: state.width,
    height: state.height,
    minWidth: windowMinimum.width,
    minHeight: windowMinimum.height,
    show: false,
    title: 'BiliMind',
    backgroundColor: CANVAS,
    icon: existsSync(iconFile) ? iconFile : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
      navigateOnDragDrop: false,
      spellcheck: true,
      // the sandboxed preload has no `app`; this is how it learns the version
      additionalArguments: [`--bm-version=${app.getVersion()}`],
    },
  })
  if (state.maximized) w.maximize()
  w.once('ready-to-show', () => w.show())
  trackWindowState(w)
  keepInApp(w.webContents)

  // With a tray, closing the window keeps BiliMind running there (the countdown and the hotkey stay live).
  w.on('close', (e) => {
    if (quitting || !tray) return
    e.preventDefault()
    w.hide()
  })
  w.on('closed', () => { if (win === w) win = null })
  w.webContents.on('render-process-gone', (_e, details) => {
    console.error('renderer gone', details.reason)
    if (details.reason !== 'clean-exit' && !w.isDestroyed()) void w.loadURL(startUrl)
  })
  void w.loadURL(startUrl)
  return w
}

function showWindow(): BrowserWindow {
  if (!win || win.isDestroyed()) win = createWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  if (MAC) app.focus({ steal: true })
  return win
}

/** Ask the page to open Capture. A page still loading gets it once loaded; the preload holds it until the app listens. */
function requestCapture(req: CaptureRequest): void {
  const w = showWindow()
  const send = () => { if (!w.isDestroyed()) w.webContents.send(IPC.capture, req) }
  if (w.webContents.isLoading()) w.webContents.once('did-finish-load', send)
  else send()
}

// ---------- security ----------

/** What the page may ask for: the microphone and camera (recording, photos), system audio, the clipboard, fullscreen, notifications. */
const ALLOWED_PERMISSIONS = new Set(['media', 'display-capture', 'clipboard-sanitized-write', 'clipboard-read', 'fullscreen', 'notifications'])

function hardenSessions(): void {
  const ses = session.defaultSession
  ses.setPermissionRequestHandler((_wc, permission, cb, details) => cb(own(details.requestingUrl) && ALLOWED_PERMISSIONS.has(permission)))
  ses.setPermissionCheckHandler((_wc, permission, origin) => own(origin) && ALLOWED_PERMISSIONS.has(permission))
  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-attach-webview', (ev) => ev.preventDefault())
  })
}

// ---------- IPC (shared/contract.ts) ----------

/** Only our own page may use the bridge; nothing else is ever loaded. */
function fromApp(e: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return own(e.senderFrame?.url)
}

function cleanDeadline(v: unknown): NextDeadline | null {
  const d = v as Partial<NextDeadline> | null
  if (!d || typeof d.title !== 'string' || !d.title.trim()) return null
  const due = typeof d.due_at === 'string' && Number.isFinite(Date.parse(d.due_at)) ? d.due_at : null
  return { title: d.title.slice(0, 200), due_at: due }
}

function registerIpc(): void {
  ipcMain.on(IPC.setNextDeadline, (e, next: unknown) => {
    if (fromApp(e)) tray?.setNext(cleanDeadline(next))
  })
  ipcMain.handle(IPC.revealInFolder, (e, path: unknown) => {
    if (!fromApp(e) || typeof path !== 'string' || !isAbsolute(path)) return false
    try { statSync(path) } catch { return false }
    shell.showItemInFolder(path)
    return true
  })
  ipcMain.handle(IPC.openExternal, async (e, url: unknown) => {
    if (!fromApp(e) || typeof url !== 'string' || !webLink(url)) throw new Error('Only web links can be opened.')
    await shell.openExternal(url)
  })
  ipcMain.handle(IPC.shortcutGet, (e) => (fromApp(e) ? shortcutState() : null))
  ipcMain.handle(IPC.shortcutSet, (e, accelerator: unknown) => {
    if (!fromApp(e)) return null
    const state = changeShortcut(String(accelerator ?? ''))
    tray?.render()
    return state
  })
}

// ---------- start ----------

function start(): void {
  // no menu bar on Windows and Linux; macOS needs the app and Edit menus for Cmd+Q, Cmd+C/V/X/A and Cmd+W
  Menu.setApplicationMenu(MAC ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]) : null)
  hardenSessions()
  const api = createApi({
    dataDir: join(app.getPath('userData'), 'data'),
    configDir: settingsDir(),
    userName: localName(),
    vault: keyVault(),
    fallbackFetch: net.fetch as typeof fetch,
    ...(E2E && process.env.BILIMIND_LLM_BASE_URL ? { baseUrl: process.env.BILIMIND_LLM_BASE_URL } : {}),
  })
  app.on('will-quit', () => api.close())
  serveSpa(spaRoot, api.handle, (process.env.BILIMIND_CSP_CONNECT ?? '').split(/\s+/).filter(Boolean))
  allowSystemAudio()
  registerIpc()

  const onHotkey = () => requestCapture({ mode: 'menu', from: 'hotkey' })
  initShortcut(onHotkey)

  try {
    tray = new DesktopTray(nativeImage.createFromPath(iconFile), {
      open: () => { showWindow() },
      capture: () => requestCapture({ mode: 'menu', from: 'tray' }),
      record: () => requestCapture({ mode: 'record', from: 'tray' }),
      quit: () => { quitting = true; app.quit() },
    }, () => (shortcutState().registered ? shortcutState().accelerator : null))
    tray.create()
  } catch (err) {
    // no tray on this desktop: closing the window then quits, as in any plain app
    console.warn('no tray', err)
    tray = null
  }

  win = createWindow()

  if (E2E) {
    (globalThis as Record<string, unknown>).__bm = {
      window: () => win,
      tray: () => tray,
      hotkey: onHotkey,
      shortcut: shortcutState,
      spaRoot,
      startUrl,
    }
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => { showWindow() })
  app.whenReady().then(start).catch((e) => { console.error(e); app.exit(1) })
  app.on('activate', () => { showWindow() })
  app.on('before-quit', () => { quitting = true })
  app.on('will-quit', () => { releaseShortcut(); tray?.destroy() })
  app.on('window-all-closed', () => { if (!tray || quitting) app.quit() })
}

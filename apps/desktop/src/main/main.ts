// BiliMind Desktop: Electron main process. Window, IPC (CONTRACT.md), runs, settings.
// Test mode: BILIMIND_E2E=1 creates windows with show:false and opens --remote-debugging-port=$BILIMIND_CDP_PORT.
import { BrowserWindow, Menu, app, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { IPC, type AssistantAsk, type ProviderId, type SettingsPatch } from '../shared/contract.ts';
import { askAssistant, cancelAssistant } from './assistant.ts';
import { courseOutline, getCourse, inspectFolder, listCourses, openFile, playerUrl, removeCourse, reveal } from './courses.ts';
import { pickDropped, pickFilesDialog, rememberDrop } from './inbox.ts';
import { cancelRun, killAllRuns, resourcesDir, startRun } from './runs.ts';
import { getSettings, saveSettings, testKey } from './settings.ts';

const E2E = process.env.BILIMIND_E2E === '1';
const CANVAS = '#F6F7FA';
const COBALT = '#2340E6';

const MAC = process.platform === 'darwin';

if (E2E) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.BILIMIND_CDP_PORT || '9333');
  app.commandLine.appendSwitch('remote-allow-origins', '*');
  // Linux CI and servers have no display: Chromium's headless Ozone backend (test windows are offscreen anyway)
  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) app.commandLine.appendSwitch('ozone-platform', 'headless');
}
app.setAppUserModelId('ai.bilimind.desktop');

let win: BrowserWindow | null = null;

function rendererEntry(): { url?: string; file?: string } {
  const dev = process.env.BILIMIND_RENDERER_URL;   // scripts/dev.mjs (vite dev server)
  if (dev) return { url: dev };
  return { file: join(__dirname, '..', 'renderer', 'index.html') };
}

function iconPath(): string | undefined {
  const p = join(resourcesDir(), 'icon.png');
  return existsSync(p) ? p : undefined;
}

function createWindow(): BrowserWindow {
  const w = new BrowserWindow({
    width: 1280, height: 820, minWidth: 1024, minHeight: 700,
    show: false,
    title: 'BiliMind Desktop',
    backgroundColor: CANVAS,
    icon: iconPath(),
    titleBarStyle: 'hidden',
    // macOS keeps its traffic lights on the left of the 40px bar; Windows and Linux draw their buttons on the right
    ...(MAC ? { trafficLightPosition: { x: 14, y: 13 } } : { titleBarOverlay: { color: CANVAS, symbolColor: COBALT, height: 40 } }),
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: true,
      spellcheck: false,
      // hidden test windows must keep painting so CDP screenshots work: offscreen rendering never creates an
      // on-screen surface (BILIMIND_E2E_OSR=0 turns it off, e.g. to test <webview> in a plain hidden window)
      backgroundThrottling: !E2E,
      ...(E2E && process.env.BILIMIND_E2E_OSR !== '0' ? { offscreen: true } : {}),
    },
  });
  if (!E2E) w.once('ready-to-show', () => w.show());

  // links that leave the app open in the system browser
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  w.webContents.on('will-navigate', (ev, url) => {
    const entry = rendererEntry();
    const own = entry.url ? url.startsWith(entry.url) : url.startsWith('file:');
    if (!own) { ev.preventDefault(); if (/^https?:\/\//i.test(url)) void shell.openExternal(url); }
  });

  const entry = rendererEntry();
  if (entry.url) void w.loadURL(entry.url);
  else void w.loadFile(entry.file!);
  w.on('closed', () => { if (win === w) win = null; });
  return w;
}

// <webview> hardening: the course player is an offline file:// page; no preload, no node, links go out.
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-attach-webview', (_ev, prefs, params) => {
    delete (prefs as { preload?: string }).preload;
    prefs.nodeIntegration = false;
    prefs.contextIsolation = true;
    if (params.src && !/^file:/i.test(params.src) && !/^about:blank/i.test(params.src)) _ev.preventDefault();
  });
  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
      return { action: 'deny' };
    });
  }
});

// ---------- IPC (CONTRACT.md window.bilimind) ----------
function handle<A extends unknown[], R>(channel: string, fn: (...args: A) => R | Promise<R>): void {
  ipcMain.handle(channel, async (_e: IpcMainInvokeEvent, ...args: unknown[]) => fn(...(args as A)));
}

function registerIpc(): void {
  handle(IPC.settingsGet, () => getSettings());
  handle(IPC.settingsSave, (p: SettingsPatch) => saveSettings(p ?? {}));
  handle(IPC.settingsTestKey, (p: ProviderId) => testKey(p));
  ipcMain.on(IPC.dropped, (_e, p: unknown) => rememberDrop(p));
  handle(IPC.pickFolder, async () => {
    // files or a folder dropped on the page in the last few seconds answer this call without a dialog
    const dropped = await pickDropped();
    if (dropped) return dropped;
    if (E2E) return process.env.BILIMIND_E2E_PICK || null;   // never a native dialog on the owner's screen in tests
    const opts: Electron.OpenDialogOptions = { title: 'Choose the folder with your files', properties: ['openDirectory'] };
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
    return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
  });
  handle(IPC.pickFiles, () => (E2E ? Promise.resolve(process.env.BILIMIND_E2E_PICK || null) : pickFilesDialog(win)));
  handle(IPC.inspectFolder, (p: string) => inspectFolder(p));
  handle(IPC.coursesList, () => listCourses());
  handle(IPC.coursesGet, (id: string) => getCourse(id));
  handle(IPC.coursesPlayerUrl, (id: string) => playerUrl(id));
  handle(IPC.coursesReveal, (id: string) => reveal(id));
  handle(IPC.coursesOpenFile, (id: string, rel: string) => openFile(id, rel));
  handle(IPC.coursesRemove, (id: string) => removeCourse(id));
  handle(IPC.coursesOutline, (id: string) => courseOutline(id));
  handle(IPC.assistantAsk, (o: AssistantAsk) => askAssistant(o, ev => { if (win && !win.isDestroyed()) win.webContents.send(IPC.assistantEvent, ev); }));
  handle(IPC.assistantCancel, (id: string) => cancelAssistant(id));
  handle(IPC.runStart, (o: { src: string; sentence: string }) => startRun(o));
  handle(IPC.runCancel, (id: string) => cancelRun(id));
  handle(IPC.openExternal, async (url: string) => {
    if (typeof url !== 'string' || !/^(https?:|mailto:)/i.test(url)) throw new Error('Only web links can be opened.');
    await shell.openExternal(url);
  });
}

const single = E2E || app.requestSingleInstanceLock();
if (!single) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    // no menu bar on Windows and Linux; macOS needs the app and Edit menus for Cmd+Q, Cmd+C/V/X/A and Cmd+W
    Menu.setApplicationMenu(MAC ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]) : null);
    registerIpc();
    win = createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) win = createWindow(); });
  }).catch(e => { console.error(e); app.exit(1); });
  app.on('window-all-closed', () => { killAllRuns(); app.quit(); });
  app.on('before-quit', () => killAllRuns());
}

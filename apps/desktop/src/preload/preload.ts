// contextBridge -> window.bilimind, exactly the API in CONTRACT.md. Sandboxed preload: only 'electron' is required.
import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron';
import { IPC, type AssistantEvent, type BilimindApi, type RunEvent } from '../shared/contract.ts';

/** invoke, with main's error message unwrapped ("Error invoking remote method ...: Error: " removed). */
async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  try {
    return (await ipcRenderer.invoke(channel, ...args)) as T;
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).replace(/^Error invoking remote method '[^']+':\s*(?:\w*Error:\s*)?/, '');
    throw new Error(msg);
  }
}

const api: BilimindApi = {
  settings: {
    get: () => call(IPC.settingsGet),
    save: p => call(IPC.settingsSave, p),
    testKey: provider => call(IPC.settingsTestKey, provider),
  },
  pickFolder: () => call(IPC.pickFolder),
  pickFiles: () => call(IPC.pickFiles),
  inspectFolder: path => call(IPC.inspectFolder, path),
  courses: {
    outline: id => call(IPC.coursesOutline, id),
    list: () => call(IPC.coursesList),
    get: id => call(IPC.coursesGet, id),
    playerUrl: id => call(IPC.coursesPlayerUrl, id),
    reveal: id => call(IPC.coursesReveal, id),
    openFile: (id, rel) => call(IPC.coursesOpenFile, id, rel),
    remove: id => call(IPC.coursesRemove, id),
  },
  run: {
    start: o => call(IPC.runStart, { src: o?.src, sentence: o?.sentence }),
    cancel: runId => call(IPC.runCancel, runId),
    onEvent: cb => {
      const listener = (_e: IpcRendererEvent, ev: RunEvent) => { try { cb(ev); } catch (err) { console.error(err); } };
      ipcRenderer.on(IPC.runEvent, listener);
      return () => { ipcRenderer.removeListener(IPC.runEvent, listener); };
    },
  },
  assistant: {
    ask: o => call(IPC.assistantAsk, o),
    cancel: askId => call(IPC.assistantCancel, askId),
    onEvent: cb => {
      const listener = (_e: IpcRendererEvent, ev: AssistantEvent) => { try { cb(ev); } catch (err) { console.error(err); } };
      ipcRenderer.on(IPC.assistantEvent, listener);
      return () => { ipcRenderer.removeListener(IPC.assistantEvent, listener); };
    },
  },
  openExternal: url => call(IPC.openExternal, url),
  platform: process.platform,
};

contextBridge.exposeInMainWorld('bilimind', api);

// Drag and drop: File.path is gone since Electron 32 and the contract has no drop call, so the preload tells main
// every dropped path (capture phase, before the page's own drop handler); the page then calls pickFolder() and main
// answers with the dropped folder, or a staging folder holding the dropped files, instead of opening the dialog.
window.addEventListener('drop', e => {
  const paths: string[] = [];
  for (const f of Array.from(e.dataTransfer?.files ?? [])) {
    try { const p = webUtils.getPathForFile(f); if (p) paths.push(p); } catch { /* not a file on disk */ }
  }
  if (paths.length) ipcRenderer.send(IPC.dropped, paths);
}, true);

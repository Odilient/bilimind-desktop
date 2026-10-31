// The bridge between the Electron main process and the companion SPA, as `window.bilimind`.
//
// The SPA never talks to this directly: `app/companion/platform/electron.ts` in the frontend wraps it in the
// same `Platform` interface the web build implements, and that file keeps its own copy of `DesktopBridge`
// (the frontend cannot import from this package). Change both together.

export const IPC = {
  setNextDeadline: 'bm:tray:next-deadline',
  capture: 'bm:capture',
  revealInFolder: 'bm:reveal',
  moodleCapture: 'bm:moodle:capture',
  openExternal: 'bm:open-external',
  shortcutGet: 'bm:shortcut:get',
  shortcutSet: 'bm:shortcut:set',
} as const

/** What the tray shows. `null` clears it ("Nothing due"). */
export interface NextDeadline {
  title: string
  /** ISO 8601 with an offset, or null for an undated one (shown without a countdown). */
  due_at: string | null
}

/** Why the renderer is asked to open Capture: the hotkey and the tray's Capture open the menu; Record opens recording. */
export interface CaptureRequest {
  mode: 'menu' | 'record'
  from: 'hotkey' | 'tray'
}

export interface MoodleCaptureRequest {
  /** The site the student connects, as the backend normalised it (signature checks use it). */
  siteUrl: string
  /** The pages to open in order, as `MoodleSsoLaunch::startUrls()` returns them: launch URL, then login page. */
  urls: string[]
}

export interface MoodleCaptureResult {
  /** The raw `moodlemobile://token=…` (or `bilimind://token=…`) address, untouched: the server verifies it. */
  tokenUrl: string
}

export interface ShortcutState {
  accelerator: string
  /** False when the OS or another app holds the combination; Capture is then only in the tray. */
  registered: boolean
}

export interface DesktopBridge {
  kind: 'electron'
  /** process.platform: 'darwin' | 'win32' | 'linux'. */
  os: string
  version: string
  setNextDeadline(next: NextDeadline | null): void
  /** Subscribe to capture requests. Requests that arrive before the first subscriber are held and replayed. */
  onCapture(cb: (req: CaptureRequest) => void): () => void
  /** The file's path on disk, for a File that came from a drop or a file input; null for one made in memory. */
  pathForFile(file: File): string | null
  revealInFolder(path: string): Promise<boolean>
  moodleCapture(req: MoodleCaptureRequest): Promise<MoodleCaptureResult>
  openExternal(url: string): Promise<void>
  shortcut: {
    get(): Promise<ShortcutState>
    set(accelerator: string): Promise<ShortcutState>
  }
}

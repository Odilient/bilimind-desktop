/**
 * What the device can do for the app, behind one interface (vue-stack.md §6:
 * "platform code goes behind one TypeScript `platform` interface with web,
 * Capacitor and Electron implementations, chosen at runtime").
 *
 * Screens never ask "am I in Electron?". They call `usePlatform()` and either
 * use a capability or read `can.*` to decide whether to offer it at all.
 * Everything here works, or fails with a `PlatformError` that says why, on
 * every platform: the web build is the floor, not a stub.
 */

/** `capacitor` is reserved for the phone shell; until it implements this, the phone runs the web implementation. */
export type PlatformKind = 'web' | 'electron' | 'capacitor'

/** The one deadline the tray shows ("Quiz 2 · 1d 23h"). */
export interface NextDeadline {
  title: string
  /** ISO 8601 with an offset; null for an undated one. */
  due_at: string | null
}

/** The desktop asks the app to open Capture: the hotkey and the tray's Capture open the menu, Record opens recording. */
export interface CaptureRequest {
  mode: 'menu' | 'record'
  from: 'hotkey' | 'tray'
}

export type PlatformErrorCode =
  | 'unsupported'
  | 'cancelled'
  | 'timeout'
  | 'busy'
  | 'invalid'
  | 'no-audio'
  | 'failed'

export class PlatformError extends Error {
  constructor(
    readonly code: PlatformErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'PlatformError'
  }
}

export interface Platform {
  readonly kind: PlatformKind

  /** What this device offers, so a screen can leave out what it cannot do instead of failing on a tap. */
  readonly can: {
    /** A tray (menu bar) countdown to the next deadline. */
    tray: boolean
    /** A system-wide capture hotkey. */
    hotkey: boolean
    /** Moodle's own sign-in with the token caught by the app. On the web the browser extension does this. */
    moodleSignIn: boolean
    /** Recording what the computer plays (an online lecture), not just the microphone. */
    systemAudio: boolean
    /** Showing a file in Finder or Explorer. */
    revealInFolder: boolean
  }

  /** Tell the tray which deadline is next. `null` clears it. A no-op where there is no tray. */
  setNextDeadline(next: NextDeadline | null): void

  /** The device asks for Capture (hotkey, tray). Returns the unsubscribe. A no-op on the web. */
  onCapture(cb: (request: CaptureRequest) => void): () => void

  /**
   * Files dropped anywhere on the window that no component took for itself
   * (an editor or a board that handles its own drop calls `preventDefault`,
   * and is left alone). Returns the unsubscribe. Works on every platform.
   */
  onFilesDropped(cb: (files: File[]) => void): () => void

  /** Where a dropped or picked file lives on disk; null on the web and for files made in memory. */
  pathForFile(file: File): string | null

  /** Show a file in its folder. False when the platform cannot, or the file is gone. */
  revealInFolder(path: string): Promise<boolean>

  /**
   * Connect the learner's Moodle through Moodle's own sign-in. The learner
   * types their password on the university's page, never ours; the app only
   * catches the token Moodle hands back and gives it to the server.
   * Resolves with the server's connection row.
   */
  connectMoodle(siteUrl: string): Promise<unknown>

  /**
   * A live stream of what the computer is playing, audio only, for recording
   * an online lecture. The caller records it and stops its tracks; nothing
   * here plays it.
   */
  captureSystemAudio(): Promise<MediaStream>

  /** Open a web link in the system browser (a new tab on the web). */
  openExternal(url: string): Promise<void>
}

/**
 * `window.bilimind` as the desktop shell's preload exposes it. The canonical
 * copy is desktop/src/shared/contract.ts; this one must match it.
 */
export interface DesktopBridge {
  kind: 'electron'
  os: string
  version: string
  setNextDeadline(next: NextDeadline | null): void
  onCapture(cb: (request: CaptureRequest) => void): () => void
  pathForFile(file: File): string | null
  revealInFolder(path: string): Promise<boolean>
  moodleCapture(request: { siteUrl: string; urls: string[] }): Promise<{ tokenUrl: string }>
  openExternal(url: string): Promise<void>
  shortcut: {
    get(): Promise<{ accelerator: string; registered: boolean }>
    set(accelerator: string): Promise<{ accelerator: string; registered: boolean }>
  }
}

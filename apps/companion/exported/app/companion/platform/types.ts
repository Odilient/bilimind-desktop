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
  /** The learner (or the system's privacy settings) said no: the message says where to change it. */
  | 'denied'

// -- recording: the screen, and recordings kept on this computer --

/** A screen or window the desktop can record, for the app's own picker. */
export interface ScreenSource {
  id: string
  name: string
  kind: 'screen' | 'window'
  /** A data: URL, or null where the system gives no picture. */
  thumbnail: string | null
}

/** A file in a recording's folder on this computer. */
export interface RecordingFile {
  name: string
  size: number
}

/**
 * Recordings written to this computer's disk as they are made, never uploaded
 * (`app/companion/recorder.ts`). Each recording is a folder named by the id
 * of the item it is filed as.
 */
export interface DeviceRecordings {
  /** Append a chunk; call in order and wait for each, or the file is scrambled. */
  append(id: string, name: string, bytes: Uint8Array): Promise<void>
  files(id: string): Promise<RecordingFile[]>
  /** Where the page can load a file from, for a player or `fetch`. */
  url(id: string, name: string): string
  remove(id: string): Promise<void>
}

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
    // recording
    /** Recording a screen or a window, with its sound. Desktop only. */
    screenRecording: boolean
    /** Turning speech into text on this device (Whisper in the app). Desktop only, for now. */
    transcribe: boolean
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

  // -- recording --

  /** What can be recorded: screens, then windows. Rejects with `denied` or `unsupported` and words to show. */
  screenSources(): Promise<ScreenSource[]>

  /**
   * A live stream of the picked screen, at two frames a second, with what the
   * computer plays when `sound`. The caller records it and stops its tracks.
   */
  captureScreen(sourceId: string, sound: boolean): Promise<MediaStream>

  /** The recordings folder on this computer; null where recordings are uploaded instead (the web). */
  readonly recordings: DeviceRecordings | null

  // -- exports --

  /** Save a file made in the app (an export): the browser's download, the desktop's Save dialog. */
  saveFile(blob: Blob, name: string): Promise<void>

  /**
   * The window as a PDF, through its print stylesheet, with no print dialog: the desktop only. Absent
   * elsewhere, where the browser's own print dialog ("Save as PDF") does it.
   */
  printToPdf?(): Promise<Uint8Array>
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
  // recording
  screen: {
    sources(): Promise<ScreenSource[]>
    choose(id: string, sound: boolean): Promise<void>
  }
  recordings: {
    append(id: string, name: string, bytes: Uint8Array): Promise<void>
    files(id: string): Promise<RecordingFile[]>
    remove(id: string): Promise<void>
  }
  // exports: missing from a shell built before it, so the app checks for it
  printToPdf?(): Promise<Uint8Array>
}

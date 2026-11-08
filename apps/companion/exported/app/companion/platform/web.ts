/**
 * The browser: the floor every other platform builds on.
 *
 * No tray, no global hotkey, and Moodle's sign-in cannot be finished here:
 * the token comes back on `moodlemobile://`, which a web page cannot catch
 * (backend/dev/moodle/README.md), so on the web the browser extension is the
 * way in. Dropping files and recording a tab's or the screen's sound work.
 */
import { PlatformError, type Platform } from './types'

function hasFiles(event: DragEvent): boolean {
  return !!event.dataTransfer && Array.from(event.dataTransfer.types).includes('Files')
}

/**
 * Window-level drops, shared by every implementation. Bubble phase, so a
 * component with its own drop zone (the page editor, a board) sees the drop
 * first; when it calls `preventDefault` the drop is its, and left alone.
 */
export function listenForFileDrops(cb: (files: File[]) => void): () => void {
  const over = (event: DragEvent) => {
    if (!hasFiles(event) || event.defaultPrevented) return
    // without this the drop never fires, and the browser opens the file instead
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  }
  const drop = (event: DragEvent) => {
    if (!hasFiles(event) || event.defaultPrevented) return
    event.preventDefault()
    const files = Array.from(event.dataTransfer?.files ?? [])
    if (files.length) cb(files)
  }
  window.addEventListener('dragover', over)
  window.addEventListener('drop', drop)
  return () => {
    window.removeEventListener('dragover', over)
    window.removeEventListener('drop', drop)
  }
}

/** Keep only the sound of a display-media stream, or say why there is none. */
export function audioOnly(stream: MediaStream, why: string): MediaStream {
  for (const track of stream.getVideoTracks()) {
    track.stop()
    stream.removeTrack(track)
  }
  if (!stream.getAudioTracks().length) {
    throw new PlatformError('no-audio', why)
  }
  return stream
}

// -- exports --

/**
 * A made file, saved the browser's way: a link with `download`, clicked.
 * The desktop shell takes the same click and shows its Save dialog (Electron's
 * default for a download nobody handles), so both platforms share this.
 * The address is let go a minute later, not at once: Safari starts the
 * download after the click returns.
 */
export async function downloadFile(blob: Blob, name: string): Promise<void> {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function createWebPlatform(): Platform {
  return {
    kind: 'web',
    can: {
      tray: false,
      hotkey: false,
      moodleSignIn: false,
      systemAudio: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia,
      revealInFolder: false,
      // recording: the web records sound and uploads it; the screen and transcription are the desktop's
      screenRecording: false,
      transcribe: false,
    },

    // recording: a web recording is uploaded when it stops (recording.ts), so there is no folder here
    recordings: null,

    async screenSources() {
      throw new PlatformError('unsupported', 'Recording the screen is in the BiliMind app for your computer.')
    },

    async captureScreen() {
      throw new PlatformError('unsupported', 'Recording the screen is in the BiliMind app for your computer.')
    },

    setNextDeadline() {},

    onCapture() {
      return () => {}
    },

    onFilesDropped: listenForFileDrops,

    pathForFile() {
      return null
    },

    async revealInFolder() {
      return false
    },

    async connectMoodle() {
      throw new PlatformError(
        'unsupported',
        'In the browser, connect Moodle with the BiliMind extension, or use the desktop app.',
      )
    },

    async captureSystemAudio() {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new PlatformError('unsupported', 'This browser cannot record what the computer plays.')
      }
      // Chrome asks which tab or screen to share; "Share audio" must be ticked.
      // `systemAudio` and `selfBrowserSurface` are Chrome-only hints, ignored elsewhere.
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
          systemAudio: 'include',
          selfBrowserSurface: 'exclude',
        } as DisplayMediaStreamOptions)
      } catch {
        throw new PlatformError('cancelled', 'Nothing was shared.')
      }
      return audioOnly(stream, 'That share had no sound. Share the lecture\'s tab with "Share audio" ticked.')
    },

    async openExternal(url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    },

    // exports: no `printToPdf` here; the page opens the print dialog, whose "Save as PDF" does it
    saveFile: downloadFile,
  }
}

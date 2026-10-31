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

export function createWebPlatform(): Platform {
  return {
    kind: 'web',
    can: {
      tray: false,
      hotkey: false,
      moodleSignIn: false,
      systemAudio: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia,
      revealInFolder: false,
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
  }
}

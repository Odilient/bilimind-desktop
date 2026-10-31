/**
 * The desktop app (desktop): the web platform plus what the
 * Electron shell's preload exposes as `window.bilimind` — the tray, the
 * capture hotkey, files on disk, Moodle's own sign-in and system audio.
 *
 * The shell never sees the learner's bearer token: the API calls for the
 * Moodle connection are made here, through `useApi` like every other call,
 * and the shell only opens the university's sign-in window and catches the
 * `moodlemobile://token=…` address it ends on.
 */
import type { useApi } from '~/composables/useApi'
import { audioOnly, listenForFileDrops } from './web'
import { PlatformError, type DesktopBridge, type Platform, type PlatformErrorCode } from './types'

type Api = ReturnType<typeof useApi>

/**
 * `POST /companion/connect/moodle/launch`.
 * `start_urls` come from `MoodleSsoLaunch::startUrls()`: the launch URL, then
 * the login page on sites that sign in inside the app. The passport stays on
 * the server, which checks the token's signature against it on `callback`.
 */
interface MoodleLaunch {
  launch_url: string
  start_urls?: string[]
  site?: { url?: string }
}

const CODES: PlatformErrorCode[] = ['cancelled', 'timeout', 'busy', 'invalid']

/** The shell sends "cancelled: The Moodle sign-in window was closed." — an Error loses any other field over IPC. */
function fromShell(error: unknown): PlatformError {
  const message = String((error as Error)?.message ?? error)
  const match = message.match(/^(\w+): ([\s\S]*)$/)
  const code = match && (CODES as string[]).includes(match[1]!) ? (match[1] as PlatformErrorCode) : 'failed'
  return new PlatformError(code, match && code !== 'failed' ? match[2]! : message)
}

export function createElectronPlatform(bridge: DesktopBridge, api: () => Api): Platform {
  return {
    kind: 'electron',
    can: {
      tray: true,
      hotkey: true,
      moodleSignIn: true,
      systemAudio: true,
      revealInFolder: true,
    },

    setNextDeadline(next) {
      bridge.setNextDeadline(next ? { title: next.title, due_at: next.due_at } : null)
    },

    onCapture(cb) {
      return bridge.onCapture((request) => cb({ mode: request.mode, from: request.from }))
    },

    onFilesDropped: listenForFileDrops,

    pathForFile(file) {
      return bridge.pathForFile(file)
    },

    revealInFolder(path) {
      return bridge.revealInFolder(path)
    },

    async connectMoodle(siteUrl) {
      const launch = await api().post<MoodleLaunch>('/companion/connect/moodle/launch', { site_url: siteUrl })
      const site = launch.site?.url || siteUrl
      const urls = launch.start_urls?.length ? launch.start_urls : [launch.launch_url].filter(Boolean)
      if (!urls.length) throw new PlatformError('failed', 'That Moodle site gave no sign-in page.')

      let tokenUrl: string
      try {
        ;({ tokenUrl } = await bridge.moodleCapture({ siteUrl: site, urls }))
      } catch (error) {
        throw fromShell(error)
      }
      return api().post('/companion/connect/moodle/callback', { site_url: site, token_url: tokenUrl })
    },

    async captureSystemAudio() {
      // The shell answers with this window as the "screen" (no picker, no
      // prompt) and the system mix as the sound; only the sound is kept.
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      } catch {
        throw new PlatformError('unsupported', 'This computer would not share what it plays.')
      }
      return audioOnly(stream, 'This computer gave no sound to record. Record with the microphone instead.')
    },

    async openExternal(url) {
      await bridge.openExternal(url)
    },
  }
}

// What `getDisplayMedia` answers: the computer's sound for an online lecture, or a screen the learner picked.
//
// System audio. The page asks for display media (video is mandatory in that API), and we answer with the page's
// own frame as the video, which needs no picker, no screen-recording portal and no permission prompt, plus
// `audio: 'loopback'`, the system mix. The renderer drops the video track at once and records only the audio
// (platform/electron.ts). Loopback is documented for Windows, and since Electron 39 for macOS through the CoreAudio
// tap, which needs NSAudioCaptureUsageDescription in Info.plist (electron-builder.yml). On Linux it depends on the
// PulseAudio / PipeWire loopback; when it is missing the stream simply has no audio track, which the renderer
// reports. Nothing is played: the stream is only ever read.
//
// The screen. The page lists what can be recorded (`screenSources`, our own small picker
// in the app: Windows has no system picker Electron can show, and one list looks the same everywhere), the learner
// picks one, the page names it here (`chooseScreen`) and then calls `getDisplayMedia`, which this handler answers
// with that source instead of the page's frame. The choice is used once and goes stale after a few seconds, so a
// later system-audio request never records a screen by accident.
//   - macOS: recording the screen needs the learner's permission in System Settings (there is no Info.plist string
//     for it), and macOS only applies it after the app restarts. Until then the list is refused with the words
//     that say where to switch it on.
//   - Linux: on Wayland, `getSources` opens the desktop portal's own picker and comes back with the one screen or
//     window chosen there (the page then skips ours); on X11 it lists them itself. Without PipeWire and the portal
//     it fails, and the page says so.
import { desktopCapturer, session, systemPreferences } from 'electron'
import type { ScreenSource } from '../shared/contract.ts'
import { ORIGIN } from './protocol.ts'

const MAC = process.platform === 'darwin'

const MAC_DENIED =
  'BiliMind isn\'t allowed to record the screen. Turn it on in System Settings › Privacy & Security › Screen & ' +
  'System Audio Recording, then quit BiliMind and open it again.'
const NO_SCREEN = process.platform === 'linux'
  ? 'This computer won\'t share its screen with apps. On Linux that needs PipeWire and the desktop portal, which ' +
    'most current Ubuntu and Fedora desktops have.'
  : 'This computer won\'t share its screen right now. Try again in a moment.'

/** How long a pick stays good for the `getDisplayMedia` call that follows it. */
const CHOICE_TTL = 15_000

/** The sources last listed, by id, so a pick can only be one of them. */
let listed = new Map<string, string>()
let chosen: { id: string; name: string; sound: boolean; at: number } | null = null

/** What can be recorded: screens first, then windows, each with a small picture where the system gives one. */
export async function screenSources(): Promise<ScreenSource[]> {
  // the code travels in the message (an Error loses its other fields across IPC); platform/electron.ts splits it off
  if (MAC && systemPreferences.getMediaAccessStatus('screen') === 'denied') throw new Error(`denied: ${MAC_DENIED}`)
  let sources: Electron.DesktopCapturerSource[]
  try {
    sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 180 } })
  } catch {
    throw new Error(`unsupported: ${NO_SCREEN}`)
  }
  // The first ask shows macOS's own prompt and returns at once; the answer only counts after a restart.
  if (MAC && systemPreferences.getMediaAccessStatus('screen') !== 'granted') throw new Error(`denied: ${MAC_DENIED}`)
  if (!sources.length) throw new Error(`unsupported: ${NO_SCREEN}`)
  listed = new Map(sources.map((s) => [s.id, s.name]))
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.id.startsWith('screen:') ? 'screen' : 'window',
    thumbnail: s.thumbnail.isEmpty() ? null : s.thumbnail.toDataURL(),
  }))
}

/** The page picked a source; its next `getDisplayMedia` records that, with the computer's sound if asked. */
export function chooseScreen(id: unknown, sound: unknown): void {
  const name = typeof id === 'string' ? listed.get(id) : undefined
  if (name === undefined) throw new Error('invalid: Pick the screen again.')
  chosen = { id: id as string, name, sound: sound === true, at: Date.now() }
}

export function allowSystemAudio(): void {
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    // only our own page, and only while its frame is alive
    if (!request.securityOrigin?.startsWith(ORIGIN) || !request.frame) return callback(null)
    const pick = chosen && Date.now() - chosen.at < CHOICE_TTL ? chosen : null
    chosen = null
    if (pick) {
      return callback({
        video: { id: pick.id, name: pick.name },
        ...(pick.sound && request.audioRequested ? { audio: 'loopback' as const } : {}),
      })
    }
    callback(request.audioRequested ? { video: request.frame, audio: 'loopback' } : { video: request.frame })
  }, { useSystemPicker: false })
}

// System audio for online lectures: `getDisplayMedia` answered with the machine's own output (loopback).
//
// The page asks for display media (video is mandatory in that API), and we answer with the page's own frame as
// the video, which needs no picker, no screen-recording portal and no permission prompt, plus `audio: 'loopback'`,
// the system mix. The renderer drops the video track at once and records only the audio (platform/electron.ts).
// Loopback is documented for Windows, and since Electron 39 for macOS through the CoreAudio tap, which needs
// NSAudioCaptureUsageDescription in Info.plist (electron-builder.yml). On Linux it depends on the PulseAudio /
// PipeWire loopback; when it is missing the stream simply has no audio track, which the renderer reports.
// Nothing is played: the stream is only ever read.
import { session } from 'electron'
import { ORIGIN } from './protocol.ts'

export function allowSystemAudio(): void {
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    // only our own page, and only while its frame is alive
    if (!request.securityOrigin?.startsWith(ORIGIN) || !request.frame) return callback(null)
    callback(request.audioRequested ? { video: request.frame, audio: 'loopback' } : { video: request.frame })
  }, { useSystemPicker: false })
}

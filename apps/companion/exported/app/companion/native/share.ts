/**
 * Things shared into BiliMind from other apps: a forwarded group-chat
 * message, a photo of the board, a PDF of the exam timetable.
 *
 * Android delivers them as SEND intents to the main activity; the
 * `ShareIntake` plugin (android/app, Kotlin) copies any files into the app's
 * cache straight away, because the read grant on another app's content:// URI
 * ends with the activity, then hands the result here. A share that launched
 * the app arrives as soon as the first listener attaches (the plugin holds it
 * until then); a share into the running app arrives at once.
 *
 * iOS needs a share extension target first; until then `onShare` is a no-op
 * there, as on the web and the desktop.
 */
import { Capacitor, registerPlugin } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'
import type { CompanionRepo } from '../repo'
import type { Signal } from '../types'

/** A shared file, already copied into the app's cache folder. */
export interface SharedFile {
  name: string
  mime: string
  size: number
  /** Absolute path on the device. */
  path: string
}

/** What the native side sends. */
export interface RawShare {
  id: string
  text: string | null
  subject: string | null
  files: SharedFile[]
  /** Files that could not be read (too big, or the other app withdrew them). */
  skipped: number
  receivedAt: string
}

/** What `onShare` hands the app: text, and files as web `File`s ready for upload. */
export interface IncomingShare {
  id: string
  text: string | null
  subject: string | null
  files: File[]
  skipped: number
  receivedAt: string
}

interface ShareIntakePlugin {
  addListener(event: 'share', cb: (share: RawShare) => void): Promise<PluginListenerHandle>
  /** Deletes the cached copies once the app has the bytes. */
  release(options: { id: string }): Promise<void>
}

const ShareIntake = registerPlugin<ShareIntakePlugin>('ShareIntake')

export function shareAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('ShareIntake')
}

/** Reads a cached shared file into a `File` through the WebView's local server. */
export async function toFile(f: SharedFile): Promise<File> {
  const res = await fetch(Capacitor.convertFileSrc(f.path))
  const blob = await res.blob()
  return new File([blob], f.name, { type: f.mime || blob.type })
}

/**
 * Call once, from the app shell, after the repo is ready. Returns an
 * unsubscribe function. The callback gets each share once.
 *
 * ```ts
 * onShare(async (share) => {
 *   const signals = await ingestShare(repo, share)
 *   // show them: the inbox, or a sheet
 * })
 * ```
 */
export function onShare(cb: (share: IncomingShare) => void | Promise<void>): () => void {
  if (!shareAvailable()) return () => {}
  const handle = ShareIntake.addListener('share', async (raw) => {
    const files: File[] = []
    for (const f of raw.files) {
      try {
        files.push(await toFile(f))
      } catch {
        raw.skipped++
      }
    }
    await cb({ id: raw.id, text: raw.text, subject: raw.subject, files, skipped: raw.skipped, receivedAt: raw.receivedAt })
    void ShareIntake.release({ id: raw.id }).catch(() => {})
  })
  return () => void handle.then((h) => h.remove())
}

/**
 * The default intake: text through the message parser, files through the
 * file parser (a timetable photo, an exam PDF). Returns every signal made.
 * A subject line some apps add ("Shared from Telegram") goes in front of the
 * text only when the text does not already contain it.
 */
export async function ingestShare(
  repo: Pick<CompanionRepo, 'ingestText' | 'ingestFile'>,
  share: IncomingShare,
): Promise<Signal[]> {
  const out: Signal[] = []
  const text = [share.subject && !share.text?.includes(share.subject) ? share.subject : null, share.text]
    .filter((x): x is string => !!x && !!x.trim())
    .join('\n')
  if (text) out.push(...(await repo.ingestText(text, 'share')))
  for (const file of share.files) out.push(...(await repo.ingestFile(file)))
  return out
}

/**
 * Google Drive, with the `drive.file` scope only: the learner picks files in
 * Google's own Picker, and those files (and nothing else in their Drive) are
 * opened to BiliMind. That scope needs no security audit and has no 100-user
 * cap, which is why it's the only one asked for (wave4.md, "Google").
 *
 * Everything Google is done here, in the browser, with the learner's own
 * short-lived token from Google Identity Services: the Picker, the download, the
 * export of a Google Doc, Slides or Sheet. The API never sees a Google
 * credential; it gets the bytes, like any upload, plus where they came from
 * (`importDriveFile`: source `import`, `drive:<fileId>`, the Drive link).
 *
 *   importFromDrive(store, target)   pick, download, file; resolves to the items
 *   googleAvailable()                false: leave every Google entry out
 *   preloadGoogle()                  when a menu offering Drive opens
 *   accessToken()                    the drive.file token, asked for once a tab
 *
 * Where Google can't be offered, nothing says "Drive" at all:
 *  - without NUXT_PUBLIC_GOOGLE_CLIENT_ID / _API_KEY / _APP_ID;
 *  - in the desktop app, served from `app://bilimind`: Google's sign-in only
 *    accepts an http(s) origin registered on the OAuth client, so its window
 *    would open on an error;
 *  - in the phone app: Google refuses sign-in inside an embedded web view
 *    (`disallowed_useragent`), and its pop-up has nowhere to open there.
 *  A phone's browser is a browser, so it gets Drive like a laptop does.
 *
 * Folders: a folder can be picked, and what `drive.file` lets us list inside it
 * comes in (one level). Google's docs don't promise that picking a folder opens
 * its files, so an empty answer is said plainly: open it and pick the files.
 */
import { Capacitor } from '@capacitor/core'
import { ref } from 'vue'
import { fileTarget, type FileTarget, MY_NOTES } from '../capture'
import { isDesktopApp } from '../platform'
import type { CompanionStore } from '../store'
import type { Item } from '../types'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const GAPI_SRC = 'https://apis.google.com/js/api.js'
const FILES = 'https://www.googleapis.com/drive/v3/files'
const FOLDER = 'application/vnd.google-apps.folder'
/** The API's own limit on an upload (ItemController::MAX_UPLOAD_KB). */
const MAX_BYTES = 51_200 * 1024

/**
 * Google's own formats have no file to download, only exports. PDF keeps a
 * document's layout and is read page by page (and a deck slide by slide) by the
 * server's FileText. shortcut: a Sheet comes in as CSV, its first tab only; send
 * XLSX once the server reads spreadsheets.
 */
const EXPORTS: Record<string, { mime: string; ext: string }> = {
  'application/vnd.google-apps.document': { mime: 'application/pdf', ext: 'pdf' },
  'application/vnd.google-apps.presentation': { mime: 'application/pdf', ext: 'pdf' },
  'application/vnd.google-apps.drawing': { mime: 'application/pdf', ext: 'pdf' },
  'application/vnd.google-apps.spreadsheet': { mime: 'text/csv', ext: 'csv' },
}

/* -- The little of Google's globals this uses ------------------------------------ */

interface TokenResponse {
  access_token?: string
  expires_in?: number | string
  error?: string
}

interface DocsView {
  setIncludeFolders(on: boolean): DocsView
  setSelectFolderEnabled(on: boolean): DocsView
  setMode(mode: string): DocsView
}

interface PickedDoc {
  id: string
  name: string
  mimeType: string
  url?: string
  sizeBytes?: number
}

interface PickerBuilder {
  addView(view: DocsView): PickerBuilder
  enableFeature(feature: string): PickerBuilder
  setOAuthToken(token: string): PickerBuilder
  setDeveloperKey(key: string): PickerBuilder
  setAppId(id: string): PickerBuilder
  setOrigin(origin: string): PickerBuilder
  setCallback(cb: (data: { action: string; docs?: PickedDoc[] }) => void): PickerBuilder
  build(): { setVisible(on: boolean): void }
}

interface GoogleGlobal {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string
        scope: string
        callback: (response: TokenResponse) => void
        error_callback?: (error: { type: string }) => void
      }): { requestAccessToken(options?: { prompt?: string }): void }
      hasGrantedAllScopes(response: TokenResponse, scope: string): boolean
    }
  }
  picker: {
    PickerBuilder: new () => PickerBuilder
    DocsView: new (viewId?: string) => DocsView
    ViewId: { DOCS: string }
    DocsViewMode: { LIST: string }
    Feature: { MULTISELECT_ENABLED: string }
    Action: { PICKED: string; CANCEL: string }
  }
}

function google(): GoogleGlobal {
  return (window as unknown as { google: GoogleGlobal }).google
}

/* -- Whether, and with what ------------------------------------------------------ */

function googleKeys(): { clientId: string; apiKey: string; appId: string } {
  const p = useRuntimeConfig().public
  return {
    clientId: String(p.googleClientId ?? ''),
    apiKey: String(p.googleApiKey ?? ''),
    appId: String(p.googleAppId ?? ''),
  }
}

export function googleAvailable(): boolean {
  if (!import.meta.client) return false
  const keys = googleKeys()
  if (!keys.clientId || !keys.apiKey || !keys.appId) return false
  return !isDesktopApp() && !Capacitor.isNativePlatform()
}

/** Why it stopped, in the few ways the learner can do something about. */
export class GoogleError extends Error {
  constructor(public readonly reason: 'cancelled' | 'blocked' | 'refused' | 'offline' | 'failed') {
    super(reason)
    this.name = 'GoogleError'
  }
}

/** One toast per way it can go wrong; a closed window is the learner's own "no". */
export function reportGoogleError(error: unknown): void {
  const reason = error instanceof GoogleError ? error.reason : 'failed'
  const toast = useToast()
  if (reason === 'cancelled') return
  const words = {
    blocked: { title: 'The Google window was blocked', body: 'Allow pop-ups for this site, then try again.' },
    refused: { title: 'Google said no', body: 'BiliMind needs your OK to open the files you pick.' },
    offline: { title: "Google didn't load", body: 'Check the connection and try again.' },
    failed: { title: "That didn't work", body: 'Google answered with an error. Try again in a moment.' },
  }
  toast.error(words[reason])
}

/* -- Loading Google's scripts, once ---------------------------------------------- */

const scripts = new Map<string, Promise<void>>()

function script(src: string): Promise<void> {
  let loading = scripts.get(src)
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const el = document.createElement('script')
      el.src = src
      el.async = true
      el.onload = () => resolve()
      el.onerror = () => {
        // A failed load is tried again next time, not remembered.
        scripts.delete(src)
        el.remove()
        reject(new GoogleError('offline'))
      }
      document.head.appendChild(el)
    })
    scripts.set(src, loading)
  }
  return loading
}

/**
 * Fetch Google's two scripts ahead of the press, when a menu offering Drive opens.
 * Safari only lets a window open close to the tap that asked for it, and a
 * script still loading at that moment can use up the time.
 */
export function preloadGoogle(): void {
  if (!googleAvailable()) return
  void script(GIS_SRC).catch(() => undefined)
  void script(GAPI_SRC).catch(() => undefined)
}

/* -- The token -------------------------------------------------------------------- */

/** In memory only, for this tab: an hour of Google's, never written anywhere. */
let held: { token: string; until: number } | null = null

/**
 * The `drive.file` token. Google's window opens from here, so call it first
 * thing inside the learner's press (before any other await), or a browser may
 * take the window for a pop-up nobody asked for.
 */
export async function accessToken(): Promise<string> {
  if (held && held.until > Date.now() + 60_000) return held.token
  await script(GIS_SRC)
  const oauth = google().accounts.oauth2
  return new Promise<string>((resolve, reject) => {
    const client = oauth.initTokenClient({
      client_id: googleKeys().clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token || !oauth.hasGrantedAllScopes(response, DRIVE_SCOPE)) {
          reject(new GoogleError(response.error === 'access_denied' || !response.error ? 'refused' : 'failed'))
          return
        }
        held = { token: response.access_token, until: Date.now() + Number(response.expires_in ?? 3600) * 1000 }
        resolve(response.access_token)
      },
      error_callback: (error) =>
        reject(new GoogleError(error.type === 'popup_failed_to_open' ? 'blocked' : 'cancelled')),
    })
    client.requestAccessToken({ prompt: '' })
  })
}

/** A call to Drive with the token; a 401 forgets it, so the next press asks again. */
export async function driveFetch(
  url: string,
  init: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> } = {},
): Promise<Response> {
  const token = await accessToken()
  let res: Response
  try {
    res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } })
  } catch {
    throw new GoogleError('offline')
  }
  if (res.status === 401) held = null
  return res
}

/* -- Picking ---------------------------------------------------------------------- */

async function pick(token: string): Promise<PickedDoc[]> {
  await script(GAPI_SRC)
  const gapi = (window as unknown as { gapi: { load(lib: string, done: () => void): void } }).gapi
  await new Promise<void>((resolve) => gapi.load('picker', resolve))
  const { picker } = google()
  const keys = googleKeys()
  // List mode: under drive.file Google shows no thumbnails, so a grid would be empty squares.
  const view = new picker.DocsView(picker.ViewId.DOCS)
    .setIncludeFolders(true)
    .setSelectFolderEnabled(true)
    .setMode(picker.DocsViewMode.LIST)
  return new Promise<PickedDoc[]>((resolve) => {
    new picker.PickerBuilder()
      .addView(view)
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(token)
      .setDeveloperKey(keys.apiKey)
      .setAppId(keys.appId)
      .setOrigin(window.location.origin)
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED) resolve(data.docs ?? [])
        else if (data.action === picker.Action.CANCEL) resolve([])
      })
      .build()
      .setVisible(true)
  })
}

/**
 * A picked folder's files, one level down: what drive.file lets us see of it.
 * shortcut: the first 100 only and no subfolders; page and recurse if a real
 * class folder ever needs it.
 */
async function inside(folder: PickedDoc): Promise<PickedDoc[]> {
  const q = encodeURIComponent(`'${folder.id}' in parents and trashed = false`)
  const fields = encodeURIComponent('files(id,name,mimeType,webViewLink,size)')
  const res = await driveFetch(
    `${FILES}?q=${q}&fields=${fields}&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`,
  )
  if (!res.ok) return []
  type Listed = { id: string; name: string; mimeType: string; webViewLink?: string; size?: string }
  const body = (await res.json()) as { files?: Listed[] }
  return (body.files ?? [])
    .filter((f) => f.mimeType !== FOLDER)
    .map((f) => ({ ...f, url: f.webViewLink, sizeBytes: Number(f.size ?? 0) }))
}

/** The bytes of one file: its own, or its export. Null for what has neither (a Form, a Site). */
async function download(doc: PickedDoc): Promise<File | null> {
  const exported = EXPORTS[doc.mimeType]
  if (!exported && doc.mimeType.startsWith('application/vnd.google-apps.')) return null
  const res = await driveFetch(
    exported
      ? `${FILES}/${doc.id}/export?mimeType=${encodeURIComponent(exported.mime)}`
      : `${FILES}/${doc.id}?alt=media&supportsAllDrives=true`,
  )
  if (!res.ok) throw new GoogleError('failed')
  const blob = await res.blob()
  return exported
    ? new File([blob], `${doc.name}.${exported.ext}`, { type: exported.mime })
    : new File([blob], doc.name, { type: doc.mimeType || blob.type })
}

/* -- Bringing it in --------------------------------------------------------------- */

/** One import at a time, shared: two "+"s pressed together don't open two Pickers. */
export const driveBusy = ref(false)

/**
 * Pick in Drive and file what was picked: in the course and class the button
 * named (`target`, not a guess), otherwise in My notes with the class on now or
 * the course given as a guess kept as the suggestion, for the Inbox to offer.
 * A file brought in before is not brought again; its item comes back as it is.
 * Resolves to every item picked (new or already here), for the chat to attach.
 */
export async function importFromDrive(store: CompanionStore, target: FileTarget | null = null): Promise<Item[]> {
  if (driveBusy.value) return []
  const toast = useToast()
  const filed = target?.subject && !target.guess ? target : MY_NOTES
  const guess = filed === MY_NOTES ? (target?.guess ? target : fileTarget(store)) : null
  driveBusy.value = true
  let waiting: number | null = null
  try {
    const picked = await pick(await accessToken())
    if (!picked.length) return []

    const folders = picked.filter((d) => d.mimeType === FOLDER)
    const within = (await Promise.all(folders.map(inside))).flat()
    const docs = [...picked.filter((d) => d.mimeType !== FOLDER), ...within]
    if (!docs.length) {
      toast.info({
        title: 'Nothing came in from that folder',
        body: 'Open the folder in the Drive window and pick the files inside it.',
      })
      return []
    }

    const what = docs.length === 1 ? docs[0]!.name : `${docs.length} files`
    waiting = toast.push({ title: `Bringing in ${what} from Drive…`, duration: 0 })
    const items: Item[] = []
    const added: Item[] = []
    const missed: string[] = []
    for (const doc of docs) {
      const here = store.items.value.find((i) => !i.deleted_at && i.source_ref === `drive:${doc.id}`)
      if (here) {
        items.push(here)
        continue
      }
      try {
        if ((doc.sizeBytes ?? 0) > MAX_BYTES) throw new GoogleError('failed')
        const file = await download(doc)
        if (!file) throw new GoogleError('failed')
        const item = await store.repo().importDriveFile(file, {
          drive_id: doc.id,
          url: doc.url ?? null,
          subject_id: filed.subject?.id,
          session_id: filed.session?.id,
          suggested_subject_id: guess?.subject?.id,
        })
        store.rows.items[item.id] = item
        items.push(item)
        added.push(item)
      } catch {
        missed.push(doc.name)
      }
    }

    if (added.length) {
      toast.success({
        title: `Saved to ${filed.label}`,
        body: added.length === 1 ? added[0]!.title : `${added.length} files from Drive`,
      })
    } else if (items.length) {
      toast.info({
        title: 'Already here',
        body: items.length === 1 ? items[0]!.title : `All ${items.length} were brought in before.`,
      })
    }
    if (missed.length) {
      toast.error({
        title: missed.length === 1 ? `${missed[0]} didn't come in` : `${missed.length} files didn't come in`,
        body: 'It may be too big or a kind BiliMind can’t open. Try downloading it and uploading it here.',
      })
    }
    return items
  } catch (error) {
    reportGoogleError(error)
    return []
  } finally {
    if (waiting !== null) toast.dismiss(waiting)
    driveBusy.value = false
  }
}

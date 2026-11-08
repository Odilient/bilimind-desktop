/**
 * "Save to Google Docs" on a page: the page as DOCX (the exports' own
 * `pageToDocx`, so a Doc and a downloaded .docx are the same document), uploaded
 * with the learner's `drive.file` token and converted by Drive into a Google Doc
 * they own. The Doc's id and link are kept on the page (`meta.google_doc`), so
 * the next save replaces that Doc's contents instead of making a second one, and
 * the menu can offer "Open in Google Docs".
 *
 * One way only: an edit made in Google Docs stays there. A Doc the learner
 * deleted or put in the bin is not written into; a new one is made.
 *
 * shortcut: a multipart upload is meant for files up to 5 MB, which a page's
 * DOCX is unless it carries many large images; switch to a resumable upload if
 * a real page ever goes past it.
 */
import { ref } from 'vue'
import { pageToDocx } from '../export/docx'
import { useCompanion } from '../store'
import type { Item } from '../types'
import { accessToken, driveFetch, GoogleError, googleAvailable, reportGoogleError } from './drive'

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'

type GoogleDoc = NonNullable<Item['meta']['google_doc']>

const saving = ref(false)

/** A page's Google entries for its "⋯" menus; none where Google isn't offered. */
export function googleDocsActions(item: Item): { label: string; icon: string; run: () => void }[] {
  if (item.kind !== 'page' || !googleAvailable()) return []
  const doc = item.meta.google_doc
  const save = {
    label: doc ? 'Update in Google Docs' : 'Save to Google Docs',
    icon: 'upload',
    run: () => void saveToGoogleDocs(item),
  }
  if (!doc) return [save]
  const open = () => void window.open(doc.url, '_blank', 'noopener')
  return [{ label: 'Open in Google Docs', icon: 'external', run: open }, save]
}

export async function saveToGoogleDocs(item: Item): Promise<void> {
  if (saving.value) return
  const store = useCompanion()
  const toast = useToast()
  saving.value = true
  const waiting = toast.push({ title: 'Saving to Google Docs…', duration: 0 })
  try {
    // The token first: Google's window has to open close to the press.
    await accessToken()
    const docx = await pageToDocx(item)
    const name = item.title.trim() || 'Untitled'
    // The row as it is now, not as the menu saw it: a save a moment ago set the Doc.
    const before = (store.get('items', item.id) ?? item).meta.google_doc
    const doc = (before && (await replace(before.id, docx))) || (await create(name, docx))
    const fresh = store.get('items', item.id) ?? item
    await store.upsert<Item>('items', { id: item.id, meta: { ...fresh.meta, google_doc: doc } })
    toast.success({
      title: before ? 'Google Doc updated' : 'Saved to Google Docs',
      body: name,
      action: { label: 'Open', handler: () => void window.open(doc.url, '_blank', 'noopener') },
    })
  } catch (error) {
    // Only Google's calls throw GoogleError; anything else is the page's own Word file failing.
    if (error instanceof GoogleError) reportGoogleError(error)
    else toast.error({ title: "Couldn't make the page into a document", body: 'Try again in a moment.' })
  } finally {
    toast.dismiss(waiting)
    saving.value = false
  }
}

/** A new Google Doc from the DOCX, converted by naming the Docs type in the metadata. */
async function create(name: string, docx: Blob): Promise<GoogleDoc> {
  const boundary = `bilimind${crypto.randomUUID()}`
  const metadata = JSON.stringify({ name, mimeType: 'application/vnd.google-apps.document' })
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: ${DOCX}\r\n\r\n`,
    docx,
    `\r\n--${boundary}--`,
  ])
  const res = await driveFetch(`${UPLOAD}?uploadType=multipart&fields=id,webViewLink`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  if (!res.ok) throw new GoogleError('failed')
  const made = (await res.json()) as { id: string; webViewLink: string }
  return { id: made.id, url: made.webViewLink }
}

/**
 * The Doc made last time, its whole content replaced (Drive converts on update).
 * Null when it's gone or in the bin, so the caller makes a new one.
 */
async function replace(id: string, docx: Blob): Promise<GoogleDoc | null> {
  const res = await driveFetch(`${UPLOAD}/${id}?uploadType=media&fields=id,webViewLink,trashed`, {
    method: 'PATCH',
    headers: { 'Content-Type': DOCX },
    body: docx,
  })
  if (res.status === 404) return null
  if (!res.ok) throw new GoogleError('failed')
  const saved = (await res.json()) as { id: string; webViewLink: string; trashed?: boolean }
  return saved.trashed ? null : { id: saved.id, url: saved.webViewLink }
}

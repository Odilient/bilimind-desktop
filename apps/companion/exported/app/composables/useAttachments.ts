import type { Attachment, MaybeWrapped } from '~/types/api'
import { ApiError, AUTH_COOKIE, authCookieOptions, toApiError, unwrap } from '~/composables/useApi'
import { materialBytes, useMaterialQuota } from '~/composables/useMaterialQuota'

/**
 * ATTACH — the owner's files beside one lesson, and every way they change.
 *
 * The list is seeded from the lesson payload rather than fetched, because
 * `GET /api/nodes/{id}` already carries `attachments` and a second request for
 * the same rows would only make the section arrive a beat after the lesson it
 * belongs to. It stays a LOCAL copy on purpose: every change below is applied
 * here first and to the server second, so a caption reads as saved the moment
 * Enter is pressed and only comes back if the server disagrees.
 *
 * Uploads go through `XMLHttpRequest`, not `$fetch`. That is the one thing
 * `useApi` cannot do: `fetch` has no upload progress, and a 40 MB video sent
 * with nothing moving on screen is indistinguishable from a page that has
 * hung. Everything else — the bearer token, the `{ data }` envelope, the error
 * shape — is borrowed from `useApi` so the two paths cannot drift.
 *
 * Files are sent one after another rather than all at once. Four parallel
 * uploads on a phone's connection all crawl and all fail together; four in a
 * row give the person one bar to watch and three files that arrive.
 */

/** One file on its way up. Gone the moment it lands; kept, with `error`, when it does not. */
export interface AttachmentUpload {
  id: number
  name: string
  percent: number
  error: string | null
}

export interface UseAttachmentsOptions {
  /**
   * Called after every change that succeeded, with the list as it now stands.
   * A callback rather than a watcher because the parent hands the list back
   * as a prop, and a watcher that emitted on every replacement would ping-pong
   * between the two copies forever.
   */
  onChange?: (attachments: Attachment[]) => void
}

/** Mirrors `AttachmentStore::EXTENSION_MIMES`, so the file dialog offers only what the server keeps. */
export const ATTACHMENT_ACCEPT =
  '.png,.jpg,.jpeg,.gif,.webp,.pdf,.mp3,.m4a,.mp4,.m4v,.webm,.ogg,.oga,.wav,'
  + '.docx,.pptx,.xlsx,.txt,.md,.markdown,.csv,.zip'

function byPosition(list: Attachment[]): Attachment[] {
  return [...list].sort((a, b) => a.position - b.position || a.uuid.localeCompare(b.uuid))
}

/** What "the same list" means when the parent hands ours back to us. */
function signature(list: Attachment[]): string {
  return list.map((row) => `${row.uuid}:${row.position}:${row.caption ?? ''}`).join('|')
}

function renumber(list: Attachment[]): Attachment[] {
  return list.map((row, index) => (row.position === index ? row : { ...row, position: index }))
}

export function useAttachments(
  nodeId: MaybeRefOrGetter<number>,
  initial: Ref<Attachment[]>,
  options: UseAttachmentsOptions = {},
) {
  const api = useApi()
  const toast = useToast()
  const token = useCookie<string | null>(AUTH_COOKIE, authCookieOptions())
  const quota = useMaterialQuota()

  const attachments = ref<Attachment[]>(byPosition(initial.value))
  const uploading = ref<AttachmentUpload[]>([])
  let uploadId = 0

  /*
   * The parent's copy wins whenever it genuinely differs — a lesson reloaded,
   * a tab switched — and is ignored when it is our own change coming back
   * round as a prop.
   */
  watch(initial, (value) => {
    const incoming = byPosition(value)
    if (signature(incoming) !== signature(attachments.value)) attachments.value = incoming
  })

  function commit(next: Attachment[]): void {
    attachments.value = next
    options.onChange?.(next)
  }

  function path(): string {
    return `/nodes/${toValue(nodeId)}/attachments`
  }

  /* -- The size ceiling ---------------------------------------------------- */

  /**
   * The plan's per-file limit, read once and shared with the materials drop
   * bar through `useMaterialQuota`'s state. A ceiling we could not read must
   * never block a file: the server refuses for itself, and this is only the
   * refusal that arrives before the bytes are sent instead of after.
   */
  async function maxBytes(): Promise<number> {
    if (quota.quota.value === null) await quota.load()
    return quota.maxUploadBytes.value
  }

  /* -- Uploading ----------------------------------------------------------- */

  function messageFor(cause: unknown, fallback: string): string {
    if (cause instanceof ApiError) return cause.allMessages[0] ?? cause.message
    return cause instanceof Error ? cause.message : fallback
  }

  function parseBody(text: string): unknown {
    if (!text) return null
    try {
      return JSON.parse(text) as unknown
    } catch {
      return null
    }
  }

  /**
   * One multipart POST with a progress bar. Resolves to the attachment the
   * server created, rejects with the same `ApiError` `useApi` would have thrown.
   */
  function send(
    file: File,
    caption: string | null,
    onProgress: (percent: number) => void,
  ): Promise<Attachment> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', api.url(path()))
      xhr.setRequestHeader('Accept', 'application/json')
      if (token.value) xhr.setRequestHeader('Authorization', `Bearer ${token.value}`)

      xhr.upload.addEventListener('progress', (event) => {
        if (!event.lengthComputable || event.total === 0) return
        // Never 100 from here: the last percent is the server writing the file,
        // and a full bar that then waits reads as stuck.
        onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
      })

      xhr.addEventListener('load', () => {
        const body = parseBody(xhr.responseText)

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(unwrap<Attachment>(body as MaybeWrapped<Attachment>))
          return
        }

        // A proxy's 413 arrives as HTML with no message of its own, so it gets
        // one here; anything the app itself refused already says why.
        const fallback =
          xhr.status === 413 ? { message: 'That file is too large to send.' } : null

        reject(toApiError({ status: xhr.status, data: body ?? fallback }))
      })

      xhr.addEventListener('error', () => reject(toApiError({ status: 0 })))
      xhr.addEventListener('abort', () => reject(new ApiError('Upload cancelled.', 0)))

      const form = new FormData()
      form.append('file', file)
      if (caption) form.append('caption', caption)
      xhr.send(form)
    })
  }

  function setUpload(id: number, patch: Partial<AttachmentUpload>): void {
    uploading.value = uploading.value.map((row) => (row.id === id ? { ...row, ...patch } : row))
  }

  /** Drop a finished or failed row from the upload list. */
  function dismiss(id: number): void {
    uploading.value = uploading.value.filter((row) => row.id !== id)
  }

  /**
   * Send each file in turn. A file over the ceiling is turned away before it
   * is sent, in a toast, and the rest still go; a file the server refuses
   * stays in the list with its reason until it is dismissed, because a file
   * that vanished on the way up is the one thing nobody should have to notice
   * for themselves.
   */
  async function upload(files: File[]): Promise<void> {
    if (files.length === 0) return

    const ceiling = await maxBytes()

    for (const file of files) {
      if (ceiling > 0 && file.size > ceiling) {
        toast.warn({
          title: `${file.name} is larger than ${materialBytes(ceiling)}`,
          body: 'Files attached to a lesson have the same size limit as your materials.',
        })
        continue
      }

      const id = (uploadId += 1)
      uploading.value = [...uploading.value, { id, name: file.name, percent: 0, error: null }]

      try {
        const created = await send(file, null, (percent) => setUpload(id, { percent }))
        dismiss(id)
        commit(renumber([...attachments.value, created]))
      } catch (cause) {
        setUpload(id, { error: messageFor(cause, 'That upload did not go through.') })
        // The storage meter is shared with the materials page; a 402 means it
        // moved under us.
        if (cause instanceof ApiError && cause.status === 402) void quota.load()
      }
    }
  }

  /* -- Changing one -------------------------------------------------------- */

  /** An empty caption clears it: the server stores null, never "". */
  async function setCaption(uuid: string, caption: string | null): Promise<void> {
    const before = attachments.value
    const clean = caption?.trim() || null
    const current = before.find((row) => row.uuid === uuid)

    if (!current || (current.caption ?? null) === clean) return

    commit(before.map((row) => (row.uuid === uuid ? { ...row, caption: clean } : row)))

    try {
      const saved = await api.patch<Attachment>(`/attachments/${uuid}`, { caption: clean })
      commit(attachments.value.map((row) => (row.uuid === uuid ? { ...row, ...saved } : row)))
    } catch (cause) {
      commit(before)
      toast.error(messageFor(cause, 'That caption could not be saved.'))
    }
  }

  async function remove(uuid: string): Promise<void> {
    const before = attachments.value
    if (!before.some((row) => row.uuid === uuid)) return

    commit(renumber(before.filter((row) => row.uuid !== uuid)))

    try {
      await api.del(`/attachments/${uuid}`)
      // Bytes came back; the meter should say so before the next upload.
      void quota.load()
    } catch (cause) {
      commit(before)
      toast.error(messageFor(cause, 'That file could not be removed.'))
    }
  }

  /**
   * Put one attachment at `toIndex` and renumber the rest, exactly as the
   * server will. The PATCH answers with the one row that moved, so the local
   * renumbering is what keeps the others honest until the next reload.
   */
  async function reorder(uuid: string, toIndex: number): Promise<void> {
    const before = attachments.value
    const from = before.findIndex((row) => row.uuid === uuid)
    const to = Math.max(0, Math.min(toIndex, before.length - 1))

    if (from === -1 || from === to) return

    const moved = [...before]
    const [row] = moved.splice(from, 1)
    moved.splice(to, 0, row!)
    commit(renumber(moved))

    try {
      await api.patch<Attachment>(`/attachments/${uuid}`, { position: to })
    } catch (cause) {
      commit(before)
      toast.error(messageFor(cause, 'That file could not be moved.'))
    }
  }

  /** The list as the server has it, for when a doubt is cheaper to settle than to reason about. */
  async function refresh(): Promise<void> {
    try {
      commit(byPosition(await api.get<Attachment[]>(path())))
    } catch (cause) {
      toast.error(messageFor(cause, 'The attached files could not be reloaded.'))
    }
  }

  return {
    attachments: readonly(attachments) as Readonly<Ref<Attachment[]>>,
    uploading: readonly(uploading) as Readonly<Ref<AttachmentUpload[]>>,
    upload,
    dismiss,
    setCaption,
    remove,
    reorder,
    refresh,
  }
}

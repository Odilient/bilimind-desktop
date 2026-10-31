import { toApiError, apiBaseUrl, AUTH_COOKIE, authCookieOptions } from '~/composables/useApi'

/**
 * Made-for-you artifacts — the rendered pages, PDFs and notes the assistant
 * produces alongside an answer (`GET /artifacts/{id}`, `GET /artifacts/{id}/raw`).
 *
 * The raw endpoint is fetched through `$fetch` (not dropped straight into an
 * `<iframe src>`) so the content rides the same request pipeline as every other
 * call — any auth the client attaches applies here too — and so an HTML artifact
 * can be handed to a sandboxed `srcdoc` and a PDF to a blob URL, both isolated
 * from the app.
 */

export type ArtifactKind = 'html' | 'pdf' | 'markdown'

export interface Artifact {
  id: number
  kind: ArtifactKind
  title: string
  url?: string
  created_at?: string
}

/** A loaded artifact body, in whichever form its kind renders from. */
export interface ArtifactContent {
  /** HTML / Markdown source, ready for `srcdoc` or a Markdown renderer. */
  text?: string
  /** Object URL for a PDF blob — revoke it when done. */
  objectUrl?: string
  /** Releases the object URL, if any. Safe to call more than once. */
  revoke(): void
}

function base(): string {
  return apiBaseUrl()
}

function join(path: string): string {
  const root = base().replace(/\/+$/, '')
  return `${root}/${path.replace(/^\/+/, '')}`
}

export function useArtifacts() {
  const api = useApi()

  // The /raw endpoint sits behind auth:sanctum like everything else, but a bare
  // `$fetch` does NOT carry the bearer token `useApi` injects — so attach it
  // here (read the cookie ref once, in setup; its value is read later in load()).
  const tokenCookie = useCookie<string | null>(AUTH_COOKIE, authCookieOptions())
  const authHeaders = (accept: string): Record<string, string> =>
    tokenCookie.value
      ? { Accept: accept, Authorization: `Bearer ${tokenCookie.value}` }
      : { Accept: accept }

  /** The raw URL, for an "open in a new tab" link. */
  function rawUrl(id: number): string {
    return join(`artifacts/${id}/raw`)
  }

  /** Metadata only — title, kind, url. */
  function get(id: number): Promise<Artifact> {
    return api.get<Artifact>(`/artifacts/${id}`)
  }

  /**
   * Fetch the body in the shape its kind renders from. HTML and Markdown come
   * back as text (for `srcdoc` / a Markdown renderer); a PDF comes back as a
   * blob wrapped in an object URL the caller revokes on teardown.
   */
  async function load(id: number, kind: ArtifactKind): Promise<ArtifactContent> {
    try {
      if (kind === 'pdf') {
        const blob = await $fetch<Blob>(rawUrl(id), {
          responseType: 'blob',
          headers: authHeaders('application/pdf'),
          retry: 0,
        })
        const objectUrl = URL.createObjectURL(blob)
        let revoked = false
        return {
          objectUrl,
          revoke() {
            if (revoked) return
            revoked = true
            URL.revokeObjectURL(objectUrl)
          },
        }
      }

      const text = await $fetch<string>(rawUrl(id), {
        responseType: 'text',
        headers: authHeaders(kind === 'markdown' ? 'text/markdown, text/plain' : 'text/html'),
        retry: 0,
      })
      return { text, revoke() {} }
    } catch (error) {
      throw toApiError(error)
    }
  }

  return { rawUrl, get, load }
}

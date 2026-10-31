// app://bilimind/: the companion SPA served from disk, and its API from `api/handler.ts` on the same origin.
//
// A privileged standard scheme rather than file://, because the SPA is built for an origin root: its assets are
// absolute (`/_nuxt/…`), its router needs real paths (`/app/courses/42`), and localStorage, IndexedDB, fetch and
// code caching all want a proper origin. Unknown paths fall back to `200.html`, the shell `nuxt generate` writes for
// client-side routes; a missing *asset* is a 404, never the shell, so a stale chunk fails loudly instead of being
// parsed as HTML.
//
// Cookies do NOT work on this origin (`document.cookie` stays empty on a standard secure custom scheme), so the
// preload installs a small cookie store for the page instead; see preload.ts.
import { protocol } from 'electron'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, relative, resolve, isAbsolute } from 'node:path'

export const SCHEME = 'app'
export const HOST = 'bilimind'
export const ORIGIN = `${SCHEME}://${HOST}`

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  // instantiateStreaming refuses anything else
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
}

/** Must run before `app.ready`. */
export function registerScheme(): void {
  protocol.registerSchemesAsPrivileged([{
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, codeCache: true, stream: true },
  }])
}

/**
 * Origins the page may talk to beyond its own, read from the SPA's baked runtime config. The API is this origin, so
 * normally none. Each http(s) origin also allows its ws(s) twin.
 */
export function connectOrigins(shellHtml: string, extra: string[] = []): string[] {
  const config = shellHtml.match(/window\.__NUXT__\.config=(\{[\s\S]*?\})<\/script>/)?.[1] ?? ''
  const found = new Set<string>()
  for (const [url] of config.matchAll(/(?:https?|wss?):\/\/[^"'\s,}]+/g)) {
    try {
      const u = new URL(url)
      found.add(u.origin)
      if (u.protocol === 'http:' || u.protocol === 'https:') found.add(u.origin.replace(/^http/, 'ws'))
    } catch { /* not a URL */ }
  }
  for (const o of extra) if (o) found.add(o)
  return [...found]
}

/**
 * The page's policy. Inline scripts are allowed by hash only (the shell carries three: the import map, the
 * `has-js` flag and the runtime config), never 'unsafe-inline'. Styles keep 'unsafe-inline' because Vue, TipTap
 * and the board engine all set inline styles. Images may come from any https host (a pasted link's picture);
 * everything else stays on this origin and the configured API.
 */
export function contentSecurityPolicy(html: string, connect: string[]): string {
  const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs, body]) => body?.trim() && !/\bsrc=/i.test(attrs!) && !/type=["']?application\/(?:ld\+)?json/i.test(attrs!))
    .map(([, , body]) => `'sha256-${createHash('sha256').update(body!).digest('base64')}'`)
  const api = connect.join(' ')
  return [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https: ${api}`.trim(),
    "font-src 'self' data:",
    `media-src 'self' data: blob: ${api}`.trim(),
    `connect-src 'self' data: blob: ${api}`.trim(),
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

/** The file under `root` for a request path, or null when the path escapes it. */
export function resolveInside(root: string, pathname: string): string | null {
  let decoded: string
  try { decoded = decodeURIComponent(pathname) } catch { return null }
  if (decoded.includes('\0')) return null
  const file = resolve(root, '.' + (decoded.startsWith('/') ? decoded : '/' + decoded))
  const rel = relative(root, file)
  if (rel.startsWith('..') || isAbsolute(rel)) return null
  return file
}

async function isFile(p: string): Promise<boolean> {
  try { return (await stat(p)).isFile() } catch { return false }
}

export function serveSpa(root: string, api: (request: Request) => Promise<Response>, extraConnect: string[] = []): void {
  // The shell is read once per HTML response (it is tiny); the CSP is derived from it each time so a rebuilt SPA
  // in dev never runs under a stale hash.
  async function html(file: string): Promise<Response> {
    const body = await readFile(file, 'utf8')
    const csp = contentSecurityPolicy(body, connectOrigins(body, extraConnect))
    return new Response(body, {
      headers: {
        'content-type': MIME['.html']!,
        'content-security-policy': csp,
        'cache-control': 'no-cache',
        'x-content-type-options': 'nosniff',
      },
    })
  }

  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url)
    if (url.host !== HOST) return new Response('Not found', { status: 404 })
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return api(request)
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 })

    const file = resolveInside(root, url.pathname)
    if (!file) return new Response('Not found', { status: 404 })
    const ext = extname(file).toLowerCase()

    if (await isFile(file)) {
      if (ext === '.html') return html(file)
      const body = await readFile(file)
      return new Response(body, {
        headers: {
          'content-type': MIME[ext] ?? 'application/octet-stream',
          // hashed build assets never change under the same name
          'cache-control': url.pathname.startsWith('/_nuxt/') ? 'public, max-age=31536000, immutable' : 'no-cache',
          'x-content-type-options': 'nosniff',
        },
      })
    }
    // `/app/courses/42` is a route; `/_nuxt/gone.js` is a missing file
    if (ext !== '.html' && MIME[ext]) return new Response('Not found', { status: 404 })
    return html(join(root, '200.html'))
  })
}

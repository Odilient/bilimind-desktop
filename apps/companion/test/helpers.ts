import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApi } from '../merged/shell/src/api/handler.ts'

export function testApi() {
  const dir = mkdtempSync(join(tmpdir(), 'bm-api-'))
  let api = createApi({ dataDir: join(dir, 'data'), configDir: join(dir, 'config'), userName: 'Ada' })

  async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await api.handle(new Request(`app://bilimind/api${path}`, {
      method,
      headers: body instanceof FormData ? headers : { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    }))
    const text = res.status === 204 ? '' : await res.text()
    let json: any = null
    try { json = text ? JSON.parse(text) : null } catch { /* a file's bytes */ }
    return { status: res.status, data: json?.data, json, text, headers: res.headers }
  }

  return {
    call,
    get: (path: string) => call('GET', path),
    post: (path: string, body?: unknown) => call('POST', path, body ?? {}),
    patch: (path: string, body: unknown) => call('PATCH', path, body),
    del: (path: string) => call('DELETE', path),
    get store() { return api.store },
    dir,
    /** Close and open again, as quitting the app does. */
    restart() {
      api.close()
      api = createApi({ dataDir: join(dir, 'data'), configDir: join(dir, 'config'), userName: 'Ada' })
    },
    done() {
      api.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

export const uuid = () => crypto.randomUUID()

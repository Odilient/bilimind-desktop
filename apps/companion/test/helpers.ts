import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Vault } from '../merged/shell/src/api/credentials.ts'
import { createApi } from '../merged/shell/src/api/handler.ts'

/** A keychain that is plainly a test's: what it seals is recognisable, and it can be switched off or broken. */
export const fakeVault = (available = true): Vault => ({
  available,
  seal: (plain) => `sealed:${Buffer.from(plain).toString('base64')}`,
  open: (sealed) => {
    if (!sealed.startsWith('sealed:')) throw new Error('not ours')
    return Buffer.from(sealed.slice(7), 'base64').toString()
  },
})

export function testApi(options: { baseUrl?: string; vault?: Vault } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'bm-api-'))
  const open = (vault = options.vault ?? fakeVault()) => createApi({ dataDir: join(dir, 'data'), configDir: join(dir, 'config'), userName: 'Ada', vault, baseUrl: options.baseUrl })
  let api = open()

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
    /** A streamed reply as its events, in order. */
    async ask(body: Record<string, unknown>, stopAfter?: (event: string) => boolean) {
      const res = await api.handle(new Request('app://bilimind/api/companion/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
        body: JSON.stringify({ scope: 'everything', context: { kind: 'everything' }, ...body }),
      }))
      if (!res.headers.get('content-type')?.includes('event-stream')) return { status: res.status, json: await res.json(), events: [] as { event: string; data: any }[] }
      const events: { event: string; data: any }[] = []
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      read: for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let cut: number
        while ((cut = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, cut)
          buffer = buffer.slice(cut + 2)
          const event = block.match(/^event: (.*)$/m)![1]!
          events.push({ event, data: JSON.parse(block.match(/^data: (.*)$/m)![1]!) })
          if (stopAfter?.(event)) {
            await reader.cancel()
            break read
          }
        }
      }
      return { status: res.status, json: null, events }
    },
    get: (path: string) => call('GET', path),
    post: (path: string, body?: unknown) => call('POST', path, body ?? {}),
    patch: (path: string, body: unknown) => call('PATCH', path, body),
    del: (path: string) => call('DELETE', path),
    get store() { return api.store },
    dir,
    /** Close and open again, as quitting the app does. */
    restart(vault?: Vault) {
      api.close()
      api = open(vault)
    },
    done() {
      api.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

export const uuid = () => crypto.randomUUID()

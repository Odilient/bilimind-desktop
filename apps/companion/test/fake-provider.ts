// An OpenAI-compatible provider on localhost, so nothing here ever spends real money. `reply` decides the answer to
// each call from what was asked; `requests` keeps every body it was sent.
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

export interface FakeReply {
  /** Sent one piece at a time, as a streaming model does. */
  pieces?: string[]
  /** Sent instead: an error status. */
  status?: number
  /** Waits between pieces, to leave time to stop it or see `making`. */
  delayMs?: number
  /** Sent first, as a reasoning model's thinking. */
  thinking?: string[]
}

export async function fakeProvider(reply: (body: any) => FakeReply) {
  const requests: any[] = []
  let dropped = 0
  const server: Server = createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => { raw += c })
    req.on('end', async () => {
      // The budget check asks for a balance; a provider that won't say leaves the caps to do the work.
      if (!raw) {
        res.writeHead(404)
        res.end()
        return
      }
      const body = JSON.parse(raw)
      requests.push({ body, authorization: req.headers.authorization })
      const out = reply(body)
      if (out.status) {
        res.writeHead(out.status, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: { message: 'fake failure' } }))
        return
      }
      if (!body.stream) {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ choices: [{ message: { content: (out.pieces ?? []).join('') }, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 8 } }))
        return
      }
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      let gone = false
      res.on('close', () => { if (!res.writableFinished) { gone = true; dropped++ } })
      for (const thought of out.thinking ?? []) {
        if (gone) return
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: thought } }] })}\n\n`)
        await new Promise((r) => setTimeout(r, out.delayMs ?? 0))
      }
      for (const piece of out.pieces ?? []) {
        if (gone) return
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`)
        await new Promise((r) => setTimeout(r, out.delayMs ?? 0))
      }
      if (gone) return
      res.write(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 8 } })}\n\n`)
      res.end('data: [DONE]\n\n')
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  return {
    requests,
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    /** How many replies were cut off because the app stopped reading. */
    dropped: () => dropped,
    close: () => new Promise((r) => server.close(r)),
  }
}

/** Cut a reply into small pieces, the way the fence and the words really arrive. */
export const inPieces = (text: string, size = 7) => text.match(new RegExp(`[\\s\\S]{1,${size}}`, 'g')) ?? []

// Fetching what a link points at, for reading it. Text the model reads could put a link in front of this one day, so it
// never reaches this computer's own network: no loopback, no private ranges, no cloud metadata address. The check runs in
// the connection's own lookup, on every redirect, so a name that resolves to a public address at first and a private one
// later still can't get through.
import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { BlockList, isIP } from 'node:net'
import { Readable } from 'node:stream'

const blocked = new BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(address, prefix, 'ipv4')
for (const [address, prefix] of [['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64], ['2001:db8::', 32], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) blocked.addSubnet(address, prefix, 'ipv6')

/** IPv4 written inside IPv6 (::ffff:127.0.0.1) is judged as the IPv4 it is. */
export function isPrivateAddress(address: string): boolean {
  const mapped = address.toLowerCase().match(/^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/)
  if (mapped) {
    const v4 = mapped[1] ?? [parseInt(mapped[2]!, 16) >> 8, parseInt(mapped[2]!, 16) & 255, parseInt(mapped[3]!, 16) >> 8, parseInt(mapped[3]!, 16) & 255].join('.')
    return blocked.check(v4, 'ipv4')
  }
  const family = isIP(address)
  if (family === 4) return blocked.check(address, 'ipv4')
  if (family === 6) return blocked.check(address, 'ipv6')
  return true
}

const MAX_REDIRECTS = 5

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void

function guardedLookup(hostname: string, options: { all?: boolean } & Record<string, unknown>, callback: LookupCallback): void {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, '')
    const safe = addresses.filter((a) => !isPrivateAddress(a.address))
    if (!safe.length) return callback(Object.assign(new Error(`${hostname} is on a private network`), { code: 'EPRIVATE' }), '')
    if (options.all) return callback(null, safe)
    return callback(null, safe[0]!.address, safe[0]!.family)
  })
}

function once(url: URL, init: RequestInit): Promise<Response> {
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!/^https?:$/.test(url.protocol)) return Promise.reject(new Error('Only web links can be read.'))
  // A literal address is never looked up, so it's judged here.
  if (isIP(host) ? isPrivateAddress(host) : host === 'localhost' || host.endsWith('.localhost')) return Promise.reject(new Error(`${host} is on a private network`))
  return new Promise((resolve, reject) => {
    const req = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      method: 'GET',
      headers: init.headers as Record<string, string>,
      signal: init.signal ?? undefined,
      lookup: guardedLookup as never,
    }, (res) => {
      const headers = new Headers()
      for (const [name, value] of Object.entries(res.headers)) {
        if (typeof value === 'string') headers.set(name, value)
        else if (Array.isArray(value)) headers.set(name, value.join(', '))
      }
      const status = res.statusCode ?? 502
      const empty = [204, 205, 304].includes(status) || (status >= 300 && status < 400)
      if (empty) res.resume()
      resolve(new Response(empty ? null : Readable.toWeb(res) as ReadableStream, { status, headers }))
    })
    req.on('error', reject)
    req.end()
  })
}

/** A `fetch` for links: GET only, following redirects itself so each hop is checked. */
export const publicFetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
  let url = new URL(String(input))
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await once(url, init)
    const to = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
    if (!to) return res
    url = new URL(to, url)
  }
  throw new Error('That link redirects too many times.')
}) as typeof fetch

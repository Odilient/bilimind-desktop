// Files on this computer: what may come in, and how it goes back out.
import { createReadStream, statSync } from 'node:fs'
import { Readable } from 'node:stream'
import { basename } from 'node:path'
import { notFound } from './respond.ts'

export const MAX_UPLOAD_BYTES = 51_200 * 1024

export const ACCEPTED = 'We cannot attach that kind of file. PDFs, images, audio, video, Office documents, text and zip files are fine.'
const TEXT_TYPES: Record<string, string> = { txt: 'text/plain', md: 'text/markdown', csv: 'text/csv' }
const OFFICE_TYPES: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
}

/**
 * The type from the bytes, never from the name or what the sender claimed, and nothing that can carry script (SVG,
 * HTML): this origin is the app's own. Null when it isn't on the list.
 */
export function sniff(b: Buffer, name: string): { mime: string; extension: string } | null {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  const starts = (...bytes: number[]) => bytes.every((v, i) => b[i] === v)
  const ascii = (at: number, s: string) => b.toString('latin1', at, at + s.length) === s
  if (starts(0x89, 0x50, 0x4e, 0x47)) return { mime: 'image/png', extension: 'png' }
  if (starts(0xff, 0xd8, 0xff)) return { mime: 'image/jpeg', extension: 'jpg' }
  if (ascii(0, 'GIF8')) return { mime: 'image/gif', extension: 'gif' }
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return { mime: 'image/webp', extension: 'webp' }
  if (ascii(0, 'RIFF') && ascii(8, 'WAVE')) return { mime: 'audio/wav', extension: 'wav' }
  if (ascii(0, '%PDF-')) return { mime: 'application/pdf', extension: 'pdf' }
  if (ascii(0, 'ID3') || (b[0] === 0xff && ((b[1] ?? 0) & 0xe0) === 0xe0)) return { mime: 'audio/mpeg', extension: 'mp3' }
  if (ascii(0, 'OggS')) return { mime: 'audio/ogg', extension: 'ogg' }
  if (starts(0x1a, 0x45, 0xdf, 0xa3)) return { mime: 'video/webm', extension: 'webm' }
  if (ascii(4, 'ftyp')) return ascii(8, 'M4A') ? { mime: 'audio/mp4', extension: 'm4a' } : { mime: 'video/mp4', extension: 'mp4' }
  if (ascii(0, 'PK\x03\x04')) return OFFICE_TYPES[ext] ? { mime: OFFICE_TYPES[ext]!, extension: ext } : null
  if (!TEXT_TYPES[ext] || b.includes(0)) return null
  const head = b.toString('utf8', 0, 512).trimStart().toLowerCase()
  if (/^<(!doctype|html|svg|script)/.test(head)) return null
  return { mime: TEXT_TYPES[ext]!, extension: ext }
}

export function cleanName(name: string, extension: string): string {
  const base = basename(name.replace(/\\/g, '/')).replace(/[\x00-\x1F\x7F"]/g, '').replace(/\s+/g, ' ').trim()
  return base && base !== '.' && base !== '..' ? base.slice(0, 255) : `attachment.${extension}`
}

export function serveFile(path: string, item: Record<string, any>, range: string | null): Response {
  let size: number
  try { size = statSync(path).size } catch { return notFound('That file is no longer here.') }
  const mime = String(item.meta?.mime ?? 'application/octet-stream')
  const inline = /^(image|audio|video)\//.test(mime) || mime === 'application/pdf'
  const headers: Record<string, string> = {
    'content-type': mime,
    'x-content-type-options': 'nosniff',
    'cache-control': 'private, max-age=3600',
    'accept-ranges': 'bytes',
    'content-disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(item.title || 'file')}`,
  }
  const part = range?.match(/^bytes=(\d*)-(\d*)$/)
  if (part && (part[1] || part[2])) {
    const start = part[1] ? Number(part[1]) : Math.max(0, size - Number(part[2]))
    const end = part[1] && part[2] ? Math.min(size - 1, Number(part[2])) : size - 1
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'content-range': `bytes */${size}` } })
    return new Response(Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream, {
      status: 206,
      headers: { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) },
    })
  }
  return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, { headers: { ...headers, 'content-length': String(size) } })
}

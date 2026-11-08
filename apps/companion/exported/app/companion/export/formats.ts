/**
 * The file formats exports are written in, as plain functions of plain data:
 * CSV, Anki's text import, a spreadsheet (.xlsx), a one-image PDF, and the
 * file names they go under. Nothing here knows about the store or the
 * screen, so `scripts/check-export.ts` checks each against its spec.
 *
 * The spreadsheet is written by hand rather than with a library because a
 * table of text, numbers and dates is all it ever holds: five small XML
 * parts in a zip (ECMA-376 SpreadsheetML), against ~1 MB of exceljs. Text
 * goes in as inline strings, so a title that starts with "=" stays text and
 * is never a formula; dates are real dates (Excel's day serials with a date
 * format), so the columns sort and filter as dates.
 */
import { strToU8, zipSync } from 'fflate'

/** A date is the learner's wall-clock time, `YYYY-MM-DD` or `YYYY-MM-DD HH:MM`, already in their zone. */
export type Cell = string | number | null | { when: string }

export interface Sheet {
  name: string
  head: string[]
  rows: Cell[][]
}

/* -- Names ------------------------------------------------------------------- */

/** A learner's own title as a file or folder name every system accepts. */
export function fileName(title: string, fallback = 'Untitled'): string {
  const name = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, 100)
    .trim()
  if (!name) return fallback
  // Windows refuses these as names whatever the extension.
  return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(name) ? `${name}_` : name
}

/** `name.ext`, or `name (2).ext` when the folder already holds one: two pages called "Notes" both survive. */
export function uniqueName(taken: Set<string>, name: string, ext: string): string {
  let out = `${name}${ext}`
  for (let n = 2; taken.has(out.toLowerCase()); n++) out = `${name} (${n})${ext}`
  taken.add(out.toLowerCase())
  return out
}

/** Bytes as a Blob. fflate's arrays are typed over any buffer, which the DOM's BlobPart won't take as is. */
export function blobOf(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type })
}

/* -- CSV (RFC 4180) ---------------------------------------------------------- */

function cellText(cell: Cell): string {
  if (cell == null) return ''
  if (typeof cell === 'object') return cell.when
  return String(cell)
}

/**
 * Quoted when it has to be, CRLF between rows, and a byte-order mark first,
 * which is how Excel knows the file is UTF-8 (without it, every é and every
 * Cyrillic title comes out as mojibake). Text that a spreadsheet would run
 * as a formula (=, +, -, @ first) gets a leading apostrophe: titles arrive
 * from emails and group chats, and a CSV opened in Excel shouldn't execute
 * one (OWASP, "CSV injection"). Numbers are numbers and keep their sign.
 */
export function csv(head: string[], rows: Cell[][]): string {
  const field = (cell: Cell) => {
    let text = cellText(cell)
    if (typeof cell === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return '﻿' + [head, ...rows].map((row) => row.map(field).join(',')).join('\r\n') + '\r\n'
}

/* -- Anki --------------------------------------------------------------------- */

export interface AnkiCard {
  /** Anki's note GUID: importing the file again updates these notes instead of adding copies. */
  id: string
  front: string
  back: string
  tags: string[]
}

/**
 * Anki's text import (manual, "Importing > Text files"): the header lines
 * say the separator, that the fields are text not HTML, the note type and
 * deck, and which columns are the GUID and the tags, so a learner imports it
 * with no settings to choose. A field holding a tab, a quote or a line break
 * is quoted, quotes doubled. Tags can't hold spaces: they become "_".
 */
export function anki(deck: string, cards: AnkiCard[]): string {
  const field = (text: string) => (/[\t"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text)
  const tag = (t: string) => t.trim().replace(/\s+/g, '_')
  const head = ['#separator:tab', '#html:false', '#notetype:Basic', `#deck:${deck.replace(/[\r\n]+/g, ' ')}`, '#guid column:1', '#tags column:4']
  const lines = cards.map((c) => [c.id, c.front, c.back, c.tags.map(tag).filter(Boolean).join(' ')].map(field).join('\t'))
  return [...head, ...lines].join('\n') + '\n'
}

/* -- XLSX ------------------------------------------------------------------------ */

function xml(text: string): string {
  // Control characters are not allowed in XML at all; a pasted one would make Excel refuse the file.
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** A, B, … Z, AA, AB: the column's letters. */
export function column(index: number): string {
  let out = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) out = String.fromCharCode(65 + ((n - 1) % 26)) + out
  return out
}

/** Excel's day serial for a wall-clock time: days since 30 Dec 1899, the fraction the time of day. */
export function serial(when: string): number | null {
  const m = when.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/)
  if (!m) return null
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0))
  return ms / 86_400_000 + 25_569
}

/** Styles by index (styles.xml's cellXfs): 0 plain, 1 bold header, 2 a date, 3 a date and time. */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

function sheetXml(sheet: Sheet): string {
  const all: Cell[][] = [sheet.head, ...sheet.rows]
  const cell = (value: Cell, ref: string, header: boolean): string => {
    if (value == null || value === '') return ''
    if (typeof value === 'number') return Number.isFinite(value) ? `<c r="${ref}"><v>${value}</v></c>` : ''
    if (typeof value === 'object') {
      const n = serial(value.when)
      if (n != null) return `<c r="${ref}" s="${value.when.length > 10 ? 3 : 2}"><v>${n}</v></c>`
      value = value.when
    }
    return `<c r="${ref}" t="inlineStr"${header ? ' s="1"' : ''}><is><t xml:space="preserve">${xml(value)}</t></is></c>`
  }
  const rows = all
    .map((row, r) => `<row r="${r + 1}">${row.map((v, c) => cell(v, `${column(c)}${r + 1}`, r === 0)).join('')}</row>`)
    .join('')
  // Wide enough for what's in each column (in characters), within reason.
  const widths = sheet.head.map((_, c) =>
    Math.min(60, Math.max(8, ...all.map((row) => cellText(row[c] ?? null).length + 2))),
  )
  const cols = widths.map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`).join('')
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    // The header row stays in view while scrolling.
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${cols}</cols><sheetData>${rows}</sheetData></worksheet>`
  )
}

/** A workbook, one tab per sheet. Sheet names must be unique, ≤ 31 characters, and free of []:*?/\. */
export function xlsx(sheets: Sheet[]): Uint8Array {
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      head +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        sheets
          .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
          .join('') +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      head +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        `<Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      head +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${rel}"><sheets>` +
        sheets.map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
        '</sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      head +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
    ),
    'xl/styles.xml': strToU8(STYLES),
  }
  sheets.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s))))
  return zipSync(files)
}

/* -- A picture as a PDF ------------------------------------------------------------ */

/** A4 in points, and the margin round the picture. */
const A4 = { w: 595.28, h: 841.89 }
const MARGIN = 28

/**
 * One A4 page holding one JPEG, fitted inside the margins, turned to
 * landscape when the picture is wider than tall: the smallest valid PDF
 * (ISO 32000, a catalog, a page tree, a page, its drawing and the image,
 * then the cross-reference table of byte offsets). The JPEG goes in as it is
 * (DCTDecode), so nothing is re-encoded and no library is needed.
 */
export function imagePdf(jpeg: Uint8Array, width: number, height: number): Uint8Array {
  const landscape = width > height
  const pw = landscape ? A4.h : A4.w
  const ph = landscape ? A4.w : A4.h
  const k = Math.min((pw - MARGIN * 2) / width, (ph - MARGIN * 2) / height)
  const w = width * k
  const h = height * k
  const x = (pw - w) / 2
  const y = (ph - h) / 2
  const draw = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`

  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const put = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === 'string' ? strToU8(chunk) : chunk
    parts.push(bytes)
    length += bytes.length
  }
  const object = (n: number, body: string | Uint8Array[]) => {
    offsets[n] = length
    put(`${n} 0 obj\n`)
    if (typeof body === 'string') put(body)
    else body.forEach(put)
    put('\nendobj\n')
  }

  // The second line's high bytes tell transfer tools the file is binary.
  put('%PDF-1.4\n')
  put(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))
  object(1, '<< /Type /Catalog /Pages 2 0 R >>')
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`)
  object(4, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`)
  object(5, [
    strToU8(
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    ),
    jpeg,
    strToU8('\nendstream'),
  ])
  const xref = length
  // Every entry is exactly 20 bytes: ten digits, a space, five digits, a space, n or f, a space, a line feed.
  put(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`)
  put(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)

  const out = new Uint8Array(length)
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

// PDF: unpdf (serverless pdf.js), one section per page. Locator "Slide N" when the pages are landscape, else "Page N".
// A page with no text layer is reported in scanned_pages (no OCR in the hackathon).
import { readFileSync } from 'node:fs';
import { getDocumentProxy } from 'unpdf';
import type { ExtractedFile, Section } from '../contracts.ts';
import { tidyPdfText } from './tidy.ts';

/** Fewer visible characters than this on a page = no text layer (a scan or a picture-only page). */
export const SCANNED_MAX_CHARS = 3;

interface TextItemLike { str?: string; hasEOL?: boolean }

export async function extractPdf(absPath: string): Promise<ExtractedFile & { title?: string }> {
  const data = new Uint8Array(readFileSync(absPath));
  // verbosity 0: pdf.js warnings ("TT: undefined function") would otherwise print to stdout and break the CLI's JSON line.
  const doc = await getDocumentProxy(data, { verbosity: 0 });
  const raw: { page: number; text: string; landscape: boolean }[] = [];
  let title: string | undefined;
  try {
    try {
      const meta = await doc.getMetadata();
      const t = (meta.info as { Title?: unknown } | undefined)?.Title;
      if (typeof t === 'string' && t.trim()) title = t.trim();
    } catch { /* no metadata */ }
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      let text = '';
      for (const it of content.items as TextItemLike[]) {
        if (typeof it.str !== 'string') continue;
        text += it.str;
        if (it.hasEOL) text += '\n';
      }
      raw.push({ page: n, text: tidyPdfText(text), landscape: vp.width > vp.height * 1.05 });
      page.cleanup();
    }
  } finally {
    await (doc as unknown as { destroy?: () => Promise<void> }).destroy?.().catch(() => undefined);
  }
  const landscapePages = raw.filter(p => p.landscape).length;
  const landscape = raw.length > 0 && landscapePages / raw.length >= 0.6;
  const cleaned = stripRepeatedLines(raw.map(p => p.text));
  const sections: Section[] = [];
  const scanned: number[] = [];
  raw.forEach((p, i) => {
    const text = cleaned[i]!;
    if (p.text.replace(/\s+/g, '').length < SCANNED_MAX_CHARS) { scanned.push(p.page); return; }
    if (!text.trim()) return;
    sections.push({ locator: `${landscape ? 'Slide' : 'Page'} ${p.page}`, page: p.page, text });
  });
  return { kind: 'pdf', pages: raw.length, sections, scanned_pages: scanned, landscape, title };
}

/**
 * Drop running headers/footers: a line (digits ignored) that appears on at least 60% of the pages of a
 * document with 4+ pages, e.g. "CSC2103 Data Structures | Lecture 2: Hash Tables 7". Never empties a page.
 */
export function stripRepeatedLines(pages: string[]): string[] {
  if (pages.length < 4) return pages;
  const key = (l: string): string => l.trim().replace(/\d+/g, '#').replace(/\s+/g, ' ').toLowerCase();
  const counts = new Map<string, number>();
  for (const p of pages) {
    for (const k of new Set(p.split('\n').map(key).filter(k => k.length >= 6))) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const limit = Math.ceil(pages.length * 0.6);
  const drop = new Set([...counts].filter(([, n]) => n >= limit).map(([k]) => k));
  if (!drop.size) return pages;
  return pages.map(p => {
    const kept = p.split('\n').filter(l => !drop.has(key(l))).join('\n').trim();
    return kept || p;
  });
}

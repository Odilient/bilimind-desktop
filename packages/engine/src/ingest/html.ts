// HTML (mammoth output or a saved .html page) -> sections split on headings. Locator = heading text (<= 110 chars).
import type { Section } from '../contracts.ts';
import { clip, decodeEntities, normaliseText } from './tidy.ts';

const BLOCK_END = /^(p|div|li|tr|h[1-6]|table|ul|ol|blockquote|pre|section|article|header|footer|br)$/;

/**
 * Small tag walker, enough for mammoth's clean HTML and simple pages: headings start sections; table rows
 * become "cell | cell" lines; list items become "- item"; scripts/styles are dropped.
 */
export function htmlToSections(html: string, opts: { minHeading?: number; maxHeading?: number } = {}): Section[] {
  const maxLevel = opts.maxHeading ?? 3;
  const src = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|noscript|head)\b[\s\S]*?<\/\1>/gi, '');
  const sections: Section[] = [];
  let locator: string | null = null;
  let buf = '';
  let heading: string | null = null;
  let headingLevel = 0;
  let cellIndex = 0;

  const flush = (): void => {
    const text = normaliseText(buf);
    if (text) sections.push({ locator, page: null, text: locator && !text.startsWith(locator) ? `${locator}\n${text}` : text });
    buf = '';
  };

  for (const m of src.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>|([^<]+)/g)) {
    if (m[2] !== undefined) {
      const t = decodeEntities(m[2]).replace(/\s+/g, ' ');
      if (heading !== null) heading += t;
      else buf += t;
      continue;
    }
    const tag = m[1]!.toLowerCase();
    const closing = m[0].startsWith('</');
    const hm = /^h([1-6])$/.exec(tag);
    if (hm) {
      const level = Number(hm[1]);
      if (!closing) { heading = ''; headingLevel = level; continue; }
      const h = (heading ?? '').replace(/\s+/g, ' ').trim();
      heading = null;
      if (!h) continue;
      if (headingLevel <= maxLevel) { flush(); locator = clip(h, 110); buf = ''; }
      else buf += `\n${h}\n`;
      continue;
    }
    if (tag === 'li' && !closing) { buf += '\n- '; continue; }
    if (tag === 'tr' && !closing) { cellIndex = 0; if (!buf.endsWith('\n')) buf += '\n'; continue; }
    if (tag === 'tr' && closing) { cellIndex = 0; buf += '\n'; continue; }
    if ((tag === 'td' || tag === 'th') && !closing) { if (cellIndex++ > 0) buf += ' | '; continue; }
    if ((tag === 'td' || tag === 'th') && closing) continue;
    if (tag === 'p' && closing) { if (cellIndex === 0) buf += '\n'; else buf += ' '; continue; }
    if (BLOCK_END.test(tag)) { if (tag === 'br' || closing) buf += '\n'; if (tag === 'table' && closing) cellIndex = 0; }
  }
  flush();
  // Tidy table rows: collapse the stray spaces mammoth leaves around cell paragraphs.
  return sections.map(s => ({ ...s, text: s.text.split('\n').map(l => l.replace(/\s*\|\s*/g, ' | ').replace(/ {2,}/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim() }));
}

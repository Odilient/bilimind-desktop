// Text clean-up shared by the extractors.

/** Line endings, control chars, NBSP/ZWSP, trailing spaces, runaway blank lines (port of Chunker::normalise). */
export function normaliseText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[​﻿]/g, '')
    .replace(/[^\P{C}\n\t]+/gu, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** PDF page text: de-hyphenate line breaks inside words, collapse runs of spaces. */
export function tidyPdfText(text: string): string {
  return normaliseText(
    text
      .replace(/(\S)-\n(\p{Ll})/gu, '$1$2')
      .replace(/[ \t]{2,}/g, ' '),
  );
}

export const wordCount = (text: string): number => (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu) ?? []).length;

/** Decode the XML/HTML entities that appear in docx/pptx/html text. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k === 'amp') return '&';
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'quot') return '"';
    if (k === 'apos') return "'";
    if (k === 'nbsp') return ' ';
    const code = k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  });
}

/** Clip to n code points (never splits a surrogate pair). */
export function clip(s: string, n: number): string {
  const cps = [...s];
  return cps.length <= n ? s : cps.slice(0, n).join('');
}

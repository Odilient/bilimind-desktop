// Markdown / plain text / html files. Markdown splits on ATX headings (# .. ###), locator = heading text.
import { readFileSync } from 'node:fs';
import type { ExtractedFile, Section } from '../contracts.ts';
import { clip, normaliseText } from './tidy.ts';
import { htmlToSections } from './html.ts';

export function markdownSections(md: string): Section[] {
  const text = normaliseText(md.replace(/^---\n[\s\S]*?\n---\n/, ''));   // drop YAML front matter
  const sections: Section[] = [];
  let locator: string | null = null;
  let buf: string[] = [];
  let inFence = false;
  const flush = (): void => {
    const body = normaliseText(buf.join('\n'));
    if (body) sections.push({ locator, page: null, text: body });
    buf = [];
  };
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    const h = inFence ? null : /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (h) {
      flush();
      locator = clip(h[2]!.replace(/[*_`]/g, '').trim(), 110);
      buf.push(line);
      continue;
    }
    buf.push(line);
  }
  flush();
  return sections;
}

export async function extractText(absPath: string, kind: 'md' | 'txt' | 'html'): Promise<ExtractedFile & { title?: string }> {
  const raw = readFileSync(absPath, 'utf8').replace(/^﻿/, '');
  const sections = kind === 'html' ? htmlToSections(raw) : kind === 'md' ? markdownSections(raw)
    : (normaliseText(raw) ? [{ locator: null, page: null, text: normaliseText(raw) }] : []);
  const h1 = kind === 'md' ? /^#\s+(.+?)\s*#*\s*$/m.exec(raw)?.[1] : kind === 'html' ? /<title>([^<]+)<\/title>/i.exec(raw)?.[1] : undefined;
  return { kind, pages: sections.length, sections, scanned_pages: [], title: h1?.replace(/[*_`]/g, '').trim() || undefined };
}

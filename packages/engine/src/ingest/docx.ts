// DOCX: mammoth -> HTML (Title/Heading styles mapped to h1..h3) -> sections split on headings. Locator = heading text.
import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import mammoth from 'mammoth';
import type { ExtractedFile } from '../contracts.ts';
import { htmlToSections } from './html.ts';
import { decodeEntities } from './tidy.ts';

const STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => p:fresh",
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
];

/** dc:title from docProps/core.xml, if the author set one. */
function coreTitle(absPath: string): string | undefined {
  try {
    const files = unzipSync(new Uint8Array(readFileSync(absPath)), { filter: f => f.name === 'docProps/core.xml' });
    const xml = files['docProps/core.xml'];
    const m = xml ? /<dc:title>([\s\S]*?)<\/dc:title>/.exec(strFromU8(xml)) : null;
    const t = m ? decodeEntities(m[1]!).trim() : '';
    return t || undefined;
  } catch { return undefined; }
}

export async function extractDocx(absPath: string): Promise<ExtractedFile & { title?: string }> {
  const { value } = await mammoth.convertToHtml({ path: absPath }, { styleMap: STYLE_MAP, ignoreEmptyParagraphs: true });
  const sections = htmlToSections(value, { maxHeading: 2 });
  return { kind: 'docx', pages: sections.length, sections, scanned_pages: [], title: coreTitle(absPath) };
}

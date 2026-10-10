// PPTX: fflate unzip; slides in presentation order; <a:t> text (newline per </a:p>) + speaker notes. Locator "Slide N".
import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import type { ExtractedFile, Section } from '../contracts.ts';
import { decodeEntities, normaliseText } from './tidy.ts';

/** Text of one DrawingML part: <a:t> runs, a newline per paragraph, fields (slide numbers) dropped. */
export function drawingText(xml: string): string {
  const body = xml.replace(/<a:fld\b[\s\S]*?<\/a:fld>/g, '');
  const paras: string[] = [];
  for (const p of body.split(/<\/a:p>/)) {
    let line = '';
    for (const m of p.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>|<a:br\s*\/>|<a:tab\s*\/>/g)) {
      if (m[1] !== undefined) line += decodeEntities(m[1]);
      else if (m[0].startsWith('<a:br')) line += '\n';
      else line += '\t';
    }
    if (line.trim()) paras.push(line.trim());
  }
  return normaliseText(paras.join('\n'));
}

const relTargets = (xml: string): Map<string, string> => {
  const out = new Map<string, string>();
  for (const m of xml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[1]!)?.[1];
    const target = /\bTarget="([^"]+)"/.exec(m[1]!)?.[1];
    if (id && target) out.set(id, target);
  }
  return out;
};

/** "../notesSlides/notesSlide3.xml" relative to "ppt/slides/" -> "ppt/notesSlides/notesSlide3.xml". */
function resolvePart(fromDir: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = fromDir.split('/').filter(Boolean);
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

export function extractPptxBuffer(buf: Uint8Array): ExtractedFile {
  const files = unzipSync(buf, { filter: f => f.name.startsWith('ppt/') && (f.name.endsWith('.xml') || f.name.endsWith('.rels')) });
  const text = (name: string): string | null => (files[name] ? strFromU8(files[name]!) : null);

  // Slide order from presentation.xml (sldIdLst), falling back to numeric file order.
  let order: string[] = [];
  const pres = text('ppt/presentation.xml');
  const presRels = text('ppt/_rels/presentation.xml.rels');
  if (pres && presRels) {
    const rels = relTargets(presRels);
    for (const m of pres.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"[^>]*\/?>/g)) {
      const t = rels.get(m[1]!);
      if (t) order.push(resolvePart('ppt', t));
    }
  }
  const slideFiles = Object.keys(files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  if (!order.length || order.some(o => !files[o])) {
    order = slideFiles.sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]));
  }

  const sections: Section[] = [];
  const scanned: number[] = [];
  order.forEach((slidePath, i) => {
    const n = i + 1;
    const slideText = drawingText(text(slidePath) ?? '');
    // Speaker notes through the slide's own rels (notes numbering need not match slide numbering).
    let notes = '';
    const relsPath = slidePath.replace(/slides\/(slide\d+\.xml)$/, 'slides/_rels/$1.rels');
    const rels = text(relsPath);
    let notesPath: string | null = null;
    if (rels) {
      for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
        if (/notesSlide/.test(/\bType="([^"]+)"/.exec(m[1]!)?.[1] ?? '')) {
          const t = /\bTarget="([^"]+)"/.exec(m[1]!)?.[1];
          if (t) notesPath = resolvePart('ppt/slides', t);
        }
      }
    }
    notesPath ??= `ppt/notesSlides/notesSlide${/(\d+)\.xml$/.exec(slidePath)?.[1] ?? n}.xml`;
    const notesXml = text(notesPath);
    if (notesXml) {
      // Notes pages repeat the slide image placeholder; keep only the body text shapes.
      const bodyShapes = [...notesXml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g)].map(m => m[0]).filter(s => /type="body"/.test(s));
      notes = drawingText(bodyShapes.length ? bodyShapes.join('') : notesXml);
    }
    const combined = [slideText, notes ? `Speaker notes: ${notes}` : ''].filter(Boolean).join('\n\n');
    if (!slideText && !notes) { scanned.push(n); return; }
    sections.push({ locator: `Slide ${n}`, page: n, text: combined });
  });
  return { kind: 'pptx', pages: order.length, sections, scanned_pages: scanned, landscape: true };
}

export async function extractPptx(absPath: string): Promise<ExtractedFile> {
  return extractPptxBuffer(new Uint8Array(readFileSync(absPath)));
}

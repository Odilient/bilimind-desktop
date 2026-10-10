// Shared helpers for the WP1 tests: temp dirs, a fake ctx, a hand-written PDF and a hand-built PPTX.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import type { Ctx, EngineConfig } from '../src/contracts.ts';

export function tempDir(prefix = 'bm-wp1-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function fakeCtx(course: string, over: Partial<Ctx> = {}): Ctx {
  return { course, agent: 'Test', noCache: true, spend: { usd: 0, calls: 0 }, now: () => new Date(), progress: () => {}, ...over };
}

export function fakeConfig(dir: string, over: Partial<EngineConfig> = {}): EngineConfig {
  return {
    provider: 'deepseek', baseUrl: 'https://api.deepseek.com', apiKey: 'sk-test-0000', keySource: 'env',
    models: { fast: 'deepseek-flash', reasoning: 'deepseek-v4-pro' }, userDir: dir, ledgerPath: join(dir, 'ledger.jsonl'),
    caps: { runUsd: 0.25, dayUsd: 2 }, reserveUsd: { deepseek: 3, openrouter: 4, bilimind: 0 }, demoDay: true, ...over,
  };
}

/** A minimal valid PDF (Helvetica, xref offsets computed). `text: null` makes a page with no text layer. */
export function makePdf(pages: { lines: string[] | null; w?: number; h?: number }[]): Uint8Array {
  const objs: string[] = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objs[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  pages.forEach((p, i) => {
    const w = p.w ?? 595, h = p.h ?? 842;
    const pid = 4 + i * 2, cid = pid + 1;
    const esc = (s: string) => s.replace(/[\\()]/g, m => '\\' + m);
    const stream = p.lines ? `BT /F1 14 Tf 18 TL 60 ${h - 80} Td ${p.lines.map(l => `(${esc(l)}) Tj T*`).join(' ')} ET` : '';
    objs[pid] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${cid} 0 R >>`;
    objs[cid] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objs.length; id++) { offsets[id] = out.length; out += `${id} 0 obj\n${objs[id]}\nendobj\n`; }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n` + offsets.slice(1).map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return strToU8(out);
}

const slideXml = (paras: string[]): string => `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>
<p:sp><p:txBody>${paras.map(t => `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`).join('')}</p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;

/**
 * A hand-built pptx: presentation order is slide2.xml THEN slide1.xml (order must come from presentation.xml),
 * slide2.xml has speaker notes in notesSlide7.xml (numbering differs on purpose), slide3.xml is picture-only.
 */
export function makePptx(): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<Types/>'),
    'ppt/presentation.xml': strToU8(`<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId1"/><p:sldId id="258" r:id="rId3"/></p:sldIdLst></p:presentation>`),
    'ppt/_rels/presentation.xml.rels': strToU8(`<Relationships><Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="slide" Target="slides/slide2.xml"/><Relationship Id="rId3" Type="slide" Target="slides/slide3.xml"/></Relationships>`),
    'ppt/slides/slide1.xml': strToU8(slideXml(['Separate chaining', 'Each bucket holds a list &amp; collisions append'])),
    'ppt/slides/slide2.xml': strToU8(slideXml(['Hash functions', 'A hash function maps a key to a bucket index'])),
    'ppt/slides/slide3.xml': strToU8(slideXml([])),
    'ppt/slides/_rels/slide2.xml.rels': strToU8(`<Relationships><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide7.xml"/></Relationships>`),
    'ppt/notesSlides/notesSlide7.xml': strToU8(`<p:notes xmlns:a="a" xmlns:p="p"><p:cSld><p:spTree>
<p:sp><p:nvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr></p:sp>
<p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Tell them the modulo trick is the simplest hash.</a:t></a:r></a:p></p:txBody></p:sp>
<p:sp><p:nvSpPr><p:nvPr><p:ph type="sldNum" idx="5"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:fld id="x" type="slidenum"><a:t>2</a:t></a:fld></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:notes>`),
  };
  return zipSync(files);
}

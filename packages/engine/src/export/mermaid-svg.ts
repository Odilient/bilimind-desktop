// G2 review (offline-first, player-design §0.8/§5.4): pre-render every Mermaid diagram to SVG at build time, so the
// course never needs the CDN when a judge opens it offline. Headless Edge (puppeteer-core, a dev dependency of the
// repo) loads Mermaid once and renders each source with the cobalt theme; results are cached in crew/diagrams.json by
// a hash of the source, so later builds (and machines without Edge or puppeteer) reuse them. Any failure is a
// warning: the player then falls back to loading Mermaid at runtime, as before.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Course } from '@bilimind/core';
import { readJsonOrNull, writeJson } from '../course.ts';

export const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.12.2/dist/mermaid.min.js';
// keep in step with packages/player/src/blocks/reading/mermaid.ts MERMAID_CONFIG
const MERMAID_CONFIG = {
  startOnLoad: false, securityLevel: 'strict', theme: 'base',
  themeVariables: {
    background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '14px',
    primaryColor: '#FFFFFF', primaryBorderColor: '#0B0D10', primaryTextColor: '#0B0D10',
    secondaryColor: '#EEF1FE', secondaryBorderColor: '#2340E6', secondaryTextColor: '#1B33CF',
    tertiaryColor: '#EEF9CF', tertiaryBorderColor: '#B4E03A', tertiaryTextColor: '#0B0D10',
    lineColor: '#9DA2AE', textColor: '#2A2E37', clusterBkg: '#FFFFFF', clusterBorder: '#D9DCE4',
    edgeLabelBackground: '#F6F7FA', noteBkgColor: '#FFF6DA', noteBorderColor: '#D9A21B', noteTextColor: '#6E5410',
    actorBkg: '#0B0D10', actorTextColor: '#FFFFFF', actorBorder: '#0B0D10', signalColor: '#2A2E37',
  },
  flowchart: { htmlLabels: false, curve: 'basis', nodeSpacing: 36, rankSpacing: 52, padding: 14 },
};
const HOT_CLASS = 'classDef hot fill:#C6F24E,stroke:#0B0D10,color:#0B0D10';

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);
const EDGE = [process.env.BILIMIND_BROWSER, 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/chromium'];

const withHot = (source: string): string => {
  let src = source.trim();
  if (/\bhot\b/.test(src) && !/classDef\s+hot\b/.test(src) && /^(flowchart|graph)\b/.test(src)) src += `\n  ${HOT_CLASS}`;
  return src;
};

/**
 * No puppeteer (the bundled CLI inside WorkBuddy has none): run the installed Edge/Chrome itself, headless, on a
 * temporary page that renders every source and writes the SVGs (base64 JSON) into the DOM, read back with --dump-dom.
 */
export async function renderWithBrowserCli(exe: string, sources: string[], timeoutMs = 60_000): Promise<(string | null)[]> {
  const dir = mkdtempSync(join(tmpdir(), 'bm-mmd-'));
  try {
    const page = join(dir, 'render.html');
    const data = JSON.stringify({ cfg: MERMAID_CONFIG, src: sources.map(withHot), ids: sources.map(x => `bm-pre-${sha(withHot(x))}`) }).replace(/</g, '\\u003c');
    writeFileSync(page, `<!doctype html><html><body><pre id="bm-out">pending</pre>
<script src="${MERMAID_URL}"></script>
<script>(async () => {
  const out = document.getElementById('bm-out');
  try {
    const d = ${data};
    mermaid.initialize(d.cfg);
    const res = [];
    for (let i = 0; i < d.src.length; i++) { try { res.push((await mermaid.render(d.ids[i], d.src[i])).svg); } catch (e) { res.push(null); } }
    out.textContent = 'OK:' + btoa(unescape(encodeURIComponent(JSON.stringify(res))));
  } catch (e) { out.textContent = 'ERR:' + e; }
})();</script></body></html>`);
    const stdout = await new Promise<string>((ok, fail) => {
      execFile(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${join(dir, 'profile')}`,
        '--virtual-time-budget=30000', '--dump-dom', pathToFileURL(page).href],
      { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, windowsHide: true }, (err, out) => (err && !out ? fail(err) : ok(String(out))));
    });
    const m = /<pre id="bm-out">OK:([A-Za-z0-9+/=]+)<\/pre>/.exec(stdout);
    if (!m) throw new Error(/ERR:([^<]{0,160})/.exec(stdout)?.[1] ?? 'the browser printed no diagrams');
    const list = JSON.parse(Buffer.from(m[1]!, 'base64').toString('utf8')) as (string | null)[];
    return sources.map((_, i) => (typeof list[i] === 'string' && /<svg[\s>]/.test(list[i]!) ? list[i]! : null));
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp folder */ }
  }
}

/** Fill payload.svg for every diagram block that has Mermaid source and no svg. Returns how many got an svg. */
export async function prerenderDiagrams(course: Course, crewDir: string, progress: (l: string) => void): Promise<{ rendered: number; cached: number; failed: number }> {
  const blocks = course.lessons.flatMap(l => l.blocks).filter(b => b.type === 'diagram') as { payload: { source?: string; svg?: string } }[];
  const todo = blocks.filter(b => typeof b.payload?.source === 'string' && b.payload.source.trim() && !b.payload.svg);
  const out = { rendered: 0, cached: 0, failed: 0 };
  if (!todo.length) return out;
  const cachePath = join(crewDir, 'diagrams.json');
  const cache = readJsonOrNull<Record<string, string>>(cachePath) ?? {};
  const missing = todo.filter(b => !cache[sha(b.payload.source!)]);
  if (missing.length && process.env.BILIMIND_NO_PRERENDER !== '1') {
    const exe = EDGE.find(p => p && existsSync(p));
    type Browser = { newPage(): Promise<unknown>; close(): Promise<void> };
    let browser = null as Browser | null;
    try {
      if (!exe) throw new Error('no Edge/Chrome found (set BILIMIND_BROWSER)');
      const mod = 'puppeteer-core';
      const pptr = (await import(mod)) as { default?: { launch: (o: unknown) => Promise<unknown> }; launch?: (o: unknown) => Promise<unknown> };
      const launch = pptr.launch ?? pptr.default?.launch;
      if (!launch) throw new Error('puppeteer-core has no launch()');
      browser = await launch({ executablePath: exe, headless: true, args: ["--no-first-run"] }) as Browser;
      const page = await browser!.newPage() as {
        setContent(h: string, o?: unknown): Promise<void>; waitForFunction(f: string, o?: unknown): Promise<unknown>;
        evaluate<T>(f: (...a: never[]) => T | Promise<T>, ...args: unknown[]): Promise<T>;
      };
      await page.setContent(`<!doctype html><html><body><script src="${MERMAID_URL}"></script></body></html>`, { waitUntil: 'load', timeout: 20000 });
      await page.waitForFunction('!!window.mermaid', { timeout: 15000 });
      for (const b of missing) {
        const src = withHot(b.payload.source!);
        try {
          const svg = await page.evaluate(async (s: string, cfg: unknown, id: string) => {
            const m = (globalThis as unknown as { mermaid: { initialize(c: unknown): void; render(i: string, s: string): Promise<{ svg: string }> } }).mermaid;
            m.initialize(cfg);
            return (await m.render(id, s)).svg;
          }, src, MERMAID_CONFIG, `bm-pre-${sha(src)}`);
          if (typeof svg === 'string' && /<svg[\s>]/.test(svg)) { cache[sha(b.payload.source!)] = svg; out.rendered++; } else out.failed++;
        } catch (e) { out.failed++; progress(`build: diagram not pre-rendered (${(e as Error).message.slice(0, 120)})`); }
      }
    } catch (e) {
      const why = (e as Error).message.slice(0, 160);
      // no puppeteer (bundled CLI) or it failed to launch: let the browser render on its own (--dump-dom)
      if (exe && !out.rendered) {
        try {
          const svgs = await renderWithBrowserCli(exe, missing.map(b => b.payload.source!));
          missing.forEach((b, i) => { const svg = svgs[i]; if (svg) { cache[sha(b.payload.source!)] = svg; out.rendered++; } else out.failed++; });
        } catch (e2) {
          progress(`build: diagrams not pre-rendered (${why}; ${(e2 as Error).message.slice(0, 120)}); the page loads Mermaid when online`);
        }
      } else progress(`build: diagrams not pre-rendered (${why}); the page loads Mermaid when online`);
    } finally {
      try { await browser?.close(); } catch { /* ignore */ }
    }
    if (out.rendered) writeJson(cachePath, cache);
  }
  for (const b of todo) {
    const svg = cache[sha(b.payload.source!)];
    if (svg) { b.payload.svg = svg; if (!missing.includes(b)) out.cached++; }
  }
  return out;
}

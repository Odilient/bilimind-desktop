// Mermaid, lazily: the player is one offline file, so Mermaid (2.5 MB) is never bundled. A diagram first
// uses payload.svg (pre-rendered by `bilimind build`), else loads Mermaid from jsDelivr once (classic
// <script>, works from file://) with the cobalt theme, else falls back to the alt text + a chip flow.

export const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.12.2/dist/mermaid.min.js';

/** player-design §5.4: the build-time and runtime config. */
export const MERMAID_CONFIG = {
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
} as const;

export const HOT_CLASS = 'classDef hot fill:#C6F24E,stroke:#0B0D10,color:#0B0D10';

interface MermaidApi {
  initialize(cfg: unknown): void;
  render(id: string, src: string): Promise<{ svg: string }>;
}
declare global { interface Window { mermaid?: MermaidApi } }

let loading: Promise<MermaidApi> | null = null;
let initialised = false;

function ready(m: MermaidApi): MermaidApi {
  if (!initialised) { m.initialize(MERMAID_CONFIG); initialised = true; }
  return m;
}

export function loadMermaid(timeoutMs = 9000): Promise<MermaidApi> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.mermaid) return Promise.resolve(ready(window.mermaid));
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.reject(new Error('offline'));
  if (!loading) {
    loading = new Promise<MermaidApi>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = MERMAID_URL;
      s.async = true;
      const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      s.onload = () => { clearTimeout(timer); window.mermaid ? resolve(ready(window.mermaid)) : reject(new Error('no mermaid global')); };
      s.onerror = () => { clearTimeout(timer); s.remove(); reject(new Error('offline')); };
      document.head.append(s);
    }).catch(e => { loading = null; throw e; });
  }
  return loading;
}

let queue: Promise<unknown> = Promise.resolve();
let n = 0;

/** Render one source to SVG markup; renders are serialised (Mermaid is not re-entrant). */
export function renderMermaid(source: string): Promise<string> {
  const job = queue.then(async () => {
    const m = await loadMermaid();
    let src = source.trim();
    if (/\bhot\b/.test(src) && !/classDef\s+hot\b/.test(src) && /^(flowchart|graph)\b/.test(src)) src += `\n  ${HOT_CLASS}`;
    const { svg } = await m.render(`bm-mmd-${Date.now().toString(36)}-${++n}`, src);
    return svg;
  });
  queue = job.catch(() => undefined);
  return job;
}

/** Strip anything active from SVG markup (pre-rendered svg is data, never trusted code). */
export function sanitizeSvg(markup: string): string | null {
  if (typeof DOMParser === 'undefined' || !markup || !/<svg[\s>]/i.test(markup)) return null;
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
  root.querySelectorAll('script, iframe, object, embed, link, meta').forEach(n => n.remove());
  const all = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const el of all) {
    for (const a of Array.from(el.attributes)) {
      const name = a.name.toLowerCase();
      const v = a.value.trim().toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(a.name);
      else if ((name === 'href' || name === 'xlink:href' || name === 'src') && !(v.startsWith('#') || v.startsWith('data:image/'))) el.removeAttribute(a.name);
      else if (name === 'style' && /url\s*\(\s*['"]?\s*(?!#)|expression\s*\(/i.test(a.value)) el.removeAttribute(a.name);
    }
  }
  return new XMLSerializer().serializeToString(root);
}

// ---------- offline fallback: a readable chip flow from simple flowcharts ----------
export interface FlowStep { id: string; label: string }

const NODE = /([A-Za-z_][\w-]*)\s*(?:\[\[|\[\(|\(\(|\[|\(|\{\{|\{|>)\s*(?:"([^"]*)"|([^\]\)\}"]*?))\s*(?:\]\]|\)\]|\)\)|\]|\)|\}\}|\})/g;

/**
 * Parse `A["label"] --> B --> C` style flowcharts into nodes + edges. Returns the nodes in a
 * readable order (a topological walk from the roots) when the graph is small enough to read as chips.
 */
export function flowFromMermaid(source: string): { steps: FlowStep[]; edges: [string, string][]; linear: boolean } | null {
  const lines = source.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length || !/^(flowchart|graph)\b/i.test(lines[0]!)) return null;
  const labels = new Map<string, string>();
  const order: string[] = [];
  const edges: [string, string][] = [];
  const see = (id: string) => { if (!labels.has(id)) { labels.set(id, id); order.push(id); } };
  for (const line of lines.slice(1)) {
    if (/^(classDef|class|style|linkStyle|click|subgraph|end|%%|direction)\b/.test(line)) continue;
    let m: RegExpExecArray | null;
    NODE.lastIndex = 0;
    while ((m = NODE.exec(line))) {
      see(m[1]!);
      const label = (m[2] ?? m[3] ?? '').trim();
      if (label) labels.set(m[1]!, label);
    }
    // edges: strip node shapes, then split on arrows
    const bare = line.replace(NODE, '$1').replace(/:::\w+/g, '').replace(/\|[^|]*\|/g, '');
    const parts = bare.split(/\s*(?:-->|---|==>|-\.->|--[^-]+-->|-\.-)\s*/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      for (let i = 0; i + 1 < parts.length; i++) {
        const a = parts[i]!.split('&').map(s => s.trim()).filter(Boolean);
        const b = parts[i + 1]!.split('&').map(s => s.trim()).filter(Boolean);
        for (const x of a) for (const y of b) if (/^[A-Za-z_][\w-]*$/.test(x) && /^[A-Za-z_][\w-]*$/.test(y)) { see(x); see(y); edges.push([x, y]); }
      }
    }
  }
  if (!order.length || order.length > 14) return null;
  const indeg = new Map(order.map(id => [id, 0]));
  for (const [, b] of edges) indeg.set(b, (indeg.get(b) ?? 0) + 1);
  const outs = new Map<string, string[]>();
  for (const [a, b] of edges) outs.set(a, [...(outs.get(a) ?? []), b]);
  const seen = new Set<string>();
  const walk: string[] = [];
  const visit = (id: string) => { if (seen.has(id)) return; seen.add(id); walk.push(id); for (const nx of outs.get(id) ?? []) visit(nx); };
  for (const id of order) if ((indeg.get(id) ?? 0) === 0) visit(id);
  for (const id of order) visit(id);
  const linear = edges.length === order.length - 1 && order.every(id => (outs.get(id)?.length ?? 0) <= 1) && [...indeg.values()].every(d => d <= 1);
  return { steps: walk.map(id => ({ id, label: labels.get(id) ?? id })), edges, linear };
}

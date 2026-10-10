// Q13: Mermaid plausibility (BlockPayloadNormaliser, engine-port §4 row 10). Cheap structural checks only; the player
// renders with securityLevel 'strict' and falls back to alt_text on a parse failure.
import type { IsPlausibleMermaid } from '../contracts.ts';

export const MERMAID_KINDS = ['flowchart', 'graph', 'sequencediagram', 'statediagram', 'statediagram-v2', 'classdiagram', 'erdiagram',
  'journey', 'gantt', 'pie', 'mindmap', 'timeline', 'quadrantchart', 'gitgraph', 'requirementdiagram'];

/** Strips ``` fences and a leading `---` front-matter block; leaves the diagram source. */
export function stripMermaidFences(source: string): string {
  let s = source.replace(/\r\n?/g, '\n').trim();
  const fence = /^```[ \t]*(?:mermaid)?[ \t]*\n([\s\S]*?)\n?```$/i.exec(s);
  if (fence) s = fence[1]!.trim();
  if (s.startsWith('---')) {
    const end = s.indexOf('\n---', 3);
    if (end > 0) s = s.slice(end + 4).trim();
  }
  return s;
}

/** Why a Mermaid source is implausible (null = plausible). */
export function mermaidProblem(source: string): string | null {
  if (typeof source !== 'string' || !source.trim()) return 'the diagram source is empty';
  const s = stripMermaidFences(source);
  if (s.length > 6000) return `the source is ${s.length} characters (max 6000)`;
  const lines = s.split('\n');
  if (lines.length > 60) return `the source has ${lines.length} lines (max 60)`;
  if (/<\s*(script|iframe|object|embed)\b/i.test(s)) return 'the source contains an embedded script/iframe/object tag';
  const first = lines.map(l => l.trim()).find(l => l && !l.startsWith('%%'));
  const kind = (first ?? '').split(/[\s;]+/)[0]!.toLowerCase();
  if (!MERMAID_KINDS.includes(kind)) return `the first word is \`${kind || '(nothing)'}\`; a Mermaid diagram starts with one of: flowchart, graph, sequenceDiagram, stateDiagram-v2, classDiagram, erDiagram, timeline, mindmap, pie, gantt`;
  if ((s.match(/"/g) ?? []).length % 2) return 'the source has an odd number of double quotes (an unclosed label)';
  // brackets must balance outside quoted labels
  const stack: string[] = [];
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  let inQuote = false;
  for (const ch of s) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (inQuote) continue;
    if (ch === '(' || ch === '[' || ch === '{') stack.push(ch);
    else if (ch in pairs) {
      if (stack.pop() !== pairs[ch]) return `the brackets do not balance (an unexpected \`${ch}\`)`;
    }
  }
  if (stack.length) return `the brackets do not balance (${stack.length} unclosed \`${stack[stack.length - 1]}\`)`;
  return null;
}

export const isPlausibleMermaid: IsPlausibleMermaid = source => mermaidProblem(source) === null;

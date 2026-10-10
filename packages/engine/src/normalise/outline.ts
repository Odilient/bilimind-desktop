// Outline normalisation: port of GraphBuilder.php (engine-port.md §3.3) plus the HACKATHON marks fix.
// "Never fail on sloppy output": unusable rows are skipped, keys slugged and de-duplicated, a subtopic without a
// parent goes on the spine, nesting deeper than 2 is re-hung, notes over 240 chars are dropped (not cut),
// minutes are clamped. Edges are derived by the reader (topic i -> i+1; parent -> subtopic), never asked for.
import { FALLBACK_ARCHETYPE, MARKS, parseArchetype, plannedBlockTypes } from '@bilimind/core';
import type { Archetype, BlockType, Mark, OutlineNode, Track } from '@bilimind/core';
import { cap, isObj, slug, text } from './util.ts';
import type { Raw } from './util.ts';
import { MAX_FURTHER, MAX_NOTE_LENGTH } from '../prompts/outline.ts';

const MIN_MINUTES = 5, MAX_MINUTES = 240;

export interface ArrangedNode extends OutlineNode {
  layer: number; position: number; depth: number;
  parent: number | null;            // index in the arranged list
  planned_block_types: BlockType[];
}
export interface NormalisedOutline {
  title: string; allowsCode: boolean;
  nodes: ArrangedNode[];
  further: { title: string; topic: string; after_key?: string }[];
  reattached: number;
  marksFixed: string[];
}

const slugKey = (v: unknown): string | null => { const s = slug(typeof v === 'string' ? v.trim() : ''); return s === '' ? null : s; };
const shortText = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string' && typeof v !== 'number') return undefined;
  const t = String(v).replace(/\s+/gu, ' ').trim();
  return t === '' || [...t].length > max ? undefined : t;
};
const conceptKey = (raw: string): string => raw.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64);
const parseTrack = (v: unknown): Track | null => { const t = String(v ?? '').trim().toLowerCase(); return t === 'core' || t === 'subtopic' ? t : null; };
const parseMark = (v: unknown): Mark | null => { const t = String(v ?? '').trim().toLowerCase(); return (MARKS as readonly string[]).includes(t) ? t as Mark : null; };
const clampMinutes = (v: unknown): number => {
  const n = typeof v === 'number' ? Math.trunc(v) : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 15;
  return Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, n));
};

interface Row extends OutlineNode { depth: number }

function normaliseNodes(raw: unknown[]): Row[] {
  const out: Row[] = [];
  const seen = new Set<string>();
  raw.forEach((row, index) => {
    if (!isObj(row)) return;
    const title = text(row, 'title');
    if (title === null) return;
    let key = slug(typeof row.key === 'string' ? row.key.trim() : '', 64) || slug(title, 56) || `node_${index + 1}`;
    if (seen.has(key)) { let n = 2; while (seen.has(`${key}_${n}`)) n++; key = `${key}_${n}`; }
    seen.add(key);
    const archetype: Archetype = parseArchetype(row.archetype) ?? FALLBACK_ARCHETYPE;
    let track: Track = parseTrack(row.track) ?? 'core';
    const branchOf = slugKey(row.branch_of);
    if (track === 'subtopic' && branchOf === null) track = 'core';   // "the line is where an unplaced lesson goes"
    const mark = parseMark(row.mark) ?? parseMark(row.track);
    const sub = track === 'subtopic';
    const node: Row = {
      key, title: cap(title.replace(/\s+/gu, ' '), 190, ''),
      summary: text(row, 'summary') ?? '',
      concept_key: conceptKey(text(row, 'concept_key') ?? '') || key,
      track, archetype, estimated_minutes: clampMinutes(row.estimated_minutes), depth: 0,
    };
    if (sub) node.branch_of = branchOf!;
    if (sub && mark) node.mark = mark;
    const group = sub ? shortText(row.group, 60) : undefined;
    if (group) node.group = group;
    const section = !sub ? shortText(row.section, 60) : undefined;
    if (section) node.section = section;
    const note = !sub ? shortText(row.note, MAX_NOTE_LENGTH) : undefined;   // over-long note: DROPPED, not truncated
    if (note) node.note = note;
    out.push(node);
  });
  return out;
}

/** GraphBuilder::arrange: reading order (topic, then its cluster depth-first), layer = step, position in cluster. */
function arrange(nodes: Row[]): { arranged: ArrangedNode[]; reattached: number } {
  const byKey = new Map(nodes.map((n, i) => [n.key, i]));
  let core = new Set(nodes.filter(n => n.track === 'core').map(n => n.key));
  if (!core.size) {   // every lesson a subtopic: the model's own order becomes the line
    for (const n of nodes) { n.track = 'core'; delete n.branch_of; delete n.mark; delete n.group; }
    core = new Set(nodes.map(n => n.key));
  }
  const firstCore = nodes.find(n => core.has(n.key))?.key ?? null;
  let reattached = 0;
  let lastCore: string | null = null;
  const parentOf = new Map<string, string>();
  for (const n of nodes) {
    if (core.has(n.key)) { lastCore = n.key; continue; }
    let parent: string | null = n.branch_of ?? null;
    if (parent === null || !byKey.has(parent) || parent === n.key) { parent = lastCore; reattached++; }
    if (parent === null) parent = firstCore;   // a subtopic above the first topic waits for one
    parentOf.set(n.key, parent!);
  }
  for (const n of nodes) {
    if (core.has(n.key)) continue;
    const parent = parentOf.get(n.key)!;
    if (core.has(parent)) { n.branch_of = parent; n.depth = 1; continue; }
    const grand = parentOf.get(parent);
    if (grand !== undefined && core.has(grand)) { n.branch_of = parent; n.depth = 2; continue; }
    let top: string | undefined = parent, hops = 0;
    while (top !== undefined && !core.has(top) && hops++ < 8) top = parentOf.get(top);
    n.branch_of = top !== undefined && core.has(top) ? top : firstCore!;
    n.depth = 1;
    reattached++;
  }
  const childrenOf = new Map<string, Row[]>();
  for (const n of nodes) if (!core.has(n.key)) childrenOf.set(n.branch_of!, [...(childrenOf.get(n.branch_of!) ?? []), n]);
  const arranged: ArrangedNode[] = [];
  let step = 0;
  const push = (n: Row, layer: number, position: number, parent: number | null) => {
    arranged.push({ ...n, layer, position, parent, planned_block_types: plannedBlockTypes(n.archetype) });
    return arranged.length - 1;
  };
  for (const n of nodes) {
    if (!core.has(n.key)) continue;
    const topicIndex = push(n, step, 0, null);
    let position = 1;
    for (const child of childrenOf.get(n.key) ?? []) {
      const childIndex = push(child, step, position++, topicIndex);
      for (const grand of childrenOf.get(child.key) ?? []) push(grand, step, position++, childIndex);
    }
    step++;
  }
  return { arranged, reattached };
}

/**
 * HACKATHON marks fix (the prompt's rule, enforced in code): options under a topic are marked `recommended` +
 * `alternative`. Several `recommended` siblings and no `alternative` = they are not options -> marks removed;
 * `alternative` without a `recommended` sibling -> the first alternative becomes `recommended`.
 */
export function fixMarks(nodes: { key: string; track: Track; branch_of?: string; mark?: Mark | null }[]): string[] {
  const fixes: string[] = [];
  const groups = new Map<string, typeof nodes>();
  for (const n of nodes) if (n.track === 'subtopic' && n.branch_of) groups.set(n.branch_of, [...(groups.get(n.branch_of) ?? []), n]);
  for (const [parent, sibs] of groups) {
    const rec = sibs.filter(s => s.mark === 'recommended'), alt = sibs.filter(s => s.mark === 'alternative');
    if (rec.length > 1 && !alt.length) {
      for (const s of rec) delete s.mark;
      fixes.push(`${parent}: ${rec.length} subtopics were all marked recommended with no alternative; marks removed`);
    } else if (alt.length && !rec.length) {
      alt[0]!.mark = 'recommended';
      fixes.push(`${parent}: alternatives had no recommended sibling; ${alt[0]!.key} is now recommended`);
    }
  }
  return fixes;
}

function further(raw: unknown, known: Set<string>): NormalisedOutline['further'] {
  const out: NormalisedOutline['further'] = [];
  const seen = new Set<string>();
  for (const row of Array.isArray(raw) ? raw : []) {
    if (!isObj(row)) continue;
    const title = (text(row, 'title') ?? '').replace(/\s+/gu, ' ');
    const topic = (text(row, 'topic') ?? title).replace(/\s+/gu, ' ');
    if (!title || !topic || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    const after = slugKey(row.after_key ?? row.after);
    out.push({ title: cap(title, 60, ''), topic: cap(topic, 200, ''), ...(after && known.has(after) ? { after_key: after } : {}) });
    if (out.length >= MAX_FURTHER) break;
  }
  return out;
}

/** The whole GraphBuilder pass over a raw outline object. */
export function normaliseOutline(raw: unknown): NormalisedOutline {
  const o: Raw = isObj(raw) ? raw : {};
  const rows = normaliseNodes(Array.isArray(o.nodes) ? o.nodes : []);
  const { arranged, reattached } = arrange(rows);
  const marksFixed = fixMarks(arranged);
  const coreKeys = new Set(arranged.filter(n => n.track === 'core').map(n => n.key));
  return {
    title: text(o, 'course_title') ?? 'Your course',
    allowsCode: o.allows_code === true,
    nodes: arranged.map(n => ({ ...n })),
    further: further(o.further, coreKeys),
    reattached, marksFixed,
  };
}

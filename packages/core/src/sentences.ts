// One sentence splitter + spokenText() shared by the engine (TTS script, cue ids) and the player
// (highlighted spans). Pure string code: no Intl.Segmenter (ICU differs between Node and browsers),
// so the same text gives the same sentences and the same ids everywhere.
//
// Cue ids: `<blockId>.<sentenceIndex>` (0-based, counted across all narrated fields of the block, in
// order), plus `title.0` for the lesson title and `plan.<n>` for the course overview.
// tts.ts may rewrite a sentence for the voice ("O(n)" -> "O of n") but must never merge or split sentences.

// ---------- splitter ----------
const ABBREVIATIONS = new Set(['e.g', 'i.e', 'etc', 'vs', 'mr', 'mrs', 'ms', 'dr', 'prof', 'fig', 'figs', 'no', 'nos',
  'approx', 'cf', 'al', 'st', 'eq', 'eqs', 'p', 'pp', 'vol', 'ch', 'sec', 'ref', 'resp', 'jan', 'feb', 'mar', 'apr',
  'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'mt', 'jr', 'sr', 'inc', 'ltd', 'co']);

function isAbbreviation(word: string): boolean {
  const w = word.replace(/^[("'“‘[]+/u, '');
  if (/^\p{Lu}$/u.test(w)) return true;                       // initials: "J. W. J. Williams"
  if (/^(\p{L}\.)+\p{L}$/u.test(w)) return true;              // "e.g", "i.e", "U.S"
  return ABBREVIATIONS.has(w.toLowerCase());
}

/**
 * Split text into sentences. Newlines are hard boundaries (spokenText puts one paragraph / list item /
 * heading per line). Inside a line, a boundary is [.!?…] (+ closing quotes/brackets) followed by
 * whitespace and a capital letter, digit, quote or opening bracket, unless the word before is an
 * abbreviation or an initial. Whitespace is collapsed; empty sentences are dropped.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\n+/)) {
    const p = raw.replace(/\s+/g, ' ').trim();
    if (!p) continue;
    let start = 0;
    const re = /[.!?…]+["'”’)\]]*(?= |$)/gu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(p))) {
      const end = m.index + m[0].length;
      const rest = p.slice(end).trimStart();
      if (rest) {
        if (!/^[\p{Lu}\p{Lt}\p{N}"'“‘([¿¡*]/u.test(rest)) continue;
        if (m[0].startsWith('.') && m[0].length === 1) {
          const before = p.slice(start, m.index);
          const lastWord = before.slice(before.lastIndexOf(' ') + 1);
          if (isAbbreviation(lastWord)) continue;
        }
      }
      const s = p.slice(start, end).trim();
      if (s) out.push(s);
      start = end;
    }
    const tail = p.slice(start).trim();
    if (tail) out.push(tail);
  }
  return out;
}

// ---------- markdown -> spoken text ----------
const TERMINAL = /[.!?…:;]["'”’)\]]*$/u;

function inline(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')                       // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')                     // links -> text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')               // [[wiki|alias]]
    .replace(/\[\[([^\]]+)\]\]/g, '$1')                          // [[wiki]]
    .replace(/<(https?:|mailto:)[^>]*>/g, '')                    // autolinks
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')                          // html tags
    .replace(/`([^`]*)`/g, '$1')                                 // inline code -> its text
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')            // bold
    .replace(/(^|[^\w*])\*(?=\S)([^*]*?\S)\*(?=[^\w*]|$)/g, '$1$2')   // *italic*
    .replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?=[^\w]|$)/g, '$1$2')       // _italic_ (not snake_case)
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '$1')                    // strike
    .replace(/\$\$?([^$]+)\$\$?/g, '$1')                         // $math$ -> its text
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Markdown -> the text a narrator reads, one paragraph / list item / heading per line, each line ending
 * in sentence punctuation (a '.' is appended when missing). Code fences, tables, images, html and rules
 * are silent; links keep their text; inline code keeps its text; emphasis markers are removed.
 */
export function spokenText(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const paras: string[] = [];
  let cur: string[] = [];
  let fence: string | null = null;
  const flush = () => { if (cur.length) { paras.push(cur.join(' ')); cur = []; } };
  for (const line of lines) {
    const t = line.trim();
    const f = t.match(/^(```|~~~)/);
    if (fence) { if (f && t.startsWith(fence)) fence = null; continue; }
    if (f) { flush(); fence = f[1]!; continue; }
    if (!t) { flush(); continue; }
    if (/^\|.*\|?$/.test(t) || /^:?-{3,}:?(\s*\|\s*:?-{3,}:?)+\|?$/.test(t)) { flush(); continue; }   // tables
    if (/^([-*_])(\s*\1){2,}$/.test(t)) { flush(); continue; }                                     // rules
    let body = t;
    let own = false;
    const h = body.match(/^#{1,6}\s+(.*)$/);
    if (h) { body = h[1]!.replace(/\s#+$/, ''); own = true; }
    body = body.replace(/^(>\s*)+/, '').replace(/^\[!\w+\][+-]?\s*/, '');                      // quotes, callouts
    const li = body.match(/^([-*+]|\d{1,3}[.)])\s+(\[[ xX]\]\s+)?(.*)$/);
    if (li) { flush(); body = li[3]!; own = true; }
    if (own) { flush(); cur.push(body); if (h) flush(); }
    else cur.push(body);
  }
  flush();
  return paras
    .map(inline)
    .filter(Boolean)
    .map(p => (TERMINAL.test(p) ? p : p + '.'))
    .join('\n');
}

// ---------- narrated fields per block type ----------
export interface SpokenSentence {
  id: string;          // "b3.4", "title.0"
  block: string;       // block id, or "title" / "plan"
  index: number;       // 0-based within the block
  field: string;       // payload path the sentence comes from: "markdown", "steps.2.detail_markdown", "points.1"
  text: string;
}
interface BlockLike { id: string; type: string; payload: unknown }

const get = (o: unknown, k: string): unknown => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined);
const s = (v: unknown): string => (typeof v === 'string' ? v : '');
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * The narrated fields of a block, in reading order: [field path, markdown]. Silent types (quiz, code,
 * flashcards, checklist, reference_table, speaking) return []. Answers are never read.
 */
export function blockSpokenFields(block: { type: string; payload: unknown }): [string, string][] {
  const p = block.payload;
  const f: [string, string][] = [];
  const add = (path: string, v: unknown) => { if (s(v).trim()) f.push([path, s(v)]); };
  switch (block.type) {
    case 'explainer': add('markdown', get(p, 'markdown')); break;
    case 'example': add('markdown', get(p, 'markdown')); break;
    case 'analogy': add('markdown', get(p, 'markdown')); add('breaks_down_when', get(p, 'breaks_down_when')); break;
    case 'misconception': add('belief', get(p, 'belief')); add('what_is_true', get(p, 'what_is_true')); break;
    case 'walkthrough':
      add('intro', get(p, 'intro'));
      arr(get(p, 'steps')).forEach((st, i) => { add(`steps.${i}.title`, get(st, 'title')); add(`steps.${i}.detail_markdown`, get(st, 'detail_markdown')); });
      break;
    case 'diagram': add('caption', get(p, 'caption')); break;
    case 'timeline': arr(get(p, 'events')).forEach((e, i) => { add(`events.${i}.title`, get(e, 'title')); add(`events.${i}.detail`, get(e, 'detail')); }); break;
    case 'comparison': add('intro', get(p, 'intro')); arr(get(p, 'items')).forEach((it, i) => add(`items.${i}.best_for`, get(it, 'best_for'))); break;
    case 'worked_example': add('problem_markdown', get(p, 'problem_markdown')); break;
    case 'playground': add('guidance_markdown', get(p, 'guidance_markdown')); break;
    case 'key_points': arr(get(p, 'points')).forEach((pt, i) => add(`points.${i}`, pt)); break;
    case 'scenario': add('setup_markdown', get(p, 'setup_markdown')); break;
    case 'project': add('brief_markdown', get(p, 'brief_markdown')); break;
    case 'dialogue': add('scenario_markdown', get(p, 'scenario_markdown')); break;
    case 'audio': add('script_markdown', get(p, 'script_markdown')); break;
    case 'reflection': add('prompt', get(p, 'prompt')); break;
    default: break;
  }
  return f;
}

/** Sentences of one block with stable ids `<blockId>.<n>`. */
export function blockSentences(block: BlockLike): SpokenSentence[] {
  const out: SpokenSentence[] = [];
  for (const [field, md] of blockSpokenFields(block)) {
    for (const text of splitSentences(spokenText(md))) {
      out.push({ id: `${block.id}.${out.length}`, block: block.id, index: out.length, field, text });
    }
  }
  return out;
}

/** Only the sentences of one field (the player wraps them inside that field's element). */
export const fieldSentences = (block: BlockLike, field: string): SpokenSentence[] =>
  blockSentences(block).filter(x => x.field === field);

/** Sentences of free text under a prefix: textSentences('plan', overview) -> plan.0, plan.1, ... */
export function textSentences(prefix: string, markdown: string): SpokenSentence[] {
  return splitSentences(spokenText(markdown)).map((text, index) => ({ id: `${prefix}.${index}`, block: prefix, index, field: prefix, text }));
}

/** The whole lesson narration script in playback order: `title.0` (the lesson title) then every block. */
export function lessonSentences(lesson: { title: string; blocks: BlockLike[] }, opts: { includeTitle?: boolean } = {}): SpokenSentence[] {
  const head = opts.includeTitle === false ? [] : textSentences('title', lesson.title).slice(0, 1);
  return [...head, ...lesson.blocks.flatMap(b => blockSentences(b))];
}

/**
 * True when a lesson's narration cues are exactly its sentence ids, in order (build.ts calls this and sets
 * `narration: null` for a lesson that changed after `narrate`, rather than shipping cues that highlight the
 * wrong sentence). A null/absent narration counts as matching.
 */
export function narrationMatches(lesson: { title: string; blocks: BlockLike[] },
  narration: { sentences: readonly { id: string }[] } | null | undefined): boolean {
  if (!narration) return true;
  const want = lessonSentences(lesson).map(s => s.id);
  const got = narration.sentences.map(s => s.id);
  return want.length === got.length && want.every((id, i) => id === got[i]);
}

/**
 * Locate sentences inside rendered text (e.g. an element's textContent), in order, whitespace-insensitive.
 * Returns [start, end) offsets into `haystack` per sentence, or null when not found (a trailing '.' that
 * spokenText added is ignored when the plain search fails). Lets the player wrap spans without re-parsing.
 */
export function sentenceRanges(haystack: string, sentences: readonly string[]): ([number, number] | null)[] {
  // normalised haystack with an index map back to the original
  const map: number[] = [];
  let norm = '';
  let prevSpace = true;
  for (let i = 0; i < haystack.length; i++) {
    const ch = haystack[i]!;
    if (/\s/.test(ch)) { if (!prevSpace) { norm += ' '; map.push(i); prevSpace = true; } continue; }
    norm += ch; map.push(i); prevSpace = false;
  }
  let cursor = 0;
  return sentences.map(sentence => {
    const n = sentence.replace(/\s+/g, ' ').trim();
    const tries = [n, n.replace(/[.!?…:;]+$/u, '')].filter(Boolean);
    for (const t of tries) {
      const at = norm.indexOf(t, cursor);
      if (at !== -1) {
        cursor = at + t.length;
        return [map[at]!, map[at + t.length - 1]! + 1] as [number, number];
      }
    }
    return null;
  });
}

/** Words in a text (for durations: ~150 wpm narration). */
export const wordCount = (t: string): number => (t.trim() ? t.trim().split(/\s+/).length : 0);

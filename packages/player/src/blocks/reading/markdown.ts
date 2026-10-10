// A small, safe Markdown renderer for model-written lesson text (ported from the SaaS useMarkdown.ts).
// Everything is HTML-escaped FIRST; the only tags that survive are the ones this file emits, so the
// output is safe for v-html. No raw HTML, no images (they degrade to a link), links only to
// http(s)/mailto/relative/#. Fenced code is rendered as an inert <pre> (it is silent for narration).

const SENTINEL = '\u0000';
const SAFE_HREF = /^(?:https?:\/\/|mailto:|\/|#|\.\/|sources\/)/i;
const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([A-Za-z0-9_+#.-]*)\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])\s*(?:\1\s*){2,}$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TABLE_DIVIDER = /^\s*\|?(?:\s*:?-{1,}:?\s*\|)+\s*:?-{1,}:?\s*\|?\s*$/;

export function escapeHtml(input: string): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function anchor(href: string, label: string, title?: string): string {
  const t = title ? ` title="${title}"` : '';
  return `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow"${t}>${label}</a>`;
}

/** One line of inline Markdown -> safe HTML (bold, italic, strike, code, links). */
export function renderInline(source: string): string {
  const slots: string[] = [];
  const hold = (html: string): string => { slots.push(html); return `${SENTINEL}${slots.length - 1}${SENTINEL}`; };
  let text = escapeHtml(String(source ?? '').split(SENTINEL).join(''));
  text = text.replace(/`([^`\n]+)`/g, (_m, code: string) => hold(`<code>${code}</code>`));
  text = text.replace(/!\[([^\]\n]*)\]\(\s*([^)\s]+)[^)]*\)/g, (m: string, alt: string, href: string) =>
    SAFE_HREF.test(href) ? hold(anchor(href, alt.trim() || 'image')) : m);
  text = text.replace(/\[([^\]\n]*)\]\(\s*([^)\s]+)(?:\s+&quot;([^)]*)&quot;)?\s*\)/g, (m: string, label: string, href: string, title?: string) =>
    SAFE_HREF.test(href) ? hold(anchor(href, label.trim() || href, title)) : m);
  text = text.replace(/(^|[\s(])(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g, (_m, lead: string, href: string) => `${lead}${hold(anchor(href, href))}`);
  text = text
    .replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    .replace(/~~([^~\n]+)~~/g, '<del>$1</del>')
    .replace(/(^|[^\w*])\*(?=\S)([^*\n]*?\S)\*(?=[^\w*]|$)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w\\])_(?=\S)([^_\n]*?\S)_(?=[^\w]|$)/g, '$1<em>$2</em>');
  for (let pass = 0; pass < 5 && text.includes(SENTINEL); pass++) {
    text = text.replace(new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, 'g'), (_m, i: string) => slots[Number(i)] ?? '');
  }
  return text.split(SENTINEL).join('');
}

export type MdToken =
  | { kind: 'heading'; level: number; html: string; text: string }
  | { kind: 'paragraph'; html: string }
  | { kind: 'list'; ordered: boolean; start: number; items: { html: string; depth: number }[] }
  | { kind: 'code'; language: string; code: string }
  | { kind: 'quote'; tokens: MdToken[] }
  | { kind: 'rule' }
  | { kind: 'table'; head: string[]; rows: string[][]; align: ('left' | 'center' | 'right')[] };

const splitRow = (line: string): string[] => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

export function parseMarkdown(source: string): MdToken[] {
  const lines = String(source ?? '').split(SENTINEL).join('').replace(/\r\n?/g, '\n').split('\n');
  const tokens: MdToken[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (line.trim() === '') { i++; continue; }
    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1] ?? '```';
      const body: string[] = [];
      i++;
      while (i < lines.length) {
        const cur = lines[i] ?? '';
        if (cur.trimStart().startsWith(marker)) { i++; break; }
        body.push(cur); i++;
      }
      tokens.push({ kind: 'code', language: (fence[2] ?? '').toLowerCase(), code: body.join('\n') });
      continue;
    }
    if (RULE.test(line)) { tokens.push({ kind: 'rule' }); i++; continue; }
    const h = HEADING.exec(line);
    if (h) { tokens.push({ kind: 'heading', level: Math.min(6, (h[1] ?? '#').length), html: renderInline(h[2] ?? ''), text: h[2] ?? '' }); i++; continue; }
    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length) {
        const cur = lines[i] ?? '';
        const q = QUOTE.exec(cur);
        if (!q) { if (cur.trim() === '') break; body.push(cur); } else body.push(q[1] ?? '');
        i++;
      }
      tokens.push({ kind: 'quote', tokens: parseMarkdown(body.join('\n')) });
      continue;
    }
    if (LIST_ITEM.test(line)) {
      const items: { html: string; depth: number }[] = [];
      const marker = LIST_ITEM.exec(line)?.[2] ?? '-';
      const ordered = /\d/.test(marker);
      const start = ordered ? Number.parseInt(marker, 10) || 1 : 1;
      while (i < lines.length) {
        const cur = lines[i] ?? '';
        const it = LIST_ITEM.exec(cur);
        if (!it) {
          const prev = items[items.length - 1];
          if (prev && cur.trim() !== '' && /^\s+\S/.test(cur)) { prev.html += ` ${renderInline(cur.trim())}`; i++; continue; }
          break;
        }
        const indent = (it[1] ?? '').replace(/\t/g, '  ').length;
        items.push({ html: renderInline(it[3] ?? ''), depth: Math.min(3, Math.floor(indent / 2)) });
        i++;
      }
      tokens.push({ kind: 'list', ordered, start, items });
      continue;
    }
    const next = lines[i + 1] ?? '';
    if (line.includes('|') && TABLE_DIVIDER.test(next)) {
      const head = splitRow(line);
      const align = splitRow(next).map(c => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left') as 'left' | 'center' | 'right');
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length) {
        const cur = lines[i] ?? '';
        if (cur.trim() === '' || !cur.includes('|')) break;
        rows.push(splitRow(cur).map(c => renderInline(c)));
        i++;
      }
      tokens.push({ kind: 'table', head: head.map(c => renderInline(c)), rows, align });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length) {
      const cur = lines[i] ?? '';
      if (cur.trim() === '' || FENCE.test(cur) || HEADING.test(cur) || RULE.test(cur) || QUOTE.test(cur) || LIST_ITEM.test(cur)) break;
      para.push(cur.trim()); i++;
    }
    if (para.length) tokens.push({ kind: 'paragraph', html: renderInline(para.join(' ')) });
  }
  return tokens;
}

export interface RenderOptions {
  /** First paragraph gets class "lead" (the lesson's opening paragraph). */
  lead?: boolean;
  /** Drop a leading heading (already promoted to the block title). */
  dropHeading?: string;
}

/** Markdown -> one safe HTML string, styled by `.prose` in reading.css. */
export function renderMarkdown(source: string, opts: RenderOptions = {}): string {
  let tokens = parseMarkdown(source);
  if (opts.dropHeading && tokens[0]?.kind === 'heading' && tokens[0].text.trim() === opts.dropHeading.trim()) tokens = tokens.slice(1);
  let leadDone = !opts.lead;
  const out: string[] = [];
  const walk = (list: MdToken[], nested: boolean) => {
    for (const t of list) {
      switch (t.kind) {
        case 'heading': out.push(t.level <= 2 ? `<h3>${t.html}</h3>` : `<h4>${t.html}</h4>`); break;
        case 'paragraph':
          if (!leadDone && !nested) { out.push(`<p class="lead">${t.html}</p>`); leadDone = true; }
          else out.push(`<p>${t.html}</p>`);
          break;
        case 'list': {
          const tag = t.ordered ? 'ol' : 'ul';
          const startAttr = t.ordered && t.start !== 1 ? ` style="counter-reset: n ${t.start - 1}"` : '';
          out.push(`<${tag}${startAttr}>${t.items.map(it => `<li${it.depth ? ` style="margin-left:${it.depth * 1.2}em"` : ''}>${it.html}</li>`).join('')}</${tag}>`);
          break;
        }
        case 'code': out.push(`<pre class="md-code"${t.language ? ` data-lang="${escapeHtml(t.language)}"` : ''}><code>${escapeHtml(t.code)}</code></pre>`); break;
        case 'quote': out.push('<blockquote>'); walk(t.tokens, true); out.push('</blockquote>'); break;
        case 'rule': out.push('<hr>'); break;
        case 'table': {
          const al = (i: number) => (t.align[i] && t.align[i] !== 'left' ? ` style="text-align:${t.align[i]}"` : '');
          out.push(`<div class="md-table"><table><thead><tr>${t.head.map((c, i) => `<th${al(i)}>${c}</th>`).join('')}</tr></thead><tbody>${
            t.rows.map(r => `<tr>${r.map((c, i) => `<td${al(i)}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
          break;
        }
      }
    }
  };
  walk(tokens, false);
  return out.join('');
}

/** Plain text of a markdown string (aria labels, tooltips). */
export function markdownToText(source: string): string {
  return String(source ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/(\*\*|__|~~)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Escaped text for an UPPERCASE eyebrow/header: Greek letters keep their case (text-transform would turn
 * α into Α, which reads as an A). Wraps each Greek run in <span class="nt">.
 */
export function keepCase(text: string): string {
  return escapeHtml(text).replace(/[Ͱ-Ͽἀ-῿]+/g, m => `<span class="nt">${m}</span>`);
}
export const hasGreek = (text: string): boolean => /[Ͱ-Ͽἀ-῿]/.test(text);

// ---------- key terms ----------
export interface KeyTerm { term: string; def: string | null }

const norm = (s: string): string => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, ' ')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().replace(/(?<=\p{L}{3})s\b/gu, '');

/** Glossary from the lesson's own cards (flashcards front -> back). */
export function lessonGlossary(lesson: { blocks: { type: string; payload: unknown }[] }): { term: string; def: string }[] {
  const out: { term: string; def: string }[] = [];
  for (const b of lesson.blocks) {
    if (b.type !== 'flashcards') continue;
    const cards = (b.payload as { cards?: { front?: string; back?: string }[] })?.cards ?? [];
    for (const c of cards) if (c.front && c.back && c.front.length <= 60) out.push({ term: c.front, def: c.back });
  }
  return out;
}

/** Best definition for a bolded term: exact match first, then a card front that starts with or contains it. */
export function findDefinition(term: string, glossary: { term: string; def: string }[]): string | null {
  const t = norm(term);
  if (!t || t.length < 3) return null;
  const exact = glossary.find(g => norm(g.term) === t);
  if (exact) return exact.def;
  const starts = glossary.find(g => { const n = norm(g.term); return n.startsWith(t + ' ') || t.startsWith(n + ' '); });
  if (starts) return starts.def;
  const has = glossary.find(g => { const n = norm(g.term); return n.length >= 5 && (` ${t} `.includes(` ${n} `) || ` ${n} `.includes(` ${t} `)); });
  return has ? has.def : null;
}

/**
 * Turn `<strong>term</strong>` in rendered HTML into focusable key-term marks (dotted underline +
 * tooltip) when the lesson defines the term; returns the new HTML and the ordered unique bold terms.
 */
export function markKeyTerms(html: string, glossary: { term: string; def: string }[]): { html: string; terms: KeyTerm[] } {
  const terms: KeyTerm[] = [];
  const seen = new Map<string, number>();
  const out = html.replace(/<strong>([^<]{2,60})<\/strong>/g, (m, inner: string) => {
    const key = norm(inner);
    if (!key) return m;
    let idx = seen.get(key);
    if (idx === undefined) {
      idx = terms.length;
      seen.set(key, idx);
      terms.push({ term: inner.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"), def: findDefinition(inner, glossary) });
    }
    return terms[idx]!.def ? `<strong class="kt" tabindex="0" data-kt="${idx}">${inner}</strong>` : m;
  });
  return { html: out, terms };
}

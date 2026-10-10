// v-sentences: wraps each narrated sentence of a field in <span class="s" data-s="b2.4"> so the shell's
// narration dock can highlight it (player-design 4.6). Sentence ids/texts come from core fieldSentences();
// locations come from core sentenceRanges() over the element's rendered text, so markdown never has to be
// re-parsed. A sentence split by inline markup (bold, code) becomes several spans with the same data-s.
import type { Directive } from 'vue';
import { sentenceRanges } from '@bilimind/core';

export interface SentenceRef { id: string; text: string }

function wrapRange(nodes: Text[], starts: number[], a: number, b: number, id: string): void {
  for (let k = nodes.length - 1; k >= 0; k--) {
    const node = nodes[k]!;
    const s0 = starts[k]!;
    const s1 = s0 + node.data.length;
    if (s1 <= a || s0 >= b) continue;
    const lo = Math.max(a, s0) - s0;
    const hi = Math.min(b, s1) - s0;
    if (hi <= lo || !node.data.slice(lo, hi).trim()) continue;
    if (hi < node.data.length) node.splitText(hi);
    const mid = lo > 0 ? node.splitText(lo) : node;
    const span = document.createElement('span');
    span.className = 's';
    span.dataset.s = id;
    mid.parentNode?.insertBefore(span, mid);
    span.appendChild(mid);
  }
}

export function wrapSentences(el: HTMLElement, sentences: readonly SentenceRef[] | null | undefined): void {
  if (!sentences?.length || el.querySelector('span.s[data-s]')) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  const starts: number[] = [];
  let full = '';
  while (walker.nextNode()) {
    const t = walker.currentNode as Text;
    starts.push(full.length);
    nodes.push(t);
    full += t.data;
  }
  const ranges = sentenceRanges(full, sentences.map(s => s.text));
  for (let i = ranges.length - 1; i >= 0; i--) {
    const r = ranges[i];
    if (r) wrapRange(nodes, starts, r[0], r[1], sentences[i]!.id);
  }
}

export const vSentences: Directive<HTMLElement, readonly SentenceRef[] | null | undefined> = {
  mounted(el, binding) { wrapSentences(el, binding.value); },
  updated(el, binding) { wrapSentences(el, binding.value); },
};

// Sentence spans for the narration highlight (player-design §4.6). Every narrated field is rendered
// into an element carrying data-field="<payload path>" (always via v-html, so mutating its DOM never
// fights Vue's patching). After render, wrapSentences() wraps each sentence of that field in
// <span class="s" data-s="<blockId>.<n>"> using core fieldSentences + sentenceRanges, so the cue ids
// are exactly the engine's narration cue ids. A sentence that crosses inline tags (bold, code) becomes
// several spans with the same data-s; the dock highlights with querySelectorAll('[data-s="b1.3"]').
import { blockSentences, sentenceRanges } from '@bilimind/core';
import { nextTick, onMounted, onUpdated, type Ref } from 'vue';

interface BlockLike { id?: string; type: string; payload: unknown }

/** Text nodes under `root` that are read aloud (code fences are silent, never matched). */
function textNodes(root: Element): Text[] {
  const out: Text[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => {
      const silent = n.parentElement?.closest('pre, .no-cue');
      return silent && root.contains(silent) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
  return out;
}

/** Wrap one field element's sentences. Returns how many sentences were located. */
export function wrapField(el: Element, sentences: { id: string; text: string }[]): number {
  if (!sentences.length || el.querySelector('.s[data-s]')) return 0;
  const nodes = textNodes(el);
  let hay = '';
  const starts: number[] = [];
  for (const n of nodes) { starts.push(hay.length); hay += n.data; }
  const ranges = sentenceRanges(hay, sentences.map(s => s.text));
  // per text node: list of [localStart, localEnd, id]
  const cuts = new Map<number, [number, number, string][]>();
  let found = 0;
  ranges.forEach((r, si) => {
    if (!r) return;
    found++;
    const [a, b] = r;
    for (let ni = 0; ni < nodes.length; ni++) {
      const s0 = starts[ni]!;
      const s1 = s0 + nodes[ni]!.data.length;
      if (s1 <= a || s0 >= b) continue;
      const lo = Math.max(a, s0) - s0;
      const hi = Math.min(b, s1) - s0;
      if (hi > lo && nodes[ni]!.data.slice(lo, hi).trim()) {
        const list = cuts.get(ni) ?? [];
        list.push([lo, hi, sentences[si]!.id]);
        cuts.set(ni, list);
      }
    }
  });
  const doc = el.ownerDocument;
  for (const [ni, list] of cuts) {
    const node = nodes[ni]!;
    const text = node.data;
    const frag = doc.createDocumentFragment();
    let at = 0;
    for (const [lo, hi, id] of list.sort((x, y) => x[0] - y[0])) {
      if (lo > at) frag.append(text.slice(at, lo));
      const span = doc.createElement('span');
      span.className = 's';
      span.dataset.s = id;
      span.textContent = text.slice(lo, hi);
      frag.append(span);
      at = hi;
    }
    if (at < text.length) frag.append(text.slice(at));
    node.replaceWith(frag);
  }
  return found;
}

/** Wrap every [data-field] inside a block root. Idempotent (a wrapped field is skipped). */
export function wrapSentences(root: Element | null | undefined, block: BlockLike): number {
  if (!root || !block.id) return 0;
  const all = blockSentences(block as { id: string; type: string; payload: unknown });
  if (!all.length) return 0;
  let n = 0;
  const fields = root.matches('[data-field]') ? [root] : [];
  fields.push(...Array.from(root.querySelectorAll('[data-field]')));
  for (const el of fields) {
    const field = el.getAttribute('data-field') ?? '';
    n += wrapField(el, all.filter(s => s.field === field));
  }
  return n;
}

/** Composable: wrap after mount and after every re-render (v-html resets a field's spans). */
export function useCues(root: Ref<HTMLElement | null>, block: () => BlockLike): void {
  const run = () => nextTick(() => { try { wrapSentences(root.value, block()); } catch (e) { console.warn('[bilimind] cue wrap', e); } });
  onMounted(run);
  onUpdated(run);
}

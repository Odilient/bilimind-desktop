// Wraps narrated sentences in <span class="s" data-s="b3.4"> after a block renders, so the narration
// clock can light the sentence being read. Uses the same splitter as the engine's TTS script
// (core blockSentences), so cue ids match. Blocks do not have to do anything; a block that already
// renders its own [data-s] spans is left alone. A block may mark a field's container with
// data-field="steps.2.detail_markdown" to scope that field's sentences; otherwise the whole block is searched.
import { blockSentences } from '@bilimind/core';
import type { CourseBlock } from '@bilimind/core';
import { planWraps } from './cues.ts';

const SKIP = 'pre, .cite, .cite-pop, button, script, style, textarea, input, select, svg, .blk-h, .blk-t, .bf-cites, [data-silent], .s, .katex, .mermaid';

function textNodes(root: Element): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p || !n.nodeValue) return NodeFilter.FILTER_REJECT;
      const skip = p.closest(SKIP);
      return skip && root.contains(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
  return out;
}

function applyWraps(root: Element, sentences: { id: string; text: string }[]): number {
  if (!sentences.length) return 0;
  const nodes = textNodes(root);
  const segs = planWraps(nodes.map(n => n.nodeValue ?? ''), sentences);
  const byNode = new Map<number, typeof segs>();
  for (const s of segs) { if (!byNode.has(s.node)) byNode.set(s.node, []); byNode.get(s.node)!.push(s); }
  for (const [i, list] of byNode) {
    const node = nodes[i]!;
    list.sort((a, b) => b.start - a.start);          // from the end, so earlier offsets stay valid
    for (const seg of list) {
      const mid = node.splitText(seg.start);
      mid.splitText(seg.end - seg.start);
      const span = document.createElement('span');
      span.className = 's';
      span.dataset.s = seg.id;
      mid.parentNode!.insertBefore(span, mid);
      span.appendChild(mid);
    }
  }
  return new Set(segs.map(s => s.id)).size;
}

/** Wrap one block's sentences inside `root` (the block's frame). Returns how many sentences were found. */
export function wrapBlock(root: Element, block: Pick<CourseBlock, 'id' | 'type' | 'payload'>): number {
  if (root.querySelector('[data-s]')) return -1;     // the block did it itself, or already wrapped
  const all = blockSentences(block);
  if (!all.length) return 0;
  const fields = Array.from(root.querySelectorAll<HTMLElement>('[data-field]'));
  if (!fields.length) return applyWraps(root, all);
  let n = 0;
  for (const el of fields) n += applyWraps(el, all.filter(s => s.field === el.dataset.field));
  return n;
}

/**
 * Keep every block frame under `container` wrapped, also after a block re-renders (a MutationObserver,
 * debounced). Frames are elements with [data-frame=<blockId>]; `blockById` resolves their data.
 */
export function keepWrapped(container: Element, blockById: (id: string) => CourseBlock | undefined): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => {
    timer = null;
    for (const el of Array.from(container.querySelectorAll<HTMLElement>('[data-frame]'))) {
      const b = blockById(el.dataset.frame ?? '');
      if (!b) continue;
      const len = String(el.textContent?.length ?? 0);
      if (el.dataset.wrapLen === len && !el.querySelector('[data-s]') && el.dataset.wrapped === '0') continue;
      if (el.querySelector('[data-s]')) continue;
      try {
        const n = wrapBlock(el, b);
        el.dataset.wrapped = String(Math.max(0, n));
        el.dataset.wrapLen = String(el.textContent?.length ?? 0);
      } catch (e) { console.warn('[bilimind] could not mark sentences in', b.id, e); }
    }
  };
  const mo = new MutationObserver(() => { if (!timer) timer = setTimeout(run, 120); });
  mo.observe(container, { childList: true, subtree: true, characterData: true });
  run();
  return () => { mo.disconnect(); if (timer) clearTimeout(timer); };
}

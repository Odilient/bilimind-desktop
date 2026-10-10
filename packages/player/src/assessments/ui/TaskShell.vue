<script setup lang="ts">
// The shared frame of an interactive block (player-design 5.0): icon tile (lime for tasks) + eyebrow +
// header actions, the block title, the body, and a footer with the block's citation chips.
// data-block / data-type / data-passed are what the shell's table of blocks and progress read.
import { computed } from 'vue';
import { BLOCK_META, isEnabledType } from '@bilimind/core';
import type { Cite } from '@bilimind/core';
import Ico from './Ico.vue';
import CiteChip from '../../components/CiteChip.vue';

const props = withDefaults(defineProps<{
  block: { id: string; type: string; title?: string | null; cites?: Cite[] };
  title?: string | null;
  eyebrow?: string;
  passed?: boolean;
  frame?: 'card' | 'plain';
  wide?: boolean;
  hideCites?: boolean;
}>(), { frame: 'card', passed: false, wide: false, hideCites: false });

const meta = computed(() => (isEnabledType(props.block.type) ? BLOCK_META[props.block.type] : null));
const icon = computed(() => (meta.value?.icon ?? 'i-spark').replace(/^i-/, ''));
const shownTitle = computed(() => (props.title === undefined ? props.block.title : props.title) || '');
const cites = computed(() => (props.hideCites ? [] : (props.block.cites ?? []).filter(c => c && c.quote)));
</script>

<template>
  <section class="blk bmx" :class="[frame, { task: meta?.task !== false, passed, wide }]" :id="`blk-${block.id}`"
    :data-block="block.id" :data-type="block.type" :data-passed="passed ? 'true' : undefined">
    <header class="blk-h">
      <span class="bi"><Ico :name="icon" /></span>
      <span class="be">{{ eyebrow ?? meta?.eyebrow ?? '' }}</span>
      <span class="act">
        <slot name="actions" />
        <span v-if="passed" class="tag ok stamp" data-passed-tag><Ico name="check" />Passed</span>
      </span>
    </header>
    <h3 v-if="shownTitle" class="blk-t">{{ shownTitle }}</h3>
    <slot />
    <footer v-if="cites.length || $slots.foot" class="blk-foot">
      <slot name="foot" />
      <template v-if="cites.length">
        <span class="from">From your files</span>
        <CiteChip v-for="(c, i) in cites" :key="i" :cite="c" />
      </template>
    </footer>
  </section>
</template>

<style>
/* Shared block chrome (player-design 5.0). Same values as the shell's styles, scoped to .bmx so the two can coexist. */
.bmx.blk { position: relative; scroll-margin-top: calc(var(--topbar-h, 64px) + 20px); margin: 0; color: var(--text); font: var(--t-ui); }
.bmx.card { background: var(--surface); border-radius: var(--r-block); box-shadow: var(--hair), var(--sh-card); padding: clamp(18px, 2vw, 26px) clamp(18px, 2.2vw, 28px) clamp(20px, 2.2vw, 28px); }
.bmx.card.passed { box-shadow: inset 0 0 0 1.5px var(--lime-2), var(--sh-card); }
.bmx .blk-h { display: flex; align-items: center; gap: 10px; min-height: 26px; margin: 0 0 12px; }
.bmx .blk-h .bi { width: 26px; height: 26px; border-radius: 8px; flex: none; display: grid; place-items: center; background: var(--cobalt-soft); color: var(--cobalt); }
.bmx .blk-h .bi .bm-ico { width: 13px; height: 13px; }
.bmx.task .blk-h .bi { background: var(--lime); color: var(--ink); }
.bmx .blk-h .be { font: var(--t-eyebrow); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--text-3); white-space: nowrap; }
.bmx .blk-h .act { margin-left: auto; display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; }
.bmx .blk-t { margin: 0 0 12px; font: var(--t-h3); letter-spacing: var(--track-h); color: var(--text); text-wrap: balance; }
.bmx .blk-foot { margin-top: 16px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font: var(--t-cap); color: var(--text-3); }
.bmx .blk-foot .from { margin-right: 2px; }
.bmx .tag { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px; border-radius: var(--r-pill); font: 600 11.5px/1 var(--body); color: var(--text-2); box-shadow: var(--hair-strong); background: var(--surface); white-space: nowrap; }
.bmx .tag .bm-ico { width: 11px; height: 11px; }
.bmx .tag.ok { background: var(--lime-soft); color: var(--lime-ink); box-shadow: inset 0 0 0 1px var(--lime-line); }
.bmx .tag.bad { background: var(--coral-soft); color: var(--coral-ink); box-shadow: none; }
.bmx .tag.cob { background: var(--cobalt-soft); color: var(--cobalt); box-shadow: none; }
.bmx .tag.ink { background: var(--ink); color: #fff; box-shadow: none; }
.bmx .tag.lime { background: var(--lime); color: var(--ink); box-shadow: none; }
.bmx .tag.note { background: var(--note-bg); color: var(--note-ink); box-shadow: inset 0 0 0 1px var(--note-line); }
.bmx .tag.quiet { box-shadow: none; background: var(--fill); color: var(--text-2); }
.bmx .tag.stamp { animation: stamp .45s var(--ease-pop) both; }
@media (max-width: 520px) { .bmx .blk-h { flex-wrap: wrap; } .bmx .blk-h .act .opt-long { display: none; } }
@media (max-width: 900px) { .bmx.card { padding: 16px 16px 18px; } }

/* Buttons used across the interactive blocks */
.bmx .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 40px; padding: 0 18px; border-radius: var(--r-pill); font: 600 14px/1 var(--body); white-space: nowrap; transition: transform var(--d-press), background var(--d-fast), box-shadow var(--d-fast), color var(--d-fast), opacity var(--d-fast); }
.bmx .btn:active:not([disabled]) { transform: scale(.97); }
.bmx .btn .bm-ico { width: 14px; height: 14px; }
.bmx .btn.ink { background: var(--ink); color: #fff; }
.bmx .btn.ink:hover:not([disabled]) { background: var(--ink-hover); }
.bmx .btn.lime { background: var(--lime); color: var(--ink); }
.bmx .btn.lime:hover:not([disabled]) { background: var(--lime-hover); }
.bmx .btn.ghost { background: var(--surface); color: var(--ink-3); box-shadow: var(--hair-strong); }
.bmx .btn.ghost:hover:not([disabled]) { background: var(--fill); }
.bmx .btn.soft { background: var(--cobalt-soft); color: var(--cobalt); }
.bmx .btn.sm { height: 34px; padding: 0 14px; font-size: 13px; }
.bmx .btn[disabled] { opacity: .45; cursor: not-allowed; }
.bmx .btn.wt-clear { height: 28px; padding: 0 10px; font-size: 12px; }
.bmx .wt-clear .bm-ico { width: 12px; height: 12px; }
.bmx .btn.ink[disabled] { background: var(--mute); color: #fff; opacity: 1; }

/* Markdown inside task text */
.bmx .md { font: var(--t-read); color: var(--text-body); max-width: 68ch; }
.bmx .md.sm { font: 400 16px/1.6 var(--body); }
.bmx .md > :first-child { margin-top: 0; }
.bmx .md > :last-child { margin-bottom: 0; }
.bmx .md p { margin: 0 0 .8em; text-wrap: pretty; }
.bmx .md strong, .bmx .md b { font-weight: 600; color: var(--text); }
.bmx .md code, .bmx .inl code { font: 500 .86em/1 var(--mono); padding: .18em .42em; border-radius: 6px; background: var(--fill); color: var(--ink); overflow-wrap: anywhere; }
.bmx .md pre { max-width: 100%; margin: .6em 0 1em; padding: 12px 14px; border-radius: 12px; background: var(--code-bg); color: var(--code-text); overflow: auto; font: var(--t-code); }
.bmx .md pre code { padding: 0; background: none; color: inherit; font: inherit; overflow-wrap: normal; }
.bmx .md table { display: block; max-width: 100%; overflow-x: auto; }
.bmx .md ul, .bmx .md ol { margin: .3em 0 .9em; padding: 0; list-style: none; }
.bmx .md ul li { position: relative; padding-left: 24px; margin: .35em 0; }
.bmx .md ul li::before { content: ""; position: absolute; left: 6px; top: .68em; width: 7px; height: 7px; border-radius: 1.5px; background: var(--cobalt); transform: rotate(45deg); }
.bmx .md ol { counter-reset: n; }
.bmx .md ol li { counter-increment: n; position: relative; padding-left: 34px; margin: .5em 0; }
.bmx .md ol li::before { content: counter(n); position: absolute; left: 0; top: .15em; width: 22px; height: 22px; border-radius: 50%; background: var(--ink); color: #fff; font: 600 11.5px/22px var(--display); text-align: center; }
.bmx .md a, .bmx .inl a { color: var(--cobalt); text-decoration: underline; text-underline-offset: 3px; }
.bmx .eyebrow-s { font: var(--t-eyebrow); letter-spacing: var(--track-eyebrow); text-transform: uppercase; color: var(--text-3); }
.bmx .bm-ico { display: block; flex: none; }
.bmx .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.bmx .box { width: 22px; height: 22px; flex: none; border-radius: 7px; display: grid; place-items: center; background: var(--surface); box-shadow: inset 0 0 0 1.5px rgb(11 13 16 / 0.2); color: transparent; transition: background var(--d-fast), color var(--d-fast), box-shadow var(--d-fast); }
.bmx .box .bm-ico { width: 13px; height: 13px; }
.bmx .on > .box, .bmx .tick.on .box { background: var(--lime); box-shadow: none; color: var(--ink); animation: stamp .3s var(--ease-pop); }
/* shared tick row (checklist, project deliverables) */
.bmx .tick { position: relative; display: flex; align-items: flex-start; gap: 12px; padding: 10px 12px; border-radius: var(--r-row); cursor: pointer; transition: background var(--d-fast); }
.bmx .tick:hover { background: var(--sunken); }
.bmx .tick input { position: absolute; opacity: 0; pointer-events: none; }
.bmx .tick:has(input:focus-visible) { outline: 3px solid var(--ink); outline-offset: 2px; }
.bmx .tick .box { margin-top: 1px; }
.bmx .tick.on { background: var(--lime-wash); }
@keyframes stamp { 0% { transform: scale(1.6) rotate(-8deg); opacity: 0; } 60% { transform: scale(.94) rotate(2deg); opacity: 1; } 100% { transform: scale(1) rotate(0); } }
@keyframes shake { 20%, 60% { transform: translateX(-5px); } 40%, 80% { transform: translateX(5px); } }
@keyframes pop { from { transform: translateY(18px) scale(.96); opacity: 0; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
@keyframes ping { 0% { box-shadow: 0 0 0 0 rgb(198 242 78 / 0.7); } 100% { box-shadow: 0 0 0 12px rgb(198 242 78 / 0); } }
</style>

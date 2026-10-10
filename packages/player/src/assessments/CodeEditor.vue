<script setup lang="ts">
// The ink editor (player-design 5.5): a transparent <textarea> over a highlighted <pre> with identical
// metrics, a line-number gutter, Tab = 2 spaces, Shift+Tab outdent, Enter keeps the indent, Esc releases
// focus (keyboard users are never trapped), Ctrl/Cmd+Enter runs.
import { computed, ref } from 'vue';
import { highlight } from './highlight.ts';

const props = withDefaults(defineProps<{ language?: string; label?: string; minLines?: number }>(), { language: 'javascript', label: 'Code editor', minLines: 8 });
const code = defineModel<string>({ required: true });
const emit = defineEmits<{ run: [] }>();
const ta = ref<HTMLTextAreaElement | null>(null);

const lines = computed(() => Math.max(props.minLines, code.value.split('\n').length));
const gutter = computed(() => Array.from({ length: lines.value }, (_, i) => i + 1).join('\n'));
const html = computed(() => highlight(code.value, props.language) + '\n');

function insert(text: string) {
  const el = ta.value!;
  // execCommand keeps the browser's undo stack; setRangeText is the fallback
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const ok = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
  if (!ok) {
    el.setRangeText(text, el.selectionStart, el.selectionEnd, 'end');
    code.value = el.value;
  }
}
function lineStart(v: string, at: number) { return v.lastIndexOf('\n', at - 1) + 1; }

function onKey(e: KeyboardEvent) {
  const el = ta.value!;
  if (e.key === 'Escape') { e.preventDefault(); el.blur(); return; }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); emit('run'); return; }
  if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
    e.preventDefault();
    const v = el.value;
    const ls = lineStart(v, el.selectionStart);
    const indent = /^[ \t]*/.exec(v.slice(ls, el.selectionStart))![0];
    const extra = /[{([:]\s*$/.test(v.slice(ls, el.selectionStart)) ? '  ' : '';
    insert('\n' + indent + extra);
    return;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    const v = el.value;
    const s = el.selectionStart;
    const end = el.selectionEnd;
    const ls = lineStart(v, s);
    if (e.shiftKey || v.slice(s, end).includes('\n')) {
      const le = v.indexOf('\n', end) === -1 ? v.length : v.indexOf('\n', end);
      const block = v.slice(ls, le);
      const next = block.split('\n').map(l => (e.shiftKey ? l.replace(/^ {1,2}/, '') : '  ' + l)).join('\n');
      el.setSelectionRange(ls, le);
      insert(next);
      el.setSelectionRange(ls, ls + next.length);
    } else insert('  ');
  }
}
function onInput(e: Event) { code.value = (e.target as HTMLTextAreaElement).value; }
defineExpose({ focus: () => ta.value?.focus() });
</script>

<template>
  <div class="cs-ed">
    <pre class="gut" aria-hidden="true">{{ gutter }}</pre>
    <div class="area">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <pre class="hl" aria-hidden="true" v-html="html" />
      <textarea ref="ta" :value="code" rows="1" cols="1" wrap="off" spellcheck="false" autocapitalize="off" autocomplete="off"
        autocorrect="off" :aria-label="label" data-code-editor @input="onInput" @keydown="onKey" />
    </div>
  </div>
</template>

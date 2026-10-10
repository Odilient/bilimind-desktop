<script setup lang="ts">
// The one cite popover: source title, locator, the excerpt with the matched quote marked, "Open page N".
import { computed, inject, onBeforeUnmount, onMounted } from 'vue';
import { COURSE_KEY } from '../course.ts';
import { citeHref, fileKind, markQuote, sourceFor } from '../runtime/model.ts';
import { citePop, closeCite } from '../runtime/ui.ts';

const course = inject(COURSE_KEY, null);
const src = computed(() => (course && citePop.cite ? sourceFor(course, citePop.cite.file) : undefined));
const parts = computed(() => (citePop.cite ? markQuote(citePop.cite.excerpt || '', citePop.cite.quote) : null));
const title = computed(() => src.value?.title ?? citePop.cite?.file.split('/').pop() ?? 'Source');
const where = computed(() => citePop.cite?.locator || (citePop.cite?.page ? `Page ${citePop.cite.page}` : ''));
const openLabel = computed(() => (citePop.cite?.page ? `Open page ${citePop.cite.page}` : 'Open the file'));

function onDoc(e: MouseEvent) {
  const t = e.target as HTMLElement | null;
  if (!citePop.cite || !t) return;
  if (t.closest('.cite-pop') || t.closest('.cite')) return;
  closeCite();
}
function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && citePop.cite) { const a = citePop.anchor; closeCite(); a?.focus(); } }
function onResize() { if (citePop.cite) closeCite(); }
onMounted(() => { document.addEventListener('click', onDoc); document.addEventListener('keydown', onKey); window.addEventListener('resize', onResize); });
onBeforeUnmount(() => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); });
</script>

<template>
  <Teleport to="body">
    <div v-if="citePop.cite" class="cite-pop" role="dialog" aria-label="Source passage" :style="{ left: citePop.x + 'px', top: citePop.y + 'px' }">
      <div class="hd">
        <i>{{ fileKind(src ?? { file: citePop.cite.file }) }}</i>
        <div><b>{{ title }}</b><small>{{ where }}</small></div>
      </div>
      <blockquote>
        <template v-if="parts">{{ parts[0] }}<mark>{{ parts[1] }}</mark>{{ parts[2] }}</template>
        <template v-else-if="citePop.cite.excerpt">{{ citePop.cite.excerpt }}<span class="q">“{{ citePop.cite.quote }}”</span></template>
        <template v-else><mark>{{ citePop.cite.quote }}</mark></template>
      </blockquote>
      <div class="ft">
        <small>Checked against your file</small>
        <a :href="citeHref(citePop.cite)" target="_blank" rel="noopener">{{ openLabel }}<svg aria-hidden="true"><use href="#i-ext" /></svg></a>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// Table of blocks as a mini path (player-design §4.4): seen / current / task / passed states, the ink rail
// fill down to the current part, and an equaliser on the part being read aloud.
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { BLOCK_META } from '@bilimind/core';
import type { CourseLesson } from '@bilimind/core';
import { partIcon, partName } from '../runtime/model.ts';

const props = defineProps<{ lesson: CourseLesson; seen: Set<string>; passed: Set<string>; currentIndex: number; speaking: string }>();
const emit = defineEmits<{ jump: [blockId: string] }>();
const list = ref<HTMLElement | null>(null);
const fill = ref(0);
const tasks = computed(() => props.lesson.blocks.filter(b => BLOCK_META[b.type]?.task));
const left = computed(() => tasks.value.filter(b => !props.passed.has(b.id)).length);

function measure() {
  const ol = list.value;
  if (!ol) return;
  const items = ol.querySelectorAll<HTMLElement>('li:not(.fill)');
  const it = items[Math.max(0, props.currentIndex)];
  if (!it) { fill.value = 0; return; }
  fill.value = Math.max(0, it.offsetTop + it.offsetHeight / 2 - 14);
}
// G2: two parts with the same name are numbered ("Explanation 2"), or use the block's own title
function navLabel(i: number): string {
  const b = props.lesson.blocks[i]!;
  const name = partName(b);
  const same = props.lesson.blocks.filter(x => partName(x) === name);
  if (same.length < 2) return name;
  const title = (b as { title?: string }).title?.trim();
  if (title && title.length <= 34) return title;
  return `${name} ${same.indexOf(b) + 1}`;
}
watch(() => props.currentIndex, () => nextTick(measure));
onMounted(() => nextTick(measure));
</script>

<template>
  <nav class="toc" aria-label="Parts of this lesson">
    <ol ref="list">
      <li class="fill" aria-hidden="true" :style="{ '--fill': fill + 'px' }"></li>
      <li v-for="(b, i) in lesson.blocks" :key="b.id">
        <a :href="`#bf-${b.id}`" :class="{ seen: seen.has(b.id), task: BLOCK_META[b.type]?.task, passed: passed.has(b.id), speaking: speaking === b.id }"
           :aria-current="i === currentIndex ? 'true' : undefined" @click.prevent="emit('jump', b.id)">
          <span class="dt"></span>
          <span class="ti"><svg aria-hidden="true"><use :href="'#' + partIcon(b)" /></svg><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></span>
          <span>{{ navLabel(i) }}</span>
        </a>
      </li>
    </ol>
    <p v-if="tasks.length" class="toc-foot">
      <span v-if="left" class="tag">{{ left }} task{{ left > 1 ? 's' : '' }} left</span>
      <span v-else class="tag ok">All tasks done</span>
    </p>
  </nav>
</template>

<style>
.toc .fill { list-style: none; }
.toc-foot { margin: 14px 0 0 34px; }
</style>

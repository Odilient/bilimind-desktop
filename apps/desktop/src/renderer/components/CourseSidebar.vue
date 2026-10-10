<script setup lang="ts">
// The course workspace's left side: the course and the learner's sentence, the lessons by day (the open one
// highlighted, done ones ticked), the study plan and the learner's files, and the way back to the library.
import { computed } from 'vue';
import Icon from './Icon.vue';
import type { OutlineLesson } from '../env';
import type { WorkView } from '../workspace';

const props = defineProps<{
  title: string;
  sentence: string;
  lessons: OutlineLesson[];
  files: number;
  view: WorkView;
  current: string;
  done: string[];
}>();
const emit = defineEmits<{ lesson: [l: OutlineLesson]; view: [v: WorkView]; back: []; reveal: [] }>();

const doneSet = computed(() => new Set(props.done));
const doneN = computed(() => props.lessons.filter((l) => doneSet.value.has(l.id)).length);
const groups = computed(() => {
  const withDay = props.lessons.some((l) => l.day);
  const out: { label: string; items: { l: OutlineLesson; n: number }[] }[] = [];
  props.lessons.forEach((l, i) => {
    const label = withDay ? (l.day ? `Day ${l.day}` : 'Any day') : 'Lessons';
    let g = out.find((x) => x.label === label);
    if (!g) { g = { label, items: [] }; out.push(g); }
    g.items.push({ l, n: i + 1 });
  });
  return out;
});
const isActive = (l: OutlineLesson) => props.view === 'lesson' && props.current === l.id;
</script>

<template>
  <aside class="side" aria-label="Course">
    <div class="top">
      <button class="back" @click="emit('back')"><Icon name="i-back" /> Library</button>
    </div>

    <div class="course">
      <h2 :title="title">{{ title }}</h2>
      <p v-if="sentence" class="sentence">“{{ sentence }}”</p>
      <div v-if="lessons.length" class="prog">
        <span class="bar"><i :style="{ width: (lessons.length ? (doneN / lessons.length) * 100 : 0) + '%' }"></i></span>
        <span>{{ doneN }} of {{ lessons.length }} done</span>
      </div>
    </div>

    <nav class="scroll">
      <button class="row nav" :class="{ on: view === 'path' }" :aria-current="view === 'path' ? 'page' : undefined" @click="emit('view', 'path')">
        <span class="ic"><Icon name="i-path" /></span><span class="t">Course path</span>
      </button>

      <template v-for="g in groups" :key="g.label">
        <p class="label">{{ g.label }}</p>
        <button v-for="{ l, n } in g.items" :key="l.id" class="row lesson" :class="{ on: isActive(l), done: doneSet.has(l.id) }"
                :aria-current="isActive(l) ? 'page' : undefined" :title="l.title" @click="emit('lesson', l)">
          <span class="num"><Icon v-if="doneSet.has(l.id)" name="i-check" /><template v-else>{{ n }}</template></span>
          <span class="t">{{ l.title }}</span>
          <span v-if="l.minutes" class="min">{{ Math.round(l.minutes) }}m</span>
        </button>
      </template>
      <p v-if="!lessons.length" class="empty">Loading the lessons…</p>

      <p class="label">Course</p>
      <button class="row nav" :class="{ on: view === 'plan' }" :aria-current="view === 'plan' ? 'page' : undefined" @click="emit('view', 'plan')">
        <span class="ic"><Icon name="i-cal" /></span><span class="t">Study plan</span>
      </button>
      <button class="row nav" :class="{ on: view === 'files' }" :aria-current="view === 'files' ? 'page' : undefined" @click="emit('view', 'files')">
        <span class="ic"><Icon name="i-file" /></span><span class="t">Your files</span><span v-if="files" class="min">{{ files }}</span>
      </button>
    </nav>

    <div class="foot">
      <button class="pill sm light" @click="emit('reveal')"><Icon name="i-folder" /> Open folder</button>
    </div>
  </aside>
</template>

<style scoped>
.side { width: 264px; flex: none; display: flex; flex-direction: column; min-height: 0; background: var(--canvas); border-right: 1px solid var(--line); }
.top { height: 52px; flex: none; display: flex; align-items: center; padding: 0 10px 0 12px; }
.back { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px 0 7px; border-radius: 99px; font-size: 13px; font-weight: 600; color: var(--text-2); transition: background .15s, color .15s; }
.back:hover { background: rgb(11 13 16 / 0.06); color: var(--ink); }
.back .ico { width: 14px; height: 14px; }
.course { padding: 4px 18px 14px; flex: none; }
.course h2 { margin: 0; font: 700 17px/1.2 var(--display); letter-spacing: -0.02em; color: var(--ink); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.sentence { margin: 7px 0 0; font-size: 12.5px; line-height: 1.45; color: var(--text-2); display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.prog { margin-top: 12px; display: flex; align-items: center; gap: 10px; font-size: 11.5px; font-weight: 600; color: var(--text-2); font-variant-numeric: tabular-nums; }
.prog .bar { flex: 1; height: 5px; border-radius: 99px; background: rgb(11 13 16 / 0.08); overflow: hidden; }
.prog .bar i { display: block; height: 100%; background: var(--lime-2); border-radius: inherit; transition: width .4s; }

.scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 8px 12px; border-top: 1px solid var(--line); }
.label { margin: 14px 10px 5px; font-size: 10.5px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--text-3); }
.row { width: 100%; display: flex; align-items: center; gap: 9px; min-height: 36px; margin: 1px 0; padding: 6px 10px 6px 8px; border-radius: 10px; text-align: left; font-size: 13px; color: var(--ink-3); transition: background .15s; }
.row:hover { background: rgb(11 13 16 / 0.05); }
.row.on { background: #fff; box-shadow: 0 0 0 1px var(--line), 0 1px 3px rgb(11 13 16 / 0.06); color: var(--cobalt); font-weight: 600; }
.row .t { flex: 1; min-width: 0; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.row .min { flex: none; font-size: 11px; color: var(--text-3); font-variant-numeric: tabular-nums; font-weight: 500; }
.nav { margin-top: 6px; }
.ic { width: 22px; height: 22px; flex: none; border-radius: 7px; display: grid; place-items: center; background: #fff; box-shadow: 0 0 0 1px var(--line); color: var(--ink-3); }
.ic .ico { width: 12px; height: 12px; }
.row.on .ic { background: var(--cobalt); color: #fff; box-shadow: none; }
.num { width: 22px; height: 22px; flex: none; border-radius: 50%; display: grid; place-items: center; background: rgb(11 13 16 / 0.07); color: var(--text-2); font: 700 11px/1 var(--body); }
.num .ico { width: 11px; height: 11px; }
.row.on .num { background: var(--cobalt); color: #fff; }
.row.done .num { background: var(--lime); color: var(--ink); }
.row.done:not(.on) .t { color: var(--text-2); }
.empty { margin: 10px; font-size: 12.5px; color: var(--text-3); }

.foot { flex: none; padding: 10px 12px 12px; border-top: 1px solid var(--line); }
.foot .pill { width: 100%; }
</style>

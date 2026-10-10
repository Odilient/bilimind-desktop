<script setup lang="ts">
// Lesson top bar (player-design §4.3): back to the path, crumb, parts-seen track, the "3/8 ▾" pager
// under 1200px, the Aa menu (text size, night reading, stage mode), and the one primary action.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { CourseLesson } from '@bilimind/core';
import { useBarState } from '../runtime/useBar.ts';
import { partIcon, partLabel } from '../runtime/model.ts';
import { prefs } from '../runtime/progress.ts';
import { setTextSize, toggleNight, toggleStage } from '../runtime/ui.ts';
import { homeHref } from '../router.ts';
import { appMode } from '../runtime/app.ts';

const props = defineProps<{ lesson: CourseLesson; step: number; seen: number; total: number; currentIndex: number; done: boolean; passed: Set<string> }>();
const emit = defineEmits<{ complete: []; jump: [blockId: string] }>();
const { scrolled, away } = useBarState();
const menu = ref<'' | 'aa' | 'pager'>('');
const pct = computed(() => (props.total ? props.seen / props.total : 0));
const cur = computed(() => props.lesson.blocks[Math.max(0, props.currentIndex)]);
function toggle(m: 'aa' | 'pager') { menu.value = menu.value === m ? '' : m; }
function onDoc(e: MouseEvent) { if (menu.value && !(e.target as HTMLElement).closest('.tb-menu')) menu.value = ''; }
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') menu.value = ''; }
onMounted(() => { document.addEventListener('click', onDoc); document.addEventListener('keydown', onKey); });
onBeforeUnmount(() => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onKey); });
function jump(id: string) { menu.value = ''; emit('jump', id); }
</script>

<template>
  <header class="tb" :class="{ scrolled, away: away && !menu }">
    <a v-if="!appMode" class="pill light sm back" :href="homeHref(`at=${encodeURIComponent(lesson.id)}`)" aria-label="Back to the path"><svg aria-hidden="true"><use href="#i-back" /></svg><span class="back-label">Path</span></a>
    <span class="crumb">Step {{ step }} · {{ lesson.title }}</span>
    <span class="grow"></span>
    <span class="track" role="progressbar" :aria-valuenow="seen" :aria-valuemax="total" aria-label="Parts seen"><i :style="{ width: (pct * 100).toFixed(1) + '%' }"></i></span>
    <span class="cnt">{{ seen }}/{{ total }}</span>
    <div class="pager tb-menu">
      <button type="button" :aria-expanded="menu === 'pager'" aria-haspopup="menu" @click.stop="toggle('pager')"><span>{{ currentIndex + 1 }}/{{ total }} {{ cur ? partLabel(lesson, cur) : '' }}</span><svg aria-hidden="true"><use href="#i-down" /></svg></button>
      <div v-if="menu === 'pager'" class="menu" role="menu" style="left: 0; right: auto">
        <a v-for="(b, i) in lesson.blocks" :key="b.id" role="menuitem" :href="`#bf-${b.id}`" @click.prevent="jump(b.id)">
          <span class="ti"><svg aria-hidden="true"><use :href="'#' + partIcon(b)" /></svg></span><span>{{ partLabel(lesson, b) }}</span>
          <span v-if="passed.has(b.id)" class="tag ok">Done</span><span v-else-if="i === currentIndex" class="tag">Here</span>
        </a>
      </div>
    </div>
    <div class="tb-menu" style="position: relative">
      <button class="sq" type="button" aria-label="Reading options" :aria-expanded="menu === 'aa'" @click.stop="toggle('aa')"><svg aria-hidden="true"><use href="#i-type" /></svg></button>
      <div v-if="menu === 'aa'" class="menu" role="menu">
        <div class="lbl">Text size</div>
        <div class="seg">
          <button v-for="s in (['S', 'M', 'L'] as const)" :key="s" type="button" :aria-pressed="(prefs.text ?? 'M') === s" @click="setTextSize(s)">{{ s }}</button>
        </div>
        <button type="button" class="row" :aria-pressed="!!prefs.night" @click="toggleNight"><span class="ti"><svg aria-hidden="true"><use href="#i-moon" /></svg></span><span>Night reading</span><span class="sw"></span></button>
        <button type="button" class="row" :aria-pressed="prefs.density === 'stage'" @click="toggleStage"><span class="ti"><svg aria-hidden="true"><use href="#i-screen" /></svg></span><span>Stage mode <kbd>P</kbd></span><span class="sw"></span></button>
      </div>
    </div>
    <button type="button" class="pill sm mc" :class="done ? 'done-pill' : 'dark'" :aria-pressed="done" :aria-label="done ? 'Completed' : 'Mark complete'" @click="emit('complete')">
      <svg aria-hidden="true"><use href="#i-check" /></svg><span class="mc-label">{{ done ? 'Completed' : 'Mark complete' }}</span>
    </button>
  </header>
</template>

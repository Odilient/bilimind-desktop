<script setup lang="ts">
// Course home (#/): hero, plan strip, due today, the path, receipts, sources, footer (player-design §3).
// App mode (desktop workspace): a small head, the plan strip, due today and the path; no site chrome.
import { computed, nextTick, onMounted, ref } from 'vue';
import type { Course } from '@bilimind/core';
import { percentDone } from '../runtime/model.ts';
import { isDone, resetProgress } from '../runtime/progress.ts';
import { pause, voice } from '../runtime/narration.ts';
import { route } from '../router.ts';
import { appMode } from '../runtime/app.ts';
import TopBar from '../components/TopBar.vue';
import HeroSlab from '../components/HeroSlab.vue';
import PlanStrip from '../components/PlanStrip.vue';
import DueToday from '../components/DueToday.vue';
import PathBoard from '../components/PathBoard.vue';
import ReceiptsSlab from '../components/ReceiptsSlab.vue';
import SourcesList from '../components/SourcesList.vue';
import SiteFooter from '../components/SiteFooter.vue';
import DoneOverlay from '../components/DoneOverlay.vue';

const props = defineProps<{ course: Course }>();
const pct = computed(() => percentDone(props.course, isDone));
const showDone = ref(false);
const board = ref<InstanceType<typeof PathBoard> | null>(null);

onMounted(() => {
  if (voice.key && voice.key !== 'plan' && voice.playing) pause();
  if (!route.from && !route.at) window.scrollTo({ top: 0, behavior: 'auto' });
});
function sources() { document.getElementById('sources')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function reset() {
  if (!confirm('Clear your progress in this course? Your lessons stay; only the ticks go.')) return;
  resetProgress();
  void nextTick(() => board.value?.redraw());
}
</script>

<template>
  <div class="view home" data-view="home">
    <header v-if="appMode" class="a-home"><p class="ctx">Course path · {{ Math.round(pct * 100) }}% done</p><h1>{{ course.title }}</h1></header>
    <template v-else>
      <TopBar :pct="pct" @sources="sources" />
      <HeroSlab :course="course" />
    </template>
    <PlanStrip :course="course" />
    <DueToday :course="course" />
    <PathBoard ref="board" :course="course" @complete="showDone = true" />
    <template v-if="!appMode">
      <ReceiptsSlab :course="course" />
      <SourcesList :course="course" />
      <SiteFooter :course="course" @reset="reset" />
    </template>
    <DoneOverlay v-if="showDone" :course="course" @close="showDone = false" />
  </div>
</template>

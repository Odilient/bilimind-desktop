<script setup lang="ts">
// The 40px draggable bar (titleBarStyle hidden: the window buttons sit in the right ~140px on Windows and Linux,
// on the left on macOS).
import { computed } from 'vue';
import Icon from './Icon.vue';
import { state, go } from '../store';

const crumb = computed(() => {
  switch (state.screen) {
    case 'home': return 'Make a course';
    case 'building': return 'Building your course';
    case 'finished': return 'Your course is ready';
    case 'course': return state.course?.title ?? 'Course';
    default: return '';
  }
});
const building = computed(() => state.run && !state.run.endedAt && state.screen !== 'building');
</script>

<template>
  <header class="tb" :class="{ white: state.screen === 'course' }">
    <button class="brand" title="Make a course" @click="state.screen !== 'building' && go('home')">
      <svg class="mark" viewBox="0 0 40 40" aria-hidden="true"><use href="#mark" /></svg>
      <span class="name">BiliMind</span>
    </button>
    <span class="sep" aria-hidden="true"></span>
    <span class="crumb">{{ crumb }}</span>
    <button v-if="building" class="live" @click="go('building')"><i></i>Building in the background</button>
    <span class="grow"></span>
    <button class="iconbtn gear" :class="{ on: state.settingsOpen }" title="Settings" aria-label="Settings" @click="state.settingsOpen = !state.settingsOpen">
      <Icon name="i-gear" />
    </button>
  </header>
</template>

<style scoped>
.tb {
  height: var(--bar-h); flex: none; display: flex; align-items: center; gap: 10px;
  padding: 0 calc(var(--overlay-w) + 6px) 0 var(--bar-pad-l, 14px); -webkit-app-region: drag; app-region: drag;
  background: var(--page); position: relative; z-index: 30;
}
.tb.white { background: #fff; box-shadow: inset 0 -1px 0 var(--line); }
.tb button { -webkit-app-region: no-drag; app-region: no-drag; }
.brand { display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 6px 0 2px; border-radius: 99px; }
.mark { width: 22px; height: 22px; }
.name { font: 700 15px/1 var(--display); letter-spacing: -0.03em; }
.sep { width: 1px; height: 14px; background: var(--line-2); }
.crumb { font-size: 12.5px; font-weight: 500; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 46vw; }
.grow { flex: 1; }
.live { display: inline-flex; align-items: center; gap: 8px; height: 26px; padding: 0 12px 0 10px; border-radius: 99px; background: var(--ink); color: #fff; font-size: 12px; font-weight: 600; }
.live i { width: 8px; height: 8px; border-radius: 50%; background: var(--lime); animation: pulse-lime 1.6s infinite; }
.gear { width: 32px; height: 32px; }
.gear.on { background: var(--ink); color: #fff; }
</style>

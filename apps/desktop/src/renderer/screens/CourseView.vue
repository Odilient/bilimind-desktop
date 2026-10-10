<script setup lang="ts">
// Screen 4: the course's own offline player under a thin in-app bar. In Electron it is a <webview>
// (webviewTag: true; audio plays and seeks); in the browser mock it falls back to an iframe.
import { onMounted, ref } from 'vue';
import Icon from '../components/Icon.vue';
import { state, go } from '../store';

const url = ref('');
const err = ref('');
const isMock = !!window.__bilimindMock;
onMounted(async () => {
  try { url.value = await window.bilimind.courses.playerUrl(state.course!.id); }
  catch (e) { err.value = (e as Error).message; }
});
const reveal = () => window.bilimind.courses.reveal(state.course!.id);
const openPlan = () => window.bilimind.courses.openFile(state.course!.id, 'plan.md');
const back = () => go(state.run?.card?.id === state.course?.id ? 'finished' : 'home');
</script>

<template>
  <div class="cv">
    <div class="bar">
      <button class="pill sm light" @click="back"><Icon name="i-back" /> Back</button>
      <b class="t">{{ state.course?.title }}</b>
      <span class="m" v-if="state.course">{{ state.course.lessons }} lessons<template v-if="state.course.minutes"> · {{ Math.round(state.course.minutes) }} min narration</template></span>
      <span class="grow"></span>
      <button class="pill sm light" @click="openPlan"><Icon name="i-cal" /> Study plan</button>
      <button class="pill sm dark" @click="reveal"><Icon name="i-folder" /> Open folder</button>
    </div>
    <div class="frame">
      <p v-if="err" class="err">{{ err }}</p>
      <template v-else-if="url">
        <iframe v-if="isMock" :src="url" title="Course" allow="autoplay; fullscreen"></iframe>
        <webview v-else :src="url" allowpopups="false" webpreferences="autoplayPolicy=no-user-gesture-required"></webview>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cv { height: 100%; display: flex; flex-direction: column; background: #fff; }
.bar { height: 48px; flex: none; display: flex; align-items: center; gap: 12px; padding: 0 14px; border-bottom: 1px solid var(--line); background: #fff; }
.t { font: 700 15px/1 var(--display); letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40vw; }
.m { font-size: 12.5px; color: var(--text-2); white-space: nowrap; }
.grow { flex: 1; }
.frame { flex: 1; min-height: 0; position: relative; background: var(--page); }
iframe, webview { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: flex; }
.err { margin: 24px; color: var(--coral); font-weight: 600; }
</style>

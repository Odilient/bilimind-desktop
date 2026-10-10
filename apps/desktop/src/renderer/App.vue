<script setup lang="ts">
import { onMounted } from 'vue';
import TitleBar from './components/TitleBar.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import Home from './screens/Home.vue';
import Building from './screens/Building.vue';
import Finished from './screens/Finished.vue';
import CourseView from './screens/CourseView.vue';
import { state, loadSettings, loadCourses } from './store';

onMounted(() => {
  loadSettings();
  loadCourses();
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') state.settingsOpen = false; });
});
</script>

<template>
  <div class="shell">
    <TitleBar />
    <main class="main">
      <Transition name="screen" mode="out-in">
        <Home v-if="state.screen === 'home'" key="home" />
        <Building v-else-if="state.screen === 'building' && state.run" key="building" />
        <Finished v-else-if="state.screen === 'finished' && state.course" key="finished" />
        <CourseView v-else-if="state.screen === 'course' && state.course" key="course" />
        <Home v-else key="fallback" />
      </Transition>
    </main>
    <SettingsPanel />
  </div>
</template>

<style>
.shell { height: 100%; display: flex; flex-direction: column; }
.main { flex: 1; min-height: 0; position: relative; }
.main > * { height: 100%; }
.screen-enter-active, .screen-leave-active { transition: opacity .22s, transform .22s; }
.screen-enter-from { opacity: 0; transform: translateY(8px); }
.screen-leave-to { opacity: 0; }
</style>

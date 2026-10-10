<script setup lang="ts">
// The shell: hash routes (#/ home, #/l/<id> lesson), the shared cite popover, keyboard shortcuts
// (K/Space play, [ ] speed, P stage mode, ? keys, Esc closes). Blocks render through the registry.
import { inject, onBeforeUnmount, onMounted, ref } from 'vue';
import { COURSE_KEY } from './course.ts';
import { route } from './router.ts';
import { missingBlockComponents } from './blocks/registry.ts';
import { cycleRate, toggle, voice } from './runtime/narration.ts';
import { isTyping, toggleStage } from './runtime/ui.ts';
import HomeView from './views/HomeView.vue';
import LessonView from './views/LessonView.vue';
import CitePopover from './components/CitePopover.vue';

const props = defineProps<{ errors: string[] }>();
const course = inject(COURSE_KEY, null);
const keys = ref(false);

if (import.meta.env.DEV) {
  const missing = missingBlockComponents();
  if (missing.length) console.info('[bilimind] no renderer yet for:', missing.join(', '));
}
if (props.errors.length) console.info(`[bilimind] ${props.errors.length} schema note(s) in course.json (rendered anyway).`);

function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
  const k = e.key;
  if (k === 'Escape') { keys.value = false; return; }
  if (k === '?') { keys.value = !keys.value; return; }
  if (k === 'p' || k === 'P') { toggleStage(); return; }
  if (!voice.key) return;
  if (k === 'k' || k === 'K' || (k === ' ' && !(e.target as HTMLElement)?.closest('button, a, [role="slider"], summary'))) { e.preventDefault(); toggle(); return; }
  if (k === ']') cycleRate(1);
  if (k === '[') cycleRate(-1);
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <template v-if="course">
    <LessonView v-if="route.name === 'lesson'" :course="course" :lesson-id="route.lesson" />
    <HomeView v-else :course="course" />
    <CitePopover />
    <div v-if="keys" class="keys" role="dialog" aria-label="Keyboard shortcuts" @click.self="keys = false">
      <div class="box">
        <h4>Keys</h4>
        <ul>
          <li><span>Play or pause the voice</span><kbd>K</kbd></li>
          <li><span>Slower / faster</span><span><kbd>[</kbd> <kbd>]</kbd></span></li>
          <li><span>Seek 5 seconds (on the waveform)</span><span><kbd>←</kbd> <kbd>→</kbd></span></li>
          <li><span>Stage mode (projector)</span><kbd>P</kbd></li>
          <li><span>Close a popup</span><kbd>Esc</kbd></li>
        </ul>
      </div>
    </div>
  </template>
  <main v-else class="empty">
    <h1 class="display">No course here</h1>
    <p class="lede">This page is the BiliMind player, but no course was pasted into it.</p>
    <pre v-if="errors.length">{{ errors.join('\n') }}</pre>
  </main>
</template>

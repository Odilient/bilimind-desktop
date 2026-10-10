<script setup lang="ts">
// "PATH DONE." (player-design §6.2): cobalt slab, trophy, confetti from both corners, past-tense stats.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Course } from '@bilimind/core';
import { examInfo } from '../runtime/time.ts';
import { isExamGoal, lessonOrder, questionCount } from '../runtime/model.ts';
import { confetti } from '../runtime/motion.ts';

const props = defineProps<{ course: Course }>();
const emit = defineEmits<{ close: [] }>();
const exam = computed(() => examInfo(props.course.goal.exam_at, props.course.goal.timezone));
const slab = ref<HTMLElement | null>(null);
const closeBtn = ref<HTMLButtonElement | null>(null);
const trophyOk = ref(true);
const trophySrc = 'img/obj-trophy.webp';   // relative to index.html (not bundled)
const stats = computed(() => [
  { n: String(lessonOrder(props.course).length), l: 'lessons done' },
  { n: String(questionCount(props.course)), l: 'questions in your deck' },
  { n: String(props.course.receipts.cards), l: 'cards to review' },
]);
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') emit('close'); }
onMounted(() => {
  document.addEventListener('keydown', onKey);
  closeBtn.value?.focus();
  const r = slab.value?.getBoundingClientRect();
  if (r) {
    const colours = ['#C6F24E', '#FFFFFF', '#0B0D10', '#FF5A3C'];
    setTimeout(() => { confetti(r.left + 20, r.bottom - 20, 40, colours); confetti(r.right - 20, r.bottom - 20, 40, colours); }, 250);
  }
});
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="done-ov" role="dialog" aria-modal="true" aria-labelledby="done-h" @click.self="emit('close')">
    <div ref="slab" class="done-slab">
      <i class="glow" aria-hidden="true"></i>
      <img v-if="trophyOk" class="trophy" :src="trophySrc" alt="" @error="trophyOk = false" />
      <div class="copy">
        <span class="eb on-dark"><span class="dot"><svg aria-hidden="true"><use href="#i-check" /></svg></span>{{ course.title }} · every step</span>
        <h2 id="done-h" class="display hero">Path <span class="hchip" aria-hidden="true"><svg><use href="#i-check" /></svg></span> <span class="lime">done.</span></h2>
        <p class="lede">{{ exam ? `You're ready for ${exam.weekdayLong}. Your cards keep coming back until ${isExamGoal(props.course) ? 'the exam' : 'then'}.` : 'You walked the whole line. Your cards keep coming back so it sticks.' }}</p>
        <ul class="c-stats"><li v-for="s in stats" :key="s.l"><b>{{ s.n }}</b><span>{{ s.l }}</span></li></ul>
        <div class="acts">
          <a class="pill lime lg" href="#/" @click="emit('close')">Review your cards<span class="arr"><svg aria-hidden="true"><use href="#i-arrow" /></svg></span></a>
          <button ref="closeBtn" type="button" class="pill ghost-dark lg" style="padding: 0 22px" @click="emit('close')">Back to the path</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Screen 3: the finished slab with the receipts and what to open next.
import { computed } from 'vue';
import Icon from '../components/Icon.vue';
import { state, go, openCourse } from '../store';
import { OBJ } from '../images';
import { fmtCost, fmtDuration, nbHyphen } from '../words';

const c = computed(() => state.course!);
const run = computed(() => state.run);
const wall = computed(() => c.value.wallMs ?? (run.value?.endedAt && run.value.startedAt ? run.value.endedAt - run.value.startedAt : undefined));
const cost = computed(() => c.value.costUsd ?? run.value?.cost);
const receipts = computed(() => {
  const x = c.value;
  return [
    x.checks && { k: 'Checks passed', v: `${x.checks.passed}`, of: `/${x.checks.total}`, icon: 'i-check', hi: true },
    x.rejected !== undefined && { k: 'Answers rejected and rewritten', v: `${x.rejected}`, icon: 'i-scales' },
    x.codeTests && x.codeTests.total > 0 && { k: 'Code tests passed', v: `${x.codeTests.passed}`, of: `/${x.codeTests.total}`, icon: 'i-code' },
    x.minutes !== undefined && { k: 'Minutes of narration', v: `${Math.round(x.minutes * 10) / 10}`, icon: 'i-mic' },
    cost.value !== undefined && { k: 'Cost of the AI', v: fmtCost(cost.value), icon: 'i-spark' },
    wall.value !== undefined && { k: 'Time to build', v: fmtDuration(wall.value), icon: 'i-time' },
  ].filter(Boolean) as { k: string; v: string; of?: string; icon: string; hi?: boolean }[];
});
const FILES = [
  { rel: 'plan.md', label: 'Study plan', icon: 'i-cal' },
  { rel: 'REPORT.md', label: 'Report', icon: 'i-list' },
  { rel: 'deck.csv', label: 'Anki deck', icon: 'i-cards' },
  { rel: 'reviews.ics', label: 'Calendar', icon: 'i-bell' },
];
const reveal = () => window.bilimind.courses.reveal(c.value.id);
const open = (rel: string) => window.bilimind.courses.openFile(c.value.id, rel);
</script>

<template>
  <div class="fin">
    <section class="slab cobalt done">
      <img class="trophy" :src="OBJ.trophy" alt="" />
      <img class="cal" :src="OBJ.calendar" alt="" />
      <div class="head">
        <span class="eb on-dark"><span class="dot"><Icon name="i-check" /></span>Finished{{ wall ? ` in ${fmtDuration(wall)}` : '' }}</span>
        <h1 class="disp">Your course <br />is <span class="hchip"><Icon name="i-check" /></span> <span class="lime">ready.</span></h1>
        <p class="ttl">{{ nbHyphen(c.title) }}</p>
        <p class="lede">{{ c.lessons }} {{ c.lessons === 1 ? 'lesson' : 'lessons' }} from your own files, every auto-marked answer checked against them. It is a folder on this computer and works offline.</p>
      </div>
      <ul class="rc">
        <li v-for="(r, i) in receipts" :key="r.k" :class="{ hi: r.hi }" :style="{ animationDelay: `${120 + i * 90}ms` }">
          <span class="ri"><Icon :name="r.icon" /></span>
          <b>{{ r.v }}<small v-if="r.of">{{ r.of }}</small></b>
          <span class="rk">{{ r.k }}</span>
        </li>
      </ul>
      <div class="acts">
        <button class="pill lime big" @click="openCourse(c)">Open course <span class="arr"><Icon name="i-arrow" /></span></button>
        <button class="pill glass" @click="reveal"><Icon name="i-folder" /> Open folder</button>
        <span class="vr"></span>
        <button v-for="f in FILES" :key="f.rel" class="pill glass" @click="open(f.rel)"><Icon :name="f.icon" /> {{ f.label }}</button>
      </div>
    </section>
    <div class="after">
      <button class="pill light" @click="go('home')"><Icon name="i-plus" /> Make another course</button>
    </div>
  </div>
</template>

<style scoped>
.fin { height: 100%; overflow-y: auto; padding: 0 var(--gut) var(--gut); display: flex; flex-direction: column; gap: 14px; }
.done { padding: 44px 48px 36px; display: grid; gap: 28px; flex: 1; align-content: space-between; min-height: 560px; }
.eb { justify-self: start; }
.head { display: grid; gap: 16px; max-width: 760px; position: relative; z-index: 1; }
h1 { font-size: clamp(56px, 6.4vw, 92px); }
.ttl { margin: 0; font: 700 22px/1.2 var(--display); letter-spacing: -0.02em; }
.lede { margin: 0; max-width: 560px; font-size: 15.5px; line-height: 1.55; color: rgb(255 255 255 / 0.74); }
.trophy { position: absolute; right: 56px; top: 30px; width: 230px; transform: rotate(6deg); filter: drop-shadow(0 30px 40px rgb(5 10 60 / 0.45)); animation: rise .7s both .1s; }
.cal { position: absolute; right: 270px; top: 170px; width: 110px; transform: rotate(-12deg); filter: drop-shadow(0 18px 24px rgb(5 10 60 / 0.4)); animation: rise .7s both .25s; }
.rc { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; position: relative; z-index: 1; }
.rc li { display: grid; gap: 6px; align-content: start; padding: 14px 14px 16px; border-radius: 22px; background: rgb(255 255 255 / 0.1); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.18); animation: rise .5s both; }
.rc li.hi { background: var(--lime); color: var(--ink); box-shadow: none; }
.rc .ri { width: 28px; height: 28px; border-radius: 50%; background: rgb(255 255 255 / 0.16); display: grid; place-items: center; }
.rc li.hi .ri { background: var(--ink); color: var(--lime); }
.rc .ri .ico { width: 14px; height: 14px; }
.rc b { font: 700 34px/1 var(--display); letter-spacing: -0.045em; white-space: nowrap; }
.rc b small { font-size: 18px; opacity: .6; letter-spacing: -0.02em; }
.rk { font-size: 12px; line-height: 1.3; color: rgb(255 255 255 / 0.72); }
.rc li.hi .rk { color: var(--ink-3); }
.acts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; position: relative; z-index: 1; }
.vr { width: 1px; height: 26px; background: rgb(255 255 255 / 0.25); margin: 0 6px; }
.after { display: flex; justify-content: center; padding-bottom: 6px; }
</style>

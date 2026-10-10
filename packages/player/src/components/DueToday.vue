<script setup lang="ts">
// "Due today": review cards whose due date is today or earlier (course time zone). The engine's plan
// (course.review.cards) is overridden by the learner's own FSRS state in localStorage bm:<id>:fsrs.
import { computed } from 'vue';
import type { Course, FsrsState } from '@bilimind/core';
import { dueRows, nextReview } from '../runtime/model.ts';
import { readJson, storageKey } from '../runtime/progress.ts';
import { dayParts, now, ymdIn } from '../runtime/time.ts';
import { lessonHref } from '../router.ts';

const props = defineProps<{ course: Course }>();
const tz = computed(() => props.course.goal.timezone);
const today = computed(() => ymdIn(now(), tz.value));
const ymdOf = (iso: string) => ymdIn(new Date(iso), tz.value);
const local = computed(() => readJson<Record<string, Partial<FsrsState>>>(storageKey(props.course.id, 'fsrs')));
const rows = computed(() => dueRows(props.course, today.value, ymdOf, local.value));
const shown = computed(() => rows.value.slice(0, 6));
const next = computed(() => nextReview(props.course, today.value, ymdOf, local.value));
const nextLabel = computed(() => {
  if (!next.value) return '';
  const p = dayParts(next.value.ymd);
  return `Next: ${p.weekday} ${p.day} ${p.month} · ${next.value.count} card${next.value.count > 1 ? 's' : ''}`;
});
const has = computed(() => (props.course.review?.cards?.length ?? 0) > 0);
</script>

<template>
  <section v-if="has" class="due" aria-labelledby="due-h">
    <div class="due-card rise" style="--i:2">
      <div>
        <span class="eb"><span class="dot"><svg aria-hidden="true"><use href="#i-bell" /></svg></span>Due today</span>
        <h3 id="due-h">{{ rows.length ? `${rows.length} card${rows.length > 1 ? 's' : ''} to review` : 'Nothing due today' }}</h3>
        <p>Spaced out backwards from your exam, so every card comes back before it. Answer them in the lesson; the schedule moves with you.</p>
      </div>
      <div>
        <ul v-if="rows.length" class="due-list">
          <li v-for="r in shown" :key="r.id">
            <a :href="lessonHref(r.lesson.id, r.block)" :data-card="r.id">
              <span class="ti"><svg aria-hidden="true"><use :href="r.kind === 'flashcard' ? '#i-cards' : '#i-quiz'" /></svg></span>
              <span class="pr"><b>{{ r.prompt }}</b><small>{{ r.kind === 'flashcard' ? 'Practice card' : 'Question' }} · {{ r.lesson.title }}</small></span>
              <span class="when tag" :class="r.overdue ? 'bad' : 'ok'">{{ r.overdue ? 'Overdue' : 'Today' }}</span>
            </a>
          </li>
        </ul>
        <div v-else class="due-empty"><svg aria-hidden="true"><use href="#i-check" /></svg><span>You are up to date. {{ nextLabel }}</span></div>
        <div v-if="rows.length > shown.length" class="due-more">+{{ rows.length - shown.length }} more in your lessons</div>
        <div v-else-if="rows.length && nextLabel" class="due-more">{{ nextLabel }}</div>
      </div>
    </div>
  </section>
</template>

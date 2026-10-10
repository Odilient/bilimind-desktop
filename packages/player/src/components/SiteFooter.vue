<script setup lang="ts">
// Footer: the course's downloads (calendar, Anki, notes, plan, report), the giant outlined title, the maker line.
import { computed } from 'vue';
import type { Course } from '@bilimind/core';
import { fmtLongDate } from '../runtime/time.ts';

const props = defineProps<{ course: Course }>();
const emit = defineEmits<{ reset: [] }>();
const ICON: Record<string, string> = { ics: 'i-cal', anki_csv: 'i-cards', apkg: 'i-cards', markdown: 'i-book', report: 'i-check', plan: 'i-path' };
const first = computed(() => props.course.title.split(/\s+/)[0] ?? '');
const rest = computed(() => props.course.title.split(/\s+/).slice(1).join(' '));
const made = computed(() => fmtLongDate(props.course.built_at, props.course.goal.timezone));
</script>

<template>
  <footer class="foot">
    <div v-if="course.exports.length" class="dl">
      <span class="eyebrow">Take it with you</span>
      <a v-for="e in course.exports" :key="e.file" class="pill light sm" :href="e.file" :download="e.kind === 'ics' || e.kind === 'anki_csv' || e.kind === 'apkg' ? '' : undefined" target="_blank" rel="noopener">
        <svg aria-hidden="true"><use :href="'#' + (ICON[e.kind] ?? 'i-download')" /></svg>{{ e.label }}
      </a>
    </div>
    <div class="huge" aria-hidden="true"><span>{{ first }}</span> {{ rest }}</div>
    <div class="made"><span>BiliMind · made for you on {{ made }}</span><button type="button" @click="emit('reset')">Start over (clear my progress)</button></div>
  </footer>
</template>

<script setup lang="ts">
// "Built from your files" (player-design §3.6): one card per source with its type, pages, how often the
// course cites it, its role, and a link to open it.
import type { Course } from '@bilimind/core';
import { fileKind } from '../runtime/model.ts';

defineProps<{ course: Course }>();
const ROLE: Record<string, string> = { past_paper: 'Past paper', lecture: 'Lecture', notes: 'Notes', textbook: 'Textbook', sop: 'Procedure', syllabus: 'Syllabus', exercise: 'Exercises', other: '' };
</script>

<template>
  <section id="sources" class="srcs" aria-labelledby="src-h">
    <div class="head">
      <span class="eb"><span class="dot"><svg aria-hidden="true"><use href="#i-folder" /></svg></span>Built from your files</span>
      <h2 id="src-h" class="display">Your <span class="cob">sources.</span></h2>
    </div>
    <div class="src-grid">
      <article v-for="s in course.sources" :key="s.id" class="src">
        <span class="ft" aria-hidden="true">{{ fileKind(s) }}</span>
        <b>{{ s.title }}</b>
        <small>{{ s.pages ? `${s.pages} page${s.pages === 1 ? '' : 's'}` : 'Document' }} · cited {{ s.cited }} time{{ s.cited === 1 ? '' : 's' }}</small>
        <span class="row">
          <span v-if="ROLE[s.role]" class="tag" :class="s.role === 'past_paper' ? 'lime' : 'cob'">{{ ROLE[s.role] }}</span>
          <a :href="s.file" target="_blank" rel="noopener">Open<svg aria-hidden="true"><use href="#i-ext" /></svg></a>
        </span>
      </article>
    </div>
    <p v-if="course.attribution" class="attrib">{{ course.attribution }}</p>
  </section>
</template>

<script setup lang="ts">
// Fallback for a type with no renderer: show the payload as a definition list, never crash.
import type { Course, CourseLesson } from '@bilimind/core';
const props = defineProps<{ block: { id: string; type: string; payload: unknown }; lesson: CourseLesson; course: Course }>();
const entries = () => Object.entries((props.block.payload ?? {}) as Record<string, unknown>);
</script>

<template>
  <section class="blk card" :data-block="block.id" :data-type="block.type">
    <dl>
      <template v-for="[k, v] in entries()" :key="k">
        <dt>{{ k }}</dt>
        <dd>{{ typeof v === 'string' ? v : JSON.stringify(v) }}</dd>
      </template>
    </dl>
  </section>
</template>

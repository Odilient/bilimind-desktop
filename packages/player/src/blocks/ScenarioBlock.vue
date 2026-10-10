<script setup lang="ts">
// STUB (WP0). Owner: WP5b (reading/visual) or WP5c (interactive), see PLAN.md 5.2. Props are fixed: {block, lesson, course}.
import type { Course, CourseLesson } from "@bilimind/core";
import type { BlockOf } from "./types.ts";
defineProps<{ block: BlockOf<"scenario">; lesson: CourseLesson; course: Course }>();
</script>

<template>
  <section class="blk" :data-block="block.id" data-type="scenario">
    <h3 v-if="block.title" class="blk-t">{{ block.title }}</h3>
    <pre class="stub">scenario: {{ Object.keys(block.payload).join(", ") }}<template v-if="block.assessments.length"> · {{ block.assessments.length }} items</template></pre>
  </section>
</template>

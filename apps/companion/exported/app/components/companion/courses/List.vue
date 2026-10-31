<script setup lang="ts">
import type { Subject } from '~/companion/types'
import type { ShelfView } from '~/companion/shelf'

/**
 * Some courses, drawn the way the shelf is set to show them: as cards
 * (`CompanionCourseCard`, a cover each, in a grid that fills the width) or as
 * a list (`CompanionCoursesRow`, one hairline row each, which holds forty on
 * a screen or two). A section of the shelf, the search results and the
 * archive are all one of these, so a course looks the same in all three.
 */
defineProps<{
  courses: Subject[]
  view: ShelfView
}>()

const emit = defineEmits<{ ask: [subject: Subject]; group: [subject: Subject] }>()
</script>

<template>
  <ul
    v-if="view === 'cards'"
    class="grid grid-cols-[repeat(auto-fill,minmax(296px,1fr))] gap-4"
  >
    <li
      v-for="(subject, index) in courses"
      :key="subject.id"
      class="rise"
      :style="{ '--d': `${Math.min(index, 8) * 40}ms` }"
    >
      <CompanionCourseCard
        :subject="subject"
        @ask="emit('ask', $event)"
        @group="emit('group', $event)"
      />
    </li>
  </ul>

  <ul
    v-else
    class="divide-y divide-border-rule overflow-hidden rounded-[16px] border border-border bg-surface"
  >
    <li
      v-for="subject in courses"
      :key="subject.id"
    >
      <CompanionCoursesRow
        :subject="subject"
        @ask="emit('ask', $event)"
        @group="emit('group', $event)"
      />
    </li>
  </ul>
</template>

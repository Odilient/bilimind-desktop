<script lang="ts">
import type { CourseNode } from '~/types/api'
import { progressOf } from '~/composables/useRoadmap'

export type MarkState = 'checked' | 'done' | 'learning' | 'todo' | 'skip'

/** A lesson box's mark from its progress; `checked` wins when a check says so. */
export function markOf(node: CourseNode, checked = false): MarkState {
  if (checked) return 'checked'
  const state = progressOf(node)
  if (state === 'completed') return 'done'
  if (state === 'in_progress') return 'learning'
  if (state === 'skipped') return 'skip'
  return 'todo'
}
</script>

<script setup lang="ts">
const { t } = useI18n()
/**
 * The status mark of a topic, the same 15px drawing everywhere a topic shows
 * (the sidebar, the roadmap, the brief, the landing): Daylight 2's grammar
 * (docs/design/daylight2/course/core.js `mark`).
 *
 *   checked   a filled leaf disc with a white tick: recalled in a check, from memory
 *   done      a leaf ring with a leaf tick: read, not checked yet
 *   learning  an amber ring, half filled: started
 *   todo      a dashed ring: not started
 *   skip      a grey ring with a dash
 */
withDefaults(defineProps<{ state: MarkState; size?: number }>(), { size: 15 })

const LABEL = computed<Record<MarkState, string>>(() => ({
  checked: t('course.mark.checked'),
  done: t('course.mark.done'),
  learning: t('course.mark.learning'),
  todo: t('course.mark.todo'),
  skip: t('course.mark.skip'),
}))
</script>


<template>
  <span
    class="inline-grid shrink-0 place-items-center"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :title="LABEL[state]"
  >
    <svg
      viewBox="0 0 15 15"
      :width="size"
      :height="size"
      class="overflow-visible"
      aria-hidden="true"
    >
      <template v-if="state === 'checked'">
        <circle
          cx="7.5"
          cy="7.5"
          r="7"
          fill="var(--leaf)"
        />
        <path
          d="m4.6 7.7 2 2 3.8-4.2"
          fill="none"
          stroke="#fff"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </template>
      <template v-else-if="state === 'done'">
        <circle
          cx="7.5"
          cy="7.5"
          r="6.3"
          fill="none"
          stroke="var(--leaf)"
          stroke-width="1.5"
        />
        <path
          d="m4.8 7.7 1.9 1.9 3.6-4"
          fill="none"
          stroke="var(--leaf)"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </template>
      <template v-else-if="state === 'learning'">
        <circle
          cx="7.5"
          cy="7.5"
          r="6.3"
          fill="none"
          stroke="var(--hi-2)"
          stroke-width="1.5"
        />
        <path
          d="M7.5 3.2a4.3 4.3 0 0 1 0 8.6z"
          fill="var(--hi-2)"
        />
      </template>
      <template v-else-if="state === 'skip'">
        <circle
          cx="7.5"
          cy="7.5"
          r="6.3"
          fill="none"
          stroke="var(--text-faint)"
          stroke-width="1.4"
        />
        <path
          d="M4.5 7.5h6"
          stroke="var(--text-faint)"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </template>
      <circle
        v-else
        cx="7.5"
        cy="7.5"
        r="6.3"
        fill="none"
        stroke="var(--text-faint)"
        stroke-width="1.4"
        stroke-dasharray="2.2 2.2"
      />
    </svg>
    <span class="sr-only">{{ LABEL[state] }}</span>
  </span>
</template>

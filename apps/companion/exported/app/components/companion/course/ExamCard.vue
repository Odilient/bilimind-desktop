<script setup lang="ts">
import type { CourseNode } from '~/types/api'
import type { Deadline, Subject } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { dayKey, dayLabel, daysBetween } from '~/companion/time'
import { readyWords } from '~/companion/words'
import { markOf } from './Mark.vue'
import { courseTree } from '~/composables/useRoadmap'
const { t } = useI18n()

/**
 * The countdown at the top of a course's sidebar (course.html `.exam`): the
 * date that matters most (the final or an exam, else the nearest graded
 * thing), how many days are left, the course's topics as a bar of segments
 * painted with their status marks' colours, and how many are checked from
 * memory. It opens the deadline.
 */
const props = defineProps<{
  subject: Subject
  /** The course's steps, in path order, as the sidebar draws them. */
  nodes: CourseNode[]
  checkedIds: number[]
}>()

const c = useCompanion()
const now = Date.now()

const BIG = new Set(['final', 'exam', 'midterm'])

const deadline = computed<Deadline | null>(() => {
  const ahead = c.deadlines.value
    .filter((d) => d.subject_id === props.subject.id && d.status === 'upcoming' && d.due_at && Date.parse(d.due_at) > now)
    .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!))
  return ahead.find((d) => BIG.has(d.kind)) ?? ahead.find((d) => d.weight_pct) ?? ahead[0] ?? null
})

const days = computed(() => (deadline.value ? daysBetween(dayKey(), dayKey(deadline.value.due_at!)) : 0))

const readiness = computed(() => {
  const d = deadline.value
  if (!d) return null
  const r = c.readinessOf(d)
  if (!r.total) return null
  const percent = r.checked ? r.percent : null
  return { words: readyWords(percent), good: percent !== null && percent >= 85 }
})

/** Only the steps (no subtopics), at most 20, so a segment never gets thinner than a hairline. */
const steps = computed(() => {
  const checked = new Set(props.checkedIds)
  return courseTree(props.nodes)
    .steps.slice(0, 20)
    .map((step) => markOf(step.node, checked.has(step.node.id)))
})
const checkedCount = computed(() => steps.value.filter((s) => s === 'checked').length)

const SEG: Record<string, string> = {
  checked: 'bg-leaf',
  done: 'bg-[color-mix(in_oklab,var(--leaf)_42%,var(--surface))]',
  learning: 'bg-hi-2 cp-seg-pulse',
  todo: 'bg-[rgb(var(--wash-rgb)/0.065)]',
  skip: 'bg-[rgb(var(--wash-rgb)/0.065)]',
}
</script>

<template>
  <NuxtLink
    v-if="deadline"
    :to="`/app/d/${deadline.id}`"
    class="mx-1 block rounded-[13px] bg-surface px-3 pt-3 pb-[11px] text-left shadow-[0_0_0_1px_var(--border),var(--shadow-card)] transition-[box-shadow,transform] duration-200 ease-[var(--ease)] hover:shadow-[0_0_0_1px_var(--border-strong),var(--shadow-raised)] focus-visible:outline-2 focus-visible:outline-brand"
    :title="t('course.exam.open', { title: deadline.title })"
  >
    <span class="flex items-center gap-1.5 text-[12px] font-semibold text-text-muted">
      <CompanionIcon
        name="flag"
        :size="13"
        :stroke="2.2"
        class="text-rose"
      />
      <span class="min-w-0 truncate">{{ deadline.title }} · {{ dayLabel(dayKey(deadline.due_at!)) }}</span>
      <span
        v-if="readiness"
        :class="[
          'ml-auto inline-flex shrink-0 items-center gap-1 font-semibold whitespace-nowrap',
          readiness.good ? 'text-leaf-ink' : 'text-text-muted',
        ]"
      >
        <span class="size-1.5 rounded-full bg-current" />
        {{ readiness.words }}
      </span>
    </span>
    <span class="mt-[5px] flex items-baseline gap-[7px]">
      <b class="num font-display text-[30px] leading-none font-semibold tracking-[-0.04em] text-text">{{ days }}</b>
      <span class="text-[12.5px] text-text-muted">{{ t('course.exam.left', days) }}</span>
    </span>
    <span
      v-if="steps.length"
      class="mt-[11px] mb-2 grid gap-0.5"
      :style="{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }"
      aria-hidden="true"
    >
      <i
        v-for="(state, index) in steps"
        :key="index"
        :class="['h-1.5 rounded-[2px]', SEG[state]]"
      />
    </span>
    <span
      v-if="steps.length"
      class="block text-[12px] text-text-muted"
    ><b class="font-semibold text-text-soft">{{ t('course.exam.of', { n: checkedCount, total: steps.length }) }}</b> {{ t('course.exam.checked') }}</span>
  </NuxtLink>
</template>

<style scoped>
@keyframes cp-seg-pulse {
  50% {
    opacity: 0.45;
  }
}

.cp-seg-pulse {
  animation: cp-seg-pulse 2.4s var(--ease-soft) infinite;
}

@media (prefers-reduced-motion: reduce) {
  .cp-seg-pulse {
    animation: none;
  }
}
</style>

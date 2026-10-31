<script setup lang="ts">
/**
 * A deadline in a list, the same row Today's "Coming up" draws: the day on
 * the left, what it is and its course in the middle, how ready the learner
 * is in words on the right ("45% ready", "not checked yet": readiness is the
 * checks', so a deadline nobody has checked says that), and a chevron,
 * because the whole row opens the deadline. No ring: a column of rings read
 * as a dashboard. A date nobody official has given yet says "not confirmed"
 * in the line under the title, not in a dashed badge.
 *
 * `showStanding` (a course's Deadlines view) also says "Official" in green
 * when it is, so a list of dates reads as trusted or not at a glance.
 */
import type { Deadline } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { courseColor } from '~/companion/colors'
import { deadlineMeta, dueParts, readyWords } from '~/companion/words'

const props = withDefaults(
  defineProps<{ deadline: Deadline; withCourse?: boolean; showStanding?: boolean }>(),
  { withCourse: true, showStanding: false },
)

const c = useCompanion()
const subject = computed(() => c.subjectOf(props.deadline))
const readiness = computed(() => c.readinessOf(props.deadline))
const when = computed(() => dueParts(props.deadline))
const meta = computed(() => deadlineMeta(props.deadline, subject.value, props.withCourse))

const ready = computed(() => readyWords(readiness.value.checked ? readiness.value.percent : null))
const official = computed(
  () => props.showStanding && (props.deadline.confidence === 'official' || props.deadline.confirmed),
)
</script>

<template>
  <NuxtLink
    :to="`/app/d/${deadline.id}`"
    class="group -mx-2 flex items-center gap-4 rounded-[12px] px-2 py-3 transition-colors hover:bg-surface-mute"
  >
    <span class="grid w-[64px] shrink-0 leading-tight">
      <span class="text-[15px] font-semibold text-text">{{ when[0] }}</span>
      <span class="text-[13px] text-text-muted">{{ when[1] }}</span>
    </span>
    <span class="grid min-w-0 flex-1 gap-0.5">
      <span class="truncate text-[16px] leading-snug font-medium text-text">{{ deadline.title }}</span>
      <span
        v-if="meta || official"
        class="flex min-w-0 items-center gap-1.5 text-[13.5px] text-text-muted"
      >
        <span
          v-if="withCourse && subject"
          class="size-2 shrink-0 rounded-full"
          :style="{ background: courseColor(subject.color) }"
        />
        <span
          v-if="official"
          class="shrink-0 font-medium text-success-text"
        >Official<template v-if="meta"> ·</template></span>
        <span class="truncate">{{ meta }}</span>
      </span>
    </span>
    <span
      class="shrink-0 text-[14px] font-medium"
      :class="readiness.checked && readiness.percent >= 85 ? 'text-success-text' : 'text-text-soft'"
      :aria-label="`${deadline.title}: ${ready}`"
    >{{ ready }}</span>
    <CompanionIcon
      name="chevron-right"
      :size="18"
      class="shrink-0 text-text-faint transition-colors group-hover:text-text-soft"
    />
  </NuxtLink>
</template>

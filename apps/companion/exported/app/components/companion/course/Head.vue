<script setup lang="ts">
import type { Subject } from '~/companion/types'
import type { ContinueTarget, CourseProgress } from '~/companion/course-home'
import { courseColor } from '~/companion/colors'

/**
 * The top of a course's home, about a hundred pixels: its colour and name,
 * one line saying where it stands ("Week 8 of 14 · Dr. Karimov · Tue/Thu
 * 10:00", or "Italian · B1 by 1 June · on pace, about 1 h 40 min a week"), how
 * far along it is as a bar with words beside it, and the one button that
 * already knows what's next ("Continue · Lesson 3 · SQL joins"), with the
 * reason under it in small print. That button is this screen's one primary
 * action; everything else is a click into the views below.
 *
 * On a phone the name is in the bar above, so this keeps the line, the bar
 * and the button, which spans the width for the thumb.
 */
const props = defineProps<{
  subject: Subject
  line: string
  progress: CourseProgress
  next: ContinueTarget | null
}>()

const emit = defineEmits<{ continue: [] }>()

const percent = computed(() =>
  props.progress.total ? Math.round((props.progress.done / props.progress.total) * 100) : 0,
)
const color = computed(() => courseColor(props.subject.color))
</script>

<template>
  <div class="flex items-end gap-6 px-4 pt-3 pb-3 lg:px-8 lg:pt-5 lg:pb-4">
    <div class="grid min-w-0 flex-1 gap-1">
      <h1 class="t-head flex min-w-0 items-center gap-2.5 text-[24px] max-lg:hidden">
        <span
          class="size-3 shrink-0 rounded-full"
          :style="{ background: color }"
        />
        <span class="truncate">{{ subject.title }}</span>
      </h1>
      <p
        v-if="line"
        class="truncate text-[13.5px] text-text-muted lg:text-[14px]"
        :title="line"
      >
        {{ line }}
      </p>
      <div
        v-if="progress.words"
        class="mt-1 flex min-w-0 items-center gap-3"
      >
        <span
          class="h-1.5 w-full max-w-[220px] shrink overflow-hidden rounded-full bg-surface-track"
          role="progressbar"
          :aria-valuenow="percent"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="progress.words"
        >
          <span
            class="block h-full rounded-full transition-[width] duration-500 ease-out"
            :style="{ width: `${percent}%`, background: color }"
          />
        </span>
        <span class="shrink-0 text-[13px] font-medium whitespace-nowrap text-text-soft">{{ progress.words }}</span>
      </div>

      <!-- The phone: the button under the bar, the full width. -->
      <button
        v-if="next"
        type="button"
        class="group mt-2.5 flex h-11 w-full min-w-0 cursor-pointer items-center gap-2 rounded-full bg-ink pr-4 pl-5 text-[14.5px] font-semibold text-white transition-colors active:bg-[#22262e] lg:hidden"
        @click="emit('continue')"
      >
        <span class="shrink-0">{{ next.verb }}</span>
        <span
          class="text-white/45"
          aria-hidden="true"
        >·</span>
        <span class="min-w-0 flex-1 truncate text-left">{{ next.label }}</span>
        <UiIcon
          name="arrow-right"
          :size="16"
          class="shrink-0"
        />
      </button>
    </div>

    <div
      v-if="next"
      class="grid shrink-0 justify-items-end gap-1.5 max-lg:hidden"
    >
      <button
        type="button"
        class="group flex h-11 max-w-[min(440px,38vw)] cursor-pointer items-center gap-2 rounded-full bg-ink pr-4 pl-5 text-[14.5px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-[#22262e] active:scale-[0.98]"
        :title="`${next.verb}: ${next.label} (${next.why})`"
        @click="emit('continue')"
      >
        <span class="shrink-0">{{ next.verb }}</span>
        <span
          class="text-white/45"
          aria-hidden="true"
        >·</span>
        <span class="min-w-0 truncate">{{ next.label }}</span>
        <UiIcon
          name="arrow-right"
          :size="16"
          class="shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
        />
      </button>
      <span class="pr-4 text-[12px] text-text-muted">{{ next.why }}</span>
    </div>
  </div>
</template>

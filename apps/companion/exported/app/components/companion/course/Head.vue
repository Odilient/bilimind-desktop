<script setup lang="ts">
import type { Subject } from '~/companion/types'
import type { ContinueTarget, CourseProgress } from '~/companion/course-home'

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
</script>

<template>
  <!-- Daylight's course head (course.html .rm-head): the cover, the name in the display face,
       one line of where it stands and how far, and the one Continue that knows what's next. -->
  <div class="flex items-center gap-3.5 px-4 pt-4 pb-1 lg:px-[30px] lg:pt-[22px]">
    <CompanionCourseCover
      :subject="subject"
      size="sm"
      :px="54"
      class="max-lg:hidden"
    />
    <div class="grid min-w-0 flex-1 gap-1">
      <h1 class="truncate font-display text-[30px] leading-[1.02] font-semibold tracking-[-0.04em] text-text max-lg:hidden">
        {{ subject.title }}
      </h1>
      <p
        v-if="line"
        class="truncate text-[13px] text-text-muted"
        :title="line"
      >
        {{ line }}
      </p>
      <div
        v-if="progress.words"
        class="flex min-w-0 items-center gap-2.5"
      >
        <span
          class="h-1.5 w-full max-w-[160px] shrink overflow-hidden rounded-full bg-[rgb(var(--wash-rgb)/0.065)]"
          role="progressbar"
          :aria-valuenow="percent"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="progress.words"
        >
          <span
            class="block h-full rounded-full bg-leaf transition-[width] duration-500 ease-[var(--ease)]"
            :style="{ width: `${percent}%` }"
          />
        </span>
        <span class="shrink-0 text-[12.5px] font-medium whitespace-nowrap text-text-soft">{{ progress.words }}</span>
      </div>

      <!-- The phone: the button under the bar, the full width. -->
      <button
        v-if="next"
        type="button"
        class="mt-2 flex h-11 w-full min-w-0 cursor-pointer items-center gap-2 rounded-[12px] bg-inverse pr-4 pl-4 text-[14px] font-semibold text-on-inverse transition-[background-color,transform] active:scale-[0.98] active:bg-inverse-hover lg:hidden"
        @click="emit('continue')"
      >
        <span class="shrink-0">{{ next.verb }}</span>
        <span
          class="opacity-45"
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
      class="grid shrink-0 justify-items-end gap-1 max-lg:hidden"
    >
      <button
        type="button"
        class="group flex h-9 max-w-[min(400px,34vw)] cursor-pointer items-center gap-2 rounded-[10px] bg-inverse pr-3 pl-3.5 text-[13.5px] font-semibold text-on-inverse transition-[background-color,transform] duration-200 ease-[var(--ease)] hover:bg-inverse-hover active:scale-[0.97]"
        :title="`${next.verb}: ${next.label} (${next.why})`"
        @click="emit('continue')"
      >
        <span class="shrink-0">{{ next.verb }}</span>
        <span
          class="opacity-45"
          aria-hidden="true"
        >·</span>
        <span class="min-w-0 truncate">{{ next.label }}</span>
        <UiIcon
          name="arrow-right"
          :size="15"
          class="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </button>
      <span class="max-w-[min(400px,34vw)] truncate pr-1 text-[12px] text-text-muted">{{ next.why }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Recall, ReviewItem } from '~/composables/useReviews'

/**
 * One lesson to bring back. It shows just enough to jog the memory — the title,
 * the course it came from, and the one-line summary — then asks how it went.
 *
 * The point is recall, so we deliberately do NOT re-teach here; if the learner
 * has genuinely lost it, "Open the lesson" takes them back to the full thing and
 * they answer honestly when they return.
 */

const props = defineProps<{
  item: ReviewItem
  /** 1-based position in the queue, for the quiet "2 of 6" line. */
  position: number
  total: number
  submitting?: boolean
  pending?: Recall | null
}>()

const emit = defineEmits<{ grade: [recall: Recall] }>()

const node = computed(() => props.item.node ?? null)
const course = computed(() => props.item.course ?? null)

/** Back into the workspace on this node — same shape the plan uses on Today. */
const lessonLink = computed(() => {
  const target = course.value ?? (props.item.course_id ? { id: props.item.course_id } : null)
  return target ? nodeUrl(target, node.value) : '/library'
})
</script>

<template>
  <article
    class="rounded-[26px] bg-surface shadow-[inset_0_0_0_1px_var(--border),0_40px_80px_-48px_rgb(11_13_16/0.4)]"
  >
    <div class="px-5 py-5 sm:px-8 sm:py-7">
      <div class="flex items-center justify-between gap-3">
        <p
          class="inline-flex h-7 items-center rounded-full bg-brand-soft px-3 font-display text-[12.5px] font-semibold text-brand"
        >
          {{ position }} of {{ total }}
        </p>
        <p
          v-if="item.is_overdue && item.days_late > 0"
          class="text-[12px] text-text-faint"
        >
          waited {{ plural(item.days_late, 'day') }}
        </p>
      </div>

      <p
        v-if="course"
        class="mt-4 truncate text-[13px] text-text-faint"
      >
        {{ course.title }}
      </p>
      <h2 class="t-head mt-1 text-[24px] leading-[1.15] sm:text-[30px]">
        {{ node?.title ?? 'A lesson from earlier' }}
      </h2>

      <p
        v-if="node?.summary"
        class="mt-3 text-[15px] leading-relaxed text-text-soft"
      >
        {{ node.summary }}
      </p>

      <NuxtLink
        :to="lessonLink"
        class="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brand transition-colors hover:underline"
      >
        <UiIcon
          name="book"
          :size="14"
        />
        Open the lesson
      </NuxtLink>
    </div>

    <div class="rounded-b-[26px] border-t border-border bg-surface-mute px-5 py-5 sm:px-8">
      <p class="mb-3 text-[13.5px] font-semibold text-text-dim">How well did you remember this?</p>
      <ReviewRecallButtons
        :submitting="submitting"
        :pending="pending"
        @grade="(recall) => emit('grade', recall)"
      />
    </div>
  </article>
</template>

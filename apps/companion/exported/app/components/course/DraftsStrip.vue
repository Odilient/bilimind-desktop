<script setup lang="ts">
import type { CourseDraft } from '~/types/api'

/**
 * Unfinished courses: somebody mid-sentence.
 *
 * Courses that have not been planned yet are not courses, so they get a strip
 * of their own rather than a card. It sits at the top of the library and of
 * Today, because it is the only thing on either page that is waiting on the
 * learner rather than on the model — and a learner who closed the tab halfway
 * through the questions comes back to Today, not to the library.
 *
 * A course only leaves this strip when it has an outline — at that point it is
 * a real thing to open, and the create page has deleted the draft on its way to
 * the workspace.
 */
const props = defineProps<{ drafts: CourseDraft[] }>()
const emit = defineEmits<{ discarded: [] }>()

const api = useApi()

/** Where a draft stopped, said as a state rather than a status name. */
function draftLine(draft: CourseDraft): string {
  const questions = draft.course?.clarifying_questions ?? []

  if (draft.step === 'clarify') {
    if (questions.length === 0) return 'Working out what to ask you'

    const answered = Object.values(draft.payload.clarify ?? {}).filter(
      (answer) => answer.chips.length > 0 || answer.text.trim() !== '',
    ).length

    if (answered >= questions.length) return 'Questions answered — ready to plan'
    return answered > 0
      ? `${answered} of ${questions.length} questions answered`
      : `${plural(questions.length, 'question')} waiting for you`
  }

  if (draft.step === 'generating') {
    return draft.course?.status === 'failed'
      ? 'Planning stopped partway'
      : (draft.course?.status_label ?? 'Being planned')
  }

  return 'Just a topic so far'
}

function draftTitle(draft: CourseDraft): string {
  return draft.course?.title || draft.topic || 'Untitled course'
}

const discarding = ref<string | null>(null)

/**
 * Throw a draft away. The course it made — if it made one — goes with it: a
 * half-clarified course is not something anybody wants left in their library,
 * and the strip is the only place it appears.
 */
async function discard(draft: CourseDraft): Promise<void> {
  discarding.value = draft.uuid
  try {
    if (draft.course_id) await api.del(`/courses/${draft.course_id}`)
    await api.del(`/course-drafts/${draft.uuid}`)
    emit('discarded')
  } catch {
    useToast().error('That draft could not be discarded.')
  } finally {
    discarding.value = null
  }
}
</script>

<template>
  <section
    v-if="props.drafts.length"
    class="overflow-hidden rounded-[22px] border-[1.5px] border-dashed border-brand-line bg-brand-soft/60"
    aria-label="Unfinished courses"
  >
    <header class="flex items-center gap-2 px-4 pt-3.5 pb-2 sm:px-5">
      <UiIcon
        name="pencil"
        :size="14"
        class="text-brand"
      />
      <h2 class="font-display text-[14px] font-semibold tracking-[-0.01em] text-brand">
        Pick up where you left off
      </h2>
      <span
        v-if="props.drafts.length > 1"
        class="text-[12px] text-text-faint"
        >{{ props.drafts.length }}</span
      >
    </header>

    <ul class="px-2 pb-2 sm:px-2.5">
      <li
        v-for="draft in props.drafts"
        :key="draft.uuid"
        class="flex items-center gap-3 rounded-[14px] px-2 py-2 text-left transition-colors hover:bg-surface sm:px-2.5"
      >
        <NuxtLink
          :to="draft.path"
          class="group flex min-w-0 flex-1 items-center gap-3"
        >
          <div class="min-w-0 flex-1">
            <p
              class="truncate text-[14px] font-medium transition-colors group-hover:text-brand"
            >
              {{ draftTitle(draft) }}
            </p>
            <p class="mt-0.5 truncate text-[12.5px] text-text-muted">
              {{ draftLine(draft) }} · {{ agoLabel(draft.updated_at) }}
            </p>
          </div>

          <span
            class="hidden h-8 shrink-0 items-center gap-1.5 rounded-full bg-inverse px-3.5 text-[12.5px] font-semibold text-on-inverse transition-colors group-hover:bg-inverse-hover sm:inline-flex"
          >
            Continue
            <UiIcon
              name="arrow-right"
              :size="13"
              :stroke="2.1"
            />
          </span>
        </NuxtLink>

        <button
          type="button"
          class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-text-faint transition-colors hover:bg-surface hover:text-danger-text disabled:opacity-50"
          :disabled="discarding === draft.uuid"
          :aria-label="`Discard ${draftTitle(draft)}`"
          :title="`Discard ${draftTitle(draft)}`"
          @click="discard(draft)"
        >
          <UiIcon
            :name="discarding === draft.uuid ? 'refresh' : 'trash'"
            :size="15"
            :class="discarding === draft.uuid ? 'animate-spin' : ''"
          />
        </button>
      </li>
    </ul>
  </section>
</template>

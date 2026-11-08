<script setup lang="ts">
import type { Subject } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { checkHref, dueTopics, nextCheckOpens, sittingSize } from '~/companion/checks'
import { dayWord } from '~/companion/today-layout'
const { t: tr } = useI18n()

/**
 * A course's practice, as a tab of the course: two different things, each
 * saying what it is for before what is waiting, because "7 cards due" on its
 * own told a learner neither where the cards came from nor why to do them.
 *
 *  1. Check yourself: a few questions, no notes, on topics studied a few days
 *     ago. It is what readiness is made of, so it
 *     comes first: "3 topics ready" with Check now when topics have gone
 *     cold; when the next one opens while they are still warm; how a topic
 *     gets here when nothing has been studied.
 *  2. Flashcards: one fact a card, from the course's lessons and pages, the
 *     assistant, or a Quizlet set; each comes back just before it would be
 *     forgotten. How many to review now (the review takes the same 24 hours
 *     this count does), when the next ones come back when none are, and the
 *     cards by topic. With no cards yet, where they come from.
 *
 * `?tab=practice` lands here (Practice's way back, and the check's).
 */
const props = defineProps<{ subject: Subject }>()
const c = useCompanion()

const due = computed(() => dueTopics(c, { subjectId: props.subject.id }))
const sitting = computed(() => sittingSize(due.value.length, 'cold'))
const opens = computed(() =>
  due.value.length
    ? null
    : nextCheckOpens(c, c.topics.value.filter((t) => t.subject_id === props.subject.id).map((t) => t.id)),
)
const checkTo = computed(() =>
  checkHref({ subjectId: props.subject.id, from: `/app/courses/${props.subject.id}?tab=practice` }),
)

const cards = computed(() => c.cards.value.filter((k) => k.subject_id === props.subject.id && !k.suspended))
const dueCards = computed(() => cards.value.filter((k) => Date.parse(k.due_at) <= Date.now() + 86_400_000))
/** When the next card comes back, while none is waiting. */
const nextCard = computed(() => {
  if (dueCards.value.length || !cards.value.length) return null
  const first = cards.value.reduce((a, b) => (Date.parse(a.due_at) <= Date.parse(b.due_at) ? a : b))
  return dayWord(first.due_at)
})
const cardTopics = computed(() => {
  const map = new Map<string, { title: string; total: number; due: number }>()
  for (const k of cards.value) {
    const t = c.get('topics', k.topic_id)
    const key = t?.id ?? 'none'
    const row = map.get(key) ?? { title: t?.title ?? tr('course.practice.other'), total: 0, due: 0 }
    row.total++
    if (Date.parse(k.due_at) <= Date.now() + 86_400_000) row.due++
    map.set(key, row)
  }
  return [...map.values()].sort((a, b) => b.due - a.due)
})

// Daylight 2 (gaps): paste a Quizlet set's export; it becomes this course's cards.
const quizlet = ref(false)
</script>

<template>
  <div class="mx-auto grid w-full max-w-[760px] content-start gap-6 px-4 pt-6 pb-20 min-[900px]:px-8 min-[900px]:pt-8">
    <!-- 1. Check yourself -->
    <section
      class="grid gap-4 rounded-[20px] bg-surface p-5 shadow-[inset_0_0_0_1px_var(--border)] min-[900px]:p-6"
      aria-labelledby="course-check"
    >
      <header class="flex items-start gap-3">
        <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-rose-soft text-rose-ink">
          <UiIcon
            name="check"
            :size="18"
            :stroke="2.1"
          />
        </span>
        <div class="grid gap-1">
          <h2
            id="course-check"
            class="t-head text-[19px]"
          >
            {{ tr('course.practice.checkTitle') }}
          </h2>
          <p class="text-[14.5px] leading-relaxed text-text-muted">
            {{ tr('course.practice.checkWhat') }}
          </p>
        </div>
      </header>
      <div
        v-if="due.length"
        class="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border-rule pt-4"
      >
        <div class="min-w-0 flex-1">
          <p class="text-[16px] font-semibold text-text">
            {{ tr('course.practice.ready', due.length) }}
          </p>
          <p class="text-[14px] text-text-muted">
            {{ tr('course.practice.sitting', { n: sitting.questions, time: minutesLabel(sitting.minutes) }) }}
          </p>
        </div>
        <UiBtn
          :to="checkTo"
          variant="primary"
          size="md"
          trailing-icon="arrow-right"
        >
          {{ tr('course.practice.checkNow') }}
        </UiBtn>
      </div>
      <p
        v-else
        class="border-t border-border-rule pt-4 text-[14.5px] text-text-body"
      >
        {{ opens ? tr('course.practice.checkOpens', { when: dayWord(opens) }) : tr('course.practice.checkNone') }}
      </p>
    </section>

    <!-- 2. Flashcards -->
    <section
      class="grid gap-4 rounded-[20px] bg-surface p-5 shadow-[inset_0_0_0_1px_var(--border)] min-[900px]:p-6"
      aria-labelledby="course-cards"
    >
      <header class="flex items-start gap-3">
        <span class="grid size-9 shrink-0 place-items-center rounded-[10px] bg-sky-soft text-sky-ink">
          <UiIcon
            name="cards"
            :size="18"
          />
        </span>
        <div class="grid gap-1">
          <h2
            id="course-cards"
            class="t-head text-[19px]"
          >
            {{ tr('course.practice.cardsTitle') }}
          </h2>
          <p class="text-[14.5px] leading-relaxed text-text-muted">
            {{ tr('course.practice.cardsWhat') }}
          </p>
        </div>
      </header>

      <template v-if="cards.length">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border-rule pt-4">
          <div class="min-w-0 flex-1">
            <p class="text-[16px] font-semibold text-text">
              {{ dueCards.length ? tr('course.practice.cardsDue', { n: dueCards.length }) : tr('course.practice.cardsNone') }}
            </p>
            <p class="text-[14px] text-text-muted">
              {{ nextCard ? tr('course.practice.cardsNext', { when: nextCard }) : tr('course.practice.cardsTotal', { n: cards.length }) }}
            </p>
          </div>
          <UiBtn
            v-if="dueCards.length"
            :to="`/app/practice?subject=${subject.id}`"
            variant="primary"
            size="md"
            trailing-icon="arrow-right"
          >
            {{ tr('course.practice.start') }}
          </UiBtn>
        </div>

        <div>
          <h3 class="mb-1 text-[13px] font-semibold text-text-muted">
            {{ tr('course.practice.byTopic') }}
          </h3>
          <ul class="divide-y divide-border-rule border-y border-border-rule">
            <li
              v-for="row in cardTopics"
              :key="row.title"
              class="flex items-baseline justify-between gap-3 py-2.5"
            >
              <span class="min-w-0 truncate text-[15px] font-medium text-text">{{ row.title }}</span>
              <span class="shrink-0 text-[13.5px] text-text-muted">{{ row.due ? tr('course.practice.topicLine', { n: row.due, total: row.total }) : tr('course.practice.topicTotal', { total: row.total }) }}</span>
            </li>
          </ul>
        </div>
      </template>
      <p
        v-else
        class="border-t border-border-rule pt-4 text-[14.5px] text-text-body"
      >
        {{ tr('course.practice.noCards') }}
      </p>

      <!-- Bring cards in, quietly at the foot. Taking them out is not
           offered beside "Review now": the cards go in "Download this course". -->
      <p class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13.5px] text-text-muted">
        <button
          type="button"
          class="cursor-pointer font-medium text-text-soft hover:text-text hover:underline"
          @click="quizlet = true"
        >
          {{ tr('course.practice.quizlet') }}
        </button>
        <NuxtLink
          :to="`/app/p/new?subject_id=${subject.id}`"
          class="font-medium text-text-soft hover:text-text hover:underline"
        >
          {{ tr('course.practice.write') }}
        </NuxtLink>
      </p>
    </section>
    <CompanionImportsQuizletModal
      v-model:open="quizlet"
      :subject-id="subject.id"
    />
  </div>
</template>

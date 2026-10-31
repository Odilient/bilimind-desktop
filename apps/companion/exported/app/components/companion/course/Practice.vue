<script setup lang="ts">
import type { Subject } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { checkHref, dueTopics, nextCheckOpens, sittingSize } from '~/companion/checks'
import { dayWord } from '~/companion/today-layout'

/**
 * A course's practice, as a tab of the course: first the check, then the
 * cards. The check comes first because it is short and it is what readiness
 * is made of: "3 topics ready to check" with Check now
 * when topics studied a few days ago have gone cold; "Your next check opens
 * Saturday" when they are still warm; nothing at all when nothing has been
 * studied. Then how many of its cards are due, the one button that starts
 * them, and the cards by topic. With no cards yet, the way to make some is
 * to write a page, so that is the button. `?tab=practice` lands here
 * (Practice's way back, and the check's).
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
const cardTopics = computed(() => {
  const map = new Map<string, { title: string; total: number; due: number }>()
  for (const k of cards.value) {
    const t = c.get('topics', k.topic_id)
    const key = t?.id ?? 'none'
    const row = map.get(key) ?? { title: t?.title ?? 'Other', total: 0, due: 0 }
    row.total++
    if (Date.parse(k.due_at) <= Date.now() + 86_400_000) row.due++
    map.set(key, row)
  }
  return [...map.values()].sort((a, b) => b.due - a.due)
})
</script>

<template>
  <div class="mx-auto grid w-full max-w-[760px] content-start gap-10 px-4 pt-6 pb-20 min-[900px]:gap-12 min-[900px]:px-8 min-[900px]:pt-8">
    <section
      v-if="due.length"
      class="grid gap-4"
      aria-labelledby="course-check"
    >
      <div class="grid gap-1">
        <h2
          id="course-check"
          class="t-head text-[19px]"
        >
          {{ plural(due.length, 'topic') }} ready to check
        </h2>
        <p class="text-[15px] text-text-muted">
          {{ sitting.questions }} questions · about {{ minutesLabel(sitting.minutes) }} · no notes, no help
        </p>
      </div>
      <div>
        <UiBtn
          :to="checkTo"
          variant="primary"
          size="lg"
        >
          Check now
        </UiBtn>
      </div>
    </section>
    <p
      v-else-if="opens"
      class="text-[15px] text-text-muted"
    >
      Your next check opens {{ dayWord(opens) }}.
    </p>

    <section
      v-if="cards.length"
      class="grid gap-4"
      aria-labelledby="course-practice"
    >
      <div class="grid gap-1">
        <h2
          id="course-practice"
          class="t-head text-[19px]"
        >
          {{ dueCards.length ? `${dueCards.length} cards to review` : 'Nothing to review right now' }}
        </h2>
        <p class="text-[15px] text-text-muted">
          Cards and questions made from this course's own slides, notes and lectures.
          <template v-if="!dueCards.length">
            The next ones are due tomorrow or later.
          </template>
        </p>
      </div>
      <div>
        <UiBtn
          :to="`/app/practice?subject=${subject.id}`"
          variant="primary"
          size="lg"
          :disabled="!dueCards.length"
        >
          Start practice
        </UiBtn>
      </div>
    </section>

    <section
      v-if="cardTopics.length"
      aria-labelledby="course-by-topic"
    >
      <h2
        id="course-by-topic"
        class="t-head mb-2 text-[19px]"
      >
        By topic
      </h2>
      <ul class="divide-y divide-border-rule border-y border-border-rule">
        <li
          v-for="t in cardTopics"
          :key="t.title"
          class="flex items-baseline justify-between gap-3 py-3"
        >
          <span class="min-w-0 truncate text-[16px] font-medium text-text">{{ t.title }}</span>
          <span class="shrink-0 text-[14px] text-text-muted">{{ t.due ? `${t.due} to review · ` : '' }}{{ t.total }} cards</span>
        </li>
      </ul>
    </section>
    <section
      v-else
      class="grid gap-4"
    >
      <p class="text-[15px] text-text-body">
        No cards yet. They are made from your pages and the lecture recordings, each one citing the
        slide it came from.
      </p>
      <div>
        <UiBtn
          :to="`/app/p/new?subject_id=${subject.id}`"
          variant="primary"
          size="lg"
          icon="plus"
        >
          Write a page for this course
        </UiBtn>
      </div>
    </section>
  </div>
</template>

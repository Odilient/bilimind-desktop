<script setup lang="ts">
/**
 * For a midterm, a final or a booked exam: how many days are left, and the
 * score it needs for the grade the learner is after. A plain section on the
 * deadline's page, under the readiness panel: a heading, a sentence, a row
 * of grades to pick from, and the answer in one line. It used to be two
 * boxes side by side, a big countdown numeral and a calculator; the number
 * of days now opens the sentence, and the date itself is in the page's
 * header already.
 *
 * The score only shows once something in the course has been marked,
 * because before that there is nothing honest to work from.
 */
import type { Deadline } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { TARGETS, neededOn } from '~/companion/grades'
import { dayKey, daysBetween } from '~/companion/time'
import { kindWord } from '~/companion/words'

const props = defineProps<{ deadline: Deadline }>()
const c = useCompanion()
const { t, locale } = useI18n()

const course = computed(() => c.deadlines.value.filter((d) => d.subject_id === props.deadline.subject_id))

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 60_000)
})
onBeforeUnmount(() => clearInterval(timer))

// Tasks and grades: an assessment with no date yet (a course's Grades view
// often has one) still gets the sum, without the countdown; only one whose
// date has passed has nothing left to need.
const left = computed(() => {
  if (!props.deadline.due_at) return ''
  const days = daysBetween(dayKey(now.value), dayKey(props.deadline.due_at))
  if (days < 0) return null
  if (days === 0) return t('check.exam.today')
  if (days === 1) return t('check.exam.tomorrow')
  return t('check.exam.daysToGo', days)
})

const target = ref(TARGETS.find((t) => t.label === 'B+')!)
const result = computed(() => neededOn(props.deadline, course.value, target.value.percent))
const word = computed(() => kindWord(props.deadline.kind).toLowerCase())

const assumption = computed(() => {
  const r = result.value
  if (!r) return ''
  const names = r.assumed.map((d) => d.title)
  const list = new Intl.ListFormat(intlTag(locale.value), { type: 'conjunction' }).format(names)
  const shown = { average: r.average, weight: r.markedWeight }
  return names.length ? t('check.exam.assumes', { list, ...shown }) : t('check.exam.fromAverage', shown)
})
</script>

<template>
  <section
    v-if="left !== null && result"
    class="grid gap-3"
    aria-labelledby="exam-need"
  >
    <h2
      id="exam-need"
      class="t-head text-[19px]"
    >
      {{ t('check.exam.title') }}
    </h2>
    <p class="text-[15px] text-text-body">
      {{ left }} {{ t('check.exam.pick') }}
    </p>
    <div
      class="grid grid-cols-4 gap-2 min-[600px]:flex"
      role="radiogroup"
      :aria-label="t('check.exam.gradeAria')"
    >
      <button
        v-for="t in TARGETS"
        :key="t.label"
        type="button"
        role="radio"
        :aria-checked="target.label === t.label"
        class="h-11 rounded-full border px-2 text-[14.5px] font-semibold whitespace-nowrap transition-colors min-[600px]:px-4"
        :class="target.label === t.label ? 'border-ink bg-ink text-white' : 'border-border-strong bg-surface text-text-soft hover:border-text-faint hover:text-text'"
        @click="target = t"
      >
        {{ t.label }} <span class="font-medium opacity-70">{{ t.percent }}%</span>
      </button>
    </div>
    <p class="t-head pt-1 text-[22px] leading-snug">
      <template v-if="result.state === 'reachable'">
        {{ t('check.exam.reachable', { need: result.need, word, grade: target.label }) }}
      </template>
      <template v-else-if="result.state === 'secured'">
        {{ t('check.exam.secured', { word, grade: target.label }) }}
      </template>
      <template v-else>
        {{ t('check.exam.unreachable', { word, grade: target.label, best: result.best }) }}
      </template>
    </p>
    <p class="text-[14px] leading-relaxed text-text-muted">
      {{ assumption }}
    </p>
  </section>
</template>

<script setup lang="ts">
/**
 * The answer to "what should I do right now": the old Today's hero card
 * (`pages/today.vue`), cobalt slab, beams, grain and one glossy object, with
 * one lime button. It is the one card on the page that gets the colour.
 *
 * What it holds is decided again every 30 seconds (`useNow`), in this order:
 *
 *  1. A class on now, or starting within a quarter of an hour: Take notes,
 *     which opens a lecture page already filed under that class (or the page
 *     already started in it). Record sits beside it, quieter.
 *  2. A new account (no course of its own yet) with the sample course:
 *     "Start here", its next lesson. The first minute of BiliMind is a real
 *     lesson, not a tour.
 *  3. The next unfinished thing on today's plan that opens something: a
 *     lesson (Resume), flashcards (Review), a deadline's work. A check
 *     (the planner puts it first: it is short, and it is the measurement)
 *     gets its own words: the topics it covers, what it costs, that it is
 *     done with no notes and no help, and why it is asked now.
 *  4. The next lesson on the path of a course learned on one's own.
 *  5. A deadline in the next three days the learner isn't ready for, "not
 *     checked yet" included (unchecked three days out is worth the card).
 *     Its button follows the deadline page: a check when topics in its
 *     scope have gone cold, "See what it needs" when nothing in it has been
 *     studied, otherwise practice.
 *  6. Flashcards due: Review.
 *  7. No course at all (the samples removed, nothing made yet): "What do you
 *     want to learn?", which opens the chat in course mode.
 *  8. Otherwise nothing is pressing, which is the moment to plan: "Plan my
 *     week" asks BiliMind (with Quiet AI on, it opens the week instead).
 *
 * Under the card, one line names the next class today when the card is
 * about something else, so the day keeps its anchor.
 */
import { NuxtLink } from '#components'
import type { Deadline, PlanTask, Readiness, Session } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { useCapture } from '~/companion/capture'
import { useAi } from '~/companion/ai/state'
import { useQuietAi } from '~/companion/quiet-ai'
import { newChatLink } from '~/companion/ai/routes'
import { FOCUS_MIN, useFocus } from '~/companion/focus'
import { clock, dayKey, untilLabel } from '~/companion/time'
import { KIND_WORD, dueLong, readyWords, sessionLine } from '~/companion/words'
import { checkHref } from '~/companion/checks'
import {
  classHref,
  classNow,
  dayWord,
  deadlinesWithin,
  isStudy,
  lessonNow,
  nextClassToday,
  notesOf,
  takeNotes,
  taskHref,
  topicHref,
  useNow,
} from '~/companion/today-layout'

const c = useCompanion()
const capture = useCapture()
const ai = useAi()
const { quiet } = useQuietAi()
const now = useNow()
const focus = useFocus()

const today = computed(() => dayKey(now.value))

/** A lecture, seminar or lab on now or about to start: not a study slot. */
const lecture = computed<Session | null>(() => {
  const s = classNow(c, now.value)
  return s && !isStudy(c, s) ? s : null
})

const task = computed<PlanTask | null>(
  () =>
    c.planTasks.value
      .filter((t) => t.date === today.value && !t.done_at)
      .sort((a, b) => a.position - b.position)
      .find((t) => taskHref(t, c)) ?? null,
)

/** A deadline close enough to worry about, and not ready for. */
const urgent = computed<{ d: Deadline; r: Readiness } | null>(() => {
  for (const d of deadlinesWithin(c, now.value, 3)) {
    const r = c.readinessOf(d)
    // No scope, nothing to be ready for. Unchecked counts as 0, so a
    // deadline nobody has checked is "not ready" too.
    if (r.total && r.percent < 70) return { d, r }
  }
  return null
})

/** No course of the learner's own yet: the sample course's next lesson is where to begin. */
const starter = computed(() => {
  if (c.subjects.value.some((s) => !s.sample)) return null
  const subject = c.shelf.value.find((s) => s.sample)
  if (!subject) return null
  const steps = c.pathOf(subject.id)
  const n = steps.findIndex((s) => s.state === 'now')
  return n < 0 ? null : { subject, topic: steps[n]!.topic, n: n + 1 }
})

/** The next lesson on a path that isn't on today's plan (a planned one is the task). */
const lesson = computed(() => {
  const next = lessonNow(c, today.value)
  return next && !next.planned ? next : null
})

const cardsDue = computed(() => c.today.value?.reviews_due ?? 0)

const mode = computed<'class' | 'start' | 'task' | 'lesson' | 'deadline' | 'cards' | 'first' | 'plan'>(() => {
  if (lecture.value) return 'class'
  if (starter.value) return 'start'
  if (task.value) return 'task'
  if (lesson.value) return 'lesson'
  if (urgent.value) return 'deadline'
  if (cardsDue.value) return 'cards'
  if (!c.shelf.value.length) return 'first'
  return 'plan'
})

/*
 * Writing a sitting's questions takes the model about half a minute, too long
 * to wait for after "Start the check". So once the card IS the check, the
 * sitting is written now, in the background, with the same body the check
 * page will send; the server hands that open batch back the moment the page
 * asks, and the intro still shows because nothing in it is answered yet. One
 * call a day at most: an open batch is reused, never rewritten.
 */
const prepared = new Set<string>()
watch(
  () => (mode.value === 'task' && task.value?.kind === 'check' ? task.value : null),
  (t) => {
    if (!t || prepared.has(t.id)) return
    prepared.add(t.id)
    void c.startCheck({ purpose: 'cold', ...(t.deadline_id ? { deadline_id: t.deadline_id } : {}) }).catch(() => {
      // Offline or the model is down: the check page asks again, and says so there.
    })
  },
  { immediate: true },
)

const subject = computed(() => {
  if (mode.value === 'class') return c.subjectOf(lecture.value)
  if (mode.value === 'task') return c.subjectOf(task.value)
  if (mode.value === 'deadline') return c.subjectOf(urgent.value?.d ?? null)
  return null
})

const notes = computed(() => (lecture.value ? notesOf(c, lecture.value) : null))
const canRecord = computed(() => mode.value === 'class' && subject.value?.recording_allowed !== false)

const VERB: Record<PlanTask['kind'], string> = {
  lesson: 'Resume',
  read: 'Read',
  review: 'Review',
  practice: 'Practise',
  prepare: 'Open',
  work: 'Open',
  own: 'Start',
  check: 'Start the check',
}

const card = computed(() => {
  switch (mode.value) {
    case 'class': {
      const s = lecture.value!
      const topic = c.get('topics', s.topic_id)
      const started = Date.parse(s.starts_at) <= now.value
      return {
        icon: 'mic',
        eyebrow: started ? `Happening now · until ${clock(s.ends_at)}` : `Starts ${untilLabel(s.starts_at, now.value)}`,
        title: topic ? `${s.title} · ${topic.title}` : s.title,
        line: [subject.value?.title, sessionLine(s)].filter(Boolean).join(' · '),
        pill: notes.value ? 'Open your notes' : 'Take notes',
        // A button: the page is made on the press, already filed under the class.
        to: null,
        object: 'docs',
      }
    }
    case 'start': {
      const { subject: course, topic, n } = starter.value!
      return {
        icon: 'play',
        eyebrow: 'Start here',
        title: course.title,
        line: `Lesson ${n}: ${topic.title}. A short sample course, to see how lessons, notes and flashcards work.`,
        pill: `Open lesson ${n}`,
        to: topicHref(topic),
        object: 'book',
      }
    }
    case 'task': {
      const t = task.value!
      if (t.kind === 'check') {
        // The planner's title is "Check yourself on A and B"; the eyebrow
        // already says "Check yourself", so the title is the topics alone.
        return {
          icon: 'check',
          eyebrow: 'Check yourself',
          title: t.title.replace(/^Check yourself on /, ''),
          line: [t.detail?.split(' · ')[0], `about ${minutesLabel(t.minutes)}`, 'no notes, no help'].filter(Boolean).join(' · '),
          sub: 'You studied these a few days ago. This is how BiliMind knows what stuck.',
          pill: VERB.check,
          to: taskHref(t, c),
          object: 'check',
        }
      }
      return {
        icon: t.kind === 'lesson' ? 'play' : 'sparkles',
        eyebrow: t.kind === 'lesson' ? 'Pick up where you left off' : 'Next on your plan',
        title: t.title,
        line: [subject.value?.title, t.detail].filter(Boolean).join(' · '),
        pill: VERB[t.kind],
        to: taskHref(t, c),
        object: t.kind === 'review' || t.kind === 'practice' ? 'check' : t.kind === 'lesson' || t.kind === 'read' ? 'book' : 'docs',
      }
    }
    case 'lesson': {
      const { topic, subject: course } = lesson.value!
      return {
        icon: 'play',
        eyebrow: 'Pick up where you left off',
        title: topic.title,
        line: c.goalOf(course)?.title ?? course.title,
        pill: 'Resume',
        to: topicHref(topic),
        object: 'book',
      }
    }
    case 'deadline': {
      const { d, r } = urgent.value!
      const base = {
        icon: 'clock',
        eyebrow: `${KIND_WORD[d.kind]} ${dayWord(d.due_at!, now.value)}`,
        line: [subject.value?.title, readyWords(r.checked ? r.percent : null), dueLong(d)].filter(Boolean).join(' · '),
        object: 'trophy',
      }
      const topics = r.suggestion.check.topics
      if (topics) {
        return { ...base, title: `Check yourself for ${d.title}`, pill: `Check ${plural(topics, 'topic')}`, to: checkHref({ deadlineId: d.id }) }
      }
      if (!r.topics.some((t) => t.last_studied_at)) {
        return { ...base, title: `See what ${d.title} needs`, pill: 'See what it needs', to: checkHref({ purpose: 'prepare', deadlineId: d.id }) }
      }
      // No cards to practise yet: the deadline page says where they come from.
      return r.suggestion.practice.cards
        ? { ...base, title: `Practice for ${d.title}`, pill: 'Practise', to: `/app/practice?deadline=${d.id}` }
        : { ...base, title: `Get ready for ${d.title}`, pill: 'Open it', to: `/app/d/${d.id}` }
    }
    case 'cards':
      return {
        icon: 'cards',
        eyebrow: 'Flashcards due',
        title: `Review ${plural(cardsDue.value, 'card')}`,
        line: `About ${minutesLabel(Math.max(2, Math.round(cardsDue.value * 0.5)))}. Made from your slides and notes, back just before you'd forget them.`,
        pill: 'Review',
        to: '/app/practice',
        object: 'check',
      }
    case 'first':
      return {
        icon: 'spark',
        eyebrow: 'Your first course',
        title: 'What do you want to learn?',
        line: 'Say it in a sentence, with a date if there is one. BiliMind drafts the course in a chat, and nothing is made until you press Create.',
        pill: 'Make a course',
        to: newChatLink({ intent: 'course' }),
        object: 'rocket',
      }
    default:
      return quiet.value
        ? {
            icon: 'calendar',
            eyebrow: 'Nothing pressing',
            title: 'A free moment',
            line: 'Nothing due soon and nothing left on the list. Look at the week ahead.',
            pill: 'See the week',
            to: '/app/calendar',
            object: 'calendar',
          }
        : {
            icon: 'spark',
            eyebrow: 'Nothing pressing',
            title: 'Plan the week with BiliMind',
            line: 'It reads your classes and what is due, and gives each day a short list.',
            pill: 'Plan my week',
            to: null,
            object: 'rocket',
          }
  }
})

function primary(): void {
  if (card.value.to) return
  if (mode.value === 'class' && lecture.value) void takeNotes(c, lecture.value)
  else ai.ask("Plan my week: what should I do each day so I'm ready for what's due?")
}

/** A focus block on the task, with its work opened. */
function focusOn(t: PlanTask): void {
  const to = taskHref(t, c)
  focus.start({ label: t.title, taskId: t.id, to })
  if (to) void navigateTo(to)
}

function record(): void {
  if (lecture.value) capture.show('record', lecture.value.subject_id, lecture.value.id)
}

/** Under a card about something else: the next class today. */
const after = computed(() => {
  const next = nextClassToday(c, now.value)
  if (!next || next.id === lecture.value?.id) return null
  const course = c.subjectOf(next)
  return {
    to: classHref(next),
    text: [`Next class ${clock(next.starts_at)}`, `${course?.title ?? ''} ${next.title}`.trim(), next.location]
      .filter(Boolean)
      .join(' · '),
  }
})
</script>

<template>
  <section aria-label="Right now">
    <Transition
      mode="out-in"
      enter-active-class="duration-200 ease-out"
      enter-from-class="translate-y-1 opacity-0"
      leave-active-class="duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        :key="`${mode}:${card.title}`"
        class="group cb-cobalt relative isolate rounded-[26px] p-5 shadow-[0_30px_60px_-34px_rgb(20_40_200/0.6)] sm:p-7 sm:pr-48"
      >
        <span class="cb-beams" />
        <span class="cb-grain" />
        <img
          :src="`/img/cobalt/obj-${card.object}.webp`"
          alt=""
          aria-hidden="true"
          class="cb-obj -top-9 right-4 hidden w-40 transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-2 sm:block"
        >
        <span class="cb-eb on-dark relative">
          <span class="dot"><UiIcon
            :name="card.icon"
            :size="10"
            :stroke="2.4"
          /></span>
          {{ card.eyebrow }}
        </span>
        <h2 class="t-head relative mt-4 text-[24px] leading-[1.12] text-white sm:text-[30px]">
          {{ card.title }}
        </h2>
        <p
          v-if="card.line"
          class="relative mt-2 text-[14px] text-white/72"
        >
          {{ card.line }}
        </p>
        <p
          v-if="'sub' in card"
          class="relative mt-1 text-[14px] text-white/72"
        >
          {{ card.sub }}
        </p>

        <div class="relative mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <component
            :is="card.to ? NuxtLink : 'button'"
            :to="card.to ?? undefined"
            :type="card.to ? undefined : 'button'"
            class="cb-pill lime h-12 cursor-pointer pr-[17px] pl-6 text-[15px] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-cobalt focus-visible:outline-none"
            @click="primary"
          >
            {{ card.pill }}
            <span class="arr">
              <UiIcon
                :name="mode === 'class' && !notes ? 'pencil' : mode === 'plan' && !quiet ? 'spark' : 'arrow-right'"
                :size="14"
                :stroke="2.2"
              />
            </span>
          </component>

          <button
            v-if="canRecord"
            type="button"
            class="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full px-2 text-[13.5px] text-white/80 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
            @click="record"
          >
            <UiIcon
              name="mic"
              :size="14"
            />
            Record
          </button>
          <!-- A check is timed by its questions, not a focus block. -->
          <template v-else-if="mode === 'task' && task && task.kind !== 'check'">
            <button
              v-if="focus.state.value?.task_id !== task.id"
              type="button"
              class="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full px-2 text-[13.5px] text-white/80 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
              @click="focusOn(task)"
            >
              <UiIcon
                name="timer"
                :size="14"
              />
              Focus {{ FOCUS_MIN }} min
            </button>
            <span
              v-if="task.minutes"
              class="inline-flex items-center gap-1.5 text-[13px] text-white/72"
            >
              <UiIcon
                name="clock"
                :size="13"
              />
              {{ minutesLabel(task.minutes) }}
            </span>
          </template>
        </div>
      </div>
    </Transition>

    <NuxtLink
      v-if="after"
      :to="after.to"
      class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-[13px] text-text-faint transition-colors hover:text-text-soft"
    >
      <UiIcon
        name="clock"
        :size="13"
      />
      {{ after.text }}
    </NuxtLink>
  </section>
</template>

<script setup lang="ts">
/**
 * The answer to "what should I do right now": Today's pick, drawn as Daylight
 * 2's Today card (docs/design/daylight2/sections/07-today.html). "How long do
 * you have?" (10 min, 20, an hour) above one pick with one ink button. The
 * time only shows when it can change the pick, and it only picks among the
 * plan's tasks: a class on now is on now, however long you have.
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
import { clock, dayKey, nowIso, untilLabel } from '~/companion/time'
import { kindWord, dueLong, readyWords, sessionLine } from '~/companion/words'
import { checkHref } from '~/companion/checks'
import { TIME_CHOICES, dueWords, pickFor, type TimeChoice } from '~/companion/today-pick'
import { useUsage } from '~/companion/usage'
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

const { t: tr } = useI18n()
const c = useCompanion()
const capture = useCapture()
const ai = useAi()
const { quiet } = useQuietAi()
const now = useNow()
const focus = useFocus()
const toast = useToast()

const today = computed(() => dayKey(now.value))

/** A lecture, seminar or lab on now or about to start: not a study slot. */
const lecture = computed<Session | null>(() => {
  const s = classNow(c, now.value)
  return s && !isStudy(c, s) ? s : null
})

/*
 * "How long do you have?" (Daylight 2's Today): 10 minutes, 20, or an hour.
 * The pick is `pickFor` (companion/today-pick.ts): the first thing on today's
 * plan, in the planner's order, that fits the time, or one that can be cut
 * down to it ("10 of its 25 min"). When nothing fits, the plan's first task
 * still, with its real length beside the button rather than a promise it
 * can't keep. Kept for the visit, not saved: the time you have is today's
 * answer, not a setting.
 */
const budget = useState<TimeChoice>('today:budget', () => 20)
const budgetWord = (m: TimeChoice): string => (m === 60 ? tr('today.hero.hour') : tr('today.hero.minutes', { n: m }))

/** Today's plan, still to do, that opens something: what the pick is chosen from. */
const open = computed<PlanTask[]>(() =>
  c.planTasks.value
    .filter((t) => t.date === today.value && !t.done_at && taskHref(t, c))
    .sort((a, b) => a.position - b.position),
)

const picked = computed(() => pickFor(open.value, budget.value))
const task = computed<PlanTask | null>(() => picked.value?.task ?? open.value[0] ?? null)
/** What the pick takes in the time given: its own minutes, or what it was cut down to. */
const pickMinutes = computed(() =>
  picked.value && picked.value.task.id === task.value?.id ? picked.value.minutes : (task.value?.minutes ?? 0),
)

/** The time is asked whenever the card is a task of the plan's: it is what sizes it. */
const sized = computed(() => mode.value === 'task')

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
 *
 * Not on a plan with no AI of its own (Free) without a key: there it would be
 * credits spent before anyone pressed Start, and credits are only spent on what
 * the learner asked for. They wait the half minute instead.
 */
const { usage: aiUsage, ensure: ensureAiUsage } = useUsage()
onMounted(ensureAiUsage)
const prepared = new Set<string>()
watch(
  () => (mode.value === 'task' && task.value?.kind === 'check' && aiUsage.value && (aiUsage.value.plan_ai !== false || aiUsage.value.own_key) ? task.value : null),
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

/** The task the card is about: "Also today" (Plan) leaves it out, so nothing is said twice. */
const pick = useState<string | null>('today:pick', () => null)
watchEffect(() => {
  pick.value = mode.value === 'task' ? (task.value?.id ?? null) : null
})

function markDone(t: PlanTask): void {
  void c.upsert<PlanTask>('plan-tasks', { id: t.id, done_at: nowIso() })
  toast.success({
    title: tr('today.plan.done', { title: t.title }),
    action: { label: tr('today.plan.undo'), handler: () => void c.upsert<PlanTask>('plan-tasks', { id: t.id, done_at: null }) },
  })
}

const notes = computed(() => (lecture.value ? notesOf(c, lecture.value) : null))
const canRecord = computed(() => false)

const verb = (kind: PlanTask['kind']): string => tr(`today.hero.verb.${kind}`)

const card = computed(() => {
  switch (mode.value) {
    case 'class': {
      const s = lecture.value!
      const topic = c.get('topics', s.topic_id)
      const started = Date.parse(s.starts_at) <= now.value
      return {
        icon: 'mic',
        eyebrow: started ? tr('today.hero.nowUntil', { time: clock(s.ends_at) }) : tr('today.hero.starts', { when: untilLabel(s.starts_at, now.value) }),
        title: topic ? `${s.title} · ${topic.title}` : s.title,
        line: [subject.value?.title, sessionLine(s)].filter(Boolean).join(' · '),
        pill: tr(notes.value ? 'today.classes.openNotes' : 'today.classes.takeNotes'),
        // A button: the page is made on the press, already filed under the class.
        to: null,
        object: 'docs',
      }
    }
    case 'start': {
      const { subject: course, topic, n } = starter.value!
      return {
        icon: 'play',
        eyebrow: tr('today.hero.startHere'),
        title: course.title,
        line: tr('today.hero.startLine', { n, title: topic.title }),
        pill: tr('today.hero.openLesson', { n }),
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
          eyebrow: tr('today.hero.checkYourself'),
          title: t.title.replace(/^Check yourself on /, ''),
          line: [t.detail?.split(' · ')[0], tr('today.plan.about', { time: minutesLabel(t.minutes) }), tr('today.hero.noHelp')].filter(Boolean).join(' · '),
          sub: tr('today.hero.checkSub'),
          pill: verb('check'),
          to: taskHref(t, c),
          object: 'check',
        }
      }
      // Why now, the way the landing's card says it: "Midterm is on Wednesday".
      // The course is already named on the card, by its cover.
      const due = c.get('deadlines', t.deadline_id)
      return {
        icon: t.kind === 'lesson' ? 'play' : 'sparkles',
        eyebrow: tr(t.kind === 'lesson' ? 'today.hero.pickUp' : 'today.hero.doNow'),
        title: t.title,
        line: [due ? dueWords(due, today.value) : null, t.detail].filter(Boolean).join(' · '),
        pill: verb(t.kind),
        to: taskHref(t, c),
        object: t.kind === 'review' || t.kind === 'practice' ? 'check' : t.kind === 'lesson' || t.kind === 'read' ? 'book' : 'docs',
      }
    }
    case 'lesson': {
      const { topic, subject: course } = lesson.value!
      return {
        icon: 'play',
        eyebrow: tr('today.hero.pickUp'),
        title: topic.title,
        line: c.goalOf(course)?.title ?? course.title,
        pill: tr('today.hero.verb.lesson'),
        to: topicHref(topic),
        object: 'book',
      }
    }
    case 'deadline': {
      const { d, r } = urgent.value!
      const base = {
        icon: 'clock',
        eyebrow: `${kindWord(d.kind)} ${dayWord(d.due_at!, now.value)}`,
        line: [subject.value?.title, readyWords(r.checked ? r.percent : null), dueLong(d)].filter(Boolean).join(' · '),
        object: 'trophy',
      }
      const topics = r.suggestion.check.topics
      if (topics) {
        return { ...base, title: tr('today.hero.checkFor', { title: d.title }), pill: tr('today.hero.checkTopics', topics), to: checkHref({ deadlineId: d.id }) }
      }
      if (!r.topics.some((t) => t.last_studied_at)) {
        return { ...base, title: tr('today.hero.seeNeeds', { title: d.title }), pill: tr('today.changes.seeNeeds'), to: checkHref({ purpose: 'prepare', deadlineId: d.id }) }
      }
      // No cards to practise yet: the deadline page says where they come from.
      return r.suggestion.practice.cards
        ? { ...base, title: tr('today.hero.practiceFor', { title: d.title }), pill: tr('today.hero.verb.practice'), to: `/app/practice?deadline=${d.id}` }
        : { ...base, title: tr('today.hero.getReady', { title: d.title }), pill: tr('today.hero.openIt'), to: `/app/d/${d.id}` }
    }
    case 'cards':
      return {
        icon: 'cards',
        eyebrow: tr('today.hero.cardsDue'),
        title: tr('today.hero.reviewCards', cardsDue.value),
        line: tr('today.hero.cardsLine', { time: minutesLabel(Math.max(2, Math.round(cardsDue.value * 0.5))) }),
        pill: tr('today.hero.verb.review'),
        to: '/app/practice',
        object: 'check',
      }
    case 'first':
      return {
        icon: 'spark',
        eyebrow: tr('today.hero.firstCourse'),
        title: tr('today.hero.whatLearn'),
        line: tr('today.hero.whatLearnLine'),
        pill: tr('today.setup.courseCta'),
        to: newChatLink({ intent: 'course' }),
        object: 'rocket',
      }
    default:
      return quiet.value
        ? {
            icon: 'calendar',
            eyebrow: tr('today.hero.nothingPressing'),
            title: tr('today.hero.freeMoment'),
            line: tr('today.hero.freeLine'),
            pill: tr('today.hero.seeWeek'),
            to: '/app/calendar',
            object: 'calendar',
          }
        : {
            icon: 'spark',
            eyebrow: tr('today.hero.nothingPressing'),
            title: tr('today.hero.planWith'),
            line: tr('today.hero.planLine'),
            pill: tr('today.hero.planMyWeek'),
            to: null,
            object: 'rocket',
          }
  }
})

function primary(): void {
  if (card.value.to) return
  if (mode.value === 'class' && lecture.value) void takeNotes(c, lecture.value)
  else ai.ask(tr('today.hero.planPrompt'))
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
    text: [tr('today.hero.nextClass', { time: clock(next.starts_at) }), `${course?.title ?? ''} ${next.title}`.trim(), next.location]
      .filter(Boolean)
      .join(' · '),
  }
})
</script>

<template>
  <!-- Daylight 2's "Today" card (sections/07-today.html): how long you have,
       and the one thing worth doing in it. A card on the page, not a slab. -->
  <section
    :aria-label="tr('today.hero.label')"
    class="rounded-[18px] bg-surface p-4 shadow-[0_0_0_1px_var(--border),var(--shadow-raised)] sm:p-5"
  >
    <div
      v-if="sized"
      class="mb-4 grid gap-1.5"
    >
      <span
        id="today-budget"
        class="text-[12px] font-semibold text-text-faint"
      >{{ tr('today.hero.howLong') }}</span>
      <!-- What the switch does, said once: it was three bare durations nobody could read. -->
      <span class="-mt-1 text-[12px] leading-snug text-text-faint">{{ tr('today.hero.howLongHint') }}</span>
      <div
        class="grid grid-cols-3 gap-0.5 rounded-[11px] bg-[rgb(var(--wash-rgb)/0.065)] p-[3px]"
        role="radiogroup"
        aria-labelledby="today-budget"
      >
        <button
          v-for="m in TIME_CHOICES"
          :key="m"
          type="button"
          role="radio"
          :aria-checked="budget === m"
          :class="[
            'h-[30px] cursor-pointer rounded-[8px] text-[13px] font-semibold transition-[background-color,color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none',
            budget === m
              ? 'bg-surface text-text shadow-[var(--shadow-card),0_0_0_1px_var(--border)]'
              : 'text-text-faint hover:text-text-soft',
          ]"
          @click="budget = m"
        >
          {{ budgetWord(m) }}
        </button>
      </div>
    </div>

    <Transition
      mode="out-in"
      enter-active-class="duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
      enter-from-class="translate-y-1.5 opacity-0"
      leave-active-class="duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        :key="`${mode}:${card.title}`"
        class="grid gap-1.5 rounded-[14px] bg-surface-mute p-4 shadow-[0_0_0_1px_var(--border)]"
      >
        <span class="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-accent-strong">
          <UiIcon
            :name="card.icon"
            :size="13"
            :stroke="2.3"
          />
          {{ card.eyebrow }}
        </span>
        <span
          v-if="subject"
          class="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] font-semibold text-text-faint"
        >
          <CompanionCourseCover
            :subject="subject"
            size="sm"
            :px="18"
          />
          <span class="truncate">{{ subject.title }}</span>
        </span>
        <h2 class="mt-0.5 font-display text-[21px] leading-[1.15] font-semibold tracking-[-0.025em] text-text sm:text-[23px]">
          {{ card.title }}
        </h2>
        <p
          v-if="card.line"
          class="text-[13.5px] leading-[1.5] text-text-soft"
        >
          {{ card.line }}
        </p>
        <p
          v-if="'sub' in card"
          class="text-[13.5px] leading-[1.5] text-text-soft"
        >
          {{ card.sub }}
        </p>

        <div class="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-2">
          <component
            :is="card.to ? NuxtLink : 'button'"
            :to="card.to ?? undefined"
            :type="card.to ? undefined : 'button'"
            class="inline-flex h-[38px] cursor-pointer items-center gap-2 rounded-full bg-inverse px-[16px] text-[14px] font-semibold whitespace-nowrap text-on-inverse shadow-card transition-[background-color,transform] duration-200 hover:bg-inverse-hover active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
            @click="primary"
          >
            {{ card.pill }}
            <UiIcon
              :name="mode === 'class' && !notes ? 'pencil' : mode === 'plan' && !quiet ? 'spark' : 'arrow-right'"
              :size="14"
              :stroke="2.2"
            />
          </component>

          <button
            v-if="canRecord"
            type="button"
            class="inline-flex h-[38px] cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13.5px] font-semibold text-text-soft transition-colors hover:bg-[rgb(var(--wash-rgb)/0.065)] hover:text-text focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            @click="record"
          >
            <UiIcon
              name="mic"
              :size="14"
            />
            {{ tr('today.classes.record') }}
          </button>
          <!-- A check is timed by its questions, not a focus block. -->
          <template v-else-if="mode === 'task' && task">
            <button
              v-if="task.kind !== 'check' && focus.state.value?.task_id !== task.id"
              type="button"
              class="inline-flex h-[38px] cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13.5px] font-semibold text-text-soft transition-colors hover:bg-[rgb(var(--wash-rgb)/0.065)] hover:text-text focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              @click="focusOn(task)"
            >
              <UiIcon
                name="timer"
                :size="14"
              />
              {{ tr('today.hero.focus', { n: FOCUS_MIN }) }}
            </button>
            <button
              type="button"
              class="inline-flex h-[38px] cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13.5px] font-semibold text-text-soft transition-colors hover:bg-[rgb(var(--wash-rgb)/0.065)] hover:text-text focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              @click="markDone(task)"
            >
              <UiIcon
                name="check"
                :size="14"
                :stroke="2.3"
              />
              {{ tr('common.done') }}
            </button>
            <span
              v-if="pickMinutes"
              class="ml-auto text-[12.5px] font-semibold whitespace-nowrap text-text-faint"
            >
              {{ pickMinutes < task.minutes ? tr('today.hero.ofIts', { n: pickMinutes, time: minutesLabel(task.minutes) }) : tr('today.hero.about', { time: minutesLabel(pickMinutes) }) }}
            </span>
          </template>
        </div>
      </div>
    </Transition>

    <NuxtLink
      v-if="after"
      :to="after.to"
      class="mt-2 -mb-1 flex min-h-10 items-center gap-2 rounded-[9px] px-1 text-[13px] text-text-faint transition-colors hover:text-text-soft"
    >
      <UiIcon
        name="clock"
        :size="13"
      />
      <span class="truncate">{{ after.text }}</span>
    </NuxtLink>
  </section>
</template>

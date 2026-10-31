<script setup lang="ts">
/**
 * A deadline. One question: am I ready? Since the checks, the answer is proof rather than effort:
 * readiness is the pass rate of the learner's cold checks on what it covers
 *, so a topic nobody has checked says "not checked yet"
 * instead of a number guessed from pages made and cards rated.
 *
 * Read top to bottom: what it is and when it's due, in the header (on a
 * phone the way back names the course, so the course line above the title
 * is left to the desktop). Then the screen's one cobalt panel: how ready in
 * words, a line or two on why, one button, and at most one quiet secondary.
 * The button is whatever moves the number, so it is usually a check:
 *
 *  - some topics checked: "58% ready", how many are checked and, once there
 *    are enough answers, how sure they were against how often right; then
 *    the check on what has gone cold, or practice and the day the next check
 *    opens when nothing has;
 *  - none checked, some cold: the check, said as what it costs;
 *  - studied but still warm: the day the first check opens, and practice
 *    until then, so there is always work that counts;
 *  - nothing studied: "See what it needs", three questions on what it covers
 *    whose misses go into the plan (§3.6), rather than an outline to fill in.
 *
 * For an exam, the score it needs comes next. Then what it covers, topic by
 * topic: where each stands in the checks, and the practice beside it,
 * because the number only moves on proof and the work still has to show.
 * Then the class, when there is one (`CompanionDeadlineClass`, which draws
 * nothing otherwise), and where the date came from, each source in its own
 * words.
 *
 * After the date, readiness is held to account: "Readiness said 70%. You got
 * 74%." under the header once a grade is in, and with none yet a small
 * "What did you get?". The server compares the number with what readiness
 * said on the day (`readiness_said`), which is how BiliMind finds out
 * whether its own figure can be trusted.
 *
 * It used to lead with a ring and stack the rest in labelled boxes; the
 * button that mattered was halfway down.
 */
import type { Deadline, Readiness } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { openCompanionTab } from '~/companion/tabs'
import { courseColor } from '~/companion/colors'
import { checkHref } from '~/companion/checks'
import { dayKey, relativeDay, untilLabel } from '~/companion/time'
import { dayWord } from '~/companion/today-layout'
import { KIND_WORD, atLabel, dueLong, sourceLine, readyWords } from '~/companion/words'

definePageMeta({ layout: 'companion' })

const route = useRoute()
const c = useCompanion()
const toast = useToast()

const id = computed(() => String(route.params.id))
const deadline = computed(() => c.get('deadlines', id.value))
const subject = computed(() => c.subjectOf(deadline.value))

const readiness = ref<Readiness | null>(null)
async function loadReadiness(): Promise<void> {
  try {
    readiness.value = await c.repo().readiness(id.value)
  } catch {
    // Offline or not synced yet: the same sum from the rows on this device.
    if (deadline.value) readiness.value = c.readinessOf(deadline.value)
  }
}
onMounted(() => {
  void c.load().then(loadReadiness)
})
watch(id, loadReadiness)

watch(
  [deadline, subject],
  ([d, s]) => {
    if (d) openCompanionTab({ kind: 'deadline', id: d.id, title: d.title, to: `/app/d/${d.id}`, color: s?.color })
  },
  { immediate: true },
)

const upcoming = computed(() => deadline.value?.status === 'upcoming' && (!deadline.value.due_at || Date.parse(deadline.value.due_at) > Date.now()))

/** Second line of the header: what it counts for and where it happens. */
const facts = computed(() => {
  const d = deadline.value
  if (!d) return ''
  return [d.weight_pct ? `${d.weight_pct}% of the grade` : null, d.location].filter(Boolean).join(' · ')
})

/** Once it's behind the learner: what became of it. */
const outcome = computed(() => {
  const d = deadline.value
  if (!d || upcoming.value) return null
  // Beside what readiness said, the grade gets its own line under the header.
  if (d.grade != null) return d.readiness_said == null ? `Marked: ${d.grade}%` : null
  if (d.status === 'cancelled') return 'Cancelled'
  if (d.status === 'missed') return 'Missed'
  if (d.status === 'submitted' || d.status === 'done') return 'Handed in'
  return 'The date has passed'
})

const sources = computed(() =>
  [...(deadline.value?.sources ?? [])].sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at)),
)
function recordingSession(itemId: string | null) {
  const item = c.get('items', itemId)
  return item ? c.get('sessions', item.session_id) : null
}

function changeLine(change: Record<string, { from: unknown; to: unknown }> | null): string | null {
  if (!change?.due_at) return null
  const from = change.due_at.from ? dueLong({ due_at: String(change.due_at.from), all_day: false } as Deadline) : 'no date'
  return `Moved from ${from}`
}

const confirming = ref(false)
async function confirm(): Promise<void> {
  if (!deadline.value) return
  confirming.value = true
  try {
    await c.upsert<Deadline>('deadlines', { id: deadline.value.id, confirmed: true, tentative: false })
    toast.success({ title: `${deadline.value.title} confirmed`, body: 'It\'s on your calendar as a fact now.' })
  } finally {
    confirming.value = false
  }
}

const isExam = computed(() => ['midterm', 'final', 'exam'].includes(deadline.value?.kind ?? ''))

type Action = { label: string; to: string }

/**
 * The cobalt panel, worked out once so the template only draws it: which of
 * the four states (the header comment) this is, its lines, its one button
 * and the quiet secondary, if any.
 */
const panel = computed<{ title: string; lines: string[]; primary: Action; secondary: Action | null } | null>(() => {
  const d = deadline.value
  const r = readiness.value
  if (!d || !r) return null
  const { check, practice } = r.suggestion
  const practiceTo = `/app/practice?deadline=${d.id}`
  // No cards yet: the course is where its material, and so its cards, come from.
  const practise: Action = practice.cards
    ? { label: `Practise ${plural(practice.cards, 'card')} · ${minutesLabel(practice.minutes)}`, to: practiceTo }
    : { label: `Open ${subject.value?.title ?? 'the course'}`, to: subject.value ? `/app/courses/${subject.value.id}` : '/app' }
  const opens = r.topics
    .map((t) => t.checkable_at)
    .filter((at): at is string => Boolean(at))
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0]

  if (r.checked) {
    const words = readyWords(r.percent)
    const lines = [`Checked ${r.checked} of ${r.total} topics.`]
    const cal = r.calibration
    if (cal) lines.push(`You were sure of ${cal.sure} in ${cal.answered} answers, and right on ${cal.right} of those.`)
    const title = words[0]!.toUpperCase() + words.slice(1)
    if (check.topics) {
      return {
        title,
        lines,
        primary: { label: `Check ${plural(check.topics, 'topic')} · ${minutesLabel(check.minutes)}`, to: checkHref({ deadlineId: d.id }) },
        secondary: practice.cards ? { label: `or practise ${plural(practice.cards, 'card')}`, to: practiceTo } : null,
      }
    }
    if (opens) lines.push(`Your next check opens ${dayWord(opens)}.`)
    return { title, lines, primary: practise, secondary: null }
  }
  if (check.topics) {
    const studied = r.topics.filter((t) => t.last_studied_at).length
    return {
      title: 'Not checked yet',
      lines: [
        `You've studied ${studied} of its topics. A check shows what stuck: ${check.questions} questions, no notes, about ${minutesLabel(check.minutes)}.`,
      ],
      primary: { label: `Check ${plural(check.topics, 'topic')}`, to: checkHref({ deadlineId: d.id }) },
      secondary: null,
    }
  }
  if (r.topics.some((t) => t.last_studied_at)) {
    return {
      title: 'Not checked yet',
      lines: [
        `Your first check opens ${opens ? `${dayWord(opens)}, ` : ''}a few days after you studied. Until then, practise.`,
      ],
      primary: practise,
      secondary: null,
    }
  }
  // Nothing in scope yet: there is nothing to ask about, only where to add it.
  if (!r.total) {
    return {
      title: 'Not started',
      lines: ['Nothing is linked to it yet. Once the brief or the lecturer says what it covers, BiliMind can check you on it.'],
      primary: practise,
      secondary: null,
    }
  }
  return {
    title: 'Not started',
    lines: ['See what it needs before you start: 3 questions on what it covers. What you miss goes into your plan.'],
    primary: { label: 'See what it needs', to: checkHref({ purpose: 'prepare', deadlineId: d.id }) },
    secondary: null,
  }
})

type TopicRow = Readiness['topics'][number]

/** "Tuesday's check", "yesterday's check", "the check on Thu 22 Oct". */
function checkDay(iso: string | null): string {
  if (!iso) return 'a check'
  const day = dayWord(iso)
  return day.includes(' ') ? `the check on ${day}` : `${day}'s check`
}

/**
 * A topic's line under its title: where it stands in the checks, then the
 * practice. The practice is there on purpose: readiness only moves on a
 * check, and a learner who sees nothing move for days of work stops working
 *.
 */
function topicLine(t: TopicRow): string {
  let line = 'Not studied yet'
  if (t.state === 'checked') {
    line = `Checked · ${t.right} of ${t.checks} right${t.last_checked_at ? ` · ${untilLabel(t.last_checked_at)}` : ''}`
  } else if (t.state === 'missed') {
    line = `Missed in ${checkDay(t.last_checked_at)} · back in your plan`
  } else if (t.state === 'unchecked') {
    line = t.checkable_at && t.last_studied_at
      ? `Studied ${untilLabel(t.last_studied_at)} · check from ${relativeDay(dayKey(t.checkable_at))}`
      : 'Studied · ready to check'
  }
  return t.practiced > 0 ? `${line} · ${Math.round(t.practiced * 100)}% practised` : line
}

/* -- After the date: readiness against the grade ---------------------------- */

const verdict = computed(() => {
  const d = deadline.value
  if (!d || d.grade == null || d.readiness_said == null) return null
  const diff = d.grade - d.readiness_said
  const note = Math.abs(diff) <= 5
    ? 'Close.'
    : diff > 0
      ? 'You did better than your checks showed.'
      : `Your checks were kinder than the ${isExam.value ? 'exam' : 'mark'}.`
  return { line: `Readiness said ${d.readiness_said}%. You got ${d.grade}%.`, note }
})

const askGrade = computed(() => {
  const d = deadline.value
  return Boolean(d && !upcoming.value && d.grade == null && d.status !== 'cancelled')
})
const gradeDraft = ref<number | ''>('')
const gradeOk = computed(() => typeof gradeDraft.value === 'number' && gradeDraft.value >= 0 && gradeDraft.value <= 100)
const savingGrade = ref(false)

async function saveGrade(): Promise<void> {
  const d = deadline.value
  if (!d || !gradeOk.value || savingGrade.value) return
  savingGrade.value = true
  try {
    await c.upsert<Deadline>('deadlines', { id: d.id, grade: gradeDraft.value as number })
    // The server fills `readiness_said` as the grade lands; read the row back
    // so "Readiness said…" replaces the form rather than "Marked".
    await c.sync()
  } catch {
    // `upsert` has already said what went wrong, and put the row back.
  } finally {
    savingGrade.value = false
  }
}

const notFound = computed(() => c.status.ready && !deadline.value)
</script>

<template>
  <div class="mx-auto grid w-full max-w-[760px] content-start gap-10 px-4 pt-6 pb-20 min-[900px]:gap-12 min-[900px]:px-8 min-[900px]:pt-12">
    <div
      v-if="notFound"
      class="grid justify-items-center gap-3 py-20 text-center"
    >
      <h1 class="t-head text-[24px]">
        This deadline isn't here
      </h1>
      <p class="text-[15px] text-text-muted">
        It may have been cancelled and removed. Everything still due is on the calendar.
      </p>
      <UiBtn
        to="/app/calendar"
        variant="secondary"
      >
        Open the calendar
      </UiBtn>
    </div>

    <div
      v-else-if="!deadline"
      class="grid gap-10"
      aria-busy="true"
      aria-label="Loading the deadline"
    >
      <div class="grid gap-2">
        <div class="cp-skel h-5 w-48" />
        <div class="cp-skel h-10 w-64" />
        <div class="cp-skel h-5 w-56" />
      </div>
      <div class="cp-skel h-[200px] rounded-[24px]" />
    </div>

    <template v-else>
      <header class="grid gap-1.5">
        <NuxtLink
          :to="subject ? `/app/courses/${subject.id}?tab=deadlines` : '/app'"
          class="-ml-1 mb-1 inline-flex h-11 items-center gap-2 justify-self-start rounded-full pr-3 pl-1 text-[15px] font-medium text-text-muted transition-colors hover:bg-surface-mute hover:text-text min-[900px]:hidden"
        >
          <CompanionIcon
            name="chevron-left"
            :size="17"
          />
          <span
            class="size-2 shrink-0 rounded-full"
            :style="{ background: courseColor(subject?.color) }"
          />
          {{ subject?.title ?? 'Back' }}
        </NuxtLink>
        <p class="hidden min-w-0 items-center gap-2 text-[15px] text-text-muted min-[900px]:flex">
          <span
            class="size-2 shrink-0 rounded-full"
            :style="{ background: courseColor(subject?.color) }"
          />
          <span class="truncate">{{ subject?.title }} · {{ KIND_WORD[deadline.kind] }}</span>
        </p>
        <h1 class="t-head text-[30px] min-[900px]:text-[40px]">
          {{ deadline.title }}
        </h1>
        <p class="text-[17px] leading-snug font-medium text-text">
          {{ deadline.due_at ? `Due ${dueLong(deadline)}` : 'No date yet' }}<span
            v-if="deadline.due_at && upcoming"
            class="font-normal text-text-muted"
          > · {{ untilLabel(deadline.due_at) }}</span>
        </p>
        <p
          v-if="facts || outcome"
          class="text-[15px] text-text-muted"
        >
          {{ [outcome, facts].filter(Boolean).join(' · ') }}
        </p>
      </header>

      <!-- After the date: what readiness said, against what they got. -->
      <div
        v-if="verdict"
        class="grid gap-1"
      >
        <p class="text-[17px] leading-snug font-medium text-text">
          {{ verdict.line }}
        </p>
        <p class="text-[15px] text-text-muted">
          {{ verdict.note }}
        </p>
      </div>
      <form
        v-else-if="askGrade"
        class="grid gap-2 border-y border-border-rule py-4"
        @submit.prevent="saveGrade"
      >
        <label
          for="d-grade"
          class="text-[16px] font-medium text-text"
        >What did you get?</label>
        <div class="flex items-center gap-2">
          <input
            id="d-grade"
            v-model.number="gradeDraft"
            type="number"
            inputmode="decimal"
            min="0"
            max="100"
            step="any"
            class="h-11 w-24 rounded-full border border-border-field bg-surface px-4 text-[16px] outline-none focus:border-brand focus:ring-3 focus:ring-brand-line"
          >
          <span class="text-[16px] text-text-muted">%</span>
          <UiBtn
            type="submit"
            variant="secondary"
            :loading="savingGrade"
            :disabled="!gradeOk"
          >
            Save
          </UiBtn>
        </div>
        <p class="text-[13.5px] text-text-muted">
          So BiliMind can see how close its readiness was.
        </p>
      </form>

      <div
        v-if="deadline.tentative"
        class="flex flex-wrap items-center justify-between gap-3 border-y border-border-rule py-3"
      >
        <p class="min-w-0 flex-1 basis-[280px] text-[15px] text-text-body">
          <b class="font-semibold text-text">Not confirmed yet.</b>
          {{ deadline.confidence === 'heard' ? 'Heard in class' : 'From a shared message' }}; Moodle hasn't
          said it.
        </p>
        <UiBtn
          variant="secondary"
          :loading="confirming"
          @click="confirm"
        >
          I've checked, it's right
        </UiBtn>
      </div>

      <!-- The main thing: how ready, and the one button that changes it. -->
      <template v-if="upcoming">
        <section
          v-if="panel"
          class="cb-cobalt grid gap-5 rounded-[24px] p-5 min-[900px]:p-7"
          aria-labelledby="d-ready"
        >
          <div class="grid gap-2">
            <p
              id="d-ready"
              class="t-head text-[30px] text-white min-[900px]:text-[36px]"
            >
              {{ panel.title }}
            </p>
            <p
              v-for="line in panel.lines"
              :key="line"
              class="text-[15px] leading-relaxed text-white/80"
            >
              {{ line }}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <UiBtn
              :to="panel.primary.to"
              variant="accent"
              size="lg"
              trailing-icon="arrow-right"
            >
              {{ panel.primary.label }}
            </UiBtn>
            <NuxtLink
              v-if="panel.secondary"
              :to="panel.secondary.to"
              class="inline-flex h-11 items-center rounded-full px-2 text-[14px] text-white/80 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
            >
              {{ panel.secondary.label }}
            </NuxtLink>
          </div>
        </section>
        <div
          v-else
          class="cp-skel h-[200px] rounded-[24px]"
        />
      </template>

      <CompanionExamTools
        v-if="upcoming && isExam"
        :deadline="deadline"
      />

      <CompanionBox
        label="What it covers"
        :aside="deadline.scope_note ?? undefined"
      >
        <ul
          v-if="readiness?.topics.length"
          class="divide-y divide-border-rule border-y border-border-rule"
        >
          <li
            v-for="t in readiness.topics"
            :key="t.topic_id"
            class="flex items-center gap-4 py-3"
          >
            <span class="grid min-w-0 flex-1 gap-0.5">
              <span class="text-[16px] leading-snug font-medium text-text">{{ t.title }}</span>
              <span class="text-[13.5px] text-text-muted">{{ topicLine(t) }}</span>
            </span>
            <span
              class="shrink-0 text-[14px] font-medium"
              :class="t.state === 'missed' ? 'text-coral-text' : (t.percent ?? 0) >= 85 ? 'text-success-text' : 'text-text-soft'"
            >{{ readyWords(t.percent) }}</span>
          </li>
        </ul>
        <p
          v-else-if="readiness"
          class="text-[15px] text-text-muted"
        >
          Nothing linked yet. When the brief or the lecturer says what it covers, the topics show
          here, each with how ready you are.
        </p>
        <div
          v-else
          class="grid gap-2"
        >
          <div
            v-for="n in 3"
            :key="n"
            class="cp-skel h-12"
          />
        </div>
      </CompanionBox>

      <CompanionDeadlineClass
        v-if="upcoming"
        :deadline="deadline"
      />

      <CompanionBox
        v-if="sources.length"
        label="Where the date came from"
      >
        <ul class="divide-y divide-border-rule border-y border-border-rule">
          <li
            v-for="s in sources"
            :key="s.id"
            class="grid gap-1 py-3"
          >
            <p class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span class="text-[15px] font-medium text-text">
                {{ sourceLine(s, recordingSession(s.item_id)) }}<template v-if="s.at_seconds != null">, at {{ atLabel(s.at_seconds) }}</template>
              </span>
              <a
                v-if="s.url"
                :href="s.url"
                target="_blank"
                rel="noopener"
                class="text-[14px] font-semibold text-cobalt hover:underline"
              >Open</a>
            </p>
            <q class="text-[15px] leading-relaxed text-text-body italic">{{ s.evidence }}</q>
            <p class="text-[13.5px] text-text-muted">
              <CompanionConfidence :value="s.confidence" /><template v-if="changeLine(s.change)">
                · {{ changeLine(s.change) }}
              </template>
            </p>
          </li>
        </ul>
      </CompanionBox>
    </template>
  </div>
</template>

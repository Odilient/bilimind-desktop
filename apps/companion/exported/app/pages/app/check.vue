<script setup lang="ts">
/**
 * Check yourself: a few questions on topics studied a few days ago, answered
 * in your own words, with no notes and no assistant. Done means remembered: only a check like this moves
 * readiness.
 *
 * It is practice's sibling and looks like it: ✕ and "2 of 6" with a thin ink
 * bar at the top, one big card, the buttons low where the thumb is. What's
 * different is what isn't here. The assistant's dock, its button, ⌘J and the
 * screen's context all step aside on this route (the layout, `ai/Host` and
 * `ai/Toggle` ask `onCheckPage`), because "without help" has to be true for
 * the result to mean anything. Help comes at the end: "Ask about what I
 * missed".
 *
 * The questions are written by the server from the learner's own material
 * (`POST /checks`), which takes a few seconds, so the intro is drawn at once
 * from what this device knows (the due topics, `checks.ts`) while the
 * request runs behind it. Usually the questions are there by the time Start
 * is pressed; if not, Start waits with a spinner. A sitting left half done
 * comes back whole from the server and resumes at the first unanswered
 * question, skipping the intro.
 *
 * The page never waits for marking between questions: each answer is sent
 * and marked in the background and the next question is up at once, so it
 * keeps the rhythm of a test. The marked paper is shown when the last answer
 * is sent, and fills in as the marks arrive. Marks land in the store, so the
 * readiness line moves from what it was to what it is now.
 *
 * Query (built by `checkHref`): deadline, subject, topics, purpose (cold,
 * prepare, teach) and from (where Done goes).
 */
import type { Check, CheckConfidence, CheckPurpose, CheckSitting, Readiness, Topic } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { useAiContext } from '~/companion/ai/state'
import { newChatLink } from '~/companion/ai/routes'
import { dueTopics, nextCheckOpens, sittingSize } from '~/companion/checks'
import { opensAt as opensFor, scopeOf } from '~/companion/readiness'
import { readyWords } from '~/companion/words'
import { dayKey, dayLabel, daysBetween } from '~/companion/time'
import { dayWord, topicHref } from '~/companion/today-layout'
import { ApiError, useApi } from '~/composables/useApi'
import { outOfAi, toastOutOfAi } from '~/companion/usage'
// recording: a teach-back can be said out loud in the desktop app (ExplainAloud)
import { isDesktopApp } from '~/companion/platform'
import type { StepRow } from '~/components/companion/create/Building.vue'

definePageMeta({ layout: 'companion' })

const route = useRoute()
const c = useCompanion()
const { t, locale } = useI18n()

// No notes, no help: the assistant has nothing of this screen to read.
useAiContext(() => null)

const param = (key: string) => (route.query[key] ? String(route.query[key]) : null)
const purpose = computed<CheckPurpose>(() => {
  const p = param('purpose')
  return p === 'prepare' || p === 'teach' ? p : 'cold'
})
const deadlineId = computed(() => param('deadline'))
const subjectId = computed(() => param('subject'))
const topicIds = computed(() => (param('topics') ?? '').split(',').filter(Boolean))
const deadline = computed(() => c.get('deadlines', deadlineId.value))
const subject = computed(() => c.get('subjects', subjectId.value) ?? c.subjectOf(deadline.value))

const DAY = 86_400_000

/* -- The sitting ---------------------------------------------------------- */

type Phase = 'loading' | 'intro' | 'asking' | 'results' | 'empty'

const phase = ref<Phase>('loading')
const sitting = ref<CheckSitting | null>(null)
const startError = ref<string | null>(null)
/** The start failed because the AI is out: the line names the ways forward. */
const startLimited = ref(false)
/** Marking ran into the same, and the learner has been told this sitting. */
let markLimited = false
/** Start was pressed before the questions arrived. */
const waiting = ref(false)
const index = ref(0)
const answer = ref('')
const reply = ref('')
/** A teach-back between its explanation and the question back. */
const step = ref<'answer' | 'thinking' | 'reply'>('answer')
const thinkingFailed = ref(false)
/** What was sent for each question, shown at once and sent again by Try again. */
const sent = reactive<Record<string, { answer: string; confidence: CheckConfidence | null; follow_up_answer?: string }>>({})
const marking = reactive<Record<string, 'marking' | 'failed'>>({})
/** Readiness of the deadline the result line is about, from before this sitting's marks. */
const before = ref<Readiness | null>(null)
const opensAt = ref<string | null>(null)

/** The sitting's questions as the store holds them now: the marks land there. */
const checks = computed<Check[]>(() =>
  (sitting.value?.checks ?? []).map((k) => {
    const row = c.get('checks', k.id) ?? k
    const mine = sent[k.id]
    return row.result || !mine ? row : { ...row, answer: mine.answer, confidence: mine.confidence, follow_up_answer: mine.follow_up_answer ?? row.follow_up_answer }
  }),
)
const current = computed(() => checks.value[index.value] ?? null)
const total = computed(() => checks.value.length)

/** Answered and waiting for nothing more from the learner. */
function answered(k: Check): boolean {
  if (k.result) return true
  if (k.kind === 'explain') return Boolean(sent[k.id]?.follow_up_answer ?? k.follow_up_answer)
  return Boolean(sent[k.id]) || Boolean(k.answered_at)
}

/* -- What the device expects, for the intro --------------------------------- */

/** The topics the intro names: the server's once it has answered, the device's guess until then. */
const topics = computed<Topic[]>(() => {
  const ids = sitting.value?.checks.length
    ? [...new Set(sitting.value.checks.map((k) => k.topic_id).filter((id): id is string => !!id))]
    : topicIds.value.length
      ? topicIds.value
      : purpose.value === 'prepare'
        ? (deadline.value ? scopeOf(deadline.value, c.topics.value).map((t) => t.id) : [])
        : dueTopics(c, { deadlineId: deadlineId.value ?? undefined, subjectId: subjectId.value ?? undefined })
            .slice(0, 4)
            .map((d) => d.topic.id)
  return ids.map((id) => c.get('topics', id)).filter((t): t is Topic => !!t)
})

function names(list: string[]): string {
  return new Intl.ListFormat(intlTag(locale.value), { type: 'conjunction' }).format(list)
}

/** "studied 4 days ago", "studied 2 to 9 days ago". */
const studiedWords = computed(() => {
  const days = sitting.value?.checks.length
    ? sitting.value.checks.map((k) => k.studied_days_ago).filter((n): n is number => n !== null)
    : topics.value
        .map((t) => c.topicCheck(t.id)?.last_studied_at)
        .filter((at): at is string => !!at)
        .map((at) => Math.floor((Date.now() - Date.parse(at)) / DAY))
  if (!days.length) return null
  const [lo, hi] = [Math.min(...days), Math.max(...days)]
  if (lo === hi || hi <= 1) return lo === 0 ? t('check.page.studiedToday') : lo === 1 ? t('check.page.studiedYesterday') : t('check.page.studiedAgo', lo)
  return t('check.page.studiedRange', { lo, hi })
})

const size = computed(() => {
  const asked = sitting.value?.checks ?? []
  if (asked.length) {
    const minutes = asked.reduce((sum, k) => sum + (k.kind === 'explain' ? 4 : 1.5), 0)
    return { questions: asked.length, minutes: Math.ceil(minutes) }
  }
  return sittingSize(topics.value.length, purpose.value)
})

const teachTopic = computed(() => (purpose.value === 'teach' ? (topics.value[0] ?? null) : null))
/** A teach-back done before the topic is cold is practice, and says so once. */
const warm = computed(() => {
  if (!teachTopic.value) return false
  const asked = sitting.value?.checks[0]
  return asked ? !asked.cold : Boolean(c.topicCheck(teachTopic.value.id)?.checkable_at)
})

const heading = computed(() => {
  if (purpose.value === 'prepare') return deadline.value ? t('check.page.prepare', { name: deadlineName(deadline.value) }) : t('check.page.prepareFallback')
  if (purpose.value === 'teach') return teachTopic.value ? t('check.page.teach', { topic: teachTopic.value.title }) : t('check.page.teachFallback')
  return t('check.page.title')
})

/* -- Where the result line points ----------------------------------------- */

/** "Midterm" alone could be any course's; "Quiz 2" or "Lab 4 report" says itself. */
function deadlineName(d: { title: string; subject_id: string }): string {
  const s = c.get('subjects', d.subject_id)
  return s && /^(midterm|final( exam)?|exam|quiz|project|presentation)$/i.test(d.title) ? `${s.title} ${d.title.toLowerCase()}` : d.title
}

/** The deadline this sitting counts toward: the one asked for, or the nearest whose scope it touched. */
const resultDeadline = computed(() => {
  if (deadline.value) return deadline.value
  const asked = c.get('deadlines', sitting.value?.checks.find((k) => k.deadline_id)?.deadline_id)
  if (asked) return asked
  const ids = new Set(topics.value.map((t) => t.id))
  return (
    c.deadlines.value.find(
      (d) => d.status === 'upcoming' && d.due_at && Date.parse(d.due_at) > Date.now() && scopeOf(d, c.topics.value).some((t) => ids.has(t.id)),
    ) ?? null
  )
})
const after = computed(() => (resultDeadline.value ? c.readinessOf(resultDeadline.value) : null))
const said = (r: Readiness | null) => readyWords(r?.checked ? r.percent : null)

/* -- Arriving, starting, resuming ------------------------------------------ */

function body() {
  return {
    purpose: purpose.value,
    ...(topicIds.value.length ? { topic_ids: topicIds.value } : {}),
    ...(deadlineId.value ? { deadline_id: deadlineId.value } : {}),
    ...(subjectId.value ? { subject_id: subjectId.value } : {}),
  }
}

function failure(error: unknown): string {
  const limited = outOfAi(error)
  startLimited.value = limited !== null
  if (limited) return limited
  if (error instanceof ApiError && (error.isNetwork || error.status === 0)) {
    return t('check.page.needsConnection')
  }
  return t('check.page.couldntWrite')
}

let ticket = 0

async function arrive(): Promise<void> {
  const mine = ++ticket
  await c.load()
  if (mine !== ticket) return
  sitting.value = null
  startError.value = null
  markLimited = false
  waiting.value = false
  replanned = false
  index.value = 0
  step.value = 'answer'
  for (const key of Object.keys(sent)) delete sent[key]
  for (const key of Object.keys(marking)) delete marking[key]

  // Nothing due on this device: say so at once, and let the server disagree.
  if (purpose.value === 'cold' && !topics.value.length) {
    phase.value = 'empty'
    opensAt.value = nextCheckOpens(c, scopeIds())
  } else phase.value = 'intro'

  try {
    const got = await c.startCheck(body())
    if (mine !== ticket) return
    receive(got)
  } catch (error) {
    if (mine !== ticket) return
    startError.value = failure(error)
    if (phase.value === 'empty') phase.value = 'intro'
  }
}

/** The topics a cold check here could reach: the deadline's, the course's, or every course's. */
function scopeIds(): string[] {
  if (deadline.value) return scopeOf(deadline.value, c.topics.value).map((t) => t.id)
  return c.topics.value.filter((t) => !subjectId.value || t.subject_id === subjectId.value).map((t) => t.id)
}

function receive(got: CheckSitting): void {
  // The server staggers a batch's asked_at a second apart: that's the order to ask in.
  sitting.value = { ...got, checks: [...got.checks].sort((a, b) => Date.parse(a.asked_at) - Date.parse(b.asked_at)) }
  // Before any of this sitting's new marks: the line at the end says what they moved.
  before.value = resultDeadline.value ? c.readinessOf(resultDeadline.value) : null
  if (!got.checks.length) {
    phase.value = 'empty'
    opensAt.value = got.opens_at
    return
  }
  // Answered and unmarked: the marking failed (or never finished) last time.
  for (const k of got.checks) {
    if (k.answered_at && !k.result && !(k.kind === 'explain' && !k.follow_up_answer)) marking[k.id] = 'failed'
  }
  const resumed = got.checks.some((k) => k.answered_at)
  if (resumed || waiting.value) begin()
  else phase.value = 'intro'
}

/** To the first question still waiting for the learner, or the paper when none is. */
function begin(): void {
  waiting.value = false
  const next = checks.value.findIndex((k) => !answered(k))
  if (next < 0) {
    finish()
    return
  }
  index.value = next
  const k = checks.value[next]!
  step.value = k.kind === 'explain' && k.follow_up ? 'reply' : 'answer'
  phase.value = 'asking'
}

/* -- While the questions are written ------------------------------------------- */

/**
 * The sitting is one model call: most of it spent thinking, then the questions
 * all at once. So this counts them by topic and doesn't show them: a check tests
 * what's remembered, and the questions come one at a time for a reason.
 */
const writing = ref<{ topic: string; of: number; written: number }[]>([])
const writingClock = useStopwatch(waiting)
let writingPoll: ReturnType<typeof setTimeout> | undefined

async function pollWriting(): Promise<void> {
  try {
    const got = await useApi().get<{ topics: { title: string; of: number; written: number }[] } | null>('/companion/checks/writing')
    if (got?.topics) writing.value = got.topics.map((t) => ({ topic: t.title, of: t.of, written: t.written }))
  } catch {
    // Only the progress; the question itself is still on its way.
  }
  if (waiting.value) writingPoll = setTimeout(() => void pollWriting(), 1200)
}

watch(waiting, (on) => {
  clearTimeout(writingPoll)
  if (on) void pollWriting()
  else writing.value = []
})

onBeforeUnmount(() => clearTimeout(writingPoll))

const writingSteps = computed<StepRow[]>(() => {
  const started = writing.value.some((t) => t.written > 0)
  const seconds = clockLabel(writingClock.since(0) ?? 0)
  const firstOpen = writing.value.findIndex((t) => t.written < t.of)
  return [
    { key: 'read', label: t('check.page.reading'), state: writing.value.length ? 'done' : 'run' },
    { key: 'think', label: t('check.page.working'), state: started ? 'done' : writing.value.length ? 'run' : 'wait', note: started ? null : seconds },
    ...writing.value.map((w, i): StepRow => ({
      key: `topic-${i}`,
      label: w.topic,
      state: w.written >= w.of ? 'done' : started && i === firstOpen ? 'run' : 'wait',
      note: w.written ? t('check.page.of', { a: w.written, b: w.of }) : null,
    })),
  ]
})

function start(): void {
  if (sitting.value?.checks.length) {
    begin()
    return
  }
  waiting.value = true
  if (startError.value) {
    startError.value = null
    c.startCheck(body()).then(receive, (error) => {
      startError.value = failure(error)
      waiting.value = false
    })
  }
}

onMounted(arrive)
watch(() => route.fullPath, arrive)

/* -- Answering ---------------------------------------------------------------- */

function mark(id: string): void {
  const said = sent[id]
  if (!said) return
  marking[id] = 'marking'
  c.answerCheck(id, said).then(
    () => {
      delete marking[id]
    },
    (error) => {
      marking[id] = 'failed'
      // The answer is kept; marking it needs AI. Said once a sitting, not per question.
      const limited = outOfAi(error)
      if (limited && !markLimited) {
        markLimited = true
        toastOutOfAi(limited)
      }
    },
  )
}

function send(confidence: CheckConfidence | null): void {
  const k = current.value
  if (!k) return
  const text = confidence ? answer.value.trim() : ''
  sent[k.id] = { answer: text, confidence }
  answer.value = ''
  if (k.kind === 'explain' && text) {
    void askBack(k.id)
    return
  }
  mark(k.id)
  next()
}

/** A teach-back's first answer comes back with the listener's question, not a mark. */
async function askBack(id: string): Promise<void> {
  step.value = 'thinking'
  thinkingFailed.value = false
  try {
    const row = await c.answerCheck(id, sent[id]!)
    if (row.follow_up && !row.result) {
      step.value = 'reply'
      return
    }
    next()
  } catch {
    thinkingFailed.value = true
  }
}

function sendReply(): void {
  const k = current.value
  const mine = k ? sent[k.id] : undefined
  if (!k || !reply.value.trim()) return
  sent[k.id] = { answer: mine?.answer ?? k.answer ?? '', confidence: mine?.confidence ?? k.confidence, follow_up_answer: reply.value.trim() }
  reply.value = ''
  mark(k.id)
  next()
}

function next(): void {
  step.value = 'answer'
  const later = checks.value.findIndex((k, i) => i > index.value && !answered(k))
  if (later < 0) finish()
  else index.value = later
}

function finish(): void {
  index.value = total.value
  phase.value = 'results'
}

function retry(id: string): void {
  const k = checks.value.find((x) => x.id === id)
  if (!k) return
  sent[id] ??= { answer: k.answer ?? '', confidence: k.confidence, ...(k.follow_up_answer ? { follow_up_answer: k.follow_up_answer } : {}) }
  mark(id)
}

/* -- The paper ---------------------------------------------------------------- */

const paper = computed(() =>
  checks.value.map((check) => ({
    check,
    status: check.result ? ('marked' as const) : marking[check.id] === 'failed' ? ('failed' as const) : ('marking' as const),
  })),
)
const settled = computed(() => paper.value.every((r) => r.status !== 'marking'))
const marked = computed(() => checks.value.filter((k) => k.result))

/**
 * Once every mark is in, Today is read again. The server did the rest when
 * the last question was marked: a cold sitting ticked today's check task,
 * and the plan was rebuilt, so each miss is already a "Go back over…".
 */
async function replan(): Promise<void> {
  await c.sync()
  await c.loadToday()
}

let replanned = false
watch(settled, (now) => {
  if (!now || phase.value !== 'results' || replanned || !marked.value.length) return
  replanned = true
  void replan()
})

const headline = computed(() => {
  if (!settled.value) return t('check.page.marking')
  const n = (r: Check['result']) => marked.value.filter((k) => k.result === r).length
  const [right, partly, wrong] = [n('right'), n('partly'), n('wrong')]
  // One question (a teach-back) gets its verdict, not a count.
  if (marked.value.length === 1) return t(right ? 'check.paper.right' : partly ? 'check.page.partlyRight' : 'check.paper.wrong')
  if (!partly) return t('check.page.nOfRight', { n: right, total: marked.value.length })
  return [t('check.page.nRight', { n: right }), t('check.page.nPartly', { n: partly }), wrong ? t('check.page.nMissed', { n: wrong }) : ''].filter(Boolean).join(', ')
})

/** One line per topic: what the check says about it now. */
const topicLines = computed(() =>
  topics.value
    .map((tp) => {
      const rows = marked.value.filter((k) => k.topic_id === tp.id)
      if (!rows.length) return null
      if (!rows.some((k) => k.cold)) return { id: tp.id, title: tp.title, words: t('check.page.practiceLine'), tone: 'text-text-muted', mark: 'learning' as const }
      const tc = c.topicCheck(tp.id)
      if (tc?.state === 'checked') {
        // The ladder (a day, a week, a month): when this topic is asked again.
        const again = tc.next_check_at ? t('check.page.checkedNext', { day: dayLabel(dayKey(tc.next_check_at)) }) : t('check.page.checked')
        return { id: tp.id, title: tp.title, words: again, tone: 'text-leaf-ink', mark: 'checked' as const }
      }
      const fresh = rows.every((k) => k.studied_days_ago === null)
      return {
        id: tp.id,
        title: tp.title,
        words: fresh
          ? t('check.page.fresh')
          : t(rows.some((k) => k.result === 'wrong') ? 'check.page.missedBack' : 'check.page.partlyBack'),
        tone: 'text-rose-ink',
        mark: 'learning' as const,
      }
    })
    .filter((x) => x !== null),
)

/** "You were sure of 4, and right on 3 of those": what they believed beside what was so. */
const calibration = computed(() => {
  const rated = marked.value.filter((k) => k.confidence)
  if (rated.length < 3) return null
  const sure = rated.filter((k) => k.confidence === 'sure')
  const right = sure.filter((k) => k.result === 'right').length
  if (!sure.length) return t('check.page.noneSure', { n: rated.filter((k) => k.result === 'right').length })
  return t('check.page.sureOf', { sure: sure.length, right })
})

const missed = computed(() => marked.value.filter((k) => k.result !== 'right'))

/** Help is welcome now: the misses, with what they wrote, as a new chat's first message, sent. */
async function askAboutMisses(): Promise<void> {
  const lines = missed.value.map((k, i) => {
    const wrote = k.answer?.trim() ? t('check.page.iWrote', { answer: k.answer.trim() }) : t('check.page.iDidntKnow')
    return [`${i + 1}. ${k.prompt}`, wrote, k.revealed ? t('check.page.theAnswer', { answer: k.revealed }) : ''].filter(Boolean).join('\n')
  })
  const q = [t('check.page.askMisses', { topics: names(topics.value.map((x) => x.title)) }), ...lines].join('\n\n')
  await navigateTo(newChatLink({ q }))
}

/* -- Ways out --------------------------------------------------------------- */

const backTo = computed(() => {
  const from = param('from')
  // Only a place inside the app: `from` is part of a link anyone can make.
  if (from && /^\/app(\/|\?|$)/.test(from)) return from
  if (deadline.value) return `/app/d/${deadline.value.id}`
  if (purpose.value === 'teach' && teachTopic.value) return topicHref(teachTopic.value)
  if (subject.value) return `/app/courses/${subject.value.id}`
  return '/app'
})

/** The nothing-to-check line: which topic turns cold next, and when. */
const opensLine = computed(() => {
  if (!opensAt.value) return null
  const diff = daysBetween(dayKey(Date.now()), dayKey(opensAt.value))
  const at = diff <= 0 ? t('check.page.opensToday') : diff === 1 ? t('check.page.opensTomorrow') : t('check.page.opensOn', { day: dayWord(opensAt.value) })
  const next = scopeIds()
    .map((id) => {
      const row = c.topicCheck(id)
      return { id, at: row ? opensFor(row) : null }
    })
    .filter((x): x is { id: string; at: string } => !!x.at && Date.parse(x.at) > Date.now())
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0]
  const title = next ? c.get('topics', next.id)?.title : null
  return title ? t('check.page.topicOpens', { title, when: at }) : t('check.page.nextOpens', { when: at })
})

const progress = computed(() =>
  phase.value === 'results' ? 100 : phase.value === 'asking' && total.value ? (index.value / total.value) * 100 : 0,
)
</script>

<template>
  <div class="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-4 pt-4 pb-6 min-[900px]:px-8 min-[900px]:pt-10 min-[900px]:pb-12">
    <header class="mb-6 flex items-center gap-2">
      <NuxtLink
        :to="backTo"
        class="-ml-2 grid size-11 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:bg-surface-mute hover:text-text"
        :aria-label="t('check.page.leaveAria')"
        :title="t('check.page.stop')"
      >
        <CompanionIcon
          name="x"
          :size="20"
        />
      </NuxtLink>
      <div class="grid min-w-0 flex-1 gap-2">
        <p class="flex items-baseline justify-between gap-3">
          <span class="truncate text-[15px] font-semibold text-text">{{ heading }}</span>
          <span
            v-if="phase === 'asking' && total"
            class="shrink-0 text-[14px] text-text-muted"
          >{{ t('check.page.of', { a: Math.min(index + 1, total), b: total }) }}</span>
        </p>
        <span
          class="h-1.5 overflow-hidden rounded-full bg-surface-track"
          aria-hidden="true"
        >
          <span
            class="block h-full rounded-full bg-inverse transition-[width] duration-300"
            :style="{ width: `${progress}%` }"
          />
        </span>
      </div>
    </header>

    <div
      v-if="phase === 'loading'"
      class="cp-skel h-[360px] rounded-[24px]"
      aria-busy="true"
    />

    <!-- Nothing cold enough yet. -->
    <section
      v-else-if="phase === 'empty'"
      class="grid justify-items-center gap-3 py-16 text-center"
    >
      <h1 class="t-head text-[30px]">
        {{ t('check.page.emptyTitle') }}
      </h1>
      <p
        v-if="opensLine"
        class="max-w-[460px] text-[16px] leading-relaxed text-text-muted"
      >
        {{ t('check.page.emptyCold', { opens: opensLine }) }}
      </p>
      <p
        v-else
        class="max-w-[460px] text-[16px] leading-relaxed text-text-muted"
      >
        {{ t('check.page.emptyHint') }}
      </p>
      <UiBtn
        :to="backTo"
        variant="secondary"
        size="lg"
        class="mt-2"
      >
        {{ t('common.back') }}
      </UiBtn>
    </section>

    <!-- What this is, drawn at once while the questions are written. -->
    <section
      v-else-if="phase === 'intro'"
      class="grid justify-items-center gap-3 py-12 text-center min-[900px]:py-16"
    >
      <h1 class="t-head text-[30px] leading-tight min-[900px]:text-[36px]">
        {{ heading }}
      </h1>
      <template v-if="purpose === 'cold'">
        <p
          v-if="topics.length"
          class="max-w-[520px] text-[18px] font-medium text-text"
        >
          {{ names(topics.map((t) => t.title)) }}{{ studiedWords ? `, ${studiedWords}` : '' }}.
        </p>
        <p
          v-if="size.questions"
          class="text-[16px] text-text-muted"
        >
          {{ t('check.page.questionsAbout', { min: size.minutes }, size.questions) }}
        </p>
        <p class="max-w-[460px] text-[16px] leading-relaxed text-text-muted">
          {{ t('check.page.rules') }}
        </p>
      </template>
      <template v-else-if="purpose === 'prepare'">
        <p class="max-w-[460px] text-[16px] leading-relaxed text-text-muted">
          {{ t('check.page.prepareIntro', { n: size.questions }) }}
        </p>
      </template>
      <template v-else>
        <p class="max-w-[460px] text-[16px] leading-relaxed text-text-muted">
          {{ t('check.page.teachIntro', { how: t(isDesktopApp() ? 'check.page.howTypedOrSaid' : 'check.page.howTyped') }) }}
        </p>
        <p
          v-if="warm"
          class="max-w-[460px] text-[15px] leading-relaxed text-text-muted"
        >
          {{ t('check.page.warm') }}
        </p>
      </template>

      <CompanionOutOfAi
        v-if="startError && startLimited && !waiting"
        :reason="startError"
        class="max-w-[440px] !text-[15px] text-danger-text"
      />
      <p
        v-else-if="startError && !waiting"
        class="max-w-[440px] text-[15px] text-danger-text"
        aria-live="polite"
      >
        {{ startError }}
      </p>
      <div class="mt-3 grid w-full max-w-[320px] justify-items-center gap-2">
        <UiBtn
          variant="primary"
          size="lg"
          block
          :disabled="waiting"
          @click="start"
        >
          {{ startError ? t('common.retry') : t('check.page.start') }}
        </UiBtn>
      </div>
      <CompanionCreateBuilding
        v-if="waiting"
        class="mt-3 w-full max-w-[440px] text-left"
        compact
        flat
        :title="t('check.page.writing')"
        :lead="t('check.page.fromMaterial')"
        :steps="writingSteps"
        @cancel="waiting = false"
      />
    </section>

    <!-- One question. -->
    <template v-else-if="phase === 'asking' && current">
      <CompanionCheckQuestion
        :key="current.id"
        v-model:answer="answer"
        v-model:reply="reply"
        :check="current"
        :topic="c.get('topics', current.topic_id)?.title ?? c.get('subjects', current.subject_id)?.title ?? null"
        :color="c.get('subjects', current.subject_id)?.color"
        :step="step"
        :failed="thinkingFailed"
        @send="send"
        @skip="send(null)"
        @reply="sendReply"
        @retry="askBack(current.id)"
      />
    </template>

    <!-- The marked paper. -->
    <section
      v-else-if="phase === 'results'"
      class="grid gap-8"
    >
      <div class="grid gap-3">
        <h1
          class="font-display text-[30px] leading-[1.05] font-semibold tracking-[-0.035em] min-[900px]:text-[36px]"
          aria-live="polite"
        >
          {{ headline }}
        </h1>
        <!-- Each topic as its node on the path (06-checks .ck-path): a pass ticks it leaf-green. -->
        <ul
          v-if="settled && topicLines.length"
          class="grid gap-1.5"
        >
          <li
            v-for="line in topicLines"
            :key="line.id"
            :class="[
              'cp-tick flex min-h-[38px] items-center gap-2.5 rounded-[10px] px-3 py-1.5 text-[14px] font-semibold text-text shadow-[0_0_0_1px_var(--border-strong)]',
              line.mark === 'checked' ? 'bg-[color-mix(in_oklab,var(--leaf-soft)_55%,var(--surface))]' : 'bg-surface',
            ]"
          >
            <CompanionCourseMark
              :state="line.mark"
              class="cp-tick-mark"
            />
            <span class="min-w-0 flex-1">{{ line.title }}</span>
            <span :class="['text-[13px] font-medium', line.tone]">{{ line.words }}</span>
          </li>
        </ul>
        <p
          v-if="settled && resultDeadline && after && marked.some((k) => k.cold)"
          class="text-[16px] font-medium text-text"
        >
          {{ deadlineName(resultDeadline) }}: {{ said(before) }} → {{ said(after) }}
        </p>
        <p
          v-if="settled && calibration"
          class="text-[15px] text-text-muted"
        >
          {{ calibration }}
        </p>
      </div>

      <CompanionCheckPaper
        :rows="paper"
        @retry="retry"
      />

      <div class="flex flex-wrap gap-2">
        <UiBtn
          :to="backTo"
          variant="primary"
          size="lg"
        >
          {{ t('common.done') }}
        </UiBtn>
        <UiBtn
          v-if="missed.length"
          variant="secondary"
          size="lg"
          @click="askAboutMisses"
        >
          {{ t('check.page.askMissed') }}
        </UiBtn>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* The mark lands with a small spring, as a node ticks on the path. */
@media (prefers-reduced-motion: no-preference) {
  .cp-tick-mark {
    animation: cp-pop 0.45s var(--spring) both;
  }

  .cp-tick:nth-child(2) .cp-tick-mark {
    animation-delay: 0.12s;
  }

  .cp-tick:nth-child(3) .cp-tick-mark {
    animation-delay: 0.24s;
  }
}

@keyframes cp-pop {
  from {
    opacity: 0;
    transform: scale(0.4);
  }
}
</style>

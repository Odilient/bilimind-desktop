<script setup lang="ts">
import type { Deadline, Session, Subject } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { useCapture } from '~/companion/capture'
import { dayKey, shortDate, untilLabel } from '~/companion/time'
import { deadlineMeta, readyWords, sessionLine, sessionWhen } from '~/companion/words'
import { checkHref } from '~/companion/checks'

/**
 * The one next thing in a school course, in cobalt with a lime button: the
 * same panel as Today's "Up next", at the head of the course's Weeks tab.
 * A class on now beats everything (record it, or take notes); then the
 * assessment close enough to prepare for; then the next class. Notes taken
 * here are already filed under the class (and, inside the course, open as a
 * tab beside the weeks).
 *
 * The assessment says how ready in the checks' words ("not checked yet",
 * "58% ready"), and its button follows the deadline page: a check when
 * topics in its scope have gone cold, since that is what moves the number;
 * "See what it needs" when nothing in it has been studied; otherwise
 * practice.
 */
const props = defineProps<{ subject: Subject }>()
const c = useCompanion()
const capture = useCapture()

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 60_000)
})
onBeforeUnmount(() => clearInterval(timer))

const canRecord = computed(() => false)

const ownSessions = computed(() => c.sessions.value.filter((s) => s.subject_id === props.subject.id && !s.cancelled))
const liveSession = computed(
  () => ownSessions.value.find((s) => Date.parse(s.starts_at) <= now.value && Date.parse(s.ends_at) > now.value) ?? null,
)
const nextSession = computed(() => ownSessions.value.find((s) => Date.parse(s.starts_at) > now.value) ?? null)

/** The nearest assessment with a scope, if it is close enough to prepare for. */
const prepFor = computed(() =>
  c.deadlines.value.find(
    (d) =>
      d.subject_id === props.subject.id &&
      d.status === 'upcoming' &&
      d.due_at &&
      Date.parse(d.due_at) > now.value &&
      Date.parse(d.due_at) - now.value < 21 * 86_400_000 &&
      c.readinessOf(d).total > 0,
  ),
)

type Next = { kind: 'class'; session: Session; live: boolean } | { kind: 'due'; deadline: Deadline }
const next = computed<Next | null>(() => {
  if (liveSession.value) return { kind: 'class', session: liveSession.value, live: true }
  if (prepFor.value) return { kind: 'due', deadline: prepFor.value }
  if (nextSession.value) return { kind: 'class', session: nextSession.value, live: false }
  return null
})
const readiness = computed(() => (next.value?.kind === 'due' ? c.readinessOf(next.value.deadline) : null))
const nextTopic = computed(() => (next.value?.kind === 'class' ? c.get('topics', next.value.session.topic_id) : null))

function classWhen(s: Session, live: boolean): string {
  if (live) return 'Happening now'
  const ms = Date.parse(s.starts_at) - now.value
  return ms < 6 * 3_600_000 ? untilLabel(s.starts_at, now.value).replace(/^in /, 'In ') : sessionWhen(s)
}

function dueWhen(d: Deadline): string {
  if (!d.due_at) return 'No date yet'
  const day = untilLabel(d.due_at, now.value)
  return `Due ${day.startsWith('in ') || day === 'tomorrow' ? day : shortDate(dayKey(d.due_at))}`
}

function notesHref(sessionId: string): string {
  const q = new URLSearchParams({ subject_id: props.subject.id, session_id: sessionId, template: 'lecture' })
  return `/app/p/new?${q}`
}

const ghost =
  'inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14.5px] font-semibold text-white ring-1 ring-white/35 transition-colors hover:bg-white/10'
</script>

<template>
  <section
    v-if="next"
    class="cb-cobalt grid gap-5 rounded-[24px] p-5 min-[900px]:p-7"
    aria-label="Next"
  >
    <template v-if="next.kind === 'due'">
      <div class="grid gap-2">
        <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-white/80">
          <span class="font-semibold text-white">{{ dueWhen(next.deadline) }}</span>
          <span aria-hidden="true">·</span>
          <span>{{ readyWords(readiness?.checked ? readiness.percent : null) }}</span>
        </p>
        <p class="t-head text-[26px] text-white min-[900px]:text-[32px]">
          {{ next.deadline.title }}
        </p>
        <p
          v-if="deadlineMeta(next.deadline, subject, false)"
          class="text-[14px] text-white/75"
        >
          {{ deadlineMeta(next.deadline, subject, false) }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2.5">
        <UiBtn
          v-if="readiness?.suggestion.check.topics"
          :to="checkHref({ deadlineId: next.deadline.id })"
          variant="accent"
          size="lg"
          trailing-icon="arrow-right"
        >
          Check {{ plural(readiness.suggestion.check.topics, 'topic') }}
        </UiBtn>
        <UiBtn
          v-else-if="!readiness?.topics.some((t) => t.last_studied_at)"
          :to="checkHref({ purpose: 'prepare', deadlineId: next.deadline.id })"
          variant="accent"
          size="lg"
          trailing-icon="arrow-right"
        >
          See what it needs
        </UiBtn>
        <UiBtn
          v-else
          :to="`/app/practice?deadline=${next.deadline.id}`"
          variant="accent"
          size="lg"
          trailing-icon="arrow-right"
        >
          Start preparing
        </UiBtn>
        <NuxtLink
          :to="`/app/d/${next.deadline.id}`"
          :class="ghost"
        >
          What it covers
        </NuxtLink>
      </div>
    </template>
    <template v-else>
      <div class="grid gap-2">
        <p class="text-[14px] font-semibold text-white">
          {{ classWhen(next.session, next.live) }}
        </p>
        <p class="t-head text-[26px] text-white min-[900px]:text-[32px]">
          {{ next.session.title }}<template v-if="nextTopic">
            · {{ nextTopic.title }}
          </template>
        </p>
        <p class="text-[14px] text-white/75">
          {{ sessionLine(next.session) }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2.5">
        <UiBtn
          v-if="canRecord"
          variant="accent"
          size="lg"
          icon="mic"
          @click="capture.show('record', subject.id, next.session.id)"
        >
          Record the class
        </UiBtn>
        <UiBtn
          v-if="!canRecord"
          :to="notesHref(next.session.id)"
          variant="accent"
          size="lg"
          icon="pencil"
        >
          Take notes
        </UiBtn>
        <NuxtLink
          v-else
          :to="notesHref(next.session.id)"
          :class="ghost"
        >
          <CompanionIcon
            name="pencil"
            :size="16"
          />
          Take notes
        </NuxtLink>
      </div>
    </template>
  </section>
</template>

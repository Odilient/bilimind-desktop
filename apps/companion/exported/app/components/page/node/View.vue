<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import type { Deadline, Session, Topic } from '~/companion/types'
import { usePageEnv } from '~/companion/doc/editor/env'
import { courseColor } from '~/companion/colors'
import { clock, dayKey, dayLabel, relativeDay } from '~/companion/time'
import { readyWords } from '~/companion/words'

/**
 * "Coming up" in a page: the app's own block, filled in by the app and not
 * edited by hand. It stores only which rows it is about (a course's
 * deadlines, its classes or its topics) and draws them from the companion
 * store every time, so a deadline that moves in Moodle moves here too.
 *
 * Deadlines, the one made by the lecture template, are the rows Today and a
 * course's Deadlines view draw (`CompanionDeadlineRow`): the day, what it is,
 * how ready you are in words. Under them, the one thing to do next: the
 * nearest assessed one you aren't ready for yet, with Start preparing. A
 * page gets a short list (the next five) and a way to all of them.
 *
 * It used to be a Notion-style view with a table/list switch and a source
 * picker. Nobody could tell what to do with it, so it has no settings now:
 * it is a block like a callout, moved or deleted as one, and that is all.
 * Views made back then still say which rows they show, and the classes and
 * topics ones draw as plain lists in the same box.
 */
const props = defineProps(nodeViewProps)
const env = usePageEnv()
const store = env.store

type Source = 'deadlines' | 'sessions' | 'topics'

const SHOWN = 5

const source = computed<Source>(() =>
  props.node.attrs.source === 'sessions' || props.node.attrs.source === 'topics' ? props.node.attrs.source : 'deadlines',
)
const subjectId = computed<string | null>(() =>
  props.node.attrs.scope === 'all' ? null : (props.node.attrs.subject_id ?? env.page.value.subject_id ?? null),
)
const subject = computed(() => store.get('subjects', subjectId.value))
const loading = computed(() => !store.status.ready)
const inScope = (row: { subject_id: string | null }) => !subjectId.value || row.subject_id === subjectId.value

const title = computed(() =>
  source.value === 'sessions' ? 'Next classes' : source.value === 'topics' ? 'What the course covers' : 'Coming up',
)

/* -- Deadlines --------------------------------------------------------------- */

const now = Date.now()

const upcoming = computed<Deadline[]>(() =>
  store.deadlines.value.filter(
    (d) => inScope(d) && d.status === 'upcoming' && (!d.due_at || Date.parse(d.due_at) > now),
  ),
)
const shownDeadlines = computed(() => upcoming.value.slice(0, SHOWN))

/** The nearest one with a scope that you aren't ready for: what to work on. */
const prepare = computed(() => {
  for (const d of upcoming.value) {
    const r = store.readinessOf(d)
    if (r.total && r.percent < 85) return { deadline: d, ready: readyWords(r.checked ? r.percent : null) }
  }
  return null
})

const allLink = computed(() =>
  subjectId.value ? `/app/courses/${subjectId.value}?tab=deadlines` : '/app/calendar',
)

/* -- Classes and topics (views made before) ---------------------------------- */

const sessions = computed<Session[]>(() =>
  store.sessions.value
    .filter((s) => inScope(s) && !s.cancelled && Date.parse(s.ends_at) > now)
    .slice(0, SHOWN),
)

function sessionDay(s: Session): string {
  const key = dayKey(s.starts_at)
  const rel = relativeDay(key)
  return rel === 'today' ? 'Today' : rel === 'tomorrow' ? 'Tomorrow' : dayLabel(key)
}

const topicTitle = (id: string | null) => (id ? store.get('topics', id)?.title : undefined)

const topics = computed(() => {
  const all = store.topics.value.filter((t: Topic) => inScope(t))
  return all
    .filter((t) => !all.some((x) => x.parent_id === t.id))
    .map((t) => ({
      topic: t,
      assessed: store.deadlines.value
        .filter((d) => d.topic_ids?.includes(t.id) && d.status === 'upcoming')
        .map((d) => d.title)
        .join(', '),
    }))
})

const empty = computed(() =>
  source.value === 'deadlines'
    ? !shownDeadlines.value.length
    : source.value === 'sessions'
      ? !sessions.value.length
      : !topics.value.length,
)

const emptyWords = computed(() =>
  source.value === 'deadlines'
    ? 'Nothing due. A deadline shows here as soon as one arrives, from Moodle, your email or class.'
    : source.value === 'sessions'
      ? 'No classes coming up.'
      : 'No topics yet.',
)

const row =
  'group -mx-2 flex items-center gap-4 rounded-[12px] px-2 py-2.5 no-underline transition-colors hover:bg-surface-mute'
</script>

<template>
  <NodeViewWrapper
    class="pg-view"
    contenteditable="false"
  >
    <div
      class="flex items-center gap-2 border-b border-border-rule pb-2"
      data-drag-handle
    >
      <CompanionIcon
        :name="source === 'sessions' ? 'calendar' : source === 'topics' ? 'list' : 'flag'"
        :size="15"
        class="shrink-0 text-text-faint"
      />
      <span class="min-w-0 truncate font-display text-[15px] font-semibold tracking-[-0.01em] text-text">
        {{ title }}<span
          v-if="subject"
          class="font-medium text-text-muted"
        > · {{ subject.title }}</span><span
          v-else-if="!subjectId"
          class="font-medium text-text-muted"
        > · all courses</span>
      </span>
      <NuxtLink
        v-if="source === 'deadlines' && upcoming.length > shownDeadlines.length"
        :to="allLink"
        class="ml-auto shrink-0 rounded-[6px] text-[13px] font-medium text-text-muted no-underline hover:text-text"
      >
        All {{ upcoming.length }}
      </NuxtLink>
    </div>

    <p
      v-if="loading"
      class="m-0 py-3 text-[14px] text-text-faint"
    >
      Reading your {{ source === 'sessions' ? 'classes' : source }}…
    </p>
    <p
      v-else-if="empty"
      class="m-0 py-3 text-[14px] text-text-muted"
    >
      {{ emptyWords }}
    </p>

    <!-- Deadlines: the rows Today draws, then the one thing to do. -->
    <template v-else-if="source === 'deadlines'">
      <ul class="m-0 list-none divide-y divide-border-rule p-0">
        <li
          v-for="d in shownDeadlines"
          :key="d.id"
          class="m-0 p-0"
        >
          <CompanionDeadlineRow
            :deadline="d"
            :with-course="!subjectId"
          />
        </li>
      </ul>
      <div
        v-if="prepare"
        class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] bg-surface-sunken px-3.5 py-3"
      >
        <span class="min-w-0 flex-1 text-[14px] text-text-body">
          Next: <span class="font-semibold text-text">{{ prepare.deadline.title }}</span>, {{ prepare.ready }}.
        </span>
        <UiBtn
          :to="`/app/practice?deadline=${prepare.deadline.id}`"
          variant="primary"
          size="sm"
          trailing-icon="arrow-right"
        >
          Start preparing
        </UiBtn>
      </div>
    </template>

    <!-- Classes -->
    <ul
      v-else-if="source === 'sessions'"
      class="m-0 list-none divide-y divide-border-rule p-0"
    >
      <li
        v-for="s in sessions"
        :key="s.id"
        class="m-0 p-0"
      >
        <NuxtLink
          :to="`/app/calendar?date=${dayKey(s.starts_at)}`"
          :class="row"
        >
          <span class="grid w-[64px] shrink-0 leading-tight">
            <span class="text-[15px] font-semibold text-text">{{ sessionDay(s) }}</span>
            <span class="text-[13px] text-text-muted">{{ clock(s.starts_at) }}</span>
          </span>
          <span class="grid min-w-0 flex-1 gap-0.5">
            <span class="truncate text-[16px] leading-snug font-medium text-text">
              {{ [s.title, topicTitle(s.topic_id)].filter(Boolean).join(' · ') }}
            </span>
            <span
              v-if="s.location || !subjectId"
              class="flex min-w-0 items-center gap-1.5 text-[13.5px] text-text-muted"
            >
              <span
                v-if="!subjectId"
                class="size-2 shrink-0 rounded-full"
                :style="{ background: courseColor(store.get('subjects', s.subject_id)?.color) }"
              />
              <span class="truncate">{{ s.location }}</span>
            </span>
          </span>
          <CompanionIcon
            name="chevron-right"
            :size="18"
            class="shrink-0 text-text-faint transition-colors group-hover:text-text-soft"
          />
        </NuxtLink>
      </li>
    </ul>

    <!-- Topics -->
    <ul
      v-else
      class="m-0 list-none divide-y divide-border-rule p-0"
    >
      <li
        v-for="t in topics"
        :key="t.topic.id"
        class="m-0 flex items-baseline gap-3 py-2.5"
      >
        <span class="min-w-0 flex-1 truncate text-[15px] font-medium text-text">{{ t.topic.title }}</span>
        <span class="shrink-0 text-[13.5px] text-text-muted">{{ t.assessed || 'not assessed yet' }}</span>
      </li>
    </ul>
  </NodeViewWrapper>
</template>

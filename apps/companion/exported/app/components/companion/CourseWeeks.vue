<script setup lang="ts">
/**
 * A school course by week, as on Moodle, laid out like the rest
 * of the companion: one section per week, in order, each a heading row that
 * folds. Folded, a week is one line that still says what is in it ("3 classes
 * · 5 files · Lab 4 report"); open, it is one hairline list of what happens
 * in it, in order: a class is a row with the day on the left, its name, the
 * lesson on its topic and the things filed under it (slides from Moodle
 * beside your notes, boards, recordings and photos) as links; a deadline is
 * the shared deadline row, which opens it.
 *
 * This week opens unfolded, with the `current` slot (the course page puts the
 * "Next" card there) right above it, and the view opens scrolled to them; the
 * weeks before and after are folded lines, a click away. Starting a page or a
 * board for a class, or recording it, sits behind the class's "…" menu: the
 * same three buttons on every class read as clutter when they sat on the row.
 * The editors open already filed under the class (`/app/p/new?…&session_id=…`),
 * so nothing starts empty or lost.
 *
 * A week gone by says, on its folded line, how its lecture's topic did in
 * the checks: "checked" in green, "missed" in coral, nothing before there
 * is a check. It used to give a readiness figure built from pages made and
 * cards rated; that measured the work, not what stuck.
 *
 * `openTopic`, when given (the course workspace), makes each class's topic a
 * link that opens its lesson beside the weeks.
 */
import type { Deadline, Item, Session, Subject, Topic, TopicCheckState } from '~/companion/types'
import type { MenuAction } from '~/components/ui/Menu.vue'
import { useCompanion } from '~/companion/store'
import { useCapture } from '~/companion/capture'
import { clock, dayKey, relativeDay, shortDate, weekdayShort } from '~/companion/time'
import { sessionLine } from '~/companion/words'

const props = defineProps<{
  subject: Subject
  openTopic?: (topic: Topic) => void
}>()
const c = useCompanion()
const capture = useCapture()
const router = useRouter()

const now = Date.now()
const current = computed(() => c.currentWeek.value ?? 1)

const sessions = computed(() => c.sessions.value.filter((s) => s.subject_id === props.subject.id))
const items = computed(() => c.items.value.filter((i) => i.subject_id === props.subject.id))
const deadlines = computed(() => c.deadlines.value.filter((d) => d.subject_id === props.subject.id && d.due_at))

type Entry = { kind: 'class'; at: number; session: Session } | { kind: 'due'; at: number; deadline: Deadline }

interface Week {
  n: number
  entries: Entry[]
  sessions: Session[]
  deadlines: Deadline[]
  topic: string | null
  check: TopicCheckState | null
  files: number
}

const weeks = computed<Week[]>(() => {
  const out = new Map<number, Week>()
  const ensure = (n: number) => {
    if (!out.has(n)) out.set(n, { n, entries: [], sessions: [], deadlines: [], topic: null, check: null, files: 0 })
    return out.get(n)!
  }
  for (const s of sessions.value) {
    const n = s.week ?? c.weekOf(s.starts_at)
    if (n) ensure(n).sessions.push(s)
  }
  for (const d of deadlines.value) {
    const n = c.weekOf(d.due_at!)
    if (n) ensure(n).deadlines.push(d)
  }
  for (const w of out.values()) {
    const lecture = w.sessions.find((s) => s.title.startsWith('Lecture') || s.title.startsWith('Seminar')) ?? w.sessions[0]
    const topic = c.get('topics', lecture?.topic_id)
    if (topic) {
      w.topic = topic.title
      w.check = w.n < current.value ? (c.topicCheck(topic.id)?.state ?? null) : null
    }
    const ids = new Set(w.sessions.map((s) => s.id))
    w.files = items.value.filter((i) => i.session_id && ids.has(i.session_id)).length
    // One list per week, in the order things happen: a lab due on Thursday
    // sits between Wednesday's tutorial and Friday's lecture.
    w.entries = [
      ...w.sessions.map((s): Entry => ({ kind: 'class', at: Date.parse(s.starts_at), session: s })),
      ...w.deadlines.map((d): Entry => ({ kind: 'due', at: Date.parse(d.due_at!), deadline: d })),
    ].sort((a, b) => a.at - b.at)
  }
  return [...out.values()].sort((a, b) => a.n - b.n)
})

/** A term whose current week has nothing in it still shows the slot, first. */
const hasCurrent = computed(() => weeks.value.some((w) => w.n === current.value))

/* -- Folding: this week open, the rest folded until clicked ---------------- */

const toggled = ref(new Set<number>())

function isOpen(w: Week): boolean {
  const byDefault = w.n === current.value
  return toggled.value.has(w.n) ? !byDefault : byDefault
}

function toggle(w: Week): void {
  const next = new Set(toggled.value)
  if (next.has(w.n)) next.delete(w.n)
  else next.add(w.n)
  toggled.value = next
}

/** A folded week in one line: "3 classes · 5 files · Lab 4 report". */
function summary(w: Week): string {
  const held = w.sessions.filter((s) => !s.cancelled).length
  const parts = [
    held ? (held === 1 ? '1 class' : `${held} classes`) : '',
    w.files ? (w.files === 1 ? '1 file' : `${w.files} files`) : '',
    ...w.deadlines.map((d) => d.title),
  ].filter(Boolean)
  return parts.join(' · ') || (w.n > 14 ? 'Exam weeks' : 'Nothing scheduled')
}

/** The extras filed to the course but to no class: a past paper, a syllabus. */
const loose = computed(() => items.value.filter((i) => !i.session_id))

function itemsOf(session: Session): { item: Item; count?: number }[] {
  const list = items.value.filter((i) => i.session_id === session.id)
  const order: Item['kind'][] = ['recording', 'page', 'board', 'photo', 'file', 'link']
  const photos = list.filter((i) => i.kind === 'photo')
  const out: { item: Item; count?: number }[] = []
  for (const kind of order) {
    if (kind === 'photo') {
      if (photos.length) out.push({ item: photos[0]!, count: photos.length })
      continue
    }
    for (const i of list.filter((x) => x.kind === kind)) out.push({ item: i })
  }
  return out
}

function isLive(s: Session): boolean {
  return Date.parse(s.starts_at) <= now && Date.parse(s.ends_at) > now
}

function isAhead(s: Session): boolean {
  return Date.parse(s.starts_at) > now
}

/** The left column: the day, then the time for a class still to come or the date for one held. */
function dayParts(s: Session): [string, string] {
  const key = dayKey(s.starts_at)
  const day = relativeDay(key) === 'today' ? 'Today' : weekdayShort(key)
  return [day, isAhead(s) || isLive(s) ? clock(s.starts_at) : shortDate(key)]
}

function weekTitle(w: Week): string {
  const name = w.n > 14 ? `Exams, week ${w.n - 14}` : `Week ${w.n}`
  return w.topic ? `${name} · ${w.topic}` : name
}

function topicOf(s: Session): Topic | null {
  return c.get('topics', s.topic_id)
}

function newHref(kind: 'p' | 'b', s: Session): string {
  const q = new URLSearchParams({ subject_id: props.subject.id, session_id: s.id })
  if (kind === 'p') q.set('template', 'lecture')
  return `/app/${kind}/new?${q}`
}

function actionsFor(s: Session): MenuAction[] {
  const list: MenuAction[] = []
  if (false) {
    list.push({ label: 'Record this class', icon: 'mic', run: () => capture.show('record', props.subject.id, s.id) })
  }
  list.push(
    { label: 'New page for this class', icon: 'plus', run: () => void router.push(newHref('p', s)) },
    { label: 'New board for this class', icon: 'plus', run: () => void router.push(newHref('b', s)) },
  )
  return list
}

/* Open on this week: scrolled so the slot above it (the Next card) and the
   week itself are what the learner sees first. */
const root = ref<HTMLElement | null>(null)

onMounted(async () => {
  await nextTick()
  const anchor = root.value?.querySelector<HTMLElement>('[data-current-anchor]')
  const scroller = root.value?.closest<HTMLElement>('.om-scroll')
  if (!anchor || !scroller) return
  const top = anchor.getBoundingClientRect().top - scroller.getBoundingClientRect().top
  if (top > scroller.clientHeight * 0.5) scroller.scrollTop += top - 16
})

const chip =
  'group/chip inline-flex h-11 max-w-full items-center gap-1.5 text-[14px] font-semibold text-brand min-[900px]:h-8'
</script>

<template>
  <div
    ref="root"
    class="grid gap-2"
  >
    <div
      v-if="!hasCurrent && $slots.current"
      data-current-anchor
      class="mb-4"
    >
      <slot name="current" />
    </div>

    <template
      v-for="w in weeks"
      :key="w.n"
    >
      <!-- Right above this week: whatever the page wants seen first (the Next card). -->
      <div
        v-if="w.n === current"
        data-current-anchor
        class="scroll-mt-4"
        :class="$slots.current && 'mt-4 mb-2'"
      >
        <slot name="current" />
      </div>

      <section
        :id="`week-${w.n}`"
        :aria-labelledby="`week-${w.n}-title`"
        :class="['scroll-mt-4 rounded-[18px] transition-colors duration-150', isOpen(w) && 'my-2']"
      >
        <button
          type="button"
          class="group -mx-2 flex w-[calc(100%+16px)] cursor-pointer items-center gap-3 rounded-[12px] px-2 py-2.5 text-left transition-colors hover:bg-surface-mute focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
          :aria-expanded="isOpen(w)"
          @click="toggle(w)"
        >
          <span class="grid min-w-0 flex-1 gap-0.5">
            <span
              :id="`week-${w.n}-title`"
              :class="[
                'min-w-0 truncate font-display tracking-[-0.01em]',
                isOpen(w) ? 't-head text-[19px]' : 'text-[16px] font-semibold',
                w.n < current && !isOpen(w) ? 'text-text-soft' : 'text-text',
              ]"
            >{{ weekTitle(w) }}</span>
            <span
              v-if="!isOpen(w)"
              class="truncate text-[13.5px] text-text-muted"
            >{{ summary(w) }}</span>
          </span>
          <span
            v-if="w.n === current"
            class="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-[12.5px] font-semibold text-accent-strong"
          >This week</span>
          <span
            v-else-if="w.check === 'checked' || w.check === 'missed'"
            class="shrink-0 text-[14px] font-medium"
            :class="w.check === 'checked' ? 'text-success-text' : 'text-danger-text'"
          >{{ w.check }}</span>
          <CompanionIcon
            name="chevron-down"
            :size="18"
            :class="[
              'shrink-0 text-text-faint transition-[transform,color] duration-150 group-hover:text-text-soft',
              isOpen(w) && 'rotate-180',
            ]"
          />
        </button>

        <ul
          v-if="isOpen(w)"
          class="animate-rise mt-1 divide-y divide-border-rule border-y border-border-rule"
        >
          <li
            v-for="e in w.entries"
            :key="e.kind === 'class' ? e.session.id : e.deadline.id"
          >
            <CompanionDeadlineRow
              v-if="e.kind === 'due'"
              :deadline="e.deadline"
              :with-course="false"
            />
            <div
              v-else
              class="flex gap-4 py-3"
              :class="e.session.cancelled ? 'opacity-60' : ''"
            >
              <span class="grid w-[64px] shrink-0 content-start leading-tight">
                <span class="text-[15px] font-semibold text-text">{{ dayParts(e.session)[0] }}</span>
                <span class="text-[13px] text-text-muted">{{ dayParts(e.session)[1] }}</span>
              </span>
              <div class="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-0.5">
                <p class="flex flex-wrap items-baseline gap-x-2 text-[16px] leading-snug font-medium text-text">
                  <span :class="e.session.cancelled ? 'line-through' : ''">{{ e.session.title }}</span>
                  <span
                    v-if="e.session.cancelled"
                    class="text-[14px] font-normal text-text-muted"
                  >cancelled</span>
                </p>
                <p
                  v-if="(isAhead(e.session) || isLive(e.session)) && !e.session.cancelled"
                  class="text-[13.5px] text-text-muted"
                >
                  {{ sessionLine(e.session) }}
                </p>
                <div
                  v-if="(openTopic && topicOf(e.session)) || itemsOf(e.session).length"
                  class="flex min-w-0 flex-wrap gap-x-5"
                >
                  <!-- The lesson on what this class teaches, opened beside the weeks. -->
                  <button
                    v-if="openTopic && topicOf(e.session)"
                    type="button"
                    :class="chip"
                    :title="topicOf(e.session)!.node_id ? 'Open the lesson' : 'See the topic, and have its lesson written'"
                    @click="openTopic(topicOf(e.session)!)"
                  >
                    <CompanionIcon
                      name="book"
                      :size="15"
                      class="shrink-0"
                    />
                    <span class="truncate group-hover/chip:underline">Lesson · {{ topicOf(e.session)!.title }}</span>
                  </button>
                  <CompanionItemChip
                    v-for="x in itemsOf(e.session)"
                    :key="x.item.id"
                    :item="x.item"
                    :count="x.count"
                  />
                </div>
              </div>
              <span
                v-if="isLive(e.session) && !e.session.cancelled"
                class="mt-0.5 h-fit shrink-0 rounded-full bg-danger-soft px-2.5 py-0.5 text-[13px] font-semibold text-danger-text"
              >Now</span>
              <UiMenu
                v-if="!e.session.cancelled"
                :actions="actionsFor(e.session)"
                :label="`More for ${e.session.title}`"
                :title="e.session.title"
                class="-mt-1"
              />
            </div>
          </li>
          <li
            v-if="!w.entries.length"
            class="py-3 text-[14px] text-text-muted"
          >
            Nothing scheduled this week.
          </li>
        </ul>
      </section>
    </template>

    <p
      v-if="!weeks.length"
      class="py-2 text-[15px] text-text-muted"
    >
      No classes yet. They arrive with the timetable, from Moodle or a calendar feed.
    </p>

    <section
      v-if="loose.length"
      aria-labelledby="course-extras"
      class="mt-6"
    >
      <h2
        id="course-extras"
        class="t-head mb-2 text-[19px]"
      >
        For the whole course
      </h2>
      <div class="flex flex-wrap gap-x-5 border-y border-border-rule py-2">
        <CompanionItemChip
          v-for="i in loose"
          :key="i.id"
          :item="i"
        />
      </div>
    </section>
  </div>
</template>

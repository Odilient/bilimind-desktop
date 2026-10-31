<script setup lang="ts">
/**
 * A self-study course along its path, read
 * top to bottom like Today:
 *
 *  1. The next lesson in cobalt with one lime button, so the learner knows
 *     what to press without reading the rest.
 *  2. The pace note when the course has slipped (PaceCard), with its fixes.
 *  3. The unit they are in, as a hairline list: done, the one now, the ones
 *     after, and the unit's check last. Every row opens its lesson.
 *  4. The whole path in one list: each unit folded to a line that opens to
 *     its lessons, and the finish line at the end, because everything hangs
 *     off it.
 *
 * State is said by a small mark and a word ("done", "tonight", "Wed"), never
 * by the course's colour; that stays a dot beside the course's name. Where
 * the learner is on the path (done, now, next) is not what they know, so a
 * topic's check is said beside it, in words: "Checked" in green, "missed" in
 * coral, and nothing until there is a check, because a path full of "not
 * checked yet" would read as a debt.
 *
 * `openTopic`, when given (the course workspace), opens a step's written
 * lesson beside the path instead of following the link to a page: the old
 * lesson view, with its blocks and markup, is where a path's lessons live.
 */
import type { Subject, Topic } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { dayKey, dayMonthLong, parts, relativeDay, weekdayShort } from '~/companion/time'
import { sessionLine } from '~/companion/words'
import type { PathStep } from '~/companion/readiness'

const props = defineProps<{ subject: Subject; openTopic?: (topic: Topic) => void }>()
const c = useCompanion()

const goal = computed(() => c.goalOf(props.subject))
const steps = computed(() => c.pathOf(props.subject.id))
const units = computed(() =>
  c.topics.value
    .filter((t) => t.subject_id === props.subject.id && !t.parent_id && c.topics.value.some((x) => x.parent_id === t.id))
    .sort((a, b) => a.position - b.position),
)

interface Unit {
  topic: Topic
  index: number
  steps: PathStep[]
  done: boolean
  current: boolean
}

const grouped = computed<Unit[]>(() => {
  const list = units.value.map((u, index) => {
    const own = steps.value.filter((s) => s.topic.parent_id === u.id)
    return { topic: u, index, steps: own, done: own.every((s) => s.state === 'done'), current: own.some((s) => s.state === 'now') }
  })
  // A course without units is one long unit.
  if (!list.length && steps.value.length) {
    return [{ topic: { id: 'all', title: props.subject.title } as Topic, index: 0, steps: steps.value, done: false, current: true }]
  }
  return list
})

/** "Unit 3 · The past", whether or not the title already says "Unit 3". */
function unitLabel(u: Unit): string {
  return /^unit\s*\d+/i.test(u.topic.title) ? u.topic.title : `Unit ${u.index + 1} · ${u.topic.title}`
}

const currentUnit = computed(() => grouped.value.find((u) => u.current) ?? null)
const nowStep = computed(() => steps.value.find((s) => s.state === 'now') ?? null)
const doneCount = computed(() => steps.value.filter((s) => s.state === 'done').length)

const open = ref<Set<string>>(new Set())
function toggle(id: string): void {
  const next = new Set(open.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  open.value = next
}

const pace = computed(() => c.today.value?.pace.find((p) => p.goal_id === goal.value?.id) ?? null)
onMounted(() => {
  if (!c.today.value) void c.loadToday()
})

/** The unit's check, from the deadlines: "Unit 3 check · 15 questions". */
function checkpoint(unit: Unit) {
  const ids = new Set(unit.steps.map((s) => s.topic.id))
  return c.deadlines.value.find(
    (d) => d.subject_id === props.subject.id && d.kind === 'milestone' && d.status === 'upcoming' && d.topic_ids.some((t) => ids.has(t)),
  )
}
const finish = computed(() =>
  c.deadlines.value.find((d) => d.subject_id === props.subject.id && (d.kind === 'exam' || d.kind === 'final')) ?? null,
)

function lessonFor(step: PathStep) {
  return c.items.value.find((i) => i.topic_id === step.topic.id && i.kind === 'page')
}

/** "Tonight", "Tomorrow", "Wed": when the lesson is planned. */
function when(step: PathStep): string {
  if (!step.session) return ''
  const key = dayKey(step.session.starts_at)
  const rel = relativeDay(key)
  if (rel === 'today') return parts(step.session.starts_at).hour >= 17 ? 'Tonight' : 'Today'
  return rel === 'tomorrow' ? 'Tomorrow' : weekdayShort(key)
}

function right(step: PathStep): string {
  return step.state === 'done' ? 'done' : when(step)
}

/** A step is a link to its page, or (in the workspace) a button that opens its lesson. */
const linkTag = resolveComponent('NuxtLink')
const stepTag = computed(() => (props.openTopic ? 'button' : linkTag))

function stepAttrs(step: PathStep): Record<string, unknown> {
  return props.openTopic ? { type: 'button' } : { to: stepTo(step) }
}

function stepTo(step: PathStep): string {
  const lesson = lessonFor(step)
  if (lesson) return `/app/p/${lesson.id}`
  const q = new URLSearchParams({ subject_id: props.subject.id, topic_id: step.topic.id, template: 'reading' })
  if (step.session) q.set('session_id', step.session.id)
  return `/app/p/new?${q}`
}

const startLabel = computed(() => {
  const step = nowStep.value
  if (!step) return ''
  if (lessonFor(step)) return 'Open the lesson'
  const title = step.session?.title ?? ''
  return title && title.toLowerCase() !== 'study' ? `Start ${title}` : 'Start the lesson'
})

function lessons(n: number): string {
  return n === 1 ? '1 lesson' : `${n} lessons`
}
</script>

<template>
  <div class="grid gap-10 min-[900px]:gap-12">
    <div
      v-if="nowStep || (goal && pace?.status === 'behind')"
      class="grid gap-4"
    >
      <!-- The next lesson: the one thing to press on this page. -->
      <section
        v-if="nowStep"
        class="cb-cobalt grid gap-5 rounded-[24px] p-5 min-[900px]:p-7"
        aria-label="Next lesson"
      >
        <div class="grid gap-2">
          <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-white/80">
            <span class="font-semibold text-white">{{ when(nowStep) || 'Next on your path' }}</span>
            <template v-if="nowStep.session">
              <span aria-hidden="true">·</span>
              <span>{{ sessionLine(nowStep.session) }}</span>
            </template>
          </p>
          <p class="t-head text-[26px] text-white min-[900px]:text-[32px]">
            <template v-if="nowStep.session && nowStep.session.title.toLowerCase() !== 'study'">
              {{ nowStep.session.title }} ·
            </template>{{ nowStep.topic.title }}
          </p>
          <p class="text-[14px] text-white/75">
            {{ lessonFor(nowStep) ? 'Your lesson is ready.' : 'The lesson is written for you when you start.' }}
          </p>
        </div>
        <div>
          <UiBtn
            :to="openTopic ? undefined : stepTo(nowStep)"
            variant="accent"
            size="lg"
            trailing-icon="arrow-right"
            @click="openTopic?.(nowStep.topic)"
          >
            {{ startLabel }}
          </UiBtn>
        </div>
      </section>

      <CompanionPaceCard
        v-if="goal"
        :goal="goal"
        :subject="subject"
        :pace="pace"
      />
    </div>

    <!-- The unit the learner is in. -->
    <section
      v-if="currentUnit"
      aria-labelledby="path-unit"
    >
      <header class="mb-2 flex items-baseline justify-between gap-3">
        <h2
          id="path-unit"
          class="t-head min-w-0 text-[19px]"
        >
          {{ unitLabel(currentUnit) }}
        </h2>
        <span class="shrink-0 text-[14px] font-medium text-text-muted">
          {{ currentUnit.steps.filter((s) => s.state === 'done').length }} of {{ currentUnit.steps.length }} done
        </span>
      </header>
      <ul class="divide-y divide-border-rule border-y border-border-rule">
        <li
          v-for="s in currentUnit.steps"
          :key="s.topic.id"
        >
          <component
            :is="stepTag"
            v-bind="stepAttrs(s)"
            class="group -mx-2 flex w-[calc(100%+16px)] cursor-pointer items-center gap-3 rounded-[12px] px-2 py-3 text-left transition-colors hover:bg-surface-mute"
            :aria-current="s.state === 'now' ? 'step' : undefined"
            @click="openTopic?.(s.topic)"
          >
            <span class="grid size-6 shrink-0 place-items-center">
              <CompanionIcon
                v-if="s.state === 'done'"
                name="check"
                :size="17"
                :stroke="2.4"
                class="text-success-text"
              />
              <span
                v-else-if="s.state === 'now'"
                class="size-2.5 rounded-full bg-cobalt"
              />
              <span
                v-else
                class="size-2.5 rounded-full border-[1.5px] border-text-faint"
              />
            </span>
            <span class="grid min-w-0 flex-1 gap-0.5">
              <span
                class="text-[16px] leading-snug"
                :class="s.state === 'now' ? 'font-semibold text-text' : s.state === 'done' ? 'font-medium text-text-soft' : 'font-medium text-text'"
              >{{ s.topic.title }}</span>
              <span
                v-if="s.state === 'now'"
                class="text-[13.5px] text-text-muted"
              >{{ lessonFor(s) ? 'Your lesson is ready' : 'Written for you when you start' }}</span>
              <span
                v-else-if="s.check === 'checked' || s.check === 'missed'"
                class="text-[13.5px]"
                :class="s.check === 'checked' ? 'text-success-text' : 'text-coral-text'"
              >{{ s.check === 'checked' ? 'Checked' : 'Missed in a check · back in your plan' }}</span>
            </span>
            <span
              class="shrink-0 text-[14px] font-medium"
              :class="s.state === 'done' ? 'text-success-text' : s.state === 'now' ? 'text-text' : 'text-text-muted'"
            >{{ right(s) }}</span>
            <CompanionIcon
              name="chevron-right"
              :size="18"
              class="shrink-0 text-text-faint transition-colors group-hover:text-text-soft"
            />
          </component>
        </li>
        <li v-if="checkpoint(currentUnit)">
          <NuxtLink
            :to="`/app/d/${checkpoint(currentUnit)!.id}`"
            class="group -mx-2 flex items-center gap-3 rounded-[12px] px-2 py-3 transition-colors hover:bg-surface-mute"
          >
            <span class="grid size-6 shrink-0 place-items-center text-text-soft">
              <CompanionIcon
                name="flag"
                :size="16"
              />
            </span>
            <span class="grid min-w-0 flex-1 gap-0.5">
              <span class="text-[16px] leading-snug font-medium text-text">{{ checkpoint(currentUnit)!.title }}</span>
              <span
                v-if="checkpoint(currentUnit)!.scope_note"
                class="text-[13.5px] text-text-muted"
              >{{ checkpoint(currentUnit)!.scope_note }}</span>
            </span>
            <span
              v-if="c.weekOf(checkpoint(currentUnit)!.due_at!)"
              class="shrink-0 text-[14px] font-medium text-text-muted"
            >Week {{ c.weekOf(checkpoint(currentUnit)!.due_at!) }}</span>
            <CompanionIcon
              name="chevron-right"
              :size="18"
              class="shrink-0 text-text-faint transition-colors group-hover:text-text-soft"
            />
          </NuxtLink>
        </li>
      </ul>
    </section>

    <!-- The whole path: every unit on one line, the finish line last. -->
    <section aria-labelledby="path-all">
      <header class="mb-2 flex items-baseline justify-between gap-3">
        <h2
          id="path-all"
          class="t-head text-[19px]"
        >
          The whole path
        </h2>
        <span
          v-if="steps.length"
          class="shrink-0 text-[14px] font-medium text-text-muted"
        >{{ doneCount }} of {{ lessons(steps.length) }} done</span>
      </header>
      <ul class="divide-y divide-border-rule border-y border-border-rule">
        <li
          v-for="u in grouped"
          :key="u.topic.id"
        >
          <!-- The unit being worked on is spelled out above; here it only marks the place. -->
          <div
            v-if="u.current"
            class="flex items-center gap-3 py-3"
          >
            <span class="grid size-6 shrink-0 place-items-center">
              <span class="size-2.5 rounded-full bg-cobalt" />
            </span>
            <span class="grid min-w-0 flex-1 gap-0.5">
              <span class="text-[16px] leading-snug font-semibold text-text">{{ unitLabel(u) }}</span>
              <span class="text-[13.5px] text-text-muted">You're here</span>
            </span>
            <span class="shrink-0 text-[14px] font-medium text-text-muted">
              {{ u.steps.filter((s) => s.state === 'done').length }} of {{ u.steps.length }} done
            </span>
          </div>
          <template v-else>
            <button
              type="button"
              class="group -mx-2 flex w-[calc(100%+16px)] items-center gap-3 rounded-[12px] px-2 py-3 text-left transition-colors hover:bg-surface-mute"
              :aria-expanded="open.has(u.topic.id)"
              @click="toggle(u.topic.id)"
            >
              <span class="grid size-6 shrink-0 place-items-center">
                <CompanionIcon
                  v-if="u.done"
                  name="check"
                  :size="17"
                  :stroke="2.4"
                  class="text-success-text"
                />
                <span
                  v-else
                  class="size-2.5 rounded-full border-[1.5px] border-text-faint"
                />
              </span>
              <span class="grid min-w-0 flex-1 gap-0.5">
                <span
                  class="text-[16px] leading-snug font-medium"
                  :class="u.done ? 'text-text-soft' : 'text-text'"
                >{{ unitLabel(u) }}</span>
                <span class="text-[13.5px] text-text-muted">{{ lessons(u.steps.length) }}{{ u.done ? ', all done' : '' }}</span>
              </span>
              <CompanionIcon
                :name="open.has(u.topic.id) ? 'chevron-up' : 'chevron-down'"
                :size="18"
                class="shrink-0 text-text-faint transition-colors group-hover:text-text-soft"
              />
            </button>
            <ul
              v-if="open.has(u.topic.id)"
              class="mb-2 grid pl-9"
            >
              <li
                v-for="s in u.steps"
                :key="s.topic.id"
              >
                <component
                  :is="stepTag"
                  v-if="s.state === 'done'"
                  v-bind="stepAttrs(s)"
                  class="group -mx-2 flex min-h-11 w-[calc(100%+16px)] cursor-pointer items-center gap-3 rounded-[10px] px-2 text-left transition-colors hover:bg-surface-mute"
                  @click="openTopic?.(s.topic)"
                >
                  <span class="min-w-0 flex-1 truncate text-[15px] text-text-body">{{ s.topic.title }}</span>
                  <span class="shrink-0 text-[14px] text-success-text">done<template v-if="s.check === 'checked'"> · checked</template><span
                    v-else-if="s.check === 'missed'"
                    class="text-coral-text"
                  > · missed</span></span>
                  <CompanionIcon
                    name="chevron-right"
                    :size="16"
                    class="shrink-0 text-text-faint transition-colors group-hover:text-text-soft"
                  />
                </component>
                <p
                  v-else
                  class="flex min-h-11 items-center justify-between gap-3 text-[15px] text-text-muted"
                >
                  <span class="min-w-0 truncate">{{ s.topic.title }}</span>
                  <span class="shrink-0 text-[14px]">{{ right(s) }}</span>
                </p>
              </li>
            </ul>
          </template>
        </li>
        <li v-if="finish || goal?.ends_on">
          <NuxtLink
            :to="finish ? `/app/d/${finish.id}` : '/app/calendar'"
            class="group -mx-2 flex items-center gap-3 rounded-[12px] px-2 py-3 transition-colors hover:bg-surface-mute"
          >
            <span class="grid size-6 shrink-0 place-items-center text-text">
              <CompanionIcon
                name="flag"
                :size="16"
              />
            </span>
            <span class="grid min-w-0 flex-1 gap-0.5">
              <span class="text-[16px] leading-snug font-semibold text-text">Finish line · {{ finish?.title ?? goal?.finish_label ?? 'the date' }}</span>
              <span
                v-if="goal?.ends_on"
                class="text-[13.5px] text-text-muted"
              >{{ dayMonthLong(goal.ends_on) }}</span>
            </span>
            <CompanionIcon
              name="chevron-right"
              :size="18"
              class="shrink-0 text-text-faint transition-colors group-hover:text-text-soft"
            />
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>

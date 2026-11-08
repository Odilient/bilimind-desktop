<script setup lang="ts">
/**
 * Your plan: the old Today's numbered list (`pages/today.vue`), filled by
 * the companion's planner. One white card, one row per thing to do, in the
 * order it should be done.
 *
 * A row: its number in a square, which is also the tick (hover shows the
 * check, a press marks it done and the square turns leaf green); the title, which
 * opens the thing to do; under it the course's dot and name and why today
 * ("quiz Thu 09:00 · chapters 4–5"); the minutes; and a "…" menu with the
 * rest (done or not, a 25-minute focus on it, tomorrow instead, ask
 * BiliMind for help with it, remove a line you typed). The row in focus
 * counts down where its minutes were. A line the learner typed opens nothing, so it
 * has no chevron.
 *
 * A check ("Check yourself on Normal forms and Transactions · 6 questions ·
 * no notes, no help") is a row like any other and opens `/app/check`
 * (`taskHref`), but its menu has no "Ask Bili": help on a check is what
 * the check is there to rule out. A miss comes back as an ordinary reading
 * row ("Go back over Transactions"), which opens the topic.
 *
 * Falling behind is the normal state of studying, so the old rule holds:
 * what is left from earlier days is said once, with one fix, never a red
 * wall of late items. That one line is the week's nudge now (Week.vue),
 * where the missed block can be seen on its day.
 *
 * Under Today's pick it is "Also today": the pick is left out of it.
 *
 * "Add a task" is the card's last row. It takes a sentence and, if it ends
 * in minutes ("read ch. 3 30 min"), uses them. Those rows are `kind: 'own'`,
 * which the planner never replaces or deletes (Planner::reconcile).
 */
import { NuxtLink } from '#components'
import type { MenuAction } from '~/components/ui/Menu.vue'
import type { PlanTask } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { useAi } from '~/companion/ai/state'
import { useQuietAi } from '~/companion/quiet-ai'
import { courseColor } from '~/companion/colors'
import { FOCUS_MIN, useFocus } from '~/companion/focus'
import { dayKey, nowIso, shiftDay, timecode } from '~/companion/time'
import { taskHref, useNow } from '~/companion/today-layout'

const { t: tr } = useI18n()
const c = useCompanion()
const focus = useFocus()
const ai = useAi()
const toast = useToast()
const { quiet } = useQuietAi()
const now = useNow()

const today = computed(() => dayKey(now.value))

/** Today's pick (Hero) is the card above; the list is everything else today holds. */
const pick = useState<string | null>('today:pick', () => null)

const tasks = computed(() =>
  c.planTasks.value
    .filter((t) => t.date === today.value && t.id !== pick.value)
    .sort((a, b) => a.position - b.position),
)
const left = computed(() => tasks.value.filter((t) => !t.done_at).reduce((s, t) => s + t.minutes, 0))
const total = computed(() => tasks.value.reduce((s, t) => s + t.minutes, 0))
const allDone = computed(() => tasks.value.length > 0 && left.value === 0)

const aside = computed(() => {
  if (!tasks.value.length || allDone.value) return ''
  return left.value === total.value ? tr('today.plan.about', { time: minutesLabel(total.value) }) : tr('today.plan.left', { time: minutesLabel(left.value) })
})

function toggle(t: PlanTask): void {
  const done = !t.done_at
  void c.upsert<PlanTask>('plan-tasks', { id: t.id, done_at: done ? nowIso() : null })
  if (done) {
    toast.success({
      title: tr('today.plan.done', { title: t.title }),
      action: { label: tr('today.plan.undo'), handler: () => void c.upsert<PlanTask>('plan-tasks', { id: t.id, done_at: null }) },
    })
  }
}

/** A focus block on this row, with the work it opens opened. */
function focusOn(t: PlanTask): void {
  const to = taskHref(t, c)
  focus.start({ label: t.title, taskId: t.id, to })
  if (to) void navigateTo(to)
}

/** The row being focused on counts down in place of its minutes. */
function minutesOf(t: PlanTask): string {
  const f = focus.state.value
  return f?.task_id === t.id && f.phase === 'focus' && !t.done_at
    ? timecode(Math.ceil(focus.left.value / 1000))
    : minutesLabel(t.minutes)
}

function moveTo(t: PlanTask, date: string): void {
  const last = c.planTasks.value.filter((x) => x.date === date).reduce((m, x) => Math.max(m, x.position), 0)
  void c.upsert<PlanTask>('plan-tasks', { id: t.id, date, position: last + 1 })
}

function actions(t: PlanTask): MenuAction[] {
  const list: MenuAction[] = [
    { label: tr(t.done_at ? 'today.plan.notDone' : 'today.plan.markDone'), icon: 'check', run: () => toggle(t) },
  ]
  if (!t.done_at) {
    if (focus.state.value?.task_id !== t.id) {
      list.push({ label: tr('today.plan.focusFor', { n: FOCUS_MIN }), icon: 'timer', run: () => focusOn(t) })
    }
    list.push({ label: tr('today.plan.tomorrow'), icon: 'calendar', run: () => moveTo(t, shiftDay(today.value, 1)) })
  }
  if (!quiet.value && t.kind !== 'check') {
    const course = c.subjectOf(t)?.title
    list.push({
      label: tr('today.plan.ask'),
      icon: 'spark',
      run: () => ai.ask(course ? tr('today.plan.helpWithFor', { title: t.title, course }) : tr('today.plan.helpWith', { title: t.title })),
    })
  }
  if (t.kind === 'own') {
    list.push({ label: tr('common.remove'), icon: 'trash', destructive: true, run: () => void c.remove('plan-tasks', t.id) })
  }
  return list
}

/* -- Add a task ------------------------------------------------------------ */

const adding = ref(false)
const draft = ref('')
const input = ref<HTMLInputElement | null>(null)

async function startAdding(): Promise<void> {
  adding.value = true
  await nextTick()
  input.value?.focus()
}

function add(): void {
  const text = draft.value.trim()
  if (!text) {
    adding.value = false
    return
  }
  const match = text.match(/\s*(\d{1,3})\s*(?:m|min|mins|minutes)\.?$/i)
  const minutes = match ? Math.min(600, Math.max(1, Number(match[1]))) : 15
  const title = match ? text.slice(0, match.index).trim() || text : text
  void c.upsert<PlanTask>('plan-tasks', {
    id: crypto.randomUUID(),
    date: today.value,
    subject_id: null,
    deadline_id: null,
    topic_id: null,
    item_id: null,
    kind: 'own',
    title,
    detail: null,
    minutes,
    position: (tasks.value.at(-1)?.position ?? 0) + 1,
    done_at: null,
    generated_at: nowIso(),
  })
  draft.value = ''
  void nextTick(() => input.value?.focus())
}

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    draft.value = ''
    adding.value = false
  }
}
</script>

<template>
  <section aria-labelledby="today-plan">
    <div class="flex items-baseline justify-between gap-3 px-0.5">
      <h2
        id="today-plan"
        class="font-display text-[18px] font-semibold tracking-[-0.02em]"
      >
        {{ tr(pick ? 'today.plan.also' : 'today.plan.title') }}
      </h2>
      <p
        v-if="allDone"
        class="inline-flex items-center gap-1.5 rounded-full bg-leaf-soft px-2.5 py-1 text-[12px] font-semibold text-leaf-ink"
      >
        <UiIcon
          name="check"
          :size="12"
          :stroke="2.6"
        />
        {{ tr('today.plan.allDone') }}
      </p>
      <p
        v-else-if="aside"
        class="text-[12.5px] text-text-faint"
      >
        {{ aside }}
      </p>
    </div>

    <div class="mt-2.5 overflow-hidden rounded-[18px] bg-surface shadow-[0_0_0_1px_var(--border),var(--shadow-raised)]">
      <TransitionGroup
        v-if="tasks.length"
        tag="ol"
        move-class="transition-transform duration-200"
        enter-active-class="duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        leave-active-class="duration-150 ease-in"
        leave-to-class="opacity-0"
      >
        <li
          v-for="(t, index) in tasks"
          :key="t.id"
          class="group flex items-stretch"
          :class="index > 0 && 'border-t border-border-rule'"
        >
          <!-- The old plan's numbered circle, which is also the tick. -->
          <button
            type="button"
            role="checkbox"
            :aria-checked="Boolean(t.done_at)"
            :aria-label="`${tr(t.done_at ? 'common.done' : 'today.plan.markDoneShort')}: ${t.title}`"
            class="group/tick grid w-[52px] shrink-0 cursor-pointer place-items-center pl-1.5 focus-visible:outline-none"
            @click="toggle(t)"
          >
            <span
              :class="[
                'grid size-[26px] place-items-center rounded-[8px] text-[12px] font-bold transition-[background-color,box-shadow,color] duration-150 group-focus-visible/tick:ring-2 group-focus-visible/tick:ring-brand',
                t.done_at
                  ? 'bg-leaf text-white'
                  : 'text-text-faint shadow-[inset_0_0_0_1.5px_var(--border-dashed)] group-hover/tick:bg-leaf-soft group-hover/tick:text-leaf-ink group-hover/tick:shadow-[inset_0_0_0_1.5px_var(--leaf)]',
              ]"
            >
              <UiIcon
                v-if="t.done_at"
                name="check"
                :size="15"
                :stroke="2.6"
              />
              <template v-else>
                <span class="group-hover/tick:hidden">{{ index + 1 }}</span>
                <UiIcon
                  name="check"
                  :size="15"
                  :stroke="2.4"
                  class="hidden group-hover/tick:block"
                />
              </template>
            </span>
          </button>

          <component
            :is="taskHref(t, c) ? NuxtLink : 'div'"
            :to="taskHref(t, c) ?? undefined"
            class="flex min-w-0 flex-1 items-center gap-3 py-3 pr-1 pl-1"
            :class="taskHref(t, c) && 'transition-colors hover:bg-[rgb(var(--wash-rgb)/0.03)] focus-visible:bg-[rgb(var(--wash-rgb)/0.03)] focus-visible:outline-none'"
          >
            <span class="min-w-0 flex-1">
              <span
                class="block text-[14px] leading-snug font-semibold tracking-[-0.01em] transition-colors"
                :class="t.done_at ? 'text-text-faint line-through decoration-text-ghost' : 'text-text'"
              >{{ t.title }}</span>
              <span
                v-if="t.detail || c.subjectOf(t)"
                class="mt-1 block text-[12.5px] leading-snug text-text-faint"
              >
                <span
                  v-if="c.subjectOf(t)"
                  class="mr-1.5 inline-block size-2 rounded-[3px] align-[1px]"
                  :style="{ background: courseColor(c.subjectOf(t)?.color) }"
                />{{ [c.subjectOf(t)?.title, t.detail].filter(Boolean).join(' · ') }}
              </span>
            </span>
            <span
              class="shrink-0 text-[12.5px] font-medium whitespace-nowrap"
              :class="t.done_at ? 'text-text-ghost' : 'text-text-soft'"
            >{{ minutesOf(t) }}</span>
            <UiIcon
              v-if="taskHref(t, c)"
              name="chevron-right"
              :size="16"
              class="shrink-0 text-text-ghost transition-transform duration-150 group-hover:translate-x-0.5"
            />
          </component>

          <div class="flex shrink-0 items-center pr-2">
            <UiMenu
              :actions="actions(t)"
              :title="t.title"
              :label="tr('today.plan.moreFor', { title: t.title })"
              float
            />
          </div>
        </li>
      </TransitionGroup>

      <!-- Nothing on the list: the old Today's "nothing due" card. -->
      <div
        v-else
        class="px-5 pt-6 pb-6 text-center"
      >
        <span class="mx-auto grid size-10 place-items-center rounded-[12px] bg-leaf-soft text-leaf-ink">
          <UiIcon
            name="check"
            :size="18"
            :stroke="2.3"
          />
        </span>
        <p class="mt-2.5 font-display text-[17px] font-semibold tracking-[-0.02em]">
          {{ tr(pick ? 'today.plan.nothingElse' : 'today.plan.nothing') }}
        </p>
        <p class="mx-auto mt-1.5 max-w-sm text-[14px] leading-relaxed text-text-soft">
          {{ tr(c.shelf.value.length ? 'today.plan.emptyCourses' : 'today.plan.emptyNone') }}
        </p>
      </div>

      <form
        v-if="adding"
        class="flex items-center gap-2 border-t border-border-rule py-2.5 pr-2.5 pl-4"
        @submit.prevent="add"
      >
        <input
          ref="input"
          v-model="draft"
          type="text"
          maxlength="300"
          :placeholder="tr('today.plan.placeholder')"
          :aria-label="tr('today.plan.inputLabel')"
          class="h-10 min-w-0 flex-1 rounded-[10px] border border-border-field bg-surface px-3.5 text-[14px] outline-none placeholder:text-text-faint focus:border-brand focus:ring-3 focus:ring-brand-line"
          @keydown="onKey"
          @blur="!draft.trim() && (adding = false)"
        >
        <UiBtn
          type="submit"
          variant="primary"
          size="lg"
        >
          {{ tr('common.add') }}
        </UiBtn>
      </form>
      <button
        v-else
        type="button"
        class="flex min-h-[50px] w-full cursor-pointer items-center gap-3.5 border-t border-border-rule py-2.5 pl-[13px] text-left text-[13.5px] font-semibold text-text-soft transition-colors hover:bg-[rgb(var(--wash-rgb)/0.03)] hover:text-text focus-visible:bg-[rgb(var(--wash-rgb)/0.03)] focus-visible:outline-none"
        @click="startAdding"
      >
        <span class="grid size-[26px] shrink-0 place-items-center rounded-[8px] bg-[rgb(var(--wash-rgb)/0.065)]">
          <UiIcon
            name="plus"
            :size="15"
          />
        </span>
        {{ tr('today.plan.addTask') }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * Your plan: the old Today's numbered list (`pages/today.vue`), filled by
 * the companion's planner. One white card, one row per thing to do, in the
 * order it should be done.
 *
 * A row: its number in a circle, which is also the tick (hover shows the
 * check, a press marks it done and the circle turns lime); the title, which
 * opens the thing to do; under it the course's dot and name and why today
 * ("quiz Thu 09:00 · chapters 4–5"); the minutes; and a "…" menu with the
 * rest (done or not, a 25-minute focus on it, tomorrow instead, ask
 * BiliMind for help with it, remove a line you typed). The row in focus
 * counts down where its minutes were. A line the learner typed opens nothing, so it
 * has no chevron.
 *
 * A check ("Check yourself on Normal forms and Transactions · 6 questions ·
 * no notes, no help") is a row like any other and opens `/app/check`
 * (`taskHref`), but its menu has no "Ask BiliMind": help on a check is what
 * the check is there to rule out. A miss comes back as an ordinary reading
 * row ("Go back over Transactions"), which opens the topic.
 *
 * Falling behind is the normal state of studying, so the old rule holds:
 * what is left from earlier days is a quiet count at the top of the card
 * with one fix, Move to today, never a red wall of late items.
 *
 * "Add a task" is the card's last row. It takes a sentence and, if it ends
 * in minutes ("read ch. 3 30 min"), uses them. Those rows are `kind: 'own'`,
 * which the planner never replaces or deletes (Planner::reconcile, repo.demo
 * planFor).
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

const c = useCompanion()
const focus = useFocus()
const ai = useAi()
const toast = useToast()
const { quiet } = useQuietAi()
const now = useNow()

const today = computed(() => dayKey(now.value))

const tasks = computed(() =>
  c.planTasks.value.filter((t) => t.date === today.value).sort((a, b) => a.position - b.position),
)
/** Left from earlier days and not done: the quiet count, never a list of debts. */
const behind = computed(() => c.planTasks.value.filter((t) => t.date < today.value && !t.done_at))

const left = computed(() => tasks.value.filter((t) => !t.done_at).reduce((s, t) => s + t.minutes, 0))
const total = computed(() => tasks.value.reduce((s, t) => s + t.minutes, 0))
const allDone = computed(() => tasks.value.length > 0 && left.value === 0)

const aside = computed(() => {
  if (!tasks.value.length || allDone.value) return ''
  return left.value === total.value ? `about ${minutesLabel(total.value)}` : `${minutesLabel(left.value)} left`
})

function toggle(t: PlanTask): void {
  const done = !t.done_at
  void c.upsert<PlanTask>('plan-tasks', { id: t.id, done_at: done ? nowIso() : null })
  if (done) {
    toast.success({
      title: `Done: ${t.title}`,
      action: { label: 'Undo', handler: () => void c.upsert<PlanTask>('plan-tasks', { id: t.id, done_at: null }) },
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

const catchingUp = ref(false)
async function catchUp(): Promise<void> {
  if (catchingUp.value) return
  catchingUp.value = true
  const moving = [...behind.value]
  for (const t of moving) moveTo(t, today.value)
  catchingUp.value = false
  toast.success({
    title: `${plural(moving.length, 'thing')} moved to today`,
    body: 'Do what you can. The rest spreads out again tomorrow.',
  })
}

function actions(t: PlanTask): MenuAction[] {
  const list: MenuAction[] = [
    { label: t.done_at ? 'Mark as not done' : 'Mark as done', icon: 'check', run: () => toggle(t) },
  ]
  if (!t.done_at) {
    if (focus.state.value?.task_id !== t.id) {
      list.push({ label: `Focus on it for ${FOCUS_MIN} min`, icon: 'timer', run: () => focusOn(t) })
    }
    list.push({ label: 'Do it tomorrow', icon: 'calendar', run: () => moveTo(t, shiftDay(today.value, 1)) })
  }
  if (!quiet.value && t.kind !== 'check') {
    const course = c.subjectOf(t)?.title
    list.push({
      label: 'Ask BiliMind about this',
      icon: 'spark',
      run: () => ai.ask(`Help me with "${t.title}"${course ? ` for ${course}` : ''}. Where do I start?`),
    })
  }
  if (t.kind === 'own') {
    list.push({ label: 'Remove', icon: 'trash', destructive: true, run: () => void c.remove('plan-tasks', t.id) })
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
        class="t-head text-[19px]"
      >
        Your plan
      </h2>
      <p
        v-if="allDone"
        class="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent-strong"
      >
        <UiIcon
          name="check"
          :size="12"
          :stroke="2.6"
        />
        All done
      </p>
      <p
        v-else-if="aside"
        class="text-[12.5px] text-text-faint"
      >
        {{ aside }}
      </p>
    </div>

    <div class="mt-3 overflow-hidden rounded-[22px] bg-surface shadow-[inset_0_0_0_1px_var(--border),0_24px_48px_-36px_rgb(11_13_16/0.3)]">
      <!-- Behind: one line and one fix. -->
      <div
        v-if="behind.length"
        class="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-rule bg-warn-soft/60 py-2 pr-2 pl-4"
      >
        <UiIcon
          name="clock"
          :size="15"
          class="shrink-0 text-warn-text"
        />
        <p class="min-w-0 flex-1 text-[13px] text-warn-text">
          <span class="font-semibold">{{ plural(behind.length, 'thing') }} from earlier</span>
          · nothing is lost, the plan waits for you.
        </p>
        <UiBtn
          variant="ghost"
          size="md"
          class="max-sm:h-11"
          :loading="catchingUp"
          @click="catchUp"
        >
          Move to today
        </UiBtn>
      </div>

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
            :aria-label="`${t.done_at ? 'Done' : 'Mark done'}: ${t.title}`"
            class="group/tick grid w-[56px] shrink-0 cursor-pointer place-items-center pl-1.5 focus-visible:outline-none"
            @click="toggle(t)"
          >
            <span
              :class="[
                'grid size-8 place-items-center rounded-full font-display text-[13px] font-semibold transition-[background-color,box-shadow,color] duration-150 group-focus-visible/tick:ring-2 group-focus-visible/tick:ring-brand',
                t.done_at
                  ? 'bg-accent text-on-accent'
                  : 'text-text-soft shadow-[inset_0_0_0_1.5px_rgb(11_13_16/0.14)] group-hover/tick:bg-accent-soft group-hover/tick:text-accent-strong group-hover/tick:shadow-[inset_0_0_0_1.5px_var(--accent-line)]',
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
            class="flex min-w-0 flex-1 items-center gap-3 py-3.5 pr-1 pl-1"
            :class="taskHref(t, c) && 'transition-colors hover:bg-surface-mute focus-visible:bg-surface-mute focus-visible:outline-none'"
          >
            <span class="min-w-0 flex-1">
              <span
                class="block font-display text-[15.5px] leading-snug font-semibold tracking-[-0.015em] transition-colors"
                :class="t.done_at ? 'text-text-faint line-through decoration-text-ghost' : 'text-text'"
              >{{ t.title }}</span>
              <span
                v-if="t.detail || c.subjectOf(t)"
                class="mt-1 block text-[12.5px] leading-snug text-text-faint"
              >
                <span
                  v-if="c.subjectOf(t)"
                  class="mr-1.5 inline-block size-2 rounded-full align-[1px]"
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
              :label="`More for ${t.title}`"
            />
          </div>
        </li>
      </TransitionGroup>

      <!-- Nothing on the list: the old Today's "nothing due" card. -->
      <div
        v-else
        class="px-5 pt-6 pb-6 text-center"
      >
        <img
          src="/img/cobalt/obj-check.webp"
          alt=""
          aria-hidden="true"
          class="mx-auto size-20 object-contain drop-shadow-[0_18px_22px_rgb(11_13_16/0.16)]"
        >
        <p class="t-head mt-2 text-[18px]">
          Nothing on the plan today
        </p>
        <p class="mx-auto mt-1.5 max-w-sm text-[14px] leading-relaxed text-text-soft">
          {{ c.shelf.value.length ? 'Carry on with one of your courses, or add something below.' : 'Add something below, or make a course and BiliMind plans it with you.' }}
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
          placeholder="Read chapter 3, 30 min"
          aria-label="Something to do today"
          class="h-11 min-w-0 flex-1 rounded-full border border-border-field bg-surface px-4 text-[14.5px] outline-none placeholder:text-text-faint focus:border-brand focus:ring-3 focus:ring-brand-line"
          @keydown="onKey"
          @blur="!draft.trim() && (adding = false)"
        >
        <UiBtn
          type="submit"
          variant="primary"
          size="lg"
        >
          Add
        </UiBtn>
      </form>
      <button
        v-else
        type="button"
        class="flex min-h-[52px] w-full cursor-pointer items-center gap-3.5 border-t border-border-rule py-2.5 pl-3.5 text-left text-[14px] font-semibold text-brand transition-colors hover:bg-surface-mute focus-visible:bg-surface-mute focus-visible:outline-none"
        @click="startAdding"
      >
        <span class="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft">
          <UiIcon
            name="plus"
            :size="16"
          />
        </span>
        Add a task
      </button>
    </div>
  </section>
</template>

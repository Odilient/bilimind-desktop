<script setup lang="ts">
/**
 * A focus block or its break (`~/companion/focus`), shown in the same row
 * at the top of every screen as a recording in progress: what you're on
 * and the time left. A tap goes back to the work; beside it, pause and
 * stop (on a break: back to it, and stop).
 *
 * This is also where a phase ends, since the layout mounts it once: a
 * toast that stays until it's seen ("25 minutes on Read chapter 3", with
 * Mark it done for a plan task, then "Break's over" with another 25), and
 * the tab title carries the countdown so a hidden tab still tells the time.
 */
import type { PlanTask } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { FOCUS_MIN, useFocus } from '~/companion/focus'
import { nowIso, timecode } from '~/companion/time'

const { t } = useI18n()
const c = useCompanion()
const focus = useFocus()
const toast = useToast()

const s = computed(() => focus.state.value)
const paused = computed(() => Boolean(s.value && !s.value.ends_at))
const time = computed(() => timecode(Math.ceil(focus.left.value / 1000)))
const word = computed(() => t(s.value?.phase === 'break' ? 'today.focus.break' : paused.value ? 'today.focus.paused' : 'today.focus.focus'))

useHead({ titleTemplate: computed(() => (s.value ? `${time.value} ${word.value} · %s` : '%s')) })

function back(): void {
  if (s.value?.to) void navigateTo(s.value.to)
}

function again(ended: { label: string; task_id: string | null; to: string | null; rounds: number }): void {
  focus.start({ label: ended.label, taskId: ended.task_id, to: ended.to }, ended.rounds)
}

// The moment a phase runs out; keyed on its end, so a lid closed through a
// block and its break says both.
watch(
  () => (s.value?.ends_at && focus.left.value === 0 ? s.value.ends_at : null),
  (over) => {
    if (!over) return
    const ended = focus.advance()
    if (!ended) return
    if (ended.phase === 'focus') {
      const task = c.planTasks.value.find((t) => t.id === ended.task_id)
      const minutes = Math.round(focus.left.value / 60_000)
      toast.success({
        title: ended.label
          ? t('today.focus.minutesOn', { n: FOCUS_MIN, label: ended.label }, FOCUS_MIN)
          : t('today.focus.minutesOfFocus', FOCUS_MIN),
        body: t('today.focus.takeOff', minutes),
        duration: 0,
        action:
          task && !task.done_at
            ? {
                label: t('today.focus.markDone'),
                handler: () => void c.upsert<PlanTask>('plan-tasks', { id: task.id, done_at: nowIso() }),
              }
            : undefined,
      })
    } else {
      toast.info({
        title: t('today.focus.breakOver'),
        body: ended.label || undefined,
        duration: 0,
        action: { label: t('today.focus.moreMinutes', FOCUS_MIN), handler: () => again(ended) },
      })
    }
  },
)
</script>

<template>
  <div
    v-if="s"
    class="flex shrink-0 justify-center px-4 pt-2 pb-1"
  >
    <div class="flex max-w-full items-center rounded-full bg-ink py-1 pr-1 pl-1 text-[13px] font-semibold text-white shadow-lift">
      <button
        type="button"
        class="flex min-w-0 cursor-pointer items-center gap-2 rounded-full py-0.5 pr-2.5 pl-2 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
        :aria-label="`${word}${s.label ? ` · ${s.label}` : ''}, ${t('today.focus.left', { time })}${s.to ? ` ${t('today.focus.goBack')}` : ''}`"
        @click="back"
      >
        <span
          class="size-2 shrink-0 rounded-full"
          :class="[s.phase === 'break' ? 'bg-cobalt-soft' : 'bg-accent', paused && 'opacity-40']"
        />
        <span class="truncate">{{ word }}<template v-if="s.label"> · {{ s.label }}</template></span>
        <span class="num shrink-0 text-paper-2">{{ time }}</span>
      </button>
      <button
        v-if="s.phase === 'focus'"
        type="button"
        class="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-paper-2 transition-colors hover:bg-white/12 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
        :aria-label="t(paused ? 'today.focus.resume' : 'today.focus.pause')"
        @click="paused ? focus.resume() : focus.pause()"
      >
        <UiIcon
          :name="paused ? 'play' : 'pause'"
          :size="13"
        />
      </button>
      <button
        v-else
        type="button"
        class="h-7 shrink-0 cursor-pointer rounded-full px-2.5 text-[12.5px] text-paper-2 transition-colors hover:bg-white/12 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
        @click="again(s)"
      >
        {{ t('today.focus.backToIt') }}
      </button>
      <button
        type="button"
        class="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-paper-2 transition-colors hover:bg-white/12 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
        :aria-label="t('today.focus.stop')"
        @click="focus.stop()"
      >
        <UiIcon
          name="x"
          :size="13"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The Calendar's month: a cell a day, what is due in it as rose chips by
 * name, and its classes and study as one quiet count, so a crowded week shows
 * from far off. A day opens its week in the time grid.
 */
import { useCompanion } from '~/companion/store'
import { dayKey, dayLabel, daysBetween, durationLabel, mondayOf, shiftDay, weekdayName } from '~/companion/time'

const props = defineProps<{
  /** Any day of the month to show, `YYYY-MM-DD`. */
  month: string
}>()
const emit = defineEmits<{ pick: [day: string] }>()

const { t } = useI18n()
const c = useCompanion()
const today = dayKey()
const WEEKDAYS = computed(() => Array.from({ length: 7 }, (_, i) => weekdayName(i + 1)))

const cells = computed(() => {
  const first = `${props.month.slice(0, 7)}-01`
  const start = mondayOf(first)
  // Whole weeks until the month has ended: five rows most months, six some.
  const last = shiftDay(`${shiftDay(first, 31).slice(0, 7)}-01`, -1)
  const count = (Math.floor(daysBetween(start, last) / 7) + 1) * 7
  return Array.from({ length: count }, (_, i) => {
    const day = shiftDay(start, i)
    const due = c.deadlines.value.filter(
      (d) => d.due_at && d.status !== 'cancelled' && !d.deleted_at && dayKey(d.due_at) === day,
    )
    const classes = c.sessions.value.filter((s) => !s.cancelled && dayKey(s.starts_at) === day).length
    const study = c.planTasks.value.filter((t) => t.date === day).reduce((sum, t) => sum + t.minutes, 0)
    return { day, inMonth: day.slice(0, 7) === first.slice(0, 7), due, classes, study }
  })
})

function quiet(cell: { classes: number; study: number }): string {
  return [cell.classes ? t('calendar.classes', cell.classes) : '', cell.study ? t('calendar.month.study', { time: durationLabel(cell.study * 60) }) : '']
    .filter(Boolean)
    .join(' · ')
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="grid grid-cols-7 border-b border-border-rule">
      <span
        v-for="w in WEEKDAYS"
        :key="w"
        class="px-2 py-2 text-[12.5px] font-medium text-text-muted"
      >{{ w }}</span>
    </div>
    <ol class="om-scroll grid min-h-0 flex-1 auto-rows-[minmax(104px,1fr)] grid-cols-7 overflow-y-auto">
      <li
        v-for="cell in cells"
        :key="cell.day"
        class="border-b border-l border-border-rule [&:nth-child(7n+1)]:border-l-0"
      >
        <button
          type="button"
          class="grid h-full w-full min-w-0 cursor-pointer content-start gap-1 p-1.5 text-left transition-colors hover:bg-[rgb(var(--wash-rgb)/0.035)] focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none focus-visible:ring-inset"
          :class="!cell.inMonth && 'opacity-45'"
          :aria-label="t('calendar.month.openWeek', { day: dayLabel(cell.day) })"
          @click="emit('pick', cell.day)"
        >
          <span
            class="grid size-7 place-items-center rounded-full font-display text-[14px] font-semibold"
            :class="cell.day === today ? 'bg-accent text-on-accent' : 'text-text'"
          >{{ +cell.day.slice(8) }}</span>
          <span
            v-for="d in cell.due.slice(0, 2)"
            :key="d.id"
            class="flex h-5 min-w-0 items-center gap-1 rounded-[5px] bg-rose-soft px-1.5 text-[11.5px] font-semibold text-rose-ink"
            :title="d.title"
          >
            <CompanionIcon
              name="flag"
              :size="10"
              :stroke="2.2"
              class="shrink-0"
            />
            <span class="truncate">{{ d.title }}</span>
          </span>
          <span
            v-if="cell.due.length > 2"
            class="px-1 text-[11.5px] font-semibold text-rose-ink"
          >{{ t('calendar.month.moreDue', { n: cell.due.length - 2 }) }}</span>
          <span
            v-if="quiet(cell)"
            class="truncate px-1 text-[11.5px] text-text-muted"
          >{{ quiet(cell) }}</span>
        </button>
      </li>
    </ol>
  </div>
</template>

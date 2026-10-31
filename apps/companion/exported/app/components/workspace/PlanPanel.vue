<script setup lang="ts">
import type { ApiScheduleItem } from '~/composables/useSchedule'

/**
 * The Plan panel: the course laid over real dates.
 *
 * Missing days is the normal case, not the failure case — §11 names retention
 * as the risk that kills every tool in this category, and a calendar that
 * scolds you is a calendar you stop opening. So overdue rows are amber, not
 * red, and the recompaction gets a sentence explaining that nothing was lost.
 */
const props = defineProps<{
  courseId: number
  minutesPerWeek?: number | null
  nodeCount: number
  activeNodeId: number | null
}>()

const emit = defineEmits<{ open: [nodeId: number] }>()

const plan = useSchedule(() => props.courseId)
const { schedule, items, loading, slippage, thisWeek } = plan

/* -- Plan form (shown when no schedule exists yet) -------------------------- */

const editing = ref(false)

const form = reactive({
  starts_on: isoToday(),
  minutes_per_week:
    props.minutesPerWeek && props.minutesPerWeek >= 10 ? props.minutesPerWeek : 240,
  days_of_week: [1, 3, 5] as number[],
})

const formError = computed(() => {
  if (form.days_of_week.length === 0) return 'Pick at least one study day.'
  if (form.minutes_per_week < 10) return 'A study week needs at least 10 minutes in it.'
  return null
})

function toggleDay(day: number): void {
  form.days_of_week = form.days_of_week.includes(day)
    ? form.days_of_week.filter((value) => value !== day)
    : [...form.days_of_week, day].sort((a, b) => a - b)
}

async function save(): Promise<void> {
  if (formError.value) return
  if (await plan.savePlan({ ...form })) editing.value = false
}

/* -- Rows ------------------------------------------------------------------ */

type RowTone = 'done' | 'skipped' | 'overdue' | 'today' | 'pending'

interface Row {
  item: ApiScheduleItem
  tone: RowTone
  badge: string
}

const rows = computed<Row[]>(() => {
  const today = isoToday()

  return [...items.value]
    .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for) || a.id - b.id)
    .map((item) => {
      const late = dayDiff(item.scheduled_for, today)

      if (item.state === 'done') return { item, tone: 'done' as const, badge: 'Done' }
      if (item.state === 'skipped') return { item, tone: 'skipped' as const, badge: 'Skipped' }
      if (late > 0) {
        return {
          item,
          tone: 'overdue' as const,
          badge: `Moved forward · was ${late}d ago`,
        }
      }
      if (late === 0) {
        return { item, tone: 'today' as const, badge: `Today · ${item.estimated_minutes} min` }
      }
      return { item, tone: 'pending' as const, badge: `${item.estimated_minutes} min` }
    })
})

const TONE_TEXT: Record<RowTone, string> = {
  done: 'text-text-faint line-through',
  skipped: 'text-text-ghost line-through',
  overdue: 'text-text-dim',
  today: 'text-text font-medium',
  pending: 'text-text-dim',
}

const TONE_BADGE: Record<RowTone, string> = {
  done: 'text-accent-strong',
  skipped: 'text-text-ghost',
  overdue: 'text-warn-text',
  today: 'text-brand',
  pending: 'text-text-faint',
}

const TONE_DATE: Record<RowTone, string> = {
  done: 'text-text-ghost',
  skipped: 'text-text-ghost',
  overdue: 'text-warn-text',
  today: 'text-brand',
  pending: 'text-text',
}

onMounted(() => void plan.load())
watch(() => props.courseId, () => void plan.load())
</script>

<template>
  <div class="px-1.5 py-2.5">
    <div
      v-if="loading"
      class="flex flex-col gap-2"
    >
      <UiSkeleton
        v-for="i in 5"
        :key="i"
        h="2.2rem"
        rounded="md"
      />
    </div>

    <!-- Nothing scheduled yet -->
    <template v-else-if="!schedule">
      <div
        v-if="nodeCount === 0"
        class="rounded-[14px] bg-surface px-3.5 py-4 text-[12.5px] leading-relaxed text-text-soft shadow-[inset_0_0_0_1px_var(--border)]"
      >
        The plan appears once the structure exists.
      </div>

      <div
        v-else
        class="rounded-[16px] bg-surface p-3.5 shadow-[inset_0_0_0_1px_var(--border)]"
      >
        <p class="font-display text-[15px] font-semibold tracking-[-0.01em]">Put this on the calendar</p>
        <p class="mt-1 text-[12.5px] leading-relaxed text-text-soft">
          Pick a weekly budget and your study days. Miss one and the rest shifts forward.
        </p>

        <template v-if="editing">
          <label class="mt-3.5 block text-[11px] font-medium text-text-faint">Start</label>
          <input
            v-model="form.starts_on"
            type="date"
            class="mt-1 h-9 w-full rounded-[10px] border border-border-field bg-surface px-2.5 text-[12.5px] outline-none focus:border-lime-2 focus:shadow-[0_0_0_3px_rgb(198_242_78/0.35)]"
          />

          <label class="mt-3 block text-[11px] font-medium text-text-faint"
            >Minutes per week</label
          >
          <input
            v-model.number="form.minutes_per_week"
            type="number"
            min="10"
            step="15"
            class="num mt-1 h-9 w-full rounded-[10px] border border-border-field bg-surface px-2.5 text-[12.5px] outline-none focus:border-lime-2 focus:shadow-[0_0_0_3px_rgb(198_242_78/0.35)]"
          />

          <label class="mt-3 block text-[11px] font-medium text-text-faint">Study days</label>
          <div class="mt-1.5 flex gap-1">
            <button
              v-for="(label, index) in WEEKDAYS_MIN"
              :key="index"
              type="button"
              :class="[
                'size-[30px] cursor-pointer rounded-full text-[11.5px] font-semibold transition-colors',
                form.days_of_week.includes(index + 1)
                  ? 'bg-chip text-lime'
                  : 'text-text-faint shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.12)] hover:bg-surface-mute',
              ]"
              :aria-pressed="form.days_of_week.includes(index + 1)"
              @click="toggleDay(index + 1)"
            >
              {{ label }}
            </button>
          </div>

          <p
            v-if="formError"
            class="mt-2.5 text-[11.5px] text-danger"
          >
            {{ formError }}
          </p>

          <div class="mt-3 flex gap-1.5">
            <UiBtn
              variant="primary"
              size="sm"
              :loading="plan.saving.value"
              :disabled="!!formError"
              @click="save"
              >Build plan</UiBtn
            >
            <UiBtn
              variant="ghost"
              size="sm"
              @click="editing = false"
              >Cancel</UiBtn
            >
          </div>
        </template>

        <UiBtn
          v-else
          variant="secondary"
          size="sm"
          icon="calendar"
          class="mt-3"
          block
          @click="editing = true"
          >Set a schedule</UiBtn
        >
      </div>
    </template>

    <template v-else>
      <!-- Two numbers, both of which the learner can act on. -->
      <div class="mb-3 flex gap-2">
        <div class="flex-1 rounded-[14px] bg-surface px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--border)]">
          <p class="text-[11px] font-medium text-text-faint">This week</p>
          <p class="num mt-1 font-display text-[19px] font-semibold tracking-[-0.02em]">
            {{ hoursLabel(thisWeek.doneMinutes) }}<span
              class="text-[12px] font-normal text-text-faint"
              >/{{ hoursLabel(thisWeek.budgetMinutes) }}h</span
            >
          </p>
        </div>
        <div class="flex-1 rounded-[14px] bg-surface px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--border)]">
          <p class="text-[11px] font-medium text-text-faint">Sessions</p>
          <p class="num mt-1 font-display text-[19px] font-semibold tracking-[-0.02em]">
            {{ schedule.stats.done }}<span class="text-[12px] font-normal text-text-faint"
              >/{{ schedule.stats.total }}</span
            >
          </p>
        </div>
      </div>

      <div
        v-if="slippage"
        class="mb-3 rounded-[12px] bg-warn-soft px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--warn-line)]"
      >
        <p class="text-[12.5px] font-semibold text-warn-text">{{ slippage.title }}</p>
        <p class="mt-0.5 text-[12px] leading-snug text-warn-text-soft">{{ slippage.body }}</p>
      </div>

      <div
        v-for="row in rows"
        :key="row.item.id"
        class="flex gap-2.5 border-t border-border-rule px-1 py-2.5 first:border-t-0"
      >
        <div class="w-10 shrink-0 text-center">
          <p class="num text-[9.5px] font-semibold tracking-[0.04em] text-text-faint uppercase">
            {{ weekdayLabel(row.item.scheduled_for) }}
          </p>
          <p :class="['num font-display text-[15px] leading-tight font-semibold', TONE_DATE[row.tone]]">
            {{ dayOfMonth(row.item.scheduled_for) }}
          </p>
        </div>

        <div class="min-w-0 flex-1">
          <button
            type="button"
            :class="[
              'block w-full cursor-pointer truncate text-left text-[13px] leading-[1.3] hover:underline',
              TONE_TEXT[row.tone],
              row.item.node_id === activeNodeId && 'font-semibold text-text',
            ]"
            @click="emit('open', row.item.node_id)"
          >
            {{ row.item.node?.title ?? 'Session' }}
          </button>
          <p :class="['mt-0.5 text-[10.5px]', TONE_BADGE[row.tone]]">{{ row.badge }}</p>
        </div>

        <button
          v-if="row.item.state !== 'done'"
          type="button"
          class="mt-0.5 grid size-[22px] shrink-0 cursor-pointer place-items-center rounded-[7px] text-transparent shadow-[inset_0_0_0_1.5px_#cdd0d8] transition-colors hover:text-accent-strong hover:shadow-[inset_0_0_0_1.5px_var(--lime-2)]"
          :aria-label="`Mark ${row.item.node?.title ?? 'session'} done`"
          :disabled="plan.busyItem.value === row.item.id"
          @click="plan.setState(row.item, 'done')"
        >
          <UiIcon
            name="check"
            :size="12"
            :stroke="2.2"
          />
        </button>
        <span
          v-else
          class="mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-[7px] bg-lime text-ink"
        >
          <UiIcon
            name="check"
            :size="12"
            :stroke="2.2"
          />
        </span>
      </div>
    </template>
  </div>
</template>

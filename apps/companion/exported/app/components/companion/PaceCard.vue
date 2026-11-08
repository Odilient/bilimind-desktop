<script setup lang="ts">
/**
 * Pace, not guilt: when a self-study course slips it says so
 * once, plainly, with the two fixes — another session a week, or a later
 * finish line. One tap either way and the plan redraws.
 */
import type { Goal, Slot, Subject, Today } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { dayKey, dayMonthLong, shiftDay, weekdayLong } from '~/companion/time'

const props = withDefaults(
  defineProps<{
    goal: Goal
    subject: Subject
    pace: Today['pace'][number] | null
    compact?: boolean
    /** The row above already says how far behind (Today's goals block). */
    hideStatus?: boolean
  }>(),
  { compact: false, hideStatus: false },
)
const { t } = useI18n()
const c = useCompanion()
const toast = useToast()
const busy = ref<'slot' | 'date' | null>(null)

const finish = computed(() => (props.goal.ends_on ? dayMonthLong(props.goal.ends_on) : t('today.pace.theFinish')))
const later = computed(() =>
  props.goal.ends_on ? shiftDay(props.goal.ends_on, 7 * Math.max(1, props.pace?.weeks_behind ?? 1) * 2) : null,
)

/** The free evening: the first weekday without a study slot for this course. */
const freeDay = computed(() => {
  const taken = new Set(c.slots.value.filter((s) => s.subject_id === props.subject.id).map((s) => s.weekday))
  return ([7, 2, 5, 6, 3, 4, 1] as Slot['weekday'][]).find((d) => !taken.has(d)) ?? 7
})
const template = computed(() => c.slots.value.find((s) => s.subject_id === props.subject.id))

async function addSession(): Promise<void> {
  busy.value = 'slot'
  try {
    await c.upsert<Slot>('slots', {
      id: crypto.randomUUID(),
      subject_id: props.subject.id,
      kind: 'study',
      weekday: freeDay.value,
      starts_at: template.value?.starts_at ?? '20:00',
      ends_at: template.value?.ends_at ?? '20:25',
      location: null,
      valid_from: dayKey(),
      valid_until: props.goal.ends_on,
      source_ref: null,
    })
    await c.sync()
    await c.loadToday()
    toast.success({ title: t('today.pace.added', { day: weekdayLong(freeDay.value) }), body: t('today.pace.redrawn') })
  } finally {
    busy.value = null
  }
}

async function moveDate(): Promise<void> {
  if (!later.value) return
  busy.value = 'date'
  try {
    await c.upsert<Goal>('goals', { id: props.goal.id, ends_on: later.value })
    await c.sync()
    await c.loadToday()
    toast.success({ title: t('today.pace.moved', { date: dayMonthLong(later.value) }), body: t('today.pace.moreTime') })
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <section
    v-if="pace && pace.status === 'behind'"
    class="grid gap-2.5 rounded-[16px] bg-surface-mute px-4 py-3.5"
  >
    <p class="text-[14.5px] leading-snug text-text-body">
      <template v-if="compact">
        <b class="font-semibold text-text">{{ subject.title }}:</b>
        {{ t('today.pace.behindFor', { n: pace.weeks_behind, finish }, pace.weeks_behind) }}
      </template>
      <template v-else-if="!hideStatus">
        <b class="font-semibold text-text">{{ t('today.pace.behindForCap', { n: pace.weeks_behind, finish }, pace.weeks_behind) }}</b>
      </template>
      {{ t('today.pace.rate', { actual: pace.sessions_per_week_actual, needed: pace.sessions_per_week_needed }) }}
    </p>
    <div class="flex flex-wrap gap-2">
      <UiBtn
        variant="primary"
        size="sm"
        :loading="busy === 'slot'"
        :disabled="busy !== null"
        @click="addSession"
      >
        {{ t('today.pace.addDay', { day: weekdayLong(freeDay) }) }}
      </UiBtn>
      <UiBtn
        variant="secondary"
        size="sm"
        :loading="busy === 'date'"
        :disabled="busy !== null || !later"
        @click="moveDate"
      >
        {{ t('today.pace.moveTo', { date: later ? dayMonthLong(later) : t('today.pace.later') }) }}
      </UiBtn>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * What a click in the Calendar's grid opens: a small card beside the block
 * with what it is and the two or three things to do with it, so reading the
 * week never means leaving it. A class opens in its course; a deadline opens
 * its page or is ticked; a study block or task opens what it's for, is
 * ticked, goes to tomorrow, or gets (or loses) a time. An empty hour opens
 * the quick add, a task of your own at that time (the Tasks page's `addTask`).
 *
 * Beside its anchor on a desk, a card along the bottom on a phone. Escape, a
 * click elsewhere or a scroll of the grid closes it.
 */
import type { Deadline, PlanTask, Uuid } from '~/companion/types'
import { clockOfMinute, type CalendarTarget } from '~/companion/calendar-grid'
import { useCompanion } from '~/companion/store'
import { courseColor } from '~/companion/colors'
import { readyWords } from '~/companion/words'
import { addTask, tickedStatus } from '~/companion/tasks'
import { classHref, taskHref } from '~/companion/today-layout'
import { clock, dayKey, daysBetween, durationLabel, longDayLabel, nowIso, shiftDay, whenLabel } from '~/companion/time'

const props = defineProps<{ target: CalendarTarget; at: DOMRect }>()
const emit = defineEmits<{ close: []; move: [task: PlanTask, day: string, time?: string | null] }>()

const { t: tr } = useI18n()
const c = useCompanion()
const toast = useToast()
const today = dayKey()

const card = ref<HTMLElement | null>(null)
const place = ref<Record<string, string>>({ visibility: 'hidden' })

/** Right of the anchor when it fits, else left; kept inside the window. */
function measure(): void {
  const el = card.value
  if (!el) return
  if (window.innerWidth < 640) {
    place.value = {}
    return
  }
  const { width, height } = el.getBoundingClientRect()
  const a = props.at
  const left = a.right + 8 + width <= window.innerWidth - 8 ? a.right + 8 : Math.max(8, a.left - 8 - width)
  const top = Math.min(Math.max(8, a.top), window.innerHeight - height - 8)
  place.value = { left: `${left}px`, top: `${top}px` }
}
const field = ref<HTMLInputElement | null>(null)
watch(
  () => [props.target, props.at],
  () =>
    nextTick(() => {
      measure()
      if (props.target.kind === 'add') field.value?.focus({ preventScroll: true })
    }),
  { immediate: true },
)

function onKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}
function onPointer(event: PointerEvent): void {
  if (card.value && !card.value.contains(event.target as Node)) emit('close')
}
function onScroll(event: Event): void {
  if (card.value && !card.value.contains(event.target as Node)) emit('close')
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  // Capture, so the grid's own click on another block opens that one after this closes.
  window.addEventListener('pointerdown', onPointer, true)
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('pointerdown', onPointer, true)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', measure)
})

/* -- What it is ------------------------------------------------------------ */

const course = computed(() => {
  const t = props.target
  if (t.kind === 'class') return c.subjectOf(t.session)
  if (t.kind === 'due') return c.subjectOf(t.deadline)
  if (t.kind === 'task') return c.subjectOf(t.task)
  return null
})

const title = computed(() => {
  const t = props.target
  if (t.kind === 'class') return t.session.title
  if (t.kind === 'due') return t.deadline.title
  if (t.kind === 'task') return t.task.title
  return tr('calendar.peek.newTask')
})

const lines = computed<string[]>(() => {
  const t = props.target
  if (t.kind === 'class') {
    const s = t.session
    return [
      `${longDayLabel(dayKey(s.starts_at))} · ${clock(s.starts_at)}–${clock(s.ends_at)}`,
      s.location ?? '',
      s.cancelled ? tr('calendar.peek.cancelled') : '',
    ].filter(Boolean)
  }
  if (t.kind === 'due') {
    const d = t.deadline
    const r = c.readinessOf(d)
    return [
      tr('calendar.peek.due', { when: whenLabel(d.due_at!, d.all_day) }),
      d.weight_pct ? tr('calendar.peek.ofGrade', { n: d.weight_pct }) : '',
      d.tentative ? tr('calendar.peek.unconfirmed') : readyWords(r.checked ? r.percent : null),
    ].filter(Boolean)
  }
  if (t.kind === 'task') {
    const k = t.task
    return [
      [k.date ? longDayLabel(k.date) : '', k.starts_at ?? '', durationLabel(k.minutes * 60)].filter(Boolean).join(' · '),
      k.detail ?? '',
    ].filter(Boolean)
  }
  return [[longDayLabel(t.day), t.minute === null ? '' : clockOfMinute(t.minute)].filter(Boolean).join(' · ')]
})

/* -- What to do with it ---------------------------------------------------- */

const open = computed<string | null>(() => {
  const t = props.target
  if (t.kind === 'class') return classHref(t.session)
  if (t.kind === 'due') return `/app/d/${t.deadline.id}`
  if (t.kind === 'task') return taskHref(t.task, c)
  return null
})

const done = computed(() => {
  const t = props.target
  if (t.kind === 'task') return Boolean(t.task.done_at)
  if (t.kind === 'due') return t.deadline.status === 'done' || t.deadline.status === 'submitted'
  return false
})

const tickLabel = computed(() => {
  const t = props.target
  if (t.kind === 'due') {
    const handIn = tickedStatus(t.deadline) === 'submitted'
    return tr(done.value ? (handIn ? 'calendar.peek.notHandedIn' : 'calendar.peek.notDone') : handIn ? 'calendar.peek.markHandedIn' : 'calendar.peek.markDone')
  }
  return tr(done.value ? 'calendar.peek.notDone' : 'calendar.peek.markDone')
})

async function tick(): Promise<void> {
  const t = props.target
  emit('close')
  try {
    if (t.kind === 'task') {
      const was = t.task.done_at
      await c.upsert<PlanTask>('plan-tasks', { id: t.task.id, done_at: was ? null : nowIso() })
      if (!was) {
        toast.success({
          title: tr('calendar.peek.doneToast', { title: t.task.title }),
          action: { label: tr('calendar.undo'), handler: () => void c.upsert<PlanTask>('plan-tasks', { id: t.task.id, done_at: null }).catch(() => undefined) },
        })
      }
    } else if (t.kind === 'due') {
      const was = t.deadline.status
      await c.upsert<Deadline>('deadlines', { id: t.deadline.id, status: done.value ? 'upcoming' : tickedStatus(t.deadline) })
      if (!done.value) {
        toast.success({
          title: tr(tickedStatus(t.deadline) === 'submitted' ? 'calendar.peek.handedInToast' : 'calendar.peek.doneToast', { title: t.deadline.title }),
          action: { label: tr('calendar.undo'), handler: () => void c.upsert<Deadline>('deadlines', { id: t.deadline.id, status: was }).catch(() => undefined) },
        })
      }
    }
  } catch {
    // The store has said it couldn't be saved.
  }
}

/** Tomorrow, for a block not done whose day hasn't gone; from a day gone, today. */
const tomorrow = computed(() => {
  const t = props.target
  if (t.kind !== 'task' || t.task.done_at) return null
  const from = t.task.date && daysBetween(today, t.task.date) >= 0 ? t.task.date : shiftDay(today, -1)
  return shiftDay(from, 1)
})

function moveOn(): void {
  const t = props.target
  if (t.kind !== 'task' || !tomorrow.value) return
  emit('close')
  emit('move', t.task, tomorrow.value)
}

/* -- A time on its day ------------------------------------------------------ */

/** A task not done on a day still to come can be given an hour, or lose it. */
const timeable = computed(() => {
  const t = props.target
  return t.kind === 'task' && !t.task.done_at && Boolean(t.task.date) && daysBetween(today, t.task.date!) >= 0
})
const timing = ref(false)
const time = ref('')
watch(() => props.target, () => {
  timing.value = false
})

function startTiming(): void {
  time.value = '09:00'
  timing.value = true
}

function setTime(value: string | null): void {
  const t = props.target
  if (t.kind !== 'task' || !t.task.date) return
  emit('close')
  emit('move', t.task, t.task.date, value)
}

/* -- Adding ---------------------------------------------------------------- */

const text = ref('')
const subjectId = ref<Uuid | null>(null)
const busy = ref(false)

async function add(): Promise<void> {
  const t = props.target
  if (t.kind !== 'add' || !text.value.trim() || busy.value) return
  busy.value = true
  try {
    const at = t.minute === null ? null : clockOfMinute(t.minute)
    const made = await addTask(c, { text: text.value, subject_id: subjectId.value, date: t.day, starts_at: at })
    if (made) toast.success(at ? tr('calendar.peek.addedAt', { day: longDayLabel(t.day), time: at }) : tr('calendar.peek.added', { day: longDayLabel(t.day) }))
    emit('close')
  } catch {
    // The store has said why; the words stay in the field.
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      ref="card"
      role="dialog"
      :aria-label="title"
      class="fixed z-100 grid grid-cols-[minmax(0,1fr)] gap-3 rounded-[14px] bg-surface p-4 shadow-[0_0_0_1px_var(--border-strong),var(--shadow-pop)] max-[639px]:inset-x-2 max-[639px]:bottom-[max(8px,env(safe-area-inset-bottom))] min-[640px]:w-[300px]"
      :style="place"
    >
      <div class="flex items-start gap-2">
        <div class="grid min-w-0 flex-1 gap-1">
          <p
            v-if="course"
            class="flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium text-text-muted"
          >
            <span
              class="size-2 shrink-0 rounded-full"
              :style="{ background: courseColor(course.color) }"
            />
            <span class="truncate">{{ course.title }}</span>
          </p>
          <h3
            class="font-display text-[17px] leading-snug font-semibold tracking-[-0.02em] text-text"
            :class="done && 'line-through decoration-text-faint'"
          >
            {{ title }}
          </h3>
        </div>
        <button
          type="button"
          class="-mt-1 -mr-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-text-faint hover:bg-[rgb(var(--wash-rgb)/0.06)] hover:text-text"
          :aria-label="tr('calendar.close')"
          @click="emit('close')"
        >
          <UiIcon
            name="x"
            :size="15"
          />
        </button>
      </div>

      <ul class="grid gap-0.5 text-[13.5px] leading-snug text-text-soft">
        <li
          v-for="line in lines"
          :key="line"
        >
          {{ line }}
        </li>
      </ul>

      <form
        v-if="target.kind === 'add'"
        class="grid grid-cols-[minmax(0,1fr)] gap-2"
        @submit.prevent="add"
      >
        <input
          ref="field"
          v-model="text"
          type="text"
          maxlength="300"
          :placeholder="tr('calendar.peek.placeholder')"
          :aria-label="tr('calendar.peek.whatToDo')"
          class="h-10 min-w-0 rounded-[10px] bg-surface-sunken px-3 text-[14.5px] text-text outline-none placeholder:text-text-faint focus:shadow-[inset_0_0_0_2px_var(--brand)]"
        >
        <div class="flex items-center gap-2">
          <CompanionTasksCourseSelect
            v-model="subjectId"
            class="min-w-0 flex-1"
          />
          <UiBtn
            type="submit"
            variant="primary"
            :disabled="!text.trim()"
            :loading="busy"
          >
            {{ tr('calendar.add') }}
          </UiBtn>
        </div>
      </form>

      <div
        v-else
        class="flex flex-wrap items-center gap-2"
      >
        <UiBtn
          v-if="open"
          :to="open"
          variant="primary"
          size="sm"
          trailing-icon="arrow-right"
          @click="emit('close')"
        >
          {{ tr('calendar.open') }}
        </UiBtn>
        <UiBtn
          v-if="target.kind === 'task' || target.kind === 'due'"
          variant="secondary"
          size="sm"
          :icon="done ? undefined : 'check'"
          @click="tick"
        >
          {{ tickLabel }}
        </UiBtn>
        <UiBtn
          v-if="tomorrow"
          variant="ghost"
          size="sm"
          @click="moveOn"
        >
          {{ tr(tomorrow === today ? 'calendar.peek.moveToday' : tomorrow === shiftDay(today, 1) ? 'calendar.peek.moveTomorrow' : 'calendar.peek.dayLater') }}
        </UiBtn>
        <template v-if="timeable && !timing">
          <UiBtn
            v-if="target.kind === 'task' && target.task.starts_at"
            variant="ghost"
            size="sm"
            @click="setTime(null)"
          >
            {{ tr('calendar.peek.clearTime') }}
          </UiBtn>
          <UiBtn
            v-else
            variant="ghost"
            size="sm"
            icon="clock"
            @click="startTiming"
          >
            {{ tr('calendar.peek.setTime') }}
          </UiBtn>
        </template>
      </div>

      <form
        v-if="timing"
        class="flex items-center gap-2"
        @submit.prevent="time && setTime(time.slice(0, 5))"
      >
        <input
          v-model="time"
          type="time"
          step="900"
          required
          :aria-label="tr('calendar.peek.time')"
          class="h-9 min-w-0 flex-1 rounded-[10px] bg-surface-sunken px-3 text-[14.5px] text-text tabular-nums outline-none focus:shadow-[inset_0_0_0_2px_var(--brand)]"
        >
        <UiBtn
          type="submit"
          variant="primary"
          size="sm"
          :disabled="!time"
        >
          {{ tr('calendar.peek.set') }}
        </UiBtn>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * The semester at a glance, under the week on the Calendar: one quiet strip
 * of weeks 1 to 14 and the two exam weeks, each saying how many things are
 * due in it. This week's number sits in a cobalt dot, as today's date does
 * in the week above; the week shown above is tinted; a tap opens that week. Self-study checkpoints count too, because a student
 * learning Italian has one calendar, not two.
 *
 * It used to be the loudest thing on the screen, a cobalt panel of tiny
 * columns with chips, load bars, a colour legend and a key for dashed edges;
 * nobody could read it at a glance. The numbers are what it was for. The
 * titles are still in each week's label for a screen reader, and on hover.
 *
 * On a phone it scrolls sideways inside itself, opening on this week, rather
 * than squeezing sixteen weeks into 390 pixels.
 */
import type { Deadline } from '~/companion/types'
import { useCompanion } from '~/companion/store'

const props = withDefaults(defineProps<{ shown?: number | null }>(), { shown: null })
const emit = defineEmits<{ pick: [week: number] }>()
const c = useCompanion()

interface Cell {
  n: number
  label: string
  name: string
  marks: Deadline[]
}

const cells = computed<Cell[]>(() => {
  const out: Cell[] = Array.from({ length: 16 }, (_, i) => ({
    n: i + 1,
    label: i < 14 ? String(i + 1) : `Exams ${i - 13}`,
    name: i < 14 ? `Week ${i + 1}` : `Exam week ${i - 13}`,
    marks: [],
  }))
  for (const d of c.deadlines.value) {
    if (!d.due_at || d.status === 'cancelled') continue
    const n = c.weekOf(d.due_at)
    if (n && out[n - 1]) out[n - 1]!.marks.push(d)
  }
  return out
})

const week = computed(() => c.currentWeek.value)
const strip = ref<HTMLElement | null>(null)

onMounted(() => {
  // Open with this week in view when the strip is narrower than its weeks.
  const el = strip.value?.querySelector('[data-now]') as HTMLElement | null
  if (el && strip.value) strip.value.scrollLeft = Math.max(0, el.offsetLeft - 64)
})

function label(cell: Cell): string {
  const what = cell.marks.length ? cell.marks.map((m) => m.title).join(', ') : 'nothing due'
  return `${cell.name}${cell.n === week.value ? ', this week' : ''}: ${what}`
}
</script>

<template>
  <div
    ref="strip"
    class="om-tabs overflow-x-auto rounded-[16px] border border-border"
  >
    <ol
      class="grid min-w-[880px] grid-cols-[repeat(14,minmax(52px,1fr))_repeat(2,minmax(76px,1.3fr))] divide-x divide-border-rule"
      aria-label="The semester, week by week"
    >
      <li
        v-for="cell in cells"
        :key="cell.n"
        :data-now="cell.n === week ? '' : undefined"
      >
        <button
          type="button"
          class="grid h-full min-h-[68px] w-full content-center justify-items-center gap-0.5 px-1 py-2.5 text-center transition-colors"
          :class="cell.n === props.shown ? 'bg-cobalt-soft' : 'hover:bg-surface-mute'"
          :aria-label="label(cell)"
          :aria-current="cell.n === props.shown ? 'true' : undefined"
          :title="cell.marks.map((m) => m.title).join(', ') || undefined"
          @click="emit('pick', cell.n)"
        >
          <span
            class="grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-[15px] leading-none font-semibold whitespace-nowrap"
            :class="cell.n === week ? 'bg-cobalt text-white dark:bg-brand-strong' : cell.n === props.shown ? 'text-cobalt' : 'text-text'"
          >{{ cell.label }}</span>
          <span
            class="text-[13px] leading-tight whitespace-nowrap"
            :class="cell.marks.length >= 3 ? 'font-semibold text-text' : 'text-text-muted'"
          >{{ cell.marks.length ? `${cell.marks.length} due` : '–' }}</span>
        </button>
      </li>
    </ol>
  </div>
</template>

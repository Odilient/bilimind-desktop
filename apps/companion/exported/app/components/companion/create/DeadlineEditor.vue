<script setup lang="ts">
/**
 * The deadlines the material gave up, each an editable row: what it is
 * called, what kind it is (the word decides its icon and how Today weighs
 * it), and its date. Wrong ones go with the ×; a missing one is one click.
 * They become real deadlines in the calendar the moment the course is made,
 * set by the learner (`confidence: own`), so nothing asks about them again.
 * Where the server says what it read the date in (`evidence`), the row
 * quotes it, so "Midterm, 3 December" can be checked against its source.
 *
 * A row is one line on a computer; on a phone the name takes the first line
 * and kind, date and × share the second.
 */
import type { ProposalDeadline } from '~/companion/create'
import { deadlineKind, dueIso } from '~/companion/create'
import { KIND_WORD } from '~/companion/words'
import { dayKey, daysBetween, dayMonthLong } from '~/companion/time'

defineProps<{ disabled?: boolean }>()
const deadlines = defineModel<ProposalDeadline[]>({ required: true })

const root = ref<HTMLElement | null>(null)
const KINDS = Object.entries(KIND_WORD) as [keyof typeof KIND_WORD, string][]

function dateOf(d: ProposalDeadline): string {
  return d.due_at ? d.due_at.slice(0, 10) : ''
}

/** A new date keeps the time and offset it had; a dateless one gets the end of that day. */
function setDate(d: ProposalDeadline, value: string): void {
  if (!value) d.due_at = null
  else d.due_at = d.due_at ? `${value}${d.due_at.slice(10)}` : dueIso(value)
}

function when(d: ProposalDeadline): string {
  if (!d.due_at) return 'No date yet'
  const days = daysBetween(dayKey(), d.due_at.slice(0, 10))
  if (days < 0) return 'Already passed'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 14) return `In ${days} days`
  return `In ${Math.round(days / 7)} weeks`
}

function add(): void {
  deadlines.value.push({ title: '', kind: 'assignment', due_at: null, weight_pct: null })
  void nextTick(() => {
    root.value?.querySelector<HTMLInputElement>(`[data-deadline="${deadlines.value.length - 1}"]`)?.focus()
  })
}

function remove(i: number): void {
  deadlines.value.splice(i, 1)
}

const keys = new WeakMap<object, number>()
let nextKey = 0
function keyOf(row: object): number {
  if (!keys.has(row)) keys.set(row, nextKey++)
  return keys.get(row)!
}

const FIELD =
  'h-10 min-w-0 rounded-[10px] border border-transparent bg-transparent px-2 text-[14.5px] text-text outline-none transition-colors duration-150 hover:border-border focus:border-cobalt focus:ring-3 focus:ring-brand-line disabled:hover:border-transparent'
</script>

<template>
  <div
    ref="root"
    class="grid gap-2"
  >
    <ul
      v-if="deadlines.length"
      class="divide-y divide-border-rule rounded-[18px] border border-border bg-surface"
    >
      <li
        v-for="(d, i) in deadlines"
        :key="keyOf(d)"
        class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-1.5 gap-y-1 px-2 py-2 min-[700px]:grid-cols-[minmax(0,1fr)_150px_158px_auto]"
      >
        <div class="col-span-2 grid min-w-0 min-[700px]:col-span-1">
          <label
            :for="`cp-dl-${i}`"
            class="sr-only"
          >Deadline name</label>
          <input
            :id="`cp-dl-${i}`"
            v-model="d.title"
            :data-deadline="i"
            :disabled="disabled"
            type="text"
            placeholder="What is due"
            :class="[FIELD, 'font-medium']"
          >
          <span
            class="truncate px-2 text-[12.5px] text-text-muted"
            :title="d.evidence ? `Found in: ${d.evidence}` : undefined"
          >
            {{ when(d) }}<template v-if="d.due_at"> · {{ dayMonthLong(d.due_at.slice(0, 10)) }}</template><template v-if="d.weight_pct">
              · {{ d.weight_pct }}% of the grade
            </template><template v-if="d.evidence">
              · “{{ d.evidence }}”
            </template>
          </span>
        </div>
        <label
          :for="`cp-dl-kind-${i}`"
          class="sr-only"
        >Kind</label>
        <select
          :id="`cp-dl-kind-${i}`"
          :value="deadlineKind(d.kind)"
          :disabled="disabled"
          :class="[FIELD, 'cursor-pointer pr-1 text-text-body']"
          @change="d.kind = ($event.target as HTMLSelectElement).value"
        >
          <option
            v-for="[value, word] in KINDS"
            :key="value"
            :value="value"
          >
            {{ word }}
          </option>
        </select>
        <label
          :for="`cp-dl-date-${i}`"
          class="sr-only"
        >Date</label>
        <input
          :id="`cp-dl-date-${i}`"
          :value="dateOf(d)"
          :disabled="disabled"
          type="date"
          :class="[FIELD, 'col-span-2 text-text-body tabular-nums min-[700px]:col-span-1']"
          @change="setDate(d, ($event.target as HTMLInputElement).value)"
        >
        <button
          type="button"
          class="grid size-10 cursor-pointer place-items-center rounded-full text-text-faint transition-colors duration-150 outline-none hover:bg-[rgb(11_13_16/0.06)] hover:text-text focus-visible:ring-2 focus-visible:ring-brand-line disabled:pointer-events-none max-[699px]:col-start-3 max-[699px]:row-start-1"
          :disabled="disabled"
          :aria-label="`Remove ${d.title || 'this deadline'}`"
          title="Remove"
          @click="remove(i)"
        >
          <UiIcon
            name="x"
            :size="14"
          />
        </button>
      </li>
    </ul>
    <p
      v-else
      class="rounded-[18px] border border-dashed border-border-dashed px-4 py-4 text-[14.5px] text-text-muted"
    >
      Nothing with a date in it. Add the ones you know, or add a syllabus later and BiliMind finds them.
    </p>
    <div>
      <button
        type="button"
        class="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full pr-4 pl-2.5 text-[14.5px] font-semibold text-cobalt transition-colors duration-150 outline-none hover:bg-cobalt-soft focus-visible:ring-2 focus-visible:ring-brand-line disabled:pointer-events-none disabled:opacity-50"
        :disabled="disabled"
        @click="add"
      >
        <UiIcon
          name="plus"
          :size="16"
        />
        Add a deadline
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CourseNode } from '~/types/api'

/**
 * Choosing what to expand.
 *
 * This is the commercial hinge of the product (§4: be generous with the cheap
 * stage, gate the expensive one) and it asks something genuinely hard — pick a
 * sensible subset out of twenty lessons. Three things make that possible:
 *
 *  1. Selecting a lesson offers the empty lessons ABOVE it on the path, because
 *     a course you enter halfway is a course you cannot follow.
 *  2. The cost of the selection is stated in minutes of waiting, up front.
 *  3. There are one-click answers for the shape almost everyone wants: the next
 *     few lessons in order.
 *
 * Detours are listed under the step they hang off and never counted as missing —
 * skipping one is the whole point of it being a detour.
 */
const props = defineProps<{
  open: boolean
  nodes: CourseNode[]
  /** Pre-tick these when the dialog opens. */
  initial?: number[]
  /**
   * With no `initial`, pre-tick this many from the top of the path. The
   * hand-off from a brand-new plan uses it: a first-time learner facing twenty
   * empty checkboxes and a greyed-out button has to invent the answer most
   * people want anyway, so it is offered instead — one click to accept.
   */
  suggest?: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  expand: [nodeIds: number[]]
}>()

const allowance = useAllowance()

onMounted(() => {
  void allowance.ensure()
})

const selected = ref<Set<number>>(new Set())

/** The whole course in reading order, so "the next 3" means the next 3. */
const reading = computed(() => courseTree(props.nodes).flat.map((entry) => entry.node))

const expandable = computed(() =>
  reading.value.filter((node) => node.status === 'stub' || node.status === 'failed'),
)

const expandableIds = computed(() => new Set(expandable.value.map((node) => node.id)))

/** Position on the path, used to answer "what comes before this". */
const rank = computed(() => new Map(reading.value.map((node, index) => [node.id, index])))

watch(
  () => props.open,
  (open) => {
    if (!open) return
    if (props.initial?.length || !props.suggest) {
      selected.value = new Set(props.initial ?? [])
      return
    }
    // Never suggest more than the plan has left to spend this month.
    const left = allowance.lessons.value?.remaining
    selectNext(typeof left === 'number' ? Math.max(0, Math.min(props.suggest, left)) : props.suggest)
  },
  { immediate: true },
)

function toggle(nodeId: number): void {
  const next = new Set(selected.value)
  if (next.has(nodeId)) next.delete(nodeId)
  else next.add(nodeId)
  selected.value = next
}

/* -- What a partial selection leaves broken -------------------------------- */

/**
 * Lessons on the path above the deepest selection that are still empty and not
 * themselves selected. This is the "what does this leave broken" answer: writing
 * step 7 while step 2 is blank is a lesson the learner cannot follow.
 *
 * Detours are excluded on both sides — one being empty breaks nothing.
 */
const missing = computed<CourseNode[]>(() => {
  let deepest = -1
  for (const id of selected.value) deepest = Math.max(deepest, rank.value.get(id) ?? -1)
  if (deepest < 0) return []

  return expandable.value.filter(
    (node) =>
      (node.track ?? 'core') === 'core' &&
      (rank.value.get(node.id) ?? 0) < deepest &&
      !selected.value.has(node.id),
  )
})

function addMissing(): void {
  const next = new Set(selected.value)
  for (const node of missing.value) next.add(node.id)
  selected.value = next
}

/* -- Presets --------------------------------------------------------------- */

function selectAll(): void {
  selected.value = new Set(expandable.value.map((node) => node.id))
}

function selectNone(): void {
  selected.value = new Set()
}

/** The next few in dependency order — the default answer for most people. */
function selectNext(count: number): void {
  selected.value = new Set(expandable.value.slice(0, count).map((node) => node.id))
}

/* -- Cost of the selection ------------------------------------------------- */

const chosen = computed(() => expandable.value.filter((node) => selected.value.has(node.id)))

const estimate = computed(() => {
  const count = chosen.value.length
  return {
    count,
    studyMinutes: chosen.value.reduce((sum, node) => sum + node.estimated_minutes, 0),
    /** Written `PACE.writers` at a time, each about `PACE.lessonSeconds` (measured). */
    writeSeconds: writingEstimate(count),
  }
})

/* -- What is left to spend -------------------------------------------------- */

/**
 * The allowance line, and the rule for when it appears at all.
 *
 * It is SILENT above a fifth remaining. A counter pinned to this dialog every
 * time it opens is what turns picking a lesson into a purchase decision — the
 * documented failure of every metered AI product, where people stop asking the
 * question they came to ask in order to save the balance. That is fatal in a
 * learning tool: the moment somebody skips a lesson because they are not sure
 * it is worth the count is the moment the product stops working.
 *
 * It is LOUD when the selection genuinely will not fit, because finding that out
 * as a 402 after pressing the button is worse than being told here.
 */
const lessonsLeft = computed(() => allowance.lessons.value?.remaining ?? null)

const overAllowance = computed(
  () => lessonsLeft.value !== null && estimate.value.count > lessonsLeft.value,
)

const showAllowance = computed(
  () => allowance.low(allowance.lessons.value) || overAllowance.value,
)

function submit(): void {
  if (estimate.value.count === 0) return
  emit('expand', [...selected.value])
  emit('update:open', false)
}

/**
 * A selection bigger than what is left would only come back as a 402. The
 * button offers what CAN be done instead — the first lessons of the selection,
 * in path order, up to the allowance — and at zero it points at the plans.
 */
const fitsAllowance = computed(() => !overAllowance.value)

function submitWhatFits(): void {
  const left = lessonsLeft.value ?? 0
  if (left <= 0) return
  selected.value = new Set(chosen.value.slice(0, left).map((node) => node.id))
  submit()
}
</script>

<template>
  <UiModal
    :open="open"
    title="Which lessons should BiliMind write?"
    description="Planning the course was free. Writing a lesson takes a couple of minutes each, so you choose which ones are worth it."
    size="lg"
    @update:open="emit('update:open', $event)"
  >
    <div
      v-if="expandable.length === 0"
      class="py-6 text-center text-[13.5px] text-text-muted"
    >
      Every lesson in this course has already been written.
    </div>

    <template v-else>
      <div class="mb-3 flex flex-wrap items-center gap-1.5">
        <UiBtn
          variant="secondary"
          size="xs"
          @click="selectNext(3)"
          >Next 3</UiBtn
        >
        <UiBtn
          variant="secondary"
          size="xs"
          @click="selectNext(6)"
          >Next 6</UiBtn
        >
        <UiBtn
          variant="secondary"
          size="xs"
          @click="selectAll"
          >All {{ expandable.length }}</UiBtn
        >
        <span class="flex-1" />
        <UiBtn
          variant="ghost"
          size="xs"
          @click="selectNone"
          >Clear</UiBtn
        >
      </div>

      <div class="om-scroll max-h-[42vh] overflow-y-auto rounded-[16px] bg-surface p-1 shadow-[inset_0_0_0_1px_var(--border)]">
        <label
          v-for="node in expandable"
          :key="node.id"
          :class="[
            'flex cursor-pointer items-start gap-3 border-b border-border-rule py-2.5 pr-3.5 transition-colors last:border-b-0',
            (node.track ?? 'core') === 'core' ? 'pl-3.5' : 'pl-8',
            selected.has(node.id) ? 'bg-accent-soft' : 'hover:bg-surface-mute',
          ]"
        >
          <input
            type="checkbox"
            class="mt-0.5 size-4 shrink-0 accent-[var(--ink)]"
            :checked="selected.has(node.id)"
            @change="toggle(node.id)"
          />

          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2">
              <span
                :class="[
                  'text-[13.5px] leading-snug',
                  selected.has(node.id) ? 'font-semibold text-text' : 'text-text-body',
                ]"
                >{{ node.title }}</span
              >
              <span
                v-if="lessonMark(node)"
                class="size-[11px] shrink-0 rounded-full"
                :style="{ background: MARK_META[lessonMark(node)!].color }"
                :title="MARK_META[lessonMark(node)!].label"
              />
              <span
                v-if="node.status === 'failed'"
                class="shrink-0 rounded-full bg-danger-soft px-1.5 py-px text-[10px] font-medium text-danger"
                >retry</span
              >
            </span>
            <span
              v-if="node.summary"
              class="mt-0.5 block text-[12px] leading-snug text-text-faint"
              >{{ node.summary }}</span
            >
          </span>

          <span class="num shrink-0 pt-0.5 text-[11px] text-text-ghost"
            >{{ node.estimated_minutes }}m</span
          >
        </label>
      </div>

      <!-- The honest warning about a partial selection. -->
      <div
        v-if="missing.length"
        class="mt-3 rounded-[14px] bg-warn-soft px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--warn-line)]"
      >
        <p class="text-[12.5px] font-semibold text-warn-text">
          {{
            missing.length === 1
              ? 'An earlier lesson on the path stays empty'
              : `${missing.length} earlier lessons on the path stay empty`
          }}
        </p>
        <p class="mt-1 text-[12px] leading-relaxed text-warn-text-soft">
          You can still study what you picked, but
          {{
            missing
              .map((n) => `“${n.title}”`)
              .slice(0, 3)
              .join(', ')
          }}{{ missing.length > 3 ? ` and ${missing.length - 3} more` : '' }}
          come first and will have nothing inside.
        </p>
        <UiBtn
          variant="secondary"
          size="xs"
          class="mt-2.5"
          @click="addMissing"
          >Add them to the selection</UiBtn
        >
      </div>
    </template>

    <template #footer>
      <div class="mr-auto text-[12.5px] text-text-muted">
        <template v-if="estimate.count > 0">
          <span class="num font-medium text-text">{{ estimate.count }}</span>
          {{ estimate.count === 1 ? 'lesson' : 'lessons' }} ·
          <span class="num">{{ minutesLabel(estimate.studyMinutes) }}</span> of study ·
          <span class="num">{{ aboutLabel(estimate.writeSeconds) }}</span>
          to write
        </template>
        <template v-else>Nothing selected yet.</template>

        <!-- Silent unless it is about to matter. See showAllowance. -->
        <span
          v-if="showAllowance"
          :class="['block pt-1 text-[12px]', overAllowance ? 'text-warn-text' : 'text-text-faint']"
        >
          <template v-if="overAllowance">
            {{ lessonsLeft === 0 ? 'No lessons left' : `Only ${lessonsLeft} left` }}
            this month — your plan tops back up {{ allowance.resetsLabel.value }}.
          </template>
          <template v-else>
            <span class="num">{{ lessonsLeft }}</span> left this month
          </template>
        </span>
      </div>

      <UiBtn
        variant="ghost"
        size="sm"
        @click="emit('update:open', false)"
        >Cancel</UiBtn
      >
      <UiBtn
        v-if="fitsAllowance"
        variant="accent"
        size="lg"
        :disabled="estimate.count === 0"
        @click="submit"
        >Write {{ estimate.count || '' }} {{ estimate.count === 1 ? 'lesson' : 'lessons' }}</UiBtn
      >
      <UiBtn
        v-else-if="(lessonsLeft ?? 0) > 0"
        variant="accent"
        size="lg"
        @click="submitWhatFits"
        >Write the first {{ lessonsLeft }}</UiBtn
      >
      <UiBtn
        v-else
        variant="accent"
        size="lg"
        to="/account?section=plan"
        >See plans</UiBtn
      >
    </template>
  </UiModal>
</template>

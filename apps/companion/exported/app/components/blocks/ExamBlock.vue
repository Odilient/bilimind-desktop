<script setup lang="ts">
import type { Assessment, Attempt, ExamBlock } from '~/types/api'
import type { GradedPayload } from '~/components/assessments/AssessmentItem.vue'
import AssessmentItem from '~/components/assessments/AssessmentItem.vue'
import BlockShell from './BlockShell.vue'

/**
 * Same machinery as a quiz, but framed as a sitting: the questions stay behind a
 * start gate and an optional timer runs. The timer is a prompt, not a lock — it
 * never throws away work the learner has typed.
 */
const props = withDefaults(
  defineProps<{
    block: ExamBlock
    assessments?: Assessment[]
    attempts?: Record<number, Attempt[]>
    readonly?: boolean
  }>(),
  { assessments: () => [], attempts: () => ({}) },
)

const emit = defineEmits<{ graded: [payload: GradedPayload] }>()

const items = computed<Assessment[]>(() => {
  const ids = props.block.payload?.assessment_ids ?? []

  const byId = ids
    .map((id) => props.assessments.find((assessment) => assessment.id === id))
    .filter((assessment): assessment is Assessment => Boolean(assessment))

  if (byId.length > 0) return byId

  return props.assessments.filter((assessment) => assessment.block_id === props.block.id)
})

const intro = computed(() => String(props.block.payload?.intro ?? '').trim())

const limitMinutes = computed(() => {
  const value = props.block.payload?.time_limit_minutes
  return typeof value === 'number' && value > 0 ? Math.round(value) : null
})

const attempted = computed(() =>
  items.value.some((assessment) => (props.attempts[assessment.id] ?? []).length > 0),
)

const started = ref(false)
const remaining = ref(0)
let ticker: ReturnType<typeof setInterval> | undefined

const open = computed(() => props.readonly || started.value || attempted.value)

function start(): void {
  started.value = true

  if (limitMinutes.value === null) return

  remaining.value = limitMinutes.value * 60
  ticker = setInterval(() => {
    remaining.value = Math.max(0, remaining.value - 1)
    if (remaining.value === 0 && ticker) clearInterval(ticker)
  }, 1000)
}

const clock = computed(() => {
  const minutes = Math.floor(remaining.value / 60)
  const seconds = remaining.value % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
})

const passedCount = computed(
  () =>
    items.value.filter((assessment) =>
      (props.attempts[assessment.id] ?? []).some((attempt) => attempt.passed === true),
    ).length,
)

onBeforeUnmount(() => {
  if (ticker) clearInterval(ticker)
})
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <template #actions>
      <UiBadge
        v-if="limitMinutes"
        size="xs"
        :tone="started && remaining === 0 ? 'danger' : started ? 'warn' : 'outline'"
        icon="clock"
      >
        {{ started ? clock : `${limitMinutes} min` }}
      </UiBadge>
      <span
        v-if="items.length && !readonly"
        class="num inline-flex h-6 items-center rounded-full bg-surface-sunken px-2.5 text-[11.5px] font-semibold text-text-soft"
        >{{ passedCount }}/{{ items.length }}</span
      >
    </template>

    <p
      v-if="intro"
      class="mb-4 text-[14px] leading-relaxed text-text-soft"
    >
      {{ intro }}
    </p>

    <div
      v-if="!items.length"
      class="text-[13px] text-text-faint italic"
    >
      This exam has no questions attached — regenerate the lesson to rebuild it.
    </div>

    <div
      v-else-if="!open"
      class="flex flex-col items-start gap-3.5 rounded-[16px] bg-chip p-5 text-white"
    >
      <p class="text-[14px] leading-relaxed text-white/75">
        {{ items.length }} {{ items.length === 1 ? 'question' : 'questions' }}<template
          v-if="limitMinutes"
        >
          · {{ limitMinutes }} minutes suggested</template
        >. Nothing is locked — the timer is there to keep you honest.
      </p>
      <UiBtn
        variant="accent"
        size="md"
        icon="play"
        @click="start"
      >
        Start the exam
      </UiBtn>
    </div>

    <div
      v-else
      class="flex flex-col gap-3"
    >
      <p
        v-if="started && limitMinutes && remaining === 0"
        class="flex items-center gap-2 rounded-[12px] bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn-text shadow-[inset_0_0_0_1px_var(--warn-line)]"
      >
        <UiIcon
          name="clock"
          :size="13"
        />
        Time's up. You can still finish — this is your course, not an invigilated hall.
      </p>

      <AssessmentItem
        v-for="(assessment, index) in items"
        :key="assessment.id"
        :assessment="assessment"
        :attempts="attempts[assessment.id] ?? []"
        :index="index + 1"
        :total="items.length"
        :readonly="readonly"
        @graded="emit('graded', $event)"
      />
    </div>
  </BlockShell>
</template>

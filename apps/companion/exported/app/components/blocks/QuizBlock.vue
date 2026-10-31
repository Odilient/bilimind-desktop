<script setup lang="ts">
import type { Assessment, Attempt, QuizBlock } from '~/types/api'
import type { GradedPayload } from '~/components/assessments/AssessmentItem.vue'
import AssessmentItem from '~/components/assessments/AssessmentItem.vue'
import BlockShell from './BlockShell.vue'

const props = withDefaults(
  defineProps<{
    block: QuizBlock
    /** Every assessment on the node; the quiz picks its own out. */
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

const passedCount = computed(
  () =>
    items.value.filter((assessment) =>
      (props.attempts[assessment.id] ?? []).some((attempt) => attempt.passed === true),
    ).length,
)
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <template
      v-if="items.length && !readonly"
      #actions
    >
      <span
        class="num inline-flex h-6 items-center rounded-full px-2.5 text-[11.5px] font-semibold"
        :class="
          passedCount === items.length ? 'bg-accent text-on-accent' : 'bg-surface-sunken text-text-soft'
        "
        >{{ passedCount }}/{{ items.length }} passed</span
      >
    </template>

    <p
      v-if="intro"
      class="mb-4 text-[14px] leading-relaxed text-text-soft"
    >
      {{ intro }}
    </p>

    <div
      v-if="items.length"
      class="flex flex-col gap-3"
    >
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

    <p
      v-else
      class="text-[13px] text-text-faint italic"
    >
      This quiz has no questions attached — regenerate the lesson to rebuild it.
    </p>
  </BlockShell>
</template>

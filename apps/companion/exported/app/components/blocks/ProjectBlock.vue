<script setup lang="ts">
import type { Assessment, Attempt, ProjectBlock } from '~/types/api'
import type { GradedPayload } from '~/components/assessments/AssessmentItem.vue'
import AssessmentItem from '~/components/assessments/AssessmentItem.vue'
import BlockShell from './BlockShell.vue'
import Markdown from './Markdown.vue'

/**
 * Brief + deliverables checklist + the submission assessment (SPEC §3).
 * The deliverables are handed to the assessment so what the learner ticks is
 * what gets submitted.
 */
const props = withDefaults(
  defineProps<{
    block: ProjectBlock
    assessments?: Assessment[]
    attempts?: Record<number, Attempt[]>
    readonly?: boolean
  }>(),
  { assessments: () => [], attempts: () => ({}) },
)

const emit = defineEmits<{ graded: [payload: GradedPayload] }>()

const title = computed(() => String(props.block.payload?.title ?? '').trim())
const brief = computed(() => String(props.block.payload?.brief_markdown ?? '').trim())

const deliverables = computed<string[]>(() =>
  (props.block.payload?.deliverables ?? [])
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .map((item) => item.trim()),
)

const items = computed<Assessment[]>(() => {
  const ids = props.block.payload?.assessment_ids ?? []

  const byId = ids
    .map((id) => props.assessments.find((assessment) => assessment.id === id))
    .filter((assessment): assessment is Assessment => Boolean(assessment))

  if (byId.length > 0) return byId

  return props.assessments.filter((assessment) => assessment.block_id === props.block.id)
})
</script>

<template>
  <BlockShell
    :type="block.type"
    :title="title || 'Build it'"
    :source-material-ids="block.source_material_ids"
  >
    <Markdown
      v-if="brief"
      :source="brief"
    />

    <div
      v-if="deliverables.length"
      class="mt-4 rounded-[16px] bg-surface-mute p-4 shadow-[inset_0_0_0_1px_var(--border)]"
    >
      <p class="eyebrow-loud mb-3 text-text-faint">Deliverables</p>
      <ul class="flex flex-col gap-2">
        <li
          v-for="(item, index) in deliverables"
          :key="index"
          class="flex items-start gap-3 text-[14px] leading-relaxed text-text-body"
        >
          <span
            class="num mt-0.5 grid h-[22px] w-[26px] shrink-0 place-items-center rounded-[7px] bg-chip font-display text-[11px] font-semibold text-lime"
            >{{ String(index + 1).padStart(2, '0') }}</span
          >
          <span class="min-w-0 flex-1">{{ item }}</span>
        </li>
      </ul>
    </div>

    <div
      v-if="items.length"
      class="mt-4 flex flex-col gap-3"
    >
      <AssessmentItem
        v-for="(assessment, index) in items"
        :key="assessment.id"
        :assessment="assessment"
        :attempts="attempts[assessment.id] ?? []"
        :deliverables="deliverables"
        :index="items.length > 1 ? index + 1 : undefined"
        :readonly="readonly"
        @graded="emit('graded', $event)"
      />
    </div>
  </BlockShell>
</template>

<script setup lang="ts">
import type { Assessment, Attempt, CodeBlock, CodeTest } from '~/types/api'
import type { GradedPayload } from '~/components/assessments/AssessmentItem.vue'
import { inferMode, toRunLang } from '~/composables/useCodeExercise'
import AssessmentItem from '~/components/assessments/AssessmentItem.vue'
import BlockShell from './BlockShell.vue'
import Markdown from './Markdown.vue'
import CodeSnippet from './CodeSnippet.vue'

/**
 * The exercise's brief, and the exercise.
 *
 * This used to print every declared test as `call → expect` above the editor,
 * for all five modes, which meant a `script` case (no `call`) and a `query`
 * check (no `call`) were both silently filtered out and the exercise announced
 * itself as having nothing to check. The declared checks now live INSIDE the
 * exercise card, in the output pane, where they are the thing the Run button
 * turns into verdicts.
 *
 * Which leaves this block with the two things the card cannot hold: the
 * instructions, and — for `debug` — the symptom, because a learner hunting a
 * fault nobody described is not debugging, they are guessing.
 *
 * The read-only brief below is for the case with no exercise attached: a shared
 * course, or a block whose assessment was never generated. There it is the only
 * description of the task there will be, and it is not competing with the pane.
 */
const props = withDefaults(
  defineProps<{
    block: CodeBlock
    assessments?: Assessment[]
    attempts?: Record<number, Attempt[]>
    readonly?: boolean
  }>(),
  { assessments: () => [], attempts: () => ({}) },
)

const emit = defineEmits<{ graded: [payload: GradedPayload] }>()

const language = computed(() => String(props.block.payload?.language ?? 'javascript').trim())
const instructions = computed(() => String(props.block.payload?.instructions_markdown ?? '').trim())
const starterCode = computed(() => String(props.block.payload?.starter_code ?? ''))
const symptom = computed(() => String(props.block.payload?.symptom_markdown ?? '').trim())
const setupSql = computed(() => props.block.payload?.setup_sql ?? undefined)
const tables = computed(() => props.block.payload?.tables ?? [])
const requirements = computed(() => props.block.payload?.requirements ?? [])
const hints = computed(() => props.block.payload?.hints ?? [])

/**
 * Names are carried through VERBATIM, and the fallback mirrors
 * `DeterministicGrader::declaredTests()` exactly — name, then call, then
 * `test N`. The two sides match reported results to declared ones by string
 * equality, so inventing a nicer default here would score a correct answer zero.
 */
const tests = computed<CodeTest[]>(() =>
  (props.block.payload?.tests ?? [])
    .filter((test): test is CodeTest => Boolean(test) && typeof test === 'object')
    .map((test, index) => ({
      ...test,
      name: String(test.name ?? test.call ?? `test ${index + 1}`).trim() || `test ${index + 1}`,
    })),
)

const mode = computed(() =>
  inferMode(props.block.payload?.mode, toRunLang(language.value), tests.value),
)

const badge = computed(() => {
  const count = tests.value.length
  if (count === 0) return undefined
  const noun = mode.value === 'script' ? 'case' : 'check'
  return `${count} ${count === 1 ? noun : `${noun}s`}`
})

const items = computed<Assessment[]>(() => {
  const ids = props.block.payload?.assessment_ids ?? []

  const byId = ids
    .map((id) => props.assessments.find((assessment) => assessment.id === id))
    .filter((assessment): assessment is Assessment => Boolean(assessment))

  if (byId.length > 0) return byId

  return props.assessments.filter((assessment) => assessment.block_id === props.block.id)
})

/** True when the learner gets the real thing; false in a shared or unfinished view. */
const interactive = computed(() => items.value.length > 0 && !props.readonly)
</script>

<template>
  <BlockShell
    :type="block.type"
    :badge="badge"
    :source-material-ids="block.source_material_ids"
  >
    <template #actions>
      <UiBadge
        size="xs"
        tone="outline"
        mono
        >{{ language }}</UiBadge
      >
    </template>

    <Markdown
      v-if="instructions"
      :source="instructions"
    />

    <!-- debug: what it does wrong, as the learner would see it happen. -->
    <div
      v-if="symptom"
      class="mt-4 rounded-[14px] bg-warn-soft px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--warn-line)]"
    >
      <p class="eyebrow-loud mb-2 flex items-center gap-1.5 text-warn-text">
        <UiIcon
          name="warning"
          :size="12"
          class="text-warn-bright"
        />
        What it does now
      </p>
      <Markdown
        :source="symptom"
        size="sm"
      />
    </div>

    <div
      v-if="interactive"
      class="mt-4 flex flex-col gap-3"
    >
      <AssessmentItem
        v-for="assessment in items"
        :key="assessment.id"
        :assessment="assessment"
        :attempts="attempts[assessment.id] ?? []"
        :starter-code="starterCode"
        :tests="tests"
        :language="language"
        :mode="mode"
        :hints="hints"
        :requirements="requirements"
        :setup-sql="setupSql"
        :tables="tables"
        :symptom-markdown="symptom || undefined"
        :readonly="readonly"
        @graded="emit('graded', $event)"
      />
    </div>

    <!-- No exercise to do: describe the task, then show the code it starts from. -->
    <template v-else>
      <div
        v-if="mode === 'build' && requirements.length"
        class="mt-4 rounded-[14px] bg-surface-mute p-4 shadow-[inset_0_0_0_1px_var(--border)]"
      >
        <p class="eyebrow-loud mb-2.5 text-text-faint">Done when</p>
        <ul class="flex flex-col gap-1.5">
          <li
            v-for="(requirement, index) in requirements"
            :key="index"
            class="text-[13px] leading-relaxed text-text-muted"
          >
            {{ requirement }}
          </li>
        </ul>
      </div>

      <div
        v-else-if="mode === 'query' && tables.length"
        class="mt-4 rounded-[14px] bg-surface-mute p-4 shadow-[inset_0_0_0_1px_var(--border)]"
      >
        <p class="eyebrow-loud mb-2.5 text-text-faint">Tables you can query</p>
        <ul class="flex flex-col gap-1.5">
          <li
            v-for="table in tables"
            :key="table.name"
            class="font-mono text-[12px] text-text-muted"
          >
            <span class="text-text">{{ table.name }}</span>
            <span class="text-text-faint"> ({{ table.columns.join(', ') }})</span>
          </li>
        </ul>
      </div>

      <div
        v-else-if="tests.length"
        class="mt-4 rounded-[14px] bg-surface-mute p-4 shadow-[inset_0_0_0_1px_var(--border)]"
      >
        <p class="eyebrow-loud mb-2.5 text-text-faint">Your code must satisfy</p>
        <ul class="flex flex-col gap-1.5">
          <li
            v-for="(test, index) in tests.slice(0, 6)"
            :key="index"
            class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[12px] text-text-muted"
          >
            <template v-if="test.call">
              <span class="text-text">{{ test.call }}</span>
              <span class="text-text-faint">→</span>
              <span class="text-success-text">{{ JSON.stringify(test.expect) }}</span>
            </template>
            <span class="font-sans text-[11.5px] text-text-faint">{{ test.name }}</span>
          </li>
        </ul>
      </div>

      <CodeSnippet
        v-if="starterCode.trim()"
        class="mt-4"
        :code="starterCode"
        :language="language"
        caption="starter code"
      />
    </template>
  </BlockShell>
</template>

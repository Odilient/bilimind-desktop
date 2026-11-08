<script lang="ts">
import type { Attempt, ProgressState } from '~/types/api'

/**
 * Emitted after every graded submission. The player uses it to refresh node
 * progress without another round trip — the backend returns all of it in the
 * attempt response's `meta`.
 */
export interface GradedPayload {
  assessmentId: number
  attempt: Attempt
  assessmentsTotal: number
  assessmentsPassed: number
  nodeCompleted: boolean
  nodeState: ProgressState | null
}
</script>

<script setup lang="ts">
import type { Assessment, AttemptResponse, CodeTest } from '~/types/api'
import { ApiError } from '~/composables/useApi'
import Markdown from '~/components/blocks/Markdown.vue'
import McqAssessment from './McqAssessment.vue'
import MultiSelectAssessment from './MultiSelectAssessment.vue'
import ShortAnswerAssessment from './ShortAnswerAssessment.vue'
import ClozeAssessment from './ClozeAssessment.vue'
import EssayAssessment from './EssayAssessment.vue'
import ProjectAssessment from './ProjectAssessment.vue'
import CodeAssessment from './CodeAssessment.vue'
import OrderingAssessment from './OrderingAssessment.vue'
import NumericAssessment from './NumericAssessment.vue'
import SelfAssessment from './SelfAssessment.vue'
import AttemptResult from './AttemptResult.vue'

/**
 * One assessment, end to end: the right input for its kind, submission to
 * `POST /api/assessments/{id}/attempt`, the graded result, and retry.
 *
 * There is no `answer_key` anywhere in this component because the API never
 * sends one (SPEC §8) — everything the learner sees comes back from grading.
 */
const { t } = useI18n()
const props = withDefaults(
  defineProps<{
    assessment: Assessment
    /** Previous attempts, newest first. */
    attempts?: Attempt[]
    /** Shared course view: render the question, never the form. */
    readonly?: boolean
    /** 1-based position, for the "Question 2 of 5" chip. */
    index?: number
    total?: number
    /**
     * Passed down by a `code` block. All five exercise shapes come through these
     * — `tests` carries whatever that mode declares (a call, a stdin case, an
     * expected table, a selector) and the rest is per-mode context the exercise
     * needs in order to be doable at all.
     */
    starterCode?: string
    tests?: CodeTest[]
    language?: string
    mode?: string
    hints?: string[]
    /** build: what "done" looks like. query: the fixture and the tables it makes. */
    requirements?: string[]
    setupSql?: string
    tables?: Array<{ name: string; columns: string[] }>
    /** debug: what the broken code does, as the learner would observe it. */
    symptomMarkdown?: string
    /** Passed down by a `project` block. */
    deliverables?: string[]
  }>(),
  { attempts: () => [], tests: () => [], deliverables: () => [] },
)

const emit = defineEmits<{ graded: [payload: GradedPayload] }>()

const api = useApi()
const toast = useToast()

// Labels live in check.assess.kind.* / check.assess.grader.*; these are the ids that have one.
const KIND_IDS = ['mcq', 'multi_select', 'short_answer', 'cloze', 'essay', 'project', 'code', 'ordering', 'numeric']

/* Said as what happens to the answer, not which grader class runs: a home
   baker does not know what "rubric-graded" means, and should not have to. */
const GRADER_IDS = ['deterministic', 'llm_rubric', 'self']

const history = ref<Attempt[]>([...props.attempts])
const response = ref<AttemptResponse | null>(null)
const submitting = ref(false)
const failure = ref<string | null>(null)
const editing = ref(props.attempts.length === 0)

watch(
  () => props.attempts,
  (value) => {
    history.value = [...value]
    editing.value = value.length === 0
  },
)

const latest = computed<Attempt | null>(() => history.value[0] ?? null)
const passed = computed(() => history.value.some((attempt) => attempt.passed === true))
const isSelf = computed(() => props.assessment.grader === 'self')

/**
 * A code exercise stays a code exercise even when the learner grades it.
 *
 * `NodeExpander` downgrades a code item to `self` whenever its block declared no
 * checks — a SQL fixture with nothing to assert against, a build whose criteria
 * are visual. That is a decision about how the attempt is SCORED, and routing it
 * to the plain "mark done" box would take away the editor, the seeded tables and
 * the live preview, which ARE the exercise. The panel says out loud that nothing
 * is checked automatically, which is the honest version of the same fact.
 */
const component = computed(() => {
  if (props.assessment.kind === 'code') return CodeAssessment
  if (isSelf.value) return SelfAssessment

  return (
    {
      mcq: McqAssessment,
      multi_select: MultiSelectAssessment,
      short_answer: ShortAnswerAssessment,
      cloze: ClozeAssessment,
      essay: EssayAssessment,
      project: ProjectAssessment,
      code: CodeAssessment,
      ordering: OrderingAssessment,
      numeric: NumericAssessment,
    }[props.assessment.kind] ?? ShortAnswerAssessment
  )
})

/** Cloze renders the prompt itself, with the inputs inline. */
const showPrompt = computed(() => props.assessment.kind !== 'cloze' || isSelf.value)

const extraProps = computed<Record<string, unknown>>(() => {
  // Code first: it is the one kind that keeps its own component when self-graded.
  if (props.assessment.kind === 'code') {
    return {
      starterCode: props.starterCode ?? '',
      tests: props.tests,
      language: props.language ?? 'javascript',
      mode: props.mode,
      hints: props.hints ?? [],
      requirements: props.requirements,
      setupSql: props.setupSql,
      tables: props.tables,
      symptomMarkdown: props.symptomMarkdown,
    }
  }

  if (isSelf.value) return {}

  if (props.assessment.kind === 'project') return { deliverables: props.deliverables }

  return {}
})

/**
 * What is actually standing between the learner and the Submit button. "Run the
 * tests" is wrong for three of the five code modes — a build has no tests to
 * run, and an exercise with nothing declared needs only that something is
 * written.
 */
const codeSubmitHint = computed(() => {
  if ((props.tests?.length ?? 0) === 0) return t('check.assess.codeHintNoTests')
  if (props.mode === 'build') return t('check.assess.codeHintBuild')
  return t('check.assess.codeHintRun')
})

const submitLabel = computed(() => {
  if (isSelf.value) return t('check.assess.markDone')
  if (props.assessment.kind === 'code') return t('check.assess.submitResults')
  // An ordering item is pre-populated with the scrambled order, so "Submit" alone
  // reads as though nothing has been done yet.
  if (props.assessment.kind === 'ordering' && history.value.length === 0) return t('check.assess.checkOrder')
  if (history.value.length > 0) return t('check.assess.submitAgain')
  return t('check.assess.submit')
})

/* -- Submission ------------------------------------------------------------ */

let pollTimer: ReturnType<typeof setTimeout> | undefined
let pollsLeft = 0

async function pollUntilGraded(): Promise<void> {
  if (pollsLeft <= 0) return

  pollsLeft -= 1

  try {
    const rows = await api.get<Attempt[]>(`/assessments/${props.assessment.id}/attempts`)
    history.value = rows

    const status = (rows[0] as { status?: string } | undefined)?.status
    if (status === 'pending' || status === 'queued') {
      pollTimer = setTimeout(() => void pollUntilGraded(), 2500)
    }
  } catch {
    /* the learner still has their result; stop quietly */
  }
}

interface AttemptEnvelope {
  data: Attempt
  meta?: {
    node?: { progress?: { state?: string } }
    assessments_total?: number
    assessments_passed?: number
    node_completed?: boolean
  }
}

async function submit(): Promise<void> {
  if (props.readonly || submitting.value || response.value === null) return

  submitting.value = true
  failure.value = null

  try {
    const envelope = await api.post<AttemptEnvelope>(
      `/assessments/${props.assessment.id}/attempt`,
      { response: response.value },
      { unwrap: false },
    )

    const attempt = envelope.data
    history.value = [attempt, ...history.value]
    editing.value = false

    const state = envelope.meta?.node?.progress?.state
    emit('graded', {
      assessmentId: props.assessment.id,
      attempt,
      assessmentsTotal: envelope.meta?.assessments_total ?? 0,
      assessmentsPassed: envelope.meta?.assessments_passed ?? 0,
      nodeCompleted: envelope.meta?.node_completed === true,
      nodeState: (state as ProgressState | undefined) ?? null,
    })

    const status = (attempt as { status?: string }).status
    if (status === 'pending' || status === 'queued') {
      pollsLeft = 12
      pollTimer = setTimeout(() => void pollUntilGraded(), 2500)
    }
  } catch (error) {
    const message =
      error instanceof ApiError
        ? (error.allMessages[0] ?? error.message)
        : t('check.assess.cantGrade')
    failure.value = message
    toast.error({ title: t('check.assess.submissionFailed'), body: message })
  } finally {
    submitting.value = false
  }
}

function retry(): void {
  editing.value = true
  failure.value = null
}

onBeforeUnmount(() => {
  if (pollTimer) clearTimeout(pollTimer)
})
</script>

<template>
  <article
    :class="[
      'rounded-[14px] px-4 py-4 transition-[background-color,box-shadow] duration-300 sm:px-[18px]',
      passed
        ? 'bg-leaf-soft shadow-[0_0_0_1.5px_var(--leaf)]'
        : 'bg-surface shadow-[0_0_0_1px_var(--border)]',
    ]"
  >
    <header class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <span
          v-if="index"
          :class="[
            'num grid size-[26px] place-items-center rounded-full font-display text-[12px] font-semibold',
            passed
              ? 'bg-leaf text-white'
              : 'bg-[rgb(var(--wash-rgb)/0.065)] text-text-soft',
          ]"
          :aria-label="passed ? t('check.assess.passedAria') : t('check.assess.questionN', { n: index })"
        >
          <UiIcon
            v-if="passed"
            name="check"
            :size="12"
            :stroke="2.6"
          />
          <template v-else>{{ index }}</template>
        </span>
        <UiBadge
          size="xs"
          tone="outline"
          >{{ KIND_IDS.includes(assessment.kind) ? t(`check.assess.kind.${assessment.kind}`) : assessment.kind }}</UiBadge
        >
        <UiBadge
          v-if="GRADER_IDS.includes(assessment.grader)"
          size="xs"
          :tone="assessment.grader === 'llm_rubric' ? 'accent' : 'neutral'"
        >
          {{ t(`check.assess.grader.${assessment.grader}`) }}
        </UiBadge>
      </div>

      <span
        v-if="history.length"
        class="num text-[11px] text-text-faint"
      >
        {{ t('check.assess.attempts', history.length) }}
      </span>
    </header>

    <!-- The question reads a step above the surrounding prose: it is being
         asked, not narrated. -->
    <Markdown
      v-if="showPrompt"
      :source="assessment.prompt"
      size="sm"
      class="mb-4 [&_p]:text-[15.5px] [&_p]:leading-snug [&_p]:font-semibold [&_p]:text-text"
    />

    <!-- Read-only (shared course): the question, never the form. -->
    <div
      v-if="readonly"
      class="mt-1"
    >
      <ul
        v-if="assessment.options?.length"
        class="flex flex-col gap-1.5"
      >
        <li
          v-for="(option, i) in assessment.options"
          :key="option.id"
          class="flex items-center gap-3 rounded-[12px] px-3.5 py-2.5 text-[14px] text-text-body shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.12)]"
        >
          <span
            class="num grid size-[22px] shrink-0 place-items-center rounded-full text-[11px] font-semibold text-text-faint shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.16)]"
            >{{
            String.fromCharCode(65 + i)
          }}</span
          >
          <span class="min-w-0 flex-1">{{ option.text }}</span>
        </li>
      </ul>
      <p
        v-if="assessment.rubric?.length"
        class="mt-2.5 text-[11.5px] text-text-faint"
      >
        {{ t('check.assess.gradedOn', { list: assessment.rubric.map((row) => row.criterion).join(' · ') }) }}
      </p>
    </div>

    <template v-else>
      <div v-show="editing">
        <component
          :is="component"
          v-model="response"
          v-bind="extraProps"
          :assessment="assessment"
          :disabled="submitting"
          @submit="submit"
        />

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <UiBtn
            variant="primary"
            size="sm"
            :loading="submitting"
            :disabled="response === null"
            @click="submit"
          >
            {{ submitLabel }}
          </UiBtn>
          <UiBtn
            v-if="latest"
            variant="ghost"
            size="sm"
            @click="editing = false"
          >
            {{ t('common.cancel') }}
          </UiBtn>
          <p
            v-if="response === null && !submitting"
            class="text-[11.5px] text-text-faint"
          >
            {{ assessment.kind === 'code' ? codeSubmitHint : t('check.assess.answerToEnable') }}
          </p>
        </div>
      </div>

      <p
        v-if="failure"
        class="mt-3 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-danger"
      >
        <UiIcon
          name="alert"
          :size="13"
          class="mt-px"
        />
        {{ failure }}
      </p>

      <div
        v-if="latest && !editing"
        class="mt-1 flex flex-col gap-3"
      >
        <AttemptResult
          :assessment="assessment"
          :attempt="latest"
        />

        <div class="flex flex-wrap items-center gap-2">
          <UiBtn
            variant="secondary"
            size="sm"
            icon="refresh"
            @click="retry"
          >
            {{ passed ? t('check.assess.tryDifferent') : t('common.retry') }}
          </UiBtn>
          <span
            v-if="history.length > 1"
            class="num text-[11.5px] text-text-faint"
          >
            {{ t('check.assess.best', { score: Math.max(...history.map((attempt) => attempt.score ?? 0)), max: assessment.max_score }) }}
          </span>
        </div>
      </div>
    </template>
  </article>
</template>

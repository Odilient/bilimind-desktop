<script setup lang="ts">
import type { Component } from 'vue'
import type { Assessment, Attempt, Block, BlockType } from '~/types/api'
import type { GradedPayload } from '~/components/assessments/AssessmentItem.vue'
import ExplainerBlock from './ExplainerBlock.vue'
import KeyPointsBlock from './KeyPointsBlock.vue'
import ExampleBlock from './ExampleBlock.vue'
import ResourceBlock from './ResourceBlock.vue'
import VideoBlock from './VideoBlock.vue'
import QuizBlock from './QuizBlock.vue'
import ExamBlock from './ExamBlock.vue'
import ProjectBlock from './ProjectBlock.vue'
import FlashcardsBlock from './FlashcardsBlock.vue'
import CodeBlock from './CodeBlock.vue'
import ReflectionBlock from './ReflectionBlock.vue'
import AnalogyBlock from './AnalogyBlock.vue'
import WalkthroughBlock from './WalkthroughBlock.vue'
import ChecklistBlock from './ChecklistBlock.vue'
import DiagramBlock from './DiagramBlock.vue'
import ComparisonBlock from './ComparisonBlock.vue'
import ReferenceTableBlock from './ReferenceTableBlock.vue'
import ScenarioBlock from './ScenarioBlock.vue'
import WorkedExampleBlock from './WorkedExampleBlock.vue'
import PlaygroundBlock from './PlaygroundBlock.vue'
import AnnotatedMediaBlock from './AnnotatedMediaBlock.vue'
import TimelineBlock from './TimelineBlock.vue'
import AudioBlock from './AudioBlock.vue'
import SpeakingBlock from './SpeakingBlock.vue'
import DialogueBlock from './DialogueBlock.vue'
import IllustrationBlock from './IllustrationBlock.vue'
import MisconceptionBlock from './MisconceptionBlock.vue'
import UnknownBlock from './UnknownBlock.vue'

/**
 * SPEC §3 — one component per block type, and an unknown type must degrade
 * gracefully rather than crash the page. Two things guarantee that here:
 * an explicit fallback in the lookup, and an error boundary around the render
 * so a malformed payload takes down one block, never the lesson.
 */
const props = withDefaults(
  defineProps<{
    block: Block
    /** Every assessment on the node — quiz/exam/project/code blocks pick theirs. */
    assessments?: Assessment[]
    attempts?: Record<number, Attempt[]>
    readonly?: boolean
    /** Course language tag, used to choose a speech-synthesis voice. */
    language?: string
    /** Course level (beginner/…), used to pitch spoken role-play. */
    level?: string
  }>(),
  { assessments: () => [], attempts: () => ({}) },
)

const emit = defineEmits<{ graded: [payload: GradedPayload] }>()

const REGISTRY: Record<BlockType, Component> = {
  explainer: ExplainerBlock,
  key_points: KeyPointsBlock,
  example: ExampleBlock,
  resource: ResourceBlock,
  video: VideoBlock,
  quiz: QuizBlock,
  exam: ExamBlock,
  project: ProjectBlock,
  flashcards: FlashcardsBlock,
  code: CodeBlock,
  reflection: ReflectionBlock,
  // EXPAND §2 — formats derived from the node's archetype.
  analogy: AnalogyBlock,
  walkthrough: WalkthroughBlock,
  checklist: ChecklistBlock,
  diagram: DiagramBlock,
  comparison: ComparisonBlock,
  reference_table: ReferenceTableBlock,
  scenario: ScenarioBlock,
  worked_example: WorkedExampleBlock,
  playground: PlaygroundBlock,
  annotated_media: AnnotatedMediaBlock,
  timeline: TimelineBlock,
  audio: AudioBlock,
  speaking: SpeakingBlock,
  dialogue: DialogueBlock,
  // Both components are PLACEHOLDERS that render the payload's text honestly.
  // Workstream C replaces them; these rows exist so the union and the registry
  // stay in step, because `Record<BlockType, Component>` fails vue-tsc the
  // instant one of them grows without the other.
  illustration: IllustrationBlock,
  misconception: MisconceptionBlock,
}

/** Block types that need the node's assessments and can emit a grade. */
const INTERACTIVE = new Set<BlockType>(['quiz', 'exam', 'project', 'code'])

const crashed = ref(false)
const crashReason = ref<string | null>(null)

watch(
  () => props.block,
  () => {
    crashed.value = false
    crashReason.value = null
  },
)

const known = computed(() => Boolean(REGISTRY[props.block.type as BlockType]))

const resolved = computed<Component>(() =>
  crashed.value || !known.value
    ? UnknownBlock
    : (REGISTRY[props.block.type as BlockType] ?? UnknownBlock),
)

const bindings = computed<Record<string, unknown>>(() => {
  if (crashed.value || !known.value) return { block: props.block }

  if (INTERACTIVE.has(props.block.type)) {
    return {
      block: props.block,
      assessments: props.assessments,
      attempts: props.attempts,
      readonly: props.readonly,
    }
  }

  if (props.block.type === 'reflection') return { block: props.block, readonly: props.readonly }

  // Not interactive, but it SPENDS: an illustration that has not been drawn yet
  // costs a flat ~$0.04 upstream call the first time somebody scrolls to it. A
  // read-only reader is never the person who should be paying for that, and the
  // trigger 404s for them anyway — this saves the round trip.
  if (props.block.type === 'illustration') return { block: props.block, readonly: props.readonly }

  // The narrator picks a voice from the course language; nothing else needs it.
  if (props.block.type === 'audio') return { block: props.block, language: props.language }

  // Speaking practice needs the language for TTS/recognition and the level to
  // pitch the role-play — but never the assessments table.
  if (props.block.type === 'speaking' || props.block.type === 'dialogue') {
    return { block: props.block, language: props.language, level: props.level }
  }

  return { block: props.block }
})

const listeners = computed(() =>
  !crashed.value && known.value && INTERACTIVE.has(props.block.type)
    ? { graded: (payload: GradedPayload) => emit('graded', payload) }
    : {},
)

onErrorCaptured((error) => {
  crashed.value = true
  /* The exception text is for whoever can fix it, so it is gated exactly like
     the console.error below. A learner reading about gradients does not need a
     TypeError in the middle of it, and could not act on one. */
  crashReason.value = import.meta.dev
    ? error instanceof Error
      ? error.message
      : String(error)
    : null

  if (import.meta.dev) console.error('[BlockRenderer] block failed to render', props.block, error)

  return false
})
</script>

<template>
  <!--
    The anchor and the scroll margin sit on this one element on purpose. Search
    (workstream D) scrolls to `#block-{id}`, and `.lesson-section` is what makes
    the browser stop clear of the sticky header — split them across two elements
    and every search hit lands underneath it. This is also the direct child of
    `.lesson`, so the wide track lands here too.
  -->
  <div
    :id="`block-${block.id}`"
    class="lesson-section"
  >
    <p
      v-if="crashed"
      class="mb-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-warn"
    >
      <UiIcon
        name="alert"
        :size="12"
        class="mt-px"
      />
      <span
        >This part of the lesson could not be displayed{{
          crashReason ? `: ${crashReason}` : ''
        }}.</span
      >
    </p>

    <component
      :is="resolved"
      v-bind="bindings"
      v-on="listeners"
    />
  </div>
</template>

<script setup lang="ts">
import type { Assessment, AttemptResponse } from '~/types/api'

/**
 * Fill in the blanks. The generator writes blanks as four underscores
 * (SPEC prompt contract), so the prompt is split on any run of three or more
 * and an input is dropped in at each gap. Submits `{blanks: [...]}` positionally
 * — DeterministicGrader compares blank-by-blank.
 */
const props = defineProps<{
  assessment: Assessment
  disabled?: boolean
}>()

const emit = defineEmits<{ submit: [] }>()

const model = defineModel<AttemptResponse | null>({ default: null })

const { renderInline } = useMarkdown()

type Segment = { kind: 'text'; html: string } | { kind: 'blank'; index: number }

const segments = computed<Segment[]>(() => {
  const parts = String(props.assessment.prompt ?? '').split(/_{3,}/g)
  const out: Segment[] = []

  parts.forEach((part, index) => {
    if (part !== '') out.push({ kind: 'text', html: renderInline(part) })
    if (index < parts.length - 1) out.push({ kind: 'blank', index })
  })

  return out
})

const blankCount = computed(() => Math.max(1, segments.value.filter((s) => s.kind === 'blank').length))

/** True when the prompt carried no `____`, so we fall back to one plain field. */
const inline = computed(() => segments.value.some((segment) => segment.kind === 'blank'))

const answers = ref<string[]>([])

watch(
  blankCount,
  (count) => {
    answers.value = Array.from({ length: count }, (_, index) => answers.value[index] ?? '')
  },
  { immediate: true },
)

watch(
  model,
  (value) => {
    const blanks = (value as { blanks?: unknown } | null)?.blanks
    if (!Array.isArray(blanks)) return

    const next = Array.from({ length: blankCount.value }, (_, index) => String(blanks[index] ?? ''))
    if (next.join('') !== answers.value.join('')) answers.value = next
  },
  { immediate: true },
)

watch(
  answers,
  (value) => {
    model.value = value.some((answer) => answer.trim() !== '') ? { blanks: [...value] } : null
  },
  { deep: true },
)

const inputs = useTemplateRef<HTMLInputElement[]>('inputs')

function onEnter(index: number): void {
  const next = inputs.value?.[index + 1]

  if (next) next.focus()
  else emit('submit')
}

function widthFor(index: number): string {
  const length = (answers.value[index] ?? '').length
  return `${Math.min(28, Math.max(7, length + 2))}ch`
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <p
      v-if="inline"
      class="cloze text-[15px] leading-[2.4] text-text-body"
    >
      <template
        v-for="(segment, index) in segments"
        :key="index"
      >
        <span
          v-if="segment.kind === 'text'"
          v-html="segment.html"
        />
        <input
          v-else
          ref="inputs"
          v-model="answers[segment.index]"
          type="text"
          :disabled="disabled"
          :style="{ width: widthFor(segment.index) }"
          :aria-label="`Blank ${segment.index + 1}`"
          autocomplete="off"
          spellcheck="false"
          class="mx-1 inline-block rounded-[8px] border-b-2 border-lime-2 bg-accent-soft px-2 py-0.5 text-center font-mono text-[13px] text-text outline-none transition-colors focus:border-text focus:bg-surface disabled:opacity-60"
          @keydown.enter.prevent="onEnter(segment.index)"
        >
      </template>
    </p>

    <UiTextField
      v-else
      v-model="answers[0]"
      :disabled="disabled"
      placeholder="Your answer"
      aria-label="Your answer"
      @keydown.enter="emit('submit')"
    />

    <p class="text-[11.5px] text-text-faint">
      Capitalisation, spacing and punctuation are ignored when grading.
    </p>
  </div>
</template>

<style scoped>
.cloze :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.88em;
  padding: 0.12em 0.36em;
  border-radius: var(--radius-xs);
  background: var(--surface-sunken);
  color: var(--text);
}

.cloze :deep(strong) {
  color: var(--text);
  font-weight: 600;
}
</style>

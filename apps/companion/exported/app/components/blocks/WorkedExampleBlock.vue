<script setup lang="ts">
import type { WorkedExampleBlock } from '~/types/api'
import BlockShell from './BlockShell.vue'
import Markdown from './Markdown.vue'

/**
 * EXPAND §2/§6 — a calculation, one step at a time.
 *
 * Steps are revealed on request rather than dumped at once. Reading a finished
 * derivation teaches nothing — the learner has to attempt the next line before
 * seeing it, or they are watching, not learning. "Show all" exists for the
 * second read, when they are checking their own working rather than doing it.
 *
 * The common mistakes sit outside the card, in red, after the answer. They are
 * a different kind of claim from the derivation and should not read as one more
 * step of it.
 */
const props = defineProps<{ block: WorkedExampleBlock }>()

const steps = computed(() => props.block.payload?.steps ?? [])
const shown = ref(1)
const answerShown = ref(false)

watch(
  () => props.block.id,
  () => {
    shown.value = 1
    answerShown.value = false
  },
)

const allShown = computed(() => shown.value >= steps.value.length)

function next(): void {
  shown.value = Math.min(shown.value + 1, steps.value.length)
}

function showAll(): void {
  shown.value = steps.value.length
}
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <template
      v-if="steps.length > 1 && !allShown"
      #actions
    >
      <UiBtn
        variant="ghost"
        size="xs"
        @click="showAll"
        >Show all</UiBtn
      >
    </template>

    <Markdown
      v-if="block.payload?.problem_markdown"
      :source="block.payload.problem_markdown"
      class="mb-4"
    />

    <div
      v-if="steps.length"
      class="overflow-hidden rounded-[18px] bg-surface shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.09)]"
    >
      <ol>
        <li
          v-for="(step, index) in steps.slice(0, shown)"
          :key="index"
          class="flex gap-3.5 border-t border-border-rule px-4 py-3.5 first:border-t-0"
        >
          <span
            class="num mt-px grid size-6 shrink-0 place-items-center rounded-full font-display text-[11.5px] font-semibold"
            :class="
              index === shown - 1 && !allShown
                ? 'bg-accent text-on-accent'
                : 'bg-chip text-accent'
            "
            >{{ index + 1 }}</span
          >
          <div class="min-w-0 flex-1">
            <p
              v-if="step.expression"
              class="expr overflow-x-auto text-[13.5px] leading-normal text-text"
            >
              {{ step.expression }}
            </p>
            <p
              v-if="step.explanation"
              class="mt-1 text-[13.5px] leading-snug text-text-soft"
            >
              {{ step.explanation }}
            </p>
          </div>
        </li>
      </ol>

      <div
        v-if="!allShown"
        class="flex items-center gap-2.5 border-t border-border-rule bg-surface-mute px-4 py-3"
      >
        <UiBtn
          variant="primary"
          size="sm"
          trailing-icon="arrow-right"
          @click="next"
          >Next step</UiBtn
        >
        <span class="num text-[11.5px] text-text-faint">{{ shown }}/{{ steps.length }}</span>
      </div>

      <div
        v-else-if="block.payload?.answer"
        class="flex flex-wrap items-center gap-2.5 border-t border-accent-line bg-accent-soft px-4 py-3.5"
      >
        <template v-if="answerShown">
          <span class="text-[12px] leading-none font-bold text-accent-strong">Answer</span>
          <span class="num text-[14px] font-medium text-accent-strong">{{
            block.payload.answer
          }}</span>
        </template>
        <button
          v-else
          type="button"
          class="cursor-pointer text-[13px] font-medium text-accent-strong underline underline-offset-2"
          @click="answerShown = true"
        >
          Show the answer
        </button>
      </div>
    </div>

    <div
      v-if="allShown && block.payload?.common_mistakes?.length"
      class="mt-3.5"
    >
      <p class="text-[12px] leading-none font-bold mb-2 text-danger">Common mistakes</p>
      <div
        v-for="(mistake, index) in block.payload.common_mistakes"
        :key="index"
        class="mb-1.5 flex gap-2.5"
      >
        <UiIcon
          name="x"
          :size="12"
          :stroke="2.4"
          class="mt-1 shrink-0 text-danger"
        />
        <span class="text-[13.5px] leading-normal text-text-soft">{{ mistake }}</span>
      </div>
    </div>
  </BlockShell>
</template>

<style scoped>
.expr {
  font-family: var(--font-mono);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

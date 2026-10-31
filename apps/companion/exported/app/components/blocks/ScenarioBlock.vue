<script setup lang="ts">
import type { ScenarioBlock, ScenarioOption, ScenarioStep } from '~/types/api'
import BlockShell from './BlockShell.vue'
import Markdown from './Markdown.vue'

/**
 * EXPAND §2/§6 — a situation the learner works through by choosing.
 *
 * Deliberately NOT graded. The teaching happens in the consequence — what the meter
 * reads, what the server returns — so a wrong turn is shown in full and the path
 * continues from there. Scoring it would turn a rehearsal into a test, and the
 * learner would start optimising for the tick instead of thinking.
 *
 * The debrief is held back until the path ends: reading "the principle behind all
 * of this is X" before making the choices gives the answer away.
 */
const props = defineProps<{ block: ScenarioBlock }>()

const steps = computed<ScenarioStep[]>(() => props.block.payload?.steps ?? [])

/** The path taken so far: one entry per answered step. */
const path = ref<Array<{ step: ScenarioStep; option: ScenarioOption }>>([])
const currentId = ref<string | null>(null)

watch(
  steps,
  (next) => {
    path.value = []
    currentId.value = next[0]?.id ?? null
  },
  { immediate: true },
)

const current = computed<ScenarioStep | null>(
  () => steps.value.find((step) => step.id === currentId.value) ?? null,
)

const finished = computed(() => current.value === null && path.value.length > 0)

const missteps = computed(() => path.value.filter((entry) => !entry.option.correct).length)

function choose(step: ScenarioStep, option: ScenarioOption): void {
  path.value = [...path.value, { step, option }]

  // A `next_id` pointing nowhere was already repaired to null server-side, so a
  // missing target here always means "the scenario ends".
  currentId.value = option.next_id && steps.value.some((s) => s.id === option.next_id)
    ? option.next_id
    : null
}

function restart(): void {
  path.value = []
  currentId.value = steps.value[0]?.id ?? null
}
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <template
      v-if="path.length"
      #actions
    >
      <UiBtn
        variant="ghost"
        size="xs"
        icon="refresh"
        @click="restart"
      >
        Start over
      </UiBtn>
    </template>

    <Markdown
      v-if="block.payload?.setup_markdown"
      :source="block.payload.setup_markdown"
      size="sm"
    />

    <ol
      v-if="path.length"
      class="mt-4 flex flex-col gap-3"
    >
      <li
        v-for="(entry, index) in path"
        :key="index"
        class="rounded-[14px] px-4 py-3.5"
        :class="
          entry.option.correct
            ? 'bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--lime-2)]'
            : 'bg-warn-soft shadow-[inset_0_0_0_1px_var(--warn-line)]'
        "
      >
        <p class="text-[12.5px] leading-relaxed text-text-soft">{{ entry.step.prompt }}</p>

        <p class="mt-2 flex items-start gap-2.5 text-[14px] leading-snug font-semibold">
          <span
            class="grid size-5 shrink-0 place-items-center rounded-full"
            :class="entry.option.correct ? 'bg-accent text-on-accent' : 'bg-warn-bright text-white'"
          >
            <UiIcon
              :name="entry.option.correct ? 'check' : 'x'"
              :size="11"
              :stroke="2.6"
            />
          </span>
          <span>{{ entry.option.text }}</span>
        </p>

        <Markdown
          v-if="entry.option.outcome_markdown"
          :source="entry.option.outcome_markdown"
          size="sm"
          class="mt-2.5 border-t border-dashed border-border-strong pt-2.5 text-text-soft"
        />
      </li>
    </ol>

    <div
      v-if="current"
      class="mt-4"
    >
      <p class="font-display text-[16.5px] leading-snug font-semibold tracking-[-0.015em]">
        {{ current.prompt }}
      </p>

      <div
        class="mt-3 flex flex-col gap-2"
        role="group"
        :aria-label="current.prompt"
      >
        <button
          v-for="option in current.options"
          :key="option.id"
          type="button"
          class="cursor-pointer rounded-[12px] bg-surface px-4 py-3 text-left text-[14px] leading-snug text-text-body shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.12)] transition hover:bg-surface-mute hover:shadow-[inset_0_0_0_1.5px_var(--ink)]"
          @click="choose(current, option)"
        >
          {{ option.text }}
        </button>
      </div>
    </div>

    <div
      v-else-if="finished && block.payload?.debrief_markdown"
      class="mt-4 rounded-[16px] bg-brand-soft p-4"
    >
      <p class="eyebrow-loud mb-2.5 flex items-center gap-2 text-brand">
        <span class="grid size-[22px] place-items-center rounded-[7px] bg-brand text-white">
          <UiIcon
            name="sparkles"
            :size="12"
          />
        </span>
        Debrief
      </p>
      <Markdown
        :source="block.payload.debrief_markdown"
        size="sm"
      />
      <p
        v-if="missteps"
        class="mt-3 border-t border-brand-line pt-2.5 text-[12.5px] text-text-soft"
      >
        You took {{ missteps }} wrong turn{{ missteps === 1 ? '' : 's' }} on the way — worth running
        it again now you know where they were.
      </p>
    </div>

    <p
      v-if="!steps.length"
      class="mt-3 text-[13px] text-text-faint italic"
    >
      No scenario was generated for this lesson.
    </p>
  </BlockShell>
</template>

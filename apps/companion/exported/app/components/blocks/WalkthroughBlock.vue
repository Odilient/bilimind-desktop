<script setup lang="ts">
import type { WalkthroughBlock } from '~/types/api'
import BlockShell from './BlockShell.vue'
import Markdown from './Markdown.vue'

/**
 * EXPAND §2/§6 — a procedure, in the order it is performed.
 *
 * Steps are ticked off rather than merely read. That is the difference between a
 * numbered list and something a learner can follow with their hands busy: the
 * state survives scrolling away and back, so "where was I" has an answer.
 *
 * State is per-block and deliberately local — this is a working aid, not progress,
 * and it never reaches the server.
 */
const props = defineProps<{ block: WalkthroughBlock }>()

const steps = computed(() => props.block.payload?.steps ?? [])
const done = ref<Set<number>>(new Set())

watch(() => props.block.id, () => done.value = new Set())

function toggle(n: number): void {
  const next = new Set(done.value)

  next.has(n) ? next.delete(n) : next.add(n)
  done.value = next
}
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <template
      v-if="steps.length"
      #actions
    >
      <span
        class="num inline-flex h-6 items-center rounded-full bg-surface-sunken px-2.5 text-[11.5px] font-semibold text-text-soft tabular-nums"
      >
        {{ done.size }}/{{ steps.length }}
      </span>
    </template>

    <Markdown
      v-if="block.payload?.intro"
      :source="block.payload.intro"
      size="sm"
      class="mb-4 text-text-muted"
    />

    <ol
      v-if="steps.length"
      class="flex flex-col"
    >
      <li
        v-for="(step, index) in steps"
        :key="step.n"
        class="relative flex gap-3.5 pb-5 last:pb-0"
      >
        <!-- The rail joins consecutive steps; it must not hang off the last one. -->
        <span
          v-if="index < steps.length - 1"
          class="absolute top-8 bottom-0 left-[13.5px] w-[2px] rounded-full bg-surface-track"
          aria-hidden="true"
        />

        <button
          type="button"
          class="relative z-10 mt-0.5 grid size-7 shrink-0 cursor-pointer place-items-center rounded-full font-display text-[12px] font-semibold transition"
          :class="
            done.has(step.n)
              ? 'bg-chip text-lime'
              : 'bg-surface text-text-soft shadow-[inset_0_0_0_1.5px_rgb(var(--wash-rgb)/0.14)] hover:shadow-[inset_0_0_0_1.5px_var(--lime-2)]'
          "
          :aria-pressed="done.has(step.n)"
          :aria-label="`Step ${step.n}: ${step.title}`"
          @click="toggle(step.n)"
        >
          <UiIcon
            v-if="done.has(step.n)"
            name="check"
            :size="13"
          />
          <span
            v-else
            class="num tabular-nums"
            >{{ step.n }}</span
          >
        </button>

        <div
          class="min-w-0 flex-1"
          :class="done.has(step.n) && 'opacity-55'"
        >
          <p class="font-display text-[15.5px] leading-snug font-semibold tracking-[-0.015em]">
            {{ step.title }}
          </p>

          <Markdown
            :source="step.detail_markdown"
            size="sm"
            class="mt-1.5 text-text-muted"
          />

          <p
            v-if="step.warning"
            class="mt-2.5 flex items-start gap-2 rounded-[12px] bg-warn-soft px-3 py-2.5 text-[13px] leading-relaxed text-warn-text shadow-[inset_0_0_0_1px_var(--warn-line)]"
          >
            <UiIcon
              name="warning"
              :size="13"
              class="mt-0.5 shrink-0 text-warn-bright"
            />
            <span>{{ step.warning }}</span>
          </p>

          <p
            v-if="step.check"
            class="mt-2 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-accent-strong"
          >
            <UiIcon
              name="check"
              :size="12"
              :stroke="2.2"
              class="mt-0.5 shrink-0"
            />
            <span>{{ step.check }}</span>
          </p>
        </div>
      </li>
    </ol>

    <p
      v-else
      class="text-[13px] text-text-faint italic"
    >
      No steps were generated for this walkthrough.
    </p>
  </BlockShell>
</template>

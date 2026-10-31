<script setup lang="ts">
import type { CheckResult, CodeMode, ExerciseCheck } from '~/types/api'
import { expectedOf } from '~/composables/useCodeExercise'

/**
 * The verdict list, and — before the first run — the promise list.
 *
 * Showing the declared checks BEFORE anything has run is most of the value: a
 * learner who can see what is about to be checked is writing towards a target,
 * and one who cannot is guessing until the button goes green.
 *
 * Every verdict is an icon plus an `sr-only` word. Colour alone would leave the
 * whole result unreadable to anyone who cannot separate the green tick from the
 * red cross, and this list is the entire feedback surface of the exercise.
 */
const props = defineProps<{
  mode: CodeMode
  checks: ExerciseCheck[]
  results: CheckResult[]
  /** The buffer was edited after this run; the verdicts are history, not status. */
  stale: boolean
}>()

const hasRun = computed(() => props.results.length > 0)

/** script: the case's input, shown up front. The expected OUTPUT is not. */
function inputOf(check: ExerciseCheck): string | null {
  const stdin = check.stdinCase?.stdin
  if (stdin === undefined) return null
  return stdin === '' ? '(an empty line)' : stdin
}
</script>

<template>
  <!-- Its own container: the expected/received diff has to split on the width of
       THIS list, which is a fraction of the card the outer container measures. -->
  <div :class="['@container px-3 py-2', stale ? 'opacity-60' : '']">
    <!-- Declared, not yet attempted. -->
    <ul
      v-if="!hasRun"
      class="flex flex-col"
    >
      <li
        v-for="(check, index) in checks"
        :key="index"
        class="flex gap-2.5 border-t border-code-line py-2 first:border-t-0"
      >
        <span
          class="mt-1.5 size-1.5 shrink-0 rounded-full bg-code-line"
          aria-hidden="true"
        />
        <div class="min-w-0 flex-1">
          <p class="text-[12px] leading-snug text-code-dim">{{ check.name }}</p>
          <p
            v-if="mode === 'script'"
            class="mt-0.5 font-mono text-[11px] break-words whitespace-pre-wrap text-code-meta"
          >
            input {{ inputOf(check) ?? '(none)' }}
          </p>
          <p
            v-else-if="check.test?.call"
            class="mt-0.5 font-mono text-[11px] break-words text-code-meta"
          >
            {{ check.test.call }}
            <span class="text-code-line">→</span>
            <span class="text-code-dim">{{ expectedOf(check) }}</span>
          </p>
          <p
            v-else-if="expectedOf(check)"
            class="mt-0.5 font-mono text-[11px] break-words text-code-meta"
          >
            {{ expectedOf(check) }}
          </p>
        </div>
      </li>
    </ul>

    <!-- Graded. -->
    <ul
      v-else
      class="flex flex-col"
    >
      <li
        v-for="(result, index) in results"
        :key="index"
        class="flex gap-2.5 border-t border-code-line py-2 first:border-t-0"
      >
        <UiIcon
          :name="result.passed ? 'check' : 'x'"
          :size="13"
          :class="[
            'mt-0.5 shrink-0',
            result.passed ? 'text-success-on-dark' : 'text-danger-on-dark',
          ]"
        />
        <div class="min-w-0 flex-1">
          <p class="text-[12px] leading-snug text-code-dim">
            <span class="sr-only">{{ result.passed ? 'Passed: ' : 'Failed: ' }}</span>
            {{ result.name }}
          </p>

          <p
            v-if="result.error"
            class="mt-0.5 font-mono text-[11px] leading-relaxed break-words text-danger-on-dark"
          >
            {{ result.error }}
          </p>

          <!-- script: the only mode where this thread holds both strings, so it
               is the only one that can show them side by side. -->
          <div
            v-else-if="!result.passed && mode === 'script'"
            class="mt-1.5 grid grid-cols-1 gap-1.5 @[320px]:grid-cols-2"
          >
            <div class="rounded-md border border-code-line px-2 py-1.5">
              <p class="eyebrow mb-1 text-code-meta">Expected</p>
              <pre class="font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap text-code-dim">{{ result.expected ?? '(nothing)' }}</pre>
            </div>
            <div class="rounded-md border border-danger-on-dark/30 px-2 py-1.5">
              <p class="eyebrow mb-1 text-code-meta">Your output</p>
              <pre class="font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap text-danger-on-dark">{{ result.received || '(nothing)' }}</pre>
            </div>
          </div>

          <p
            v-else-if="!result.passed && result.detail"
            class="mt-0.5 font-mono text-[11px] leading-relaxed break-words text-code-meta"
          >
            {{ result.detail }}
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>

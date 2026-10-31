<script setup lang="ts">
/**
 * The marked paper: one hairline row per question, in the order asked.
 *
 * Each row says how it went in one word, in colour only (Right, Partly,
 * Missed: never a filled badge), then the question, what they wrote, the
 * answer and a line on their own words, why a sure-but-wrong answer was
 * tempting, and where the question came from. A row still being marked is a
 * skeleton line saying so, and fills in when the mark arrives: the paper is
 * shown the moment the last answer is sent, not when the last mark is back.
 * A row whose marking failed keeps the answer and offers to try again.
 */
import type { Check } from '~/companion/types'

defineProps<{ rows: { check: Check; status: 'marked' | 'marking' | 'failed' }[] }>()
const emit = defineEmits<{ retry: [id: string] }>()

const VERDICT: Record<NonNullable<Check['result']>, { word: string; tone: string }> = {
  right: { word: 'Right', tone: 'text-success-text' },
  partly: { word: 'Partly', tone: 'text-text-soft' },
  wrong: { word: 'Missed', tone: 'text-coral-text' },
}
</script>

<template>
  <ol class="divide-y divide-border-rule border-y border-border-rule text-left">
    <li
      v-for="{ check, status } in rows"
      :key="check.id"
      class="grid gap-2 py-5"
      :aria-busy="status === 'marking' || undefined"
    >
      <p
        v-if="status === 'marked' && check.result"
        class="text-[14px] font-semibold"
        :class="VERDICT[check.result].tone"
      >
        {{ VERDICT[check.result].word }}
      </p>
      <p
        v-else-if="status === 'marking'"
        class="flex items-center gap-2.5 text-[14px] text-text-muted"
      >
        <span
          class="cp-skel h-3 w-16 rounded-full"
          aria-hidden="true"
        />
        Marking…
      </p>
      <p
        v-else
        class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] font-semibold text-coral-text"
      >
        Couldn't mark this one
        <UiBtn
          size="xs"
          @click="emit('retry', check.id)"
        >
          Try again
        </UiBtn>
      </p>

      <p class="text-[17px] leading-snug font-medium text-text">
        {{ check.prompt }}
      </p>
      <p class="text-[15px] leading-relaxed text-text-muted">
        <template v-if="check.answer?.trim()">
          You wrote: {{ check.answer }}
        </template>
        <template v-else>
          Skipped
        </template>
      </p>
      <template v-if="check.follow_up">
        <p class="text-[15px] leading-relaxed text-text-muted">
          Asked back: {{ check.follow_up.replace(/^a question back:\s*/i, '').replace(/^./, (x) => x.toUpperCase()) }}
        </p>
        <p
          v-if="check.follow_up_answer"
          class="text-[15px] leading-relaxed text-text-muted"
        >
          You said: {{ check.follow_up_answer }}
        </p>
      </template>

      <template v-if="status === 'marked'">
        <p
          v-if="check.revealed"
          class="text-[15px] leading-relaxed text-text-body"
        >
          The answer: {{ check.revealed }}
        </p>
        <p
          v-if="check.feedback"
          class="text-[15px] leading-relaxed text-text-body"
        >
          {{ check.feedback }}
        </p>
        <p
          v-if="check.tempting"
          class="text-[15px] leading-relaxed text-text-body"
        >
          Why it was tempting: {{ check.tempting }}
        </p>
        <CompanionCheckSource
          :source="check.source"
          :subject-id="check.subject_id"
          class="mt-1"
        />
        <p
          v-if="!check.cold"
          class="text-[13.5px] text-text-faint"
        >
          Practice; it counts when you do it again in a few days.
        </p>
      </template>
    </li>
  </ol>
</template>

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

const { t } = useI18n()

// The marks as pills (06-checks rubric): leaf for right, highlighter for partly, rose for missed.
const VERDICT: Record<NonNullable<Check['result']>, { tone: string }> = {
  right: { tone: 'bg-leaf-soft text-leaf-ink' },
  partly: { tone: 'bg-accent-soft text-accent-strong' },
  wrong: { tone: 'bg-rose-soft text-rose-ink' },
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
        class="inline-flex h-6 w-fit items-center rounded-full px-2.5 text-[12.5px] font-semibold"
        :class="VERDICT[check.result].tone"
      >
        {{ t(`check.paper.${check.result}`) }}
      </p>
      <p
        v-else-if="status === 'marking'"
        class="flex items-center gap-2.5 text-[14px] text-text-muted"
      >
        <span
          class="cp-skel h-3 w-16 rounded-full"
          aria-hidden="true"
        />
        {{ t('check.paper.marking') }}
      </p>
      <p
        v-else
        class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] font-semibold text-danger-text"
      >
        {{ t('check.paper.couldntMark') }}
        <UiBtn
          size="xs"
          @click="emit('retry', check.id)"
        >
          {{ t('common.retry') }}
        </UiBtn>
      </p>

      <p class="font-display text-[18px] leading-snug font-semibold tracking-[-0.015em] text-text">
        {{ check.prompt }}
      </p>
      <p class="text-[15px] leading-relaxed text-text-muted">
        <template v-if="check.answer?.trim()">
          {{ t(check.format === 'choice' || check.format === 'truefalse' ? 'check.paper.picked' : 'check.paper.wrote', { answer: check.answer }) }}
        </template>
        <template v-else>
          {{ t('check.paper.skipped') }}
        </template>
      </p>
      <template v-if="check.follow_up">
        <p class="text-[15px] leading-relaxed text-text-muted">
          {{ t('check.paper.askedBack', { question: check.follow_up.replace(/^a question back:\s*/i, '').replace(/^./, (x) => x.toUpperCase()) }) }}
        </p>
        <p
          v-if="check.follow_up_answer"
          class="text-[15px] leading-relaxed text-text-muted"
        >
          {{ t('check.paper.youSaid', { answer: check.follow_up_answer }) }}
        </p>
      </template>

      <template v-if="status === 'marked'">
        <!-- The rubric, point by point (06-checks .ck-rubric): met in leaf, what was missing on the highlighter. -->
        <ul
          v-if="check.marks?.length"
          class="grid gap-1"
          :aria-label="t('check.paper.pointByPoint')"
        >
          <li
            v-for="(m, i) in check.marks"
            :key="i"
            :class="[
              'cp-rubric flex min-h-[34px] items-center gap-2.5 rounded-[9px] px-2.5 py-1.5 text-[13.5px]',
              m.verdict === 'met' ? 'text-text-soft' : 'bg-accent-soft font-semibold text-text',
            ]"
            :style="{ animationDelay: `${i * 0.18}s` }"
          >
            <span
              :class="[
                'grid size-5 shrink-0 place-items-center rounded-full',
                m.verdict === 'met' ? 'bg-leaf-soft text-leaf-ink' : 'bg-surface text-accent-strong',
              ]"
            >
              <UiIcon
                :name="m.verdict === 'missed' ? 'x' : 'check'"
                :size="12"
                :stroke="2.8"
              />
            </span>
            <span class="min-w-0 flex-1 leading-snug">{{ m.point }}</span>
            <b
              :class="[
                'num shrink-0 text-[12.5px] font-semibold',
                m.verdict === 'met' ? 'text-leaf-ink' : 'text-accent-strong',
              ]"
            >{{ m.verdict === 'met' ? '1/1' : m.verdict === 'partly' ? '½' : '0/1' }}</b>
          </li>
        </ul>
        <p
          v-if="check.revealed"
          class="text-[15px] leading-relaxed text-text-body"
        >
          {{ t('check.paper.theAnswer', { answer: check.revealed }) }}
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
          {{ t('check.paper.tempting', { why: check.tempting }) }}
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
          {{ t('check.paper.practice') }}
        </p>
      </template>
    </li>
  </ol>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .cp-rubric {
    animation: cp-rubric-in 0.4s var(--ease) both;
  }
}

@keyframes cp-rubric-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}
</style>

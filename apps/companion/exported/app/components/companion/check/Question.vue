<script setup lang="ts">
/**
 * One question of a check: practice's card, answered in words.
 *
 * The card says which course and topic (muted), the question in the display
 * face, a hint by kind ("In your own words", "Work it out", "Explain why"),
 * and a field that grows as they write. Where it came from is not shown:
 * the slide's title would give the answer away. It's on the marked paper.
 *
 * Sending is the confidence tap. "How sure are you?" with Sure, Think so and
 * Guessing: each one sends, so saying how sure you are costs nothing extra
 * and is never skipped. The three look alike on purpose:
 * a filled "Sure" reads as the expected answer and would skew the very
 * calibration it measures. They wait for something to be written; "I don't
 * know" sends nothing, and that's allowed.
 *
 * A teach-back is the exception: after the explanation the listener thinks
 * of one question back ("Thinking of a question…"), and that gets its own
 * field and a plain Send, with no confidence: it's a conversation, not a
 * test.
 *
 * Keys: ⌘/Ctrl+Enter in the field moves to the confidence row (or sends the
 * reply); 1, 2 and 3 pick a button once the field isn't focused.
 *
 * A `choice` or `truefalse` question (Daylight 2, gaps) is picked rather than
 * written: its options are pressable rows, the pick is the answer (its exact
 * text), and the same confidence row sends it.
 */
import type { Check, CheckConfidence } from '~/companion/types'
import { courseColor } from '~/companion/colors'

const props = defineProps<{
  check: Check
  topic: string | null
  color: string | null | undefined
  /** `answer`: the question. `thinking`: a teach-back waiting for its question back. `reply`: answering it. */
  step: 'answer' | 'thinking' | 'reply'
  /** The question back couldn't be fetched. */
  failed?: boolean
}>()

const emit = defineEmits<{
  send: [confidence: CheckConfidence]
  skip: []
  reply: []
  retry: []
}>()

const answer = defineModel<string>('answer', { default: '' })
const reply = defineModel<string>('reply', { default: '' })

const { t } = useI18n()

const SURE: { value: CheckConfidence; key: string }[] = [
  { value: 'sure', key: '1' },
  { value: 'think', key: '2' },
  { value: 'guess', key: '3' },
]

const field = ref<HTMLTextAreaElement | null>(null)
const replyField = ref<HTMLTextAreaElement | null>(null)
const row = ref<HTMLElement | null>(null)

const written = computed(() => answer.value.trim().length > 0)

/** A question answered by picking (06-checks): four options, or True and False. */
const options = computed(() =>
  props.check.format === 'choice' || props.check.format === 'truefalse' ? (props.check.options ?? []) : [],
)
const KEYS = ['A', 'B', 'C', 'D', 'E', 'F']
const keyOf = (option: string, index: number) =>
  props.check.format === 'truefalse' ? option.charAt(0).toUpperCase() : (KEYS[index] ?? String(index + 1))
const back = computed(() => {
  const q = (props.check.follow_up ?? '').replace(/^a question back:\s*/i, '')
  return q.charAt(0).toUpperCase() + q.slice(1)
})

/** Taller as they write, so a long answer never scrolls inside a box. */
function grow(event: Event): void {
  const el = event.target as HTMLTextAreaElement
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

/** Recording: words said out loud go after anything typed, and the field grows to fit them. */
function said(words: string): void {
  answer.value = answer.value.trim() ? `${answer.value.trim()}\n\n${words}` : words
  void nextTick(() => field.value && grow({ target: field.value } as unknown as Event))
}

function onFieldKey(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey) || event.isComposing) return
  event.preventDefault()
  if (props.step === 'reply') {
    if (reply.value.trim()) emit('reply')
    return
  }
  if (written.value) row.value?.querySelector<HTMLButtonElement>('button')?.focus()
}

function onKey(event: KeyboardEvent): void {
  const el = event.target as HTMLElement | null
  if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA'].includes(el.tagName))) return
  if (event.metaKey || event.ctrlKey || event.altKey || props.step !== 'answer' || !written.value) return
  const pick = SURE.find((s) => s.key === event.key)
  if (pick) {
    event.preventDefault()
    emit('send', pick.value)
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// A new question starts with the caret in its field; the question back, in its own.
watch(
  () => [props.check.id, props.step] as const,
  () => nextTick(() => (props.step === 'reply' ? replyField.value : field.value)?.focus({ preventScroll: true })),
  { immediate: true },
)
</script>

<template>
  <article
    class="grid min-h-[340px] content-start gap-4 rounded-[18px] bg-surface p-5 shadow-[0_0_0_1px_var(--border),var(--shadow-raised)] min-[900px]:min-h-[400px] min-[900px]:p-8"
  >
    <p class="flex min-w-0 items-center gap-2 text-[12.5px] font-semibold text-text-muted">
      <span
        class="size-2 shrink-0 rounded-full"
        :style="{ background: courseColor(color) }"
      />
      <span class="truncate">{{ topic }}</span>
    </p>
    <h1 class="font-display text-[22px] leading-[1.18] font-semibold tracking-[-0.025em] text-balance text-text min-[900px]:text-[28px]">
      {{ check.prompt }}
    </h1>

    <!-- Picked, not written: answers that look like buttons you press (06-checks .ck-opts). -->
    <template v-if="step === 'answer' && options.length">
      <p
        :id="`check-${check.id}-hint`"
        class="-mb-1 text-[13px] font-medium text-text-muted"
      >
        {{ check.format === 'truefalse' ? t('check.q.trueFalse') : t('check.q.pickOne') }}
      </p>
      <div
        :class="['grid gap-2', check.format === 'truefalse' && 'grid-cols-2']"
        role="radiogroup"
        :aria-labelledby="`check-${check.id}-hint`"
      >
        <button
          v-for="(option, index) in options"
          :key="option"
          type="button"
          role="radio"
          :aria-checked="answer === option"
          :class="[
            'flex min-h-[50px] cursor-pointer items-center gap-3 rounded-[12px] bg-surface px-3.5 py-2.5 text-left text-[15px] font-semibold text-text transition-[box-shadow,transform] duration-200 ease-[var(--ease)]',
            answer === option
              ? 'shadow-[0_0_0_1.5px_var(--text),var(--shadow-raised)]'
              : 'shadow-[0_0_0_1px_var(--border-strong),var(--shadow-card)] hover:-translate-y-px hover:shadow-[0_0_0_1.5px_var(--text),var(--shadow-raised)] active:translate-y-0',
          ]"
          @click="answer = option"
        >
          <span class="grid h-6 min-w-6 shrink-0 place-items-center rounded-[7px] bg-[rgb(var(--wash-rgb)/0.065)] px-1 text-[12px] font-bold text-text-soft">{{ keyOf(option, index) }}</span>
          <span class="min-w-0 flex-1 leading-[1.35]">{{ option }}</span>
          <span
            :class="[
              'grid size-[18px] shrink-0 place-items-center rounded-full transition-[background-color,box-shadow] duration-200',
              answer === option ? 'bg-inverse' : 'shadow-[inset_0_0_0_1.5px_var(--border-strong)]',
            ]"
            aria-hidden="true"
          >
            <span
              v-if="answer === option"
              class="size-1.5 rounded-full bg-on-inverse"
            />
          </span>
        </button>
      </div>
    </template>

    <template v-else-if="step === 'answer'">
      <label
        :for="`check-${check.id}`"
        class="-mb-2 text-[13px] font-medium text-text-muted"
      >{{ t(`check.hint.${check.kind}`) }}</label>
      <textarea
        :id="`check-${check.id}`"
        ref="field"
        v-model="answer"
        :rows="check.kind === 'explain' ? 8 : 4"
        :placeholder="t('check.q.yourAnswer')"
        class="block w-full resize-none rounded-[12px] bg-surface px-3.5 py-3 text-[15.5px] leading-[1.5] text-text caret-brand shadow-[0_0_0_1px_var(--border-strong)] outline-none transition-shadow placeholder:text-text-faint focus:shadow-[0_0_0_1.5px_var(--text)]"
        @input="grow"
        @keydown="onFieldKey"
      />
      <!-- Recording: on the desktop a teach-back can be said instead; the words land in the box above. -->
      <CompanionRecordingExplainAloud
        v-if="check.kind === 'explain'"
        :check="check"
        :topic="topic"
        @text="said"
      />
    </template>

    <template v-else>
      <hr class="border-border-rule">
      <p class="text-[16px] leading-relaxed text-text-muted">
        {{ t('check.q.explained') }} {{ step === 'thinking' ? '' : t('check.q.oneBack') }}
      </p>
      <p
        v-if="step === 'thinking' && !failed"
        class="flex items-center gap-2.5 text-[17px] text-text-body"
        aria-live="polite"
      >
        <UiIcon
          name="loader"
          :size="16"
          class="animate-spin-slow text-text-muted"
        />
        {{ t('check.q.thinking') }}
      </p>
      <div
        v-else-if="failed"
        class="grid justify-items-start gap-2"
        aria-live="polite"
      >
        <p class="text-[16px] text-danger-text">
          {{ t('check.q.thinkFailed') }}
        </p>
        <UiBtn
          size="sm"
          @click="emit('retry')"
        >
          {{ t('common.retry') }}
        </UiBtn>
      </div>
      <template v-else>
        <p class="text-[20px] leading-snug font-medium text-text min-[900px]:text-[22px]">
          {{ back }}
        </p>
        <textarea
          ref="replyField"
          v-model="reply"
          rows="4"
          :placeholder="t('check.q.yourAnswer')"
          :aria-label="t('check.q.replyAria')"
          class="block w-full resize-none rounded-[12px] bg-surface px-3.5 py-3 text-[15.5px] leading-[1.5] text-text caret-brand shadow-[0_0_0_1px_var(--border-strong)] outline-none transition-shadow placeholder:text-text-faint focus:shadow-[0_0_0_1.5px_var(--text)]"
          @input="grow"
          @keydown="onFieldKey"
        />
      </template>
    </template>
  </article>

  <!-- Low on a phone, where the thumb already is. -->
  <div class="mt-auto pt-5 min-[900px]:mt-6 min-[900px]:pt-0">
    <div
      v-if="step === 'answer'"
      class="grid gap-3"
    >
      <p
        id="check-sure"
        class="text-center text-[14px] font-semibold text-text"
      >
        {{ t('check.q.howSure') }}
      </p>
      <div
        ref="row"
        class="grid grid-cols-3 gap-2"
        role="group"
        aria-labelledby="check-sure"
      >
        <!-- Answers that look like buttons you press (06-checks .ck-opts): a key, the word, a lift on hover. -->
        <button
          v-for="s in SURE"
          :key="s.value"
          type="button"
          class="flex min-h-[50px] cursor-pointer items-center justify-center gap-2.5 rounded-[12px] bg-surface px-2 text-[15px] font-semibold text-text shadow-[0_0_0_1px_var(--border-strong),var(--shadow-card)] transition-[box-shadow,transform] duration-200 ease-[var(--ease)] enabled:hover:-translate-y-px enabled:hover:shadow-[0_0_0_1.5px_var(--text),var(--shadow-raised)] enabled:active:translate-y-0 disabled:cursor-default disabled:opacity-40"
          :disabled="!written"
          :aria-keyshortcuts="s.key"
          @click="emit('send', s.value)"
        >
          <span class="grid h-5 min-w-5 place-items-center rounded-[6px] bg-[rgb(var(--wash-rgb)/0.065)] px-1 text-[11.5px] font-bold text-text-soft max-[899px]:hidden">{{ s.key }}</span>
          {{ t(`check.sure.${s.value}`) }}
        </button>
      </div>
      <div class="flex items-center justify-center gap-3">
        <button
          type="button"
          class="cursor-pointer rounded-full px-3 py-2 text-[14.5px] font-medium text-text-muted underline-offset-4 hover:text-text hover:underline"
          :title="t('check.q.skip')"
          @click="emit('skip')"
        >
          {{ t('check.q.dontKnow') }}
        </button>
      </div>
      <p class="hidden text-center text-[13px] text-text-muted min-[900px]:block">
        {{ t('check.q.keys') }}
      </p>
    </div>
    <UiBtn
      v-else-if="step === 'reply'"
      variant="primary"
      size="lg"
      block
      :disabled="!reply.trim()"
      @click="emit('reply')"
    >
      {{ t('check.q.send') }}
    </UiBtn>
  </div>
</template>

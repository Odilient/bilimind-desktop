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

const HINT: Record<Check['kind'], string> = {
  recall: 'In your own words',
  apply: 'Work it out',
  why: 'Explain why',
  explain: 'Take 2 to 5 minutes. Type it the way you would say it.',
}

const SURE: { value: CheckConfidence; label: string; key: string }[] = [
  { value: 'sure', label: 'Sure', key: '1' },
  { value: 'think', label: 'Think so', key: '2' },
  { value: 'guess', label: 'Guessing', key: '3' },
]

const field = ref<HTMLTextAreaElement | null>(null)
const replyField = ref<HTMLTextAreaElement | null>(null)
const row = ref<HTMLElement | null>(null)

const written = computed(() => answer.value.trim().length > 0)
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
    class="grid min-h-[340px] content-start gap-5 rounded-[24px] border border-border bg-surface p-6 min-[900px]:min-h-[400px] min-[900px]:p-10"
  >
    <p class="flex min-w-0 items-center gap-2 text-[14px] text-text-muted">
      <span
        class="size-2 shrink-0 rounded-full"
        :style="{ background: courseColor(color) }"
      />
      <span class="truncate">{{ topic }}</span>
    </p>
    <h1 class="t-head text-[26px] leading-snug min-[900px]:text-[34px]">
      {{ check.prompt }}
    </h1>

    <template v-if="step === 'answer'">
      <label
        :for="`check-${check.id}`"
        class="-mb-3 text-[14px] text-text-muted"
      >{{ HINT[check.kind] }}</label>
      <textarea
        :id="`check-${check.id}`"
        ref="field"
        v-model="answer"
        :rows="check.kind === 'explain' ? 8 : 4"
        placeholder="Your answer"
        class="block w-full resize-none rounded-[16px] border border-border-strong bg-surface px-4 py-3 text-[17px] leading-[1.55] text-text caret-cobalt outline-none placeholder:text-text-faint focus:border-ink"
        @input="grow"
        @keydown="onFieldKey"
      />
    </template>

    <template v-else>
      <hr class="border-border-rule">
      <p class="text-[16px] leading-relaxed text-text-muted">
        You explained it. {{ step === 'thinking' ? '' : 'One question back, as a classmate would ask:' }}
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
        Thinking of a question…
      </p>
      <div
        v-else-if="failed"
        class="grid justify-items-start gap-2"
        aria-live="polite"
      >
        <p class="text-[16px] text-coral-text">
          Couldn't think of a question just now.
        </p>
        <UiBtn
          size="sm"
          @click="emit('retry')"
        >
          Try again
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
          placeholder="Your answer"
          aria-label="Your answer to the question back"
          class="block w-full resize-none rounded-[16px] border border-border-strong bg-surface px-4 py-3 text-[17px] leading-[1.55] text-text caret-cobalt outline-none placeholder:text-text-faint focus:border-ink"
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
        class="text-center text-[15px] font-medium text-text"
      >
        How sure are you?
      </p>
      <div
        ref="row"
        class="grid grid-cols-3 gap-2"
        role="group"
        aria-labelledby="check-sure"
      >
        <button
          v-for="s in SURE"
          :key="s.value"
          type="button"
          class="grid min-h-[52px] place-items-center rounded-[18px] border border-border-strong bg-surface px-1 text-[16px] font-semibold text-text transition-colors enabled:hover:border-ink enabled:hover:bg-surface-mute disabled:cursor-default disabled:opacity-40"
          :disabled="!written"
          :aria-keyshortcuts="s.key"
          @click="emit('send', s.value)"
        >
          {{ s.label }}
        </button>
      </div>
      <div class="flex items-center justify-center gap-3">
        <button
          type="button"
          class="cursor-pointer rounded-full px-3 py-2 text-[14.5px] font-medium text-text-muted underline-offset-4 hover:text-text hover:underline"
          title="Skip"
          @click="emit('skip')"
        >
          I don't know
        </button>
      </div>
      <p class="hidden text-center text-[14px] text-text-muted min-[900px]:block">
        Each one sends your answer. Keys 1 to 3 work too.
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
      Send
    </UiBtn>
  </div>
</template>

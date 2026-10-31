<script setup lang="ts">
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'

/**
 * A practice question written into the notes: multiple choice or a short
 * answer, checked right here with no server round trip. It opens in writing
 * mode while it's empty and in answering mode once it has a question, which
 * is how a page reads a week later when it's time to revise.
 */
const props = defineProps(nodeViewProps)

type Mode = 'choice' | 'short'

const mode = computed<Mode>(() => (props.node.attrs.mode === 'short' ? 'short' : 'choice'))
const prompt = computed(() => String(props.node.attrs.prompt ?? ''))
const explanation = computed(() => String(props.node.attrs.explanation ?? ''))
const options = computed<string[]>(() => {
  const raw = props.node.attrs.options
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }
  return []
})
const answer = computed(() => props.node.attrs.answer)
/** The options worth showing, keeping each one's index so `answer` still points at it. */
const shown = computed(() => options.value.map((text, i) => ({ text, i })).filter((o) => o.text.trim()))

const ready = computed(() => {
  if (!prompt.value.trim()) return false
  if (mode.value === 'short') return String(answer.value ?? '').trim() !== ''
  const filled = options.value.filter((o) => o.trim()).length
  return filled >= 2 && typeof answer.value === 'number' && options.value[answer.value]?.trim() !== ''
})

const editing = ref(props.editor.isEditable && !ready.value)
const picked = ref<number | null>(null)
const typed = ref('')
const checked = ref(false)

const correct = computed(() => {
  if (mode.value === 'choice') return picked.value !== null && picked.value === answer.value
  const accepted = String(answer.value ?? '')
    .split('|')
    .map(normalise)
    .filter(Boolean)
  return accepted.includes(normalise(typed.value))
})

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,;:!?'"`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function set(attrs: Record<string, unknown>): void {
  props.updateAttributes(attrs)
}

function setOption(i: number, value: string): void {
  const next = [...options.value]
  next[i] = value
  set({ options: next })
}

function addOption(): void {
  set({ options: [...options.value, ''] })
}

function removeOption(i: number): void {
  const next = options.value.filter((_, j) => j !== i)
  const a = typeof answer.value === 'number' ? answer.value : null
  set({ options: next, answer: a === null ? null : a === i ? null : a > i ? a - 1 : a })
}

function switchMode(next: Mode): void {
  if (next === mode.value) return
  set({ mode: next, answer: null, options: next === 'choice' ? ['', '', ''] : [] })
}

function pick(i: number): void {
  if (checked.value && correct.value) return
  picked.value = i
  checked.value = true
}

function check(): void {
  if (!typed.value.trim()) return
  checked.value = true
}

function retry(): void {
  picked.value = null
  typed.value = ''
  checked.value = false
}

function done(): void {
  editing.value = false
  retry()
}
</script>

<template>
  <NodeViewWrapper
    class="pg-question"
  >
    <div
      class="pg-question-head"
      contenteditable="false"
    >
      <span
        class="pg-kind"
        data-drag-handle
      >{{ mode === 'choice' ? 'Question' : 'Short answer' }}</span>
      <button
        v-if="editor.isEditable"
        type="button"
        class="pg-link-btn"
        @click="editing ? done() : (editing = true)"
      >
        {{ editing ? (ready ? 'Done' : 'Practise') : 'Edit' }}
      </button>
    </div>

    <!-- Writing it -->
    <div
      v-if="editing"
      class="pg-question-edit"
      contenteditable="false"
    >
      <div
        class="pg-seg"
        role="radiogroup"
        aria-label="Kind of question"
      >
        <button
          type="button"
          role="radio"
          :aria-checked="mode === 'choice'"
          :class="{ on: mode === 'choice' }"
          @click="switchMode('choice')"
        >
          Multiple choice
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="mode === 'short'"
          :class="{ on: mode === 'short' }"
          @click="switchMode('short')"
        >
          Short answer
        </button>
      </div>
      <textarea
        :value="prompt"
        class="pg-field pg-question-prompt"
        rows="2"
        placeholder="The question"
        aria-label="The question"
        @input="set({ prompt: ($event.target as HTMLTextAreaElement).value })"
      />
      <template v-if="mode === 'choice'">
        <div
          v-for="(option, i) in options"
          :key="i"
          class="pg-option-edit"
        >
          <button
            type="button"
            class="pg-correct"
            :class="{ on: answer === i }"
            :aria-label="answer === i ? 'The right answer' : 'Mark as the right answer'"
            :aria-pressed="answer === i"
            @click="set({ answer: i })"
          >
            <UiIcon
              name="check"
              :size="12"
              :stroke="2.2"
            />
          </button>
          <input
            :value="option"
            class="pg-field"
            :placeholder="`Option ${i + 1}`"
            :aria-label="`Option ${i + 1}`"
            @input="setOption(i, ($event.target as HTMLInputElement).value)"
          >
          <button
            v-if="options.length > 2"
            type="button"
            class="pg-icon-btn"
            aria-label="Remove this option"
            @click="removeOption(i)"
          >
            <UiIcon
              name="x"
              :size="13"
            />
          </button>
        </div>
        <button
          v-if="options.length < 6"
          type="button"
          class="pg-link-btn"
          @click="addOption"
        >
          Add an option
        </button>
      </template>
      <input
        v-else
        :value="String(answer ?? '')"
        class="pg-field"
        placeholder="The answer (several? separate them with |)"
        aria-label="Accepted answers"
        @input="set({ answer: ($event.target as HTMLInputElement).value })"
      >
      <textarea
        :value="explanation"
        class="pg-field"
        rows="2"
        placeholder="Why, shown after answering (optional)"
        aria-label="Explanation"
        @input="set({ explanation: ($event.target as HTMLTextAreaElement).value })"
      />
    </div>

    <!-- Answering it -->
    <div
      v-else
      class="pg-question-run"
      contenteditable="false"
    >
      <p class="pg-question-q">
        {{ prompt || 'An empty question' }}
      </p>
      <div
        v-if="mode === 'choice'"
        class="pg-options"
      >
        <button
          v-for="option in shown"
          :key="option.i"
          type="button"
          class="pg-option"
          :class="{
            'is-right': checked && option.i === answer && correct,
            'is-wrong': checked && picked === option.i && !correct,
          }"
          @click="pick(option.i)"
        >
          {{ option.text }}
        </button>
      </div>
      <form
        v-else
        class="pg-short"
        @submit.prevent="check"
      >
        <input
          v-model="typed"
          class="pg-field"
          placeholder="Your answer"
          aria-label="Your answer"
          @input="checked = false"
        >
        <button
          type="submit"
          class="pg-btn"
        >
          Check
        </button>
      </form>
      <p
        v-if="checked"
        class="pg-verdict"
        :class="correct ? 'is-right' : 'is-wrong'"
        role="status"
      >
        <b>{{ correct ? 'Right.' : mode === 'short' ? `Not quite. The answer: ${String(answer ?? '').split('|')[0]}.` : 'Not that one.' }}</b>
        <span v-if="explanation && (correct || mode === 'short')">{{ ` ${explanation}` }}</span>
        <button
          v-if="!correct && mode === 'choice'"
          type="button"
          class="pg-link-btn"
          @click="retry"
        >
          Try again
        </button>
      </p>
    </div>
  </NodeViewWrapper>
</template>

<script setup lang="ts">
import type { DialogueBlock } from '~/types/api'
import { ApiError } from '~/composables/useApi'
import BlockShell from './BlockShell.vue'

/**
 * "Role-play" — a spoken conversation with an in-character AI tutor toward a goal.
 *
 * The tutor speaks (server TTS via {@link useAudio}); the learner answers by voice
 * ({@link useSpeech}) or by typing. Each learner turn goes to `/speech/dialogue`,
 * which replies in character, may add a gentle correction, and signals when the
 * goal has been reached. The scene (roles, goal) lives in the block payload and is
 * re-read server-side, so the client only sends the running transcript.
 */
const props = defineProps<{ block: DialogueBlock; language?: string; level?: string }>()

interface Turn {
  role: 'assistant' | 'learner'
  content: string
  correction?: string | null
}

interface DialogueReply {
  reply: string
  correction?: string | null
  goal_met: boolean
}

const api = useApi()
const audio = useAudio()
const speech = useSpeech()

const scene = computed(() => props.block.payload)

/** The conversation's own language wins over the course language for voice + recognition. */
const lang = computed(() => scene.value?.language ?? props.language)

const turns = ref<Turn[]>([])
const input = ref('')
const started = ref(false)
const sending = ref(false)
const done = ref(false)
const error = ref<string | null>(null)

function start(): void {
  started.value = true
  const opener = scene.value?.opening_line?.trim()
  if (opener) {
    turns.value.push({ role: 'assistant', content: opener })
    void audio.play({ text: opener, language: lang.value })
  }
}

async function send(text: string): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed || sending.value || done.value) return

  error.value = null
  turns.value.push({ role: 'learner', content: trimmed })
  input.value = ''
  sending.value = true

  const history = turns.value.slice(0, -1).map((t) => ({ role: t.role, content: t.content }))

  try {
    const res = await api.post<DialogueReply>('/speech/dialogue', {
      node_id: props.block.node_id,
      block_id: props.block.id,
      text: trimmed,
      history,
    })

    const learnerTurn = turns.value[turns.value.length - 1]
    if (learnerTurn && res.correction) learnerTurn.correction = res.correction

    if (res.reply) {
      turns.value.push({ role: 'assistant', content: res.reply })
      await audio.play({ text: res.reply, language: lang.value })
    }
    if (res.goal_met) done.value = true
  } catch (err) {
    error.value =
      err instanceof ApiError ? err.message : 'The tutor is unavailable right now. Try again in a moment.'
  } finally {
    sending.value = false
  }
}

function toggleRecord(): void {
  if (speech.listening.value) {
    speech.stop()
    return
  }
  void recordReply()
}

async function recordReply(): Promise<void> {
  try {
    const heard = await speech.start({ language: lang.value })
    if (heard) await send(heard)
  } catch {
    /* Surfaced through speech.error. */
  }
}

function replay(text: string): void {
  void audio.play({ text, language: lang.value })
}
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <div class="rounded-[14px] bg-surface-mute px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--border)]">
      <p
        v-if="scene?.scenario_markdown"
        class="text-[14px] leading-relaxed whitespace-pre-line text-text-body"
      >
        {{ scene.scenario_markdown }}
      </p>
      <p class="mt-2 text-[12.5px] text-text-soft">
        You are the <strong class="font-semibold text-text">{{ scene?.learner_role }}</strong
        >; you're talking to the
        <strong class="font-semibold text-text">{{ scene?.ai_role }}</strong
        >.
      </p>
      <!-- The goal as the story's goal pill: grey while open, lime once met. -->
      <p
        class="mt-2.5 inline-flex max-w-full items-start gap-2 rounded-[14px] py-1 pr-3 pl-1 text-[12.5px] font-semibold"
        :class="done ? 'bg-accent-soft text-accent-strong' : 'bg-surface-sunken text-text-soft'"
      >
        <span
          class="grid size-[18px] shrink-0 place-items-center rounded-full"
          :class="done ? 'bg-accent text-on-accent' : 'bg-surface text-text-ghost'"
        >
          <UiIcon
            :name="done ? 'check' : 'target'"
            :size="10"
            :stroke="2.4"
          />
        </span>
        <span class="pt-px">Goal: {{ scene?.goal }}</span>
      </p>
    </div>

    <div
      v-if="!started"
      class="mt-3.5"
    >
      <UiBtn
        variant="primary"
        size="sm"
        icon="play"
        @click="start"
      >
        Start the conversation
      </UiBtn>
    </div>

    <template v-else>
      <div class="mt-3.5 flex flex-col gap-2.5">
        <div
          v-for="(turn, index) in turns"
          :key="index"
          :class="turn.role === 'learner' ? 'flex flex-col items-end' : 'flex flex-col items-start'"
        >
          <div
            :class="[
              'max-w-[85%] rounded-[16px] px-3.5 py-2.5 text-[14px] leading-relaxed',
              turn.role === 'learner'
                ? 'rounded-br-[5px] bg-brand text-white dark:bg-brand-strong'
                : 'rounded-bl-[5px] bg-surface-sunken text-text-body',
            ]"
          >
            <div class="flex items-start gap-2">
              <span class="min-w-0">{{ turn.content }}</span>
              <button
                v-if="turn.role === 'assistant'"
                type="button"
                class="mt-0.5 shrink-0 text-text-faint hover:text-brand"
                aria-label="Replay"
                @click="replay(turn.content)"
              >
                <UiIcon
                  name="play"
                  :size="13"
                />
              </button>
            </div>
          </div>
          <p
            v-if="turn.correction"
            class="mt-1.5 flex max-w-[85%] items-start gap-1.5 rounded-[10px] bg-warn-soft px-2.5 py-1.5 text-[12.5px] leading-relaxed text-warn-text"
          >
            <UiIcon
              name="pencil"
              :size="12"
              class="mt-0.5 shrink-0 text-warn-bright"
            />
            <span>{{ turn.correction }}</span>
          </p>
        </div>

        <p
          v-if="sending"
          class="flex items-center gap-1.5 text-[12.5px] text-text-faint"
        >
          <UiIcon
            name="loader"
            :size="13"
            class="animate-spin-slow"
          />
          {{ scene?.ai_role }} is replying…
        </p>
      </div>

      <div
        v-if="done"
        class="mt-3.5 flex items-center gap-2.5 rounded-[14px] bg-accent-soft px-4 py-3 text-[13.5px] font-medium text-accent-strong shadow-[inset_0_0_0_1px_var(--accent-line)]"
      >
        <span class="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-on-accent">
          <UiIcon
            name="check"
            :size="13"
            :stroke="2.4"
          />
        </span>
        <span>Goal reached — nicely done. You can keep chatting or move on.</span>
      </div>

      <div
        v-if="scene?.hints && scene.hints.length && !done"
        class="mt-3 flex flex-wrap gap-1.5"
      >
        <button
          v-for="(hint, hi) in scene.hints"
          :key="hi"
          type="button"
          class="rounded-full bg-surface px-3 py-1.5 text-[12px] text-text-soft shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.1)] hover:text-brand hover:shadow-[inset_0_0_0_1px_var(--brand-line)]"
          @click="input = hint"
        >
          {{ hint }}
        </button>
      </div>

      <form
        v-if="!done"
        class="mt-3 flex items-center gap-2"
        @submit.prevent="send(input)"
      >
        <UiBtn
          :variant="speech.listening.value ? 'primary' : 'secondary'"
          size="sm"
          square
          :label="speech.listening.value ? 'Stop recording' : 'Speak your reply'"
          :icon="speech.listening.value ? 'x' : 'mic'"
          :loading="speech.busy.value"
          @click="toggleRecord"
        />
        <input
          v-model="input"
          type="text"
          :placeholder="`Reply in ${lang ? lang : 'the target language'}…`"
          class="h-9 min-w-0 flex-1 rounded-full border border-border-field bg-surface px-4 text-[13.5px] outline-none focus:border-lime-2 focus:shadow-[0_0_0_4px_rgb(198_242_78/0.45)]"
          :disabled="sending"
        />
        <UiBtn
          type="submit"
          variant="primary"
          size="sm"
          square
          label="Send"
          icon="send"
          :loading="sending"
          :disabled="!input.trim()"
        />
      </form>

      <p
        v-if="speech.error.value || error"
        class="mt-2.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-warn"
      >
        <UiIcon
          name="alert"
          :size="12"
          class="mt-0.5"
        />
        <span>{{ speech.error.value || error }}</span>
      </p>
    </template>
  </BlockShell>
</template>

<script setup lang="ts">
import type { SpeakingBlock } from '~/types/api'
import type { PronunciationScore } from '~/composables/useSpeech'
import BlockShell from './BlockShell.vue'

/**
 * "Speak" — repeat-after / shadowing. Each phrase is played in a native voice
 * (the server's Edge TTS, reused from {@link useAudio}), the learner records
 * themselves ({@link useSpeech} — browser recognition, or a server-Whisper
 * fallback), and gets an instant word-level score with an optional coaching tip.
 *
 * Scoring is done on the client, so the feedback is immediate and free; only the
 * one-line "Why?" tip calls the server.
 */
const props = defineProps<{ block: SpeakingBlock; language?: string; level?: string }>()

const audio = useAudio()
const speech = useSpeech()

const items = computed(() => props.block.payload?.items ?? [])

/** The phrases' own language wins over the course language for voice + recognition. */
const lang = computed(() => props.block.payload?.language ?? props.language)

interface Attempt {
  heard: string
  score: PronunciationScore
  tip?: string | null
  loadingTip?: boolean
}

const attempts = reactive<Record<number, Attempt>>({})
const playingIndex = ref<number | null>(null)
const recordingIndex = ref<number | null>(null)

watch(
  () => audio.playing.value,
  (isPlaying) => {
    if (!isPlaying) playingIndex.value = null
  },
)

async function play(index: number): Promise<void> {
  if (playingIndex.value === index && audio.playing.value) {
    audio.pause()
    return
  }
  playingIndex.value = index
  await audio.play({ text: items.value[index]?.text ?? '', language: lang.value })
}

function toggleRecord(index: number): void {
  if (speech.listening.value) {
    speech.stop()
    return
  }
  void record(index)
}

async function record(index: number): Promise<void> {
  recordingIndex.value = index
  try {
    const heard = await speech.start({ language: lang.value })
    attempts[index] = { heard, score: speech.score(items.value[index]?.text ?? '', heard) }
  } catch {
    /* Permission/mic errors surface through speech.error. */
  } finally {
    recordingIndex.value = null
  }
}

async function explain(index: number): Promise<void> {
  const attempt = attempts[index]
  const phrase = items.value[index]?.text
  if (!attempt || !attempt.heard || !phrase) return

  attempt.loadingTip = true
  attempt.tip = await speech.coach(phrase, attempt.heard, lang.value)
  if (!attempt.tip) attempt.tip = 'No tip this time — keep going.'
  attempt.loadingTip = false
}

function scoreTone(score: number): string {
  /* Cobalt's score pills: lime when it landed, coral-soft when it did not. */
  if (score >= 80) return 'bg-lime text-ink'
  if (score >= 50) return 'bg-warn-soft text-warn-text'
  return 'bg-danger-soft text-danger-text'
}
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <p
      v-if="block.payload?.intro_markdown"
      class="mb-4 text-[14px] leading-relaxed whitespace-pre-line text-text-soft"
    >
      {{ block.payload.intro_markdown }}
    </p>

    <div class="flex flex-col gap-2.5">
      <div
        v-for="(item, index) in items"
        :key="index"
        class="rounded-[14px] bg-surface-mute px-4 py-3.5 shadow-[inset_0_0_0_1px_var(--border)]"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-display text-[16.5px] leading-snug font-semibold tracking-[-0.015em]">
              {{ item.text }}
            </p>
            <p
              v-if="item.translation"
              class="mt-1 text-[12.5px] text-text-faint"
            >
              {{ item.translation }}
            </p>
            <p
              v-if="item.phonetic"
              class="mt-0.5 text-[12px] text-brand"
            >
              /{{ item.phonetic }}/
            </p>
          </div>

          <div class="flex shrink-0 items-center gap-1.5">
            <UiBtn
              variant="ghost"
              size="sm"
              square
              label="Play the phrase"
              :icon="playingIndex === index && audio.playing.value ? 'pause' : 'play'"
              :loading="playingIndex === index && audio.loading.value"
              @click="play(index)"
            />
            <!-- Recording turns the pill ink with a coral mic: cobalt's "rec". -->
            <UiBtn
              :variant="recordingIndex === index ? 'primary' : 'secondary'"
              size="sm"
              :icon="recordingIndex === index ? 'x' : 'mic'"
              :class="recordingIndex === index && '[&_svg]:text-coral'"
              :loading="recordingIndex === index && speech.busy.value"
              :disabled="recordingIndex !== null && recordingIndex !== index"
              @click="toggleRecord(index)"
            >
              {{ recordingIndex === index ? (speech.busy.value ? 'Checking' : 'Stop') : 'Speak' }}
            </UiBtn>
          </div>
        </div>

        <div
          v-if="attempts[index]"
          class="mt-3 border-t border-dashed border-border-strong pt-3"
        >
          <template v-if="attempts[index]!.heard">
            <div class="flex flex-wrap items-center gap-2">
              <span
                :class="[
                  'inline-flex h-6 items-center rounded-full px-2.5 font-display text-[12px] font-semibold',
                  scoreTone(attempts[index]!.score.score),
                ]"
              >
                {{ attempts[index]!.score.score }}%
              </span>
              <span class="text-[12px] text-text-faint">
                heard: “{{ attempts[index]!.heard }}”
              </span>
            </div>

            <div class="mt-2 flex flex-wrap gap-x-2 gap-y-1">
              <span
                v-for="(w, wi) in attempts[index]!.score.words"
                :key="wi"
                :class="[
                  'text-[14.5px]',
                  w.ok
                    ? 'font-medium text-[#3f7d0c] dark:text-success-text'
                    : 'text-text-faint underline decoration-coral decoration-wavy underline-offset-3',
                ]"
              >
                {{ w.word }}
              </span>
            </div>

            <div class="mt-2.5">
              <p
                v-if="attempts[index]!.tip"
                class="flex items-start gap-2 text-[13px] leading-relaxed text-text-body"
              >
                <UiIcon
                  name="bulb"
                  :size="14"
                  class="mt-0.5 shrink-0 text-brand"
                />
                <span>{{ attempts[index]!.tip }}</span>
              </p>
              <button
                v-else
                type="button"
                class="text-[12.5px] font-semibold text-brand hover:underline disabled:opacity-60"
                :disabled="attempts[index]!.loadingTip"
                @click="explain(index)"
              >
                {{ attempts[index]!.loadingTip ? 'Thinking…' : 'Why? Get a tip' }}
              </button>
            </div>
          </template>

          <p
            v-else
            class="text-[12.5px] text-text-muted"
          >
            Didn’t catch that — try again, a little closer to the mic.
          </p>
        </div>
      </div>
    </div>

    <p
      v-if="speech.error.value"
      class="mt-3 flex items-start gap-1.5 text-[12px] leading-relaxed text-warn"
    >
      <UiIcon
        name="alert"
        :size="12"
        class="mt-0.5"
      />
      <span>{{ speech.error.value }}</span>
    </p>
  </BlockShell>
</template>

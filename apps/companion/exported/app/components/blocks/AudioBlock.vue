<script setup lang="ts">
import type { AudioBlock } from '~/types/api'
import type { TtsRequest, TtsVoice } from '~/composables/useAudio'
import type { MenuAction } from '~/components/ui/Menu.vue'
import BlockShell from './BlockShell.vue'

/**
 * "Listen" — narration spoken by the server's Edge TTS, played here with a real
 * transport: play/pause, a draggable scrubber, and a choice of voice.
 *
 * Two things can be read: the passage this block carries, or the whole lesson
 * (the node), because a learner who wants to walk and listen wants the latter.
 * The clip itself is synthesised and cached server-side via {@link useAudio}, so
 * scrubbing and replaying cost nothing. The transcript stays visible for the
 * passage, both as a fallback and because reading along is its own way through.
 */
const props = defineProps<{ block: AudioBlock; language?: string }>()

const audio = useAudio()

const script = computed(() => props.block.payload?.script_markdown ?? '')

/** The script's own language wins over the course language for voice choice. */
const lang = computed(() => props.block.payload?.language ?? props.language)

/** Passage when there is one to read; otherwise straight to the whole lesson. */
const source = ref<'passage' | 'lesson'>(script.value ? 'passage' : 'lesson')
const sourceOptions = [
  { value: 'passage', label: 'This passage' },
  { value: 'lesson', label: 'Whole lesson' },
]

const sourceProxy = computed<string>({
  get: () => source.value,
  set: (value) => {
    source.value = value as 'passage' | 'lesson'
  },
})

const selectedVoice = ref<string | null>(null)
const voiceList = ref<TtsVoice[]>([])

const request = computed<TtsRequest>(() =>
  source.value === 'lesson'
    ? {
        nodeId: props.block.node_id,
        voice: selectedVoice.value ?? undefined,
        language: lang.value,
      }
    : {
        text: script.value,
        voice: selectedVoice.value ?? undefined,
        language: lang.value,
      },
)

/* A different passage/lesson or voice means the loaded clip is stale. */
watch([source, selectedVoice], () => audio.invalidate())

onMounted(async () => {
  const all = await audio.voices()
  const wanted = (lang.value ?? '').slice(0, 2).toLowerCase()
  const matching = wanted
    ? all.filter((v) => (v.language ?? '').slice(0, 2).toLowerCase() === wanted)
    : all
  voiceList.value = (matching.length ? matching : all).slice(0, 12)
})

const voiceActions = computed<MenuAction[]>(() => [
  {
    label: 'Default voice',
    run: () => {
      selectedVoice.value = null
    },
  },
  ...voiceList.value.map((v) => ({
    label: v.label,
    icon: v.value === (selectedVoice.value ?? audio.voice.value) ? 'check' : undefined,
    run: () => {
      selectedVoice.value = v.value
    },
  })),
])

const currentVoiceLabel = computed(() => {
  const active = selectedVoice.value ?? audio.voice.value
  return voiceList.value.find((v) => v.value === active)?.label ?? 'Default voice'
})

function toggle(): void {
  void audio.toggle(request.value)
}

/** Estimated length before the real clip loads; the true duration once it has. */
const totalSeconds = computed(() =>
  audio.duration.value > 0 ? audio.duration.value : (props.block.payload?.duration_estimate_s ?? 0),
)

function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const scrubMax = computed(() => Math.max(1, Math.round(totalSeconds.value)))

function onScrub(event: Event): void {
  audio.seek(Number((event.target as HTMLInputElement).value))
}
</script>

<template>
  <BlockShell
    :type="block.type"
    :source-material-ids="block.source_material_ids"
  >
    <template
      v-if="script"
      #actions
    >
      <UiSegmented
        v-model="sourceProxy"
        :options="sourceOptions"
        size="xs"
        label="What to read aloud"
      />
    </template>

    <!-- The course player's listening bar: an ink pill, a round lime play
         button, the scrubber in lime on the dark. -->
    <div class="audio-bar flex flex-wrap items-center gap-3 rounded-[28px] bg-chip py-2 pr-3 pl-2 text-white">
      <button
        type="button"
        class="relative grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-accent text-on-accent transition hover:bg-hi-2 active:scale-95"
        :aria-label="audio.playing.value ? 'Pause' : audio.currentTime.value > 0 ? 'Resume' : 'Listen'"
        :aria-busy="audio.loading.value || undefined"
        @click="toggle"
      >
        <UiIcon
          :name="audio.loading.value ? 'loader' : audio.playing.value ? 'pause' : 'play'"
          :size="16"
          :stroke="2.2"
          :class="audio.loading.value && 'animate-spin-slow'"
        />
      </button>
      <span class="hidden text-[13.5px] font-semibold sm:inline">
        {{ audio.playing.value ? 'Listening' : audio.currentTime.value > 0 ? 'Paused' : 'Listen' }}
      </span>

      <div class="flex min-w-[160px] flex-1 items-center gap-2.5">
        <span class="text-[11.5px] text-white/60 tabular-nums">{{
          clock(audio.currentTime.value)
        }}</span>
        <input
          type="range"
          min="0"
          :max="scrubMax"
          step="1"
          :value="Math.min(audio.currentTime.value, scrubMax)"
          class="min-w-0 flex-1"
          :style="{
            '--fill': `${scrubMax > 0 ? (Math.min(audio.currentTime.value, scrubMax) / scrubMax) * 100 : 0}%`,
          }"
          aria-label="Seek"
          @input="onScrub"
        />
        <span class="text-[11.5px] text-white/60 tabular-nums">{{
          totalSeconds > 0 ? clock(totalSeconds) : '—:—'
        }}</span>
      </div>

      <UiMenu
        v-if="voiceList.length"
        :actions="voiceActions"
        :label="`Voice: ${currentVoiceLabel}`"
        title="Choose a voice"
      />
    </div>

    <p
      v-if="audio.error.value"
      class="mt-2.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-warn"
    >
      <UiIcon
        name="alert"
        :size="12"
        class="mt-0.5"
      />
      <span>{{ audio.error.value }} The transcript is below.</span>
    </p>

    <p
      v-if="source === 'passage' && script"
      class="mt-4 border-t border-dashed border-border-strong pt-3.5 text-[14.5px] leading-relaxed whitespace-pre-line text-text-body"
    >
      {{ script }}
    </p>
  </BlockShell>
</template>

<style scoped>
.audio-bar input[type='range'] {
  height: 5px;
  border-radius: 99px;
  background: linear-gradient(var(--accent), var(--accent)) 0 / var(--fill, 0%) 100% no-repeat,
    rgb(255 255 255 / 0.18);
}

.audio-bar input[type='range']::-webkit-slider-thumb {
  width: 14px;
  height: 14px;
  background: #fff;
  border: 0;
}

.audio-bar input[type='range']::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: #fff;
  border: 0;
}

.audio-bar :deep(button[aria-haspopup='menu']) {
  color: rgb(255 255 255 / 0.7);
}

.audio-bar :deep(button[aria-haspopup='menu']:hover) {
  background: rgb(255 255 255 / 0.12);
  color: #fff;
}
</style>

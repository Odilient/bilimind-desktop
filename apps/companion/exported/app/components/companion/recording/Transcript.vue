<script setup lang="ts">
/**
 * A recording's transcript, under its player in Notes, and the way to get
 * one (`companion/transcribe/`).
 *
 * Transcripts are written on the computer that holds the recording, the
 * desktop app, never on a server. So:
 *  - the first time, it says what downloads and how big it is, and nothing
 *    downloads before the press. After that, every new recording is
 *    transcribed by itself once it stops (CaptureSheet);
 *  - a long lecture takes a while, so the progress is one quiet line and a
 *    thin bar, with Stop; a stopped run carries on from where it got to;
 *  - anywhere else (the web, a phone, another computer) only a transcript
 *    that already exists shows.
 */
import type { Item } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { usePlatform } from '~/companion/platform'
import { agreed, checkSpeech, jobs, modelMb, speech, stopTranscript, transcribeItem } from '~/companion/transcribe'
import { timecode } from '~/companion/time'

const props = defineProps<{ item: Item }>()

const store = useCompanion()
const platform = usePlatform()

const job = computed(() => jobs[props.item.id] ?? null)
const lines = computed(() => props.item.meta.transcript ?? [])
const total = computed(() => props.item.meta.duration_s ?? 0)
const reached = computed(() => props.item.meta.transcribed_s ?? 0)
const finished = computed(() => reached.value > 0 && reached.value >= total.value - 1)
/** Only the computer that holds the recording can write its transcript. */
const here = computed(() => platform.can.transcribe && Boolean(props.item.meta.on_device))

onMounted(() => {
  if (here.value && !finished.value) void checkSpeech()
})

const mb = (bytes: number) => Math.round(bytes / 1_000_000)
const minutes = (s: number) => Math.max(0, Math.round(s / 60))

const progress = computed(() => {
  const j = job.value
  if (!j || j.error) return ''
  if (j.stage === 'waiting') return 'Waiting for another transcript to finish…'
  if (j.stage === 'model') {
    return j.total ? `Getting the speech model ready… ${mb(j.loaded)} of ${mb(j.total)} MB` : 'Getting the speech model ready…'
  }
  return `Writing the transcript on this computer… ${minutes(j.done_s)} of ${minutes(j.total_s)} min`
})
const share = computed(() => {
  const j = job.value
  if (!j) return 0
  if (j.stage === 'model') return j.total ? j.loaded / j.total : 0
  return j.total_s ? Math.min(1, j.done_s / j.total_s) : 0
})

function start(): void {
  void transcribeItem(store, props.item.id)
}
</script>

<template>
  <section
    v-if="lines.length || (here && !finished)"
    class="grid gap-3"
    aria-labelledby="rec-transcript"
  >
    <h2
      id="rec-transcript"
      class="t-head text-[20px]"
    >
      Transcript
    </h2>

    <!-- Being written: one line, a thin bar, Stop. -->
    <div
      v-if="job && !job.error"
      class="grid gap-2"
      aria-live="polite"
    >
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p class="text-[14.5px] text-text-muted">
          {{ progress }}
        </p>
        <button
          type="button"
          class="text-[14px] font-medium text-text-muted underline-offset-4 hover:text-text hover:underline"
          @click="stopTranscript(item.id)"
        >
          Stop
        </button>
      </div>
      <div class="h-[3px] overflow-hidden rounded-full bg-surface-track">
        <div
          class="h-full bg-ink transition-[width] duration-500"
          :style="{ width: `${Math.round(share * 100)}%` }"
        />
      </div>
    </div>

    <!-- It stopped on its own. -->
    <div
      v-else-if="job?.error"
      class="grid justify-items-start gap-2"
    >
      <p class="text-[14.5px] text-coral-text">
        The transcript stopped. {{ job.error }}
      </p>
      <UiBtn
        size="sm"
        @click="start"
      >
        Try again
      </UiBtn>
    </div>

    <!-- Not written yet, on the computer that can. -->
    <div
      v-else-if="here && !finished"
      class="grid justify-items-start gap-2.5"
    >
      <p
        v-if="!agreed()"
        class="max-w-[60ch] text-[14.5px] leading-relaxed text-text-body"
      >
        BiliMind can write down what was said, on this computer. It downloads a speech model
        once<template v-if="speech.known"> (about {{ modelMb() }} MB)</template> and keeps it here;
        the recording itself never leaves this computer.
      </p>
      <p
        v-else-if="reached > 0"
        class="text-[14.5px] text-text-muted"
      >
        It stopped at {{ timecode(reached) }}.
      </p>
      <UiBtn
        size="sm"
        :variant="agreed() ? 'secondary' : 'primary'"
        :disabled="!agreed() && !speech.known"
        @click="start"
      >
        {{ !agreed() ? 'Download and write it' : reached > 0 ? 'Carry on' : 'Write the transcript' }}
      </UiBtn>
    </div>

    <!-- What was said, by the minute it was said. -->
    <ol
      v-if="lines.length"
      class="grid gap-2.5"
    >
      <li
        v-for="(line, i) in lines"
        :key="i"
        class="grid grid-cols-[52px_1fr] gap-3 text-[15px] leading-relaxed"
      >
        <span class="pt-px text-[13px] text-text-faint tabular-nums">{{ timecode(line.start) }}</span>
        <span class="text-text-body">{{ line.text }}</span>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
/**
 * "Say it out loud" under a teach-back question (a check of kind `explain`,
 * /app/check, which the lesson's "Explain it back" opens too), on the
 * desktop. The learner talks, BiliMind writes down what they said on this
 * computer, and the words go into the answer box, for them to read, fix and
 * send with the usual "How sure are you?". Marking is the check's own; this
 * only saves the typing.
 *
 * Sound only: it's cut and transcribed like a lecture (recorder.ts,
 * transcribe/) and thrown away once the words are in the box, so nothing of
 * it is kept. Over the screen ("explain over your screen", a board say): that
 * is worth watching again, so it's filed like any recording, under the topic,
 * with its transcript.
 *
 * The model is downloaded the first time only after a press that says how big
 * it is, and it downloads while they talk, so it's usually ready when they
 * stop. Off the desktop this draws nothing.
 */
import type { Check, Item } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { PlatformError, usePlatform, type ScreenSource } from '~/companion/platform'
import { discardRecording, elapsedMs, startRecording, stopRecording, type Recorded } from '~/companion/recorder'
import { fileMediaRecording } from '~/companion/recording'
import {
  agreed, checkSpeech, jobs, modelMb, prepareSpeech, speech, stopTranscript, transcribeWords, transcriptText, wasStopped,
} from '~/companion/transcribe'
import { timecode } from '~/companion/time'

const props = defineProps<{ check: Check; topic: string | null }>()
const emit = defineEmits<{ text: [words: string] }>()

const platform = usePlatform()
const store = useCompanion()
const toast = useToast()

type Step = 'idle' | 'agree' | 'screens' | 'recording' | 'writing' | 'failed' | 'done'
const step = ref<Step>('idle')
const overScreen = ref(false)
const sources = ref<ScreenSource[]>([])
const problem = ref('')
/** What was recorded, while its words are being written down. */
const made = ref<Recorded | null>(null)
/** The recording note, when it was over the screen. */
let filed: Item | null = null

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
const clock = computed(() => {
  void now.value
  return timecode(elapsedMs() / 1000)
})

onMounted(() => {
  if (platform.can.transcribe) void checkSpeech()
})

function words(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function begin(screen: boolean): void {
  overScreen.value = screen
  if (!agreed()) step.value = 'agree'
  else void choose()
}

async function choose(): Promise<void> {
  if (!overScreen.value) return record(null)
  try {
    sources.value = await platform.screenSources()
  } catch (error) {
    toast.error(words(error, 'This computer won’t share its screen right now.'))
    step.value = 'idle'
    return
  }
  // Wayland's portal has already asked which one; there's nothing left to pick.
  if (sources.value.length === 1) return record(sources.value[0]!.id)
  step.value = 'screens'
}

async function record(screenId: string | null): Promise<void> {
  const id = crypto.randomUUID()
  try {
    await startRecording({
      id,
      label: props.topic ? `Explaining ${props.topic}` : 'Explaining it back',
      mic: true,
      system: false,
      screen: screenId,
      keep: Boolean(screenId),
      owner: 'aloud',
      onEnded: () => void finish(),
    })
  } catch (error) {
    if (!(error instanceof PlatformError && error.code === 'cancelled')) {
      toast.error(words(error, 'The recorder didn’t start. Try again in a moment.'))
    }
    step.value = 'idle'
    return
  }
  step.value = 'recording'
  timer = setInterval(() => (now.value = Date.now()), 1000)
  // The download, the first time, runs while they talk; a failure is said when the words are wanted.
  void prepareSpeech().catch(() => undefined)
}

async function finish(): Promise<void> {
  if (step.value !== 'recording') return
  clearInterval(timer)
  made.value = await stopRecording()
  if (!made.value?.duration_s) {
    step.value = 'idle'
    return
  }
  if (made.value.screen) {
    filed = await fileMediaRecording(
      store,
      made.value,
      { subject_id: props.check.subject_id, session_id: null, topic_id: props.check.topic_id, label: props.topic ?? 'Explaining it back' },
      props.topic ? `Explaining ${props.topic}` : 'Explaining it back',
    )
  }
  await write()
}

async function write(): Promise<void> {
  const rec = made.value
  if (!rec) return
  step.value = 'writing'
  try {
    const lines = await transcribeWords(rec.id, rec.duration_s)
    const said = transcriptText(lines)
    if (filed && lines.length) {
      const row = store.get('items', filed.id) ?? filed
      await store
        .upsert<Item>('items', { id: row.id, preview: said.slice(0, 5000), meta: { ...row.meta, transcript: lines, transcribed_s: rec.duration_s } })
        .catch(() => undefined)
    }
    if (!said) {
      problem.value = 'No words came through. Check the microphone, or type it instead.'
      step.value = 'failed'
      return
    }
    emit('text', said)
    if (!rec.screen) void discardRecording(rec.id)
    made.value = null
    step.value = 'done'
  } catch (error) {
    if (wasStopped(error)) return reset()
    problem.value = words(error, 'What you said couldn’t be written down.')
    step.value = 'failed'
  }
}

/** Back to the start, leaving nothing behind but a recording over the screen, which is filed. */
function reset(): void {
  const rec = made.value
  if (rec && !rec.screen) void discardRecording(rec.id)
  made.value = null
  filed = null
  step.value = 'idle'
}

function stopWriting(): void {
  if (made.value) stopTranscript(made.value.id)
}

const writing = computed(() => {
  const j = made.value ? jobs[made.value.id] : null
  if (j?.stage === 'model') {
    return j.total
      ? `Getting the speech model ready… ${Math.round(j.loaded / 1e6)} of ${Math.round(j.total / 1e6)} MB`
      : 'Getting the speech model ready…'
  }
  return 'Writing down what you said…'
})

// Leaving mid-way (the ✕, the next question): a recording over the screen is still filed; sound alone goes.
onBeforeUnmount(() => {
  clearInterval(timer)
  if (step.value === 'recording') {
    const label = props.topic ?? 'Explaining it back'
    const place = { subject_id: props.check.subject_id, session_id: null, topic_id: props.check.topic_id, label }
    void stopRecording().then((rec) => {
      if (!rec) return
      if (rec.screen) void fileMediaRecording(store, rec, place, props.topic ? `Explaining ${props.topic}` : null)
      else void discardRecording(rec.id)
    })
  } else if (step.value === 'writing') {
    stopWriting()
    reset()
  } else {
    reset()
  }
})
</script>

<template>
  <div
    v-if="platform.can.transcribe"
    class="grid gap-2"
    aria-live="polite"
  >
    <div
      v-if="step === 'idle'"
      class="flex flex-wrap items-center gap-x-3 gap-y-1.5"
    >
      <UiBtn
        size="sm"
        icon="mic"
        @click="begin(false)"
      >
        Say it out loud
      </UiBtn>
      <button
        type="button"
        class="text-[14px] text-text-muted underline-offset-4 hover:text-text hover:underline"
        @click="begin(true)"
      >
        or explain over your screen
      </button>
    </div>

    <div
      v-else-if="step === 'agree'"
      class="grid justify-items-start gap-2.5 rounded-[16px] bg-surface-sunken p-4"
    >
      <p class="text-[14.5px] leading-relaxed text-text-body">
        BiliMind writes down what you say on this computer. The first time, it downloads a speech
        model<template v-if="speech.known"> (about {{ modelMb() }} MB)</template> and keeps it here.
        What you say never leaves this computer.
      </p>
      <div class="flex flex-wrap gap-2">
        <UiBtn
          size="sm"
          variant="primary"
          :disabled="!speech.known"
          @click="choose"
        >
          Download and start
        </UiBtn>
        <UiBtn
          size="sm"
          variant="ghost"
          @click="step = 'idle'"
        >
          Type instead
        </UiBtn>
      </div>
    </div>

    <div
      v-else-if="step === 'screens'"
      class="grid gap-2.5"
    >
      <p class="text-[14.5px] text-text-muted">
        Which screen are you explaining over? Your voice is recorded with it.
      </p>
      <CompanionRecordingScreenPicker
        :sources="sources"
        @pick="record"
      />
      <button
        type="button"
        class="justify-self-start text-[14px] text-text-muted underline-offset-4 hover:text-text hover:underline"
        @click="step = 'idle'"
      >
        Cancel
      </button>
    </div>

    <template v-else-if="step === 'recording'">
      <div class="flex flex-wrap items-center gap-3">
        <span class="inline-flex items-center gap-2 text-[15px] font-medium text-text">
          <span class="size-2.5 shrink-0 animate-pulse-dot rounded-full bg-coral motion-reduce:animate-none" />
          {{ overScreen ? 'Recording your screen and voice' : 'Listening' }}
          <span class="text-text-muted tabular-nums">{{ clock }}</span>
        </span>
        <UiBtn
          size="sm"
          variant="primary"
          @click="finish"
        >
          Stop
        </UiBtn>
      </div>
      <p class="text-[13.5px] text-text-muted">
        Talk it through as you would to a classmate. When you stop, your words go into the box.
      </p>
    </template>

    <div
      v-else-if="step === 'writing'"
      class="flex flex-wrap items-center gap-3"
    >
      <span class="inline-flex items-center gap-2 text-[14.5px] text-text-muted">
        <UiIcon
          name="loader"
          :size="15"
          class="animate-spin-slow"
        />
        {{ writing }}
      </span>
      <button
        type="button"
        class="text-[14px] font-medium text-text-muted underline-offset-4 hover:text-text hover:underline"
        @click="stopWriting"
      >
        Stop
      </button>
    </div>

    <div
      v-else-if="step === 'failed'"
      class="grid justify-items-start gap-2"
    >
      <p class="text-[14.5px] text-coral-text">
        {{ problem }}
      </p>
      <div class="flex flex-wrap gap-2">
        <UiBtn
          size="sm"
          @click="write"
        >
          Try again
        </UiBtn>
        <UiBtn
          size="sm"
          variant="ghost"
          @click="reset"
        >
          Type instead
        </UiBtn>
      </div>
    </div>

    <p
      v-else-if="step === 'done'"
      class="text-[14px] text-text-muted"
    >
      Your words are in the box. Read them over and fix what it misheard.
      <button
        type="button"
        class="font-medium text-text underline-offset-4 hover:underline"
        @click="step = 'idle'"
      >
        Say it again
      </button>
    </p>
  </div>
</template>

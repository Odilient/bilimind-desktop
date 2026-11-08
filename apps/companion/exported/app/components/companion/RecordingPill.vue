<script setup lang="ts">
/**
 * A recording that is running while its sheet is closed — hidden by the
 * learner, or carried over from before the app was killed — shows as a pill
 * in its own row at the top of every screen, the way a phone shows a call in
 * progress, pushing the screen down rather than covering its first line. A
 * tap goes back to it.
 *
 * And a recording the recorder lost (`status: 'interrupted'`: a crash, a
 * force stop) still has its finished minutes, so those are filed as soon as
 * the app sees them, rather than waiting for a Stop that will never come.
 *
 * On the web and the desktop the recording is recorder.ts's,
 * running in the page; it shows the same way while its sheet is hidden.
 */
import { useCompanion } from '~/companion/store'
import { useCapture } from '~/companion/capture'
import { useNativeRecorder } from '~/companion/native/recorder'
import { fileRecording, metaOf } from '~/companion/recording'
import { timecode } from '~/companion/time'
// recording: the web and desktop recorder
import { elapsedMs, live as deviceLive } from '~/companion/recorder'

const c = useCompanion()
const capture = useCapture()
const rec = useNativeRecorder()
const toast = useToast()

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => clearInterval(timer))

const native = computed(() => rec.available && Boolean(rec.state.value?.recording))
// a teach-back said out loud is its question's to stop, not the pill's
const live = computed(() => native.value || (Boolean(deviceLive.id) && deviceLive.owner === 'sheet'))
const paused = computed(() => (native.value ? Boolean(rec.state.value?.paused) : deviceLive.paused))
const label = computed(() =>
  native.value ? (metaOf(rec.state.value)?.label ?? rec.state.value?.title ?? 'Recording') : deviceLive.label || 'Recording',
)
const elapsed = computed(() => {
  void now.value
  return timecode(Math.floor((native.value ? rec.elapsedNow() : elapsedMs()) / 1000))
})
const shown = computed(() => live.value && !(capture.open.value && capture.mode.value === 'record'))

function reopen(): void {
  const meta = native.value ? metaOf(rec.state.value) : (deviceLive.meta as { subject_id?: string | null; session_id?: string | null })
  capture.show('record', meta?.subject_id ?? null, meta?.session_id ?? null)
}

// What an interrupted recording managed to keep goes in as soon as the
// store is up; filing is idempotent, so seeing it twice changes nothing.
watch(
  () => [rec.state.value?.status, rec.state.value?.sessionId, c.status.ready] as const,
  async ([status, sessionId, ready]) => {
    const state = rec.state.value
    if (!ready || status !== 'interrupted' || !sessionId || !state?.segments.length) return
    const meta = metaOf(state)
    const item = await fileRecording(c, state, {
      subject_id: meta?.subject_id ?? null,
      session_id: meta?.session_id ?? null,
      topic_id: meta?.topic_id ?? null,
      label: meta?.label ?? state.title ?? 'Voice memo',
    })
    if (item) {
      toast.info({
        title: 'The recording stopped by itself',
        body: `${timecode(Math.round(state.elapsedMs / 1000))} was saved under ${meta?.label ?? 'your Notebook'}.`,
      })
    }
  },
  { immediate: true },
)
</script>

<template>
  <div
    v-if="shown"
    class="flex shrink-0 justify-center px-4 pt-2 pb-1"
  >
    <button
      type="button"
      class="flex max-w-full items-center gap-2 rounded-full bg-ink py-1.5 pr-3.5 pl-3 text-[13px] font-semibold text-white shadow-lift"
      :aria-label="`Recording ${label}, ${elapsed}. Open the recorder.`"
      @click="reopen"
    >
      <span
        class="size-2 shrink-0 rounded-full bg-coral"
        :class="paused ? 'opacity-40' : 'animate-pulse-dot motion-reduce:animate-none'"
      />
      <span class="truncate">{{ paused ? 'Paused' : 'Recording' }} · {{ label }}</span>
      <span class="num shrink-0 text-paper-2">{{ elapsed }}</span>
    </button>
  </div>
</template>

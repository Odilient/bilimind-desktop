<script setup lang="ts">
/**
 * The capture sheet: the recorder, "Paste a message", what a share from
 * another app turned into, and (for whatever still opens it on its menu,
 * like the desktop app's capture shortcut) the same list of note types as
 * Notes' "+" (`CompanionNotesNewList`), so a recording or a photo is made
 * the same way from everywhere.
 *
 * Where a recording goes is said before anything is pressed, and it is the
 * learner's: My notes, unless the button that opened this named a class or
 * a course ("Record this class" on Lecture 8's card files it under Lecture
 * 8). A class on now, or the course on screen, is only kept as the
 * recording's "Add to …?" suggestion (`capture.ts`).
 *
 * Where it opens: from the rail's New it is a popover beside the button
 * (`capture.anchor`), so the eye stays where the hand was; from anywhere
 * else a small centred panel; on a phone a bottom sheet. On the Android app
 * Record drives the native recorder; on the web and the desktop it records
 * through `recorder.ts`: the microphone, what the computer plays,
 * or, in the desktop app, a screen. The desktop keeps what it records on the
 * computer; the web uploads it when it stops. Either way closing the sheet
 * only hides it, and the pill brings it back.
 */
import type { Item, Signal } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { fileTarget, namedTarget, suggestionMeta, useCapture } from '~/companion/capture'
import { courseColor } from '~/companion/colors'
import { timecode } from '~/companion/time'
import { useNativeRecorder } from '~/companion/native/recorder'
import { PlatformError, usePlatform, type ScreenSource } from '~/companion/platform'
import {
  fileMediaRecording, fileRecording, forgetRecording, metaOf, recordingMeta, rememberRecording, type RecordingMeta,
} from '~/companion/recording'
// recording: the web and desktop recorder, and the transcript that follows a desktop recording
import {
  elapsedMs, live as deviceLive, pauseRecording, resumeRecording, startRecording, stopRecording as stopDevice, takeAsked,
  type RecordSource,
} from '~/companion/recorder'
import { agreed, transcribeItem } from '~/companion/transcribe'

const { t } = useI18n()
const c = useCompanion()
const capture = useCapture()
const toast = useToast()
const route = useRoute()
const isPhone = useIsPhone()

/** Where it's filed: the class or course the button named, else My notes. */
const target = computed(() => {
  void capture.open.value
  return namedTarget(c, capture.context.value, capture.pinned.value)
})

/** The course it probably belongs to, kept as its suggestion when it lands in My notes. */
const guess = computed(() => {
  void capture.open.value
  if (target.value.subject) return null
  const fromRoute = route.path.startsWith('/app/courses/') ? String(route.params.id ?? '') : null
  const g = fileTarget(c, fromRoute || null)
  return g.subject ? g : null
})

function close(): void {
  capture.hide()
}

function onKey(event: KeyboardEvent): void {
  if (!capture.open.value) return
  if (event.key === 'Escape') close()
}

/** The list asks to close once it has acted, unless it moved the sheet on (to the recorder). */
function onListDone(): void {
  if (capture.mode.value === 'menu') close()
}

/**
 * From the rail's New on a computer: a popover beside the button, its top
 * level with the button's, never past the bottom of the window.
 */
const popover = computed(() => Boolean(capture.anchor.value) && !isPhone.value && capture.mode.value !== 'record')
const popoverStyle = computed(() => {
  const a = capture.anchor.value
  if (!a) return undefined
  const top = Math.max(12, a.top - 6)
  return { left: `${a.right + 12}px`, top: `${top}px`, maxHeight: `calc(100dvh - ${top + 12}px)` }
})
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

watch(
  () => capture.open.value,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
    if (!open) {
      stopTimer()
      resetChoice()
      pasted.value = ''
      result.value = null
    }
  },
)

// Record can be asked for from the menu or straight from a class's card, so
// the recorder starts whenever the sheet is open on the record screen.
watch(
  () => capture.open.value && capture.mode.value === 'record',
  (recording) => {
    if (recording) void beginRecording()
  },
)

/* -- Record ---------------------------------------------------------------- */

// On the Android shell the native recorder owns the recording: it keeps going
// with the screen off and outlives the WebView, so this sheet only draws its
// state and can be closed without stopping it. Elsewhere it is a preview.
const rec = useNativeRecorder()
const seconds = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

function tick(): void {
  seconds.value = Math.floor((rec.available ? rec.elapsedNow() : elapsedMs()) / 1000)
}
function startTimer(): void {
  stopTimer()
  tick()
  timer = setInterval(tick, 1000)
}
function stopTimer(): void {
  if (timer) clearInterval(timer)
  timer = undefined
}
onBeforeUnmount(stopTimer)

const paused = computed(() => Boolean(rec.state.value?.paused || deviceLive.paused))

/** Where the running recording files: its own record if it was re-attached, else the guess. */
const attached = ref<RecordingMeta | null>(null)
const recordLabel = computed(() => attached.value?.label ?? target.value.label)

function targetMeta(): Omit<RecordingMeta, 'id'> {
  return {
    subject_id: target.value.subject?.id ?? null,
    session_id: target.value.session?.id ?? null,
    topic_id: target.value.session?.topic_id ?? null,
    label: target.value.subject ? target.value.label : (guess.value?.session?.title ?? t('today.capture.voiceMemo')),
  }
}

/** A recording that landed in My notes keeps the course it was probably for. */
async function remember(item: Item | null): Promise<void> {
  const extra = suggestionMeta(guess.value)
  if (!item || item.subject_id || !extra.suggested_subject_id) return
  await c.upsert<Item>('items', { id: item.id, meta: { ...item.meta, ...extra } }).catch(() => undefined)
}

/** "Saved to My notes", with the way to it. */
function saved(item: Item | null, body: string, where = target.value.label): void {
  if (!item) return
  toast.success({
    title: t('today.capture.savedTo', { where }),
    body,
    action: { label: t('common.open'), handler: () => void navigateTo(`/app/notes/${item.id}`) },
  })
}

/*
 * What to record. A phone records the room. A computer may also record what
 * it plays (an online lecture) and, in the desktop app, a screen; then the
 * learner picks before anything starts. Nothing captured is ever played
 * back. Recording itself is recorder.ts's: the desktop keeps it on disk as it
 * goes, the web uploads it when it stops (recording.ts).
 */
const platform = usePlatform()
const source = ref<RecordSource | null>(null)
const offerChoice = computed(() => !rec.available && (platform.can.systemAudio || platform.can.screenRecording))
/** Still picking: what to record, or which screen. */
const choosing = computed(() => offerChoice.value && !source.value)
/** The screen picker, once "Your screen" was pressed. */
const screens = ref<ScreenSource[] | null>(null)
/** Over a screen, the learner's voice too: on for slides they talk over, off for a lecture played on screen. */
const withMic = ref(true)

/** Closing the sheet hides a recording; only an unstarted choice is forgotten. */
function resetChoice(): void {
  if (!deviceLive.id) source.value = null
  screens.value = null
}

async function chooseSource(kind: RecordSource): Promise<void> {
  if (kind !== 'screen') return startDevice(kind)
  try {
    const list = await platform.screenSources()
    // Wayland's portal has already asked which one; there's nothing left to pick.
    if (list.length === 1) return startDevice('screen', list[0]!.id)
    screens.value = list
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('today.capture.noScreen'))
  }
}

async function startDevice(kind: RecordSource, screenId: string | null = null): Promise<void> {
  // A fresh id per recording, as on the phone: it names the desktop's folder and the item it becomes.
  const id = crypto.randomUUID()
  const meta = targetMeta()
  try {
    await startRecording({
      id,
      label: meta.label,
      keep: true,
      mic: kind === 'mic' || (kind === 'screen' && withMic.value),
      system: kind !== 'mic',
      screen: screenId,
      meta: { ...meta },
      owner: 'sheet',
      onEnded: (problem) => void stopRecording(problem),
    })
  } catch (error) {
    if (!(error instanceof PlatformError && error.code === 'cancelled')) {
      toast.error(error instanceof Error ? error.message : t('today.capture.noStart'))
    }
    // with no choice to go back to, there's nothing left on the sheet
    if (!offerChoice.value) close()
    return
  }
  attached.value = { id, ...meta }
  source.value = kind
  screens.value = null
  startTimer()
}

async function beginRecording(): Promise<void> {
  attached.value = null
  if (!rec.available) {
    if (deviceLive.id && deviceLive.owner === 'sheet') {
      // Already running (hidden, then reopened from the pill): show that one, never start a second.
      attached.value = { id: deviceLive.id, ...(deviceLive.meta as Omit<RecordingMeta, 'id'>) }
      source.value = deviceLive.source
      startTimer()
      return
    }
    source.value = null
    screens.value = null
    stopTimer()
    seconds.value = 0
    // "Record screen" goes straight to which screen; with nothing to choose, the microphone starts.
    if (takeAsked() === 'screen' && platform.can.screenRecording) return chooseSource('screen')
    if (!offerChoice.value) return chooseSource('mic')
    return
  }
  try {
    const live = await rec.refresh()
    if (live?.recording && live.sessionId) {
      // Already running (started before the app was closed, or from the
      // pill): show that one, never start a second over it.
      attached.value = metaOf(live)
    } else {
      // A fresh id per recording: the recorder continues any folder it
      // already knows, so reusing the class's id would merge two lectures.
      // It is also the id of the item this becomes.
      const id = crypto.randomUUID()
      const meta = targetMeta()
      rememberRecording({ id, ...meta })
      attached.value = recordingMeta(id)
      await rec.start({ sessionId: id, title: meta.label, meta: { ...meta } })
    }
  } catch (error) {
    if (attached.value && !rec.state.value?.recording) forgetRecording(attached.value.id)
    attached.value = null
    const code = (error as { code?: string }).code
    toast.error(
      code === 'permission-denied' || code === 'not-allowed'
        ? t('today.capture.needMic')
        : code === 'storage-full'
          ? t('today.capture.phoneFull')
          : t('today.capture.noStart'),
    )
    capture.mode.value = 'menu'
    return
  }
  startTimer()
}

async function togglePause(): Promise<void> {
  if (!rec.available) {
    if (deviceLive.paused) resumeRecording()
    else pauseRecording()
    return
  }
  if (paused.value) await rec.resume()
  else await rec.pause()
}

/** `problem`: the recorder ended by itself (the disk filled up), said once what was kept is filed. */
async function stopRecording(problem: string | null = null): Promise<void> {
  stopTimer()
  if (rec.available) {
    const state = await rec.stop()
    const item = await fileRecording(c, state, targetMeta())
    await remember(item)
    saved(item, t('today.capture.recording', { time: timecode(Math.round(state.elapsedMs / 1000)) }))
    close()
    return
  }
  if (!deviceLive.id || deviceLive.owner !== 'sheet') {
    close()
    return
  }
  const place: Omit<RecordingMeta, 'id'> = attached.value ? { ...attached.value } : targetMeta()
  const where = place.subject_id ? place.label : t('today.capture.myNotes')
  close()
  const done = await stopDevice()
  if (!done) return
  const item = await fileMediaRecording(c, done, place)
  if (item) {
    await remember(item)
    // Once the learner has said yes to the speech model, every desktop recording gets its transcript.
    const writing = done.speech && agreed()
    const what = t(done.screen ? 'today.capture.screenRecording' : 'today.capture.recording', { time: timecode(done.duration_s) })
    saved(
      item,
      done.blob
        ? what
        : `${what}. ${t('today.capture.keptHere')}${done.speech ? ` ${t(writing ? 'today.capture.writing' : 'today.capture.openToWrite')}` : ''}`,
      where,
    )
    if (writing) void transcribeItem(c, item.id)
  }
  if (problem ?? done.problem) toast.error(problem ?? done.problem!)
}

/* -- Paste text ---------------------------------------------------------- */

const pasted = ref('')
const reading = ref(false)
const result = ref<Signal | null>(null)

async function readPasted(): Promise<void> {
  if (!pasted.value.trim()) return
  reading.value = true
  try {
    // The course is only a hint for reading the message; the card asks before anything moves.
    const hint = target.value.subject?.id ?? guess.value?.subject?.id
    const [signal] = await c.ingestText(pasted.value, 'share', hint)
    result.value = signal ?? null
  } catch {
    toast.error(t('today.capture.readFailed'))
  } finally {
    reading.value = false
  }
}

const bars = Array.from({ length: 28 }, (_, i) => 18 + ((i * 37) % 70))
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="capture.open.value"
        :class="['fixed inset-0 z-[90]', !popover && 'grid items-end min-[900px]:place-items-center']"
        role="dialog"
        aria-modal="true"
        :aria-label="capture.mode.value === 'record' ? t('today.capture.recordingLabel') : t('today.capture.new')"
      >
        <!-- A popover dims nothing: it is a menu, not an interruption. -->
        <div
          :class="['absolute inset-0', !popover && 'bg-[rgb(6_9_30/0.45)] backdrop-blur-[4px]']"
          @click="capture.mode.value === 'record' ? undefined : close()"
        />

        <!-- Recording: the dark screen from the mockup. -->
        <section
          v-if="capture.mode.value === 'record'"
          class="animate-sheet relative grid max-h-[92dvh] w-full gap-5 overflow-y-auto rounded-t-[28px] bg-ink px-5 pt-5 pb-[max(24px,env(safe-area-inset-bottom))] text-[#eef0f6] min-[900px]:max-w-[440px] min-[900px]:rounded-[28px] min-[900px]:pb-6"
        >
          <header class="flex items-center justify-between gap-3 text-[13px] font-semibold">
            <span class="inline-flex min-w-0 items-center gap-2 text-[#a9aebd]">
              <span
                class="size-2 shrink-0 rounded-full"
                :style="{ background: courseColor(attached ? c.get('subjects', attached.subject_id)?.color : target.subject?.color) }"
              />
              <span class="truncate">{{ recordLabel }}</span>
            </span>
            <span class="inline-flex shrink-0 items-center gap-1.5">
              <span
                class="size-2.5 rounded-full bg-coral motion-reduce:animate-none"
                :class="paused ? 'opacity-40' : 'animate-pulse-dot'"
              />
              {{ paused ? t('today.focus.paused') : rec.available || platform.recordings ? t('today.capture.onDevice') : t('today.capture.recordingLabel') }}
            </span>
          </header>
          <div
            v-if="choosing && !screens"
            class="grid gap-2.5"
          >
            <p class="t-head text-[22px] text-white">
              {{ t('today.capture.whatRecording') }}
            </p>
            <button
              type="button"
              class="flex items-center gap-3.5 rounded-[16px] bg-[rgb(238_240_246/0.08)] p-4 text-left hover:bg-[rgb(238_240_246/0.14)]"
              @click="chooseSource('mic')"
            >
              <CompanionIcon
                name="mic"
                :size="20"
              />
              <span class="grid gap-0.5">
                <span class="text-[15px] font-semibold">{{ t('today.capture.room') }}</span>
                <span class="text-[12.5px] text-[#a9aebd]">{{ t('today.capture.roomHint') }}</span>
              </span>
            </button>
            <button
              v-if="platform.can.systemAudio"
              type="button"
              class="flex items-center gap-3.5 rounded-[16px] bg-[rgb(238_240_246/0.08)] p-4 text-left hover:bg-[rgb(238_240_246/0.14)]"
              @click="chooseSource('system')"
            >
              <CompanionIcon
                name="speaker"
                :size="20"
              />
              <span class="grid gap-0.5">
                <span class="text-[15px] font-semibold">{{ t('today.capture.system') }}</span>
                <span class="text-[12.5px] text-[#a9aebd]">{{ t('today.capture.systemHint') }}</span>
              </span>
            </button>
            <!-- Recording: the desktop app records a screen too. -->
            <button
              v-if="platform.can.screenRecording"
              type="button"
              class="flex items-center gap-3.5 rounded-[16px] bg-[rgb(238_240_246/0.08)] p-4 text-left hover:bg-[rgb(238_240_246/0.14)]"
              @click="chooseSource('screen')"
            >
              <CompanionIcon
                name="monitor"
                :size="20"
              />
              <span class="grid gap-0.5">
                <span class="text-[15px] font-semibold">{{ t('today.capture.screen') }}</span>
                <span class="text-[12.5px] text-[#a9aebd]">{{ t('today.capture.screenHint') }}</span>
              </span>
            </button>
            <button
              type="button"
              class="justify-self-center px-3 py-2 text-[13.5px] font-medium text-[#a9aebd] hover:text-white"
              @click="close"
            >
              {{ t('today.capture.notNow') }}
            </button>
          </div>
          <!-- Recording: which screen, from the desktop's own list. -->
          <div
            v-else-if="choosing && screens"
            class="grid gap-3"
          >
            <p class="t-head text-[22px] text-white">
              {{ t('today.capture.whichScreen') }}
            </p>
            <CompanionRecordingScreenPicker
              :sources="screens"
              dark
              @pick="(id: string) => startDevice('screen', id)"
            />
            <label class="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#c3c7d3]">
              <input
                v-model="withMic"
                type="checkbox"
                class="size-4 accent-coral"
              >
              {{ t('today.capture.voiceToo') }}
            </label>
            <button
              type="button"
              class="justify-self-center px-3 py-2 text-[13.5px] font-medium text-[#a9aebd] hover:text-white"
              @click="screens = null"
            >
              {{ t('common.back') }}
            </button>
          </div>
          <p
            v-else
            class="num font-display text-[52px] leading-none font-semibold tracking-[-0.02em]"
            aria-live="off"
          >
            {{ timecode(seconds) }}
          </p>
          <div
            v-if="!choosing"
            class="flex h-10 items-center gap-[3px]"
            aria-hidden="true"
          >
            <i
              v-for="(h, i) in bars"
              :key="i"
              class="block flex-1 rounded-sm bg-[rgb(238_240_246/0.5)]"
              :style="{ height: `${h}%` }"
            />
          </div>
          <p
            v-if="rec.available"
            class="rounded-[14px] bg-[rgb(238_240_246/0.07)] p-3.5 text-[13.5px] leading-relaxed text-[#c3c7d3]"
          >
            {{ t(paused ? 'today.capture.pausedNote' : 'today.capture.phoneNote') }}
          </p>
          <p
            v-else-if="!choosing"
            class="rounded-[14px] bg-[rgb(238_240_246/0.07)] p-3.5 text-[13.5px] leading-relaxed text-[#c3c7d3]"
          >
            <template v-if="paused">
              {{ t('today.capture.pausedNote') }}
            </template>
            <template v-else-if="source === 'screen'">
              {{ t('today.capture.screenNote') }}
            </template>
            <template v-else-if="source === 'system'">
              {{ t('today.capture.systemNote') }}
            </template>
            <template v-else-if="platform.recordings">
              {{ t('today.capture.deviceNote') }}
            </template>
            <template v-else>
              {{ t('today.capture.tabNote') }}
            </template>
          </p>
          <div
            v-if="!choosing"
            class="flex items-center justify-between"
          >
            <button
              type="button"
              class="grid size-11 place-items-center rounded-full bg-[rgb(238_240_246/0.1)]"
              :aria-label="t(paused ? 'today.capture.carryOn' : 'today.capture.pause')"
              @click="togglePause"
            >
              <CompanionIcon
                :name="paused ? 'mic' : 'pause'"
                :size="18"
              />
            </button>
            <button
              type="button"
              class="grid size-16 place-items-center rounded-full bg-coral"
              :aria-label="t('today.capture.stop')"
              @click="stopRecording()"
            >
              <span class="block size-5 rounded-[5px] bg-white" />
            </button>
            <button
              type="button"
              class="grid size-11 place-items-center rounded-full bg-[rgb(238_240_246/0.1)]"
              :aria-label="t('today.capture.hide')"
              @click="close"
            >
              <CompanionIcon
                name="x"
                :size="18"
              />
            </button>
          </div>
        </section>

        <!-- The menu, and the paste flow. -->
        <section
          v-else
          :class="
            popover
              ? 'pop-in absolute grid w-[392px] gap-3 overflow-y-auto rounded-[22px] bg-surface p-4 shadow-pop ring-1 ring-border'
              : 'animate-sheet relative grid max-h-[88dvh] w-full gap-4 overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-2.5 pb-[max(24px,env(safe-area-inset-bottom))] shadow-sheet min-[900px]:max-w-[460px] min-[900px]:rounded-[24px] min-[900px]:pt-5 min-[900px]:pb-5'
          "
          :style="popover ? popoverStyle : undefined"
        >
          <div
            v-if="!popover"
            class="mx-auto h-[5px] w-10 rounded-full bg-surface-track min-[900px]:hidden"
          />
          <header class="flex items-start justify-between gap-3">
            <div class="grid min-w-0 gap-1">
              <h2 :class="['t-head', popover ? 'text-[18px]' : 'text-[22px]']">
                {{ t(capture.mode.value === 'paste' ? 'today.changes.paste' : capture.mode.value === 'signal' ? 'today.capture.shared' : 'today.capture.newNote') }}
              </h2>
              <!-- Where it goes, said before anything is pressed: only when a button named it. -->
              <p
                v-if="capture.mode.value === 'menu' && target.subject"
                class="flex items-start gap-2 text-[13.5px] leading-snug text-text-muted"
              >
                <span
                  class="mt-[5px] size-2 shrink-0 rounded-full"
                  :style="{ background: courseColor(target.subject.color) }"
                />
                <i18n-t keypath="today.capture.goesIn" tag="span"><template #where><b class="font-semibold text-text">{{ target.label }}</b></template></i18n-t>
              </p>
            </div>
            <button
              type="button"
              class="-mt-1 -mr-2.5 grid size-11 shrink-0 place-items-center rounded-full text-text-muted hover:bg-surface-track hover:text-text"
              :aria-label="t('common.close')"
              @click="close"
            >
              <CompanionIcon
                name="x"
                :size="18"
              />
            </button>
          </header>

          <!-- The note types: the same list as Notes' "+". -->
          <CompanionNotesNewList
            v-if="capture.mode.value === 'menu'"
            class="-mx-2"
            :subject-id="target.subject?.id ?? null"
            :roomy="!popover"
            @done="onListDone"
          />

          <CompanionSignalCard
            v-else-if="capture.mode.value === 'signal' && capture.signal.value"
            :signal="capture.signal.value"
            @done="close"
          />

          <template v-else-if="capture.mode.value === 'paste'">
            <template v-if="!result">
              <label
                for="cp-paste"
                class="text-[15px] leading-relaxed text-text-body"
              >
                {{ t('today.capture.pasteHint') }}
              </label>
              <textarea
                id="cp-paste"
                v-model="pasted"
                rows="5"
                class="w-full resize-none rounded-[14px] border border-border-field bg-surface p-3.5 text-[15px] leading-relaxed outline-none focus:border-brand"
                :placeholder="t('today.capture.pastePlaceholder')"
              />
              <div class="flex flex-wrap gap-2">
                <UiBtn
                  variant="primary"
                  size="lg"
                  :loading="reading"
                  :disabled="!pasted.trim()"
                  @click="readPasted"
                >
                  {{ t('today.capture.readIt') }}
                </UiBtn>
                <UiBtn
                  variant="ghost"
                  size="lg"
                  @click="capture.mode.value = 'menu'"
                >
                  {{ t('common.back') }}
                </UiBtn>
              </div>
            </template>
            <CompanionSignalCard
              v-else
              :signal="result"
              @done="close"
            />
          </template>

        </section>
      </div>
    </Transition>
  </Teleport>
</template>

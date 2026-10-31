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
 * Record drives the native recorder; everywhere else it is a preview of
 * that screen with no microphone behind it.
 */
import type { Item, Signal } from '~/companion/types'
import { useCompanion } from '~/companion/store'
import { fileTarget, namedTarget, suggestionMeta, useCapture } from '~/companion/capture'
import { courseColor } from '~/companion/colors'
import { nowIso, timecode } from '~/companion/time'
import { useNativeRecorder } from '~/companion/native/recorder'
import { PlatformError, usePlatform } from '~/companion/platform'
import { fileRecording, forgetRecording, metaOf, recordingMeta, rememberRecording, type RecordingMeta } from '~/companion/recording'

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
      releaseSystemAudio()
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
  seconds.value = rec.available ? Math.floor(rec.elapsedNow() / 1000) : seconds.value + 1
}
function startTimer(): void {
  stopTimer()
  seconds.value = rec.available ? Math.floor(rec.elapsedNow() / 1000) : 0
  timer = setInterval(tick, 1000)
}
function stopTimer(): void {
  if (timer) clearInterval(timer)
  timer = undefined
}
onBeforeUnmount(stopTimer)

const paused = computed(() => Boolean(rec.state.value?.paused))

/** Where the running recording files: its own record if it was re-attached, else the guess. */
const attached = ref<RecordingMeta | null>(null)
const recordLabel = computed(() => attached.value?.label ?? target.value.label)

function targetMeta(): Omit<RecordingMeta, 'id'> {
  return {
    subject_id: target.value.subject?.id ?? null,
    session_id: target.value.session?.id ?? null,
    topic_id: target.value.session?.topic_id ?? null,
    label: target.value.subject ? target.value.label : (guess.value?.session?.title ?? 'Voice memo'),
  }
}

/** A recording that landed in My notes keeps the course it was probably for. */
async function remember(item: Item | null): Promise<void> {
  const extra = suggestionMeta(guess.value)
  if (!item || item.subject_id || !extra.suggested_subject_id) return
  await c.upsert<Item>('items', { id: item.id, meta: { ...item.meta, ...extra } }).catch(() => undefined)
}

/** "Saved to My notes", with the way to it. */
function saved(item: Item | null, body: string): void {
  if (!item) return
  toast.success({
    title: `Saved to ${target.value.label}`,
    body,
    action: { label: 'Open', handler: () => void navigateTo(`/app/notes/${item.id}`) },
  })
}

/*
 * What to record. A phone records the room. A computer may also record what
 * it plays — an online lecture — when the platform can capture that; then the
 * learner picks before anything starts. The captured stream is never played
 * back, and for now it is not kept either: this is the choice and the screen,
 * with the saving to follow.
 */
const platform = usePlatform()
const source = ref<'mic' | 'system' | null>(null)
const offerSystem = computed(() => !rec.available && platform.can.systemAudio)
let systemStream: MediaStream | null = null

function releaseSystemAudio(): void {
  systemStream?.getTracks().forEach((track) => track.stop())
  systemStream = null
  source.value = null
}

async function chooseSource(kind: 'mic' | 'system'): Promise<void> {
  if (kind === 'system') {
    try {
      systemStream = await platform.captureSystemAudio()
    } catch (error) {
      if (!(error instanceof PlatformError && error.code === 'cancelled')) {
        toast.error(error instanceof Error ? error.message : 'This computer would not share its sound.')
      }
      return
    }
    // Stopping the share from the browser's own bar ends the recording too.
    systemStream.getTracks().forEach((track) => track.addEventListener('ended', () => void stopRecording()))
  }
  source.value = kind
  startTimer()
}

async function beginRecording(): Promise<void> {
  attached.value = null
  source.value = null
  if (!rec.available && offerSystem.value) {
    // Wait for the choice; the clock starts with it.
    stopTimer()
    seconds.value = 0
    return
  }
  if (rec.available) {
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
          ? 'BiliMind needs the microphone to record. Allow it in the phone\'s settings.'
          : code === 'storage-full'
            ? 'The phone is out of space, so recording can\'t start.'
            : 'The recorder didn\'t start. Try again in a moment.',
      )
      capture.mode.value = 'menu'
      return
    }
  }
  startTimer()
}

async function togglePause(): Promise<void> {
  if (!rec.available) return
  if (paused.value) await rec.resume()
  else await rec.pause()
}

async function stopRecording(): Promise<void> {
  stopTimer()
  if (rec.available) {
    const state = await rec.stop()
    const item = await fileRecording(c, state, targetMeta())
    await remember(item)
    saved(item, `Recording, ${timecode(Math.round(state.elapsedMs / 1000))}`)
    close()
    return
  }
  const duration = seconds.value
  releaseSystemAudio()
  const meta: Record<string, unknown> = { duration_s: duration, segments: 0 }
  // The preview only pretends to file in the demo: on a real account an
  // empty recording row would be a lie in the course.
  if (c.status.mode === 'demo' && duration > 0) {
    const now = nowIso()
    const named = target.value.session?.title ?? guess.value?.session?.title ?? 'Voice memo'
    const item = await c.upsert<Item>('items', {
      id: crypto.randomUUID(),
      subject_id: target.value.subject?.id ?? null,
      session_id: target.value.session?.id ?? null,
      topic_id: target.value.session?.topic_id ?? null,
      parent_id: null,
      kind: 'recording',
      title: `${named} recording`,
      preview: null,
      meta: { ...meta, ...(target.value.subject ? {} : suggestionMeta(guess.value)) },
      source: 'made',
      source_ref: null,
      position: c.items.value.length,
      pinned: false,
      created_at: now,
    })
    saved(item, `Recording, ${timecode(duration)}`)
  }
  close()
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
    toast.error('Couldn\'t read that just now. It\'s still here; try again.')
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
        :aria-label="capture.mode.value === 'record' ? 'Recording' : 'New'"
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
              {{ paused ? 'Paused' : 'On this device' }}
            </span>
          </header>
          <div
            v-if="offerSystem && !source"
            class="grid gap-2.5"
          >
            <p class="t-head text-[22px] text-white">
              What are you recording?
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
                <span class="text-[15px] font-semibold">The room, with the microphone</span>
                <span class="text-[12.5px] text-[#a9aebd]">A lecture hall, a seminar, a tutor across the table</span>
              </span>
            </button>
            <button
              type="button"
              class="flex items-center gap-3.5 rounded-[16px] bg-[rgb(238_240_246/0.08)] p-4 text-left hover:bg-[rgb(238_240_246/0.14)]"
              @click="chooseSource('system')"
            >
              <CompanionIcon
                name="speaker"
                :size="20"
              />
              <span class="grid gap-0.5">
                <span class="text-[15px] font-semibold">Record this computer's audio (online lecture)</span>
                <span class="text-[12.5px] text-[#a9aebd]">Teams, Zoom, a recorded talk: what this computer plays, nothing else</span>
              </span>
            </button>
            <button
              type="button"
              class="justify-self-center px-3 py-2 text-[13.5px] font-medium text-[#a9aebd] hover:text-white"
              @click="close"
            >
              Not now
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
            v-if="!(offerSystem && !source)"
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
            {{ paused ? 'Paused. Nothing is being recorded until you carry on.' : 'Recording on this phone. It keeps going with the screen off, and you can close this and come back.' }}
          </p>
          <p
            v-else-if="source === 'system'"
            class="rounded-[14px] bg-[rgb(238_240_246/0.07)] p-3.5 text-[13.5px] leading-relaxed text-[#c3c7d3]"
          >
            Listening to what this computer plays; nothing is played back. Keep the lecture's own
            window open. This is a preview: saving the sound comes next.
          </p>
          <p
            v-else-if="source === 'mic' || !offerSystem"
            class="rounded-[14px] bg-[rgb(238_240_246/0.07)] p-3.5 text-[13.5px] leading-relaxed text-[#c3c7d3]"
          >
            This is a preview of the recorder. In the app it keeps going with the screen off,
            writes the transcript as the lecturer speaks, and catches "the quiz is on Thursday"
            as a card you can add with one tap. Nothing is being recorded now.
          </p>
          <div
            v-if="!(offerSystem && !source)"
            class="flex items-center justify-between"
          >
            <button
              v-if="rec.available"
              type="button"
              class="grid size-11 place-items-center rounded-full bg-[rgb(238_240_246/0.1)]"
              :aria-label="paused ? 'Carry on recording' : 'Pause'"
              @click="togglePause"
            >
              <CompanionIcon
                :name="paused ? 'mic' : 'pause'"
                :size="18"
              />
            </button>
            <span
              v-else
              class="w-11"
            />
            <button
              type="button"
              class="grid size-16 place-items-center rounded-full bg-coral"
              aria-label="Stop"
              @click="stopRecording"
            >
              <span class="block size-5 rounded-[5px] bg-white" />
            </button>
            <button
              type="button"
              class="grid size-11 place-items-center rounded-full bg-[rgb(238_240_246/0.1)]"
              :aria-label="rec.available ? 'Hide; it keeps recording' : 'Close without saving'"
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
                {{ capture.mode.value === 'paste' ? 'Paste a message' : capture.mode.value === 'signal' ? 'Shared to BiliMind' : 'New note' }}
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
                <span>Goes in <b class="font-semibold text-text">{{ target.label }}</b></span>
              </p>
            </div>
            <button
              type="button"
              class="-mt-1 -mr-2.5 grid size-11 shrink-0 place-items-center rounded-full text-text-muted hover:bg-surface-track hover:text-text"
              aria-label="Close"
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
                A group-chat message, an email, an announcement. BiliMind reads the date and the
                course, and shows you the change before anything moves.
              </label>
              <textarea
                id="cp-paste"
                v-model="pasted"
                rows="5"
                class="w-full resize-none rounded-[14px] border border-border-field bg-surface p-3.5 text-[15px] leading-relaxed outline-none focus:border-brand"
                placeholder="guys the networks quiz moved to friday 10am"
              />
              <div class="flex flex-wrap gap-2">
                <UiBtn
                  variant="primary"
                  size="lg"
                  :loading="reading"
                  :disabled="!pasted.trim()"
                  @click="readPasted"
                >
                  Read it
                </UiBtn>
                <UiBtn
                  variant="ghost"
                  size="lg"
                  @click="capture.mode.value = 'menu'"
                >
                  Back
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

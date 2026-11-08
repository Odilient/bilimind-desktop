<script setup lang="ts">
import { hexToHsv, hsvToHex, normaliseHex, type Hsv } from '~/utils/markup'

/**
 * MARKUP — mixing an ink of your own, and keeping it.
 *
 * A saturation/brightness field over a hue strip, a hex field for the reader
 * who already knows the colour, and two short rows under them: the colours
 * they saved (kept with the account, removable) and the ones they mixed lately
 * (this device only). The pen takes the colour while it is being dragged, so
 * what the reader sees on the tray is what they will draw with.
 *
 * Drawn here rather than handed to `<input type="color">`: the native picker
 * is a different dialog on every platform, opens away from the tray, and has
 * no notion of "save this one".
 */
const props = defineProps<{ color: string }>()

const emit = defineEmits<{ pick: [color: string] }>()

const palette = useInkPalette()

const hsv = ref<Hsv>(hexToHsv(props.color))
const hex = computed(() => hsvToHex(hsv.value))
const field = ref(normaliseHex(props.color) ?? props.color)

/* Only follow the colour from outside when it did not come from here: going
   hex → hsv → hex loses the hue of a grey, so the field's own colour would
   snap the hue handle back to red every time it was dragged through white. */
watch(
  () => props.color,
  (color) => {
    const next = normaliseHex(color)
    if (!next || next === hex.value) return
    hsv.value = hexToHsv(next)
    field.value = next
  },
)

function set(next: Hsv): void {
  hsv.value = next
  field.value = hex.value
  emit('pick', hex.value)
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/* -- Dragging the field and the strip -------------------------------------- */

const fieldEl = ref<HTMLElement | null>(null)
const hueEl = ref<HTMLElement | null>(null)
let dragging: 'field' | 'hue' | null = null

function track(event: PointerEvent): void {
  if (dragging === 'field' && fieldEl.value) {
    const rect = fieldEl.value.getBoundingClientRect()
    set({
      ...hsv.value,
      s: clamp01((event.clientX - rect.left) / rect.width),
      v: 1 - clamp01((event.clientY - rect.top) / rect.height),
    })
  } else if (dragging === 'hue' && hueEl.value) {
    const rect = hueEl.value.getBoundingClientRect()
    set({ ...hsv.value, h: Math.min(359.9, clamp01((event.clientX - rect.left) / rect.width) * 360) })
  }
}

function start(which: 'field' | 'hue', event: PointerEvent): void {
  if (event.button !== 0 && event.pointerType === 'mouse') return
  event.preventDefault()
  dragging = which
  try {
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  } catch {
    // Capture is a nicety; the move handler copes without it.
  }
  track(event)
}

function stop(): void {
  if (dragging === null) return
  dragging = null
  palette.used(hex.value)
}

/* The keyboard gets the same two controls: arrows nudge, Shift nudges more. */
function onFieldKey(event: KeyboardEvent): void {
  const step = event.shiftKey ? 0.1 : 0.02
  const { s, v } = hsv.value
  const moves: Record<string, Partial<Hsv>> = {
    ArrowLeft: { s: clamp01(s - step) },
    ArrowRight: { s: clamp01(s + step) },
    ArrowUp: { v: clamp01(v + step) },
    ArrowDown: { v: clamp01(v - step) },
  }
  const move = moves[event.key]
  if (!move) return
  event.preventDefault()
  set({ ...hsv.value, ...move })
}

function onHueKey(event: KeyboardEvent): void {
  const step = event.shiftKey ? 30 : 5
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  const h = hsv.value.h + (event.key === 'ArrowLeft' ? -step : step)
  set({ ...hsv.value, h: (h + 360) % 360 })
}

function onFieldKeyUp(event: KeyboardEvent): void {
  if (event.key.startsWith('Arrow')) palette.used(hex.value)
}

/* -- Typing a hex ---------------------------------------------------------- */

function onHexInput(event: Event): void {
  field.value = (event.target as HTMLInputElement).value
  const next = normaliseHex(field.value)
  if (!next) return
  hsv.value = hexToHsv(next)
  emit('pick', next)
}

function onHexCommit(): void {
  const next = normaliseHex(field.value)
  field.value = next ?? hex.value
  if (next) palette.used(next)
}

/* -- Saved and recent ------------------------------------------------------ */

function choose(color: string): void {
  hsv.value = hexToHsv(color)
  field.value = color
  emit('pick', color)
}

const current = computed(() => normaliseHex(props.color) ?? hex.value)
const kept = computed(() => palette.isSaved(current.value))

const fieldStyle = computed(() => ({ backgroundColor: hsvToHex({ h: hsv.value.h, s: 1, v: 1 }) }))
</script>

<template>
  <div class="w-[236px]">
    <!-- Saturation across, brightness down -->
    <div
      ref="fieldEl"
      role="slider"
      tabindex="0"
      aria-label="Saturation and brightness"
      :aria-valuetext="hex"
      class="ink-field relative h-[132px] cursor-crosshair touch-none rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-brand"
      :style="fieldStyle"
      @pointerdown="start('field', $event)"
      @pointermove="track"
      @pointerup="stop"
      @pointercancel="stop"
      @keydown="onFieldKey"
      @keyup="onFieldKeyUp"
    >
      <span
        class="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.35)]"
        :style="{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: hex }"
      />
    </div>

    <!-- Hue -->
    <div
      ref="hueEl"
      role="slider"
      tabindex="0"
      aria-label="Hue"
      aria-valuemin="0"
      aria-valuemax="360"
      :aria-valuenow="Math.round(hsv.h)"
      class="ink-hue relative mt-2.5 h-3 cursor-pointer touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand"
      @pointerdown="start('hue', $event)"
      @pointermove="track"
      @pointerup="stop"
      @pointercancel="stop"
      @keydown="onHueKey"
      @keyup="onFieldKeyUp"
    >
      <span
        class="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.35)]"
        :style="{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: fieldStyle.backgroundColor }"
      />
    </div>

    <!-- The colour, by name, and keeping it -->
    <div class="mt-3 flex items-center gap-2">
      <span
        class="size-7 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]"
        :style="{ backgroundColor: current }"
      />
      <input
        :value="field"
        type="text"
        inputmode="text"
        spellcheck="false"
        maxlength="7"
        aria-label="Hex colour"
        class="num h-8 min-w-0 flex-1 rounded-[9px] border border-border-field bg-surface px-2.5 text-[13px] text-text-body focus:border-brand focus:outline-none"
        @input="onHexInput"
        @change="onHexCommit"
        @keydown.enter.prevent="onHexCommit"
      />
      <!-- The four shipped inks are always on the tray; there is nothing to
           keep. A kept colour gets Remove in the same place, because that is
           where the reader who saved it will look to take it back. -->
      <button
        v-if="!palette.isShipped(current)"
        type="button"
        :class="[
          'flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-[9px] px-2.5 text-[12.5px] font-semibold transition-colors',
          kept ? 'text-text-soft hover:bg-danger-soft hover:text-danger' : 'text-brand hover:bg-brand-soft',
        ]"
        @click="kept ? palette.forget(current) : palette.save(current)"
      >
        <UiIcon
          :name="kept ? 'x' : 'plus'"
          :size="13"
          :stroke="2.2"
        />
        {{ kept ? 'Remove' : 'Save' }}
      </button>
    </div>

    <!-- Saved: with the account -->
    <div
      v-if="palette.saved.value.length"
      class="mt-3"
    >
      <p class="eyebrow pb-1.5">Your colours</p>
      <div class="flex flex-wrap gap-2.5 pt-1.5 pr-1.5">
        <span
          v-for="ink in palette.saved.value"
          :key="ink"
          class="relative"
        >
          <button
            type="button"
            :aria-label="`Use ${ink}`"
            :aria-pressed="current === ink"
            :class="[
              'block size-6 cursor-pointer rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]',
              current === ink && 'ring-2 ring-brand ring-offset-2 ring-offset-surface',
            ]"
            :style="{ backgroundColor: ink }"
            @click="choose(ink)"
          />
          <!-- Always shown: a cross that waits for hover is one nobody finds. -->
          <button
            type="button"
            :aria-label="`Remove ${ink} from your colours`"
            title="Remove from your colours"
            class="absolute -top-1.5 -right-1.5 z-1 grid size-4 cursor-pointer place-items-center rounded-full bg-surface text-text-soft shadow-[0_0_0_1px_var(--border-strong)] transition-colors hover:bg-danger hover:text-white"
            @click="palette.forget(ink)"
          >
            <UiIcon
              name="x"
              :size="9"
              :stroke="3"
            />
          </button>
        </span>
      </div>
    </div>

    <!-- Recent: this device -->
    <div
      v-if="palette.recent.value.length"
      class="mt-3"
    >
      <p class="eyebrow pb-1.5">Recent</p>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="ink in palette.recent.value"
          :key="ink"
          type="button"
          :aria-label="`Use ${ink}`"
          :aria-pressed="current === ink"
          :class="[
            'block size-6 cursor-pointer rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]',
            current === ink && 'ring-2 ring-brand ring-offset-2 ring-offset-surface',
          ]"
          :style="{ backgroundColor: ink }"
          @click="choose(ink)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* White from the left, black from the bottom, over the pure hue. */
.ink-field {
  background-image:
    linear-gradient(to top, #000, transparent),
    linear-gradient(to right, #fff, transparent);
}

.ink-hue {
  background: linear-gradient(
    to right,
    #f00 0%,
    #ff0 16.67%,
    #0f0 33.33%,
    #0ff 50%,
    #00f 66.67%,
    #f0f 83.33%,
    #f00 100%
  );
}
</style>

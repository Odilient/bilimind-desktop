<script setup lang="ts">
import {
  READING_FONTS,
  READING_SCALE_MAX,
  READING_SCALE_MIN,
  READING_SCALE_STEP,
  READING_THEMES,
  READING_WIDTHS,
} from '~/composables/useReadingSettings'

/**
 * READING — the "Aa" control: zoom, typeface, background, width.
 *
 * Every change previews at once; nothing is written until "Set as default".
 * The button is the whole story of the popover: what you see is yours for the
 * session, and one press makes it yours everywhere.
 */
const props = withDefaults(
  defineProps<{
    /** Where the popover opens relative to the button. */
    align?: 'left' | 'right'
    size?: 'sm' | 'md'
  }>(),
  { align: 'right', size: 'md' },
)

const reading = useReadingSettings()
const { settings, isDefault, saving, canSave } = reading

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const percent = computed(() => `${Math.round(settings.value.scale * 100)}%`)

function onDocumentClick(event: MouseEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') open.value = false
}

watch(open, (isOpen) => {
  if (!import.meta.client) return
  if (isOpen) {
    document.addEventListener('mousedown', onDocumentClick)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('mousedown', onDocumentClick)
    document.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    ref="root"
    class="relative"
  >
    <button
      type="button"
      title="Reading settings"
      aria-label="Reading settings"
      :aria-expanded="open"
      :class="[
        // Cobalt's Aa square: a 34px tile with an inset hairline.
        'flex cursor-pointer items-center justify-center rounded-[10px] bg-surface font-display font-semibold tracking-[-0.03em] text-text-dim shadow-[inset_0_0_0_1px_rgb(var(--wash-rgb)/0.1)] transition-colors hover:bg-surface-mute hover:text-text',
        size === 'sm' ? 'size-8 text-[13px]' : 'size-[34px] text-[14px]',
        open && 'bg-accent-soft! text-accent-strong! shadow-[inset_0_0_0_1px_rgb(141_181_30/0.45)]!',
      ]"
      @click="open = !open"
    >
      <span aria-hidden="true">A<span class="text-[0.78em]">a</span></span>
    </button>

    <div
      v-if="open"
      :class="[
        'pop-in absolute top-full z-50 mt-2 w-[304px] rounded-[18px] bg-surface p-4 shadow-pop ring-1 ring-border',
        align === 'right' ? 'right-0' : 'left-0',
      ]"
      role="dialog"
      aria-label="Reading settings"
    >
      <!-- Size -->
      <div class="mb-3.5">
        <div class="mb-1.5 flex items-center justify-between">
          <span class="eyebrow">Text size</span>
          <span class="text-[11.5px] text-text-faint tabular-nums">{{ percent }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="grid size-7 shrink-0 cursor-pointer place-items-center rounded-[8px] font-display text-[12px] font-semibold text-text-soft hover:bg-surface-mute"
            aria-label="Smaller"
            @click="reading.zoom(-READING_SCALE_STEP)"
          >
            A
          </button>
          <input
            type="range"
            :min="READING_SCALE_MIN"
            :max="READING_SCALE_MAX"
            :step="READING_SCALE_STEP"
            :value="settings.scale"
            aria-label="Text size"
            class="reading-range min-w-0 flex-1"
            @input="reading.set({ scale: Number(($event.target as HTMLInputElement).value) })"
          />
          <button
            type="button"
            class="grid size-7 shrink-0 cursor-pointer place-items-center rounded-[8px] font-display text-[17px] font-semibold text-text-soft hover:bg-surface-mute"
            aria-label="Larger"
            @click="reading.zoom(READING_SCALE_STEP)"
          >
            A
          </button>
        </div>
      </div>

      <!-- Typeface -->
      <div class="mb-3.5">
        <span class="eyebrow mb-1.5 block">Typeface</span>
        <div class="grid grid-cols-2 gap-1.5">
          <button
            v-for="font in READING_FONTS"
            :key="font.value"
            type="button"
            :aria-pressed="settings.font === font.value"
            :class="[
              'cursor-pointer rounded-[12px] border px-3 py-2 text-[15px] transition-colors',
              font.value === 'serif' ? 'reading-font-serif' : '',
              settings.font === font.value
                ? 'border-lime-2 bg-accent-soft font-semibold text-text'
                : 'border-border text-text-dim hover:bg-surface-mute',
            ]"
            @click="reading.set({ font: font.value })"
          >
            {{ font.label }}
          </button>
        </div>
      </div>

      <!-- Width -->
      <div class="mb-3.5">
        <span class="eyebrow mb-1.5 block">Width</span>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="w in READING_WIDTHS"
            :key="w.value"
            type="button"
            :aria-pressed="settings.width === w.value"
            :class="[
              'cursor-pointer rounded-[12px] border px-3 py-2 text-[13.5px] transition-colors',
              settings.width === w.value
                ? 'border-lime-2 bg-accent-soft font-semibold text-text'
                : 'border-border text-text-dim hover:bg-surface-mute',
            ]"
            @click="reading.set({ width: w.value })"
          >
            {{ w.label }}
          </button>
        </div>
      </div>

      <!-- Background -->
      <div class="mb-4">
        <span class="eyebrow mb-1.5 block">Background</span>
        <div class="grid grid-cols-3 gap-1.5">
          <button
            v-for="theme in READING_THEMES"
            :key="theme.value"
            type="button"
            :aria-pressed="settings.theme === theme.value"
            :class="[
              'flex cursor-pointer flex-col items-center gap-1.5 rounded-[12px] border p-2 transition-colors',
              settings.theme === theme.value
                ? 'border-lime-2 bg-accent-soft'
                : 'border-border hover:bg-surface-mute',
            ]"
            @click="reading.set({ theme: theme.value })"
          >
            <span
              class="grid h-8 w-full place-items-center rounded-[8px] border border-[rgb(var(--wash-rgb)/0.1)] font-display text-[12px] font-semibold"
              :style="{ background: theme.swatch, color: theme.ink }"
              aria-hidden="true"
              >Aa</span
            >
            <span class="text-[11.5px] text-text-soft">{{ theme.label }}</span>
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <UiBtn
          v-if="canSave"
          variant="primary"
          size="sm"
          :disabled="isDefault"
          :loading="saving"
          @click="reading.setAsDefault()"
          >{{ isDefault ? 'This is your default' : 'Set as default' }}</UiBtn
        >
        <span
          v-else
          class="text-[11.5px] leading-snug text-text-faint"
          >Sign in to keep these on every device.</span
        >
        <span class="flex-1" />
        <button
          v-if="!isDefault"
          type="button"
          class="cursor-pointer rounded-full px-2.5 py-1 text-[12px] font-medium text-text-soft hover:bg-surface-mute"
          @click="reading.reset()"
        >
          Reset
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.reading-range {
  accent-color: var(--ink);
}
</style>

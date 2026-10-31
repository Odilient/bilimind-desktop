<script setup lang="ts">
import { THEME_OPTIONS, type ThemePreference } from '~/composables/useTheme'

/**
 * System / Light / Dark. The full control is `UiSegmented` with words, for the
 * settings page and the phone sheet. `compact` is the same track with icons
 * only, because the words don't fit in the 232px account popover beside a
 * label, and three glyphs everyone already knows don't need them.
 */
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const theme = useTheme()

const model = computed({
  get: () => theme.preference.value,
  set: (value: string) => theme.set(value as ThemePreference),
})
</script>

<template>
  <div
    v-if="compact"
    role="radiogroup"
    aria-label="Theme"
    class="inline-flex items-center gap-[3px] rounded-[12px] bg-surface-track p-[3px] dark:bg-surface-sunken"
  >
    <button
      v-for="option in THEME_OPTIONS"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      :aria-label="option.label"
      :title="option.label"
      :class="[
        'grid size-[26px] cursor-pointer place-items-center rounded-[9px] transition-colors duration-150',
        model === option.value
          ? 'bg-surface text-text shadow-segment dark:bg-surface-track'
          : 'text-text-faint hover:text-text-dim',
      ]"
      @click="model = option.value"
    >
      <UiIcon
        :name="option.icon"
        :size="14"
      />
    </button>
  </div>

  <UiSegmented
    v-else
    v-model="model"
    :options="THEME_OPTIONS"
    label="Theme"
  />
</template>

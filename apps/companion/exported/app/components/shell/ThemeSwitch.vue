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
const { t } = useI18n()
// The labels follow the language; the values and icons are the composable's.
const options = computed(() =>
  THEME_OPTIONS.map((o) => ({ ...o, label: t(`shell.theme${o.value[0]!.toUpperCase()}${o.value.slice(1)}`) })),
)

const model = computed({
  get: () => theme.preference.value,
  set: (value: string) => theme.set(value as ThemePreference),
})
</script>

<template>
  <div
    v-if="compact"
    role="radiogroup"
    :aria-label="t('shell.theme')"
    class="inline-flex items-center gap-[2px] rounded-[10px] bg-[rgb(var(--wash-rgb)/0.065)] p-[3px]"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      :aria-label="option.label"
      :title="option.label"
      :class="[
        'grid size-[26px] cursor-pointer place-items-center rounded-[8px] transition-colors duration-150',
        model === option.value
          ? 'bg-surface text-text shadow-segment'
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
    :options="options"
    :label="t('shell.theme')"
  />
</template>

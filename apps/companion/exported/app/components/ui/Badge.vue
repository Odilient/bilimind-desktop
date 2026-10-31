<script setup lang="ts">
type Tone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger' | 'outline'
type Size = 'xs' | 'sm'

const props = withDefaults(
  defineProps<{
    tone?: Tone
    size?: Size
    /** Leading status dot. */
    dot?: boolean
    icon?: string
    /** Uppercase mono treatment for metadata chips. */
    mono?: boolean
  }>(),
  { tone: 'neutral', size: 'sm' },
)

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-sunken text-text-soft border-transparent',
  accent: 'bg-accent-soft text-accent-strong border-accent-line',
  success: 'bg-success-soft text-success-text border-success-line',
  warn: 'bg-warn-soft text-warn-text border-warn-line',
  danger: 'bg-danger-soft text-danger-text border-danger-line',
  outline: 'bg-surface text-text-soft border-border-strong',
}

const dots: Record<Tone, string> = {
  neutral: 'bg-text-ghost',
  accent: 'bg-lime-2',
  success: 'bg-success-bright',
  warn: 'bg-warn-bright',
  danger: 'bg-danger-bright',
  outline: 'bg-text-ghost',
}

/**
 * Pills. This is the landing's `.sticker` with the rotation taken out: the
 * page can afford a badge that sits crooked, a list of forty rows cannot.
 */
const sizes: Record<Size, string> = {
  xs: 'h-5 px-2 text-[11px] gap-1 rounded-full',
  sm: 'h-6 px-2.5 text-[12px] gap-1.5 rounded-full',
}
</script>

<template>
  <span
    :class="[
      'inline-flex items-center border font-semibold whitespace-nowrap',
      sizes[props.size],
      tones[props.tone],
      props.mono && 'tracking-[0.06em] uppercase',
    ]"
  >
    <span
      v-if="dot"
      :class="['size-[7px] rounded-full', dots[props.tone]]"
    />
    <UiIcon
      v-else-if="icon"
      :name="icon"
      :size="props.size === 'xs' ? 11 : 12"
    />
    <slot />
  </span>
</template>

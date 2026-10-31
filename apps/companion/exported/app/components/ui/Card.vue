<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

type Tone = 'default' | 'raised' | 'sunken' | 'accent' | 'danger' | 'warn' | 'success'
type Pad = 'none' | 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    to?: RouteLocationRaw
    href?: string
    tone?: Tone
    pad?: Pad
    /** Adds hover affordance even without a link. */
    interactive?: boolean
    as?: string
  }>(),
  { tone: 'default', pad: 'md' },
)

const tones: Record<Tone, string> = {
  default: 'bg-surface border-border',
  raised: 'bg-surface-raised border-border',
  sunken: 'bg-surface-mute border-border',
  accent: 'bg-accent-soft border-accent-line',
  danger: 'bg-danger-soft border-danger-line',
  warn: 'bg-warn-soft border-warn-line',
  success: 'bg-success-soft border-success-line',
}

const pads: Record<Pad, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5 sm:p-6',
}

const isLink = computed(() => Boolean(props.to || props.href))

const tag = computed(() =>
  props.to ? resolveComponent('NuxtLink') : props.href ? 'a' : (props.as ?? 'div'),
)
</script>

<template>
  <component
    :is="tag"
    :to="to"
    :href="href"
    :class="[
      'relative block rounded-xl border transition-[border-color,background-color,box-shadow] duration-200',
      tones[tone],
      pads[pad],
      (isLink || interactive) &&
        'hover:border-border-strong hover:shadow-raised focus-visible:border-brand',
    ]"
  >
    <slot />
  </component>
</template>

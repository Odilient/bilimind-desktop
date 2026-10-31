<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

/**
 * Cobalt's pills. The design runs two different "primary" buttons and they
 * are not interchangeable:
 *
 *  - `primary` is ink. It commits to something the learner already decided —
 *    mark complete, rebuild this node, open the map. In the dark it inverts
 *    to a near-white pill (`--inverse`): an ink pill on an ink page is gone.
 *  - `accent` is the brand's lime, carrying ink rather than white. It is the
 *    same button as the landing's `btn-lime` and it means the same thing
 *    there and here: *go*. In the app that is reserved for spending money —
 *    expanding nodes — which is §4's "gate the one expensive operation".
 *
 * Pills, not rectangles. Every control on the landing is a pill, and the
 * shape is the cheapest, loudest thing the two surfaces can agree on: a
 * visitor who signs up should recognise the button they just pressed. No
 * glow under the lime: cobalt's lime pill sits flat and lets the colour do it.
 */
type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'subtle' | 'danger' | 'success'
type Size = 'xs' | 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    to?: RouteLocationRaw
    href?: string
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    loading?: boolean
    block?: boolean
    /** Square button sized for a single icon. */
    square?: boolean
    icon?: string
    trailingIcon?: string
    label?: string
  }>(),
  { variant: 'secondary', size: 'md', type: 'button' },
)

const variants: Record<Variant, string> = {
  primary: 'bg-inverse text-on-inverse border-transparent hover:bg-inverse-hover font-semibold',
  accent: 'bg-accent text-on-accent border-transparent hover:bg-[#d2f86a] font-semibold',
  secondary:
    'bg-surface text-text border-[rgb(var(--wash-rgb)/0.1)] font-semibold shadow-card hover:shadow-[0_4px_14px_rgb(11_13_16/0.08)]',
  ghost:
    'bg-transparent text-text-muted border-transparent hover:bg-[rgb(var(--wash-rgb)/0.06)] hover:text-text',
  subtle:
    'bg-accent-soft text-accent-strong border-transparent shadow-[inset_0_0_0_1px_var(--accent-line)] font-semibold hover:bg-[#e6f6b9] dark:hover:brightness-125',
  danger: 'bg-surface text-danger border-danger-line font-semibold hover:bg-danger-soft shadow-card',
  success: 'bg-success-soft text-success-text border-success-line font-semibold hover:bg-success-line',
}

const sizes: Record<Size, string> = {
  xs: 'h-7 px-3 text-[12px] rounded-full',
  sm: 'h-8 px-3.5 text-[12.5px] rounded-full',
  md: 'h-[36px] px-4 text-[13.5px] rounded-full',
  lg: 'h-[44px] px-5 text-[14.5px] rounded-full',
}

const gaps: Record<Size, string> = {
  xs: 'gap-1.5',
  sm: 'gap-1.5',
  md: 'gap-[7px]',
  lg: 'gap-2',
}

const squareSizes: Record<Size, string> = {
  xs: 'size-7 rounded-full',
  sm: 'size-8 rounded-full',
  md: 'size-[36px] rounded-full',
  lg: 'size-[44px] rounded-full',
}

const iconSize: Record<Size, number> = { xs: 13, sm: 14, md: 15, lg: 16 }

const classes = computed(() => [
  'relative inline-flex items-center justify-center border font-medium tracking-[-0.005em]',
  'transition-[background-color,border-color,color,opacity,box-shadow,transform] duration-150',
  'active:scale-[0.97]',
  'select-none whitespace-nowrap cursor-pointer',
  props.square ? squareSizes[props.size] : sizes[props.size],
  variants[props.variant],
  props.block && 'w-full',
  (props.disabled || props.loading) && 'pointer-events-none opacity-45',
])

const tag = computed(() => (props.to ? resolveComponent('NuxtLink') : props.href ? 'a' : 'button'))
</script>

<template>
  <component
    :is="tag"
    :to="to"
    :href="href"
    :rel="href ? 'noopener noreferrer' : undefined"
    :target="href ? '_blank' : undefined"
    :type="!to && !href ? type : undefined"
    :disabled="!to && !href ? disabled || loading : undefined"
    :aria-busy="loading || undefined"
    :aria-label="label"
    :class="classes"
  >
    <span
      v-if="loading"
      class="absolute inset-0 grid place-items-center"
    >
      <UiIcon
        name="loader"
        :size="iconSize[size]"
        class="animate-spin-slow"
      />
    </span>
    <span
      class="inline-flex items-center justify-center"
      :class="[loading && 'invisible', gaps[size]]"
    >
      <UiIcon
        v-if="icon"
        :name="icon"
        :size="iconSize[size]"
      />
      <slot />
      <UiIcon
        v-if="trailingIcon"
        :name="trailingIcon"
        :size="iconSize[size]"
      />
    </span>
  </component>
</template>

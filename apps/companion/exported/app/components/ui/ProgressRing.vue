<script setup lang="ts">
const { t } = useI18n()
type Tone = 'accent' | 'success' | 'warn' | 'danger' | 'muted'

const props = withDefaults(
  defineProps<{
    /** 0–100. */
    value: number
    size?: number
    stroke?: number
    tone?: Tone
    /** Show the rounded percentage in the middle. */
    showValue?: boolean
    /** Overrides the centre content with a short string. */
    caption?: string
    label?: string
  }>(),
  { size: 46, stroke: 4, tone: 'accent', showValue: true },
)

const strokes: Record<Tone, string> = {
  accent: 'var(--leaf)',
  success: 'var(--success-bright)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
  muted: 'var(--text-faint)',
}

const clamped = computed(() => Math.max(0, Math.min(100, Math.round(props.value || 0))))
const radius = computed(() => (props.size - props.stroke) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)

/** Start empty, then animate to the real value once mounted. */
const revealed = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    revealed.value = true
  })
})

const offset = computed(() =>
  revealed.value ? circumference.value * (1 - clamped.value / 100) : circumference.value,
)
</script>

<template>
  <div
    class="relative inline-grid shrink-0 place-items-center"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="img"
    :aria-label="label ?? t('ui.complete', { n: clamped })"
  >
    <svg
      :width="size"
      :height="size"
      :viewBox="`0 0 ${size} ${size}`"
      class="-rotate-90"
    >
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="var(--surface-track)"
        :stroke-width="stroke"
      />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke="strokes[tone]"
        :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="offset"
        class="transition-[stroke-dashoffset] duration-[900ms] ease-[cubic-bezier(.16,.84,.44,1)]"
      />
    </svg>
    <!--
      The `%` is not decoration. Without it this was a bare mono figure in a
      circle, which on a card full of other figures reads as a counter rather
      than as "you are 15% through this".
    -->
    <span
      v-if="caption || showValue"
      class="num absolute inset-0 grid place-items-center font-display leading-none font-semibold tracking-[-0.02em]"
      :style="{ fontSize: `${Math.max(9, Math.round(size * 0.27))}px` }"
    >
      <slot>{{ caption ?? `${clamped}%` }}</slot>
    </span>
  </div>
</template>

<script setup lang="ts">
/**
 * Where a date stands, in a few plain words beside its source: "Official",
 * "Heard in class, not official", "Shared in a chat, not official", "Set by
 * you". It used to be a coloured pill with an icon, which looked like a
 * button and asked to be pressed; now it is text, and only official gets a
 * colour, because that is the one a learner can stop worrying about.
 */
import type { Confidence } from '~/companion/types'

const props = defineProps<{ value: Confidence; label?: string }>()

const { t } = useI18n()
</script>

<template>
  <span
    class="text-[13.5px] font-medium"
    :class="props.value === 'official' ? 'text-success-text' : 'text-text-muted'"
  >{{ label ?? t(`today.confidence.${props.value}`) }}</span>
</template>

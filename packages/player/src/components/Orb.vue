<script setup lang="ts">
// Narrator orb: ink core with a breathing ring; lime while playing, the ring follows the voice (--a from peaks).
defineProps<{ label: string; sub: string; on: boolean; amp: number; disabled?: boolean }>();
const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
  <button class="orb" :class="{ on }" type="button" :disabled="disabled" :aria-pressed="on" :style="{ '--a': amp.toFixed(3) }" @click="emit('toggle')">
    <span class="core"><svg aria-hidden="true"><use :href="on ? '#i-pause' : '#i-play'" /></svg></span>
    <span class="lbl"><b>{{ label }}</b><small>{{ sub }}</small></span>
  </button>
</template>

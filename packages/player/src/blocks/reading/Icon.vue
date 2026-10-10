<script setup lang="ts">
// <Icon name="i-flow" /> — inline 24px-viewBox stroke icon (reading/icons.ts). Sized by CSS (width/height).
import { computed } from 'vue';
import { iconSvg } from './icons.ts';
const props = defineProps<{ name: string }>();
const inner = computed(() => iconSvg(props.name));
</script>

<template>
  <svg class="bm-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false" v-html="inner" />
</template>

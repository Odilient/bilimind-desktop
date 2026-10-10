<script setup lang="ts">
// <Icon name="i-play" />: one symbol from the inlined sprite (sprite.ts).
defineProps<{ name: string }>();
</script>

<template><svg class="ico" aria-hidden="true" focusable="false"><use :href="'#' + name" /></svg></template>

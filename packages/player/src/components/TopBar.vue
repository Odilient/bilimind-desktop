<script setup lang="ts">
// Home top bar: brand + "Works offline", course progress ring, Sources button (player-design §3.1).
import { computed } from 'vue';
import { useBarState } from '../runtime/useBar.ts';

const props = defineProps<{ pct: number }>();
const emit = defineEmits<{ sources: [] }>();
const { scrolled, away } = useBarState();
const pctLabel = computed(() => `${Math.round(props.pct * 100)}%`);
</script>

<template>
  <header class="tb" :class="{ scrolled, away }">
    <a class="brand" href="#/" aria-label="BiliMind, course home"><svg aria-hidden="true"><use href="#mark" /></svg>BiliMind</a>
    <span class="made"><i><svg class="ico" style="width:10px;height:10px" aria-hidden="true"><use href="#i-spark" /></svg></i><span class="long">Works&nbsp;</span>offline</span>
    <span class="grow"></span>
    <span class="ringp" :style="{ '--p': pct }" role="img" :aria-label="`Course ${pctLabel} complete`"></span>
    <span class="pct" aria-hidden="true">{{ pctLabel }}</span>
    <button class="sq" type="button" aria-label="Your files" title="Your files" @click="emit('sources')"><svg aria-hidden="true"><use href="#i-file" /></svg></button>
  </header>
</template>

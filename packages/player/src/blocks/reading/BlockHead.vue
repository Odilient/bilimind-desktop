<script setup lang="ts">
// The shared block header (player-design §5.0): icon tile + eyebrow + actions, then the block title.
// Learner words come from core BLOCK_META; the type id itself is never shown.
import { computed } from 'vue';
import { BLOCK_META } from '@bilimind/core';
import Icon from './Icon.vue';

const props = defineProps<{ type: string; title?: string | null; eyebrow?: string; icon?: string; bare?: boolean }>();
const meta = computed(() => (BLOCK_META as Record<string, { eyebrow: string; icon: string }>)[props.type] ?? { eyebrow: '', icon: 'i-spark' });
const eb = computed(() => props.eyebrow ?? meta.value.eyebrow);
const ic = computed(() => props.icon ?? meta.value.icon);
</script>

<template>
  <header v-if="eb && !bare" class="blk-h">
    <span class="bi"><Icon :name="ic" /></span>
    <span class="be">{{ eb }}</span>
    <span v-if="$slots.act" class="act"><slot name="act" /></span>
  </header>
  <h3 v-if="title" class="blk-t">{{ title }}</h3>
</template>

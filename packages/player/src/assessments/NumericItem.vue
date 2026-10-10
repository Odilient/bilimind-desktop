<script setup lang="ts">
// numeric: one number field with the unit beside it; Enter checks. After grading the field turns lime or
// coral and the grader's direction ("too high" / "too low") shows as a tag.
import { computed, ref, watch } from 'vue';
import type { CourseAssessment, GradeResult, ItemResponse } from '@bilimind/core';
import Ico from './ui/Ico.vue';

const props = defineProps<{ item: CourseAssessment; checked: boolean; uid: string; result?: GradeResult | null }>();
const response = defineModel<ItemResponse | null>('response', { default: null });
const emit = defineEmits<{ submit: [] }>();

const value = ref('');
const unit = computed(() => {
  const k = (props.item.answer_key ?? {}) as { unit?: string | null };
  return typeof k.unit === 'string' ? k.unit : '';
});
watch(value, v => { response.value = v.trim() ? { kind: 'numeric', value: v } : null; });
watch(() => props.checked, c => { if (!c) { value.value = ''; response.value = null; } });
const cls = computed(() => (!props.checked || !props.result ? '' : props.result.correct ? 'ok' : 'bad'));
</script>

<template>
  <div class="num-row">
    <label class="num-f" :class="cls">
      <span class="sr-only">Your answer{{ unit ? ` in ${unit}` : '' }}</span>
      <input v-model="value" inputmode="decimal" autocomplete="off" :id="uid" :disabled="checked" placeholder="Your answer"
        @keydown.enter.prevent="response && emit('submit')" />
      <span v-if="unit" class="u">{{ unit }}</span>
      <Ico v-if="cls === 'ok'" name="check" />
      <Ico v-else-if="cls === 'bad'" name="x" />
    </label>
    <span v-if="checked && result?.direction === 'too_high'" class="tag bad">Too high</span>
    <span v-else-if="checked && result?.direction === 'too_low'" class="tag bad">Too low</span>
  </div>
</template>

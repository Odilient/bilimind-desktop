<script setup lang="ts">
import { REGENERATE_PRESETS } from '~/composables/useNodePlayer'

/**
 * How the learner wants a lesson written: their own words, or a tap on a common
 * one. The same field before a first write and before a rewrite, so nobody has
 * to wait for a lesson in order to ask for a different one. `submit` is Enter;
 * the slot is for a button beside the field.
 */
const instruction = defineModel<string>({ default: '' })
const emit = defineEmits<{ submit: [] }>()
</script>

<template>
  <div class="grid gap-2.5">
    <div class="flex items-start gap-2">
      <!-- A textarea that grows, because a tapped preset is a whole sentence and
           a one-line field showed only the start of it. -->
      <textarea
        v-model="instruction"
        rows="1"
        maxlength="500"
        placeholder="How should it be written? Optional"
        aria-label="How the lesson should be written"
        class="field-sizing-content min-h-11 min-w-0 flex-1 resize-none rounded-[12px] border border-border-field bg-surface px-3.5 py-[11px] text-[13.5px] leading-snug outline-none focus:border-hi-2 focus:shadow-[0_0_0_4px_rgb(255_212_71/0.35)]"
        @keydown.enter.prevent="emit('submit')"
      />
      <slot />
    </div>
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="preset in REGENERATE_PRESETS"
        :key="preset.label"
        type="button"
        :class="[
          'cursor-pointer rounded-full border px-3 py-1 text-[12px] font-medium transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand',
          instruction === preset.instruction
            ? 'border-brand bg-brand-soft text-brand'
            : 'border-border-strong bg-surface text-text-soft',
        ]"
        :aria-pressed="instruction === preset.instruction"
        @click="instruction = instruction === preset.instruction ? '' : preset.instruction"
      >
        {{ preset.label }}
      </button>
    </div>
  </div>
</template>

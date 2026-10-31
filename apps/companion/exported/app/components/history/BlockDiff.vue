<script setup lang="ts">
import type { DiffToken } from '~/types/api'

/**
 * A word-level diff of one field, the way a document's version history shows
 * it: deletions struck through in red, insertions underlined in green, and
 * the rest as it is. The tokens come from the server; this only paints them.
 */
defineProps<{
  tokens: DiffToken[]
  loading?: boolean
}>()
</script>

<template>
  <div
    class="rounded-[14px] bg-surface-mute px-3.5 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap shadow-[inset_0_0_0_1px_var(--border)]"
  >
    <span
      v-if="loading"
      class="text-text-faint"
      >Comparing…</span
    >
    <template v-else-if="tokens.length">
      <template
        v-for="(token, index) in tokens"
        :key="index"
      >
        <del
          v-if="token.op === 'del'"
          class="rounded-[3px] bg-danger-soft px-0.5 text-danger no-underline line-through decoration-danger/60"
          >{{ token.text }}</del
        >
        <ins
          v-else-if="token.op === 'ins'"
          class="rounded-[3px] bg-lime-soft px-0.5 text-accent-strong no-underline"
          >{{ token.text }}</ins
        >
        <span v-else>{{ token.text }}</span>
      </template>
    </template>
    <span
      v-else
      class="text-text-faint"
      >No difference in this field.</span
    >
  </div>
</template>

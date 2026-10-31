<script setup lang="ts">
/**
 * Hints, one at a time, and never re-collapsible.
 *
 * They are locked until an attempt has been made, because a hint read before
 * the attempt REPLACES the attempt — and the point of the exercise is the
 * fifteen seconds of being stuck. After that a stuck learner with no exit
 * abandons the lesson, which is worse than one who took a nudge.
 *
 * A hint names the next thing to try. It never contains the finished code:
 * there is no solution reveal here and there is no `solution_code` in the
 * payload, because `LeakGuard` does not strip that key and the answer would ship
 * to the browser with the lesson.
 */
const props = defineProps<{
  hints: string[]
  revealed: number
  locked: boolean
  /** Why it is locked, said plainly rather than as a disabled button with no reason. */
  lockReason: string
}>()

const emit = defineEmits<{ reveal: [] }>()

const remaining = computed(() => props.hints.length - props.revealed)
</script>

<template>
  <div
    v-if="hints.length"
    class="border-t border-code-line px-3.5 py-2.5"
  >
    <ol
      v-if="revealed > 0"
      class="mb-2 flex flex-col gap-1.5"
    >
      <li
        v-for="(hint, index) in hints.slice(0, revealed)"
        :key="index"
        class="flex gap-2 text-[12px] leading-relaxed text-code-dim"
      >
        <span class="mono-num shrink-0 text-[11px] text-code-meta">{{ index + 1 }}</span>
        <span class="min-w-0">{{ hint }}</span>
      </li>
    </ol>

    <button
      v-if="remaining > 0"
      type="button"
      class="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-code-meta transition-colors hover:text-code-dim disabled:cursor-default disabled:opacity-50"
      :disabled="locked"
      @click="emit('reveal')"
    >
      <UiIcon
        name="spark"
        :size="12"
      />
      Show a hint ({{ revealed + 1 }} of {{ hints.length }})
    </button>
    <p
      v-else
      class="text-[11.5px] text-code-meta"
    >
      That was the last hint.
    </p>

    <p
      v-if="locked && remaining > 0"
      class="mt-1 text-[11px] text-code-meta"
    >
      {{ lockReason }}
    </p>
  </div>
</template>

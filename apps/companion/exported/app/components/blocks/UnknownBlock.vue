<script setup lang="ts">
import type { Block } from '~/types/api'
import BlockShell from './BlockShell.vue'

/**
 * The graceful fallback required by SPEC §3: a block type this build does not
 * know about must never crash the player.
 *
 * What the learner gets is the words the payload holds, framed like any other
 * block. What they do NOT get is the type key, an apology about the player's
 * version, or a JSON dump — a renderer we have not written is our problem, and
 * printing our problem into the middle of somebody's lesson is how a teaching
 * page turns into a build log. Those go behind `import.meta.dev`, where the
 * person who can act on them is.
 */
const props = defineProps<{ block: Block | { id: number; type: string; payload: unknown } }>()

const type = computed(() => String((props.block as { type?: unknown }).type ?? 'unknown'))

const payload = computed<Record<string, unknown>>(() => {
  const value = (props.block as { payload?: unknown }).payload
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
})

/** Any top-level string worth showing without guessing at structure. */
const readable = computed(() =>
  Object.entries(payload.value)
    .filter(([, value]) => typeof value === 'string' && value.trim() !== '')
    .map(([key, value]) => ({ key: key.replace(/_/g, ' '), value: String(value) })),
)

const devMode = import.meta.dev

const json = computed(() => {
  try {
    return JSON.stringify(payload.value, null, 2)
  } catch {
    return '{}'
  }
})
</script>

<template>
  <BlockShell
    :type="type"
  >
    <dl
      v-if="readable.length"
      class="flex flex-col gap-2"
    >
      <div
        v-for="entry in readable"
        :key="entry.key"
      >
        <dt class="eyebrow">{{ entry.key }}</dt>
        <dd class="mt-1 text-[13.5px] leading-relaxed whitespace-pre-wrap text-text-muted">
          {{ entry.value }}
        </dd>
      </div>
    </dl>

    <p
      v-else
      class="text-[13px] leading-relaxed text-text-faint italic"
    >
      This part of the lesson could not be displayed.
    </p>

    <details
      v-if="devMode"
      class="mt-3"
    >
      <summary class="cursor-pointer text-[12px] text-text-faint hover:text-text"
        >{{ type }} · raw payload</summary
      >
      <pre
        class="mt-2 max-h-64 overflow-auto rounded-[12px] bg-code-bg p-3 font-mono text-[11.5px] leading-relaxed text-code-text"
      >{{ json }}</pre>
    </details>
  </BlockShell>
</template>

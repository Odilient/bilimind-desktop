<script setup lang="ts">
/**
 * A fenced code block with a copy button. Content is bound as text, never HTML,
 * so nothing inside it can execute.
 */
const props = withDefaults(
  defineProps<{
    code: string
    language?: string
    /** Small label rendered where the language chip goes. */
    caption?: string
    maxHeight?: string
  }>(),
  { language: '', maxHeight: '30rem' },
)

const copied = ref(false)
const failed = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const lines = computed(() => props.code.replace(/\n$/, '').split('\n').length)

async function copy(): Promise<void> {
  failed.value = false

  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
  } catch {
    failed.value = true
  }

  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    copied.value = false
    failed.value = false
  }, 1800)
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <!-- Code sits on cobalt's ink stage, the same room as the sandbox: a read-only
       snippet and an editable exercise should not look like two products. -->
  <figure class="snippet group relative overflow-hidden rounded-[14px] bg-code-bg">
    <figcaption
      class="flex items-center justify-between gap-3 border-b border-white/8 px-3.5 py-2 text-code-meta"
    >
      <span class="flex min-w-0 items-center gap-2">
        <span class="size-[7px] shrink-0 rounded-full bg-lime" />
        <span class="truncate text-[11.5px] font-semibold tracking-[0.04em] lowercase">{{
          caption || language || 'code'
        }}</span>
      </span>
      <span class="flex items-center gap-2">
        <span class="mono-num text-[11px]">{{ lines }} {{ lines === 1 ? 'line' : 'lines' }}</span>
        <button
          type="button"
          class="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-white/8 px-2.5 text-[11.5px] font-semibold text-code-dim transition-colors hover:bg-white/14 hover:text-white"
          @click="copy"
        >
          <UiIcon
            :name="copied ? 'check' : failed ? 'alert' : 'file'"
            :size="12"
          />
          {{ copied ? 'Copied' : failed ? 'Press Ctrl+C' : 'Copy' }}
        </button>
      </span>
    </figcaption>

    <pre
      class="overflow-x-auto px-4 py-3.5 font-mono text-[12.5px] leading-[1.7] text-code-text"
      :style="{ maxHeight }"
    ><code>{{ code }}</code></pre>
  </figure>
</template>

<style scoped>
/* A snippet lives inside generated prose, whose `.md code` rule paints inline
   code as a light chip. On the ink stage that chip would sit behind every line. */
.snippet pre > code {
  padding: 0;
  border-radius: 0;
  background: none;
  color: inherit;
  font-size: inherit;
}
</style>

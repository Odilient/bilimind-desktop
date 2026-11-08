<script setup lang="ts">
import type { RunLang } from '~/composables/useWasmSandbox'
import { LANG_MARKS } from '~/composables/useCodeExercise'

/**
 * The one-time WASM download, explained while it happens.
 *
 * Pyodide is ~10MB from a CDN. A learner who presses Run and gets a dead button
 * for eight seconds concludes the exercise is broken, so the wait says what it
 * is for and — the part that matters — that it happens once.
 */
const { t } = useI18n()
const props = defineProps<{
  lang: RunLang
  /** `failed` shows the loader's own stderr, which already explains a blocked CDN. */
  phase: 'warming' | 'failed'
  message?: string | null
}>()

const mark = computed(() => LANG_MARKS[props.lang])

/**
 * What the wait is actually for, in a number the learner can weigh against their
 * connection. JavaScript ships with the app and never reaches this card, and HTML
 * needs no runtime at all — so only the two CDN runtimes are named.
 */
const DOWNLOAD_SIZE: Partial<Record<RunLang, string>> = {
  python: 'check.assess.code.sizePython',
  sql: 'check.assess.code.sizeSql',
}

const size = computed(() => (DOWNLOAD_SIZE[props.lang] ? t(DOWNLOAD_SIZE[props.lang]!) : ''))
</script>

<template>
  <div class="flex h-full min-h-[150px] flex-col items-center justify-center gap-3 px-6 py-8 text-center">
    <span
      class="lang-tile"
      :class="phase === 'warming' ? 'is-loading' : ''"
      :style="{ '--lc': mark.color }"
      aria-hidden="true"
      >{{ mark.glyph }}</span
    >

    <div v-if="phase === 'warming'">
      <p class="text-[12.5px] font-medium text-code-dim">{{ t('check.assess.code.preparing', { lang: mark.label }) }}</p>
      <p class="mt-0.5 text-[11px] text-code-meta">
        {{ size ? t('check.assess.code.downloadsSize', { size }) : t('check.assess.code.downloadsOnce') }}
      </p>
    </div>

    <div
      v-else
      class="max-w-[38ch]"
    >
      <p class="text-[12.5px] font-medium text-danger-on-dark">
        {{ t('check.assess.code.loadFailed', { lang: mark.label }) }}
      </p>
      <p
        v-if="message"
        class="mt-1 font-mono text-[11px] leading-relaxed break-words text-code-meta"
      >
        {{ message }}
      </p>
    </div>

    <span
      v-if="phase === 'warming'"
      class="prep-bar"
      ><span class="prep-bar-fill"
    /></span>
  </div>
</template>

<style scoped>
.lang-tile {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--lc);
  background: color-mix(in oklab, var(--lc) 20%, transparent);
  border: 1px solid color-mix(in oklab, var(--lc) 34%, transparent);
}
.lang-tile.is-loading {
  animation: tile-pulse 1.4s ease-in-out infinite;
}
@keyframes tile-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in oklab, var(--lc) 40%, transparent);
  }
  50% {
    box-shadow: 0 0 0 6px color-mix(in oklab, var(--lc) 0%, transparent);
  }
}

.prep-bar {
  position: relative;
  width: 132px;
  height: 3px;
  border-radius: 999px;
  overflow: hidden;
  background: color-mix(in oklab, var(--color-code-line) 70%, transparent);
}
.prep-bar-fill {
  position: absolute;
  inset: 0;
  width: 40%;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, var(--color-accent), transparent);
  animation: prep-slide 1.15s ease-in-out infinite;
}
@keyframes prep-slide {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(320%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .prep-bar-fill,
  .lang-tile.is-loading {
    animation: none;
  }
}
</style>

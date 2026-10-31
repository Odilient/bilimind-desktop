<script setup lang="ts">
/**
 * The learner's markup, live, inside a little browser window.
 *
 * `sandbox="allow-scripts"` WITHOUT `allow-same-origin` is a security boundary,
 * not a styling choice: the two together would hand the learner's page our own
 * origin and with it the session cookie, localStorage and the parent DOM. Alone,
 * `allow-scripts` gives the frame an opaque origin and scripts that can only
 * talk to themselves.
 *
 * The debounce is what makes this a preview rather than a strobe. `srcdoc` is
 * bound to a delayed copy of the buffer so the iframe reloads a few hundred
 * milliseconds after typing stops, and the `key` deliberately does NOT include
 * the document — remounting per keystroke would throw away scroll position and
 * flash white on every character.
 */
const props = withDefaults(
  defineProps<{
    code: string
    debounceMs?: number
    fileName?: string
  }>(),
  { debounceMs: 400, fileName: 'index.html' },
)

const rendered = ref(props.code)
/** Bumped only by the refresh control — a manual "run it again from the top". */
const nonce = ref(0)

let timer: ReturnType<typeof setTimeout> | undefined

watch(
  () => props.code,
  (next) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      rendered.value = next
    }, props.debounceMs)
  },
)

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div class="flex h-full min-h-[180px] flex-col">
    <div class="browser-bar">
      <span
        class="browser-dots"
        aria-hidden="true"
      >
        <i style="background: #ff5f57" />
        <i style="background: #febc2e" />
        <i style="background: #28c840" />
      </span>
      <span class="browser-url">
        <UiIcon
          name="globe"
          :size="10"
        />
        {{ fileName }}
      </span>
      <button
        type="button"
        class="browser-refresh"
        title="Reload the preview"
        aria-label="Reload the preview"
        @click="nonce++"
      >
        <UiIcon
          name="refresh"
          :size="11"
        />
      </button>
    </div>
    <iframe
      :key="nonce"
      :srcdoc="rendered"
      sandbox="allow-scripts"
      title="Preview of your page"
      class="min-h-0 w-full flex-1 border-0 bg-white"
    />
  </div>
</template>

<style scoped>
.browser-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--color-code-line);
  background: var(--color-code-bar);
}
.browser-dots {
  display: inline-flex;
  gap: 5px;
}
.browser-dots i {
  width: 9px;
  height: 9px;
  border-radius: 999px;
}
.browser-url {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  min-width: 0;
  padding: 3px 9px;
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--color-code-meta);
  background: color-mix(in oklab, var(--color-code-line) 45%, transparent);
}
.browser-refresh {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--color-code-meta);
  cursor: pointer;
}
.browser-refresh:hover {
  color: var(--color-code-text);
  background: color-mix(in oklab, var(--color-code-line) 60%, transparent);
}
</style>

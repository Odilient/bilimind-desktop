<script setup lang="ts">
import type { RunLang, RunResult, SandboxTest } from '~/composables/useWasmSandbox'
import {
  SANDBOX_INIT,
  SANDBOX_READY,
  SANDBOX_RESULT,
  type SandboxInitPayload,
} from '~/composables/useSandboxWindow'

/**
 * Standalone, full-window sandbox — the "separate window like codecademy.com".
 * Runs with no app chrome (`layout: false`) and fills the viewport.
 *
 * It sources its starter payload, in order of preference:
 *   1. a `postMessage` `SANDBOX_INIT` from the opener (best — large code stays
 *      off the URL), announced by posting `SANDBOX_READY` on mount;
 *   2. a `sessionStorage` key the embedder stashed before opening;
 *   3. the URL query (`?lang=python`) as a last resort.
 *
 * Every run is posted back to the opener as `SANDBOX_RESULT` so an embedding
 * lesson can capture pass/fail from the popped-out window.
 */

definePageMeta({ layout: false })

const SESSION_KEY = 'bilimind:sandbox-payload'
const VALID_LANGS: RunLang[] = ['python', 'javascript', 'sql', 'html']

function coerceLang(value: unknown): RunLang {
  return VALID_LANGS.includes(value as RunLang) ? (value as RunLang) : 'python'
}

const lang = ref<RunLang>('python')
const code = ref<string>('')
const tests = ref<SandboxTest[]>([])
const source = ref<'query' | 'session' | 'message' | 'default'>('default')

function applyPayload(payload: Partial<SandboxInitPayload>, from: typeof source.value) {
  if (payload.lang) lang.value = coerceLang(payload.lang)
  if (typeof payload.code === 'string') code.value = payload.code
  if (Array.isArray(payload.tests)) tests.value = payload.tests
  source.value = from
}

function onResult(result: RunResult) {
  if (import.meta.client && window.opener && !window.opener.closed) {
    window.opener.postMessage(
      { type: SANDBOX_RESULT, payload: result },
      window.location.origin,
    )
  }
}

let onMessage: ((event: MessageEvent) => void) | undefined

onMounted(() => {
  const route = useRoute()

  // 3) URL query — lowest priority, seeds a starting point immediately.
  const q = route.query
  if (typeof q.lang === 'string') applyPayload({ lang: coerceLang(q.lang) }, 'query')
  if (typeof q.code === 'string') applyPayload({ code: q.code }, 'query')

  // 2) sessionStorage stash (large starter code without a huge URL).
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SandboxInitPayload>
      applyPayload(parsed, 'session')
      sessionStorage.removeItem(SESSION_KEY)
    }
  } catch {
    // Ignore malformed / unavailable storage.
  }

  // 1) postMessage handshake — the authoritative source when an opener exists.
  onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return
    const data = event.data as { type?: string; payload?: SandboxInitPayload } | null
    if (!data || data.type !== SANDBOX_INIT || !data.payload) return
    applyPayload(data.payload, 'message')
  }
  window.addEventListener('message', onMessage)

  // Tell the opener we are ready to receive an init payload.
  if (window.opener && !window.opener.closed) {
    window.opener.postMessage({ type: SANDBOX_READY }, window.location.origin)
  }
})

onBeforeUnmount(() => {
  if (onMessage) window.removeEventListener('message', onMessage)
})

useHead({ title: 'BiliMind Sandbox' })

// No frame here, so the theme is asked for directly: a sandbox popped out of
// a dark lesson should not open as a white window.
useAppTheme()
</script>

<template>
  <div class="flex h-dvh w-full flex-col bg-bg">
    <header
      class="flex items-center gap-3 px-4 py-3 sm:px-5"
    >
      <UiBrandMark class="size-8" />
      <div class="leading-tight">
        <p class="t-head text-[15px] text-text">Code Sandbox</p>
        <p class="text-[11px] text-text-faint">Runs entirely in your browser</p>
      </div>
      <UiBadge
        tone="outline"
        size="xs"
        mono
        class="ml-auto"
        >{{ lang }}</UiBadge
      >
    </header>

    <main class="min-h-0 flex-1 px-2.5 pb-2.5 sm:px-4 sm:pb-4">
      <SandboxCodeSandbox
        :key="source"
        class="h-full"
        :initial-code="code"
        :initial-lang="lang"
        :tests="tests"
        @result="onResult"
      />
    </main>
  </div>
</template>

import type { RunLang, RunResult, SandboxTest } from '~/composables/useWasmSandbox'

/**
 * Opens the WebAssembly sandbox in a SEPARATE browser window (the
 * "Codecademy-style" pop-out) and bridges it to the embedding lesson over
 * `postMessage`.
 *
 * Handshake (all messages are same-origin and namespaced):
 *   1. lesson calls `openSandbox(...)` → `window.open('/sandbox', ...)`
 *   2. the sandbox page posts `SANDBOX_READY` to its opener once mounted
 *   3. this composable answers with `SANDBOX_INIT` carrying the starter payload
 *   4. every run in the popped-out window posts `SANDBOX_RESULT` back here
 *
 * If the popup is blocked, `blocked` is `true` and `window` is `null` — the
 * caller should fall back to rendering `<SandboxCodeSandbox>` inline instead.
 */

export const SANDBOX_READY = 'bilimind:sandbox-ready'
export const SANDBOX_INIT = 'bilimind:sandbox-init'
export const SANDBOX_RESULT = 'bilimind:sandbox-result'

export interface SandboxInitPayload {
  lang: RunLang
  code: string
  tests?: SandboxTest[]
}

export interface SandboxReadyMessage {
  type: typeof SANDBOX_READY
}
export interface SandboxInitMessage {
  type: typeof SANDBOX_INIT
  payload: SandboxInitPayload
}
export interface SandboxResultMessage {
  type: typeof SANDBOX_RESULT
  payload: RunResult
}

export interface SandboxWindowHandle {
  /** The opened window, or `null` when the popup was blocked. */
  window: Window | null
  /** True when `window.open` returned null (popup blocked / disallowed). */
  blocked: boolean
  /** Resolves once the child window has completed the ready handshake. */
  ready: Promise<void>
  /** Subscribe to each run result the child posts back. Returns an unsubscribe. */
  onResult(handler: (result: RunResult) => void): () => void
  /** Subscribe to the child window closing. Returns an unsubscribe. */
  onClosed(handler: () => void): () => void
  /** Push a fresh payload into an already-open window. */
  send(payload: SandboxInitPayload): void
  /** Focus the child window if still open. */
  focus(): void
  /** Close the child window and tear down listeners. */
  close(): void
}

const DEFAULT_FEATURES = 'popup=yes,width=1024,height=720,menubar=no,toolbar=no,location=no'

export function useSandboxWindow() {
  /**
   * Open (or re-open) the sandbox window. Safe to call from an event handler —
   * the `window.open` happens synchronously so it is not treated as a popup by
   * most browsers.
   */
  function openSandbox(
    payload: SandboxInitPayload,
    opts?: { name?: string; features?: string },
  ): SandboxWindowHandle {
    const resultHandlers = new Set<(result: RunResult) => void>()
    const closedHandlers = new Set<() => void>()

    // SSR / non-browser guard.
    if (!import.meta.client || typeof window === 'undefined') {
      return {
        window: null,
        blocked: true,
        ready: Promise.reject(new Error('Sandbox windows are only available in the browser.')),
        onResult: () => () => {},
        onClosed: () => () => {},
        send: () => {},
        focus: () => {},
        close: () => {},
      }
    }

    const origin = window.location.origin
    const child = window.open(
      '/sandbox',
      opts?.name ?? 'bilimind-sandbox',
      opts?.features ?? DEFAULT_FEATURES,
    )

    if (!child) {
      // Popup blocked — caller renders the sandbox inline instead.
      return {
        window: null,
        blocked: true,
        ready: Promise.reject(new Error('popup-blocked')),
        onResult: (handler) => {
          resultHandlers.add(handler)
          return () => resultHandlers.delete(handler)
        },
        onClosed: (handler) => {
          closedHandlers.add(handler)
          return () => closedHandlers.delete(handler)
        },
        send: () => {},
        focus: () => {},
        close: () => {},
      }
    }

    let latestPayload = payload
    let closedPoll: ReturnType<typeof setInterval> | undefined
    let resolveReady!: () => void
    const ready = new Promise<void>((resolve) => {
      resolveReady = resolve
    })

    function post(message: SandboxInitMessage) {
      if (child && !child.closed) child.postMessage(message, origin)
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== origin) return
      if (event.source !== child) return
      const data = event.data as { type?: string; payload?: unknown } | null
      if (!data || typeof data.type !== 'string') return

      if (data.type === SANDBOX_READY) {
        post({ type: SANDBOX_INIT, payload: latestPayload })
        resolveReady()
      } else if (data.type === SANDBOX_RESULT) {
        for (const handler of resultHandlers) handler(data.payload as RunResult)
      }
    }

    function teardown() {
      window.removeEventListener('message', onMessage)
      if (closedPoll) clearInterval(closedPoll)
      closedPoll = undefined
    }

    window.addEventListener('message', onMessage)

    // Detect the user closing the window.
    closedPoll = setInterval(() => {
      if (child.closed) {
        teardown()
        for (const handler of closedHandlers) handler()
      }
    }, 700)

    return {
      window: child,
      blocked: false,
      ready,
      onResult: (handler) => {
        resultHandlers.add(handler)
        return () => resultHandlers.delete(handler)
      },
      onClosed: (handler) => {
        closedHandlers.add(handler)
        return () => closedHandlers.delete(handler)
      },
      send: (next) => {
        latestPayload = next
        post({ type: SANDBOX_INIT, payload: next })
      },
      focus: () => {
        if (child && !child.closed) child.focus()
      },
      close: () => {
        teardown()
        if (child && !child.closed) child.close()
      },
    }
  }

  return { openSandbox }
}

/**
 * "Sign in with OpenRouter": OpenRouter's OAuth PKCE flow (openrouter.ai/docs,
 * "OAuth PKCE", checked 7 Nov 2026). There is no client id and nothing to register.
 *
 *   1. `startOpenRouterSignIn()` makes a code_verifier, keeps it (and a `state`)
 *      in this tab's sessionStorage, and sends the learner to openrouter.ai/auth
 *      with the S256 challenge. The callback is `/app/openrouter`, a plain path,
 *      so OpenRouter's `?code=` can't collide with a query of ours.
 *   2. That page calls `finishOpenRouterSignIn(code, state)`: the state must be
 *      the one this tab sent (a link someone else made can't plant their key),
 *      and the code and verifier go to `POST /credentials/openrouter`, where the
 *      API exchanges them for the key and saves it like a pasted one. The key
 *      itself never reaches the browser.
 *
 * Only where the page has an http(s) origin to come back to: the desktop app runs
 * on `app://`, which OpenRouter can't redirect to, so there it's "paste your key".
 */
import type { Credential } from '~/composables/useCredentials'

const VERIFIER = 'bm:openrouter-verifier'
const STATE = 'bm:openrouter-state'

export const OPENROUTER_CALLBACK_PATH = '/app/openrouter'

function base64url(bytes: Uint8Array): string {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function random(bytes: number): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)))
}

/** Whether this page can be come back to from openrouter.ai. */
export function canSignInWithOpenRouter(): boolean {
  return import.meta.client && /^https?:$/.test(window.location.protocol) && Boolean(crypto?.subtle)
}

export async function startOpenRouterSignIn(): Promise<void> {
  // 48 random bytes is a 64-character verifier, inside RFC 7636's 43–128.
  const verifier = random(48)
  const state = random(16)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))

  sessionStorage.setItem(VERIFIER, verifier)
  sessionStorage.setItem(STATE, state)

  const url = new URL('https://openrouter.ai/auth')
  url.searchParams.set('callback_url', `${window.location.origin}${OPENROUTER_CALLBACK_PATH}`)
  url.searchParams.set('code_challenge', base64url(new Uint8Array(digest)))
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', state)
  url.searchParams.set('key_label', 'BiliMind')
  window.location.assign(url.toString())
}

/**
 * Finish it. Throws an Error with a sentence for the learner when the tab doesn't
 * know this sign-in, and the ApiError when the exchange is refused.
 */
export async function finishOpenRouterSignIn(code: string, state: string | null): Promise<Credential> {
  const verifier = sessionStorage.getItem(VERIFIER)
  const sent = sessionStorage.getItem(STATE)
  sessionStorage.removeItem(VERIFIER)
  sessionStorage.removeItem(STATE)

  // OpenRouter returns `state` except when the learner said no; no verifier means
  // this tab never started a sign-in.
  if (!verifier || (state !== null && state !== sent)) {
    throw new Error('That sign-in didn\'t start here. Press "Sign in with OpenRouter" again.')
  }

  return useApi().post<Credential>('/credentials/openrouter', { code, code_verifier: verifier })
}

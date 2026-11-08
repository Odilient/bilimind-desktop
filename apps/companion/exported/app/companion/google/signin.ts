/**
 * "Continue with Google" (Daylight 2, gaps; the hero's sign-up card).
 *
 * Google Identity Services draws its own button (Google's branding rules ask
 * for it) in an element the screen provides; a press gives an ID token, which
 * the API checks with Google and turns into a session (`POST /auth/google`,
 * backend Auth\GoogleIdToken). The session lands exactly like a sign-in or a
 * sign-up (`useAuth().applySession`), so whatever the screen does after
 * either works the same.
 *
 *   googleSignInAvailable()               the client id is set, and this is a browser
 *   mountGoogleButton(el, { onSignedIn }) draws the button; null when unavailable
 *
 * The client is the web OAuth client the Drive Picker uses
 * (NUXT_PUBLIC_GOOGLE_CLIENT_ID); the API needs the same id as GOOGLE_CLIENT_ID.
 * Hidden on the desktop and phone apps: Google refuses sign-in from embedded
 * webviews.
 */
import { Capacitor } from '@capacitor/core'
import { useApi } from '~/composables/useApi'
import { useAuth, type AuthSession } from '~/composables/useAuth'
import { isDesktopApp } from '../platform'
import { browserZone } from '../time'

const GIS = 'https://accounts.google.com/gsi/client'

interface GoogleId {
  accounts: {
    id: {
      initialize(config: Record<string, unknown>): void
      renderButton(el: HTMLElement, options: Record<string, unknown>): void
    }
  }
}

function clientId(): string {
  return String(useRuntimeConfig().public.googleClientId ?? '')
}

export function googleSignInAvailable(): boolean {
  return import.meta.client && clientId() !== '' && !isDesktopApp() && !Capacitor.isNativePlatform()
}

let loading: Promise<void> | null = null

function loadGis(): Promise<void> {
  loading ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = GIS
    el.async = true
    el.onload = () => resolve()
    el.onerror = () => {
      loading = null
      el.remove()
      reject(new Error('Google didn\'t load. Check the connection and try again.'))
    }
    document.head.appendChild(el)
  })
  return loading
}

export interface GoogleButtonOptions {
  /** After the session is in place: where to go next is the screen's to decide. */
  onSignedIn: (session: AuthSession, created: boolean) => void
  onError?: (message: string) => void
  /** Google's own words on the button: "Continue with Google" by default. */
  text?: 'continue_with' | 'signin_with' | 'signup_with'
  width?: number
}

/** Draws Google's button into `el`. Resolves false when Google sign-in isn't available here. */
export async function mountGoogleButton(el: HTMLElement, options: GoogleButtonOptions): Promise<boolean> {
  if (!googleSignInAvailable()) return false
  try {
    await loadGis()
  } catch (error) {
    options.onError?.((error as Error).message)
    return false
  }
  const google = (window as unknown as { google: GoogleId }).google
  google.accounts.id.initialize({
    client_id: clientId(),
    ux_mode: 'popup',
    use_fedcm_for_button: true,
    callback: async ({ credential }: { credential: string }) => {
      try {
        const session = await useApi().post<AuthSession & { created?: boolean }>(
          '/auth/google',
          { credential, timezone: browserZone() },
        )
        useAuth().applySession(session)
        options.onSignedIn(session, Boolean(session.created))
      } catch {
        options.onError?.('Google sign-in didn\'t go through. Try again, or use your email.')
      }
    },
  })
  google.accounts.id.renderButton(el, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    shape: 'pill',
    text: options.text ?? 'continue_with',
    logo_alignment: 'center',
    width: options.width ?? Math.min(400, el.clientWidth || 320),
  })
  return true
}

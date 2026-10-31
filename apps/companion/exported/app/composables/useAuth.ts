import type { UserPreferences as ApiPreferences } from '~/types/api'
import { AUTH_COOKIE, AUTH_STATE_KEYS, authCookieOptions } from '~/composables/useApi'

/**
 * What follows the account rather than the device: the reader's settings,
 * and the companion's two switches. The server merges
 * `companion` key by key, so a PATCH carries only the one that changed.
 */
type UserPreferences = ApiPreferences & {
  companion?: {
    /** "Make me try first" in every course. Off unless set; it can only make the assistant stricter. */
    try_first?: boolean
    /** "Share my results with my class": anonymous counts only. On unless set to false. */
    share_results?: boolean
  }
}

/**
 * The signed-in learner, the organisation they are working inside, and the
 * subscription that decides how much gets written for them.
 *
 * The token lives in a cookie (`useApi` owns that cookie and attaches it to
 * every request); the *identity* lives in `useState` so it survives an SSR
 * round-trip and hydrates without a second fetch. `useAuth` is the one place
 * that writes any of it.
 *
 * These shapes are built to the freshly-cut backend contract. Fields the API
 * may reasonably omit are optional rather than `any`, so a slightly different
 * runtime payload degrades to a missing line, never a crash.
 */

export interface AuthUser {
  id: number
  name: string
  email: string
  /** BCP-47 code, e.g. `en`, `uz`. Drives the interface language. */
  locale?: string | null
  avatar_url?: string | null
  email_verified_at?: string | null
  /** False for a Telegram sign-up: deleting the account asks for the email instead. */
  has_password?: boolean
  /** READING and whatever else follows the account rather than the device. */
  preferences?: UserPreferences | null
  created_at?: string
}

/**
 * The four rungs the API stores (`memberships.role`). `instructor` is shown as
 * "Teacher"; there is no `member` — the web app used to send one, and every
 * default invite failed validation.
 */
export type OrgRole = 'owner' | 'admin' | 'instructor' | 'learner'

export const ORG_ROLES: readonly OrgRole[] = ['owner', 'admin', 'instructor', 'learner']

export interface Organization {
  id: number
  name: string
  slug?: string | null
  /** `individual` for the personal workspace of one; `learning_center` or `bootcamp` otherwise. */
  type?: 'individual' | 'learning_center' | 'bootcamp' | string
  is_owner?: boolean
  is_current?: boolean
  /** The signed-in learner's role in this organisation. */
  role?: OrgRole | string | null
  plan?: string | null
  created_at?: string
}

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'none'
  | string

export interface Subscription {
  status: SubscriptionStatus
  /** Plan identifier / name, e.g. `free`, `pro`. */
  plan?: string | null
  plan_label?: string | null
  interval?: 'month' | 'year' | null
  /** True once cancelled but still inside the paid period. */
  cancel_at_period_end?: boolean
  current_period_end?: string | null
  trial_ends_at?: string | null
  /** Whether writing lessons is unlocked for this learner right now. */
  is_active?: boolean

  /*
   * The month's meters, shipped with the session so the shell can tell whether
   * anything is running low without a second round trip. `useAllowance` is the
   * live source once a page needs to act on them — these go stale as soon as a
   * lesson is written.
   */
  node_expansions_per_month?: number | null
  node_expansions_used?: number
  /** Bought or carried-over lessons, spent only after the month's share. */
  node_expansions_topup?: number
  illustrations_per_month?: number | null
  illustrations_used?: number
  illustrations_topup?: number
}

export interface AuthSession {
  token: string
  token_type?: string
  user: AuthUser
  organization: Organization
  subscription: Subscription
}

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  password_confirmation: string
}

export interface ResetPasswordPayload {
  token: string
  email: string
  password: string
  password_confirmation: string
}

export interface ProfilePayload {
  name?: string
  email?: string
  locale?: string
  preferences?: UserPreferences
  password?: string
  password_confirmation?: string
}

/** Shape of `GET /auth/me` — a session without a token. */
type MeResponse = Omit<AuthSession, 'token' | 'token_type'>

/*
 * The last `/auth/me` answer, kept on the device so a reload with no network
 * still knows who is signed in. The companion works offline (its data is in
 * local SQLite), and without this a reload on the bus asked `/auth/me`, got
 * no answer, and bounced the learner to a login form they couldn't submit.
 * Only a 401 means the session is over; a missing network never does.
 */
const ME_CACHE = 'bm:me'

function cacheMe(me: MeResponse | null): void {
  if (!import.meta.client) return
  try {
    if (me) localStorage.setItem(ME_CACHE, JSON.stringify(me))
    else localStorage.removeItem(ME_CACHE)
  } catch {
    // Private mode: offline reloads simply can't be helped there.
  }
}

function cachedMe(): MeResponse | null {
  if (!import.meta.client) return null
  try {
    const raw = localStorage.getItem(ME_CACHE)
    return raw ? (JSON.parse(raw) as MeResponse) : null
  } catch {
    return null
  }
}

export function useAuth() {
  const api = useApi()
  const token = useCookie<string | null>(AUTH_COOKIE, authCookieOptions())

  const user = useState<AuthUser | null>(AUTH_STATE_KEYS.user, () => null)
  const organization = useState<Organization | null>(AUTH_STATE_KEYS.organization, () => null)
  const subscription = useState<Subscription | null>(AUTH_STATE_KEYS.subscription, () => null)
  /** True once we have tried to resolve the current session at least once. */
  const ready = useState<boolean>(AUTH_STATE_KEYS.ready, () => false)

  const isAuthenticated = computed(() => Boolean(token.value && user.value))

  const orgRole = computed<OrgRole | null>(() => {
    const role = organization.value?.role
    if (ORG_ROLES.includes(role as OrgRole)) return role as OrgRole
    // A session payload that predates `role` still says whether you own it.
    return organization.value?.is_owner ? 'owner' : null
  })
  const isOrgOwner = computed(() => orgRole.value === 'owner')

  /** Writing lessons is unlocked when the subscription actively covers it. */
  const canGenerate = computed(() => {
    const sub = subscription.value
    if (!sub) return false
    if (typeof sub.is_active === 'boolean') return sub.is_active
    return sub.status === 'active' || sub.status === 'trialing'
  })

  function applySession(session: AuthSession): void {
    token.value = session.token
    user.value = session.user
    organization.value = session.organization
    subscription.value = session.subscription
    ready.value = true
    cacheMe({ user: session.user, organization: session.organization, subscription: session.subscription })
  }

  function clear(): void {
    token.value = null
    user.value = null
    organization.value = null
    subscription.value = null
    cacheMe(null)
  }

  async function login(payload: LoginPayload): Promise<AuthSession> {
    const session = await api.post<AuthSession>('/auth/login', payload)
    applySession(session)
    return session
  }

  async function register(payload: RegisterPayload): Promise<AuthSession> {
    const session = await api.post<AuthSession>('/auth/register', payload)
    applySession(session)
    return session
  }

  /**
   * Ask for a reset link. The answer is the same sentence whether or not the
   * address has an account — the API will not say, and neither should the page.
   */
  async function forgotPassword(email: string): Promise<string> {
    const reply = await api.post<{ message: string }>('/auth/forgot-password', { email })
    return reply.message
  }

  /**
   * Set a new password from a mailed link, then sign straight in with it. The
   * reset revokes every token the account had (somebody resetting is often
   * locking somebody else out), so there is no session to keep — signing in is
   * how the learner avoids typing the password they just chose a second time.
   */
  async function resetPassword(payload: ResetPasswordPayload): Promise<AuthSession> {
    const reply = await api.post<{ email: string }>('/auth/reset-password', payload)
    return login({ email: reply.email, password: payload.password })
  }

  async function logout(): Promise<void> {
    try {
      if (token.value) await api.post('/auth/logout')
    } catch {
      // A failed logout still means "sign me out" locally.
    } finally {
      if (import.meta.client) {
        // The companion keeps the signed-in learner's semester on the device
        // (local SQLite in sync mode, tabs, an offline outbox); the next
        // person on this computer must not inherit any of it. Loaded only
        // here, so pages that never open the companion don't carry it.
        try {
          const { forgetCompanion } = await import('~/companion/store')
          await forgetCompanion()
        } catch {
          // Nothing local to forget, or it is already gone.
        }
      }
      clear()
      ready.value = true
      if (import.meta.client) {
        await navigateTo('/login')
        // What the last account loaded stays cached under its key until
        // something refetches it — on a shared computer the next person to sign
        // in would see the previous one's Today and library for a beat.
        clearNuxtData()
        // Reset, not cleared: the bell is still mounted while the route changes,
        // and `clearNuxtState` leaves it reading `undefined`.
        useState<unknown[]>('activity:notifications').value = []
        useState<boolean>('activity:loaded').value = false
      }
    }
  }

  /**
   * Resolve the current session from the token. Called once at first load by
   * the global guard; safe to call again — it no-ops when there is no token.
   */
  async function fetchMe(): Promise<AuthUser | null> {
    if (!token.value) {
      clear()
      ready.value = true
      return null
    }
    try {
      const me = await api.get<MeResponse>('/auth/me')
      user.value = me.user
      organization.value = me.organization
      subscription.value = me.subscription
      cacheMe(me)
    } catch (error) {
      const status = (error as { status?: number }).status
      // A 401 already cleared the cookie in useApi; drop the rest of the state.
      if (status === 401) clear()
      // No network (status 0): keep the token and stand on the last answer,
      // so an offline reload stays signed in. See ME_CACHE above.
      else if (status === 0) {
        const me = cachedMe()
        if (me) {
          user.value = me.user
          organization.value = me.organization
          subscription.value = me.subscription
        }
      }
    } finally {
      ready.value = true
    }
    return user.value
  }

  async function updateProfile(payload: ProfilePayload): Promise<AuthUser> {
    // The endpoint answers with the whole session shape (user + organization +
    // subscription), the same as /auth/me.
    const next = await api.patch<MeResponse | AuthUser>('/auth/profile', payload)
    const nextUser = 'user' in next && next.user ? (next.user as AuthUser) : (next as AuthUser)
    user.value = nextUser
    return nextUser
  }

  return {
    token,
    user,
    organization,
    subscription,
    ready,
    isAuthenticated,
    orgRole,
    isOrgOwner,
    canGenerate,
    applySession,
    clear,
    login,
    register,
    forgotPassword,
    resetPassword,
    logout,
    fetchMe,
    updateProfile,
  }
}

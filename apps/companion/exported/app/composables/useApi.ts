import type { AsyncData, AsyncDataOptions } from 'nuxt/app'
import type { ApiErrorBody, MaybeWrapped, Wrapped } from '~/types/api'

type QueryValue = string | number | boolean | null | undefined | Array<string | number>
export type ApiQuery = Record<string, QueryValue>

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiRequestOptions {
  query?: ApiQuery
  headers?: Record<string, string>
  /** Pass a FormData body to upload files; JSON headers are dropped for you. */
  body?: unknown
  signal?: AbortSignal
  timeout?: number
  /** Unwrap Laravel's `{ data: ... }` resource envelope. Default `true`. */
  unwrap?: boolean
}

/**
 * Normalised failure for every call in this app.
 *
 * `statusCode` / `data` are mirrored onto the instance so the shape survives
 * Nuxt's SSR payload transfer, where class prototypes are lost.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError'
  readonly status: number
  readonly statusCode: number
  readonly errors: Record<string, string[]>
  readonly data: unknown

  constructor(
    message: string,
    status: number,
    errors: Record<string, string[]> = {},
    data: unknown = null,
  ) {
    super(message)
    this.status = status
    this.statusCode = status
    this.errors = errors
    this.data = data
  }

  /** The network never answered (server down, CORS, offline). */
  get isNetwork(): boolean {
    return this.status === 0
  }

  get isValidation(): boolean {
    return this.status === 422 && Object.keys(this.errors).length > 0
  }

  get isNotFound(): boolean {
    return this.status === 404
  }

  /** First message for a field, e.g. `err.first('topic')`. */
  first(field: string): string | undefined {
    return this.errors[field]?.[0]
  }

  /** Flattened list of every validation message, for a summary banner. */
  get allMessages(): string[] {
    const flat = Object.values(this.errors).flat()
    return flat.length > 0 ? flat : [this.message]
  }
}

const NETWORK_MESSAGE = "Can't reach the BiliMind API. Is the backend running?"

/* -------------------------------------------------------------------------- */
/* Auth token plumbing                                                        */
/*                                                                            */
/* The bearer token lives in one cookie so it survives an SSR round-trip and  */
/* a full reload. `useAuth` owns the session *state*; this module owns the    */
/* wire — it attaches the token to every request and tears the session down   */
/* when the server says the token is no longer good.                          */
/* -------------------------------------------------------------------------- */

/**
 * Cookie the bearer token is stored under. Shared with `useAuth`.
 *
 * Cookies belong to a host, not a port, so two local checkouts on localhost
 * (the live product on :6789, the companion on :6799) would share this one and
 * each would throw away the other's token on its first 401. A dev server can
 * take its own name through VITE_AUTH_COOKIE; production never sets it.
 */
export const AUTH_COOKIE: string = import.meta.env.VITE_AUTH_COOKIE || 'bilimind_token'

/** `useState` keys `useAuth` fills. Kept here so a 401 can clear them without a cycle. */
export const AUTH_STATE_KEYS = {
  user: 'auth:user',
  organization: 'auth:organization',
  subscription: 'auth:subscription',
  ready: 'auth:ready',
} as const

/** One cookie config, used for every read and write so they line up. */
export function authCookieOptions() {
  return {
    // ~30 days. A learner who comes back next month should still be signed in.
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax' as const,
    // Allow the cookie over plain http on localhost; require https everywhere else.
    secure: !import.meta.dev,
    path: '/',
  }
}

/** Current bearer token, or `null`. Reads the cookie in both SSR and client. */
function authToken(): string | null {
  return useCookie<string | null>(AUTH_COOKIE, authCookieOptions()).value ?? null
}

/**
 * The token stopped being accepted. Drop the session and, on the client, send
 * the learner to sign in again — carrying where they were so they land back
 * there. Never fires for `/auth/*` itself: a bad login is a form error, not a
 * reason to bounce off the page the learner is already on.
 *
 * Only a session that EXISTED and then stopped working is a reason to leave
 * the page. A visitor with no token at all is reading a public page — a
 * published course, say — and some incidental call on it (the voice list
 * behind a Listen button) answering 401 is that call failing, not the visitor
 * being thrown out. It used to send every anonymous reader from `/explore`
 * straight to the sign-in form, on the page that promises "no account".
 * Which routes need an account is `auth.global.ts`'s decision, made on
 * navigation; it is not this handler's.
 */
function handleUnauthorized(path: string): void {
  if (/^\/auth(\/|$)/.test(path)) return

  const cookie = useCookie<string | null>(AUTH_COOKIE, authCookieOptions())
  if (!cookie.value) return

  cookie.value = null
  useState(AUTH_STATE_KEYS.user, () => null).value = null
  useState(AUTH_STATE_KEYS.organization, () => null).value = null
  useState(AUTH_STATE_KEYS.subscription, () => null).value = null

  if (!import.meta.client) return

  const current = useRouter().currentRoute.value
  if (current.path.startsWith('/login') || current.path.startsWith('/register')) return
  void navigateTo({ path: '/login', query: { next: current.fullPath } })
}

function messageForStatus(status: number): string {
  switch (status) {
    case 0:
      return NETWORK_MESSAGE
    case 401:
    case 403:
      return 'That action is not allowed.'
    case 404:
      return 'Not found.'
    case 409:
      return 'That conflicts with something that already exists.'
    case 419:
      return 'Your session expired. Reload the page and try again.'
    case 422:
      return 'Some of those details need fixing.'
    case 429:
      return 'Too many requests. Wait a moment and try again.'
    case 500:
    case 502:
    case 503:
    case 504:
      return 'The server hit an error. Try again in a moment.'
    default:
      return 'Something went wrong.'
  }
}

/** Turn anything `$fetch` can throw into an `ApiError`. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  const raw = error as {
    status?: number
    statusCode?: number
    response?: { status?: number }
    data?: unknown
    message?: string
    name?: string
  }

  const status = raw?.status ?? raw?.statusCode ?? raw?.response?.status ?? 0
  const body = (raw?.data ?? null) as ApiErrorBody | null

  const errors =
    body && typeof body === 'object' && body.errors && typeof body.errors === 'object'
      ? body.errors
      : {}

  const bodyMessage =
    body && typeof body === 'object' && typeof body.message === 'string' && body.message.length > 0
      ? body.message
      : null

  const message =
    bodyMessage ??
    (status === 0 ? NETWORK_MESSAGE : null) ??
    (raw?.name === 'AbortError' ? 'Request cancelled.' : null) ??
    messageForStatus(status)

  return new ApiError(message, status, errors, body)
}

/**
 * Peel Laravel's `{ data: ... }` resource envelope when present. Safe for bare
 * payloads: no BiliMind resource has a top-level `data` key of its own.
 */
export function unwrap<T>(payload: MaybeWrapped<T>): T {
  if (
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    'data' in (payload as Wrapped<T>)
  ) {
    return (payload as Wrapped<T>).data
  }
  return payload as T
}

function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/**
 * The base every request is joined onto.
 *
 * In the browser this is always `public.apiBase`. Deployed, that is the
 * relative `/api` — one origin for the page and the API, so no CORS and
 * nothing to re-point when the domain changes. SSR has no origin to be
 * relative to, so the renderer uses `apiInternalBase` instead when the deploy
 * sets it; unset (dev, mobile) `apiBase` is absolute and serves both.
 */
export function apiBaseUrl(): string {
  const config = useRuntimeConfig()
  if (import.meta.server) {
    const internal = (config.apiInternalBase as string | undefined) ?? ''
    if (internal) return internal
  }
  return config.public.apiBase as string
}

/* -------------------------------------------------------------------------- */
/* The companion demo                                                         */
/*                                                                            */
/* `/app?demo=1` runs with no account and no API, yet its courses open real   */
/* lessons. Those lessons have negative ids, which no database row ever has,  */
/* and while the demo is on, a request naming one (or a mark or a tutor turn  */
/* on one) is answered in memory by `companion/demo-lessons.ts` instead of    */
/* the network. That module is imported only then, so nothing else in the    */
/* product downloads it, and outside the demo nothing here changes a request. */
/* -------------------------------------------------------------------------- */

/** A path naming a demo id: `/nodes/-1018`, `/assessments/-101851/attempt`. */
const DEMO_ID = /\/-\d+(?:\/|\?|$)/

/** The two requests that carry their demo id in the body or answer by uuid. */
const DEMO_OTHER = /^\/?(?:annotations\/|speech\/dialogue$)/

async function demoReply(method: string, path: string, body: unknown): Promise<{ body: unknown } | null> {
  if (!import.meta.client || !(DEMO_ID.test(path) || DEMO_OTHER.test(path))) return null
  let demo = false
  try {
    demo = isCompanionDemo()
  } catch {
    demo = false
  }
  if (!demo) return null
  const { answerDemoLesson } = await import('~/companion/demo-lessons')
  return answerDemoLesson(method, path, body)
}

function buildHeaders(body: unknown, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  if (body !== undefined && body !== null && !isForm) {
    headers['Content-Type'] = 'application/json'
  }
  return { ...headers, ...extra }
}

/**
 * Typed `$fetch` wrapper around the BiliMind API.
 *
 *   const api = useApi()
 *   const courses = await api.get<CourseSummary[]>('/courses')
 *   await api.post('/courses', { topic })
 */
export function useApi() {
  const base = apiBaseUrl()

  async function request<T>(
    method: ApiMethod,
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const { query, headers, body, signal, timeout, unwrap: shouldUnwrap = true } = options

    const token = authToken()
    const withAuth = token ? { Authorization: `Bearer ${token}`, ...headers } : headers
    // The funnel's visitor id (utils/visitor.ts), so the server can join the
    // signup or course this call creates to the visit that led to it. Only an
    // id that already exists is sent; this never makes one.
    const visitor = import.meta.client ? readVisitorId() : null
    const withVisitor = visitor ? { 'X-Anonymous-Id': visitor, ...withAuth } : withAuth

    try {
      const demo = await demoReply(method, path, body)
      const result = demo
        ? (demo.body as MaybeWrapped<T>)
        : await $fetch<MaybeWrapped<T>>(joinUrl(base, path), {
            method,
            query: query as Record<string, unknown> | undefined,
            body: body as Record<string, unknown> | undefined,
            headers: buildHeaders(body, withVisitor),
            signal,
            timeout,
            retry: 0,
          })
      return shouldUnwrap ? unwrap<T>(result as MaybeWrapped<T>) : (result as T)
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.status === 401) handleUnauthorized(path)
      throw apiError
    }
  }

  return {
    /** Absolute API base, e.g. for EventSource URLs. */
    base,
    url: (path: string) => joinUrl(base, path),
    /**
     * Fire-and-forget POST that outlives the page (`keepalive`), for the last
     * word sent on unload. It must carry the bearer token like every other
     * call — a bare `fetch` here 401'd, silently, for every learner.
     */
    beacon(path: string, body: unknown): void {
      // A demo lesson's seconds have nowhere to go (see demoReply).
      if (!import.meta.client || DEMO_ID.test(path)) return
      const token = authToken()
      void fetch(joinUrl(base, path), {
        method: 'POST',
        headers: buildHeaders(body, token ? { Authorization: `Bearer ${token}` } : undefined),
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => undefined)
    },
    request,
    get: <T>(path: string, options?: ApiRequestOptions) => request<T>('GET', path, options),
    post: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
      request<T>('POST', path, { ...options, body }),
    put: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
      request<T>('PUT', path, { ...options, body }),
    patch: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
      request<T>('PATCH', path, { ...options, body }),
    del: <T>(path: string, options?: ApiRequestOptions) => request<T>('DELETE', path, options),
  }
}

export interface UseAsyncApiOptions<T> extends Omit<AsyncDataOptions<T>, 'transform'> {
  method?: ApiMethod
  query?: ApiQuery | (() => ApiQuery)
  body?: unknown
  headers?: Record<string, string>
  /** Unwrap Laravel's `{ data: ... }` envelope. Default `true`. */
  unwrap?: boolean
  transform?: (input: unknown) => T
}

/**
 * SSR-safe fetching. Same ergonomics as `useAsyncData`, but resolves the API
 * base, unwraps resource envelopes and normalises errors to `ApiError`.
 *
 *   const { data, pending, error, refresh } =
 *     await useAsyncApi<TodayResponse>('today', '/today')
 *
 * Note: after an SSR round-trip Nuxt serialises the error, so read
 * `error.value?.message` rather than relying on `instanceof ApiError`.
 */
export function useAsyncApi<T>(
  key: string,
  path: string | (() => string),
  options: UseAsyncApiOptions<T> = {},
): AsyncData<T | null, ApiError | null> {
  const {
    method = 'GET',
    query,
    body,
    headers,
    unwrap: shouldUnwrap = true,
    transform,
    ...asyncOptions
  } = options

  const base = apiBaseUrl()

  return useAsyncData<T, ApiError>(
    key,
    async () => {
      const resolvedPath = toValue(path)
      const token = authToken()
      const withAuth = token ? { Authorization: `Bearer ${token}`, ...headers } : headers

      try {
        const demo = await demoReply(method, resolvedPath, body)
        const result = demo
          ? (demo.body as MaybeWrapped<T>)
          : await $fetch<MaybeWrapped<T>>(joinUrl(base, resolvedPath), {
              method,
              query: (typeof query === 'function' ? query() : query) as
                | Record<string, unknown>
                | undefined,
              body: body as Record<string, unknown> | undefined,
              headers: buildHeaders(body, withAuth),
              retry: 0,
            })
        const value = shouldUnwrap ? unwrap<T>(result as MaybeWrapped<T>) : (result as T)
        return transform ? transform(value) : value
      } catch (error) {
        const apiError = toApiError(error)
        if (apiError.status === 401) handleUnauthorized(resolvedPath)
        throw apiError
      }
    },
    asyncOptions as AsyncDataOptions<T>,
  ) as AsyncData<T | null, ApiError | null>
}

import type { Course, SearchGroup, SearchHit, SearchResponse, SearchRetrieval } from '~/types/api'

/**
 * The command palette's brain.
 *
 * One search surface for the whole product, so this is a singleton: `useState`
 * for everything that renders, module-level handles for the timers and the
 * in-flight request. Five different components call it — the palette, the rail
 * button, the phone bar, the library's empty state, the hotkey — and they must
 * all be talking about the same open palette and the same query.
 *
 * The states are the point. A search box that only knows "results" and "no
 * results" feels broken for the entire second it spends between them, so the
 * ones that decide whether this feels good are modelled explicitly:
 *
 *   idle     nothing typed — offer what was searched before
 *   short    typed, but nothing the server could tokenise yet ("a")
 *   loading  a request is in flight; the last answer stays on screen, dimmed
 *   slow     it has been in flight long enough to owe the learner a word
 *   ready    hits
 *   empty    a real answer with nothing in it — different from `short`
 *   failed   the request did not come back; offer to try again
 *
 * Nothing here is driven by a watcher. Every state change comes from an
 * explicit call — `setQuery`, `setScope`, `openPalette`, `retry` — because the
 * composable is called from five components and a watcher registered in each of
 * them would fire the same request five times, or die when the component that
 * happened to own it navigated away.
 */

/**
 * Long enough that a fast typist sends one request per word rather than per
 * letter; short enough that a pause is answered before it registers as one.
 */
const DEBOUNCE_MS = 200

/** When a request stops being "instant" and starts owing an explanation. */
const SLOW_MS = 900

/** Answers kept for instant re-display. Backspacing is the commonest edit. */
const CACHE_LIMIT = 40

const RECENT_LIMIT = 6

/**
 * The server's own floor: `SearchQuery::MIN_TERM_LENGTH` is 2, and a quoted
 * phrase is kept whatever its length. Mirrored here only to decide whether a
 * request is worth spending — the server stays the authority, and the palette
 * believes its answer (an empty `groups` array) over this function.
 */
const QUOTED = /"[^"]+"/u

function isSearchable(raw: string): boolean {
  if (QUOTED.test(raw)) return true

  return raw.split(/\s+/u).some((token) => token.length >= 2)
}

export type SearchState = 'idle' | 'short' | 'loading' | 'slow' | 'ready' | 'empty' | 'failed'

export interface SearchScope {
  id: number
  title: string
}

interface SearchAnswer {
  groups: SearchGroup[]
  retrieval: SearchRetrieval
  /** The index threw and a plain scan answered — the only case worth saying so. */
  degraded: boolean
}

interface SearchRuntime extends SearchAnswer {
  /** The request key `groups` is the answer to, or null before the first one. */
  answered: string | null
  /** The request key currently in flight. */
  loading: string | null
  slow: boolean
  /** The request key that failed, so an old failure cannot colour a new query. */
  failedKey: string | null
  failure: string | null
}

function emptyRuntime(): SearchRuntime {
  return {
    groups: [],
    retrieval: 'none',
    degraded: false,
    answered: null,
    loading: null,
    slow: false,
    failedKey: null,
    failure: null,
  }
}

/* -------------------------------------------------------------------------- */
/* Client-only machinery                                                       */
/*                                                                             */
/* Module scope, because there is one palette. Every writer below is reached    */
/* only from a browser event, so none of this is ever touched during SSR.       */
/* -------------------------------------------------------------------------- */

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let slowTimer: ReturnType<typeof setTimeout> | null = null
let inFlight: AbortController | null = null

/**
 * Monotonic request id.
 *
 * Aborting is not enough on its own. `AbortController` cancels the transport,
 * but a response that was already on the wire when the next keystroke landed
 * can still resolve — and then the answer to "gra" overwrites the answer to
 * "gradient" and the palette shows results for a query nobody can see. Every
 * outcome is checked against this before it is allowed to become state.
 */
let sequence = 0

const cache = new Map<string, SearchAnswer>()

function remember(key: string, answer: SearchAnswer): void {
  cache.set(key, answer)

  // Insertion-ordered, so the first key is the coldest.
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
}

export function useSearch() {
  const api = useApi()
  const route = useRoute()
  const nuxtApp = useNuxtApp()

  const open = useState<boolean>('search:open', () => false)
  const query = useState<string>('search:query', () => '')
  const activeIndex = useState<number>('search:active', () => 0)
  const recent = useState<string[]>('search:recent', () => [])
  const runtime = useState<SearchRuntime>('search:runtime', emptyRuntime)

  /*
   * Two scopes, and keeping them apart is the fix for a trap.
   *
   * `scope` is what the PAGE offers — the course on screen, published by
   * `pages/[user]/[course].vue`. `within` is what the open palette is actually
   * narrowed to, and only the person at the palette changes it. They used to be
   * one value, and the course page publishes its scope from a `watchEffect`: the
   * × on the chip set it to null, the effect saw its own dependency change and
   * put the course straight back, so the chip could not be removed and a search
   * from inside a course could never be widened to everything. Now the chip
   * writes `within`, which the page never touches.
   */
  const scope = useState<SearchScope | null>('search:scope', () => null)
  const within = useState<SearchScope | null>('search:within', () => null)

  const trimmed = computed(() => query.value.trim())
  const requestKey = computed(() => `${within.value?.id ?? ''}|${trimmed.value}`)

  /* -- Reading the state ---------------------------------------------------- */

  const state = computed<SearchState>(() => {
    if (trimmed.value === '') return 'idle'
    if (!isSearchable(trimmed.value)) return 'short'
    if (runtime.value.failedKey === requestKey.value) return 'failed'

    if (runtime.value.answered === requestKey.value) {
      if (runtime.value.groups.length === 0) return 'short'

      return runtime.value.groups.some((group) => group.results.length > 0) ? 'ready' : 'empty'
    }

    return runtime.value.slow ? 'slow' : 'loading'
  })

  /** The visible answer belongs to an older query — dim it, do not hide it. */
  const stale = computed(
    () => runtime.value.answered !== null && runtime.value.answered !== requestKey.value,
  )

  /**
   * What the list renders.
   *
   * While a new query is in flight the previous answer stays up rather than
   * collapsing to a spinner: a palette that empties itself on every keystroke
   * moves the row under the cursor at exactly the moment somebody is aiming at
   * it. An `empty`, `failed` or `short` state shows nothing, because in all
   * three the rows would be answering a question that is no longer on screen.
   */
  const groups = computed<SearchGroup[]>(() => {
    const showing = state.value === 'ready' || state.value === 'loading' || state.value === 'slow'

    return showing ? runtime.value.groups : []
  })

  const flat = computed<SearchHit[]>(() => groups.value.flatMap((group) => group.results))

  const retrieval = computed<SearchRetrieval>(() => runtime.value.retrieval)
  const degraded = computed<boolean>(() => runtime.value.degraded)
  const failure = computed<string | null>(() => runtime.value.failure)

  /* -- Running a search ----------------------------------------------------- */

  function clearTimers(): void {
    if (debounceTimer !== null) clearTimeout(debounceTimer)
    if (slowTimer !== null) clearTimeout(slowTimer)
    debounceTimer = null
    slowTimer = null
  }

  function abortInFlight(): void {
    inFlight?.abort()
    inFlight = null
    // Bumping the sequence here as well as in `run` means a cancelled request
    // can never land, even if it resolves before the abort takes effect.
    sequence += 1
  }

  function apply(key: string, answer: SearchAnswer): void {
    runtime.value = {
      ...answer,
      answered: key,
      loading: null,
      slow: false,
      failedKey: null,
      failure: null,
    }
    activeIndex.value = 0
  }

  async function run(key: string, term: string, courseId: number | null): Promise<void> {
    const id = (sequence += 1)
    const controller = new AbortController()
    inFlight = controller

    runtime.value = { ...runtime.value, loading: key, failedKey: null, failure: null }

    slowTimer = setTimeout(() => {
      if (sequence === id) runtime.value = { ...runtime.value, slow: true }
    }, SLOW_MS)

    try {
      const response = await api.get<SearchResponse>('/search', {
        query: { q: term, course_id: courseId ?? undefined },
        signal: controller.signal,
      })

      if (sequence !== id) return

      const answer: SearchAnswer = {
        groups: response.groups ?? [],
        retrieval: response.retrieval ?? 'none',
        degraded: response.degraded === true,
      }

      remember(key, answer)
      apply(key, answer)
    } catch (error) {
      // A superseded or aborted request is not a failure the learner should
      // see. An abort surfaces here as a network error — status 0, because the
      // transport genuinely never answered — so the sequence check, not the
      // error's shape, is what tells the two apart.
      if (sequence !== id || controller.signal.aborted) return

      runtime.value = {
        ...runtime.value,
        loading: null,
        slow: false,
        failedKey: key,
        failure: error instanceof Error ? error.message : 'Search could not run.',
      }
    } finally {
      if (sequence === id) {
        if (slowTimer !== null) clearTimeout(slowTimer)
        slowTimer = null
        inFlight = null
      }
    }
  }

  /**
   * Decide what the current query deserves: nothing, a cached answer, or a
   * debounced request. Called on every edit, and after a scope change.
   */
  function schedule(): void {
    if (!import.meta.client) return

    clearTimers()
    abortInFlight()
    runtime.value = { ...runtime.value, loading: null, slow: false }

    const term = trimmed.value

    if (term === '' || !isSearchable(term)) return

    const key = requestKey.value
    const cached = cache.get(key)

    if (cached) {
      apply(key, cached)
      return
    }

    const courseId = within.value?.id ?? null

    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void run(key, term, courseId)
    }, DEBOUNCE_MS)
  }

  function setQuery(value: string): void {
    if (value === query.value) return

    query.value = value
    activeIndex.value = 0
    schedule()
  }

  function retry(): void {
    if (!import.meta.client) return

    // Drop the failure first, so the retry button cannot re-render as failed
    // while its own request is in flight.
    runtime.value = { ...runtime.value, failedKey: null, failure: null }
    cache.delete(requestKey.value)
    schedule()
  }

  /* -- Scope ---------------------------------------------------------------- */

  /**
   * The course the palette narrows to when it is opened inside one.
   *
   * The FALLBACK, not the source: `pages/[user]/[course].vue` publishes its own
   * scope through `setScope`, and that is what `openPalette` prefers. This reads
   * the page's `useAsyncData` cache instead, for the case where nothing was
   * published — a cold cache, a page that has not mounted yet. It degrades the
   * right way: a key that does not resolve, or a shared course somebody else
   * owns, simply means the search is global, which is never wrong, only wider.
   */
  function resolveRouteScope(): SearchScope | null {
    if (route.name !== 'user-course') return null

    const key = `course-${String(route.params.user ?? '')}-${String(route.params.course ?? '')}`
    const cached = (nuxtApp.payload.data as Record<string, unknown> | undefined)?.[key] as
      | Partial<Course>
      | undefined

    // A read-only view of somebody else's course: scoping to it would 404,
    // because `?course_id=` answers "not yours" the way every course read does.
    if (!cached || cached.is_shared === true) return null

    const id = Number(cached.id)
    const title = typeof cached.title === 'string' ? cached.title : ''

    return Number.isFinite(id) && id > 0 && title !== '' ? { id, title } : null
  }

  /**
   * The page says which course is on screen. It does not narrow a palette that is
   * already open — the person there may have just widened it, and a page that
   * re-renders must not undo that — it only decides where the next one opens.
   *
   * Called from a `watchEffect`, so it reads nothing it does not need to: every
   * ref read here becomes a dependency of the caller's effect.
   */
  function setScope(next: SearchScope | null): void {
    if (next?.id === scope.value?.id && next?.title === scope.value?.title) return

    scope.value = next
  }

  /** Drop the course chip and search everything. */
  function widen(): void {
    if (within.value === null) return

    within.value = null
    schedule()
  }

  /** Put the course chip back — the course on screen, if there is one. */
  function narrow(): void {
    const target = scope.value ?? resolveRouteScope()
    if (!target || target.id === within.value?.id) return

    within.value = target
    schedule()
  }

  /**
   * The course the palette could narrow to but is not narrowed to — what the
   * "only this course" chip offers once the reader has widened the search.
   */
  const offered = computed<SearchScope | null>(() =>
    within.value === null ? (scope.value ?? null) : null,
  )

  /* -- Opening, closing, choosing ------------------------------------------- */

  /**
   * @param options.scope  A course to narrow to. Omit to take it from the page;
   *                       pass `null` for an explicitly global search.
   * @param options.seed   Text to open with, already typed.
   */
  function openPalette(options: { scope?: SearchScope | null; seed?: string } = {}): void {
    // A scope the course page published outranks the one inferred from its cache
    // key: re-deriving here would throw away the explicit answer and replace it
    // with a guess at the same question. Every opening starts from the page again:
    // widening is a choice about one search, not a setting.
    within.value =
      options.scope === undefined ? (scope.value ?? resolveRouteScope()) : options.scope
    query.value = options.seed ?? ''
    activeIndex.value = 0
    open.value = true
    schedule()
  }

  function close(): void {
    open.value = false
    clearTimers()
    abortInFlight()

    // The query goes, the cache stays: reopening starts clean, and retyping
    // something searched a minute ago is answered without a request.
    query.value = ''
    activeIndex.value = 0
    runtime.value = emptyRuntime()
  }

  function move(delta: number): void {
    const count = flat.value.length
    if (count === 0) return

    activeIndex.value = (activeIndex.value + delta + count) % count
  }

  /** Where a hit lives. One helper, so the palette never composes a path. */
  function hitUrl(hit: SearchHit): string | null {
    switch (hit.kind) {
      case 'course':
        return hit.course ? courseUrl(hit.course) : null
      case 'node':
        return hit.course && hit.node ? `${hit.course.path}?open=lesson:${hit.node.id}` : null
      case 'block':
        return hit.course && hit.node && hit.block
          ? `${hit.course.path}?open=lesson:${hit.node.id}#block-${hit.block.id}`
          : null
      case 'material':
        return hit.material ? `/app/notes/${hit.material.id}` : null
    }
  }

  function rememberQuery(term: string): void {
    if (term === '') return

    recent.value = [term, ...recent.value.filter((item) => item !== term)].slice(0, RECENT_LIMIT)
  }

  /**
   * Open a hit. `newTab` is the ⌘/Ctrl-Enter (or middle-click) path.
   *
   * The block anchor is requested imperatively as well as through the hash,
   * because choosing the hit you are already looking at changes no route and
   * would otherwise do nothing at all.
   */
  function choose(hit?: SearchHit, newTab = false): void {
    const target = hit ?? flat.value[activeIndex.value]
    if (!target) return

    const url = hitUrl(target)
    if (!url) return

    rememberQuery(trimmed.value)
    close()

    if (newTab) {
      window.open(url, '_blank', 'noopener')
      return
    }

    void navigateTo(url)

    if (target.block) anchorBlock(target.block.id)
  }

  return {
    open,
    query,
    scope,
    within,
    offered,
    activeIndex,
    recent,
    groups,
    flat,
    state,
    stale,
    retrieval,
    degraded,
    failure,
    setQuery,
    setScope,
    widen,
    narrow,
    retry,
    openPalette,
    close,
    move,
    choose,
  }
}

/**
 * ⌘K / Ctrl-K anywhere, and `/` when nothing else has the keyboard. Installed
 * once, by `app.vue`.
 *
 * Signed out it does nothing: every marketing page mounts `app.vue` too, and a
 * palette that fired an authenticated request from the landing page would bounce
 * a visitor to the sign-in screen for pressing a key.
 */
export function useSearchHotkey(): void {
  const { open, openPalette, close } = useSearch()
  const { isAuthenticated } = useAuth()
  // Under `/app` the companion's layout owns ⌘K and `/` (its own palette
  // searches what the companion keeps); this one would open on top of it.
  const route = useRoute()
  const inCompanion = () => route.path === '/app' || route.path.startsWith('/app/')

  function typingSomewhereElse(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null
    if (!el) return false

    return (
      el.isContentEditable ||
      el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT'
    )
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!isAuthenticated.value || event.isComposing || inCompanion()) return

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      // Chrome and Firefox both bind Ctrl-K to the address bar's search field.
      event.preventDefault()
      if (open.value) close()
      else openPalette()
      return
    }

    // The bare-slash shortcut only exists where a slash would otherwise be a
    // wasted keystroke — never inside a lesson's answer box or the assistant.
    if (
      event.key === '/' &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !open.value &&
      !typingSomewhereElse(event.target)
    ) {
      event.preventDefault()
      openPalette()
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}

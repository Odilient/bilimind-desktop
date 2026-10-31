import { PUBLIC_PAGES } from '#shared/pages'

/**
 * The one gate in front of the whole app.
 *
 * A global guard rather than `definePageMeta({ middleware: 'auth' })` scattered
 * across every page, because the app pages are owned by other parts of the
 * codebase and a guard that lives in one file cannot drift out of sync. The
 * rule is inverted: everything is protected *unless* it is on the public
 * allowlist below. A page added tomorrow is guarded the moment it exists.
 *
 * It also hydrates the session on the very first load — one `GET /auth/me`,
 * gated by `ready` so it never fires twice — so a reload lands on a signed-in
 * page without a flash of the login screen.
 */

/**
 * Pages a signed-out visitor may read. Everything else needs an account.
 *
 * The marketing and content pages come from `shared/pages.ts`, which is also
 * what the sitemap and the footer are built from. That is not tidiness: this
 * list used to be typed out by hand, and a public page added without a line
 * here bounces every visitor — and every crawler — straight to `/login`. A page
 * that is in the sitemap, linked from the footer, and 302s to a sign-in form is
 * the worst of the three states, and it is the one a hand-maintained set
 * produces by default.
 */
const PUBLIC_ROUTES = new Set<string>([
  ...PUBLIC_PAGES.map((page) => page.path),
  '/login',
  '/register',
  // Somebody who forgot their password is signed out by definition. The reset
  // page is reached from an email link, often on a different device.
  '/forgot-password',
  '/reset-password',
  // The door that keeps the hero's sentence in hand while somebody signs up.
  '/start',
  // The code sandbox runs entirely in the browser (no server cost, no account
  // needed) — a free "try it" surface, so it is public like the marketing pages.
  '/sandbox',
  // Where a checkout comes back through (Dodo's return URL, Paddle's default
  // payment link). It holds nothing but ids the provider put in the URL, and a
  // provider's domain review has to be able to load it while signed out — a 302
  // to /login there fails the review.
  '/checkout',
])

/** Where a signed-in learner is sent away from the marketing/auth pages. */
const HOME = '/app'

function normalize(path: string): string {
  const trimmed = path.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

/**
 * Course pages (`/{username}/{course-slug}`) are the one route this guard lets
 * through on the name rather than the path — the path is two arbitrary
 * segments, so there is nothing here to match on.
 *
 * Letting it through is not the same as making it readable: the API answers
 * with the course only when it is public or the reader owns it, and 404s
 * otherwise. Bouncing to `/login` first would be worse than useless — it would
 * turn every shared link into a sign-up wall for the exact reader it was sent
 * to, and confirm that a private course exists to anyone who guesses its URL.
 */
const COURSE_ROUTE = 'user-course'

function isPublic(path: string, name?: string): boolean {
  if (name === COURSE_ROUTE) return true

  /* `/dev/*` are layout harnesses for surfaces whose correctness is visual —
     they render fixtures and call no API, so there is nothing behind them to
     guard. `import.meta.dev` is inlined at build time, so in a production
     bundle this collapses to `false` and the pages themselves 404 anyway. */
  if (import.meta.dev && path.startsWith('/dev/')) return true

  const clean = normalize(path)
  // Shared read-only courses are public by design — the whole point of a link.
  if (clean === '/shared' || clean.startsWith('/shared/')) return true
  /* An invitation is opened from an inbox by somebody who usually has no
     account yet; the page itself says who invited them before it asks them to
     register. Bouncing it to `/login` would lose the token on the way. */
  if (clean.startsWith('/invite/')) return true
  /* `/learn/*` is a generated set — one roadmap per subject, listed by
     `shared/learn.ts` rather than by `shared/pages.ts`, because it grows by
     running a script rather than by writing a page. Matched on the prefix for
     the same reason the course route is matched on its name: an allowlist that
     has to be regenerated in two places is one that will be regenerated in
     one. An unknown slug still 404s — `pages/learn/[topic].vue` throws before
     it renders — which is the difference between "public" and "exists". */
  if (clean === '/learn' || clean.startsWith('/learn/')) return true
  /* A drawn roadmap is a link somebody was sent, and the generator's whole
     point is that it needs no account — so `/roadmap-generator/{slug}` is
     public on the prefix, like `/learn/*`. The tool page itself is in
     `shared/pages.ts`. An unknown slug 404s in the page. */
  if (clean.startsWith('/roadmap-generator/')) return true
  /* `/vs/*` is half hand-written (`chatgpt`, `coursera`) and half generated
     from `app/content/compare/`. Nuxt matches the static files first, so the
     prefix covers both without the allowlist having to know which is which. */
  if (clean.startsWith('/vs/')) return true
  return PUBLIC_ROUTES.has(clean)
}

export default defineNuxtRouteMiddleware(async (to) => {
  const { token, user, ready, isAuthenticated, fetchMe } = useAuth()

  // First paint: turn a bare token into a resolved session, once.
  if (token.value && !user.value && !ready.value) {
    await fetchMe()
  }

  const clean = normalize(to.path)

  // Signed-in learners have no business on the sign-in screens.
  if (
    isAuthenticated.value &&
    (clean === '/' || clean === '/login' || clean === '/register' || clean === '/start')
  ) {
    const next = typeof to.query.next === 'string' ? to.query.next : HOME
    /* A signed-in reader pressing "Build this course" on `/learn/rust` asks
       for `/start?topic=…`, and `/start` is a page they have no use for. They
       still said what they wanted, though, so the sentence travels with the
       bounce instead of being thrown away at the door: `/app?topic=` opens
       the chat with it in the box (companion-home.global.ts). */
    const topic = typeof to.query.topic === 'string' ? to.query.topic : null
    return navigateTo(topic ? { path: next, query: { topic } } : next)
  }

  /* The companion's demo mode (`?demo=1`, remembered for the tab, or
     NUXT_PUBLIC_COMPANION_DEMO=1) runs on a seeded in-memory semester with no
     account behind it, so its pages have nothing to guard. */
  if ((clean === '/app' || clean.startsWith('/app/')) && isCompanionDemo(to.query.demo)) {
    return
  }

  // Signed-out learners hitting an app route get sent to sign in, and back.
  if (!isAuthenticated.value && !isPublic(to.path, String(to.name ?? ''))) {
    return navigateTo({ path: '/login', query: { next: to.fullPath } })
  }
})

/**
 * Whether the navigation rail shows its labels.
 *
 * Stored in a cookie rather than in `localStorage`, which matters more than it
 * sounds: the rail is rendered on the server, and the server can read a cookie.
 * A client-only store means SSR always guesses "collapsed", and the guess is
 * wrong for anyone who chose otherwise — which shows up not as a tidy flicker
 * but as a hydration mismatch, where the labels appear at the collapsed width
 * and spill out of a 62px column.
 *
 * So: one cookie, read on both sides, and the first paint is already right.
 * Collapsed remains the default — see the note in `ShellRail` for why.
 */

const COOKIE = 'bilimind_rail'

export function useRail() {
  const cookie = useCookie<'1' | '0'>(COOKIE, {
    // A year. This is a preference about the shape of the frame; it should
    // outlive the session that set it.
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  })

  // Mirrored into shared state so every consumer re-renders together — a cookie
  // ref alone is per-call and would leave two rails disagreeing.
  const expanded = useState<boolean>('shell:rail-expanded', () => cookie.value === '1')

  function set(value: boolean): void {
    expanded.value = value
    cookie.value = value ? '1' : '0'
  }

  function toggle(): void {
    set(!expanded.value)
  }

  return { expanded, set, toggle }
}

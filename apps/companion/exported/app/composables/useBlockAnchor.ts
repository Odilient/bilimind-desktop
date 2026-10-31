/**
 * Landing on one block of one lesson, after a search hit.
 *
 * Three things make this harder than `scrollIntoView`:
 *
 *  1. The element does not exist when the navigation finishes. Choosing a
 *     content hit changes the route, the course page opens the lesson's tab,
 *     and only then does `NodeView` fetch its blocks. A one-shot scroll in
 *     `onMounted` fires against nothing, silently. So this waits for the
 *     element, and gives up quietly rather than retrying forever.
 *  2. Every open lesson stays mounted. The workspace hides an inactive tab with
 *     `visibility` (so its scroll offset survives), which means
 *     `getElementById` cheerfully returns a block belonging to a lesson nobody
 *     is looking at. The pane carries `inert` when it is not the active one,
 *     and that is the honest test for "is this on screen".
 *  3. A silent scroll leaves the learner in the middle of a lesson with no idea
 *     which paragraph they were sent to. So the block flashes.
 *
 * The anchor id is `block-{id}` and it sits on `BlockRenderer`'s root, the same
 * element carrying `.lesson-section`'s scroll margin. That pairing is what
 * makes a hit land clear of the lesson's pinned strip instead of underneath it,
 * and it is why this scrolls to that element rather than to anything inside it.
 */

/** How long to keep waiting for the lesson to arrive before giving up. */
const DEADLINE_MS = 6000

/** Gap between looks. Long enough not to churn, short enough to feel instant. */
const POLL_MS = 100

/** How long the ring stays up once the block is in view. */
const FLASH_MS = 1400

const HASH_PATTERN = /^#block-(\d+)$/

/**
 * The one pending wait. Module scope on purpose: a second request supersedes
 * the first, and two loops racing to scroll to two different blocks is exactly
 * the bug a per-caller timer would produce. Client-only — every writer is
 * inside a browser-guarded path.
 */
let pending: ReturnType<typeof setInterval> | null = null

function stopWaiting(): void {
  if (pending !== null) {
    clearInterval(pending)
    pending = null
  }
}

/**
 * A ring drawn with an inline box-shadow rather than a class.
 *
 * The design tokens are shared, but `main.css` belongs to the lesson-reading
 * pass; adding a keyframe there for one flash would be reaching into another
 * file for something one element needs for a second and a half. The colours are
 * still tokens — nothing here names a hex.
 */
function flash(el: HTMLElement): void {
  el.style.setProperty('border-radius', '14px')
  el.style.setProperty('transition', 'box-shadow 200ms ease')
  el.style.setProperty('box-shadow', '0 0 0 8px var(--accent-soft), 0 0 0 9px var(--accent-line)')

  window.setTimeout(() => {
    el.style.setProperty('box-shadow', '0 0 0 0 transparent')

    window.setTimeout(() => {
      el.style.removeProperty('box-shadow')
      el.style.removeProperty('transition')
      el.style.removeProperty('border-radius')
    }, 260)
  }, FLASH_MS)
}

/**
 * Scroll to a block as soon as it is both rendered and on screen.
 *
 * Safe to call when the block is already in front of the learner — that is the
 * common case of choosing the same hit twice, where the route does not change
 * and nothing else would fire.
 */
export function anchorBlock(blockId: number): void {
  if (!import.meta.client) return

  stopWaiting()

  const startedAt = Date.now()

  const attempt = (): boolean => {
    const el = document.getElementById(`block-${blockId}`)

    // `inert` is the workspace's mark for a tab that is mounted but hidden.
    // Scrolling inside one moves a pane nobody can see.
    if (!el || el.closest('[inert]')) return false

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    el.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })
    flash(el)

    return true
  }

  if (attempt()) return

  pending = setInterval(() => {
    if (attempt() || Date.now() - startedAt > DEADLINE_MS) stopWaiting()
  }, POLL_MS)
}

/**
 * Honour `#block-{id}` in the address bar. Installed once, by `app.vue`.
 *
 * The palette calls `anchorBlock()` directly the moment it navigates, so this
 * is not the main path — it is what makes a pasted or reloaded deep link work,
 * and what covers the case where the workspace rewrites `?node=` and the hash
 * survives into a fresh route.
 */
export function useBlockAnchor(): void {
  const route = useRoute()

  watch(
    () => route.hash,
    (hash) => {
      const id = Number(HASH_PATTERN.exec(hash)?.[1])

      if (Number.isFinite(id) && id > 0) anchorBlock(id)
    },
    { immediate: true },
  )

  onBeforeUnmount(stopWaiting)
}

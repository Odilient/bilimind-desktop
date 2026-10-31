import { INK_COLORS, normaliseHex } from '~/utils/markup'

/** Saved inks the account keeps (UpdateProfileRequest caps it at 12). */
const MAX_SAVED = 12
/** Recent inks the device remembers. Enough to find yesterday's colour, few enough to scan. */
const MAX_RECENT = 6
const RECENT_KEY = 'bilimind:recent-inks'

let recentLoaded = false

/**
 * MARKUP — the inks a reader can pick from: the four the product ships, the
 * ones they saved, and the ones they used lately.
 *
 * Saved inks are an account setting (`users.preferences.inks`), because a
 * colour someone took the trouble to keep is one they expect on the tablet as
 * well as the laptop. They are written optimistically and put back if the save
 * fails. Recent inks are only this device's memory of the picker — the colours
 * mixed but not kept — so they live in localStorage and cost no request.
 *
 * The four shipped inks are never "recent" or "saved": they are always on the
 * tray, and listing them twice would push the reader's own colours off it.
 */
export function useInkPalette() {
  const { user, isAuthenticated, updateProfile } = useAuth()
  const toast = useToast()

  /* Set while a save is in flight so the tray shows the new list at once. */
  const pending = useState<string[] | null>('markup:saved-inks', () => null)
  const recent = useState<string[]>('markup:recent-inks', () => [])

  const saved = computed<string[]>(() => pending.value ?? user.value?.preferences?.inks ?? [])

  if (import.meta.client && !recentLoaded) {
    recentLoaded = true
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
      if (Array.isArray(stored)) {
        recent.value = stored
          .map((item) => (typeof item === 'string' ? normaliseHex(item) : null))
          .filter((item): item is string => item !== null)
          .slice(0, MAX_RECENT)
      }
    } catch {
      /* storage may be unavailable, or hold something that is not a list */
    }
  }

  function isShipped(color: string): boolean {
    return INK_COLORS.some((ink) => ink.value === color)
  }

  function isSaved(color: string): boolean {
    return saved.value.includes(color)
  }

  /** What the tray and the highlight menu offer: the four, then the reader's own. */
  const inks = computed(() => [
    ...INK_COLORS.map((ink) => ({ name: ink.name, value: ink.value as string })),
    ...saved.value.map((value) => ({ name: value, value })),
  ])

  function rememberRecent(list: string[]): void {
    recent.value = list
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list))
    } catch {
      /* storage may be unavailable */
    }
  }

  /** A colour was picked from the mixer: it goes to the front of Recent. */
  function used(color: string): void {
    const hex = normaliseHex(color)
    if (!hex || isShipped(hex) || isSaved(hex)) return
    rememberRecent([hex, ...recent.value.filter((item) => item !== hex)].slice(0, MAX_RECENT))
  }

  async function persist(next: string[]): Promise<void> {
    const before = saved.value
    pending.value = next

    if (!isAuthenticated.value) return

    try {
      await updateProfile({ preferences: { inks: next } })
    } catch (error) {
      pending.value = before
      toast.error(error instanceof Error ? error.message : 'Your colours could not be saved just now.')
      return
    }

    // The account now says the same thing; let it speak.
    if (pending.value === next) pending.value = null
  }

  function save(color: string): void {
    const hex = normaliseHex(color)
    if (!hex || isShipped(hex) || isSaved(hex)) return

    if (saved.value.length >= MAX_SAVED) {
      toast.warn({
        title: 'Your palette is full',
        body: `It keeps ${MAX_SAVED} colours. Remove one to make room.`,
      })
      return
    }

    rememberRecent(recent.value.filter((item) => item !== hex))
    void persist([...saved.value, hex])
  }

  function forget(color: string): void {
    if (!isSaved(color)) return
    void persist(saved.value.filter((item) => item !== color))
  }

  return { inks, saved, recent, isShipped, isSaved, used, save, forget }
}

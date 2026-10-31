import type { AllowanceResponse, MeterAllowance, TopupPack } from '~/types/api'

/**
 * What is left to spend this month, by meter.
 *
 * `GET /allowance` returns the very numbers EnforceGenerationCap and
 * IllustrationBudget refuse from, which is the whole point of fetching them: a
 * ceiling you only meet as a 402 halfway through picking six lessons is
 * indistinguishable from a broken app.
 *
 * TWO METERS, NEVER MERGED. There is no credit balance here and no conversion
 * between lessons and illustrations — the server does not offer one and the UI
 * must not invent one. A single "142 credits" figure would have to be explained
 * before it could be used, and hides the fact that some of it was paid for.
 *
 * The state is shared (`useState`) because the account page and the expand
 * dialog can both be alive at once, and two counters disagreeing about the same
 * month is worse than one counter nobody can see.
 */

/** Prices arrive in the smallest unit, tax-exclusive. */
export function topupPrice(pack: TopupPack): string {
  const amount = pack.price / 100
  const whole = Number.isInteger(amount)
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: (pack.currency || 'usd').toUpperCase(),
    minimumFractionDigits: whole ? 0 : 2,
  }).format(amount)
}

/**
 * When to put the number in front of somebody.
 *
 * Never above this. A counter pinned to the screen all month is how a product
 * about learning starts feeling like a taxi meter — the documented failure of
 * every credit UI, where people ration themselves rather than ask the question
 * they came to ask. Below a fifth left, the number stops being pressure and
 * starts being information: it is genuinely about to change what you can do.
 */
const LOW_AT_PERCENT = 80

export function useAllowance() {
  const api = useApi()

  const data = useState<AllowanceResponse | null>('allowance', () => null)
  const loading = useState<boolean>('allowance:loading', () => false)

  /**
   * An allowance we could not read must never block anything. The server is the
   * authority and refuses for itself; this is only ever an early warning, so its
   * absence has to fail open.
   */
  async function load(): Promise<void> {
    if (loading.value) return
    loading.value = true
    try {
      // `api.get` peels the `{ data }` envelope itself. Reading `.data` again
      // here left this state undefined for every learner: no meter on the
      // account page, and no "that's more than you have left" in the dialog.
      data.value = await api.get<AllowanceResponse>('/allowance')
    } catch {
      data.value = null
    } finally {
      loading.value = false
    }
  }

  /** Load once per session unless something has changed the numbers. */
  async function ensure(): Promise<void> {
    if (data.value === null) await load()
  }

  const lessons = computed<MeterAllowance | null>(() => data.value?.lessons ?? null)
  const illustrations = computed<MeterAllowance | null>(() => data.value?.illustrations ?? null)
  const packs = computed<TopupPack[]>(() => data.value?.packs ?? [])

  function packsFor(meter: string): TopupPack[] {
    return packs.value.filter((pack) => pack.meter === meter)
  }

  /** Nothing to say about a meter nobody is counting. */
  function metered(allowance: MeterAllowance | null): boolean {
    return Boolean(allowance?.metered)
  }

  function low(allowance: MeterAllowance | null): boolean {
    if (!metered(allowance) || !allowance) return false
    if (allowance.topup_remaining > 0) return allowance.remaining !== null && allowance.remaining <= 5
    return allowance.percent_used >= LOW_AT_PERCENT
  }

  function empty(allowance: MeterAllowance | null): boolean {
    return metered(allowance) && (allowance?.remaining ?? 0) <= 0
  }

  /** Can this many lessons be written right now? Fails open when unknown. */
  function allowsLessons(count: number): boolean {
    const allowance = lessons.value
    if (!metered(allowance) || !allowance || allowance.remaining === null) return true
    return allowance.remaining >= count
  }

  /**
   * The month's reset, phrased the way a person says it. Used in the one place
   * the count is bad news, so it should read as "not long" rather than as a date
   * nobody can subtract from today.
   */
  const resetsLabel = computed(() => {
    const iso = data.value?.resets_at
    if (!iso) return 'the 1st'
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return 'the 1st'
    const days = Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86_400_000))
    if (days <= 1) return 'tomorrow'
    if (days <= 14) return `in ${days} days`
    return 'on the 1st'
  })

  async function buy(packId: string): Promise<void> {
    const { url } = await api.post<{ url: string }>('/billing/topup', { pack: packId })
    if (import.meta.client && url) window.location.href = url
  }

  return {
    data,
    loading,
    load,
    ensure,
    lessons,
    illustrations,
    packs,
    packsFor,
    metered,
    low,
    empty,
    allowsLessons,
    resetsLabel,
    buy,
  }
}

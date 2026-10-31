import type { MaterialQuota } from '~/types/api'

/**
 * How much room is left for the learner's own material.
 *
 * `GET /materials/quota` returns the very object `EnforceMaterialQuota` refuses
 * from, which is the whole point of fetching it: a ceiling you only meet as a
 * 402 halfway through a 40 MB upload is indistinguishable from a broken app.
 * With the number on screen the drop bar can turn a file away *before* it is
 * sent, in the same words the server would have used.
 *
 * The state is shared (`useState`) because two drop bars can be mounted at once
 * — the materials page and the picker inside the create flow — and two meters
 * disagreeing about the same library would be worse than no meter at all.
 */

/** Kept in one place so the meter and the refusal round the same way. */
export function materialBytes(value: number | null | undefined): string {
  if (!value || value <= 0) return '0 B'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function useMaterialQuota() {
  const api = useApi()

  const quota = useState<MaterialQuota | null>('materials:quota', () => null)
  const loading = useState<boolean>('materials:quota:loading', () => false)

  /**
   * A quota we could not read must never block an upload. The server is the
   * authority and will refuse for itself; this is only ever an early warning,
   * so its absence has to fail open.
   */
  async function load(): Promise<void> {
    if (loading.value) return

    loading.value = true

    try {
      quota.value = await api.get<MaterialQuota>('/materials/quota')
    } catch {
      quota.value = null
    } finally {
      loading.value = false
    }
  }

  const metered = computed(() => quota.value?.metered === true)
  const usedBytes = computed(() => quota.value?.storage.used_bytes ?? 0)
  const limitBytes = computed(() => quota.value?.storage.limit_bytes ?? 0)
  const remainingBytes = computed(() => quota.value?.storage.remaining_bytes ?? 0)
  const maxUploadBytes = computed(() => quota.value?.upload.max_bytes ?? 0)

  const percent = computed(() => {
    if (limitBytes.value <= 0) return 0
    return Math.min(100, Math.round((usedBytes.value / limitBytes.value) * 100))
  })

  const storageFull = computed(() => metered.value && remainingBytes.value <= 0)

  const countFull = computed(() => {
    const storage = quota.value?.storage
    if (!metered.value || !storage || storage.materials_limit <= 0) return false
    return storage.materials >= storage.materials_limit
  })

  const atCeiling = computed(() => storageFull.value || countFull.value)

  /**
   * Worth drawing at all? A bar at 3% is decoration — it tells the owner
   * nothing they need and puts an accounting device on a page about learning.
   */
  const showMeter = computed(() => metered.value && (percent.value >= 60 || atCeiling.value))

  const summary = computed(() => {
    if (!metered.value) return ''
    if (countFull.value) {
      const limit = quota.value?.storage.materials_limit ?? 0
      return `You are holding all ${limit} files this plan allows.`
    }
    if (storageFull.value) return `Your ${materialBytes(limitBytes.value)} of space is full.`
    return `${materialBytes(remainingBytes.value)} of ${materialBytes(limitBytes.value)} free`
  })

  /**
   * Why this file cannot be sent, in one sentence, or null when it can.
   *
   * The wording deliberately shadows MaterialQuota's own refusals rather than
   * inventing a second vocabulary for the same three ceilings.
   */
  function refuse(file: File): string | null {
    if (!metered.value) return null

    if (countFull.value) {
      return `You are holding all ${quota.value?.storage.materials_limit ?? 0} files this plan `
        + 'allows. Delete one you have finished with to make room.'
    }

    if (maxUploadBytes.value > 0 && file.size > maxUploadBytes.value) {
      return `Larger than ${materialBytes(maxUploadBytes.value)}. Split it up, or paste in the `
        + 'part you actually need.'
    }

    if (file.size > remainingBytes.value) {
      return `Only ${materialBytes(remainingBytes.value)} of space is left and this is `
        + `${materialBytes(file.size)}. Delete something you have finished with.`
    }

    return null
  }

  return {
    quota,
    loading,
    load,
    metered,
    usedBytes,
    limitBytes,
    remainingBytes,
    maxUploadBytes,
    percent,
    storageFull,
    countFull,
    atCeiling,
    showMeter,
    summary,
    refuse,
  }
}

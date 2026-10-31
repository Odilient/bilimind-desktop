/**
 * How much AI is left: `GET /companion/usage`, the same numbers the server refuses
 * from. Percentages and resets, never dollars, the way Claude Code shows it.
 *
 * One state for the whole app, because the composer's warning and the Usage screen
 * must not disagree. The server is the authority, so a usage we could not read
 * blocks nothing: it only means no warning shows.
 */
import { computed, ref } from 'vue'
import type { TopupPack } from '~/types/api'
import { useCompanion } from './store'

export interface UsageWindow {
  percent: number
  /** When it resets, or null: it starts with the first call, not at a set hour. */
  resets_at: string | null
}

export interface Usage {
  session: UsageWindow
  week: UsageWindow
  credits: number
  credits_expire_at: string | null
  /** What this week's use went on, by generation stage. */
  on: { stage: string; percent: number }[]
  /** On their own model key: nothing is counted. */
  own_key: boolean
  plan: string
  packs: TopupPack[]
}

const SAMPLE: Usage = {
  session: { percent: 34, resets_at: new Date(Date.now() + 3 * 3_600_000).toISOString() },
  week: { percent: 18, resets_at: new Date(Date.now() + 4 * 86_400_000).toISOString() },
  credits: 0,
  credits_expire_at: null,
  on: [
    { stage: 'expand_node', percent: 62 },
    { stage: 'companion_ask', percent: 30 },
    { stage: 'companion_check_write', percent: 8 },
  ],
  own_key: false,
  plan: 'free',
  packs: [],
}

/** Under this much used, a number on screen is only a taxi meter. */
const WARN_AT = 80

const usage = ref<Usage | null>(null)

/** "2h 14m", "3 days": how a person says how long is left. */
export function resetsIn(iso: string | null): string {
  if (!iso) return ''
  const minutes = Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 60_000))
  if (minutes < 60) return `${minutes}m`
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
  const days = Math.ceil(minutes / (24 * 60))
  return days === 1 ? '1 day' : `${days} days`
}

export function useUsage() {
  async function load(): Promise<void> {
    if (useCompanion().status.mode === 'demo') {
      usage.value = SAMPLE
      return
    }
    try {
      usage.value = await useApi().get<Usage>('/companion/usage')
    } catch {
      usage.value = null
    }
  }

  async function ensure(): Promise<void> {
    if (!usage.value) await load()
  }

  /** The window closest to its limit, when that is worth saying. */
  const tightest = computed(() => {
    const u = usage.value
    if (!u || u.own_key) return null
    const week = u.week.percent > u.session.percent
    const window = week ? u.week : u.session
    if (window.percent < WARN_AT) return null
    return { name: week ? 'this week' : 'this session', ...window }
  })

  /** Out of the plan's share, and no credits to carry on with. */
  const limited = computed(() => Boolean(tightest.value && tightest.value.percent >= 100 && !usage.value?.credits))

  return { usage, load, ensure, tightest, limited }
}

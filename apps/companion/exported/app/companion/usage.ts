/**
 * How much AI is left: `GET /companion/usage`, the same numbers the server refuses
 * from. Percentages and resets, never dollars.
 *
 * One state for the whole app, because the composer's warning and the Usage screen
 * must not disagree. The server is the authority, so a usage we could not read
 * blocks nothing: it only means no warning shows.
 *
 * Since 7 Nov 2026 Free has no AI of its own (`plan_ai: false`): no session, no week,
 * only credits (a starter gift first), an own key, or BiliMind inside ChatGPT or
 * Claude. Its windows come back as 100% and mean nothing, so nothing here reads them.
 * The server keeps one switch for "a little each day" on Free (AI_FREE_DAY_MICROS,
 * off): its session is then a DAY (`session_hours: 24`), which `sessionName` calls
 * "today".
 *
 * "Out of AI" is said in ONE way everywhere AI is offered: `outOfAi(error)` turns the
 * meter's refusal into its reason, and `<CompanionOutOfAi>` says that reason with the
 * ways forward (`MORE_AI`) as links. Never a dead button, never a modal.
 */
import { computed, ref } from 'vue'
import type { TopupPack } from '~/types/api'

export interface UsageWindow {
  percent: number
  /** When it resets, or null: it starts with the first call, not at a set hour. */
  resets_at: string | null
}

export interface Usage {
  /** False on a plan with no session and week of its own: its AI is credits. */
  plan_ai: boolean
  /** How long the session window is: 5 on Pro, 24 on Free (a day). */
  session_hours?: number
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

/**
 * The ways to more AI, in the order the refusal names them. The last is the
 * ChatGPT sheet in Settings → Integrations (CompanionSettingsAssistants); its
 * address lives here and nowhere else.
 */
export const MORE_AI = {
  credits: '/app/settings?section=usage',
  pro: '/app/settings?section=plan',
  key: '/app/settings?section=keys',
  apps: '/app/settings?section=integrations&open=chatgpt',
} as const

/**
 * The meter's refusal, as the one sentence to show before the ways forward, or null
 * for any other error. Reads both shapes it arrives in: an `ApiError` with the 402
 * body (`error: 'ai_limit_reached'`, `reason`), and the chat stream's error, whose
 * message the client has already set to the reason.
 */
export function outOfAi(error: unknown): string | null {
  const e = error as { status?: number; message?: string; data?: { error?: string; reason?: string } } | null
  if (!e || e.status !== 402) return null
  if (e.data && typeof e.data === 'object') {
    if (e.data.error !== 'ai_limit_reached') return null
    return e.data.reason || e.message || 'You\'re out of AI for now.'
  }
  return e.message || 'You\'re out of AI for now.'
}

/**
 * For a place that can only answer with a toast (a lesson asked for from a card, a
 * check answer being marked): the reason, the ways in words, and one action to the
 * Usage page, which lays every way out. Kept up until dismissed: it's a decision.
 */
export function toastOutOfAi(reason: string): void {
  const free = usage.value?.plan !== 'pro'
  useToast().push({
    title: reason,
    body: `${free ? 'Get credits or Pro' : 'Add credits'}, use your own key or OpenRouter, or use BiliMind inside ChatGPT or Claude.`,
    tone: 'warn',
    duration: 0,
    action: { label: 'Ways to continue', handler: () => void navigateTo(MORE_AI.credits) },
  })
}

/** The session window as a person says it: "today" on Free (a day long), "this session" on Pro. */
export function sessionName(u: Pick<Usage, 'session_hours'> | null | undefined): 'today' | 'this session' {
  return (u?.session_hours ?? 5) >= 24 ? 'today' : 'this session'
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
    try {
      usage.value = await useApi().get<Usage>('/companion/usage')
    } catch {
      usage.value = null
    }
  }

  async function ensure(): Promise<void> {
    if (!usage.value) await load()
  }

  /** The window closest to its limit, when that is worth saying. A plan with no windows has none. */
  const tightest = computed(() => {
    const u = usage.value
    if (!u || u.own_key || u.plan_ai === false) return null
    const week = u.week.percent > u.session.percent
    const window = week ? u.week : u.session
    if (window.percent < WARN_AT) return null
    return { name: week ? 'this week' : sessionName(u), ...window }
  })

  /** Known to be out before anything is pressed: no plan share left, no credits, no key. */
  const limited = computed(() => {
    const u = usage.value
    if (!u || u.own_key || u.credits > 0) return false
    if (u.plan_ai === false) return true
    return Boolean(tightest.value && tightest.value.percent >= 100)
  })

  return { usage, load, ensure, tightest, limited }
}

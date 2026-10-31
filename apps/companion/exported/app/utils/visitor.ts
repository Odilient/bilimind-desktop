/**
 * The browser's side of the funnel: a random visitor id and the
 * campaign a visit arrived with, both kept in localStorage.
 *
 * Plain functions rather than a composable because `useApi` needs the id on
 * every request and runs outside component setup. Every one of them is safe to
 * call on the server (it answers "nothing") and in a browser that refuses
 * storage (private mode, a locked-down profile) — measuring is never allowed
 * to throw in somebody's way.
 *
 * NOTHING HERE IS ABOUT THE PERSON. The id is `crypto.randomUUID()`, derived
 * from nothing, and clearing site data forgets it. A browser that says it does
 * not want to be tracked — Global Privacy Control, or the older Do Not Track —
 * gets no id at all, and then no event is ever sent.
 */

const ID_KEY = 'bm:visitor'
const CAMPAIGN_KEY = 'bm:campaign'

/** A landing's campaign tags are kept this long, then the next visit stands on its own. */
const CAMPAIGN_TTL_MS = 30 * 86_400_000

export interface Campaign {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
}

function storage(): Storage | null {
  if (!import.meta.client) return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** False when the browser has asked not to be tracked. */
export function trackingAllowed(): boolean {
  if (!import.meta.client) return false
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  return nav.globalPrivacyControl !== true && nav.doNotTrack !== '1'
}

/** The id if this browser already has one. Never creates one. */
export function readVisitorId(): string | null {
  if (!trackingAllowed()) return null
  try {
    return storage()?.getItem(ID_KEY) ?? null
  } catch {
    return null
  }
}

/** The id, made on first use. Null when tracking is refused or storage is. */
export function ensureVisitorId(): string | null {
  const existing = readVisitorId()
  if (existing || !trackingAllowed()) return existing

  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  try {
    storage()?.setItem(ID_KEY, id)
    return storage()?.getItem(ID_KEY) ?? null
  } catch {
    return null
  }
}

function tag(value: unknown): string | null {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' && first.trim() !== '' ? first.trim().slice(0, 120) : null
}

/**
 * Remember the campaign tags on a landing URL. A later visit that carries its
 * own tags replaces them — it is the campaign that brought this visit — and an
 * untagged visit leaves the last one in place until it lapses.
 */
export function rememberCampaign(query: Record<string, unknown>): void {
  if (!trackingAllowed()) return
  const campaign: Campaign = {
    utm_source: tag(query.utm_source),
    utm_medium: tag(query.utm_medium),
    utm_campaign: tag(query.utm_campaign),
  }
  if (!campaign.utm_source && !campaign.utm_medium && !campaign.utm_campaign) return
  try {
    storage()?.setItem(CAMPAIGN_KEY, JSON.stringify({ ...campaign, at: Date.now() }))
  } catch {
    // Storage refused; this visit is simply unattributed.
  }
}

/** The campaign this browser arrived with, while it is still fresh. */
export function currentCampaign(): Campaign | null {
  try {
    const raw = storage()?.getItem(CAMPAIGN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Campaign & { at?: number }
    if (typeof parsed.at !== 'number' || Date.now() - parsed.at > CAMPAIGN_TTL_MS) return null
    return {
      utm_source: parsed.utm_source ?? null,
      utm_medium: parsed.utm_medium ?? null,
      utm_campaign: parsed.utm_campaign ?? null,
    }
  } catch {
    return null
  }
}

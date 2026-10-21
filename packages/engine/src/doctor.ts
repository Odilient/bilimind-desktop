// `doctor`: node version, key present (bool only), balance vs reserve, spend today, clock skew, Edge TTS reachable.
// Owner: WP6. Never prints, logs or returns the key. Network probes time out after 6 s each and run in parallel.
import { BilimindError } from './contracts.ts';
import type { Doctor, DoctorData, EngineConfig } from './contracts.ts';
import { clientHeader, configPathHint, loadConfig } from './config.ts';
import { balance, spentToday } from './ledger.ts';

const EDGE_URL = 'https://speech.platform.bing.com/';
const FALLBACK_CLOCK_URL = 'https://api.deepseek.com/';

/** Server clock minus this PC's clock (ms), from the Date header of one HEAD request; null when unreachable. */
export async function probeClock(url: string, timeoutMs = 6000): Promise<{ reachable: boolean; skew_ms: number | null }> {
  try {
    const t0 = Date.now();
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' });
    const t1 = Date.now();
    const date = r.headers.get('date');
    const server = date ? Date.parse(date) : NaN;
    // the Date header has 1 s resolution: report whole seconds, measured against the request midpoint
    const skew = Number.isFinite(server) ? Math.round((server + 500 - (t0 + t1) / 2) / 1000) * 1000 : null;
    return { reachable: true, skew_ms: skew };
  } catch {
    return { reachable: false, skew_ms: null };
  }
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** BiliMind free: GET <base>/health with X-BiliMind-Client and no Authorization; true when it answers { ok: true }. */
export async function probeFreeService(baseUrl: string, timeoutMs = 6000): Promise<boolean> {
  try {
    const r = await fetch(baseUrl + '/health', { headers: { 'X-BiliMind-Client': clientHeader() }, signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return false;
    const body = await r.json() as { ok?: unknown };
    return body?.ok === true;
  } catch {
    return false;
  }
}

export const doctor: Doctor = async () => {
  const warnings: string[] = [];
  let cfg: EngineConfig | null = null;
  try { cfg = loadConfig(); } catch (e) { warnings.push(`config: ${errMsg(e)}`); }
  const key = !!cfg && cfg.keySource !== 'none' && !!cfg.apiKey;
  const free = cfg?.provider === 'bilimind';   // BiliMind free: no key needed, health check instead of a balance

  const [edge, bal, freeUp] = await Promise.all([
    probeClock(EDGE_URL),
    key && cfg && !free ? balance(cfg).catch(e => { warnings.push(`balance: ${errMsg(e)}`); return { usd: null, provider: cfg!.provider }; }) : Promise.resolve(null),
    free && cfg ? probeFreeService(cfg.baseUrl) : Promise.resolve(null),
  ]);
  if (freeUp === false) warnings.push('The free BiliMind service did not answer its health check; try again in a minute, or add your own DeepSeek or OpenRouter key.');
  let skew = edge.skew_ms;
  if (skew === null) skew = (await probeClock(FALLBACK_CLOCK_URL)).skew_ms;

  let spent = 0;
  if (cfg) { try { spent = spentToday(cfg); } catch (e) { warnings.push(`ledger: ${errMsg(e)}`); } }
  const reserve = cfg ? cfg.reserveUsd[cfg.provider] ?? 0 : 0;
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 22) warnings.push(`Node ${process.versions.node} is older than 22; use WorkBuddy's bundled Node 22 or newer.`);
  if (skew !== null && Math.abs(skew) > 60_000)
    warnings.push(`This PC's clock is off by ${(skew / 3_600_000).toFixed(1)} h. Narration corrects for it; turn on "Set time automatically" anyway.`);
  if (!edge.reachable) warnings.push('Edge TTS is unreachable: narration will be skipped (the course still builds).');
  if (key && bal && bal.usd === null) warnings.push('Balance check failed (offline?); the ledger caps still apply.');

  const data: DoctorData & { key_source: string; demo_day: boolean; free_service?: boolean; warnings: string[] } = {
    node: process.versions.node,
    provider: cfg?.provider ?? null,
    key,
    balance_usd: bal?.usd ?? null,
    reserve_usd: reserve,
    spent_today_usd: Math.round(spent * 1e6) / 1e6,
    clock_skew_ms: skew,
    edge_tts: edge.reachable,
    key_source: cfg?.keySource ?? 'none',
    demo_day: cfg?.demoDay ?? false,
    ...(free ? { free_service: freeUp === true } : {}),
    warnings,
  };
  if (!key && !free) {
    const why = warnings.find(w => w.startsWith('config:'));
    throw new BilimindError(`No API key found for DeepSeek or OpenRouter${why ? ` (${why})` : ''}.`,
      `Write ${configPathHint()} as {"provider":"deepseek","keys":{"deepseek":"<key>"}} (or set DEEPSEEK_API_KEY) and restart the app or WorkBuddy. Never paste the key into chat.`);
  }
  if (data.balance_usd !== null && data.balance_usd - reserve < 0 && !data.demo_day) {
    throw new BilimindError(`The ${data.provider} balance ($${data.balance_usd.toFixed(2)}) is under the reserve you set (reserve_usd $${reserve.toFixed(2)}).`,
      `Top up the provider account, lower reserve_usd or switch provider in ${configPathHint()}, or set BILIMIND_DEMO_DAY=1 to ignore the reserve.`);
  }
  return data;
};

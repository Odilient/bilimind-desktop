// Global spend ledger %USERPROFILE%/.bilimind/ledger.jsonl; caps $0.25/run, $2/day, provider reserve floor.
// Owner: WP1. Keep the export names and types (src/contracts.ts); replace the stubs in place.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { BilimindError } from './contracts.ts';
import type { Balance, CheckBudget, EngineConfig, LedgerEntry, ProviderId, RecordSpend, SpentForCourse, SpentToday } from './contracts.ts';
import { PRESETS, providerLabel } from './config.ts';

/** Read every ledger line (bad lines skipped). */
export function readLedger(cfg: EngineConfig): LedgerEntry[] {
  if (!existsSync(cfg.ledgerPath)) return [];
  const out: LedgerEntry[] = [];
  for (const line of readFileSync(cfg.ledgerPath, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line) as LedgerEntry); } catch { /* skip a torn line */ }
  }
  return out;
}

export const recordSpend: RecordSpend = (cfg, entry) => {
  mkdirSync(dirname(cfg.ledgerPath), { recursive: true });
  appendFileSync(cfg.ledgerPath, JSON.stringify(entry) + '\n');
  if (!entry.cached && entry.cost_usd > 0) balanceCache.spentSince += entry.cost_usd;
};

const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

/** Spend recorded on the same UTC day as `now`. */
export const spentToday: SpentToday = (cfg, now = new Date()) => {
  const key = dayKey(now);
  let sum = 0;
  for (const e of readLedger(cfg)) if (typeof e.ts === 'string' && e.ts.slice(0, 10) === key) sum += Number(e.cost_usd) || 0;
  return round6(sum);
};

const normCourse = (p: string): string => {
  const r = resolve(p).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? r.toLowerCase() : r;
};

/** Everything ever spent for one course folder (the "per run" cap: one folder = one course run). */
export const spentForCourse: SpentForCourse = (cfg, course) => {
  const key = normCourse(course);
  let sum = 0;
  for (const e of readLedger(cfg)) if (e.course && normCourse(e.course) === key) sum += Number(e.cost_usd) || 0;
  return round6(sum);
};

// One live balance read per process per minute; spend recorded since then is subtracted.
const balanceCache: { at: number; provider: ProviderId | null; usd: number | null; spentSince: number } = { at: 0, provider: null, usd: null, spentSince: 0 };
const BALANCE_TTL_MS = 60_000;

/** Test hook: forget the cached balance. */
export function resetBalanceCache(): void {
  balanceCache.at = 0; balanceCache.provider = null; balanceCache.usd = null; balanceCache.spentSince = 0;
}

/** Live balance: DeepSeek GET /user/balance, OpenRouter GET /api/v1/credits. null when unreachable. */
export const balance: Balance = async cfg => {
  const provider = cfg.provider;
  if (!cfg.apiKey) return { usd: null, provider };
  const url = cfg.baseUrl + PRESETS[provider].balancePath;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${cfg.apiKey}` }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { usd: null, provider };
    const body = await res.json() as Record<string, unknown>;
    return { usd: parseBalance(provider, body), provider };
  } catch {
    return { usd: null, provider };
  }
};

/** Exported for tests. CNY balances are converted at a conservative 7.0 CNY/USD. */
export function parseBalance(provider: ProviderId, body: Record<string, unknown>): number | null {
  if (provider === 'deepseek') {
    const infos = Array.isArray(body.balance_infos) ? body.balance_infos as { currency?: string; total_balance?: string | number }[] : [];
    const usd = infos.find(i => i.currency === 'USD');
    if (usd) return round6(Number(usd.total_balance));
    const cny = infos.find(i => i.currency === 'CNY');
    if (cny) return round6(Number(cny.total_balance) / 7.0);
    return null;
  }
  const data = (body.data ?? body) as { total_credits?: number; total_usage?: number };
  if (typeof data.total_credits !== 'number') return null;
  return round6(data.total_credits - (Number(data.total_usage) || 0));
}

async function liveBalance(cfg: EngineConfig): Promise<number | null> {
  const fresh = Date.now() - balanceCache.at < BALANCE_TTL_MS && balanceCache.provider === cfg.provider;
  if (!fresh) {
    const b = await balance(cfg);
    balanceCache.at = Date.now(); balanceCache.provider = cfg.provider; balanceCache.usd = b.usd; balanceCache.spentSince = 0;
  }
  return balanceCache.usd === null ? null : balanceCache.usd - balanceCache.spentSince;
}

const usd = (n: number): string => `$${n.toFixed(n < 0.1 ? 4 : 2)}`;

/** Throws BilimindError when the run cap, day cap, ctx.maxUsd or the provider balance floor would be crossed. */
export const checkBudget: CheckBudget = async (ctx, cfg, estimateUsd) => {
  const est = Math.max(0, estimateUsd);
  if (ctx.maxUsd !== undefined && ctx.spend.usd + est > ctx.maxUsd) {
    throw new BilimindError(`This command would spend more than --max-usd ${usd(ctx.maxUsd)} (spent ${usd(ctx.spend.usd)}, next call ~${usd(est)}).`,
      'Raise --max-usd, or run the step for fewer lessons.');
  }
  const course = spentForCourse(cfg, ctx.course);
  if (course + est > cfg.caps.runUsd) {
    throw new BilimindError(`This course has already spent ${usd(course)}; the next call (~${usd(est)}) would cross the ${usd(cfg.caps.runUsd)} per-run cap.`,
      'Start a new course folder with `init`, or raise BILIMIND_RUN_CAP_USD for this run.');
  }
  const today = spentToday(cfg, ctx.now());
  if (today + est > cfg.caps.dayUsd) {
    throw new BilimindError(`Today's model spend is ${usd(today)}; the next call (~${usd(est)}) would cross the ${usd(cfg.caps.dayUsd)} daily cap.`,
      'Wait until tomorrow (UTC), or raise BILIMIND_DAY_CAP_USD deliberately.');
  }
  if (cfg.demoDay) return;
  const live = await liveBalance(cfg);
  if (live === null) {
    ctx.progress(`ledger: ${providerLabel(cfg.provider)} balance unavailable; continuing on the run and day caps only`);
    return;
  }
  const reserve = cfg.reserveUsd[cfg.provider];
  if (live - est < reserve) {
    throw new BilimindError(`${providerLabel(cfg.provider)} balance ${usd(live)} is at the demo-day reserve (${usd(reserve)}); the call was refused to keep that money for the stage.`,
      'On demo day set BILIMIND_DEMO_DAY=1 to use the reserve, or switch pools with BILIMIND_PROVIDER=openrouter.');
  }
};

export function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

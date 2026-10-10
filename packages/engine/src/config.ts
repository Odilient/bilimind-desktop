// Provider presets (deepseek default, openrouter fallback), key lookup, caps. Never print the key.
// Owner: WP1. Keep the export names and types (src/contracts.ts); replace the stubs in place.
//
// Key lookup order (orchestrator facts, override the older docs):
//   1. %USERPROFILE%\.bilimind\config.json  {"provider","keys":{deepseek,openrouter},"models":{<provider>:{fast,smart}}}
//   2. environment variables (DEEPSEEK_API_KEY / OPENROUTER_API_KEY)
//   3. bilimind-desktop/.env.local in dev (found by walking up from cwd, repoRoot or this file)
// WorkBuddy's shell has no env vars, so (1) is the robust path on the demo laptop.
// Provider: BILIMIND_PROVIDER (demo-day fallback switch) > config.json "provider" > deepseek when its key exists > openrouter.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { EngineConfig, LoadConfig, ProviderId } from './contracts.ts';

export interface ProviderPreset {
  id: ProviderId;
  baseUrl: string;
  keyEnv: string;
  fast: string;
  smart: string;
  /** Path of the balance endpoint under baseUrl. */
  balancePath: string;
}

export const PRESETS: Record<ProviderId, ProviderPreset> = {
  deepseek: {
    id: 'deepseek', baseUrl: 'https://api.deepseek.com', keyEnv: 'DEEPSEEK_API_KEY',
    fast: 'deepseek-flash', smart: 'deepseek-v4-pro', balancePath: '/user/balance',
  },
  openrouter: {
    id: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', keyEnv: 'OPENROUTER_API_KEY',
    fast: 'deepseek/deepseek-v4-flash', smart: 'deepseek/deepseek-v4-pro', balancePath: '/credits',
  },
};

/** PLAN §6.2: demo-day reserve locked in each pool (DeepSeek $3.00, OpenRouter $4.00). */
export const DEFAULT_RESERVE_USD: Record<ProviderId, number> = { deepseek: 3, openrouter: 4 };
/** PLAN §6.3: $0.25 per course run, $2.00 per day. */
export const DEFAULT_CAPS = { runUsd: 0.25, dayUsd: 2 };

interface UserConfigFile {
  provider?: string;
  keys?: Partial<Record<ProviderId, string>>;
  models?: Partial<Record<ProviderId, { fast?: string; smart?: string; reasoning?: string }>>;
  caps?: { run_usd?: number; day_usd?: number };
  reserve_usd?: Partial<Record<ProviderId, number>> | number;
  demo_day?: boolean;
  base_url?: string;
}

/** Parse a dotenv file (KEY=value, # comments, optional quotes). Never logs values. */
export function parseDotenv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2]!.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    out[m[1]!] = v;
  }
  return out;
}

/** Walk up from each start dir and return the first `.env.local` found (dev only). */
export function findEnvLocal(starts: string[]): string | null {
  const seen = new Set<string>();
  for (const start of starts) {
    let dir = resolve(start);
    for (let i = 0; i < 12; i++) {
      if (seen.has(dir)) break;
      seen.add(dir);
      const f = join(dir, '.env.local');
      if (existsSync(f)) return f;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

function moduleDir(): string | null {
  try { return dirname(fileURLToPath(import.meta.url)); } catch { return null; }
}

function readUserConfig(userDir: string): UserConfigFile {
  const f = join(userDir, 'config.json');
  if (!existsSync(f)) return {};
  try { return JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, '')) as UserConfigFile; } catch { return {}; }
}

function isProvider(v: unknown): v is ProviderId {
  return v === 'deepseek' || v === 'openrouter';
}

function num(v: string | number | undefined | null): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** A model id fits a provider: DeepSeek direct ids have no slash, OpenRouter ids always do. */
export function modelFitsProvider(model: string, provider: ProviderId): boolean {
  return provider === 'openrouter' ? model.includes('/') : !model.includes('/');
}

export const loadConfig: LoadConfig = (opts = {}) => {
  const env = opts.env ?? process.env;
  const home = env.USERPROFILE || env.HOME || homedir();
  const userDir = env.BILIMIND_HOME ? resolve(env.BILIMIND_HOME) : join(home, '.bilimind');
  const user = readUserConfig(userDir);

  // .env.local (dev): only read when present; never required.
  const starts = [opts.repoRoot, process.cwd(), moduleDir()].filter((s): s is string => !!s);
  const envFile = env.BILIMIND_NO_ENV_LOCAL === '1' ? null : findEnvLocal(starts);
  const local = envFile ? parseDotenv(readFileSync(envFile, 'utf8')) : {};
  const pick = (name: string): string | undefined => env[name] || local[name] || undefined;

  const keyFor = (p: ProviderId): { key: string; source: EngineConfig['keySource'] } => {
    const u = user.keys?.[p];
    if (u && u.trim()) return { key: u.trim(), source: 'user-config' };
    const e = env[PRESETS[p].keyEnv];
    if (e && e.trim()) return { key: e.trim(), source: 'env' };
    const l = local[PRESETS[p].keyEnv];
    if (l && l.trim()) return { key: l.trim(), source: 'env.local' };
    return { key: '', source: 'none' };
  };

  const forced = pick('BILIMIND_PROVIDER');
  let provider: ProviderId;
  if (isProvider(forced)) provider = forced;
  else if (isProvider(user.provider) && keyFor(user.provider).key) provider = user.provider;
  else if (keyFor('deepseek').key) provider = 'deepseek';
  else if (keyFor('openrouter').key) provider = 'openrouter';
  else provider = isProvider(user.provider) ? user.provider : 'deepseek';

  const preset = PRESETS[provider];
  const { key, source } = keyFor(provider);
  const um = user.models?.[provider] ?? {};
  // BILIMIND_MODEL_FAST/SMART in .env.local hold OpenRouter ids; apply them only when they fit this provider.
  const envFast = pick('BILIMIND_MODEL_FAST');
  const envSmart = pick('BILIMIND_MODEL_SMART');
  const fast = (envFast && modelFitsProvider(envFast, provider) ? envFast : undefined) ?? um.fast ?? preset.fast;
  const reasoning = (envSmart && modelFitsProvider(envSmart, provider) ? envSmart : undefined) ?? um.smart ?? um.reasoning ?? preset.smart;

  const reserveAll = num(pick('BILIMIND_RESERVE_USD'));
  const userReserve = user.reserve_usd;
  const reserveUsd: Record<ProviderId, number> = {
    deepseek: reserveAll ?? (typeof userReserve === 'number' ? userReserve : num(userReserve?.deepseek)) ?? DEFAULT_RESERVE_USD.deepseek,
    openrouter: reserveAll ?? (typeof userReserve === 'number' ? userReserve : num(userReserve?.openrouter)) ?? DEFAULT_RESERVE_USD.openrouter,
  };

  const demoFlag = pick('BILIMIND_DEMO_DAY');
  return {
    provider,
    baseUrl: (pick('BILIMIND_BASE_URL') ?? user.base_url ?? preset.baseUrl).replace(/\/+$/, ''),
    apiKey: key,
    keySource: source,
    models: { fast, reasoning },
    userDir,
    ledgerPath: join(userDir, 'ledger.jsonl'),
    caps: {
      runUsd: num(pick('BILIMIND_RUN_CAP_USD')) ?? num(user.caps?.run_usd) ?? DEFAULT_CAPS.runUsd,
      dayUsd: num(pick('BILIMIND_DAY_CAP_USD')) ?? num(user.caps?.day_usd) ?? DEFAULT_CAPS.dayUsd,
    },
    reserveUsd,
    demoDay: demoFlag === '1' || demoFlag === 'true' || (demoFlag === undefined && user.demo_day === true),
  };
};

/** Human label for messages: "DeepSeek" / "OpenRouter". */
export function providerLabel(p: ProviderId): string {
  return p === 'deepseek' ? 'DeepSeek' : 'OpenRouter';
}

/** Where the key should go, for hints (never the key itself). */
export function keyHint(p: ProviderId): string {
  return `Put the key in %USERPROFILE%\\.bilimind\\config.json as {"provider":"${p}","keys":{"${p}":"..."}} (or set ${PRESETS[p].keyEnv}).`;
}

/** Remove anything that looks like a secret from a string before it is logged or shown. */
export function redact(text: string): string {
  return text
    .replace(/\bsk-[A-Za-z0-9_\-]{4,}/g, '[redacted]')
    .replace(/\*{2,}[A-Za-z0-9_\-]+/g, '[redacted]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]');
}

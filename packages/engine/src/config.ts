// Provider presets (deepseek default, openrouter fallback), key lookup, caps. Never print the key.
// Owner: WP1. Keep the export names and types (src/contracts.ts); replace the stubs in place.
//
// Key lookup order (orchestrator facts, override the older docs):
//   1. %USERPROFILE%\.bilimind\config.json  {"provider","keys":{deepseek,openrouter},"models":{<provider>:{fast,smart}}}
//   2. environment variables (DEEPSEEK_API_KEY / OPENROUTER_API_KEY)
//   3. bilimind-desktop/.env.local in dev (found by walking up from cwd, repoRoot or this file)
// WorkBuddy's shell has no env vars, so (1) is the robust path on the demo laptop.
// Provider: BILIMIND_PROVIDER (demo-day fallback switch) > config.json "provider" > deepseek when its key exists >
// openrouter when its key exists > 'bilimind' (BiliMind free, no key) when nothing names a provider and no key is set.
// 'bilimind' is the owner's OpenAI-compatible proxy: no key on this computer, no Authorization header, every request
// carries X-BiliMind-Client. Its URL: BILIMIND_FREE_URL > config.json "free_base_url" > FREE_BASE_URL.
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
  bilimind: {
    // keyEnv '' = no key needed. Same model ids as OpenRouter (the proxy forwards the OpenRouter body as is).
    id: 'bilimind', baseUrl: 'https://desktop-api.bilimind.com/v1', keyEnv: '',
    fast: 'deepseek/deepseek-v4-flash', smart: 'deepseek/deepseek-v4-pro', balancePath: '/health',
  },
  deepseek: {
    id: 'deepseek', baseUrl: 'https://api.deepseek.com', keyEnv: 'DEEPSEEK_API_KEY',
    fast: 'deepseek-flash', smart: 'deepseek-v4-pro', balancePath: '/user/balance',
  },
  openrouter: {
    id: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', keyEnv: 'OPENROUTER_API_KEY',
    fast: 'deepseek/deepseek-v4-flash', smart: 'deepseek/deepseek-v4-pro', balancePath: '/credits',
  },
};

/** Balance floor per pool: no floor unless the user sets reserve_usd (the hackathon build kept $3 and $4 for its demo).
 * BiliMind free: no balance, 0. */
export const DEFAULT_RESERVE_USD: Record<ProviderId, number> = { deepseek: 0, openrouter: 0, bilimind: 0 };

/** BiliMind free switch. While it is paused (false), nothing picks the free service by default: a fresh install
 * resolves to DeepSeek and asks for a key, and the desktop hides the option. BILIMIND_PROVIDER=bilimind still reaches
 * it, and BILIMIND_FREE=1 / 0 overrides the switch (tests). Set it to true when desktop-api.bilimind.com answers
 * completions again, together with data-free-tier="on" in site/index.html (see server/free-proxy/README.md). */
export const FREE_TIER_ON = false;

/** Whether BiliMind free is offered: BILIMIND_FREE=1 or 0, else FREE_TIER_ON. */
export function freeTierOn(env: Record<string, string | undefined> = process.env): boolean {
  const v = env.BILIMIND_FREE?.trim();
  return v === '1' ? true : v === '0' ? false : FREE_TIER_ON;
}

/** The free service's default URL (overridable with BILIMIND_FREE_URL or config.json "free_base_url", for tests). */
export const FREE_BASE_URL = PRESETS.bilimind.baseUrl;
/** Sent as `X-BiliMind-Client: engine/<version>` when no BILIMIND_CLIENT (the desktop sets desktop/<app version>). */
export const ENGINE_VERSION = '0.2.1';

/** Providers that need the user's own key ('bilimind' never does). */
export function needsKey(p: ProviderId): boolean {
  return PRESETS[p].keyEnv !== '';
}

/** Base URL of the free service: BILIMIND_FREE_URL > config.json free_base_url > FREE_BASE_URL. No trailing slash. */
export function freeBaseUrl(env: Record<string, string | undefined> = process.env, fileUrl?: unknown): string {
  const fromEnv = env.BILIMIND_FREE_URL?.trim();
  const fromFile = typeof fileUrl === 'string' ? fileUrl.trim() : '';
  return (fromEnv || fromFile || FREE_BASE_URL).replace(/\/+$/, '');
}

/** Value of the X-BiliMind-Client header: BILIMIND_CLIENT ("desktop/<v>" or "engine/<v>") or engine/<ENGINE_VERSION>. */
export function clientHeader(env: Record<string, string | undefined> = process.env): string {
  const v = env.BILIMIND_CLIENT?.trim();
  return v && /^(desktop|engine)\/[\w.+-]{1,40}$/.test(v) ? v : `engine/${ENGINE_VERSION}`;
}

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
  free_base_url?: string;
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
  return v === 'deepseek' || v === 'openrouter' || v === 'bilimind';
}

function num(v: string | number | undefined | null): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** A model id fits a provider: DeepSeek direct ids have no slash, OpenRouter (and BiliMind free) ids always do. */
export function modelFitsProvider(model: string, provider: ProviderId): boolean {
  return provider === 'deepseek' ? !model.includes('/') : model.includes('/');
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
    if (!needsKey(p)) return { key: '', source: 'none' };     // BiliMind free: never a key, never sent
    const u = user.keys?.[p];
    if (u && u.trim()) return { key: u.trim(), source: 'user-config' };
    const e = env[PRESETS[p].keyEnv];
    if (e && e.trim()) return { key: e.trim(), source: 'env' };
    const l = local[PRESETS[p].keyEnv];
    if (l && l.trim()) return { key: l.trim(), source: 'env.local' };
    return { key: '', source: 'none' };
  };

  const forced = pick('BILIMIND_PROVIDER');
  const free = freeTierOn(env);
  // a named provider counts when it has its key, or when it is BiliMind free and the free tier is on
  const usable = (p: ProviderId): boolean => (needsKey(p) ? !!keyFor(p).key : free);
  let provider: ProviderId;
  if (isProvider(forced)) provider = forced;
  else if (isProvider(user.provider) && usable(user.provider)) provider = user.provider;
  else if (keyFor('deepseek').key) provider = 'deepseek';
  else if (keyFor('openrouter').key) provider = 'openrouter';
  else if (isProvider(user.provider) && (needsKey(user.provider) || free)) provider = user.provider;
  else provider = free ? 'bilimind' : 'deepseek';   // fresh install: the free service, or DeepSeek (asks for a key) while it is paused

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
    bilimind: 0,   // no balance to protect: the free service has its own limits server-side
  };

  const demoFlag = pick('BILIMIND_DEMO_DAY');
  return {
    provider,
    baseUrl: provider === 'bilimind'
      ? freeBaseUrl({ BILIMIND_FREE_URL: pick('BILIMIND_FREE_URL') }, user.free_base_url)
      : (pick('BILIMIND_BASE_URL') ?? user.base_url ?? preset.baseUrl).replace(/\/+$/, ''),
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

/** Human label for messages: "DeepSeek" / "OpenRouter" / "BiliMind free". */
export function providerLabel(p: ProviderId): string {
  return p === 'deepseek' ? 'DeepSeek' : p === 'openrouter' ? 'OpenRouter' : 'BiliMind free';
}

/** The config file as the user would type it on this OS, for hints. */
export function configPathHint(platform: string = process.platform): string {
  return platform === 'win32' ? '%USERPROFILE%\\.bilimind\\config.json' : '~/.bilimind/config.json';
}

/** Where the key should go, for hints (never the key itself). */
export function keyHint(p: ProviderId): string {
  if (!needsKey(p)) return `BiliMind free needs no key. To use your own, put it in ${configPathHint()} as {"provider":"deepseek","keys":{"deepseek":"..."}}.`;
  return `Put the key in ${configPathHint()} as {"provider":"${p}","keys":{"${p}":"..."}} (or set ${PRESETS[p].keyEnv}).`;
}

/** Remove anything that looks like a secret from a string before it is logged or shown. */
export function redact(text: string): string {
  return text
    .replace(/\bsk-[A-Za-z0-9_\-]{4,}/g, '[redacted]')
    .replace(/\*{2,}[A-Za-z0-9_\-]+/g, '[redacted]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]');
}

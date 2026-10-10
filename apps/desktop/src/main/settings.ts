// Settings + key storage. Everything lives in %USERPROFILE%\.bilimind\config.json, the same file the CLI and the
// WorkBuddy skill read ({"provider","keys":{deepseek,openrouter},"models":{...}}); desktop-only fields go under
// "desktop": {narrate, outRoot}. Writes merge: unknown fields are kept. A key is never logged or returned
// (only `set` and the last 4 characters).
import { app, net } from 'electron';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { PRESETS, findEnvLocal, parseDotenv } from '@bilimind/engine/config';
import { parseBalance } from '@bilimind/engine/ledger';
import type { ProviderId, Settings, SettingsPatch } from '../shared/contract.ts';

const PROVIDERS: ProviderId[] = ['deepseek', 'openrouter'];
const isProvider = (v: unknown): v is ProviderId => v === 'deepseek' || v === 'openrouter';

interface ConfigFile {
  provider?: string;
  keys?: Partial<Record<ProviderId, string>>;
  desktop?: { narrate?: boolean; outRoot?: string };
  [k: string]: unknown;
}

export function userDir(): string {
  const env = process.env;
  return env.BILIMIND_HOME ? resolve(env.BILIMIND_HOME) : join(env.USERPROFILE || env.HOME || homedir(), '.bilimind');
}
const configPath = () => join(userDir(), 'config.json');

function readConfig(): ConfigFile {
  const f = configPath();
  if (!existsSync(f)) return {};
  try {
    const v = JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, '')) as unknown;
    return v && typeof v === 'object' ? (v as ConfigFile) : {};
  } catch { return {}; }
}

function writeConfig(c: ConfigFile): void {
  const f = configPath();
  mkdirSync(dirname(f), { recursive: true });
  const tmp = `${f}.tmp`;
  writeFileSync(tmp, JSON.stringify(c, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  renameSync(tmp, f);
}

/** The key for a provider: config.json, then the environment, then .env.local (dev). Never leaves main. */
function keyFor(p: ProviderId, c: ConfigFile = readConfig()): string {
  const u = c.keys?.[p];
  if (typeof u === 'string' && u.trim()) return u.trim();
  const envName = PRESETS[p].keyEnv;
  const e = process.env[envName];
  if (e && e.trim()) return e.trim();
  if (process.env.BILIMIND_NO_ENV_LOCAL !== '1' && !app.isPackaged) {
    const f = findEnvLocal([process.cwd(), app.getAppPath()]);
    if (f) {
      try { const v = parseDotenv(readFileSync(f, 'utf8'))[envName]; if (v && v.trim()) return v.trim(); } catch { /* ignore */ }
    }
  }
  return '';
}

export function defaultOutRoot(): string {
  return join(app.getPath('documents'), 'BiliMind');
}

export function getSettings(): Settings {
  const c = readConfig();
  const keys = {} as Settings['keys'];
  for (const p of PROVIDERS) {
    const k = keyFor(p, c);
    keys[p] = k ? { set: true, last4: k.slice(-4) } : { set: false };
  }
  let provider: ProviderId = isProvider(c.provider) ? c.provider : 'deepseek';
  if (!keys[provider].set) { const other = PROVIDERS.find(p => keys[p].set); if (other && !isProvider(c.provider)) provider = other; }
  return {
    provider,
    keys,
    narrate: c.desktop?.narrate !== false,
    outRoot: c.desktop?.outRoot && c.desktop.outRoot.trim() ? resolve(c.desktop.outRoot) : defaultOutRoot(),
    version: app.getVersion(),
  };
}

export function saveSettings(p: SettingsPatch): Settings {
  const c = readConfig();
  if (p.provider !== undefined) {
    if (!isProvider(p.provider)) throw new Error('Unknown AI provider.');
    c.provider = p.provider;
  }
  if (p.key) {
    if (!isProvider(p.key.provider)) throw new Error('Unknown AI provider.');
    const v = String(p.key.value ?? '').trim();
    const keys = { ...(c.keys && typeof c.keys === 'object' ? c.keys : {}) };
    if (v) keys[p.key.provider] = v; else delete keys[p.key.provider];
    c.keys = keys;
    if (v && !isProvider(c.provider)) c.provider = p.key.provider;
  }
  if (p.narrate !== undefined || p.outRoot !== undefined) {
    const d = { ...(c.desktop && typeof c.desktop === 'object' ? c.desktop : {}) };
    if (p.narrate !== undefined) d.narrate = !!p.narrate;
    if (p.outRoot !== undefined) {
      const o = String(p.outRoot).trim();
      if (o) d.outRoot = resolve(o); else delete d.outRoot;
    }
    c.desktop = d;
  }
  writeConfig(c);
  return getSettings();
}

/** Balance check against the provider's balance endpoint (Chromium network stack: system certificates). */
export async function testKey(provider: ProviderId): Promise<{ ok: boolean; balance?: string; error?: string }> {
  if (!isProvider(provider)) return { ok: false, error: 'Unknown AI provider.' };
  const key = keyFor(provider);
  const label = provider === 'deepseek' ? 'DeepSeek' : 'OpenRouter';
  if (!key) return { ok: false, error: `No ${label} key saved yet.` };
  const url = PRESETS[provider].baseUrl + PRESETS[provider].balancePath;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10_000);
  try {
    const res = await net.fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: ctl.signal });
    if (res.status === 401 || res.status === 403) return { ok: false, error: `${label} did not accept this key.` };
    if (!res.ok) return { ok: false, error: `${label} answered ${res.status}. Try again in a minute.` };
    const usd = parseBalance(provider, (await res.json()) as Record<string, unknown>);
    return usd === null ? { ok: true } : { ok: true, balance: `$${usd.toFixed(2)}` };
  } catch (e) {
    const aborted = (e as Error)?.name === 'AbortError';
    return { ok: false, error: aborted ? `${label} did not answer in 10 seconds. Check the internet connection.` : `Could not reach ${label}. Check the internet connection.` };
  } finally { clearTimeout(timer); }
}

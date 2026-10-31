// The AI keys, sealed by the system's keychain where it has one, in a file only this user can read. The secret never
// comes back out: the list carries the last four characters. Ids are integers because the SPA's Credential says so:
// one per provider, there being one key per provider. The SPA reads `active`.
//
// Keys already in the settings file the CLI shares (~/.bilimind/config.json) are copied in once. That file is left
// alone because the CLI reads it; the storage notice says it still holds one in plain text.
import { DEFAULT_CAPS, DEFAULT_RESERVE_USD, PRESETS } from '@bilimind/engine/config'
import type { EngineConfig, ProviderId } from '@bilimind/engine/contracts'
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { KeyState } from './ask/asker.ts'
import { Invalid } from './rules.ts'
import { capsOf } from './spend.ts'

export const PROVIDERS = ['openrouter', 'deepseek'] as const
type Provider = (typeof PROVIDERS)[number]

/** How a key is kept at rest. `available: false` means no real keychain here: the key stays plain, and the UI says so. */
export interface Vault {
  available: boolean
  seal(plain: string): string
  open(sealed: string): string
}

interface Stored {
  sealed: string
  /** False when it went in without a keychain: re-sealed as soon as there is one. */
  encrypted: boolean
  last_four: string
  label: string | null
  created_at: string
}
interface KeyFile { provider?: Provider; keys: Partial<Record<Provider, Stored>> }

export function credentials(dataDir: string, configDir: string, vault: Vault, baseUrl?: string) {
  const file = join(dataDir, 'keys.json')

  function write(data: KeyFile): void {
    mkdirSync(dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    renameSync(tmp, file)
    chmodSync(file, 0o600)
  }

  function sealed(key: string, label: string | null, createdAt = new Date().toISOString()): Stored {
    return { sealed: vault.available ? vault.seal(key) : key, encrypted: vault.available, last_four: key.slice(-4), label, created_at: createdAt }
  }

  function legacy(): { provider?: string; keys?: Record<string, unknown> } {
    try {
      const value = JSON.parse(readFileSync(join(configDir, 'config.json'), 'utf8').replace(/^﻿/, '')) as unknown
      return value && typeof value === 'object' ? value as { provider?: string; keys?: Record<string, unknown> } : {}
    } catch {
      return {}
    }
  }

  function read(): KeyFile {
    if (existsSync(file)) {
      try {
        const data = JSON.parse(readFileSync(file, 'utf8')) as KeyFile
        // A key written before there was a keychain gets sealed the moment there is one.
        if (vault.available && PROVIDERS.some((p) => data.keys?.[p] && !data.keys[p]!.encrypted)) {
          for (const p of PROVIDERS) {
            const k = data.keys[p]
            if (k && !k.encrypted) data.keys[p] = sealed(k.sealed, k.label, k.created_at)
          }
          write(data)
        }
        return { provider: data.provider, keys: data.keys ?? {} }
      } catch {
        return { keys: {} }
      }
    }
    const old = legacy()
    const data: KeyFile = { keys: {} }
    for (const p of PROVIDERS) {
      const key = old.keys?.[p]
      if (typeof key === 'string' && key.trim()) data.keys[p] = sealed(key.trim(), null)
    }
    if (PROVIDERS.includes(old.provider as Provider)) data.provider = old.provider as Provider
    if (Object.keys(data.keys).length) write(data)
    return data
  }

  const activeOf = (data: KeyFile): Provider | null =>
    data.provider && data.keys[data.provider] ? data.provider : PROVIDERS.find((p) => data.keys[p]) ?? null

  const view = (provider: Provider, data: KeyFile) => {
    const stored = data.keys[provider]!
    return {
      id: PROVIDERS.indexOf(provider) + 1,
      provider,
      label: stored.label,
      last_four: stored.last_four,
      active: activeOf(data) === provider,
      created_at: stored.created_at,
      last_used_at: null,
    }
  }

  const providerOf = (id: number): Provider | null => PROVIDERS[id - 1] ?? null

  return {
    list() {
      const data = read()
      return PROVIDERS.filter((p) => data.keys[p]).map((p) => view(p, data))
    },

    add(input: Record<string, unknown>) {
      const provider = typeof input.provider === 'string' ? input.provider as Provider : 'openrouter'
      if (!PROVIDERS.includes(provider)) throw new Invalid({ provider: ['That provider is not available.'] })
      const key = typeof input.key === 'string' ? input.key.trim() : ''
      if (key.length > 250 || !/^sk-[A-Za-z0-9_-]{16,}$/.test(key)) throw new Invalid({ key: ['That does not look like an API key.'] })
      const label = typeof input.label === 'string' && input.label.trim() ? input.label.trim().slice(0, 120) : null
      const data = read()
      data.keys[provider] = sealed(key, label)
      data.provider = provider
      write(data)
      return view(provider, data)
    },

    /** False when there is no such key. */
    activate(id: number): boolean {
      const provider = providerOf(id)
      const data = read()
      if (!provider || !data.keys[provider]) return false
      data.provider = provider
      write(data)
      return true
    },

    remove(id: number): boolean {
      const provider = providerOf(id)
      const data = read()
      if (!provider || !data.keys[provider]) return false
      delete data.keys[provider]
      write(data)
      return true
    },

    /** What the settings screen says about where keys live. */
    storage() {
      const old = legacy()
      return { encrypted: vault.available, shared_file_has_key: PROVIDERS.some((p) => typeof old.keys?.[p] === 'string' && (old.keys[p] as string).trim()) }
    },

    /** The active key as the engine wants it. Only this provider's own service is ever called: never a BiliMind-run one. */
    keyState(): KeyState {
      const data = read()
      const provider = activeOf(data)
      if (!provider) return { state: 'none' }
      const stored = data.keys[provider]!
      let apiKey: string
      try {
        apiKey = stored.encrypted ? vault.open(stored.sealed) : stored.sealed
      } catch {
        return { state: 'unreadable' }
      }
      const preset = PRESETS[provider as ProviderId]
      const config: EngineConfig = {
        provider: provider as ProviderId,
        baseUrl: (baseUrl ?? preset.baseUrl).replace(/\/+$/, ''),
        apiKey,
        keySource: 'user-config',
        models: { fast: preset.fast, reasoning: preset.smart },
        userDir: configDir,
        ledgerPath: join(configDir, 'ledger.jsonl'),
        caps: capsOf(configDir),
        reserveUsd: DEFAULT_RESERVE_USD,
        demoDay: false,
      }
      return { state: 'ok', config }
    },
  }
}

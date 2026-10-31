// `/credentials` over the settings file the CLI and the course generator already read ({"provider","keys":{...}}), so
// a key set in one works in all. The secret never comes back out: the list carries the last four characters.
// Ids are integers because the SPA's Credential says so: one per provider, there being one key per provider.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Invalid } from './rules.ts'

const PROVIDERS = ['openrouter', 'deepseek']

interface ConfigFile {
  provider?: string
  keys?: Record<string, string | undefined>
  [k: string]: unknown
}

export function credentials(dir: string) {
  const file = join(dir, 'config.json')

  function read(): ConfigFile {
    if (!existsSync(file)) return {}
    try {
      const value = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')) as unknown
      return value && typeof value === 'object' ? (value as ConfigFile) : {}
    } catch {
      return {}
    }
  }

  function write(config: ConfigFile): void {
    mkdirSync(dir, { recursive: true })
    const tmp = `${file}.tmp`
    writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    renameSync(tmp, file)
  }

  const view = (provider: string, config: ConfigFile) => ({
    id: PROVIDERS.indexOf(provider) + 1,
    provider,
    label: null,
    last_four: config.keys![provider]!.slice(-4),
    active: config.provider === provider,
    created_at: null,
    last_used_at: null,
  })

  const providerOf = (id: number) => PROVIDERS[id - 1] ?? null

  return {
    list() {
      const config = read()
      return PROVIDERS.filter((p) => config.keys?.[p]).map((p) => view(p, config))
    },

    add(input: Record<string, unknown>) {
      const provider = typeof input.provider === 'string' ? input.provider : 'openrouter'
      if (!PROVIDERS.includes(provider)) throw new Invalid({ provider: ['That provider is not available.'] })
      const key = typeof input.key === 'string' ? input.key.trim() : ''
      if (key.length > 250 || !/^sk-[A-Za-z0-9_-]{16,}$/.test(key)) throw new Invalid({ key: ['That does not look like an API key.'] })
      const config = read()
      const next = { ...config, provider, keys: { ...config.keys, [provider]: key } }
      write(next)
      return view(provider, next)
    },

    /** False when there is no such key. */
    activate(id: number): boolean {
      const provider = providerOf(id)
      const config = read()
      if (!provider || !config.keys?.[provider]) return false
      write({ ...config, provider })
      return true
    },

    remove(id: number): boolean {
      const provider = providerOf(id)
      const config = read()
      if (!provider || !config.keys?.[provider]) return false
      const { [provider]: _gone, ...keys } = config.keys
      write({ ...config, keys })
      return true
    },
  }
}

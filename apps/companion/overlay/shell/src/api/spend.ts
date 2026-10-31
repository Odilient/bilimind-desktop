// What the AI has cost, in the ledger the CLI shares: the day against its cap, each course against its own, and each thing
// by name. The caps live in the same settings file, so the command line and this screen agree.
import { DEFAULT_CAPS } from '@bilimind/engine/config'
import { readLedger, spentToday } from '@bilimind/engine/ledger'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type { KeyState } from './ask/asker.ts'
import { Invalid } from './rules.ts'
import type { Store } from './store.ts'

const WORDS: Record<string, string> = {
  expand: 'Writing a lesson', expand_block: 'Rewriting a part', relabel: 'Sorting a lesson by kind', higher_order: 'Adding a harder question', grade: 'Marking an answer',
  companion_ask: 'Answering in the chat', companion_draw: 'Drawing', outline: 'Drafting a course',
}

function readSettings(configDir: string): Record<string, any> {
  const file = join(configDir, 'config.json')
  if (!existsSync(file)) return {}
  try { return JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')) as Record<string, any> } catch { return {} }
}

export function capsOf(configDir: string): { runUsd: number; dayUsd: number } {
  const caps = readSettings(configDir).caps ?? {}
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : fallback)
  return { runUsd: num(caps.run_usd, DEFAULT_CAPS.runUsd), dayUsd: num(caps.day_usd, DEFAULT_CAPS.dayUsd) }
}

export function setCaps(configDir: string, input: Record<string, any>) {
  const fail = (field: string) => { throw new Invalid({ [field]: ['Give an amount between $0.01 and $1000.'] }) }
  const valid = (v: unknown) => typeof v === 'number' && v >= 0.01 && v <= 1000
  if (!valid(input.run_usd)) fail('run_usd')
  if (!valid(input.day_usd)) fail('day_usd')
  const file = join(configDir, 'config.json')
  const settings = readSettings(configDir)
  settings.caps = { ...settings.caps, run_usd: input.run_usd, day_usd: input.day_usd }
  mkdirSync(dirname(file), { recursive: true })
  // Other fields are kept: the CLI reads and writes this file too.
  writeFileSync(`${file}.tmp`, `${JSON.stringify(settings, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  renameSync(`${file}.tmp`, file)
  return { run_usd: input.run_usd, day_usd: input.day_usd }
}

const money = (n: number) => Math.round(n * 1e6) / 1e6

export function spendView(store: Store, key: KeyState, configDir: string) {
  const caps = capsOf(configDir)
  const ledgerPath = join(configDir, 'ledger.jsonl')
  const config = { ledgerPath } as never
  const entries = key.state === 'ok' || existsSync(ledgerPath) ? readLedger(config) : []
  const courseId = (path: string) => {
    if (!path) return null
    const m = path.match(/[\\/]courses[\\/](\d+)$/)
    if (m) return Number(m[1])
    return store.recs('course').find((c) => c.folder === path)?.id ?? null
  }
  const totals = new Map<number, number>()
  for (const e of entries) {
    const id = courseId(e.course)
    if (id !== null) totals.set(id, (totals.get(id) ?? 0) + (Number(e.cost_usd) || 0))
  }
  const courses = store.recs('course').flatMap((course) => {
    const spent = totals.get(course.id) ?? 0
    const lessons = store.recs('node', course.id).filter((n) => n.cost_usd > 0).map((n) => ({ id: n.id, title: n.title, cost_usd: money(n.cost_usd) }))
    return spent > 0 || lessons.length ? [{ id: course.id, title: course.title, spent_usd: money(spent), lessons }] : []
  })
  const today = new Date().toISOString().slice(0, 10)
  return {
    today_usd: spentToday(config),
    caps: { run_usd: caps.runUsd, day_usd: caps.dayUsd },
    day_resets: 'midnight UTC',
    courses,
    recent: entries.filter((e) => !e.cached && (Number(e.cost_usd) || 0) > 0).slice(-30).reverse().map((e) => {
      const id = courseId(e.course)
      return {
        at: e.ts,
        what: WORDS[e.cmd] ?? (e.course ? 'Building from a folder' : e.cmd),
        course: id !== null ? store.rec('course', id)?.title ?? null : e.course && !/[\\/]drafts[\\/]/.test(e.course) ? basename(e.course) : null,
        model: e.model,
        cost_usd: money(Number(e.cost_usd) || 0),
        today: String(e.ts).slice(0, 10) === today,
      }
    }),
  }
}

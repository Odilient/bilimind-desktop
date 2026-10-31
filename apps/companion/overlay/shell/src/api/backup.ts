// A copy of everything to a folder of the learner's choosing, and bringing one back. The database is copied while open
// with VACUUM INTO, which is consistent. AI keys stay out: they're sealed to this computer's keychain and wouldn't open
// elsewhere, and a backup is exactly the thing that gets copied around.
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Store } from './store.ts'

const DB = 'companion.db'
const PENDING = 'restore-pending'
const CONTENTS = ['files', 'built', 'courses'] as const

export function writeBackup(store: Store, dataDir: string, folder: string): string {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')
  const target = join(folder, `BiliMind backup ${stamp}`)
  mkdirSync(target, { recursive: true })
  // VACUUM INTO takes a literal path, and refuses one that exists.
  store.db.exec(`VACUUM INTO '${join(target, DB).replace(/'/g, "''")}'`)
  for (const name of CONTENTS) {
    const from = join(dataDir, name)
    if (existsSync(from)) cpSync(from, join(target, name), { recursive: true })
  }
  writeFileSync(join(target, 'backup.json'), JSON.stringify({ app: 'bilimind', format: 1, made_at: new Date().toISOString() }, null, 2))
  return target
}

/** True when the folder is a backup this app made and its database opens as one. */
export function isBackup(folder: string): boolean {
  try {
    if (JSON.parse(readFileSync(join(folder, 'backup.json'), 'utf8')).app !== 'bilimind') return false
    const db = new DatabaseSync(join(folder, DB), { readOnly: true })
    try {
      return (db.prepare('PRAGMA integrity_check').get() as { integrity_check: string }).integrity_check === 'ok'
        && Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'rows'").get())
    } finally {
      db.close()
    }
  } catch {
    return false
  }
}

/** Copied in first and swapped at the next start, because the open database can't be replaced under itself. */
export function stageRestore(dataDir: string, folder: string): void {
  const pending = join(dataDir, PENDING)
  rmSync(pending, { recursive: true, force: true })
  cpSync(folder, pending, { recursive: true })
}

/** Run before the database opens. What was there is kept beside it, so a restore can be undone by hand. */
export function applyPendingRestore(dataDir: string): void {
  const pending = join(dataDir, PENDING)
  if (!existsSync(pending)) return
  if (!isBackup(pending)) {
    rmSync(pending, { recursive: true, force: true })
    return
  }
  const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')
  const kept = join(dataDir, `before-restore-${stamp}`)
  mkdirSync(kept, { recursive: true })
  for (const name of [DB, `${DB}-wal`, `${DB}-shm`, ...CONTENTS]) {
    const from = join(dataDir, name)
    if (existsSync(from)) renameSync(from, join(kept, name))
  }
  for (const name of [DB, ...CONTENTS]) {
    const from = join(pending, name)
    if (existsSync(from)) renameSync(from, join(dataDir, name))
  }
  rmSync(pending, { recursive: true, force: true })
}

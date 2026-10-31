// The local database. One table of JSON rows per the SPA's collections rather than a column per field: the rows are
// the wire shape already, one person's data fits in memory, and the planner and readiness work on arrays anyway.
import { DatabaseSync } from 'node:sqlite'

export type Row = Record<string, any> & { id: string }

export const COLLECTIONS = ['goals', 'subjects', 'slots', 'sessions', 'items', 'topics', 'deadlines', 'cards', 'plan-tasks', 'signals', 'connections', 'checks'] as const
export type Collection = (typeof COLLECTIONS)[number]

export type RecordKind = 'course' | 'node' | 'block' | 'assessment' | 'attempt' | 'revision' | 'annotation' | 'attachment'
export type Rec = Record<string, any> & { id: number }
export type Raw = Record<string, any>

/** ISO 8601 in UTC, to the second, as the hosted API sends every time. */
export const wireTime = (at: number | string): string =>
  new Date(at).toISOString().replace(/\.\d+Z$/, '+00:00')

export type Store = ReturnType<typeof openStore>

export function openStore(path: string) {
  const db = new DatabaseSync(path)
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS rows (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      body TEXT NOT NULL,
      updated_ms INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (collection, id)
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS rows_by_change ON rows (collection, updated_ms);
    CREATE TABLE IF NOT EXISTS item_updates (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      item_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS item_updates_by_item ON item_updates (item_id, seq);
    CREATE TABLE IF NOT EXISTS item_snapshots (item_id TEXT PRIMARY KEY, snapshot TEXT);
    CREATE TABLE IF NOT EXISTS card_reviews (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      reviewed_at TEXT NOT NULL,
      fsrs_before TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS threads (id TEXT PRIMARY KEY, body TEXT NOT NULL, updated_ms INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS messages (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      thread_id TEXT NOT NULL,
      role TEXT NOT NULL,
      body TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_by_thread ON messages (thread_id, seq);
    -- Courses, lessons and what hangs off them. The SPA and the prompts count in integers here, so one table hands out one counter.
    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      parent INTEGER,
      uuid TEXT UNIQUE,
      body TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS records_by_parent ON records (kind, parent);
  `)

  const parse = (rows: unknown[]) => rows.map((r) => JSON.parse((r as { body: string }).body) as Row)
  const liveRows = db.prepare('SELECT body FROM rows WHERE collection = ? AND deleted = 0')
  const oneRow = db.prepare('SELECT body FROM rows WHERE collection = ? AND id = ?')
  const changedRows = db.prepare('SELECT body FROM rows WHERE collection = ? AND updated_ms > ? ORDER BY updated_ms, id')
  const upsert = db.prepare(`
    INSERT INTO rows (collection, id, body, updated_ms, deleted) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (collection, id) DO UPDATE SET body = excluded.body, updated_ms = excluded.updated_ms, deleted = excluded.deleted
  `)

  const store = {
    db,

    /** Live rows of a collection, unordered. */
    live: (c: Collection): Row[] => parse(liveRows.all(c)),

    /** One row, tombstone or not. */
    find(c: Collection, id: string): Row | null {
      const row = oneRow.get(c, id) as { body: string } | undefined
      return row ? (JSON.parse(row.body) as Row) : null
    },

    /** One live row. */
    get(c: Collection, id: string): Row | null {
      const row = store.find(c, id)
      return row && !row.deleted_at ? row : null
    },

    /** Everything written after a moment, tombstones included. */
    changedSince: (c: Collection, ms: number): Row[] => parse(changedRows.all(c, ms)),

    put(c: Collection, row: Row): Row {
      const now = Date.now()
      const next: Row = { ...row, created_at: row.created_at ?? wireTime(now), updated_at: wireTime(now), deleted_at: row.deleted_at ?? null }
      upsert.run(c, next.id, JSON.stringify(next), now, next.deleted_at ? 1 : 0)
      return next
    },

    /** A tombstone instead of a delete, so `/changes` can tell the screens. */
    bury: (c: Collection, row: Row): Row => store.put(c, { ...row, deleted_at: wireTime(Date.now()) }),

    /** A new record. Its id is the database's, written back into the body so a body read alone is whole. */
    add(kind: RecordKind, parent: number | null, fields: Record<string, any>, uuid: string | null = null): Rec {
      const now = wireTime(Date.now())
      const row = { created_at: now, updated_at: now, ...fields }
      const id = Number(db.prepare('INSERT INTO records (kind, parent, uuid, body) VALUES (?, ?, ?, ?)').run(kind, parent, uuid, JSON.stringify(row)).lastInsertRowid)
      const whole = { ...row, id } as Rec
      db.prepare('UPDATE records SET body = ? WHERE id = ?').run(JSON.stringify(whole), id)
      return whole
    },

    rec(kind: RecordKind, id: number): Rec | null {
      const row = db.prepare('SELECT body FROM records WHERE id = ? AND kind = ?').get(id, kind) as { body: string } | undefined
      return row ? JSON.parse(row.body) as Rec : null
    },

    recByUuid(kind: RecordKind, uuid: string): Rec | null {
      const row = db.prepare('SELECT body FROM records WHERE uuid = ? AND kind = ?').get(uuid, kind) as { body: string } | undefined
      return row ? JSON.parse(row.body) as Rec : null
    },

    /** Oldest first; of one parent, or every one of the kind. */
    recs(kind: RecordKind, parent?: number): Rec[] {
      const rows = parent === undefined
        ? db.prepare('SELECT body FROM records WHERE kind = ? ORDER BY id').all(kind)
        : db.prepare('SELECT body FROM records WHERE kind = ? AND parent = ? ORDER BY id').all(kind, parent)
      return (rows as { body: string }[]).map((r) => JSON.parse(r.body) as Rec)
    },

    save(kind: RecordKind, row: Rec, touch = true): Rec {
      const next = touch ? { ...row, updated_at: wireTime(Date.now()) } : row
      db.prepare('UPDATE records SET body = ? WHERE id = ? AND kind = ?').run(JSON.stringify(next), row.id, kind)
      return next
    },

    drop(kind: RecordKind, id: number): void {
      db.prepare('DELETE FROM records WHERE id = ? AND kind = ?').run(id, kind)
    },

    getMeta<T>(key: string): T | null {
      const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined
      return row ? (JSON.parse(row.value) as T) : null
    },

    setMeta(key: string, value: unknown): void {
      db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value))
    },

    /** All of it or none of it: a course and everything filed under it go together. */
    tx<T>(work: () => T): T {
      db.exec('BEGIN IMMEDIATE')
      try {
        const out = work()
        db.exec('COMMIT')
        return out
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },

    close: () => db.close(),
  }
  return store
}

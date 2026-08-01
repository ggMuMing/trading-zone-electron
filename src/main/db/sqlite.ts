import Database from 'better-sqlite3'
import { join } from 'path'
import { mkdirSync } from 'fs'

let db: Database.Database | null = null

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS stocks (
  ts_code   TEXT PRIMARY KEY NOT NULL,
  symbol    TEXT NOT NULL,
  name      TEXT NOT NULL,
  area      TEXT,
  industry  TEXT,
  market    TEXT,
  list_date TEXT,
  synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stocks_name ON stocks(name);
CREATE INDEX IF NOT EXISTS idx_stocks_market ON stocks(market);
`

export function initDb(userDataPath: string): Database.Database {
  if (db) {
    return db
  }

  const dataDir = join(userDataPath, 'data')
  mkdirSync(dataDir, { recursive: true })

  const dbPath = join(dataDir, 'trading-zone.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(MIGRATION_SQL)

  return db
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.')
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

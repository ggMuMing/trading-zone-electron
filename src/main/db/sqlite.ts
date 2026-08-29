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

CREATE TABLE IF NOT EXISTS market_pool (
  ts_code   TEXT PRIMARY KEY NOT NULL,
  rank      INTEGER NOT NULL,
  synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_market_pool_rank ON market_pool(rank);

CREATE TABLE IF NOT EXISTS chart_layout (
  id         TEXT PRIMARY KEY NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chart_layout_item (
  id         TEXT PRIMARY KEY NOT NULL,
  layout_id  TEXT NOT NULL REFERENCES chart_layout(id),
  kind       TEXT NOT NULL,
  ref        TEXT NOT NULL,
  params     TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chart_layout_item_layout
  ON chart_layout_item(layout_id, sort_order);

CREATE TABLE IF NOT EXISTS indicator_script (
  id         TEXT PRIMARY KEY NOT NULL,
  title      TEXT NOT NULL,
  source     TEXT NOT NULL,
  manifest   TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`

function dropLayoutItemBuiltinUnique(database: Database.Database): void {
  const row = database
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'chart_layout_item'`)
    .get() as { sql: string } | undefined
  if (!row?.sql || !/UNIQUE\s*\(\s*layout_id\s*,\s*builtin\s*\)/i.test(row.sql)) {
    return
  }

  database.pragma('foreign_keys = OFF')
  try {
    const migrate = database.transaction(() => {
      database.exec(`
        CREATE TABLE chart_layout_item_new (
          id         TEXT PRIMARY KEY NOT NULL,
          layout_id  TEXT NOT NULL REFERENCES chart_layout(id),
          builtin    TEXT NOT NULL,
          params     TEXT NOT NULL,
          sort_order INTEGER NOT NULL
        );
        INSERT INTO chart_layout_item_new (id, layout_id, builtin, params, sort_order)
          SELECT id, layout_id, builtin, params, sort_order FROM chart_layout_item;
        DROP TABLE chart_layout_item;
        ALTER TABLE chart_layout_item_new RENAME TO chart_layout_item;
        CREATE INDEX IF NOT EXISTS idx_chart_layout_item_layout
          ON chart_layout_item(layout_id, sort_order);
      `)
    })
    migrate()
  } finally {
    database.pragma('foreign_keys = ON')
  }
}

function migrateLayoutItemKindRef(database: Database.Database): void {
  const row = database
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'chart_layout_item'`)
    .get() as { sql: string } | undefined
  if (!row?.sql) {
    return
  }
  if (/\bkind\b/i.test(row.sql) && /\bref\b/i.test(row.sql)) {
    return
  }
  if (!/\bbuiltin\b/i.test(row.sql)) {
    return
  }

  database.pragma('foreign_keys = OFF')
  try {
    const migrate = database.transaction(() => {
      database.exec(`
        CREATE TABLE chart_layout_item_new (
          id         TEXT PRIMARY KEY NOT NULL,
          layout_id  TEXT NOT NULL REFERENCES chart_layout(id),
          kind       TEXT NOT NULL,
          ref        TEXT NOT NULL,
          params     TEXT NOT NULL,
          sort_order INTEGER NOT NULL
        );
        INSERT INTO chart_layout_item_new (id, layout_id, kind, ref, params, sort_order)
          SELECT id, layout_id, 'builtin', builtin, params, sort_order FROM chart_layout_item;
        DROP TABLE chart_layout_item;
        ALTER TABLE chart_layout_item_new RENAME TO chart_layout_item;
        CREATE INDEX IF NOT EXISTS idx_chart_layout_item_layout
          ON chart_layout_item(layout_id, sort_order);
      `)
    })
    migrate()
  } finally {
    database.pragma('foreign_keys = ON')
  }
}

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
  dropLayoutItemBuiltinUnique(db)
  migrateLayoutItemKindRef(db)

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

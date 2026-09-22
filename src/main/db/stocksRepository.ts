import type { Stock, StockUpsertRow } from '../../shared/types/stock'
import { getDb } from './sqlite'

const SELECT_COLUMNS = `ts_code, symbol, name, area, industry, market, list_date,
         list_status, delist_date, synced_at`

export const stocksRepository = {
  /** 在市宇宙。选股器、行业成员、指数成分都按这份裁。 */
  listAll(): Stock[] {
    return getDb()
      .prepare(
        `SELECT ${SELECT_COLUMNS}
         FROM stocks
         WHERE list_status = 'L'
         ORDER BY ts_code`
      )
      .all() as Stock[]
  },

  listDelisted(): Stock[] {
    return getDb()
      .prepare(
        `SELECT ${SELECT_COLUMNS}
         FROM stocks
         WHERE list_status = 'D'
         ORDER BY ts_code`
      )
      .all() as Stock[]
  },

  upsertMany(stocks: StockUpsertRow[], syncedAt = new Date().toISOString()): number {
    if (stocks.length === 0) {
      return 0
    }

    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO stocks (
        ts_code, symbol, name, area, industry, market, list_date,
        list_status, delist_date, synced_at
      )
      VALUES (
        @ts_code, @symbol, @name, @area, @industry, @market, @list_date,
        @list_status, @delist_date, @synced_at
      )
      ON CONFLICT(ts_code) DO UPDATE SET
        symbol = excluded.symbol,
        name = excluded.name,
        area = excluded.area,
        industry = excluded.industry,
        market = excluded.market,
        list_date = excluded.list_date,
        list_status = excluded.list_status,
        delist_date = excluded.delist_date,
        synced_at = excluded.synced_at
    `)

    const upsert = db.transaction((rows: StockUpsertRow[]) => {
      for (const row of rows) {
        stmt.run({
          ...row,
          list_status: row.list_status ?? 'L',
          delist_date: row.delist_date ?? null,
          synced_at: syncedAt
        })
      }
      return rows.length
    })

    return upsert(stocks)
  },

  /**
   * Codes the listed endpoint stopped returning are delisted, even when the delisted endpoint
   * has not published them yet. Without this they would stay frozen in their last listed state.
   */
  markMissingAsDelisted(activeCodes: string[], syncedAt = new Date().toISOString()): number {
    if (activeCodes.length === 0) {
      return 0
    }
    const db = getDb()
    const run = db.transaction((codes: string[]) => {
      db.exec('CREATE TEMP TABLE IF NOT EXISTS _stocks_active (ts_code TEXT PRIMARY KEY)')
      db.prepare('DELETE FROM _stocks_active').run()
      const insert = db.prepare('INSERT OR IGNORE INTO _stocks_active (ts_code) VALUES (?)')
      for (const code of codes) {
        insert.run(code)
      }
      const info = db
        .prepare(
          `UPDATE stocks
             SET list_status = 'D', synced_at = ?
           WHERE list_status = 'L'
             AND ts_code NOT IN (SELECT ts_code FROM _stocks_active)`
        )
        .run(syncedAt)
      db.exec('DROP TABLE _stocks_active')
      return info.changes
    })
    return run(activeCodes)
  },

  count(): number {
    const row = getDb()
      .prepare(`SELECT COUNT(*) AS count FROM stocks WHERE list_status = 'L'`)
      .get() as { count: number }
    return row.count
  },

  countDelisted(): number {
    const row = getDb()
      .prepare(`SELECT COUNT(*) AS count FROM stocks WHERE list_status = 'D'`)
      .get() as { count: number }
    return row.count
  }
}

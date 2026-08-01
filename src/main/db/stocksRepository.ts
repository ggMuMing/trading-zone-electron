import type { Stock } from '../../shared/types/stock'
import { getDb } from './sqlite'

export const stocksRepository = {
  listAll(): Stock[] {
    return getDb()
      .prepare(
        `SELECT ts_code, symbol, name, area, industry, market, list_date, synced_at
         FROM stocks
         ORDER BY ts_code`
      )
      .all() as Stock[]
  },

  upsertMany(stocks: Omit<Stock, 'synced_at'>[], syncedAt = new Date().toISOString()): number {
    if (stocks.length === 0) {
      return 0
    }

    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO stocks (ts_code, symbol, name, area, industry, market, list_date, synced_at)
      VALUES (@ts_code, @symbol, @name, @area, @industry, @market, @list_date, @synced_at)
      ON CONFLICT(ts_code) DO UPDATE SET
        symbol = excluded.symbol,
        name = excluded.name,
        area = excluded.area,
        industry = excluded.industry,
        market = excluded.market,
        list_date = excluded.list_date,
        synced_at = excluded.synced_at
    `)

    const upsert = db.transaction((rows: Omit<Stock, 'synced_at'>[]) => {
      for (const row of rows) {
        stmt.run({ ...row, synced_at: syncedAt })
      }
      return rows.length
    })

    return upsert(stocks)
  },

  count(): number {
    const row = getDb().prepare('SELECT COUNT(*) AS count FROM stocks').get() as { count: number }
    return row.count
  }
}

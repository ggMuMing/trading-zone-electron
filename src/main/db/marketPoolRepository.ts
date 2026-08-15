import type { MarketPoolItem } from '../../shared/types/market'
import { getDb } from './sqlite'

export const marketPoolRepository = {
  replaceAll(tsCodes: string[], syncedAt = new Date().toISOString()): number {
    const db = getDb()
    const clear = db.prepare('DELETE FROM market_pool')
    const insert = db.prepare(`
      INSERT INTO market_pool (ts_code, rank, synced_at)
      VALUES (@ts_code, @rank, @synced_at)
    `)

    const run = db.transaction((codes: string[]) => {
      clear.run()
      codes.forEach((ts_code, index) => {
        insert.run({ ts_code, rank: index + 1, synced_at: syncedAt })
      })
      return codes.length
    })

    return run(tsCodes)
  },

  listWithStocks(): MarketPoolItem[] {
    return getDb()
      .prepare(
        `
        SELECT
          p.ts_code,
          p.rank,
          p.synced_at,
          s.symbol,
          s.name,
          s.industry,
          s.market
        FROM market_pool p
        LEFT JOIN stocks s ON s.ts_code = p.ts_code
        ORDER BY p.rank ASC
        `
      )
      .all() as MarketPoolItem[]
  },

  count(): number {
    const row = getDb().prepare('SELECT COUNT(*) AS count FROM market_pool').get() as {
      count: number
    }
    return row.count
  }
}

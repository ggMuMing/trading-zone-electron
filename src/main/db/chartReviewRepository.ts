import { readChartReview } from '../../shared/chartReview/readChartReview'
import type { ChartReviewDraft, ChartReviewRecord } from '../../shared/types/chartReview'
import { getDb } from './sqlite'

interface ReviewRow {
  ts_code: string
  trade_date: string
  payload: string
  updated_at: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function mapRow(row: ReviewRow): ChartReviewRecord | null {
  try {
    return {
      tsCode: row.ts_code,
      tradeDate: row.trade_date,
      draft: readChartReview(JSON.parse(row.payload) as unknown),
      updatedAt: row.updated_at
    }
  } catch {
    return null
  }
}

export const chartReviewRepository = {
  get(tsCode: string, tradeDate: string): ChartReviewRecord | null {
    const row = getDb()
      .prepare(
        `SELECT ts_code, trade_date, payload, updated_at
         FROM chart_review
         WHERE ts_code = ? AND trade_date = ?`
      )
      .get(tsCode, tradeDate) as ReviewRow | undefined
    return row ? mapRow(row) : null
  },

  dates(tsCode: string): string[] {
    const rows = getDb()
      .prepare(
        `SELECT trade_date
         FROM chart_review
         WHERE ts_code = ?
         ORDER BY trade_date ASC`
      )
      .all(tsCode) as Array<{ trade_date: string }>
    return rows.map((row) => row.trade_date)
  },

  save(tsCode: string, tradeDate: string, draft: ChartReviewDraft): ChartReviewRecord {
    const payload = readChartReview(draft)
    const updatedAt = nowIso()
    getDb()
      .prepare(
        `INSERT INTO chart_review (ts_code, trade_date, payload, updated_at)
         VALUES (@ts_code, @trade_date, @payload, @updated_at)
         ON CONFLICT(ts_code, trade_date) DO UPDATE SET
           payload = excluded.payload,
           updated_at = excluded.updated_at`
      )
      .run({
        ts_code: tsCode,
        trade_date: tradeDate,
        payload: JSON.stringify(payload),
        updated_at: updatedAt
      })
    return {
      tsCode,
      tradeDate,
      draft: payload,
      updatedAt
    }
  },

  clear(tsCode: string, tradeDate: string): void {
    getDb()
      .prepare(`DELETE FROM chart_review WHERE ts_code = ? AND trade_date = ?`)
      .run(tsCode, tradeDate)
  }
}

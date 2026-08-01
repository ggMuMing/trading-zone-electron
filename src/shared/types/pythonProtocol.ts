/** Mirror of contracts/ndjson.protocol.json + stock_list schemas. */

export interface WorkerReadyMessage {
  type: 'ready'
  imports: Record<string, boolean>
  python: string
}

export interface WorkerRequest {
  id: string
  method: string
  params?: Record<string, unknown>
}

export interface WorkerError {
  code: string
  message: string
}

export interface WorkerResponse<T = unknown> {
  id: string
  ok: boolean
  result?: T
  error?: WorkerError
}

export interface StockListParams {
  token: string
  exchange?: string
  list_status?: string
}

/** Aligned with SQLite stocks (without synced_at). */
export interface StockBasicRow {
  ts_code: string
  symbol: string
  name: string
  area: string | null
  industry: string | null
  market: string | null
  list_date: string | null
}

export interface StockListResult {
  stocks: StockBasicRow[]
  count: number
}

export const PYTHON_METHODS = {
  syncStockList: 'data.sync.stock_list'
} as const

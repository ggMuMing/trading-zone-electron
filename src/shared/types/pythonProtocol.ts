/** Mirror of contracts/msgpack.protocol.json + stock_list / market schemas. */

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

export interface MarketPoolSyncParams {
  token: string
  ts_codes: string[]
  start_date: string
  end_date: string
}

export interface MarketPoolSyncError {
  ts_code: string
  stage: string
  message: string
}

export interface MarketPoolSyncResult {
  pool_size: number
  bar_count: number
  adj_count: number
  ts_codes: string[]
  errors: MarketPoolSyncError[]
}

export interface MarketQueryParams {
  ts_code: string
  start_date: string
  end_date: string
  adjust?: 'none' | 'qfq' | 'hfq'
  limit?: number
}

export interface MarketQueryResult {
  ts_code: string
  adjust: 'none' | 'qfq' | 'hfq'
  count: number
  arrow_ipc: Uint8Array
}

export interface MarketCoverageResult {
  total_bars: number
  total_adj: number
  stock_count: number
  stocks: Array<{
    ts_code: string
    bar_count: number
    adj_count: number
    start_date: string | null
    end_date: string | null
  }>
  min_date: string | null
  max_date: string | null
  complete_days: number
  db_path: string
}

export interface MarketSyncPlanParams {
  start_date: string
  end_date: string
  token?: string
}

export interface MarketSyncPlanResult {
  start_date: string
  end_date: string
  trade_dates: string[]
  complete_dates: string[]
  pending_dates: string[]
  total_days: number
  complete_count: number
  pending_count: number
}

export interface MarketSyncDayTimings {
  wait: number
  daily: number
  upsert_daily: number
  adj: number
  upsert_adj: number
}

export interface MarketSyncDayResult {
  trade_date: string
  bar_count: number
  adj_count: number
  status: 'complete' | 'partial'
  error?: string | null
  timings_ms?: MarketSyncDayTimings
}

export interface MarketClearResult {
  ok: boolean
  db_path: string
}

export interface ComputeIndicatorInstance {
  id: string
  kind: 'script'
  ref: string
  params: Record<string, unknown>
  source: string
}

/** XOR: exactly one of `query` or `bars`. Empty query window → null ChartInput. */
export interface ComputeIndicatorParams {
  instances: ComputeIndicatorInstance[]
  query?: MarketQueryParams
  bars?: Record<string, unknown>[]
}

export const PYTHON_METHODS = {
  syncStockList: 'data.sync.stock_list',
  syncMarketPool: 'data.sync.market_pool',
  syncMarketPlan: 'data.sync.market_plan',
  syncMarketDay: 'data.sync.market_day',
  clearMarket: 'data.admin.clear_market',
  queryOhlcv: 'data.query.ohlcv',
  metaMarketCoverage: 'data.meta.market_coverage',
  computeIndicator: 'compute.indicator',
  computeScriptTry: 'compute.script_try'
} as const

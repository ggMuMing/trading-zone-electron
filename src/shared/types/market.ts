export type AdjustType = 'none' | 'qfq' | 'hfq'

export interface OhlcvBar {
  ts_code: string
  trade_date: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  vol: number | null
  amount: number | null
  adj_factor: number | null
}

export interface MarketPoolItem {
  ts_code: string
  rank: number
  symbol: string | null
  name: string | null
  industry: string | null
  market: string | null
  synced_at: string
}

export interface MarketPoolSyncError {
  ts_code: string
  stage: string
  message: string
}

export interface SyncMarketPoolResult {
  pool_size: number
  bar_count: number
  adj_count: number
  ts_codes: string[]
  stock_list_count: number
  errors: MarketPoolSyncError[]
}

export interface MarketQueryParams {
  ts_code: string
  adjust?: AdjustType
  start_date?: string
  end_date?: string
  limit?: number
}

export interface MarketQueryResult {
  ts_code: string
  adjust: AdjustType
  count: number
  bars: OhlcvBar[]
}

export interface MarketCoverageStock {
  ts_code: string
  bar_count: number
  adj_count: number
  start_date: string | null
  end_date: string | null
}

export interface MarketCoverageResult {
  total_bars: number
  total_adj: number
  stock_count: number
  stocks: MarketCoverageStock[]
  min_date: string | null
  max_date: string | null
  complete_days: number
  db_path: string
}

export type MarketSyncStage = 'stock_list' | 'plan' | 'fetch_day' | 'done'

export interface MarketSyncProgress {
  stage: MarketSyncStage
  done_days: number
  total_pending: number
  skipped_days: number
  current_date?: string
  error_count: number
  message: string
}

export interface MarketSyncStatus {
  syncing: boolean
  progress: MarketSyncProgress | null
}

export interface SyncMarketWindowResult {
  start_date: string
  end_date: string
  stock_list_count: number
  fetched_days: number
  skipped_days: number
  bar_count: number
  adj_count: number
  errors: Array<{ trade_date: string; message: string }>
}

export interface BoardStats {
  sse_main: number
  szse_main: number
  chinext: number
  star: number
  bse: number
  other: number
  total: number
}

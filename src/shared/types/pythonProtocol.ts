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
  /** Comma separated `stock_basic` statuses; the pipeline asks for `L,D`. */
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
  list_status: 'L' | 'D'
  delist_date: string | null
}

export interface StockListResult {
  stocks: StockBasicRow[]
  count: number
  listed_count: number
  delisted_count: number
  errors: string[]
}

export interface TradeCalSyncResult {
  start_date: string
  end_date: string
  open_days: number
  last_closed_trade_date: string | null
}

export interface PipelineStepRunResult {
  step_id: string
  row_count: number
  detail: string | null
  error: string | null
}

export interface PipelinePlanResult {
  step_id: string
  start_date: string
  end_date: string
  total_days: number
  complete_count: number
  pending_dates: string[]
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
  index_count?: number
  margin_count?: number
  limit_count?: number
  timings_ms?: MarketSyncDayTimings
}

export interface MarketClearResult {
  ok: boolean
  db_path: string
}

export interface IndexWeightSyncResult {
  updated_count: number
  skipped_count: number
  empty_count: number
  as_of_dates: Record<string, string>
  errors: string[]
}

export interface IndexConstituentsResult {
  index_code: string
  as_of: string | null
  con_codes: string[]
}

export type { SwIndustryWorkerResult } from './swIndustry'

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

export type StrategyParamWidget = 'int' | 'float' | 'enum'

export interface StrategyParamOption {
  value: string
  label: string
}

export interface StrategyParameter {
  name: string
  title: string
  widget: StrategyParamWidget
  default: number | string
  min?: number
  max?: number
  options?: StrategyParamOption[]
}

export interface StrategyInfo {
  id: string
  name: string
  parameters?: StrategyParameter[]
}

export interface StrategyListResult {
  strategies: StrategyInfo[]
}

export interface StrategyRunParams {
  strategy_id: string
  ts_code: string
  start_date: string
  end_date: string
  adjust?: 'none' | 'qfq' | 'hfq'
  params?: Record<string, number | string>
}

export interface StrategyStats {
  buy_count: number
  bar_count: number
  [key: string]: number | string | boolean | null
}

export interface StrategyRunResult {
  strategy_id: string
  ts_code: string
  start_date: string
  end_date: string
  adjust: 'none' | 'qfq' | 'hfq'
  stats: StrategyStats
  series: Record<string, unknown>[]
}

export const PYTHON_METHODS = {
  syncStockList: 'data.sync.stock_list',
  syncMarketPool: 'data.sync.market_pool',
  syncMarketPlan: 'data.sync.market_plan',
  syncMarketDay: 'data.sync.market_day',
  syncDashboardBackfill: 'data.sync.dashboard_backfill',
  syncIndexWeight: 'data.sync.index_weight',
  syncSwIndustry: 'data.sync.sw_industry',
  syncTradeCal: 'data.sync.trade_cal',
  syncPipelineStep: 'data.sync.pipeline_step',
  clearMarket: 'data.admin.clear_market',
  queryOhlcv: 'data.query.ohlcv',
  queryDashboard: 'data.query.dashboard',
  queryIndexConstituents: 'data.query.index_constituents',
  metaMarketCoverage: 'data.meta.market_coverage',
  metaPipelineStatus: 'data.meta.pipeline_status',
  metaPipelinePlan: 'data.meta.pipeline_plan',
  metaMarkStep: 'data.meta.mark_step',
  computeIndicator: 'compute.indicator',
  computeScriptTry: 'compute.script_try',
  strategyList: 'strategy.list',
  strategyRun: 'strategy.run'
} as const

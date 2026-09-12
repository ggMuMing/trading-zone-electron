import type { DashboardBasisProductId, DashboardBreadthUniverseId } from '../constants/dashboard'

export type DashboardIndexGroup = 'market' | 'broad'

export interface DashboardQueryParams {
  ts_code?: string
  start_date?: string
  end_date?: string
  breadth_universe?: DashboardBreadthUniverseId
}

export interface DashboardIndexQuote {
  ts_code: string
  name: string
  group: DashboardIndexGroup
  trade_date: string | null
  close: number | null
  pct_chg: number | null
  change: number | null
  vol: number | null
  /** 成交额，亿元 */
  amount: number | null
}

export interface DashboardBar {
  trade_date: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  pct_chg: number | null
  vol: number | null
  amount: number | null
}

export interface DashboardSeriesPoint {
  trade_date: string
  /** 亿元 */
  value: number | null
  /** 较上一交易日变化，亿元 */
  change: number | null
  /** 上证收盘，仅两融序列使用 */
  close: number | null
}

export interface DashboardStatBlock {
  trade_date: string | null
  value: number | null
  change: number | null
  series: DashboardSeriesPoint[]
}

export interface DashboardBreadthPoint {
  trade_date: string
  limit_up_count: number
  limit_down_count: number
}

export interface DashboardBreadth {
  trade_date: string | null
  up_count: number
  limit_up_count: number
  down_count: number
  limit_down_count: number
  flat_count: number
  histogram: number[]
  labels: string[]
  series: DashboardBreadthPoint[]
  /** Echo of request breadth_universe (default all). */
  universe?: DashboardBreadthUniverseId
  /** Latest index_weight snapshot date when universe is an index; null for all or missing data. */
  constituent_as_of?: string | null
}

export interface DashboardBasisPoint {
  trade_date: string
  fut_close: number
  spot_close: number
  basis: number
}

export interface DashboardBasisProduct {
  product: DashboardBasisProductId
  fut_code: string
  spot_code: string
  name: string
  series: DashboardBasisPoint[]
}

export interface DashboardQueryResult {
  as_of: string | null
  selected_ts_code: string
  indices: DashboardIndexQuote[]
  bars: DashboardBar[]
  margin: DashboardStatBlock
  turnover: DashboardStatBlock
  breadth: DashboardBreadth
  basis: DashboardBasisProduct[]
}

export interface DashboardBackfillResult {
  start_date: string
  end_date: string
  index_count: number
  margin_count: number
  limit_count: number
  index_fetched: boolean
  margin_fetched: boolean
  limit_days: number
  fut_count?: number
  fut_fetched?: boolean
  error?: string | null
}

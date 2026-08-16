import type { StockDailyData } from '../../api/apiType'

export const PAPER_TRADING_STORAGE_KEY = 'paper_trading_sessions_v1'

export type PaperTradingPhase = 'setup' | 'running' | 'ended' | 'review'

export type StockPickMode = 'random' | 'fixed'
export type StartDateMode = 'random' | 'fixed'

export interface PaperTradingConfig {
  initialCapital: number
  stockPickMode: StockPickMode
  fixedSymbol: string
  fixedStockName: string
  startDateMode: StartDateMode
  fixedStartDate: string
  /** 起始日之后要模拟的 K 线根数（最少 200） */
  simBarCount: number
  commissionRate: number
  stampTaxRate: number
  adjust: 'qfq' | 'hfq' | 'standard'
}

export interface PositionLot {
  quantity: number
  buyDate: string
  buyPrice: number
}

export interface PaperTradeRecord {
  id: string
  side: 'buy' | 'sell'
  tradeDate: string
  price: number
  lots: number
  shares: number
  grossAmount: number
  commission: number
  stampTax: number
  netCashDelta: number
  realizedPnl: number | null
  cashAfter: number
  sharesAfter: number
}

export interface PaperTradingRuntime {
  /** 每次开始模拟时生成，用于图表 remount，避免会话切换后布局/指标状态残留 */
  sessionKey: string
  symbol: string
  stockName: string
  fullData: StockDailyData[]
  simStartIndex: number
  /** 模拟区间最后一根 K 线在 fullData 中的下标（含） */
  simEndIndex: number
  visibleEndIndex: number
  cash: number
  lots: PositionLot[]
  trades: PaperTradeRecord[]
}

export interface PaperTradingSessionRecord {
  id: string
  savedAt: string
  endedAt: string
  config: PaperTradingConfig
  symbol: string
  stockName: string
  simStartDate: string
  simEndDate: string
  initialCapital: number
  finalEquity: number
  totalReturn: number
  returnRatePct: number
  winRatePct: number
  trades: PaperTradeRecord[]
  simStartIndex: number
  finalVisibleEndIndex: number
}

export interface PaperTradingStats {
  cash: number
  shares: number
  marketValue: number
  equity: number
  totalReturn: number
  returnRatePct: number
  /** 当前持仓成本（按剩余批次买入价 × 股数汇总） */
  positionCost: number
  /** 持仓浮盈 = 市值 − 持仓成本 */
  positionPnl: number
  /** 持仓盈亏比例 % */
  positionPnlRatePct: number
  winRatePct: number
  /** 已清仓完成的交易轮次（一次买→卖至持仓为 0） */
  closedTradeCount: number
  winCount: number
}

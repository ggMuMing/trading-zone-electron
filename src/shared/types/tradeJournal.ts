/** 一张实际交易记录。状态、持仓和净收益不入库，由成交现算。 */

export type TradeSide = 'long' | 'short'
export type TradeStyle = 'left' | 'right'
export type TradeOrderType = 'limit' | 'market'
export type TradeJournalStatus = 'planned' | 'open' | 'closed'

export interface TradeFill {
  id: string
  /** 添加顺序。同一成交日按它排序。 */
  seq: number
  /** YYYY-MM-DD */
  tradeDate: string
  price: number
  quantity: number
  fee: number
}

export interface TradeBuyFill extends TradeFill {
  firstDayPnl: number
  firstDayPnlAuto: boolean
}

export interface TradeJournalDraft {
  /** 佣金百分数。0.05 表示 0.05%。 */
  commissionPct: number
  /** 印花税百分数。0.05 表示 0.05%。 */
  stampTaxPct: number
  /** 其他费用，元。计算进场费用时当作滑点。 */
  otherFee: number
  tsCode: string
  name: string
  side: TradeSide
  style: TradeStyle
  reason: string
  sourceOrg: string
  sourcePerson: string
  entryPrice: number
  /** YYYY-MM-DD */
  entryDate: string
  /** 计划数量。费用和盈亏平衡价用它。 */
  quantity: number
  orderType: TradeOrderType
  entryFeeAuto: boolean
  entryFee: number | null
  flatExitFeeAuto: boolean
  flatExitFee: number | null
  breakevenAuto: boolean
  breakevenPrice: number | null
  reasonStillHolds: boolean
  buys: TradeBuyFill[]
  sells: TradeFill[]
}

export interface TradeJournal extends TradeJournalDraft {
  id: string
  createdAt: string
  updatedAt: string
}

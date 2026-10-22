import type { PaperPlanDraft } from './paperPlan'

/** 归档时的资金快照。结算资金是可用资金，总资产含证券市值。 */
export interface PaperArchiveCapital {
  totalAssets: number
  marketValue: number
  pnl: number
  available: number
}

export interface PaperArchiveTrade {
  id: number
  time: string
  name: string
  tsCode: string
  side: 'buy' | 'sell'
  price: number
  shares: number
  amount: number
}

/** 一次归档写入的内容。归档时间由数据库生成。 */
export interface PaperArchiveDraft {
  name: string
  template: PaperPlanDraft
  capital: PaperArchiveCapital
  /** 回放开始日，YYYY-MM-DD。 */
  startedOn: string
  /** 归档时的回放截止日，YYYY-MM-DD。 */
  endedOn: string
  /** 截止日减开始日的日历天数。 */
  durationDays: number
  trades: PaperArchiveTrade[]
}

export interface PaperArchive extends PaperArchiveDraft {
  id: string
  archivedAt: string
}

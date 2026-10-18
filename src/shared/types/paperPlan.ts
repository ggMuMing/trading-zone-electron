/** 一个模拟盘方案对应一份表单。 */

export type PaperStartMode = 'random' | 'fixed'
export type PaperSymbolCount = 'single' | 'group'
export type PaperSymbolSource = 'specified' | 'random'

export interface PaperSymbolRef {
  tsCode: string
  name: string
}

export interface PaperPlanDraft {
  name: string
  startMode: PaperStartMode
  /** 固定开始日，YYYY-MM-DD。随机模式下仍保留，便于切回。 */
  fixedDate: string
  /** 随机开始时间时，是否隐藏时间。 */
  hideStartTime: boolean
  symbolCount: PaperSymbolCount
  /** 一组标的的数量，1 到 10。单个标的时不使用。 */
  groupSize: number
  symbolSource: PaperSymbolSource
  symbols: PaperSymbolRef[]
  /** 随机标的时，是否隐藏名称和代码。 */
  hideSymbol: boolean
  /** 总资金，元。 */
  capital: number
  /** 印花税百分数。0.05 表示 0.05%。 */
  stampTaxPct: number
  /** 手续费百分数。0.025 表示 0.025%。 */
  commissionPct: number
}

export interface PaperPlan extends PaperPlanDraft {
  id: string
  updatedAt: string
}

/** 人工复盘表单。未选项为 null，不把「未选」写成否。 */

export const CHART_REVIEW_MA = [5, 20, 60, 120, 250] as const

export type ChartReviewMa = (typeof CHART_REVIEW_MA)[number]
export type ChartReviewKeyPoint = 'left' | 'none' | 'right'
export type ChartReviewRectangle = 'absent' | 'inside' | 'breakout'
export type ChartReviewVolatility = 'squeeze' | 'expand'
export type ChartReviewYesNo = 'yes' | 'no'

export interface ChartReviewDraft {
  keyPoint: ChartReviewKeyPoint | null
  rectangle: ChartReviewRectangle | null
  /** 矩形中的位置。仅 rectangle 为 inside 时保留。 */
  rectanglePosition: string | null
  /** 突破后是否回踩。仅 rectangle 为 breakout 时保留。 */
  rectangleRetest: ChartReviewYesNo | null
  volatility: ChartReviewVolatility | null
  volumeExpand: ChartReviewYesNo | null
  /** 放量倍数。仅 volumeExpand 为 yes 时保留。 */
  volumeMultiple: number | null
  aboveMa: ChartReviewMa[]
  rule2b: ChartReviewYesNo | null
  sectorLeader: ChartReviewYesNo | null
  /** 领头羊代码。仅 sectorLeader 为 yes 时保留。 */
  leaderTsCode: string | null
  /** 领头羊名称。仅 sectorLeader 为 yes 时保留。 */
  leaderName: string | null
  breakBottomFractal: ChartReviewYesNo | null
  breakdown: ChartReviewYesNo | null
  climaxVolume: ChartReviewYesNo | null
  resistance: ChartReviewYesNo | null
  /** 技术压力位说明。仅 resistance 为 yes 时保留。 */
  resistanceNote: string | null
}

export interface ChartReviewRecord {
  tsCode: string
  tradeDate: string
  draft: ChartReviewDraft
  updatedAt: string
}

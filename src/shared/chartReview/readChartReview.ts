import { ISO_DATE_PATTERN } from '../types/chart'
import {
  CHART_REVIEW_MA,
  type ChartReviewDraft,
  type ChartReviewKeyPoint,
  type ChartReviewMa,
  type ChartReviewRectangle,
  type ChartReviewVolatility,
  type ChartReviewYesNo
} from '../types/chartReview'

const KEY_POINTS: readonly ChartReviewKeyPoint[] = ['left', 'none', 'right']
const RECTANGLES: readonly ChartReviewRectangle[] = ['absent', 'inside', 'breakout']
const VOLATILITIES: readonly ChartReviewVolatility[] = ['squeeze', 'expand']
const YES_NO: readonly ChartReviewYesNo[] = ['yes', 'no']

export function emptyChartReviewDraft(): ChartReviewDraft {
  return {
    keyPoint: null,
    rectangle: null,
    rectanglePosition: null,
    rectangleRetest: null,
    volatility: null,
    volumeExpand: null,
    volumeMultiple: null,
    aboveMa: [],
    rule2b: null,
    sectorLeader: null,
    leaderTsCode: null,
    leaderName: null,
    breakBottomFractal: null,
    breakdown: null,
    climaxVolume: null,
    resistance: null,
    resistanceNote: null
  }
}

export function normalizeChartReviewDraft(input: ChartReviewDraft): ChartReviewDraft {
  const rectangle = input.rectangle
  const volumeExpand = input.volumeExpand
  const sectorLeader = input.sectorLeader
  const resistance = input.resistance
  return {
    keyPoint: input.keyPoint,
    rectangle,
    rectanglePosition: rectangle === 'inside' ? textOrNull(input.rectanglePosition) : null,
    rectangleRetest: rectangle === 'breakout' ? input.rectangleRetest : null,
    volatility: input.volatility,
    volumeExpand,
    volumeMultiple: volumeExpand === 'yes' ? finiteOrNull(input.volumeMultiple) : null,
    aboveMa: CHART_REVIEW_MA.filter((period) => input.aboveMa.includes(period)),
    rule2b: input.rule2b,
    sectorLeader,
    leaderTsCode: sectorLeader === 'yes' ? textOrNull(input.leaderTsCode) : null,
    leaderName: sectorLeader === 'yes' ? textOrNull(input.leaderName) : null,
    breakBottomFractal: input.breakBottomFractal,
    breakdown: input.breakdown,
    climaxVolume: input.climaxVolume,
    resistance,
    resistanceNote: resistance === 'yes' ? textOrNull(input.resistanceNote) : null
  }
}

export function sameChartReview(left: ChartReviewDraft, right: ChartReviewDraft): boolean {
  return JSON.stringify(normalizeChartReviewDraft(left)) === JSON.stringify(normalizeChartReviewDraft(right))
}

/** 解析并整理。选项和备注都可以空着。非法枚举仍会拒绝。 */
export function readChartReview(value: unknown): ChartReviewDraft {
  return normalizeChartReviewDraft(parseChartReviewDraft(value))
}

export function readChartReviewTsCode(params: unknown): string {
  const body = readParams(params)
  const tsCode = body.tsCode
  if (typeof tsCode !== 'string' || !tsCode.trim()) {
    throw new Error('标的无效')
  }
  return tsCode.trim()
}

export function readChartReviewKey(params: unknown): { tsCode: string; tradeDate: string } {
  const body = readParams(params)
  const tsCode = readChartReviewTsCode(params)
  const tradeDate = body.tradeDate
  if (typeof tradeDate !== 'string' || !ISO_DATE_PATTERN.test(tradeDate)) {
    throw new Error('日期无效')
  }
  return { tsCode, tradeDate }
}

function readParams(params: unknown): Record<string, unknown> {
  if (!params || typeof params !== 'object') {
    throw new Error('chartReview 参数无效')
  }
  return params as Record<string, unknown>
}

function parseChartReviewDraft(value: unknown): ChartReviewDraft {
  if (!value || typeof value !== 'object') {
    throw new Error('复盘内容无效')
  }
  const raw = value as Record<string, unknown>
  return {
    keyPoint: readChoice(raw.keyPoint, KEY_POINTS, '关键点'),
    rectangle: readChoice(raw.rectangle, RECTANGLES, '矩形'),
    rectanglePosition: readText(raw.rectanglePosition),
    rectangleRetest: readChoice(raw.rectangleRetest, YES_NO, '是否回踩'),
    volatility: readChoice(raw.volatility, VOLATILITIES, '波动率'),
    volumeExpand: readChoice(raw.volumeExpand, YES_NO, '成交量放大'),
    volumeMultiple: readMultiple(raw.volumeMultiple),
    aboveMa: readAboveMa(raw.aboveMa),
    rule2b: readChoice(raw.rule2b, YES_NO, '2B法则'),
    sectorLeader: readChoice(raw.sectorLeader, YES_NO, '板块领头羊'),
    leaderTsCode: readText(raw.leaderTsCode),
    leaderName: readText(raw.leaderName),
    breakBottomFractal: readChoice(raw.breakBottomFractal, YES_NO, '跌破底分型'),
    breakdown: readChoice(raw.breakdown, YES_NO, '破位下跌'),
    climaxVolume: readChoice(raw.climaxVolume, YES_NO, '高位放天量'),
    resistance: readChoice(raw.resistance, YES_NO, '技术压力位'),
    resistanceNote: readText(raw.resistanceNote)
  }
}

function readChoice<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string
): T | null {
  if (value == null || value === '') {
    return null
  }
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T
  }
  throw new Error(`${label}选项无效`)
}

function readText(value: unknown): string | null {
  if (value == null || value === '') {
    return null
  }
  if (typeof value !== 'string') {
    throw new Error('复盘内容无效')
  }
  return value
}

function readMultiple(value: unknown): number | null {
  if (value == null || value === '') {
    return null
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('放量倍数无效')
  }
  return value
}

function readAboveMa(value: unknown): ChartReviewMa[] {
  if (value == null) {
    return []
  }
  if (!Array.isArray(value)) {
    throw new Error('站上均线选项无效')
  }
  const periods: ChartReviewMa[] = []
  for (const item of value) {
    if (typeof item !== 'number' || !(CHART_REVIEW_MA as readonly number[]).includes(item)) {
      throw new Error('站上均线选项无效')
    }
    periods.push(item as ChartReviewMa)
  }
  return periods
}

function textOrNull(value: string | null): string | null {
  if (value == null) {
    return null
  }
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function finiteOrNull(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null
  }
  return value
}

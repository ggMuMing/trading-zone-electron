export const HEATMAP_UNIVERSE_IDS = [
  'all',
  'sse',
  'szse',
  'bse',
  'star',
  'chinext',
  '000300.SH',
  '000905.SH',
  '000852.SH',
  '930050.CSI',
  '000510.SH'
] as const

export type HeatmapUniverseId = (typeof HEATMAP_UNIVERSE_IDS)[number]

export const HEATMAP_AREA_IDS = ['circ_mv', 'total_mv', 'amount'] as const

export type HeatmapAreaId = (typeof HEATMAP_AREA_IDS)[number]

export const HEATMAP_INDUSTRY_LEVEL_IDS = ['L1', 'L2', 'L3'] as const

export type HeatmapIndustryLevel = (typeof HEATMAP_INDUSTRY_LEVEL_IDS)[number]

export interface HeatmapQueryParams {
  /** 数据截止日，`YYYYMMDD`。实际取不晚于该日的最近交易日。 */
  as_of: string
  universe: HeatmapUniverseId
  area: HeatmapAreaId
  industry_level: HeatmapIndustryLevel
  /** 空字符串表示该分级下的全部行业。 */
  industry_code: string
}

export interface HeatmapStockTile {
  ts_code: string
  name: string
  value: number
  /** 截止日收盘价。 */
  close: number | null
  pct_chg: number | null
}

/** 大块或中块。有下一级行业时股票在 children 里，否则在 stocks 里。 */
export interface HeatmapSector {
  code: string
  name: string
  value: number
  pct_chg: number | null
  children: HeatmapSector[]
  stocks: HeatmapStockTile[]
}

/** 情景二的全图：当前选中的具体行业。 */
export interface HeatmapFocus {
  code: string
  name: string
  level: HeatmapIndustryLevel
  /** 上一级具体行业。一级没有上一级。 */
  parent: { code: string; name: string; level: HeatmapIndustryLevel } | null
  pct_chg: number | null
  /** 没有下一级大块时，股票直接铺在全图里。 */
  stocks: HeatmapStockTile[]
}

export interface HeatmapQueryResult {
  as_of: string | null
  industry_level: HeatmapIndustryLevel
  focus: HeatmapFocus | null
  sectors: HeatmapSector[]
}

const LEVEL_ORDER: HeatmapIndustryLevel[] = ['L1', 'L2', 'L3']

export function nextHeatmapLevel(level: HeatmapIndustryLevel): HeatmapIndustryLevel | null {
  const index = LEVEL_ORDER.indexOf(level)
  return index >= 0 && index < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[index + 1] : null
}

export function prevHeatmapLevel(level: HeatmapIndustryLevel): HeatmapIndustryLevel | null {
  const index = LEVEL_ORDER.indexOf(level)
  return index > 0 ? LEVEL_ORDER[index - 1] : null
}

const UNIVERSE_IDS = new Set<string>(HEATMAP_UNIVERSE_IDS)
const AREA_IDS = new Set<string>(HEATMAP_AREA_IDS)
const LEVEL_IDS = new Set<string>(HEATMAP_INDUSTRY_LEVEL_IDS)

export function isHeatmapIndexUniverse(universe: HeatmapUniverseId): boolean {
  return universe.includes('.')
}

export function readHeatmapQuery(params: unknown): HeatmapQueryParams {
  if (!params || typeof params !== 'object') {
    throw new Error('heatmap:query requires params object')
  }
  const raw = params as Record<string, unknown>
  const asOf = typeof raw.as_of === 'string' ? raw.as_of.trim() : ''
  if (!/^\d{8}$/.test(asOf)) {
    throw new Error('heatmap:query as_of must be YYYYMMDD')
  }
  if (typeof raw.universe !== 'string' || !UNIVERSE_IDS.has(raw.universe)) {
    throw new Error('heatmap:query universe is invalid')
  }
  if (typeof raw.area !== 'string' || !AREA_IDS.has(raw.area)) {
    throw new Error('heatmap:query area is invalid')
  }
  if (typeof raw.industry_level !== 'string' || !LEVEL_IDS.has(raw.industry_level)) {
    throw new Error('heatmap:query industry_level is invalid')
  }
  return {
    as_of: asOf,
    universe: raw.universe as HeatmapUniverseId,
    area: raw.area as HeatmapAreaId,
    industry_level: raw.industry_level as HeatmapIndustryLevel,
    industry_code: typeof raw.industry_code === 'string' ? raw.industry_code.trim() : ''
  }
}

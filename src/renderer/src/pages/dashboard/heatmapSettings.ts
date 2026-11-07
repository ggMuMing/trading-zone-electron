import type {
  HeatmapAreaId,
  HeatmapIndustryLevel,
  HeatmapUniverseId
} from '../../../../shared/types/heatmap'

export type { HeatmapAreaId, HeatmapIndustryLevel, HeatmapUniverseId }

export const HEATMAP_UNIVERSE_OPTIONS: ReadonlyArray<{
  id: HeatmapUniverseId
  label: string
}> = [
  { id: 'all', label: '沪深京A股' },
  { id: 'sse', label: '上证A股' },
  { id: 'szse', label: '深证A股' },
  { id: 'bse', label: '北证A股' },
  { id: 'star', label: '科创板' },
  { id: 'chinext', label: '创业板' },
  { id: '000300.SH', label: '沪深300' },
  { id: '000905.SH', label: '中证500' },
  { id: '000852.SH', label: '中证1000' },
  { id: '930050.CSI', label: '中证A50' },
  { id: '000510.SH', label: '中证A500' }
]

export const HEATMAP_AREA_OPTIONS: ReadonlyArray<{ id: HeatmapAreaId; label: string }> = [
  { id: 'circ_mv', label: '流通市值' },
  { id: 'total_mv', label: '总市值' },
  { id: 'amount', label: '成交额' }
]

export const HEATMAP_INDUSTRY_LEVELS: ReadonlyArray<{
  id: HeatmapIndustryLevel
  label: string
}> = [
  { id: 'L1', label: '一级' },
  { id: 'L2', label: '二级' },
  { id: 'L3', label: '三级' }
]

export interface HeatmapSettings {
  /** 数据截止日，`YYYY-MM-DD`。 */
  asOf: string
  universe: HeatmapUniverseId
  area: HeatmapAreaId
  industryLevel: HeatmapIndustryLevel
  /** 空字符串表示该分级下的全部行业。 */
  industryCode: string
}

export function defaultHeatmapSettings(asOf: string): HeatmapSettings {
  return {
    asOf,
    universe: 'all',
    area: 'circ_mv',
    industryLevel: 'L1',
    industryCode: ''
  }
}

export function industryLevelLabel(level: HeatmapIndustryLevel): string {
  return HEATMAP_INDUSTRY_LEVELS.find((item) => item.id === level)?.label ?? '一级'
}

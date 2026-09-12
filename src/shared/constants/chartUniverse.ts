import {
  DASHBOARD_BROAD_INDICES,
  DASHBOARD_DISPLAY_INDICES,
  DASHBOARD_MARKET_INDICES
} from './dashboard'

export type ChartUniverseKind = 'all' | 'index' | 'constituents'

export interface ChartUniverseOption {
  id: string
  label: string
  kind: ChartUniverseKind
  group?: 'market' | 'broad'
  indexCode?: string
}

export const CHART_UNIVERSE_ALL = 'all'
export const CHART_UNIVERSE_INDEX_MARKET = 'index:market'
export const CHART_UNIVERSE_INDEX_BROAD = 'index:broad'

export function constituentsUniverseId(indexCode: string): string {
  return `constituents:${indexCode}`
}

export function parseConstituentsIndexCode(universeId: string): string | null {
  if (!universeId.startsWith('constituents:')) {
    return null
  }
  const code = universeId.slice('constituents:'.length).trim()
  return code || null
}

export function isIndexUniverse(universeId: string): boolean {
  return universeId === CHART_UNIVERSE_INDEX_MARKET || universeId === CHART_UNIVERSE_INDEX_BROAD
}

export const CHART_UNIVERSE_OPTIONS: ChartUniverseOption[] = [
  { id: CHART_UNIVERSE_ALL, label: '全市场', kind: 'all' },
  { id: CHART_UNIVERSE_INDEX_MARKET, label: '大盘指数', kind: 'index', group: 'market' },
  { id: CHART_UNIVERSE_INDEX_BROAD, label: '宽基指数', kind: 'index', group: 'broad' },
  ...DASHBOARD_MARKET_INDICES.map((item) => ({
    id: constituentsUniverseId(item.ts_code),
    label: item.name,
    kind: 'constituents' as const,
    group: 'market' as const,
    indexCode: item.ts_code
  })),
  ...DASHBOARD_BROAD_INDICES.map((item) => ({
    id: constituentsUniverseId(item.ts_code),
    label: item.name,
    kind: 'constituents' as const,
    group: 'broad' as const,
    indexCode: item.ts_code
  }))
]

export const CHART_UNIVERSE_INDEX_CODES = new Set(
  DASHBOARD_DISPLAY_INDICES.map((item) => item.ts_code)
)

export function isChartUniverseIndexCode(tsCode: string): boolean {
  return CHART_UNIVERSE_INDEX_CODES.has(tsCode)
}

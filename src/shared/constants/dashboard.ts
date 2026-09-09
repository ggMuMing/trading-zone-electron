export type DashboardIndexGroup = 'market' | 'broad'

export interface DashboardIndexMeta {
  ts_code: string
  name: string
  group: DashboardIndexGroup
}

export const DASHBOARD_MARKET_INDICES: DashboardIndexMeta[] = [
  { ts_code: '000001.SH', name: '上证指数', group: 'market' },
  { ts_code: '399001.SZ', name: '深证成指', group: 'market' },
  { ts_code: '399006.SZ', name: '创业板指', group: 'market' },
  { ts_code: '000680.SH', name: '科创综指', group: 'market' },
  { ts_code: '899050.BJ', name: '北证50', group: 'market' }
]

export const DASHBOARD_BROAD_INDICES: DashboardIndexMeta[] = [
  { ts_code: '000016.SH', name: '上证50', group: 'broad' },
  { ts_code: '000688.SH', name: '科创50', group: 'broad' },
  { ts_code: '399673.SZ', name: '创业板50', group: 'broad' },
  { ts_code: '000300.SH', name: '沪深300', group: 'broad' },
  { ts_code: '000905.SH', name: '中证500', group: 'broad' },
  { ts_code: '000852.SH', name: '中证1000', group: 'broad' },
  { ts_code: '932000.CSI', name: '中证2000', group: 'broad' },
  { ts_code: '930050.CSI', name: '中证A50', group: 'broad' },
  { ts_code: '000510.SH', name: '中证A500', group: 'broad' }
]

export const DASHBOARD_DISPLAY_INDICES: DashboardIndexMeta[] = [
  ...DASHBOARD_MARKET_INDICES,
  ...DASHBOARD_BROAD_INDICES
]

/** Not shown in the list; stored so query layer can replace 成指成交. */
export const DASHBOARD_VOLUME_SOURCE_CODES = ['399107.SZ', '399102.SZ'] as const

export const DASHBOARD_VOLUME_OVERRIDE: Record<string, string> = {
  '399001.SZ': '399107.SZ',
  '399006.SZ': '399102.SZ'
}

export const DASHBOARD_TURNOVER_CODES = ['000001.SH', '399107.SZ', '899050.BJ'] as const

export const DASHBOARD_DEFAULT_TS_CODE = '000001.SH'

export const DASHBOARD_ALL_INDEX_CODES: string[] = [
  ...DASHBOARD_DISPLAY_INDICES.map((item) => item.ts_code),
  ...DASHBOARD_VOLUME_SOURCE_CODES
]

export const BREADTH_BIN_LABELS = [
  '涨停',
  '涨停~5%',
  '5%~1%',
  '1%~0%',
  '平盘',
  '0%~-1%',
  '-1%~-5%',
  '-5%~跌停',
  '跌停'
] as const

/** index_daily.amount is 千元 → 亿元 */
export const AMOUNT_QIANYUAN_TO_YI = 1e5

/** margin.rzrqye is 元 → 亿元 */
export const YUAN_TO_YI = 1e8

import {
  CHART_UNIVERSE_ALL,
  CHART_UNIVERSE_DELISTED,
  CHART_UNIVERSE_INDEX_BROAD,
  CHART_UNIVERSE_INDEX_MARKET,
  parseConstituentsIndexCode,
  parseIndustryIndexCode
} from '../../../shared/constants/chartUniverse'
import {
  DASHBOARD_BROAD_INDICES,
  DASHBOARD_MARKET_INDICES,
  type DashboardIndexMeta
} from '../../../shared/constants/dashboard'
import { yyyymmddToIso } from '../../../shared/constants/market'
import type { Stock } from '../../../shared/types/stock'

export interface UniverseStockList {
  stocks: Stock[]
  caption: string | null
}

function indexMetaToStock(meta: DashboardIndexMeta): Stock {
  return {
    ts_code: meta.ts_code,
    symbol: meta.ts_code.split('.')[0] ?? meta.ts_code,
    name: meta.name,
    area: null,
    industry: null,
    market: null,
    list_date: null,
    list_status: 'L',
    delist_date: null,
    synced_at: ''
  }
}

/** 与图表页相同的分类列表。caption 只在退市数量和成分快照日期时有值。 */
export async function resolveUniverseStocks(
  universeId: string,
  listed: Stock[]
): Promise<UniverseStockList> {
  if (universeId === CHART_UNIVERSE_ALL) {
    return { stocks: listed, caption: null }
  }
  if (universeId === CHART_UNIVERSE_DELISTED) {
    const delisted = await window.api.stocks.listDelisted()
    return { stocks: delisted, caption: `退市 ${delisted.length} 只` }
  }
  if (universeId === CHART_UNIVERSE_INDEX_MARKET) {
    return { stocks: DASHBOARD_MARKET_INDICES.map(indexMetaToStock), caption: null }
  }
  if (universeId === CHART_UNIVERSE_INDEX_BROAD) {
    return { stocks: DASHBOARD_BROAD_INDICES.map(indexMetaToStock), caption: null }
  }
  const industryCode = parseIndustryIndexCode(universeId)
  if (industryCode) {
    const result = await window.api.industry.members({ index_code: industryCode })
    const codeSet = new Set(result.con_codes)
    return {
      stocks: listed.filter((stock) => codeSet.has(stock.ts_code)),
      caption: null
    }
  }
  const indexCode = parseConstituentsIndexCode(universeId)
  if (!indexCode) {
    return { stocks: listed, caption: null }
  }
  const result = await window.api.market.indexConstituents({ index_code: indexCode })
  const codeSet = new Set(result.con_codes)
  return {
    stocks: listed.filter((stock) => codeSet.has(stock.ts_code)),
    caption: result.as_of ? yyyymmddToIso(result.as_of) : null
  }
}

export function universeListEmptyHint(
  universeId: string,
  stocks: Stock[],
  loading: boolean
): string | null {
  if (loading || stocks.length > 0) {
    return null
  }
  if (parseConstituentsIndexCode(universeId) !== null) {
    return '尚无成分股数据，请到配置页更新成分股'
  }
  if (parseIndustryIndexCode(universeId) !== null) {
    return '尚无行业数据，请到配置页更新行业分类'
  }
  if (universeId === CHART_UNIVERSE_DELISTED) {
    return '尚无退市股票，请到配置页更新数据'
  }
  return null
}

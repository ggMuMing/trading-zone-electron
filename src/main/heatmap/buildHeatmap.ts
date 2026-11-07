import type { ListedIndustryMember } from '../db/swIndustryRepository'
import {
  isHeatmapIndexUniverse,
  nextHeatmapLevel,
  prevHeatmapLevel,
  type HeatmapAreaId,
  type HeatmapFocus,
  type HeatmapIndustryLevel,
  type HeatmapQueryResult,
  type HeatmapSector,
  type HeatmapStockTile,
  type HeatmapUniverseId
} from '../../shared/types/heatmap'

export interface HeatmapQuoteRow {
  ts_code: string
  pct_chg: number | null
  close: number | null
  amount: number | null
  circ_mv: number | null
  total_mv: number | null
}

export function buildHeatmap(input: {
  asOf: string | null
  universe: HeatmapUniverseId
  area: HeatmapAreaId
  industryLevel: HeatmapIndustryLevel
  industryCode: string
  members: ListedIndustryMember[]
  quotes: HeatmapQuoteRow[]
}): HeatmapQueryResult {
  const byCode = new Map(input.members.map((member) => [member.ts_code, member]))
  const rows: IndustryRow[] = []

  for (const quote of input.quotes) {
    const member = byCode.get(quote.ts_code)
    if (!member || !matchesUniverse(member.ts_code, input.universe)) {
      continue
    }
    const selected = industryOf(member, input.industryLevel)
    if (!selected.code || (input.industryCode && selected.code !== input.industryCode)) {
      continue
    }
    const value = areaValue(quote, input.area)
    if (value == null) {
      continue
    }
    rows.push({
      member,
      tile: {
        ts_code: member.ts_code,
        name: member.name.trim() || member.ts_code,
        value,
        close: finiteOrNull(quote.close),
        pct_chg: finiteOrNull(quote.pct_chg)
      }
    })
  }

  if (!input.industryCode) {
    return {
      as_of: input.asOf,
      industry_level: input.industryLevel,
      focus: null,
      sectors: buildSectors(rows, input.industryLevel, nextHeatmapLevel(input.industryLevel))
    }
  }

  const sample = rows[0]
  if (!sample) {
    return { as_of: input.asOf, industry_level: input.industryLevel, focus: null, sectors: [] }
  }
  const selected = industryOf(sample.member, input.industryLevel)
  const childLevel = nextHeatmapLevel(input.industryLevel)
  const sectors = childLevel ? buildSectors(rows, childLevel, nextHeatmapLevel(childLevel)) : []
  const stocks = childLevel ? [] : tilesOf(rows)
  return {
    as_of: input.asOf,
    industry_level: input.industryLevel,
    focus: {
      code: selected.code,
      name: selected.name || input.industryCode,
      level: input.industryLevel,
      parent: parentIndustry(sample.member, input.industryLevel),
      pct_chg: weightedPct(childLevel ? flattenSectors(sectors) : stocks),
      stocks
    },
    sectors
  }
}

interface IndustryRow {
  member: ListedIndustryMember
  tile: HeatmapStockTile
}

function buildSectors(
  rows: IndustryRow[],
  outer: HeatmapIndustryLevel,
  inner: HeatmapIndustryLevel | null
): HeatmapSector[] {
  const groups = new Map<string, { name: string; rows: IndustryRow[] }>()
  for (const row of rows) {
    const industry = industryOf(row.member, outer)
    if (!industry.code) {
      continue
    }
    const group = groups.get(industry.code) ?? { name: industry.name, rows: [] }
    group.rows.push(row)
    groups.set(industry.code, group)
  }

  const sectors: HeatmapSector[] = []
  for (const [code, group] of groups) {
    const children = inner ? buildSectors(group.rows, inner, null) : []
    const stocks = inner ? [] : tilesOf(group.rows)
    const flat = inner ? flattenSectors(children) : stocks
    const value = flat.reduce((sum, stock) => sum + stock.value, 0)
    if (value <= 0) {
      continue
    }
    sectors.push({
      code,
      name: group.name || code,
      value,
      pct_chg: weightedPct(flat),
      children,
      stocks
    })
  }
  sectors.sort((left, right) => right.value - left.value)
  return sectors
}

function tilesOf(rows: IndustryRow[]): HeatmapStockTile[] {
  return rows.map((row) => row.tile).sort((left, right) => right.value - left.value)
}

function flattenSectors(sectors: HeatmapSector[]): HeatmapStockTile[] {
  const stocks: HeatmapStockTile[] = []
  for (const sector of sectors) {
    if (sector.children.length > 0) {
      stocks.push(...flattenSectors(sector.children))
    } else {
      stocks.push(...sector.stocks)
    }
  }
  return stocks
}

function parentIndustry(
  member: ListedIndustryMember,
  level: HeatmapIndustryLevel
): HeatmapFocus['parent'] {
  const parentLevel = prevHeatmapLevel(level)
  if (!parentLevel) {
    return null
  }
  const parent = industryOf(member, parentLevel)
  if (!parent.code) {
    return null
  }
  return { code: parent.code, name: parent.name, level: parentLevel }
}

/** 按代码号段划分板块，不使用 stocks.market。 */
type AshareBoard = 'sse-main' | 'star' | 'szse-main' | 'chinext' | 'bse'

const SSE_MAIN_PREFIXES = new Set(['600', '601', '603', '605'])
const STAR_PREFIXES = new Set(['688', '689'])
const SZSE_MAIN_PREFIXES = new Set(['000', '001', '002', '003'])
const CHINEXT_PREFIXES = new Set(['300', '301', '302'])

function matchesUniverse(tsCode: string, universe: HeatmapUniverseId): boolean {
  if (isHeatmapIndexUniverse(universe)) {
    return true
  }
  const board = ashareBoard(tsCode)
  if (!board) {
    return false
  }
  if (universe === 'all') {
    return true
  }
  if (universe === 'sse') {
    return board === 'sse-main' || board === 'star'
  }
  if (universe === 'szse') {
    return board === 'szse-main' || board === 'chinext'
  }
  if (universe === 'bse') {
    return board === 'bse'
  }
  if (universe === 'star') {
    return board === 'star'
  }
  return board === 'chinext'
}

function ashareBoard(tsCode: string): AshareBoard | null {
  const dot = tsCode.lastIndexOf('.')
  if (dot <= 0) {
    return null
  }
  const symbol = tsCode.slice(0, dot)
  const exchange = tsCode.slice(dot + 1)
  const prefix = symbol.slice(0, 3)
  if (exchange === 'SH') {
    if (STAR_PREFIXES.has(prefix)) {
      return 'star'
    }
    if (SSE_MAIN_PREFIXES.has(prefix)) {
      return 'sse-main'
    }
    return null
  }
  if (exchange === 'SZ') {
    if (CHINEXT_PREFIXES.has(prefix)) {
      return 'chinext'
    }
    if (SZSE_MAIN_PREFIXES.has(prefix)) {
      return 'szse-main'
    }
    return null
  }
  if (exchange === 'BJ' && (prefix === '920' || symbol.startsWith('4') || symbol.startsWith('8'))) {
    return 'bse'
  }
  return null
}

function industryOf(
  member: ListedIndustryMember,
  level: HeatmapIndustryLevel
): { code: string; name: string } {
  if (level === 'L1') {
    return { code: member.l1_code, name: member.l1_name }
  }
  if (level === 'L2') {
    return { code: member.l2_code, name: member.l2_name }
  }
  return { code: member.l3_code, name: member.l3_name }
}

function areaValue(quote: HeatmapQuoteRow, area: HeatmapAreaId): number | null {
  const raw =
    area === 'circ_mv' ? quote.circ_mv : area === 'total_mv' ? quote.total_mv : quote.amount
  if (raw == null || !Number.isFinite(raw) || raw <= 0) {
    return null
  }
  return raw
}

function finiteOrNull(value: number | null): number | null {
  return value != null && Number.isFinite(value) ? value : null
}

function weightedPct(stocks: HeatmapStockTile[]): number | null {
  let weighted = 0
  let total = 0
  for (const stock of stocks) {
    if (stock.pct_chg == null) {
      continue
    }
    weighted += stock.pct_chg * stock.value
    total += stock.value
  }
  if (total <= 0) {
    return null
  }
  return weighted / total
}

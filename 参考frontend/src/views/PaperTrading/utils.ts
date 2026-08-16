import type { StockDailyData } from '../../api/apiType'
import type {
  PaperTradeRecord,
  PaperTradingConfig,
  PaperTradingRuntime,
  PaperTradingSessionRecord,
  PaperTradingStats,
  PositionLot,
} from './types'
import { PAPER_TRADING_STORAGE_KEY } from './types'

export const LOT_SIZE = 100
export const MIN_SIM_BAR_COUNT = 200

export function normalizeSimBarCount(value: number): number {
  return Math.max(MIN_SIM_BAR_COUNT, Math.floor(value) || MIN_SIM_BAR_COUNT)
}

export function getConfigSimBarCount(config: PaperTradingConfig): number {
  const legacy = (config as PaperTradingConfig & { lookbackBars?: number }).lookbackBars
  return normalizeSimBarCount(config.simBarCount ?? legacy ?? MIN_SIM_BAR_COUNT)
}

export function normalizeTradeDate(date: string): string {
  return date.replace(/-/g, '')
}

export function formatTradeDateDisplay(date: string): string {
  const raw = normalizeTradeDate(date)
  if (raw.length !== 8) return date
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
}

export function pickRandomItem<T>(items: T[]): T | null {
  if (items.length === 0) return null
  return items[Math.floor(Math.random() * items.length)] ?? null
}

export function resolveSimEndIndex(data: StockDailyData[], simStartIndex: number, config: PaperTradingConfig): number {
  const simBars = getConfigSimBarCount(config)
  const plannedEnd = simStartIndex + simBars - 1
  return Math.min(plannedEnd, data.length - 1)
}

export function resolveSimStartIndex(
  data: StockDailyData[],
  config: PaperTradingConfig,
): number {
  if (data.length === 0) {
    throw new Error('K 线数据为空')
  }

  const maxStartIndex = data.length - 1

  if (config.startDateMode === 'fixed' && config.fixedStartDate) {
    const target = normalizeTradeDate(config.fixedStartDate)
    const idx = data.findIndex((row) => normalizeTradeDate(row.trade_date) === target)
    if (idx < 0) throw new Error('未找到指定的起始交易日')
    return idx
  }

  const candidates: number[] = []
  for (let i = 0; i <= maxStartIndex; i += 1) {
    candidates.push(i)
  }
  const picked = pickRandomItem(candidates)
  if (picked === null) throw new Error('无法随机选择起始日期')
  return picked
}

/** 起始日之前的全部 K 线 + 已揭示的模拟 K 线 */
export function getVisibleChartData(runtime: PaperTradingRuntime): StockDailyData[] {
  return runtime.fullData.slice(0, runtime.visibleEndIndex + 1)
}

export function getCurrentBar(runtime: PaperTradingRuntime): StockDailyData | null {
  if (runtime.visibleEndIndex < runtime.simStartIndex) return null
  return runtime.fullData[runtime.visibleEndIndex] ?? null
}

export function isSimulationComplete(runtime: PaperTradingRuntime): boolean {
  return runtime.visibleEndIndex >= runtime.simEndIndex
}

export function totalShares(lots: PositionLot[]): number {
  return lots.reduce((sum, lot) => sum + lot.quantity, 0)
}

type CostLot = { quantity: number, costPerShare: number, buyDate: string }

/** 按成交记录回放持仓成本（FIFO + T+1，买入含佣金） */
export function computePositionCostFromTrades(trades: PaperTradeRecord[]): number {
  const lots: CostLot[] = []

  for (const trade of trades) {
    if (trade.side === 'buy') {
      const costPerShare = (-trade.netCashDelta) / trade.shares
      const lastIdx = lots.length - 1
      const last = lastIdx >= 0 ? lots[lastIdx] : null
      if (
        last
        && normalizeTradeDate(last.buyDate) === normalizeTradeDate(trade.tradeDate)
        && last.costPerShare === costPerShare
      ) {
        lots[lastIdx] = { ...last, quantity: last.quantity + trade.shares }
      } else {
        lots.push({
          quantity: trade.shares,
          costPerShare,
          buyDate: trade.tradeDate,
        })
      }
      continue
    }

    const current = normalizeTradeDate(trade.tradeDate)
    let remaining = trade.shares
    const nextLots: CostLot[] = []
    for (const lot of lots) {
      if (remaining <= 0) {
        nextLots.push(lot)
        continue
      }
      if (normalizeTradeDate(lot.buyDate) >= current) {
        nextLots.push(lot)
        continue
      }
      const take = Math.min(lot.quantity, remaining)
      remaining -= take
      const left = lot.quantity - take
      if (left > 0) nextLots.push({ ...lot, quantity: left })
    }
    lots.length = 0
    lots.push(...nextLots)
  }

  return lots.reduce((sum, lot) => sum + lot.quantity * lot.costPerShare, 0)
}

/**
 * 胜率：仅统计「清仓」完成的交易轮次。
 * 自开仓至 sharesAfter 归零为一轮；未清仓的买卖不计入胜率。
 */
export function computeRoundTripWinStats(trades: PaperTradeRecord[]): {
  closedTradeCount: number
  winCount: number
  winRatePct: number
} {
  let shares = 0
  let roundTripPnl = 0
  let closedTradeCount = 0
  let winCount = 0

  for (const trade of trades) {
    if (trade.side === 'buy') {
      shares += trade.shares
    } else {
      shares -= trade.shares
      roundTripPnl += trade.realizedPnl ?? 0
      if (shares === 0) {
        closedTradeCount += 1
        if (roundTripPnl > 0) winCount += 1
        roundTripPnl = 0
      }
    }
  }

  const winRatePct = closedTradeCount > 0 ? (winCount / closedTradeCount) * 100 : 0
  return { closedTradeCount, winCount, winRatePct }
}

export function calcBuyCost(price: number, lots: number, commissionRate: number) {
  const shares = lots * LOT_SIZE
  const grossAmount = price * shares
  const commission = grossAmount * commissionRate
  return { shares, grossAmount, commission, totalCost: grossAmount + commission }
}

export function calcSellNet(
  price: number,
  lots: number,
  commissionRate: number,
  stampTaxRate: number,
) {
  const shares = lots * LOT_SIZE
  const grossAmount = price * shares
  const commission = grossAmount * commissionRate
  const stampTax = grossAmount * stampTaxRate
  return { shares, grossAmount, commission, stampTax, netProceeds: grossAmount - commission - stampTax }
}

export function maxBuyableLots(cash: number, price: number, commissionRate: number): number {
  if (price <= 0 || cash <= 0) return 0
  const perLotCost = price * LOT_SIZE * (1 + commissionRate)
  return Math.floor(cash / perLotCost)
}

export function maxSellableLots(lots: PositionLot[], tradeDate: string): number {
  const current = normalizeTradeDate(tradeDate)
  const eligible = lots.filter((lot) => normalizeTradeDate(lot.buyDate) < current)
  const shares = eligible.reduce((sum, lot) => sum + lot.quantity, 0)
  return Math.floor(shares / LOT_SIZE)
}

export function executeBuy(
  runtime: PaperTradingRuntime,
  config: PaperTradingConfig,
  lots: number,
): { runtime: PaperTradingRuntime, trade: PaperTradeRecord } | { error: string } {
  const bar = getCurrentBar(runtime)
  if (!bar) return { error: '请先推进到可交易的交易日' }
  if (lots <= 0) return { error: '买入手数须大于 0' }

  const price = bar.close
  const { shares, grossAmount, commission, totalCost } = calcBuyCost(price, lots, config.commissionRate)
  if (totalCost > runtime.cash + 1e-6) return { error: '可用资金不足' }

  const tradeDate = bar.trade_date
  const nextLots = [...runtime.lots]
  const lastIdx = nextLots.length - 1
  const last = lastIdx >= 0 ? nextLots[lastIdx] : null
  if (last && normalizeTradeDate(last.buyDate) === normalizeTradeDate(tradeDate) && last.buyPrice === price) {
    nextLots[lastIdx] = { ...last, quantity: last.quantity + shares }
  } else {
    nextLots.push({ quantity: shares, buyDate: tradeDate, buyPrice: price })
  }

  const cashAfter = runtime.cash - totalCost
  const trade: PaperTradeRecord = {
    id: `${Date.now()}-buy`,
    side: 'buy',
    tradeDate,
    price,
    lots,
    shares,
    grossAmount,
    commission,
    stampTax: 0,
    netCashDelta: -totalCost,
    realizedPnl: null,
    cashAfter,
    sharesAfter: totalShares(nextLots),
  }

  return {
    runtime: {
      ...runtime,
      cash: cashAfter,
      lots: nextLots,
      trades: [...runtime.trades, trade],
    },
    trade,
  }
}

export function executeSell(
  runtime: PaperTradingRuntime,
  config: PaperTradingConfig,
  lots: number,
): { runtime: PaperTradingRuntime, trade: PaperTradeRecord } | { error: string } {
  const bar = getCurrentBar(runtime)
  if (!bar) return { error: '请先推进到可交易的交易日' }
  if (lots <= 0) return { error: '卖出手数须大于 0' }

  const maxLots = maxSellableLots(runtime.lots, bar.trade_date)
  if (lots > maxLots) return { error: `受 T+1 限制，最多可卖 ${maxLots} 手` }

  const price = bar.close
  const { shares, grossAmount, commission, stampTax, netProceeds } = calcSellNet(
    price,
    lots,
    config.commissionRate,
    config.stampTaxRate,
  )

  const tradeDate = bar.trade_date
  const current = normalizeTradeDate(tradeDate)
  let remaining = shares
  let realizedPnl = 0
  const nextLots: PositionLot[] = []

  for (const lot of runtime.lots) {
    if (remaining <= 0) {
      nextLots.push(lot)
      continue
    }
    if (normalizeTradeDate(lot.buyDate) >= current) {
      nextLots.push(lot)
      continue
    }
    const take = Math.min(lot.quantity, remaining)
    realizedPnl += (price - lot.buyPrice) * take
    remaining -= take
    const left = lot.quantity - take
    if (left > 0) nextLots.push({ ...lot, quantity: left })
  }

  const cashAfter = runtime.cash + netProceeds
  const trade: PaperTradeRecord = {
    id: `${Date.now()}-sell`,
    side: 'sell',
    tradeDate,
    price,
    lots,
    shares,
    grossAmount,
    commission,
    stampTax,
    netCashDelta: netProceeds,
    realizedPnl,
    cashAfter,
    sharesAfter: totalShares(nextLots),
  }

  return {
    runtime: {
      ...runtime,
      cash: cashAfter,
      lots: nextLots,
      trades: [...runtime.trades, trade],
    },
    trade,
  }
}

export function computeStats(
  runtime: PaperTradingRuntime,
  config: PaperTradingConfig,
): PaperTradingStats {
  const bar = getCurrentBar(runtime)
  const price = bar?.close ?? runtime.fullData[runtime.visibleEndIndex]?.close ?? 0
  const shares = totalShares(runtime.lots)
  const marketValue = shares * price
  const equity = runtime.cash + marketValue
  const totalReturn = equity - config.initialCapital
  const returnRatePct = config.initialCapital > 0 ? (totalReturn / config.initialCapital) * 100 : 0

  const positionCost = computePositionCostFromTrades(runtime.trades)
  const positionPnl = shares > 0 ? marketValue - positionCost : 0
  const positionPnlRatePct = positionCost > 0 ? (positionPnl / positionCost) * 100 : 0

  const { closedTradeCount, winCount, winRatePct } = computeRoundTripWinStats(runtime.trades)

  return {
    cash: runtime.cash,
    shares,
    marketValue,
    equity,
    totalReturn,
    returnRatePct,
    positionCost,
    positionPnl,
    positionPnlRatePct,
    winRatePct,
    closedTradeCount,
    winCount,
  }
}

export function buildTradeMarkers(trades: PaperTradeRecord[]) {
  return trades.map((trade) => ({
    time: formatTradeDateDisplay(trade.tradeDate),
    position: trade.side === 'buy' ? ('belowBar' as const) : ('aboveBar' as const),
    shape: trade.side === 'buy' ? ('arrowUp' as const) : ('arrowDown' as const),
    color: trade.side === 'buy' ? '#26a69a' : '#ef5350',
    text: trade.side === 'buy' ? '买' : '卖',
  }))
}

export function createRuntime(
  symbol: string,
  stockName: string,
  fullData: StockDailyData[],
  config: PaperTradingConfig,
  simStartIndex: number,
): PaperTradingRuntime {
  const simEndIndex = resolveSimEndIndex(fullData, simStartIndex, config)
  return {
    sessionKey: `sim-${Date.now()}`,
    symbol,
    stockName,
    fullData,
    simStartIndex,
    simEndIndex,
    visibleEndIndex: simStartIndex - 1,
    cash: config.initialCapital,
    lots: [],
    trades: [],
  }
}

export function advanceNextBar(runtime: PaperTradingRuntime): PaperTradingRuntime | null {
  if (runtime.visibleEndIndex >= runtime.simEndIndex) return null
  return { ...runtime, visibleEndIndex: runtime.visibleEndIndex + 1 }
}

export function buildSessionRecord(
  runtime: PaperTradingRuntime,
  config: PaperTradingConfig,
): PaperTradingSessionRecord {
  const stats = computeStats(runtime, config)
  const simStartDate = runtime.fullData[runtime.simStartIndex]?.trade_date ?? ''
  const simEndDate = runtime.fullData[runtime.visibleEndIndex]?.trade_date ?? ''
  return {
    id: `pt-${Date.now()}`,
    savedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    config,
    symbol: runtime.symbol,
    stockName: runtime.stockName,
    simStartDate,
    simEndDate,
    initialCapital: config.initialCapital,
    finalEquity: stats.equity,
    totalReturn: stats.totalReturn,
    returnRatePct: stats.returnRatePct,
    winRatePct: stats.winRatePct,
    trades: runtime.trades,
    simStartIndex: runtime.simStartIndex,
    finalVisibleEndIndex: runtime.visibleEndIndex,
  }
}

const MAX_SAVED_SESSIONS = 100

function stripLegacyFullData(item: unknown): PaperTradingSessionRecord | null {
  if (!item || typeof item !== 'object') return null
  const { fullData: _fullData, ...rest } = item as PaperTradingSessionRecord & { fullData?: unknown }
  return rest as PaperTradingSessionRecord
}

function writeSavedSessions(sessions: PaperTradingSessionRecord[]): { ok: true } | { ok: false, error: string } {
  let next = sessions.slice(0, MAX_SAVED_SESSIONS)
  while (next.length > 0) {
    try {
      localStorage.setItem(PAPER_TRADING_STORAGE_KEY, JSON.stringify(next))
      return { ok: true }
    } catch {
      next = next.slice(0, next.length - 1)
    }
  }
  return { ok: false, error: '本地存储空间不足，请删除部分历史记录后重试' }
}

export function loadSavedSessions(): PaperTradingSessionRecord[] {
  try {
    const raw = localStorage.getItem(PAPER_TRADING_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const cleaned = parsed
      .map(stripLegacyFullData)
      .filter((item): item is PaperTradingSessionRecord => item !== null)
    const cleanedJson = JSON.stringify(cleaned)
    if (cleanedJson.length < raw.length) {
      writeSavedSessions(cleaned)
    }
    return cleaned
  } catch {
    return []
  }
}

export function saveSessionRecord(record: PaperTradingSessionRecord): { ok: true } | { ok: false, error: string } {
  const existing = loadSavedSessions()
  const next = [record, ...existing.filter((item) => item.id !== record.id)]
  return writeSavedSessions(next)
}

export function deleteSessionRecord(id: string): void {
  const next = loadSavedSessions().filter((item) => item.id !== id)
  writeSavedSessions(next)
}

export function runtimeFromSession(
  record: PaperTradingSessionRecord,
  fullData: StockDailyData[],
): PaperTradingRuntime {
  const simEndIndex = resolveSimEndIndex(fullData, record.simStartIndex, record.config)
  return {
    sessionKey: `review-${record.id}`,
    symbol: record.symbol,
    stockName: record.stockName,
    fullData,
    simStartIndex: record.simStartIndex,
    simEndIndex,
    visibleEndIndex: record.finalVisibleEndIndex,
    cash: record.trades.length > 0
      ? record.trades[record.trades.length - 1].cashAfter
      : record.initialCapital,
    lots: [],
    trades: record.trades,
  }
}

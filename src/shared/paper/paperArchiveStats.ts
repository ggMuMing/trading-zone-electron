import type { PaperCloseBook } from './paperAccount'
import { paperArchiveReturn } from './paperArchive'
import { paperBuyCash, paperSellCash } from './paperFees'
import type { PaperArchive, PaperArchiveTrade } from '../types/paperArchive'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
/** 小于这个金额视为打平，计入失败。 */
const PNL_EPS = 1e-6

export interface PaperArchiveCurvePoint {
  /** YYYY-MM-DD */
  date: string
  /** 现金 + 持仓市值。 */
  equity: number
  /** 持仓市值。 */
  marketValue: number
  /** 持仓市值 / 总资产，限制在 0 到 1。 */
  positionRatio: number
}

export interface PaperArchiveStats {
  initialCapital: number
  /** 归档时的可用资金。 */
  settlementCapital: number
  /** 期末总资产。曲线按日重算，这个数用归档快照。 */
  totalAssets: number
  totalReturn: number | null
  /** 清仓笔数。同一标的从开仓到持仓回到 0 算一笔。 */
  closedCount: number
  winCount: number
  lossCount: number
  /** 获胜笔数 / 清仓笔数。没有清仓时为 null。 */
  winRate: number | null
  /** 资金曲线峰值回撤比例。没有曲线时为 null。 */
  maxDrawdown: number | null
  /** 持仓曾用当日收盘价计价。 */
  pricedByClose: boolean
  /** 至少有一天收盘后仍有持仓。 */
  hadPosition: boolean
  points: PaperArchiveCurvePoint[]
}

interface Holding {
  shares: number
  price: number
}

/**
 * 模拟记录的基础统计和曲线。
 * 胜负按清仓：同一标的持仓回到 0 算一笔，盈亏是这一轮卖出实收减去买入实付。盈利为胜，否则为负。
 * 资金和持仓按日收盘计价；没有收盘价时沿用最近成交价。仓位不超过 100%。
 */
export function paperArchiveStats(
  record: Pick<PaperArchive, 'template' | 'capital' | 'trades' | 'startedOn' | 'endedOn'>,
  closes: PaperCloseBook = {}
): PaperArchiveStats {
  const initial = Number.isFinite(record.template.capital) ? record.template.capital : 0
  const commissionPct = record.template.commissionPct
  const stampTaxPct = record.template.stampTaxPct
  const rounds = countClosedRounds(record.trades, commissionPct, stampTaxPct)
  const curve = buildCurve(record, closes, initial, commissionPct, stampTaxPct)
  return {
    initialCapital: initial,
    settlementCapital: record.capital.available,
    totalAssets: record.capital.totalAssets,
    totalReturn: paperArchiveReturn(record),
    closedCount: rounds.closedCount,
    winCount: rounds.winCount,
    lossCount: rounds.lossCount,
    winRate: rounds.closedCount > 0 ? rounds.winCount / rounds.closedCount : null,
    maxDrawdown: maxDrawdown(curve.points),
    pricedByClose: curve.pricedByClose,
    hadPosition: curve.hadPosition,
    points: curve.points
  }
}

function countClosedRounds(
  trades: readonly PaperArchiveTrade[],
  commissionPct: number,
  stampTaxPct: number
): { closedCount: number; winCount: number; lossCount: number } {
  const cycles = new Map<string, { buyCash: number; sellCash: number; shares: number }>()
  let closedCount = 0
  let winCount = 0
  let lossCount = 0
  for (const trade of orderTrades(trades)) {
    if (!trade.tsCode || !Number.isFinite(trade.price) || trade.shares <= 0) {
      continue
    }
    const cycle = cycles.get(trade.tsCode) ?? { buyCash: 0, sellCash: 0, shares: 0 }
    if (trade.side === 'buy') {
      cycle.shares += trade.shares
      cycle.buyCash += paperBuyCash(trade.price, trade.shares, commissionPct)
      cycles.set(trade.tsCode, cycle)
      continue
    }
    if (cycle.shares <= 0) {
      continue
    }
    cycle.sellCash += paperSellCash(trade.price, trade.shares, commissionPct, stampTaxPct)
    cycle.shares -= trade.shares
    if (cycle.shares > 0) {
      cycles.set(trade.tsCode, cycle)
      continue
    }
    const pnl = cycle.sellCash - cycle.buyCash
    closedCount += 1
    if (pnl > PNL_EPS) {
      winCount += 1
    } else {
      lossCount += 1
    }
    cycles.delete(trade.tsCode)
  }
  return { closedCount, winCount, lossCount }
}

function buildCurve(
  record: Pick<PaperArchive, 'trades' | 'startedOn' | 'endedOn'>,
  closes: PaperCloseBook,
  initial: number,
  commissionPct: number,
  stampTaxPct: number
): { points: PaperArchiveCurvePoint[]; pricedByClose: boolean; hadPosition: boolean } {
  const ordered = orderTrades(record.trades)
  const tradesByDate = new Map<string, PaperArchiveTrade[]>()
  const holdings = new Map<string, Holding>()
  let cash = initial
  for (const trade of ordered) {
    if (ISO_DATE.test(trade.time)) {
      const bucket = tradesByDate.get(trade.time)
      if (bucket) {
        bucket.push(trade)
      } else {
        tradesByDate.set(trade.time, [trade])
      }
      continue
    }
    cash = applyTrade(holdings, cash, trade, commissionPct, stampTaxPct)
  }

  const dates = new Set<string>()
  if (ISO_DATE.test(record.startedOn)) {
    // 开始日前一天放上初始资金，回撤和曲线才从起点算起。
    dates.add(previousIsoDate(record.startedOn))
    dates.add(record.startedOn)
  }
  if (ISO_DATE.test(record.endedOn)) {
    dates.add(record.endedOn)
  }
  for (const date of tradesByDate.keys()) {
    dates.add(date)
  }
  for (const series of Object.values(closes)) {
    for (const date of Object.keys(series)) {
      if (
        ISO_DATE.test(date) &&
        (!record.startedOn || date >= record.startedOn) &&
        (!record.endedOn || date <= record.endedOn)
      ) {
        dates.add(date)
      }
    }
  }

  const points: PaperArchiveCurvePoint[] = []
  let pricedByClose = false
  let hadPosition = false
  for (const date of [...dates].sort()) {
    for (const trade of tradesByDate.get(date) ?? []) {
      cash = applyTrade(holdings, cash, trade, commissionPct, stampTaxPct)
    }
    let marketValue = 0
    for (const [code, holding] of holdings) {
      if (holding.shares <= 0) {
        continue
      }
      hadPosition = true
      const close = closes[code]?.[date]
      if (typeof close === 'number' && Number.isFinite(close)) {
        holding.price = close
        pricedByClose = true
      }
      if (Number.isFinite(holding.price)) {
        marketValue += holding.price * holding.shares
      }
    }
    const equity = cash + marketValue
    const positionRatio = equity > 0 ? Math.min(1, Math.max(0, marketValue / equity)) : 0
    points.push({ date, equity, marketValue, positionRatio })
  }
  return { points, pricedByClose, hadPosition }
}

function applyTrade(
  holdings: Map<string, Holding>,
  cash: number,
  trade: PaperArchiveTrade,
  commissionPct: number,
  stampTaxPct: number
): number {
  if (!trade.tsCode || !Number.isFinite(trade.price) || trade.shares <= 0) {
    return cash
  }
  const current = holdings.get(trade.tsCode)
  if (trade.side === 'buy') {
    holdings.set(trade.tsCode, {
      shares: (current?.shares ?? 0) + trade.shares,
      price: trade.price
    })
    return cash - paperBuyCash(trade.price, trade.shares, commissionPct)
  }
  const left = (current?.shares ?? 0) - trade.shares
  if (left > 0) {
    holdings.set(trade.tsCode, { shares: left, price: trade.price })
  } else {
    holdings.delete(trade.tsCode)
  }
  return cash + paperSellCash(trade.price, trade.shares, commissionPct, stampTaxPct)
}

function maxDrawdown(points: readonly PaperArchiveCurvePoint[]): number | null {
  const first = points[0]
  if (!first) {
    return null
  }
  let peak = first.equity
  let worst = 0
  for (const point of points) {
    if (point.equity > peak) {
      peak = point.equity
    }
    if (peak > 0) {
      const drop = (peak - point.equity) / peak
      if (drop > worst) {
        worst = drop
      }
    }
  }
  return worst
}

function orderTrades(trades: readonly PaperArchiveTrade[]): PaperArchiveTrade[] {
  return [...trades].sort((a, b) => {
    const aOk = ISO_DATE.test(a.time)
    const bOk = ISO_DATE.test(b.time)
    if (aOk && bOk && a.time !== b.time) {
      return a.time < b.time ? -1 : 1
    }
    if (aOk !== bOk) {
      return aOk ? 1 : -1
    }
    return a.id - b.id
  })
}

function previousIsoDate(iso: string): string {
  const [yearText, monthText, dayText] = iso.split('-')
  const date = new Date(Number(yearText), Number(monthText) - 1, Number(dayText))
  date.setDate(date.getDate() - 1)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

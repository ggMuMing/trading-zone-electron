import { yyyymmddToIso } from '../constants/market'
import { paperPositionPnl } from './paperFees'
import { type PaperLot } from './paperPosition'

export interface PaperClosePoint {
  trade_date: string
  close: number | null
}

/** 每个标的自己的收盘价序列，键是 YYYY-MM-DD。 */
export type PaperCloseBook = Readonly<Record<string, Readonly<Record<string, number>>>>

export interface PaperValuedPosition {
  tsCode: string
  name: string
  shares: number
  /** 剩余持仓承担的成本，含手续费。 */
  cost: number
  costPrice: number | null
  /** 当前时点该标的的收盘价。这一天没有 K 线时为 null。 */
  price: number | null
  pnl: number | null
}

export interface PaperAccountSnapshot {
  cash: number
  positions: PaperValuedPosition[]
  /** 有收盘价的持仓市值之和。 */
  marketValue: number
  /** 有收盘价的持仓盈亏之和。 */
  pnl: number
  total: number
}

/** 把日线收盘价收成按交易日索引的序列。同一天以后来的为准。 */
export function closesFromBars(bars: readonly PaperClosePoint[]): Record<string, number> {
  const closes: Record<string, number> = {}
  for (const bar of bars) {
    if (bar.close == null || !Number.isFinite(bar.close)) {
      continue
    }
    closes[yyyymmddToIso(bar.trade_date)] = bar.close
  }
  return closes
}

/** 当前时点该标的的收盘价。没有这一天的 K 线就没有价格。 */
export function closeAt(book: PaperCloseBook, tsCode: string, time: string | null): number | null {
  if (!time) {
    return null
  }
  const close = book[tsCode]?.[time]
  return typeof close === 'number' && Number.isFinite(close) ? close : null
}

/**
 * 在同一个时点给全部持仓计价。
 * 价格只取该标的在这一天的收盘价，不借用当前图表的价格，也不沿用更早的收盘价。
 */
export function valuePaperAccount(input: {
  lots: readonly PaperLot[]
  cash: number
  time: string | null
  book: PaperCloseBook
  commissionPct: number
  stampTaxPct: number
}): PaperAccountSnapshot {
  const grouped = new Map<string, { name: string; shares: number; cost: number }>()
  for (const lot of input.lots) {
    if (lot.shares <= 0) {
      continue
    }
    const current = grouped.get(lot.tsCode)
    if (!current) {
      grouped.set(lot.tsCode, { name: lot.name, shares: lot.shares, cost: lot.cost })
      continue
    }
    current.shares += lot.shares
    current.cost += lot.cost
    if (!current.name && lot.name) {
      current.name = lot.name
    }
  }

  const positions: PaperValuedPosition[] = []
  let marketValue = 0
  let pnl = 0
  for (const [tsCode, position] of grouped) {
    const costPrice = position.shares > 0 ? position.cost / position.shares : null
    const price = closeAt(input.book, tsCode, input.time)
    const positionPnl =
      price === null ? null : paperPositionPnl(position.cost, price, position.shares, input.commissionPct, input.stampTaxPct)
    if (price !== null && positionPnl !== null) {
      marketValue += price * position.shares
      pnl += positionPnl
    }
    positions.push({
      tsCode,
      name: position.name,
      shares: position.shares,
      cost: position.cost,
      costPrice,
      price,
      pnl: positionPnl
    })
  }

  return {
    cash: input.cash,
    positions,
    marketValue,
    pnl,
    total: input.cash + marketValue
  }
}

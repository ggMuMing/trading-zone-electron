import { paperBuyCash } from './paperFees'

/** A 股 1 手。 */
export const PAPER_SHARE_LOT = 100

export interface PaperLot {
  tsCode: string
  name: string
  date: string | null
  shares: number
  /**
   * 该批持仓承担的成本（元）。
   * 买入时是付出的现金（含手续费）。
   * 部分卖出后，卖出所得从整笔持仓成本里扣掉，再按剩余股数摊回。
   */
  cost: number
}

export function paperFloorLot(shares: number): number {
  if (!Number.isFinite(shares) || shares < PAPER_SHARE_LOT) {
    return 0
  }
  return Math.floor(shares / PAPER_SHARE_LOT) * PAPER_SHARE_LOT
}

export function paperLotShares(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null
  }
  const qty = Number(value)
  return qty >= PAPER_SHARE_LOT && qty % PAPER_SHARE_LOT === 0 ? qty : null
}

export function paperMaxBuyShares(cash: number, priceText: string, commissionPct: number): number {
  const price = Number(priceText)
  const perShare = paperBuyCash(price, 1, commissionPct)
  if (!Number.isFinite(cash) || cash <= 0 || !(perShare > 0)) {
    return 0
  }
  return paperFloorLot(cash / perShare)
}

/** 今天买入的不能卖。`today` 是当前 K 线时间。 */
export function paperSellableShares(
  lots: readonly PaperLot[],
  today: string | null,
  tsCode: string | null
): number {
  if (!today || !tsCode) {
    return 0
  }
  const free = lots.reduce(
    (sum, lot) => sum + (lot.tsCode === tsCode && lot.date !== null && lot.date < today ? lot.shares : 0),
    0
  )
  return paperFloorLot(free)
}

export function positionCostPrice(lots: readonly PaperLot[], tsCode: string): number | null {
  let shares = 0
  let cost = 0
  for (const lot of lots) {
    if (lot.tsCode !== tsCode || lot.shares <= 0) {
      continue
    }
    shares += lot.shares
    cost += lot.cost
  }
  if (shares <= 0) {
    return null
  }
  return cost / shares
}

export function applyPaperBuy(lots: readonly PaperLot[], entry: PaperLot): PaperLot[] {
  const index = lots.findIndex((lot) => lot.tsCode === entry.tsCode && lot.date === entry.date)
  if (index < 0) {
    return [...lots, entry]
  }
  return lots.map((lot, lotIndex) =>
    lotIndex === index
      ? {
          ...lot,
          name: lot.name || entry.name,
          shares: lot.shares + entry.shares,
          cost: lot.cost + entry.cost
        }
      : lot
  )
}

/**
 * 卖掉一部分但仍有持仓时，不按股数比例削减盈亏。
 * 卖出实收从该标的全部持仓成本中扣除，再按剩余股数重算成本，
 * 使成交价上的持仓盈亏与卖出前相同。全部卖光则去掉该标的持仓。
 * 股数不够卖时返回 null。
 */
export function applyPaperSell(
  lots: readonly PaperLot[],
  input: { tsCode: string; today: string; shares: number; proceeds: number }
): PaperLot[] | null {
  let remaining = input.shares
  if (!Number.isInteger(remaining) || remaining <= 0 || input.today === '') {
    return null
  }
  const next: PaperLot[] = []
  for (const lot of lots) {
    const eligible =
      lot.tsCode === input.tsCode && lot.date !== null && lot.date < input.today && lot.shares > 0
    if (!eligible || remaining <= 0) {
      if (lot.shares > 0) {
        next.push(lot)
      }
      continue
    }
    const take = Math.min(lot.shares, remaining)
    remaining -= take
    const left = lot.shares - take
    if (left > 0) {
      next.push({ ...lot, shares: left })
    }
  }
  if (remaining > 0) {
    return null
  }
  const oldCost = lots.reduce(
    (sum, lot) => sum + (lot.tsCode === input.tsCode && lot.shares > 0 ? lot.cost : 0),
    0
  )
  const keptShares = next.reduce(
    (sum, lot) => sum + (lot.tsCode === input.tsCode && lot.shares > 0 ? lot.shares : 0),
    0
  )
  if (keptShares <= 0) {
    return next
  }
  return assignSymbolCost(next, input.tsCode, oldCost - input.proceeds)
}

function assignSymbolCost(lots: readonly PaperLot[], tsCode: string, cost: number): PaperLot[] {
  const indexes: number[] = []
  let shares = 0
  lots.forEach((lot, index) => {
    if (lot.tsCode === tsCode && lot.shares > 0) {
      indexes.push(index)
      shares += lot.shares
    }
  })
  if (shares <= 0 || indexes.length === 0) {
    return [...lots]
  }
  const next = lots.map((lot) => ({ ...lot }))
  let assigned = 0
  indexes.forEach((lotIndex, position) => {
    const lot = next[lotIndex]
    if (!lot) {
      return
    }
    if (position === indexes.length - 1) {
      next[lotIndex] = { ...lot, cost: cost - assigned }
      return
    }
    const piece = (cost * lot.shares) / shares
    assigned += piece
    next[lotIndex] = { ...lot, cost: piece }
  })
  return next
}

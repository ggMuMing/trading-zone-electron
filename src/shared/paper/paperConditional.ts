import { paperBuyCash, paperSellCash } from './paperFees'
import { applyPaperBuy, applyPaperSell, paperSellableShares, type PaperLot } from './paperPosition'

export type ConditionalOrderSide = 'buy' | 'sell'
export type ConditionalOrderStatus = 'pending' | 'filled' | 'expired'

export interface PaperConditionalOrder {
  id: number
  tsCode: string
  name: string
  side: ConditionalOrderSide
  limitPrice: number
  shares: number
  /** 从创建 K 线的下一根起，可成交的 K 线根数。超出后作废。 */
  duration: number
  createdTime: string
  status: ConditionalOrderStatus
  /** 已经判断过的最后一根 K 线。未判断过为 null。 */
  checkedThrough: string | null
}

export interface PaperTouchBar {
  time: string
  low: number
  high: number
}

export interface ConditionalFillTrade {
  time: string
  name: string
  tsCode: string
  side: ConditionalOrderSide
  price: number
  shares: number
  amount: number
}

export interface ConditionalSettlement {
  orders: readonly PaperConditionalOrder[]
  lots: readonly PaperLot[]
  capital: number
  trades: readonly ConditionalFillTrade[]
  changed: boolean
}

export function barTouchesLimit(bar: PaperTouchBar, limit: number): boolean {
  if (!Number.isFinite(limit) || limit <= 0) {
    return false
  }
  if (!Number.isFinite(bar.low) || !Number.isFinite(bar.high)) {
    return false
  }
  const price = Number(limit.toFixed(4))
  const low = Number(Math.min(bar.low, bar.high).toFixed(4))
  const high = Number(Math.max(bar.low, bar.high).toFixed(4))
  return price >= low && price <= high
}

/**
 * 若当前标的还有未判断的更早 K 线，返回那根的时间，调用方需要去补行情。
 * 只差当前这根、或没有可推进的条件单时返回 null。
 */
export function conditionalHistoryStart(
  orders: readonly PaperConditionalOrder[],
  times: readonly string[],
  currentTime: string,
  tsCode: string
): string | null {
  const currentIndex = times.indexOf(currentTime)
  if (currentIndex < 0) {
    return null
  }
  let start = currentIndex + 1
  let any = false
  for (const order of orders) {
    if (order.status !== 'pending' || order.tsCode !== tsCode) {
      continue
    }
    const createdIndex = times.indexOf(order.createdTime)
    if (createdIndex < 0 || currentIndex <= createdIndex) {
      continue
    }
    const checkedIndex = order.checkedThrough ? times.indexOf(order.checkedThrough) : createdIndex
    const from = (checkedIndex < 0 ? createdIndex : checkedIndex) + 1
    if (from <= currentIndex) {
      any = true
      if (from < start) {
        start = from
      }
    }
  }
  if (!any || start >= currentIndex) {
    return null
  }
  return times[start] ?? null
}

/**
 * 沿 K 线向前检查当前标的的条件单。
 * 未来某根 K 线的高低点包住限价时，按限价成交。
 * 创建当根不成交。持续根数用完仍未成交则作废。
 * 中间缺行情时停在那根，不跳过。
 */
export function settleConditionalOrders(input: {
  orders: readonly PaperConditionalOrder[]
  lots: readonly PaperLot[]
  capital: number
  times: readonly string[]
  currentTime: string
  tsCode: string
  quotes: ReadonlyMap<string, PaperTouchBar>
  commissionPct: number
  stampTaxPct: number
}): ConditionalSettlement {
  const currentIndex = input.times.indexOf(input.currentTime)
  if (currentIndex < 0) {
    return unchanged(input)
  }
  const pending = input.orders
    .filter((order) => order.status === 'pending' && order.tsCode === input.tsCode)
    .sort((left, right) => left.id - right.id)
  if (pending.length === 0) {
    return unchanged(input)
  }

  let start = currentIndex + 1
  for (const order of pending) {
    const createdIndex = input.times.indexOf(order.createdTime)
    if (createdIndex < 0 || currentIndex <= createdIndex) {
      continue
    }
    const checkedIndex = order.checkedThrough ? input.times.indexOf(order.checkedThrough) : createdIndex
    const from = (checkedIndex < 0 ? createdIndex : checkedIndex) + 1
    if (from < start) {
      start = from
    }
  }
  if (start > currentIndex) {
    return unchanged(input)
  }

  const orders = input.orders.map((order) => ({ ...order }))
  const byId = new Map(orders.map((order) => [order.id, order]))
  let lots = input.lots
  let capital = input.capital
  const trades: ConditionalFillTrade[] = []
  let changed = false

  for (let index = start; index <= currentIndex; index += 1) {
    const time = input.times[index]
    if (!time) {
      continue
    }
    const quote = input.quotes.get(time) ?? null
    let waitingForQuote = false
    for (const source of pending) {
      const order = byId.get(source.id)
      if (!order || order.status !== 'pending') {
        continue
      }
      const createdIndex = input.times.indexOf(order.createdTime)
      if (createdIndex < 0 || index <= createdIndex) {
        continue
      }
      const checkedIndex = order.checkedThrough ? input.times.indexOf(order.checkedThrough) : createdIndex
      if (checkedIndex >= 0 && index <= checkedIndex) {
        continue
      }
      if (index > createdIndex + order.duration) {
        order.status = 'expired'
        order.checkedThrough = time
        changed = true
        continue
      }
      if (!quote) {
        waitingForQuote = true
        continue
      }
      order.checkedThrough = time
      changed = true
      if (!barTouchesLimit(quote, order.limitPrice)) {
        continue
      }
      const filled = fillOrder(order, lots, capital, time, input.commissionPct, input.stampTaxPct)
      if (!filled) {
        continue
      }
      order.status = 'filled'
      lots = filled.lots
      capital = filled.capital
      trades.push(filled.trade)
    }
    if (waitingForQuote) {
      break
    }
  }

  if (!changed) {
    return unchanged(input)
  }
  return { orders, lots, capital, trades, changed: true }
}

function unchanged(input: {
  orders: readonly PaperConditionalOrder[]
  lots: readonly PaperLot[]
  capital: number
}): ConditionalSettlement {
  return {
    orders: input.orders,
    lots: input.lots,
    capital: input.capital,
    trades: [],
    changed: false
  }
}

function fillOrder(
  order: PaperConditionalOrder,
  lots: readonly PaperLot[],
  capital: number,
  time: string,
  commissionPct: number,
  stampTaxPct: number
): { lots: PaperLot[]; capital: number; trade: ConditionalFillTrade } | null {
  if (!Number.isInteger(order.shares) || order.shares <= 0 || !Number.isFinite(order.limitPrice)) {
    return null
  }
  if (order.side === 'buy') {
    const spent = paperBuyCash(order.limitPrice, order.shares, commissionPct)
    if (!(spent <= capital + 1e-6)) {
      return null
    }
    return {
      lots: applyPaperBuy(lots, {
        tsCode: order.tsCode,
        name: order.name,
        date: time,
        shares: order.shares,
        cost: spent
      }),
      capital: capital - spent,
      trade: {
        time,
        name: order.name,
        tsCode: order.tsCode,
        side: 'buy',
        price: order.limitPrice,
        shares: order.shares,
        amount: order.limitPrice * order.shares
      }
    }
  }
  if (paperSellableShares(lots, time, order.tsCode) < order.shares) {
    return null
  }
  const proceeds = paperSellCash(order.limitPrice, order.shares, commissionPct, stampTaxPct)
  const nextLots = applyPaperSell(lots, {
    tsCode: order.tsCode,
    today: time,
    shares: order.shares,
    proceeds
  })
  if (!nextLots) {
    return null
  }
  return {
    lots: nextLots,
    capital: capital + proceeds,
    trade: {
      time,
      name: order.name,
      tsCode: order.tsCode,
      side: 'sell',
      price: order.limitPrice,
      shares: order.shares,
      amount: order.limitPrice * order.shares
    }
  }
}

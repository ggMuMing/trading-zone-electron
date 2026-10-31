/** 手续费、印花税都是百分数：0.05 表示 0.05%。印花税只在卖出时收取。 */

export function paperFeeRate(pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) {
    return 0
  }
  return pct / 100
}

/** 买入实际支出：成交额 + 手续费。 */
export function paperBuyCash(price: number, shares: number, commissionPct: number): number {
  return price * shares * (1 + paperFeeRate(commissionPct))
}

/** 卖出实际收入：成交额 − 手续费 − 印花税。 */
export function paperSellCash(
  price: number,
  shares: number,
  commissionPct: number,
  stampTaxPct: number
): number {
  return price * shares * (1 - paperFeeRate(commissionPct) - paperFeeRate(stampTaxPct))
}

/**
 * 持仓盈亏。成本是买入时付出的现金（含手续费）。
 * 再减去按现价立刻卖出要付的手续费和印花税。
 */
export function paperPositionPnl(
  cost: number,
  price: number,
  shares: number,
  commissionPct: number,
  stampTaxPct: number
): number {
  return paperSellCash(price, shares, commissionPct, stampTaxPct) - cost
}

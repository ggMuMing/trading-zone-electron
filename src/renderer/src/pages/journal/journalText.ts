import type {
  TradeFill,
  TradeJournalStatus,
  TradeOrderType,
  TradeSide,
  TradeStyle
} from '../../../../shared/types/tradeJournal'
import type { NetPnlResult } from '../../../../shared/tradeJournal/tradeJournal'

export function sideLabel(side: TradeSide): string {
  return side === 'long' ? '做多' : '做空'
}

export function styleLabel(style: TradeStyle): string {
  return style === 'left' ? '左侧交易' : '右侧交易'
}

export function orderLabel(order: TradeOrderType): string {
  return order === 'limit' ? '限价单' : '市价单'
}

export function statusLabel(status: TradeJournalStatus): string {
  if (status === 'planned') {
    return '计划中'
  }
  if (status === 'open') {
    return '进行中'
  }
  return '已完成'
}

export function formatPrice(value: number): string {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 4 })
}

export function formatQty(value: number): string {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 4 })
}

export function formatMoney(value: number): string {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatSigned(value: number): string {
  const text = formatMoney(Math.abs(value))
  if (value > 0) {
    return `+${text}`
  }
  if (value < 0) {
    return `-${text}`
  }
  return text
}

export function formatNetPnl(result: NetPnlResult): string {
  if (result.state === 'empty') {
    return '—'
  }
  if (result.state === 'missing') {
    return '缺少行情'
  }
  return formatSigned(result.value)
}

export function formatInputNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return ''
  }
  return String(Math.round(value * 1e8) / 1e8)
}

export function compareFills(left: Pick<TradeFill, 'tradeDate' | 'seq'>, right: Pick<TradeFill, 'tradeDate' | 'seq'>): number {
  if (left.tradeDate !== right.tradeDate) {
    return left.tradeDate < right.tradeDate ? -1 : 1
  }
  return left.seq - right.seq
}

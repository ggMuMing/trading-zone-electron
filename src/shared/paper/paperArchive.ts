import { PAPER_PLAN_NAME_MAX, readPaperPlanDraft } from './paperPlan'
import type { PaperArchive, PaperArchiveCapital, PaperArchiveDraft, PaperArchiveTrade } from '../types/paperArchive'

export function paperArchiveNameError(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) {
    return '请填写归档名称'
  }
  if (trimmed.length > PAPER_PLAN_NAME_MAX) {
    return `名称不能超过 ${PAPER_PLAN_NAME_MAX} 个字`
  }
  return null
}

export function readPaperArchiveDraft(value: unknown): PaperArchiveDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('归档内容无效')
  }
  const raw = value as Record<string, unknown>
  if (typeof raw.name !== 'string') {
    throw new Error('归档内容无效')
  }
  const nameError = paperArchiveNameError(raw.name)
  if (nameError) {
    throw new Error(nameError)
  }
  return {
    name: raw.name.trim(),
    template: readPaperPlanDraft(raw.template),
    capital: readCapital(raw.capital),
    startedOn: readIsoDate(raw.startedOn, '开始时间无效'),
    endedOn: readIsoDate(raw.endedOn, '截止时间无效'),
    durationDays: readDuration(raw.startedOn, raw.endedOn, raw.durationDays),
    trades: readTrades(raw.trades)
  }
}

export function paperArchiveReturn(record: Pick<PaperArchive, 'template' | 'capital'>): number | null {
  const initial = record.template.capital
  if (!Number.isFinite(initial) || initial === 0) {
    return null
  }
  return (record.capital.totalAssets - initial) / initial
}

function readIsoDate(value: unknown, message: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00`))) {
    throw new Error(message)
  }
  return value
}

export function paperReplayDurationDays(startedOn: string, endedOn: string): number {
  const start = Date.parse(`${startedOn}T00:00:00`)
  const end = Date.parse(`${endedOn}T00:00:00`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new Error('时间区间无效')
  }
  return Math.round((end - start) / 86_400_000)
}

function readDuration(startedOn: unknown, endedOn: unknown, durationDays: unknown): number {
  if (typeof startedOn !== 'string' || typeof endedOn !== 'string') {
    throw new Error('时间区间无效')
  }
  const days = paperReplayDurationDays(startedOn, endedOn)
  if (durationDays !== days) {
    throw new Error('持续时间无效')
  }
  return days
}

function readCapital(value: unknown): PaperArchiveCapital {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('资金数据无效')
  }
  const raw = value as Record<string, unknown>
  const totalAssets = raw.totalAssets
  const marketValue = raw.marketValue
  const pnl = raw.pnl
  const available = raw.available
  if (!isMoney(totalAssets) || !isMoney(marketValue) || !isMoney(pnl) || !isMoney(available)) {
    throw new Error('资金数据无效')
  }
  return { totalAssets, marketValue, pnl, available }
}

function readTrades(value: unknown): PaperArchiveTrade[] {
  if (!Array.isArray(value)) {
    throw new Error('交易记录无效')
  }
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('交易记录无效')
    }
    const raw = item as Record<string, unknown>
    if (
      typeof raw.id !== 'number' ||
      !Number.isInteger(raw.id) ||
      typeof raw.time !== 'string' ||
      typeof raw.name !== 'string' ||
      typeof raw.tsCode !== 'string' ||
      (raw.side !== 'buy' && raw.side !== 'sell') ||
      !isMoney(raw.price) ||
      typeof raw.shares !== 'number' ||
      !Number.isInteger(raw.shares) ||
      raw.shares < 0 ||
      !isMoney(raw.amount)
    ) {
      throw new Error('交易记录无效')
    }
    return {
      id: raw.id,
      time: raw.time,
      name: raw.name,
      tsCode: raw.tsCode,
      side: raw.side,
      price: raw.price,
      shares: raw.shares,
      amount: raw.amount
    }
  })
}

function isMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

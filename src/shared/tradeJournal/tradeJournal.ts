import type {
  TradeBuyFill,
  TradeFill,
  TradeJournal,
  TradeJournalDraft,
  TradeJournalStatus,
  TradeOrderType,
  TradeSide,
  TradeStyle
} from '../types/tradeJournal'

const QTY_EPS = 1e-8

export interface PlanFeeInput {
  side: TradeSide
  entryPrice: number
  quantity: number
  commissionPct: number
  stampTaxPct: number
  otherFee: number
}

export interface PlanFeeResult {
  entryFee: number
  flatExitFee: number
  breakevenPrice: number | null
}

export interface PositionReplay {
  quantity: number
  avgCost: number | null
  totalFee: number
  realized: number
}

export type NetPnlResult =
  | { state: 'empty' }
  | { state: 'missing' }
  | { state: 'value'; value: number }

interface FillStep {
  kind: 'buy' | 'sell'
  id: string
  seq: number
  tradeDate: string
  price: number
  quantity: number
  fee: number
}

export function tradeJournalDraftOf(record: TradeJournal): TradeJournalDraft {
  return {
    commissionPct: record.commissionPct,
    stampTaxPct: record.stampTaxPct,
    otherFee: record.otherFee,
    tsCode: record.tsCode,
    name: record.name,
    side: record.side,
    style: record.style,
    reason: record.reason,
    sourceOrg: record.sourceOrg,
    sourcePerson: record.sourcePerson,
    entryPrice: record.entryPrice,
    entryDate: record.entryDate,
    quantity: record.quantity,
    orderType: record.orderType,
    entryFeeAuto: record.entryFeeAuto,
    entryFee: record.entryFee,
    flatExitFeeAuto: record.flatExitFeeAuto,
    flatExitFee: record.flatExitFee,
    breakevenAuto: record.breakevenAuto,
    breakevenPrice: record.breakevenPrice,
    reasonStillHolds: record.reasonStillHolds,
    buys: record.buys.map((fill) => ({ ...fill })),
    sells: record.sells.map((fill) => ({ ...fill }))
  }
}

/** 创建时的计划费用。编辑已保存的记录时不要再调用。 */
export function planFees(input: PlanFeeInput): PlanFeeResult | null {
  if (!(input.entryPrice > 0) || !(input.quantity > 0)) {
    return null
  }
  if (!isPercent(input.commissionPct) || !isPercent(input.stampTaxPct)) {
    return null
  }
  if (!Number.isFinite(input.otherFee) || input.otherFee < 0) {
    return null
  }
  const c = input.commissionPct / 100
  const t = input.stampTaxPct / 100
  const o = input.otherFee
  const notional = input.entryPrice * input.quantity
  const commission = notional * c
  const stamp = notional * t
  const entryFee = input.side === 'long' ? commission + o : commission + stamp + o
  const flatExitFee = input.side === 'long' ? commission + stamp : commission
  return {
    entryFee,
    flatExitFee,
    breakevenPrice: breakevenPrice(input.side, notional, input.quantity, c, t, o)
  }
}

export function firstDayPnl(side: TradeSide, price: number, quantity: number, close: number): number {
  return side === 'long' ? (close - price) * quantity : (price - close) * quantity
}

export function replayPosition(draft: Pick<TradeJournalDraft, 'side' | 'buys' | 'sells'>): PositionReplay {
  const replay = runReplay(draft)
  if (replay.error) {
    throw new Error(replay.error)
  }
  return replay.position
}

/** 这一笔若是减仓且超过当前持仓，返回原因。加仓返回 null。 */
export function closingFillError(
  draft: Pick<TradeJournalDraft, 'side' | 'buys' | 'sells'>,
  kind: 'buy' | 'sell',
  quantity: number
): string | null {
  if (!(quantity > 0) || !Number.isFinite(quantity)) {
    return '成交数量需大于 0'
  }
  if (isOpen(draft.side, kind)) {
    return null
  }
  const replay = runReplay(draft)
  if (replay.error) {
    return replay.error
  }
  if (quantity > replay.position.quantity + QTY_EPS) {
    return '减仓数量不能超过持仓'
  }
  return null
}

export function journalStatus(draft: Pick<TradeJournalDraft, 'side' | 'buys' | 'sells'>): TradeJournalStatus {
  if (draft.buys.length === 0 && draft.sells.length === 0) {
    return 'planned'
  }
  const position = replayPosition(draft)
  return position.quantity > QTY_EPS ? 'open' : 'closed'
}

export function netPnl(
  draft: Pick<TradeJournalDraft, 'side' | 'buys' | 'sells'>,
  latestClose: number | null
): NetPnlResult {
  if (draft.buys.length === 0 && draft.sells.length === 0) {
    return { state: 'empty' }
  }
  const position = replayPosition(draft)
  if (position.quantity <= QTY_EPS) {
    return { state: 'value', value: position.realized - position.totalFee }
  }
  if (latestClose == null || !Number.isFinite(latestClose) || position.avgCost == null) {
    return { state: 'missing' }
  }
  const floating =
    draft.side === 'long'
      ? (latestClose - position.avgCost) * position.quantity
      : (position.avgCost - latestClose) * position.quantity
  return { state: 'value', value: position.realized + floating - position.totalFee }
}

export function readTradeJournalDraft(value: unknown): TradeJournalDraft {
  const draft = normalizeTradeJournalDraft(parseTradeJournalDraft(value))
  const error = tradeJournalError(draft)
  if (error) {
    throw new Error(error)
  }
  return draft
}

function breakevenPrice(
  side: TradeSide,
  notional: number,
  quantity: number,
  c: number,
  t: number,
  o: number
): number | null {
  if (side === 'long') {
    const denom = quantity * (1 - c - t)
    if (denom <= 0) {
      return null
    }
    const price = (notional * (1 + c) + o) / denom
    return Number.isFinite(price) ? price : null
  }
  const numer = notional * (1 - c - t) - o
  const denom = quantity * (1 + c)
  if (denom <= 0 || numer < 0) {
    return null
  }
  const price = numer / denom
  return Number.isFinite(price) ? price : null
}

function runReplay(draft: Pick<TradeJournalDraft, 'side' | 'buys' | 'sells'>): {
  error: string | null
  position: PositionReplay
} {
  let quantity = 0
  let avgCost: number | null = null
  let totalFee = 0
  let realized = 0
  for (const event of orderedFills(draft)) {
    totalFee += event.fee
    if (isOpen(draft.side, event.kind)) {
      avgCost =
        quantity <= QTY_EPS || avgCost == null
          ? event.price
          : (quantity * avgCost + event.quantity * event.price) / (quantity + event.quantity)
      quantity += event.quantity
      continue
    }
    if (event.quantity > quantity + QTY_EPS || avgCost == null) {
      return {
        error: '减仓数量不能超过持仓',
        position: { quantity, avgCost, totalFee, realized }
      }
    }
    realized +=
      draft.side === 'long'
        ? (event.price - avgCost) * event.quantity
        : (avgCost - event.price) * event.quantity
    quantity -= event.quantity
    if (quantity <= QTY_EPS) {
      quantity = 0
      avgCost = null
    }
  }
  return { error: null, position: { quantity, avgCost, totalFee, realized } }
}

function orderedFills(draft: Pick<TradeJournalDraft, 'buys' | 'sells'>): FillStep[] {
  const steps: FillStep[] = [
    ...draft.buys.map((fill) => ({ ...fill, kind: 'buy' as const })),
    ...draft.sells.map((fill) => ({ ...fill, kind: 'sell' as const }))
  ]
  steps.sort((left, right) => {
    if (left.tradeDate !== right.tradeDate) {
      return left.tradeDate < right.tradeDate ? -1 : 1
    }
    if (left.seq !== right.seq) {
      return left.seq - right.seq
    }
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
  })
  return steps
}

function isOpen(side: TradeSide, kind: 'buy' | 'sell'): boolean {
  return side === 'long' ? kind === 'buy' : kind === 'sell'
}

function tradeJournalError(draft: TradeJournalDraft): string | null {
  if (!draft.tsCode || !draft.name) {
    return '请选择标的'
  }
  if (!isPercent(draft.commissionPct)) {
    return '佣金需为 0 到 100 的百分数'
  }
  if (!isPercent(draft.stampTaxPct)) {
    return '印花税需为 0 到 100 的百分数'
  }
  if (!Number.isFinite(draft.otherFee) || draft.otherFee < 0) {
    return '其他费用需大于等于 0'
  }
  if (!(draft.entryPrice > 0)) {
    return '进场价需大于 0'
  }
  if (!isIsoDate(draft.entryDate)) {
    return '请填写进场时间'
  }
  if (!(draft.quantity > 0)) {
    return '交易数量需大于 0'
  }
  if (!isFee(draft.entryFee)) {
    return '请填写进场费用'
  }
  if (!isFee(draft.flatExitFee)) {
    return '请填写原地出场费用'
  }
  if (draft.breakevenPrice != null && !(draft.breakevenPrice > 0)) {
    return '盈亏平衡价需大于 0'
  }
  if (!draft.breakevenAuto && !(draft.breakevenPrice != null && draft.breakevenPrice > 0)) {
    return '请填写盈亏平衡价'
  }
  const fillError = fillsError(draft)
  if (fillError) {
    return fillError
  }
  return runReplay(draft).error
}

function fillsError(draft: TradeJournalDraft): string | null {
  const ids = new Set<string>()
  for (const fill of [...draft.buys, ...draft.sells]) {
    if (!fill.id || ids.has(fill.id)) {
      return '成交记录无效'
    }
    ids.add(fill.id)
    if (!Number.isInteger(fill.seq) || fill.seq < 0) {
      return '成交记录无效'
    }
    if (!isIsoDate(fill.tradeDate)) {
      return '请填写成交时间'
    }
    if (!(fill.price > 0)) {
      return '成交价需大于 0'
    }
    if (!(fill.quantity > 0)) {
      return '成交数量需大于 0'
    }
    if (!Number.isFinite(fill.fee) || fill.fee < 0) {
      return '成交费用需大于等于 0'
    }
  }
  for (const fill of draft.buys) {
    if (!Number.isFinite(fill.firstDayPnl)) {
      return '请填写入场首日盈亏'
    }
  }
  return null
}

function isFee(value: number | null): value is number {
  return value != null && Number.isFinite(value) && value >= 0
}

function isPercent(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

function normalizeTradeJournalDraft(draft: TradeJournalDraft): TradeJournalDraft {
  return {
    ...draft,
    tsCode: draft.tsCode.trim(),
    name: draft.name.trim(),
    reason: draft.reason.trim(),
    sourceOrg: draft.sourceOrg.trim(),
    sourcePerson: draft.sourcePerson.trim(),
    buys: draft.buys.map((fill) => ({ ...fill, id: fill.id.trim() })),
    sells: draft.sells.map((fill) => ({ ...fill, id: fill.id.trim() }))
  }
}

function parseTradeJournalDraft(value: unknown): TradeJournalDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('交易记录无效')
  }
  const raw = value as Record<string, unknown>
  const side = raw.side
  const style = raw.style
  const orderType = raw.orderType
  const entryFee = readNullableNumber(raw.entryFee)
  const flatExitFee = readNullableNumber(raw.flatExitFee)
  const breakevenPrice = readNullableNumber(raw.breakevenPrice)
  if (
    typeof raw.commissionPct !== 'number' ||
    typeof raw.stampTaxPct !== 'number' ||
    typeof raw.otherFee !== 'number' ||
    typeof raw.tsCode !== 'string' ||
    typeof raw.name !== 'string' ||
    (side !== 'long' && side !== 'short') ||
    (style !== 'left' && style !== 'right') ||
    typeof raw.reason !== 'string' ||
    typeof raw.sourceOrg !== 'string' ||
    typeof raw.sourcePerson !== 'string' ||
    typeof raw.entryPrice !== 'number' ||
    typeof raw.entryDate !== 'string' ||
    typeof raw.quantity !== 'number' ||
    (orderType !== 'limit' && orderType !== 'market') ||
    typeof raw.entryFeeAuto !== 'boolean' ||
    entryFee === undefined ||
    typeof raw.flatExitFeeAuto !== 'boolean' ||
    flatExitFee === undefined ||
    typeof raw.breakevenAuto !== 'boolean' ||
    breakevenPrice === undefined ||
    typeof raw.reasonStillHolds !== 'boolean' ||
    !Array.isArray(raw.buys) ||
    !Array.isArray(raw.sells)
  ) {
    throw new Error('交易记录无效')
  }
  return {
    commissionPct: raw.commissionPct,
    stampTaxPct: raw.stampTaxPct,
    otherFee: raw.otherFee,
    tsCode: raw.tsCode,
    name: raw.name,
    side,
    style: style as TradeStyle,
    reason: raw.reason,
    sourceOrg: raw.sourceOrg,
    sourcePerson: raw.sourcePerson,
    entryPrice: raw.entryPrice,
    entryDate: raw.entryDate,
    quantity: raw.quantity,
    orderType: orderType as TradeOrderType,
    entryFeeAuto: raw.entryFeeAuto,
    entryFee,
    flatExitFeeAuto: raw.flatExitFeeAuto,
    flatExitFee,
    breakevenAuto: raw.breakevenAuto,
    breakevenPrice,
    reasonStillHolds: raw.reasonStillHolds,
    buys: raw.buys.map(parseBuyFill),
    sells: raw.sells.map(parseSellFill)
  }
}

function parseSellFill(value: unknown): TradeFill {
  const fill = parseFill(value)
  if (!fill) {
    throw new Error('交易记录无效')
  }
  return fill
}

function parseBuyFill(value: unknown): TradeBuyFill {
  const fill = parseFill(value)
  if (!fill || !value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('交易记录无效')
  }
  const raw = value as Record<string, unknown>
  if (typeof raw.firstDayPnl !== 'number' || typeof raw.firstDayPnlAuto !== 'boolean') {
    throw new Error('交易记录无效')
  }
  return { ...fill, firstDayPnl: raw.firstDayPnl, firstDayPnlAuto: raw.firstDayPnlAuto }
}

function parseFill(value: unknown): TradeFill | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const raw = value as Record<string, unknown>
  if (
    typeof raw.id !== 'string' ||
    typeof raw.seq !== 'number' ||
    typeof raw.tradeDate !== 'string' ||
    typeof raw.price !== 'number' ||
    typeof raw.quantity !== 'number' ||
    typeof raw.fee !== 'number'
  ) {
    return null
  }
  return {
    id: raw.id,
    seq: raw.seq,
    tradeDate: raw.tradeDate,
    price: raw.price,
    quantity: raw.quantity,
    fee: raw.fee
  }
}

function readNullableNumber(value: unknown): number | null | undefined {
  if (value == null) {
    return null
  }
  if (typeof value !== 'number') {
    return undefined
  }
  return value
}

import { todayYyyymmdd, yyyymmddToIso } from '../constants/market'
import type { PaperPlan, PaperPlanDraft, PaperSymbolRef } from '../types/paperPlan'

export const PAPER_GROUP_SIZE_MAX = 10
export const PAPER_PLAN_NAME_MAX = 40
export const PAPER_CAPITAL_MAX = 1_000_000_000_000
export const PAPER_DEFAULT_PLAN_NAME = '缺省方案'

export function defaultPaperPlanDraft(name: string): PaperPlanDraft {
  return {
    name,
    startMode: 'random',
    fixedDate: yyyymmddToIso(todayYyyymmdd()),
    hideStartTime: false,
    symbolCount: 'single',
    groupSize: 5,
    bundleGroupId: '',
    symbolSource: 'random',
    symbols: [],
    hideSymbol: false,
    capital: 100_000,
    stampTaxPct: 0.05,
    commissionPct: 0.025
  }
}

export function paperPlanDraftOf(plan: PaperPlan): PaperPlanDraft {
  return {
    name: plan.name,
    startMode: plan.startMode,
    fixedDate: plan.fixedDate,
    hideStartTime: plan.hideStartTime,
    symbolCount: plan.symbolCount,
    groupSize: plan.groupSize,
    bundleGroupId: plan.bundleGroupId,
    symbolSource: plan.symbolSource,
    symbols: plan.symbols.map((symbol) => ({ ...symbol })),
    hideSymbol: plan.hideSymbol,
    capital: plan.capital,
    stampTaxPct: plan.stampTaxPct,
    commissionPct: plan.commissionPct
  }
}

export function paperPlanDraftsEqual(left: PaperPlanDraft, right: PaperPlanDraft): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function paperPlanError(draft: PaperPlanDraft): string | null {
  const name = draft.name.trim()
  if (!name) {
    return '请填写方案名称'
  }
  if (name.length > PAPER_PLAN_NAME_MAX) {
    return `方案名称不超过 ${PAPER_PLAN_NAME_MAX} 个字`
  }
  if (draft.startMode === 'fixed' && !isIsoDate(draft.fixedDate)) {
    return '请选择固定日期'
  }
  if (draft.symbolCount === 'group' && !isGroupSize(draft.groupSize)) {
    return `一组标的数量为 1 到 ${PAPER_GROUP_SIZE_MAX}`
  }
  if (draft.symbolCount === 'bundle') {
    if (!draft.bundleGroupId.trim()) {
      return '请选择分组'
    }
    if (draft.symbols.length === 0) {
      return '请至少保留 1 个标的'
    }
    const codes = new Set<string>()
    for (const symbol of draft.symbols) {
      const code = symbol.tsCode.trim()
      if (!code || !symbol.name.trim()) {
        return '标的无效'
      }
      if (codes.has(code)) {
        return '标的不能重复'
      }
      codes.add(code)
    }
  } else if (draft.symbolSource === 'specified') {
    const limit = draft.symbolCount === 'single' ? 1 : draft.groupSize
    if (!isGroupSize(limit) || draft.symbols.length !== limit) {
      return draft.symbolCount === 'single' ? '请指定 1 个标的' : `请指定 ${limit} 个标的`
    }
    const codes = new Set<string>()
    for (const symbol of draft.symbols) {
      const code = symbol.tsCode.trim()
      if (!code || !symbol.name.trim()) {
        return '标的无效'
      }
      if (codes.has(code)) {
        return '标的不能重复'
      }
      codes.add(code)
    }
  }
  if (!Number.isFinite(draft.capital) || draft.capital <= 0 || draft.capital > PAPER_CAPITAL_MAX) {
    return '总资金需大于 0'
  }
  if (!isPercent(draft.stampTaxPct)) {
    return '印花税需为 0 到 100 的百分数'
  }
  if (!isPercent(draft.commissionPct)) {
    return '手续费需为 0 到 100 的百分数'
  }
  return null
}

export function paperMasksSymbol(
  draft: Pick<PaperPlanDraft, 'symbolCount' | 'symbolSource' | 'hideSymbol'>
): boolean {
  if (!draft.hideSymbol) {
    return false
  }
  return draft.symbolCount === 'bundle' || draft.symbolSource === 'random'
}

export function normalizePaperPlanDraft(draft: PaperPlanDraft): PaperPlanDraft {
  const limit = draft.symbolCount === 'single' ? 1 : draft.groupSize
  const symbols: PaperSymbolRef[] =
    draft.symbolCount === 'bundle'
      ? draft.symbols.map((symbol) => ({
          tsCode: symbol.tsCode.trim(),
          name: symbol.name.trim()
        }))
      : draft.symbolSource === 'specified'
        ? draft.symbols.slice(0, limit).map((symbol) => ({
            tsCode: symbol.tsCode.trim(),
            name: symbol.name.trim()
          }))
        : []
  return {
    name: draft.name.trim(),
    startMode: draft.startMode,
    fixedDate: draft.fixedDate,
    hideStartTime: draft.hideStartTime,
    symbolCount: draft.symbolCount,
    groupSize: isGroupSize(draft.groupSize) ? draft.groupSize : 5,
    bundleGroupId: draft.bundleGroupId.trim(),
    symbolSource: draft.symbolCount === 'bundle' ? 'specified' : draft.symbolSource,
    symbols,
    hideSymbol: draft.hideSymbol,
    capital: draft.capital,
    stampTaxPct: draft.stampTaxPct,
    commissionPct: draft.commissionPct
  }
}

export function readPaperPlanDraft(value: unknown): PaperPlanDraft {
  const draft = parsePaperPlanDraft(value)
  const error = paperPlanError(draft)
  if (error) {
    throw new Error(error)
  }
  return normalizePaperPlanDraft(draft)
}

function isGroupSize(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= PAPER_GROUP_SIZE_MAX
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

function parsePaperPlanDraft(value: unknown): PaperPlanDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('方案内容无效')
  }
  const raw = value as Record<string, unknown>
  if (
    typeof raw.name !== 'string' ||
    (raw.startMode !== 'random' && raw.startMode !== 'fixed') ||
    typeof raw.fixedDate !== 'string' ||
    typeof raw.hideStartTime !== 'boolean' ||
    (raw.symbolCount !== 'single' && raw.symbolCount !== 'group' && raw.symbolCount !== 'bundle') ||
    typeof raw.groupSize !== 'number' ||
    (raw.symbolSource !== 'specified' && raw.symbolSource !== 'random') ||
    typeof raw.hideSymbol !== 'boolean' ||
    typeof raw.capital !== 'number' ||
    typeof raw.stampTaxPct !== 'number' ||
    typeof raw.commissionPct !== 'number' ||
    !Array.isArray(raw.symbols)
  ) {
    throw new Error('方案内容无效')
  }
  const symbols: PaperSymbolRef[] = []
  for (const item of raw.symbols) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('方案内容无效')
    }
    const row = item as Record<string, unknown>
    if (typeof row.tsCode !== 'string' || typeof row.name !== 'string') {
      throw new Error('方案内容无效')
    }
    symbols.push({ tsCode: row.tsCode, name: row.name })
  }
  return {
    name: raw.name,
    startMode: raw.startMode,
    fixedDate: raw.fixedDate,
    hideStartTime: raw.hideStartTime,
    symbolCount: raw.symbolCount,
    groupSize: raw.groupSize,
    bundleGroupId: typeof raw.bundleGroupId === 'string' ? raw.bundleGroupId : '',
    symbolSource: raw.symbolSource,
    symbols,
    hideSymbol: raw.hideSymbol,
    capital: raw.capital,
    stampTaxPct: raw.stampTaxPct,
    commissionPct: raw.commissionPct
  }
}

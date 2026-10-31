import {
  RESERVED_CATEGORY_NAMES,
  SYMBOL_GROUP_NAME_MAX,
  type SaveSymbolGroupHitsParams,
  type SymbolRef
} from '../types/symbolGroup'

const RESERVED = new Set<string>(RESERVED_CATEGORY_NAMES)

export function normalizeSymbolGroupName(value: string): string {
  return value.trim()
}

export function symbolGroupNameError(name: string, kind: 'category' | 'group'): string | null {
  const trimmed = normalizeSymbolGroupName(name)
  if (!trimmed) {
    return kind === 'category' ? '请填写分类名称' : '请填写分组名称'
  }
  if ([...trimmed].length > SYMBOL_GROUP_NAME_MAX) {
    return `名称不超过 ${SYMBOL_GROUP_NAME_MAX} 个字`
  }
  if (kind === 'category' && RESERVED.has(trimmed)) {
    return '该名称已保留'
  }
  return null
}

export function assertSymbolGroupName(name: string, kind: 'category' | 'group'): string {
  const error = symbolGroupNameError(name, kind)
  if (error) {
    throw new Error(error)
  }
  return normalizeSymbolGroupName(name)
}

/** 同一分类下重名时追加 ` (2)`。超长时先截断主体再加后缀。 */
export function allocateUniqueGroupName(base: string, taken: ReadonlySet<string>): string {
  const trimmed = assertSymbolGroupName(base, 'group')
  if (!taken.has(trimmed)) {
    return trimmed
  }
  for (let index = 2; index < 1000; index += 1) {
    const suffix = ` (${index})`
    const room = SYMBOL_GROUP_NAME_MAX - [...suffix].length
    const stem = [...trimmed].slice(0, Math.max(1, room)).join('').trimEnd()
    const candidate = `${stem}${suffix}`
    if ([...candidate].length > SYMBOL_GROUP_NAME_MAX) {
      continue
    }
    if (!taken.has(candidate)) {
      return candidate
    }
  }
  throw new Error('分组名称无法分配')
}

export function screenGroupName(signalIso: string, strategyName: string): string {
  const date = signalIso.trim()
  const strategy = strategyName.trim() || '策略'
  const prefix = `${date}_`
  const room = SYMBOL_GROUP_NAME_MAX - [...prefix].length
  if (room < 1) {
    return [...date].slice(0, SYMBOL_GROUP_NAME_MAX).join('')
  }
  return `${prefix}${[...strategy].slice(0, room).join('')}`
}

export function readSymbolRefs(value: unknown): SymbolRef[] {
  if (!Array.isArray(value)) {
    throw new Error('标的列表无效')
  }
  const seen = new Set<string>()
  const symbols: SymbolRef[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('标的无效')
    }
    const row = item as Record<string, unknown>
    if (typeof row.tsCode !== 'string' || typeof row.name !== 'string') {
      throw new Error('标的无效')
    }
    const tsCode = row.tsCode.trim()
    const name = row.name.trim()
    if (!tsCode || !name) {
      throw new Error('标的无效')
    }
    if (seen.has(tsCode)) {
      continue
    }
    seen.add(tsCode)
    symbols.push({ tsCode, name })
  }
  return symbols
}

export function readSaveSymbolGroupHits(params: unknown): SaveSymbolGroupHitsParams {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new Error('保存参数无效')
  }
  const raw = params as Record<string, unknown>
  if (typeof raw.name !== 'string') {
    throw new Error('请填写分组名称')
  }
  const categoryId = readOptionalCategoryId(raw.categoryId)
  if (typeof raw.makeDefault !== 'boolean') {
    throw new Error('默认分类参数无效')
  }
  const symbols = readSymbolRefs(raw.symbols)
  if (symbols.length === 0) {
    throw new Error('没有可保存的标的')
  }
  return {
    name: raw.name,
    categoryId,
    symbols,
    makeDefault: raw.makeDefault
  }
}

export function readOptionalCategoryId(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null
  }
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('分类无效')
  }
  return value.trim()
}

export function readRequiredId(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(message)
  }
  return value.trim()
}

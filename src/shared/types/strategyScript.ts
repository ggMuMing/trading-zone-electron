/** User-authored strategy scripts. Catalog id is `script:` plus this row id. */

import type { MarketQueryParams } from './market'
import type { StrategyParameter, StrategyParamWidget } from './pythonProtocol'

export const STRATEGY_SCRIPT_PREFIX = 'script:'

export function strategyScriptPublicId(id: string): string {
  return `${STRATEGY_SCRIPT_PREFIX}${id}`
}

export function strategyScriptStorageId(publicId: string): string | null {
  if (!publicId.startsWith(STRATEGY_SCRIPT_PREFIX)) {
    return null
  }
  const id = publicId.slice(STRATEGY_SCRIPT_PREFIX.length).trim()
  return id || null
}

export interface StrategyScriptManifest {
  parameters: StrategyParameter[]
}

export interface StrategyScript {
  id: string
  title: string
  source: string
  manifest: StrategyParameter[]
  updatedAt: string
}

export interface StrategyScriptTryParams {
  source: string
  params?: Record<string, number | string>
  query?: MarketQueryParams
}

export interface StrategyScriptTryResult {
  ok: boolean
  error?: string
  traceback?: string
  line?: number | null
  column?: number | null
  manifest?: StrategyScriptManifest
  buy_count?: number
  sell_count?: number
  bar_count?: number
}

export function readStrategyParameters(raw: unknown): StrategyParameter[] {
  if (!Array.isArray(raw)) {
    throw new Error('strategy manifest must be an array')
  }
  return raw.map((item, index) => readStrategyParameter(item, index))
}

export function readStrategyManifest(raw: unknown): StrategyScriptManifest {
  if (!raw || typeof raw !== 'object' || !('parameters' in raw)) {
    throw new Error('strategy manifest must include parameters')
  }
  return {
    parameters: readStrategyParameters((raw as { parameters: unknown }).parameters)
  }
}

function readStrategyParameter(raw: unknown, index: number): StrategyParameter {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`strategy manifest[${index}] must be an object`)
  }
  const item = raw as Record<string, unknown>
  const widget = item.widget
  if (widget !== 'int' && widget !== 'float' && widget !== 'enum') {
    throw new Error(`strategy manifest[${index}].widget is invalid`)
  }
  if (typeof item.name !== 'string' || !item.name) {
    throw new Error(`strategy manifest[${index}].name is required`)
  }
  if (typeof item.title !== 'string' || !item.title) {
    throw new Error(`strategy manifest[${index}].title is required`)
  }
  const value = item.default
  if (widget === 'enum') {
    if (typeof value !== 'string') {
      throw new Error(`strategy manifest[${index}].default must be a string`)
    }
  } else if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`strategy manifest[${index}].default must be a finite number`)
  }
  const parameter: StrategyParameter = {
    name: item.name,
    title: item.title,
    widget: widget as StrategyParamWidget,
    default: widget === 'enum' ? value : value
  }
  if (typeof item.min === 'number' && Number.isFinite(item.min)) {
    parameter.min = item.min
  }
  if (typeof item.max === 'number' && Number.isFinite(item.max)) {
    parameter.max = item.max
  }
  if (Array.isArray(item.options)) {
    parameter.options = item.options.map((option) => {
      const row = option as Record<string, unknown>
      return {
        value: typeof row.value === 'string' ? row.value : String(row.value ?? ''),
        label: typeof row.label === 'string' ? row.label : String(row.label ?? '')
      }
    })
  }
  return parameter
}

/** User-authored indicator scripts persisted in SQLite. Layout refs this id when kind=script. */

import type { MarketQueryParams } from './market'

export type ParamWidget = 'int' | 'float' | 'color' | 'lineWidth'

export interface ParamField {
  name: string
  widget: ParamWidget
  title: string
  default: number | string
  min?: number
  max?: number
}

export interface IndicatorManifest {
  key: string
  title: string
  fields: ParamField[]
  defaultParams: Record<string, number | string>
}

export interface IndicatorScript {
  id: string
  title: string
  source: string
  manifest: IndicatorManifest
  updatedAt: string
}

export interface ScriptTryParams {
  source: string
  params?: Record<string, unknown>
  query?: MarketQueryParams
}

export interface ScriptTryResult {
  ok: boolean
  error?: string
  traceback?: string
  line?: number | null
  column?: number | null
  manifest?: IndicatorManifest
}

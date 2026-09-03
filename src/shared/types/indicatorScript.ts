/** User-authored indicator scripts persisted in SQLite. Layout refs this id when kind=script. */

import type { LineWidth, PlotStyleParams, ScriptParams } from './chartLayout'
import type { MarketQueryParams } from './market'

export type ParamWidget = 'int' | 'float' | 'bool'

export type PlotKind = 'line' | 'histogram'

export interface ParamField {
  name: string
  widget: ParamWidget
  title: string
  default: number | boolean
  min?: number
  max?: number
}

export interface PlotStyleField {
  id: string
  title: string
  kind: PlotKind
  color?: string
  lineWidth?: LineWidth
  colorUp?: string
  colorDown?: string
}

export interface IndicatorManifest {
  key: string
  title: string
  overlay: boolean
  fields: ParamField[]
  plots: PlotStyleField[]
  defaultParams: Record<string, number | boolean>
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
  params?: ScriptParams
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

export type { PlotStyleParams, ScriptParams }

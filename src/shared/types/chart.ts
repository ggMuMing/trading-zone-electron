/** Mirror of contracts/chart_input.json. Logical chart-channel input (v1). */

export const CHART_INPUT_SCHEMA_VERSION = 1 as const

export const ISO_DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/

export type PlotKind = 'line' | 'histogram'

export interface PlotPrimitiveStyle {
  color?: string
  lineWidth?: number
}

export interface PlotPrimitive {
  id: string
  pane: string
  kind: PlotKind
  style?: PlotPrimitiveStyle
}

export interface CandlePoint {
  time: string
  open: number
  high: number
  low: number
  close: number
  vol?: number | null
  amount?: number | null
}

export interface VolumePoint {
  time: string
  value: number
  color: string
}

export interface ValuePoint {
  time: string
  value: number
  color?: string
}

export interface ChartInput {
  schemaVersion: typeof CHART_INPUT_SCHEMA_VERSION
  timeDomain: string[]
  candle: CandlePoint[]
  volume?: VolumePoint[]
  primitives: PlotPrimitive[]
  series: Record<string, ValuePoint[]>
}

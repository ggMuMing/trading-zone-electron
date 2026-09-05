/** Layout instances persisted in SQLite. All items are user scripts. */

export const DEFAULT_LAYOUT_ID = 'default'

export const SEED_MA_SCRIPT_ID = 'seed-ma'

export const SEED_MA_SCRIPT_TITLE = '均线'

export type LineWidth = 1 | 2 | 3 | 4

export type LayoutItemKind = 'script'

export type LayoutReorderDirection = 'up' | 'down'

export interface PlotStyleParams {
  color?: string
  lineWidth?: LineWidth
  colorUp?: string
  colorDown?: string
}

export interface ScriptParams {
  inputs: Record<string, number | boolean>
  styles: Record<string, PlotStyleParams>
}

export type LayoutItemParams = ScriptParams

export interface ChartLayoutItem {
  id: string
  layoutId: string
  kind: LayoutItemKind
  ref: string
  params: LayoutItemParams
  sortOrder: number
}

export interface ChartLayout {
  id: string
  updatedAt: string
  items: ChartLayoutItem[]
}

export interface ChartLayoutAddParams {
  kind: LayoutItemKind
  ref: string
}

export interface ComputeIndicatorInstance {
  id: string
  kind: LayoutItemKind
  ref: string
  params: LayoutItemParams
  source: string
}

import { yyyymmddToIso } from '../../../../shared/constants/market'

export type StrategyMarkerSide = 'buy' | 'sell'
export type StrategyHighlightKind = 'buy' | 'sell' | 'neutral'

export interface StrategyChartOverlay {
  markers: Array<{ timeIso: string; side: StrategyMarkerSide }>
  highlight: { timeIso: string; kind: StrategyHighlightKind } | null
}

export function isSignalTruthy(value: unknown): boolean {
  return value === true || value === 1 || value === 'true' || value === '1'
}

export function rowTimeIso(row: Record<string, unknown>): string {
  const raw = String(row.time ?? '')
  return raw.length === 8 ? yyyymmddToIso(raw) : raw
}

export function highlightKindOf(row: Record<string, unknown>): StrategyHighlightKind {
  if (isSignalTruthy(row.buy_signal)) {
    return 'buy'
  }
  if (isSignalTruthy(row.sell_signal)) {
    return 'sell'
  }
  return 'neutral'
}

export function markersFromSeries(series: Record<string, unknown>[]): StrategyChartOverlay['markers'] {
  const markers: StrategyChartOverlay['markers'] = []
  for (const row of series) {
    const timeIso = rowTimeIso(row)
    if (!timeIso) {
      continue
    }
    if (isSignalTruthy(row.buy_signal)) {
      markers.push({ timeIso, side: 'buy' })
      continue
    }
    if (isSignalTruthy(row.sell_signal)) {
      markers.push({ timeIso, side: 'sell' })
    }
  }
  return markers
}

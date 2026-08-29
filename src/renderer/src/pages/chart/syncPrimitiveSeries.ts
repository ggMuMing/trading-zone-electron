import {
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time
} from 'lightweight-charts'
import type { PlotPrimitive, ValuePoint } from '../../../../shared/types/chart'

export const DEFAULT_LINE_COLOR = '#2962FF'
export const DEFAULT_HISTOGRAM_COLOR = '#26a69a'
export const MAIN_PANE_STRETCH_FACTOR = 3
export const SUB_PANE_STRETCH_FACTOR = 1

export type PrimitiveSeries = ISeriesApi<'Line'> | ISeriesApi<'Histogram'>

function toLineWidth(value: number | undefined): 1 | 2 | 3 | 4 {
  if (value === 1 || value === 2 || value === 3 || value === 4) {
    return value
  }
  return 2
}

function toLineData(points: ValuePoint[]): Array<{ time: Time; value: number }> {
  return points.map((point) => ({ time: point.time as Time, value: point.value }))
}

function toHistogramData(points: ValuePoint[]): Array<{ time: Time; value: number; color?: string }> {
  return points.map((point) => {
    const item: { time: Time; value: number; color?: string } = {
      time: point.time as Time,
      value: point.value
    }
    if (point.color) {
      item.color = point.color
    }
    return item
  })
}

export function subplotPaneOrder(primitives: PlotPrimitive[]): string[] {
  const panes: string[] = []
  for (const primitive of primitives) {
    if (primitive.pane === 'main') {
      continue
    }
    if (!panes.includes(primitive.pane)) {
      panes.push(primitive.pane)
    }
  }
  return panes
}

export function paneIndexOf(pane: string, subpanes: string[]): number {
  if (pane === 'main') {
    return 0
  }
  return subpanes.indexOf(pane) + 1
}

export function applyPaneStretch(chart: IChartApi): void {
  const panes = chart.panes()
  if (panes.length === 0) {
    return
  }
  panes[0].setStretchFactor(MAIN_PANE_STRETCH_FACTOR)
  for (let i = 1; i < panes.length; i += 1) {
    panes[i].setStretchFactor(SUB_PANE_STRETCH_FACTOR)
  }
}

export function applyPrimitiveData(
  series: PrimitiveSeries,
  primitive: PlotPrimitive,
  points: ValuePoint[]
): void {
  if (primitive.kind === 'histogram') {
    ;(series as ISeriesApi<'Histogram'>).setData(toHistogramData(points))
    return
  }
  ;(series as ISeriesApi<'Line'>).setData(toLineData(points))
}

export function addPrimitiveSeries(
  chart: IChartApi,
  primitive: PlotPrimitive,
  paneIndex: number
): PrimitiveSeries {
  const hideAxis = { lastValueVisible: false, priceLineVisible: false } as const
  if (primitive.kind === 'histogram') {
    return chart.addSeries(
      HistogramSeries,
      {
        color: primitive.style?.color ?? DEFAULT_HISTOGRAM_COLOR,
        ...hideAxis
      },
      paneIndex
    )
  }
  return chart.addSeries(
    LineSeries,
    {
      color: primitive.style?.color ?? DEFAULT_LINE_COLOR,
      lineWidth: toLineWidth(primitive.style?.lineWidth),
      ...hideAxis
    },
    paneIndex
  )
}

function removeEmptySubPanes(chart: IChartApi): void {
  for (let i = chart.panes().length - 1; i >= 1; i -= 1) {
    const pane = chart.panes()[i]
    if (pane.getSeries().length === 0) {
      chart.removePane(i)
    }
  }
}

function ensurePaneCount(chart: IChartApi, desiredPaneCount: number): void {
  while (chart.panes().length < desiredPaneCount) {
    chart.addPane(false)
  }
}

export interface SyncPrimitiveSeriesArgs {
  chart: IChartApi
  seriesById: Map<string, PrimitiveSeries>
  prevPrimitives: PlotPrimitive[]
  nextPrimitives: PlotPrimitive[]
  seriesData: Record<string, ValuePoint[]>
}

/** Diff LWC series by primitive id; mutates seriesById. */
export function syncPrimitiveSeries({
  chart,
  seriesById,
  prevPrimitives,
  nextPrimitives,
  seriesData
}: SyncPrimitiveSeriesArgs): void {
  const prevById = new Map(prevPrimitives.map((primitive) => [primitive.id, primitive]))
  const nextById = new Map(nextPrimitives.map((primitive) => [primitive.id, primitive]))
  const nextIds = new Set(nextById.keys())

  for (const [id, series] of [...seriesById.entries()]) {
    if (!nextIds.has(id)) {
      chart.removeSeries(series)
      seriesById.delete(id)
    }
  }
  removeEmptySubPanes(chart)

  const subpanes = subplotPaneOrder(nextPrimitives)
  ensurePaneCount(chart, subpanes.length + 1)

  for (const primitive of nextPrimitives) {
    const existing = seriesById.get(primitive.id)
    const prev = prevById.get(primitive.id)
    const kindChanged = Boolean(existing && prev && prev.kind !== primitive.kind)
    if (existing && kindChanged) {
      chart.removeSeries(existing)
      seriesById.delete(primitive.id)
    }

    let series = seriesById.get(primitive.id)
    if (!series) {
      series = addPrimitiveSeries(chart, primitive, paneIndexOf(primitive.pane, subpanes))
      seriesById.set(primitive.id, series)
    } else if (primitive.kind === 'line') {
      ;(series as ISeriesApi<'Line'>).applyOptions({
        color: primitive.style?.color ?? DEFAULT_LINE_COLOR,
        lineWidth: toLineWidth(primitive.style?.lineWidth)
      })
    }
    applyPrimitiveData(series, primitive, seriesData[primitive.id] ?? [])
  }

  removeEmptySubPanes(chart)
  applyPaneStretch(chart)
}

export function computeSubpaneTops(
  chart: IChartApi,
  root?: HTMLElement | null
): Array<{ paneIndex: number; top: number }> {
  const panes = chart.panes()
  if (root) {
    const rootRect = root.getBoundingClientRect()
    return panes.map((pane, paneIndex) => {
      const el = pane.getHTMLElement()
      if (!el) {
        return { paneIndex, top: 0 }
      }
      return {
        paneIndex,
        top: el.getBoundingClientRect().top - rootRect.top
      }
    })
  }

  const result: Array<{ paneIndex: number; top: number }> = []
  let top = 0
  for (let i = 0; i < panes.length; i += 1) {
    result.push({ paneIndex: i, top })
    top += panes[i].getHeight()
  }
  return result
}

/** Observe pane DOM size (incl. separator drag). Caller must disconnect. */
export function observePaneLayout(
  chart: IChartApi,
  onLayout: () => void
): ResizeObserver {
  const observer = new ResizeObserver(() => {
    onLayout()
  })
  for (const pane of chart.panes()) {
    const el = pane.getHTMLElement()
    if (el) {
      observer.observe(el)
    }
  }
  return observer
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CandlestickSeries,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time
} from 'lightweight-charts'
import type { CandlePoint, ChartInput, ValuePoint, VolumePoint } from '../../../../shared/types/chart'
import type { ChartLayout } from '../../../../shared/types/chartLayout'
import type { IndicatorScript } from '../../../../shared/types/indicatorScript'
import { instanceIdOf, legendLabel, legendScriptTitle, subplotLegendTitle } from '../../../../shared/chart/legendLabel'
import { LWC_FONT_STACK } from '../../theme/lwcFont'
import { PaneCornerActions } from './PaneCornerActions'
import { PriceLegend, type PriceLegendBar, type PriceLegendOverlayGroup } from './PriceLegend'
import { SubpaneLegend, type SubpaneLegendPane } from './SubpaneLegend'
import {
  DEFAULT_HISTOGRAM_COLOR,
  DEFAULT_LINE_COLOR,
  addPrimitiveSeries,
  applyPaneStretch,
  applyPrimitiveData,
  computeSubpaneTops,
  filterPrimitivesByLayout,
  observePaneLayout,
  paneIndexOf,
  subplotPaneOrder,
  syncPrimitiveSeries,
  type PrimitiveSeries
} from './syncPrimitiveSeries'

const UP_COLOR = '#ef5350'
const DOWN_COLOR = '#26a69a'

function plotCellOf(row: HTMLElement): HTMLElement {
  const cells = Array.from(row.querySelectorAll(':scope > td'))
  if (cells.length <= 1) {
    return cells[0] ?? row
  }
  return cells[cells.length - 2]
}

function candleToLegend(point: CandlePoint): PriceLegendBar {
  return {
    date: point.time,
    open: point.open,
    high: point.high,
    low: point.low,
    close: point.close,
    vol: point.vol ?? null,
    amount: point.amount ?? null
  }
}

function lastLegendBar(input: ChartInput): PriceLegendBar | null {
  const last = input.candle[input.candle.length - 1]
  return last ? candleToLegend(last) : null
}

function lastPrimitiveValues(input: ChartInput): Record<string, number | null> {
  const values: Record<string, number | null> = {}
  for (const primitive of input.primitives) {
    const points = input.series[primitive.id]
    const last = points?.[points.length - 1]
    values[primitive.id] = last && Number.isFinite(last.value) ? last.value : null
  }
  return values
}

function toCandleData(points: CandlePoint[]): Array<{
  time: Time
  open: number
  high: number
  low: number
  close: number
}> {
  return points.map((point) => ({
    time: point.time as Time,
    open: point.open,
    high: point.high,
    low: point.low,
    close: point.close
  }))
}

function toVolumeData(points: VolumePoint[] | undefined): Array<{ time: Time; value: number; color: string }> {
  if (!points) {
    return []
  }
  return points.map((point) => ({
    time: point.time as Time,
    value: point.value,
    color: point.color
  }))
}

function readSeriesValue(param: MouseEventParams<Time>, series: PrimitiveSeries): number | null {
  const data = param.seriesData.get(series)
  if (!data || !('value' in data) || typeof data.value !== 'number' || !Number.isFinite(data.value)) {
    return null
  }
  return data.value
}

function primitiveColor(primitive: ChartInput['primitives'][number], points: ValuePoint[]): string {
  if (primitive.style?.color) {
    return primitive.style.color
  }
  if (primitive.kind === 'histogram') {
    const last = points[points.length - 1]
    return last?.color ?? DEFAULT_HISTOGRAM_COLOR
  }
  return DEFAULT_LINE_COLOR
}

function overlayGroupTitle(
  instanceId: string,
  layout: ChartLayout | null,
  scripts: IndicatorScript[]
): string {
  const item = layout?.items.find((entry) => entry.id === instanceId)
  if (item?.kind === 'script') {
    return legendScriptTitle(item, scripts)
  }
  return instanceId
}

function buildOverlays(
  input: ChartInput,
  values: Record<string, number | null>,
  layout: ChartLayout | null,
  scripts: IndicatorScript[]
): PriceLegendOverlayGroup[] {
  const groups: PriceLegendOverlayGroup[] = []
  const indexById = new Map<string, number>()
  for (const primitive of input.primitives) {
    if (primitive.pane !== 'main') {
      continue
    }
    const instanceId = instanceIdOf(primitive.id)
    let index = indexById.get(instanceId)
    if (index === undefined) {
      index = groups.length
      indexById.set(instanceId, index)
      groups.push({
        instanceId,
        title: overlayGroupTitle(instanceId, layout, scripts),
        items: []
      })
    }
    groups[index].items.push({
      id: primitive.id,
      label: legendLabel(primitive.id, layout),
      color: primitiveColor(primitive, input.series[primitive.id] ?? []),
      value: values[primitive.id] ?? null
    })
  }
  return groups
}

function buildSubpaneLegends(
  input: ChartInput,
  values: Record<string, number | null>,
  tops: Array<{ paneIndex: number; top: number }>,
  layout: ChartLayout | null,
  scripts: IndicatorScript[]
): SubpaneLegendPane[] {
  const subpanes = subplotPaneOrder(input.primitives, layout)
  return subpanes.map((pane, index) => {
    const paneIndex = index + 1
    const top = tops.find((entry) => entry.paneIndex === paneIndex)?.top ?? 0
    const panePrimitives = input.primitives.filter((primitive) => primitive.pane === pane)
    const items = panePrimitives.map((primitive) => ({
      id: primitive.id,
      label: legendLabel(primitive.id, layout),
      color: primitiveColor(primitive, input.series[primitive.id] ?? []),
      value: values[primitive.id] ?? null
    }))
    return {
      pane,
      instanceId: instanceIdOf(panePrimitives[0]?.id ?? pane) || pane,
      title: subplotLegendTitle(panePrimitives, layout, scripts),
      top,
      items,
      disableMoveUp: index === 0,
      disableMoveDown: index === subpanes.length - 1
    }
  })
}

interface KlineChartProps {
  input: ChartInput
  layout: ChartLayout | null
  scripts?: IndicatorScript[]
  onOpenSettings?: (instanceId: string) => void
  onOpenEditor?: (instanceId: string) => void
  onRemove?: (instanceId: string) => void
  onMovePane?: (instanceId: string, direction: 'up' | 'down') => void
}

export function KlineChart({
  input,
  layout,
  scripts = [],
  onOpenSettings,
  onOpenEditor,
  onRemove,
  onMovePane
}: KlineChartProps): React.JSX.Element {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const primitiveSeriesRef = useRef<Map<string, PrimitiveSeries>>(new Map())
  const primitivesRef = useRef(input.primitives)
  const inputRef = useRef(input)
  const candleByTimeRef = useRef<Map<string, CandlePoint>>(new Map())
  const hoverDateRef = useRef<string | null>(null)
  const paneLayoutObserverRef = useRef<ResizeObserver | null>(null)
  const rebindPaneLayoutObserverRef = useRef<(() => void) | null>(null)
  const layoutRef = useRef(layout)
  inputRef.current = input
  layoutRef.current = layout

  const [hoverBar, setHoverBar] = useState<PriceLegendBar | null>(null)
  const [hoverValues, setHoverValues] = useState<Record<string, number | null> | null>(null)
  const [subpaneTops, setSubpaneTops] = useState<Array<{ paneIndex: number; top: number }>>([])
  const [subpaneHosts, setSubpaneHosts] = useState<Array<{ paneIndex: number; host: HTMLElement }>>([])
  const [hoveredSubpaneIndex, setHoveredSubpaneIndex] = useState<number | null>(null)
  const [hoverSource, setHoverSource] = useState(input)
  if (input !== hoverSource) {
    setHoverSource(input)
    setHoverBar(null)
    setHoverValues(null)
    hoverDateRef.current = null
  }

  const candleByTime = useMemo(() => {
    const map = new Map<string, CandlePoint>()
    for (const point of input.candle) {
      map.set(point.time, point)
    }
    return map
  }, [input])
  const visibleInput = useMemo((): ChartInput => {
    const primitives = filterPrimitivesByLayout(input.primitives, layout)
    return primitives === input.primitives ? input : { ...input, primitives }
  }, [input, layout])
  const defaultBar = useMemo(() => lastLegendBar(visibleInput), [visibleInput])
  const defaultValues = useMemo(() => lastPrimitiveValues(visibleInput), [visibleInput])
  candleByTimeRef.current = candleByTime

  const activeValues = hoverValues ?? defaultValues
  const overlays = useMemo(
    () => buildOverlays(visibleInput, activeValues, layout, scripts),
    [visibleInput, activeValues, layout, scripts]
  )
  const subpaneLegends = useMemo(
    () => buildSubpaneLegends(visibleInput, activeValues, subpaneTops, layout, scripts),
    [visibleInput, activeValues, subpaneTops, layout, scripts]
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      return
    }

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333333',
        fontFamily: LWC_FONT_STACK
      },
      grid: {
        vertLines: { color: '#eeeeee' },
        horzLines: { color: '#eeeeee' }
      },
      rightPriceScale: {
        borderColor: '#e0e0e0'
      },
      timeScale: {
        borderColor: '#e0e0e0',
        rightOffset: 12
      }
    })

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
      borderVisible: false
    })
    candle.priceScale().applyOptions({
      scaleMargins: {
        top: 0.1,
        bottom: 0.35
      }
    })

    const volume = chart.addSeries(HistogramSeries, {
      color: '#d27b2d',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume'
    })
    volume.priceScale().applyOptions({
      scaleMargins: {
        top: 0.75,
        bottom: 0
      }
    })

    const initial = inputRef.current
    const initialPrimitives = filterPrimitivesByLayout(initial.primitives, layoutRef.current)
    const subpanes = subplotPaneOrder(initialPrimitives, layoutRef.current)
    const primitiveSeries = new Map<string, PrimitiveSeries>()
    for (const primitive of initialPrimitives) {
      const series = addPrimitiveSeries(chart, primitive, paneIndexOf(primitive.pane, subpanes))
      primitiveSeries.set(primitive.id, series)
    }
    applyPaneStretch(chart)

    chartRef.current = chart
    candleRef.current = candle
    volumeRef.current = volume
    primitiveSeriesRef.current = primitiveSeries
    primitivesRef.current = initialPrimitives

    candle.setData(toCandleData(initial.candle))
    volume.setData(toVolumeData(initial.volume))
    for (const primitive of initialPrimitives) {
      const series = primitiveSeries.get(primitive.id)
      if (series) {
        applyPrimitiveData(series, primitive, initial.series[primitive.id] ?? [])
      }
    }

    const onCrosshairMove = (param: MouseEventParams<Time>): void => {
      if (!param.time) {
        if (hoverDateRef.current !== null) {
          hoverDateRef.current = null
          setHoverBar(null)
          setHoverValues(null)
        }
        return
      }

      const seriesData = param.seriesData.get(candle)
      if (
        !seriesData ||
        !('open' in seriesData) ||
        typeof seriesData.open !== 'number' ||
        typeof seriesData.high !== 'number' ||
        typeof seriesData.low !== 'number' ||
        typeof seriesData.close !== 'number'
      ) {
        if (hoverDateRef.current !== null) {
          hoverDateRef.current = null
          setHoverBar(null)
          setHoverValues(null)
        }
        return
      }

      const date = String(param.time)
      if (hoverDateRef.current === date) {
        return
      }

      const orig = candleByTimeRef.current.get(date)
      const values: Record<string, number | null> = {}
      for (const [id, series] of primitiveSeriesRef.current.entries()) {
        values[id] = readSeriesValue(param, series)
      }

      hoverDateRef.current = date
      setHoverBar({
        date,
        open: seriesData.open,
        high: seriesData.high,
        low: seriesData.low,
        close: seriesData.close,
        vol: orig?.vol ?? null,
        amount: orig?.amount ?? null
      })
      setHoverValues(values)
    }

    chart.subscribeCrosshairMove(onCrosshairMove)

    const refreshSubpaneHosts = (): void => {
      if (chartRef.current !== chart) {
        return
      }
      const next: Array<{ paneIndex: number; host: HTMLElement }> = []
      chart.panes().forEach((pane, paneIndex) => {
        if (paneIndex === 0) {
          return
        }
        const row = pane.getHTMLElement()
        if (!row) {
          return
        }
        const host = plotCellOf(row)
        host.style.position = 'relative'
        next.push({ paneIndex, host })
      })
      setSubpaneHosts(next)
    }

    const refreshSubpaneTops = (): void => {
      if (chartRef.current !== chart) {
        return
      }
      setSubpaneTops(computeSubpaneTops(chart, wrapperRef.current))
      refreshSubpaneHosts()
    }

    const rebindPaneLayoutObserver = (): void => {
      paneLayoutObserverRef.current?.disconnect()
      paneLayoutObserverRef.current = observePaneLayout(chart, () => {
        requestAnimationFrame(refreshSubpaneTops)
      })
      requestAnimationFrame(refreshSubpaneTops)
    }

    const resize = (): void => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        chart.resize(el.clientWidth, el.clientHeight)
        requestAnimationFrame(refreshSubpaneTops)
      }
    }
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    resize()
    rebindPaneLayoutObserver()
    rebindPaneLayoutObserverRef.current = rebindPaneLayoutObserver

    return () => {
      observer.disconnect()
      paneLayoutObserverRef.current?.disconnect()
      paneLayoutObserverRef.current = null
      rebindPaneLayoutObserverRef.current = null
      chart.unsubscribeCrosshairMove(onCrosshairMove)
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      volumeRef.current = null
      primitiveSeriesRef.current = new Map()
      primitivesRef.current = []
    }
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) {
      return
    }

    candleRef.current?.setData(toCandleData(visibleInput.candle))
    volumeRef.current?.setData(toVolumeData(visibleInput.volume))

    syncPrimitiveSeries({
      chart,
      seriesById: primitiveSeriesRef.current,
      prevPrimitives: primitivesRef.current,
      nextPrimitives: visibleInput.primitives,
      seriesData: visibleInput.series,
      layout
    })
    primitivesRef.current = visibleInput.primitives

    if (rebindPaneLayoutObserverRef.current) {
      rebindPaneLayoutObserverRef.current()
    } else {
      requestAnimationFrame(() => {
        if (chartRef.current === chart) {
          setSubpaneTops(computeSubpaneTops(chart, wrapperRef.current))
        }
      })
    }
  }, [visibleInput, layout])

  useEffect(() => {
    const cleanups: Array<() => void> = []
    for (const { paneIndex, host } of subpaneHosts) {
      const onEnter = (): void => {
        setHoveredSubpaneIndex(paneIndex)
      }
      const onLeave = (): void => {
        setHoveredSubpaneIndex((current) => (current === paneIndex ? null : current))
      }
      host.addEventListener('mouseenter', onEnter)
      host.addEventListener('mouseleave', onLeave)
      cleanups.push(() => {
        host.removeEventListener('mouseenter', onEnter)
        host.removeEventListener('mouseleave', onLeave)
      })
    }
    return () => {
      for (const cleanup of cleanups) {
        cleanup()
      }
    }
  }, [subpaneHosts])

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}
    >
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', minHeight: 0 }}
      />
      <PriceLegend
        bar={hoverBar ?? defaultBar}
        overlays={overlays}
        onOpenSettings={onOpenSettings}
        onOpenEditor={onOpenEditor}
        onRemove={onRemove}
      />
      <SubpaneLegend
        panes={subpaneLegends}
        onOpenSettings={onOpenSettings}
        onOpenEditor={onOpenEditor}
        onRemove={onRemove}
      />
      {subpaneLegends.map((pane, index) => {
        const paneIndex = index + 1
        const host = subpaneHosts.find((entry) => entry.paneIndex === paneIndex)?.host
        if (!host) {
          return null
        }
        return createPortal(
          <PaneCornerActions
            visible={hoveredSubpaneIndex === paneIndex}
            onMoveUp={onMovePane ? () => onMovePane(pane.instanceId, 'up') : undefined}
            onMoveDown={onMovePane ? () => onMovePane(pane.instanceId, 'down') : undefined}
            disableMoveUp={pane.disableMoveUp}
            disableMoveDown={pane.disableMoveDown}
            onRemove={onRemove ? () => onRemove(pane.instanceId) : undefined}
          />,
          host,
          pane.instanceId
        )
      })}
    </div>
  )
}

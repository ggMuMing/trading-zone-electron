import { useEffect, useRef, useState } from 'react'
import {
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type AutoscaleInfo,
  type MouseEventParams,
  type SeriesMarker,
  type Time
} from 'lightweight-charts'
import type { DashboardBasisPoint } from '../../../../shared/types/dashboard'
import { LWC_FONT_STACK } from '../../theme/lwcFont'
import {
  DASHBOARD_PANE_BOTTOM_STRETCH,
  DASHBOARD_PANE_TOP_STRETCH,
  applyLastYearVisibleRange
} from './chartView'
import { DOWN_COLOR, UP_COLOR, yyyymmddToChartTime } from './format'
import { ChartPlaceholder, STAT_CLOSE_COLOR, STAT_VALUE_COLOR } from './StatCharts'

const MAX_MARKERS = 20

/** 与上窗格同一组收盘价：基差 = 现货 − 期货 */
function basisOf(point: DashboardBasisPoint): number {
  return point.spot_close - point.fut_close
}

function includeZeroInScale(info: AutoscaleInfo | null): AutoscaleInfo | null {
  if (info?.priceRange == null) {
    return info
  }
  return {
    ...info,
    priceRange: {
      minValue: Math.min(0, info.priceRange.minValue),
      maxValue: Math.max(0, info.priceRange.maxValue)
    }
  }
}

function formatBasisLabel(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 100 || Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-6) {
    return String(Math.round(value))
  }
  if (abs >= 10) {
    return value.toFixed(1)
  }
  return value.toFixed(2)
}

function formatPrice(value: number): string {
  return value.toFixed(2)
}

function pickVisiblePoints(
  points: DashboardBasisPoint[],
  from: number,
  to: number
): DashboardBasisPoint[] {
  const start = Math.max(0, Math.floor(from))
  const end = Math.min(points.length - 1, Math.ceil(to))
  if (end < start) {
    return []
  }
  const visible = points.slice(start, end + 1)
  if (visible.length <= MAX_MARKERS) {
    return visible
  }
  const step = Math.ceil(visible.length / MAX_MARKERS)
  const picked: DashboardBasisPoint[] = []
  for (let i = 0; i < visible.length; i += step) {
    picked.push(visible[i])
  }
  const last = visible[visible.length - 1]
  if (picked[picked.length - 1] !== last) {
    picked.push(last)
  }
  return picked
}

function toMarkers(points: DashboardBasisPoint[]): SeriesMarker<Time>[] {
  return points.map((point) => {
    const basis = basisOf(point)
    return {
      time: yyyymmddToChartTime(point.trade_date) as Time,
      position: basis >= 0 ? 'aboveBar' : 'belowBar',
      shape: 'circle',
      color: basis >= 0 ? UP_COLOR : DOWN_COLOR,
      text: formatBasisLabel(basis),
      size: 0.2
    }
  })
}

function LineSwatch({ color }: { color: string }): React.JSX.Element {
  return (
    <span
      style={{
        width: 16,
        height: 0,
        borderTop: `2px solid ${color}`,
        display: 'inline-block'
      }}
    />
  )
}

function BasisSwatch(): React.JSX.Element {
  return (
    <span style={{ display: 'inline-flex', width: 16, height: 8, overflow: 'hidden' }}>
      <span style={{ flex: 1, background: UP_COLOR }} />
      <span style={{ flex: 1, background: DOWN_COLOR }} />
    </span>
  )
}

function BasisPaneLegend({ point }: { point: DashboardBasisPoint }): React.JSX.Element {
  const basis = basisOf(point)
  const basisColor = basis >= 0 ? UP_COLOR : DOWN_COLOR
  return (
    <div
      style={{
        position: 'absolute',
        top: 4,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2,
        pointerEvents: 'none',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px 12px',
        fontSize: 12,
        color: '#555',
        fontFamily: LWC_FONT_STACK
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <LineSwatch color={STAT_VALUE_COLOR} />
        期指价格
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPrice(point.fut_close)}</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <LineSwatch color={STAT_CLOSE_COLOR} />
        现货价格
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPrice(point.spot_close)}</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <BasisSwatch />
        基差
        <span style={{ color: basisColor, fontVariantNumeric: 'tabular-nums' }}>
          {formatBasisLabel(basis)}
        </span>
      </span>
    </div>
  )
}

interface BasisProductChartProps {
  series: DashboardBasisPoint[]
}

export function BasisProductChart({ series }: BasisProductChartProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const hoverDateRef = useRef<string | null>(null)
  const [activePoint, setActivePoint] = useState<DashboardBasisPoint | null>(null)

  useEffect(() => {
    hoverDateRef.current = null
    setActivePoint(null)
  }, [series])

  useEffect(() => {
    const el = containerRef.current
    if (!el || series.length === 0) {
      return
    }
    const byTime = new Map(
      series.map((point) => [yyyymmddToChartTime(point.trade_date), point] as const)
    )
    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#666666',
        fontFamily: LWC_FONT_STACK
      },
      grid: {
        vertLines: { color: '#f3f3f3' },
        horzLines: { color: '#f3f3f3' }
      },
      rightPriceScale: { borderVisible: false, visible: false },
      leftPriceScale: { borderVisible: false, visible: true },
      timeScale: { borderVisible: false, rightOffset: 4 }
    })
    chart.addPane(false)
    const panes = chart.panes()
    panes[0]?.setStretchFactor(DASHBOARD_PANE_TOP_STRETCH)
    panes[1]?.setStretchFactor(DASHBOARD_PANE_BOTTOM_STRETCH)

    const futSeries = chart.addSeries(
      LineSeries,
      {
        color: STAT_VALUE_COLOR,
        lineWidth: 2,
        priceScaleId: 'left',
        lastValueVisible: false,
        priceLineVisible: false
      },
      0
    )
    const spotSeries = chart.addSeries(
      LineSeries,
      {
        color: STAT_CLOSE_COLOR,
        lineWidth: 2,
        priceScaleId: 'left',
        lastValueVisible: false,
        priceLineVisible: false
      },
      0
    )
    const basisBars = chart.addSeries(
      HistogramSeries,
      {
        base: 0,
        priceScaleId: 'left',
        lastValueVisible: false,
        priceLineVisible: false,
        autoscaleInfoProvider: (original) => includeZeroInScale(original())
      },
      1
    )
    basisBars.createPriceLine({
      price: 0,
      color: '#bdbdbd',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: false
    })

    futSeries.setData(
      series.map((point) => ({
        time: yyyymmddToChartTime(point.trade_date) as Time,
        value: point.fut_close
      }))
    )
    spotSeries.setData(
      series.map((point) => ({
        time: yyyymmddToChartTime(point.trade_date) as Time,
        value: point.spot_close
      }))
    )
    basisBars.setData(
      series.map((point) => {
        const basis = basisOf(point)
        return {
          time: yyyymmddToChartTime(point.trade_date) as Time,
          value: basis,
          color: basis >= 0 ? UP_COLOR : DOWN_COLOR
        }
      })
    )

    const markers = createSeriesMarkers(basisBars, [])
    const refreshMarkers = (range: { from: number; to: number } | null) => {
      const from = range?.from ?? 0
      const to = range?.to ?? series.length - 1
      markers.setMarkers(toMarkers(pickVisiblePoints(series, from, to)))
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(refreshMarkers)
    applyLastYearVisibleRange(
      chart,
      series.map((point) => point.trade_date)
    )

    const onCrosshairMove = (param: MouseEventParams<Time>): void => {
      if (!param.time) {
        if (hoverDateRef.current !== null) {
          hoverDateRef.current = null
          setActivePoint(null)
        }
        return
      }
      const date = String(param.time)
      const found = byTime.get(date) ?? null
      if (!found) {
        if (hoverDateRef.current !== null) {
          hoverDateRef.current = null
          setActivePoint(null)
        }
        return
      }
      if (hoverDateRef.current === date) {
        return
      }
      hoverDateRef.current = date
      setActivePoint(found)
    }
    chart.subscribeCrosshairMove(onCrosshairMove)

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      chart.unsubscribeCrosshairMove(onCrosshairMove)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(refreshMarkers)
      chart.remove()
    }
  }, [series])

  if (series.length === 0) {
    return <ChartPlaceholder text="暂无曲线" />
  }

  const displayPoint = activePoint ?? series[series.length - 1]

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 0, position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <BasisPaneLegend point={displayPoint} />
    </div>
  )
}

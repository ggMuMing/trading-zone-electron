import { useEffect, useRef } from 'react'
import {
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time
} from 'lightweight-charts'
import type { DashboardSeriesPoint } from '../../../../shared/types/dashboard'
import { lwcChromeOptions, useChartChrome } from '../../theme/chartChrome'
import { LWC_FONT_STACK } from '../../theme/lwcFont'
import {
  DASHBOARD_PANE_BOTTOM_STRETCH,
  DASHBOARD_PANE_TOP_STRETCH,
  applyLastYearVisibleRange
} from './chartView'
import { DOWN_COLOR, UP_COLOR, yyyymmddToChartTime } from './format'

export const STAT_CLOSE_COLOR = '#ef6c00'

export interface StatLegendItem {
  color: string
  label: string
}

interface AlignedStatChartProps {
  series: DashboardSeriesPoint[]
  showClose?: boolean
  legends: StatLegendItem[]
}

export function AlignedStatChart({
  series,
  showClose = false,
  legends
}: AlignedStatChartProps): React.JSX.Element {
  const chrome = useChartChrome()
  const chromeRef = useRef(chrome)
  chromeRef.current = chrome
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const valueSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      return
    }
    const initialChrome = chromeRef.current
    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      ...lwcChromeOptions(initialChrome),
      rightPriceScale: { borderColor: initialChrome.scaleBorder, borderVisible: false, visible: showClose },
      leftPriceScale: { borderColor: initialChrome.scaleBorder, borderVisible: false, visible: true },
      timeScale: { borderColor: initialChrome.scaleBorder, borderVisible: false, rightOffset: 4 }
    })
    chart.addPane(false)
    const panes = chart.panes()
    panes[0]?.setStretchFactor(DASHBOARD_PANE_TOP_STRETCH)
    panes[1]?.setStretchFactor(DASHBOARD_PANE_BOTTOM_STRETCH)

    const valueSeries = chart.addSeries(
      LineSeries,
      {
        color: initialChrome.seriesBlue,
        lineWidth: 2,
        priceScaleId: 'left',
        lastValueVisible: false,
        priceLineVisible: false
      },
      0
    )
    let closeSeries: ISeriesApi<'Line'> | null = null
    if (showClose) {
      closeSeries = chart.addSeries(
        LineSeries,
        {
          color: STAT_CLOSE_COLOR,
          lineWidth: 1,
          priceScaleId: 'right',
          lastValueVisible: false,
          priceLineVisible: false
        },
        0
      )
    }
    const bars = chart.addSeries(
      HistogramSeries,
      {
        lastValueVisible: false,
        priceLineVisible: false
      },
      1
    )

    valueSeries.setData(
      series
        .filter((point) => point.value != null)
        .map((point) => ({
          time: yyyymmddToChartTime(point.trade_date) as Time,
          value: point.value as number
        }))
    )
    if (closeSeries) {
      closeSeries.setData(
        series
          .filter((point) => point.close != null)
          .map((point) => ({
            time: yyyymmddToChartTime(point.trade_date) as Time,
            value: point.close as number
          }))
      )
    }
    bars.setData(
      series
        .filter((point) => point.change != null)
        .map((point) => ({
          time: yyyymmddToChartTime(point.trade_date) as Time,
          value: point.change as number,
          color: (point.change as number) >= 0 ? UP_COLOR : DOWN_COLOR
        }))
    )
    applyLastYearVisibleRange(
      chart,
      series.map((point) => point.trade_date)
    )
    chartRef.current = chart
    valueSeriesRef.current = valueSeries
    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      valueSeriesRef.current = null
    }
  }, [series, showClose])

  useEffect(() => {
    chartRef.current?.applyOptions(lwcChromeOptions(chrome))
    valueSeriesRef.current?.applyOptions({ color: chrome.seriesBlue })
  }, [chrome])

  if (series.length === 0) {
    return <ChartPlaceholder text="暂无曲线" />
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 0, position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {legends.length > 0 ? <StatLegend legends={legends} /> : null}
    </div>
  )
}

export function StatLegend({ legends }: { legends: StatLegendItem[] }): React.JSX.Element {
  const chrome = useChartChrome()
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
        color: chrome.text,
        fontFamily: LWC_FONT_STACK
      }}
    >
      {legends.map((item) => (
        <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 16,
              height: 0,
              borderTop: `2px solid ${item.color}`,
              display: 'inline-block'
            }}
          />
          {item.label}
        </span>
      ))}
    </div>
  )
}

export function ChartPlaceholder({ text }: { text: string }): React.JSX.Element {
  const chrome = useChartChrome()
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: chrome.text,
        fontSize: 12
      }}
    >
      {text}
    </div>
  )
}

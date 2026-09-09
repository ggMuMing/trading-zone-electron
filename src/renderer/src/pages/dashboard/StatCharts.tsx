import { useEffect, useRef } from 'react'
import {
  HistogramSeries,
  LineSeries,
  createChart,
  type ISeriesApi,
  type Time
} from 'lightweight-charts'
import type { DashboardSeriesPoint } from '../../../../shared/types/dashboard'
import { LWC_FONT_STACK } from '../../theme/lwcFont'
import { DOWN_COLOR, UP_COLOR, yyyymmddToChartTime } from './format'

interface DualLineChartProps {
  series: DashboardSeriesPoint[]
  showClose?: boolean
}

export function DualLineChart({ series, showClose = false }: DualLineChartProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

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
        textColor: '#666666',
        fontFamily: LWC_FONT_STACK
      },
      grid: {
        vertLines: { color: '#f3f3f3' },
        horzLines: { color: '#f3f3f3' }
      },
      rightPriceScale: { borderVisible: false, visible: showClose },
      leftPriceScale: { borderVisible: false, visible: true },
      timeScale: { borderVisible: false, rightOffset: 4 },
      handleScroll: false,
      handleScale: false
    })
    const valueSeries = chart.addSeries(LineSeries, {
      color: '#1976d2',
      lineWidth: 2,
      priceScaleId: 'left',
      lastValueVisible: false,
      priceLineVisible: false
    })
    let closeSeries: ISeriesApi<'Line'> | null = null
    if (showClose) {
      closeSeries = chart.addSeries(LineSeries, {
        color: '#ef6c00',
        lineWidth: 1,
        priceScaleId: 'right',
        lastValueVisible: false,
        priceLineVisible: false
      })
    }
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
    chart.timeScale().fitContent()
    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      chart.remove()
    }
  }, [series, showClose])

  if (series.length === 0) {
    return <ChartPlaceholder text="暂无曲线" />
  }

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 0 }} />
}

interface ChangeBarChartProps {
  series: DashboardSeriesPoint[]
}

export function ChangeBarChart({ series }: ChangeBarChartProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

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
        textColor: '#666666',
        fontFamily: LWC_FONT_STACK
      },
      grid: {
        vertLines: { color: '#f3f3f3' },
        horzLines: { color: '#f3f3f3' }
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, rightOffset: 4 },
      handleScroll: false,
      handleScale: false
    })
    const bars = chart.addSeries(HistogramSeries, {
      lastValueVisible: false,
      priceLineVisible: false
    })
    bars.setData(
      series
        .filter((point) => point.change != null)
        .map((point) => ({
          time: yyyymmddToChartTime(point.trade_date) as Time,
          value: point.change as number,
          color: (point.change as number) >= 0 ? UP_COLOR : DOWN_COLOR
        }))
    )
    chart.timeScale().fitContent()
    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      chart.remove()
    }
  }, [series])

  if (series.every((point) => point.change == null)) {
    return <ChartPlaceholder text="暂无变化" />
  }

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 0 }} />
}

function ChartPlaceholder({ text }: { text: string }): React.JSX.Element {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#888',
        fontSize: 12
      }}
    >
      {text}
    </div>
  )
}

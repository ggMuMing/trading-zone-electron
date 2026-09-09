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

export const STAT_VALUE_COLOR = '#1976d2'
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
      timeScale: { borderVisible: false, rightOffset: 4 }
    })
    chart.addPane(false)
    const panes = chart.panes()
    panes[0]?.setStretchFactor(1.4)
    panes[1]?.setStretchFactor(1)

    const valueSeries = chart.addSeries(
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

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 0, position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {legends.length > 0 ? <StatLegend legends={legends} /> : null}
    </div>
  )
}

function StatLegend({ legends }: { legends: StatLegendItem[] }): React.JSX.Element {
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

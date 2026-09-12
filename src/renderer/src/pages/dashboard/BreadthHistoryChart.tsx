import { useEffect, useRef } from 'react'
import { LineSeries, LineStyle, createChart, type Time } from 'lightweight-charts'
import type { DashboardBreadthPoint } from '../../../../shared/types/dashboard'
import { LWC_FONT_STACK } from '../../theme/lwcFont'
import { applyLastYearVisibleRange } from './chartView'
import { DOWN_COLOR, UP_COLOR, yyyymmddToChartTime } from './format'
import { STAT_CLOSE_COLOR, StatLegend } from './StatCharts'

const LIMIT_UP_MA_PERIOD = 20
const LIMIT_UP_MA_COLOR = STAT_CLOSE_COLOR

function limitUpMa20(
  series: DashboardBreadthPoint[]
): Array<{ time: Time; value: number }> {
  const points: Array<{ time: Time; value: number }> = []
  let sum = 0
  for (let i = 0; i < series.length; i += 1) {
    sum += series[i].limit_up_count
    if (i >= LIMIT_UP_MA_PERIOD) {
      sum -= series[i - LIMIT_UP_MA_PERIOD].limit_up_count
    }
    if (i >= LIMIT_UP_MA_PERIOD - 1) {
      points.push({
        time: yyyymmddToChartTime(series[i].trade_date) as Time,
        value: sum / LIMIT_UP_MA_PERIOD
      })
    }
  }
  return points
}

interface BreadthHistoryChartProps {
  series: DashboardBreadthPoint[]
}

export function BreadthHistoryChart({ series }: BreadthHistoryChartProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || series.length === 0) {
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
      rightPriceScale: { borderVisible: false, visible: false },
      leftPriceScale: { borderVisible: false, visible: true },
      timeScale: { borderVisible: false, rightOffset: 4 }
    })

    const limitUp = chart.addSeries(LineSeries, {
      color: UP_COLOR,
      lineWidth: 2,
      priceScaleId: 'left',
      lastValueVisible: false,
      priceLineVisible: false
    })
    const limitDown = chart.addSeries(LineSeries, {
      color: DOWN_COLOR,
      lineWidth: 2,
      priceScaleId: 'left',
      lastValueVisible: false,
      priceLineVisible: false
    })
    const limitUpMa = chart.addSeries(LineSeries, {
      color: LIMIT_UP_MA_COLOR,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceScaleId: 'left',
      lastValueVisible: false,
      priceLineVisible: false
    })

    limitUp.setData(
      series.map((point) => ({
        time: yyyymmddToChartTime(point.trade_date) as Time,
        value: point.limit_up_count
      }))
    )
    limitDown.setData(
      series.map((point) => ({
        time: yyyymmddToChartTime(point.trade_date) as Time,
        value: point.limit_down_count
      }))
    )
    limitUpMa.setData(limitUpMa20(series))
    applyLastYearVisibleRange(
      chart,
      series.map((point) => point.trade_date)
    )

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      chart.remove()
    }
  }, [series])

  if (series.length === 0) {
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
        暂无曲线
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 0, position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <StatLegend
        legends={[
          { color: UP_COLOR, label: '涨停家数' },
          { color: DOWN_COLOR, label: '跌停家数' },
          { color: LIMIT_UP_MA_COLOR, label: '涨停MA20' }
        ]}
      />
    </div>
  )
}

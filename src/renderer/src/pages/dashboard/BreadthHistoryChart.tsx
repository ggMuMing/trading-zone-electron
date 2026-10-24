import { useEffect, useRef } from 'react'
import { LineSeries, LineStyle, createChart, type IChartApi, type Time } from 'lightweight-charts'
import type { DashboardBreadthPoint } from '../../../../shared/types/dashboard'
import { lwcChromeOptions, useChartChrome } from '../../theme/chartChrome'
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
  const chrome = useChartChrome()
  const chromeRef = useRef(chrome)
  chromeRef.current = chrome
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || series.length === 0) {
      return
    }
    const initialChrome = chromeRef.current
    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      ...lwcChromeOptions(initialChrome),
      rightPriceScale: { borderColor: initialChrome.scaleBorder, borderVisible: false, visible: false },
      leftPriceScale: { borderColor: initialChrome.scaleBorder, borderVisible: false, visible: true },
      timeScale: { borderColor: initialChrome.scaleBorder, borderVisible: false, rightOffset: 4 }
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

    chartRef.current = chart
    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [series])

  useEffect(() => {
    chartRef.current?.applyOptions(lwcChromeOptions(chrome))
  }, [chrome])

  if (series.length === 0) {
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

import { useEffect, useRef } from 'react'
import {
  CandlestickSeries,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time
} from 'lightweight-charts'
import type { DashboardBar } from '../../../../shared/types/dashboard'
import { lwcChromeOptions, useChartChrome } from '../../theme/chartChrome'
import { applyLastYearVisibleRange } from './chartView'
import { DOWN_COLOR, UP_COLOR, VOLUME_COLOR, yyyymmddToChartTime } from './format'

interface MiniKlineProps {
  bars: DashboardBar[]
}

export function MiniKline({ bars }: MiniKlineProps): React.JSX.Element {
  const chrome = useChartChrome()
  const chromeRef = useRef(chrome)
  chromeRef.current = chrome
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)

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
      timeScale: { borderColor: initialChrome.scaleBorder, rightOffset: 8 }
    })
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
      borderVisible: false
    })
    candle.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.28 } })
    const volume = chart.addSeries(HistogramSeries, {
      color: VOLUME_COLOR,
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume'
    })
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } })
    chart.priceScale('volume').applyOptions({ visible: false })

    chartRef.current = chart
    candleRef.current = candle
    volumeRef.current = volume

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      volumeRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.applyOptions(lwcChromeOptions(chrome))
  }, [chrome])

  useEffect(() => {
    if (!candleRef.current || !volumeRef.current || !chartRef.current) {
      return
    }
    const candleData = bars
      .filter((bar) => bar.open != null && bar.high != null && bar.low != null && bar.close != null)
      .map((bar) => ({
        time: yyyymmddToChartTime(bar.trade_date) as Time,
        open: bar.open as number,
        high: bar.high as number,
        low: bar.low as number,
        close: bar.close as number
      }))
    const volumeData = bars.map((bar) => ({
      time: yyyymmddToChartTime(bar.trade_date) as Time,
      value: bar.vol ?? 0,
      color: (bar.close ?? 0) >= (bar.open ?? 0) ? UP_COLOR : DOWN_COLOR
    }))
    candleRef.current.setData(candleData)
    volumeRef.current.setData(volumeData)
    applyLastYearVisibleRange(
      chartRef.current,
      bars.map((bar) => bar.trade_date)
    )
  }, [bars])

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 0, position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {bars.length === 0 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: chrome.text,
            fontSize: 13
          }}
        >
          暂无K线
        </div>
      ) : null}
    </div>
  )
}

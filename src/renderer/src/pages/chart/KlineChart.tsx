import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CandlestickSeries,
  HistogramSeries,
  createChart,
  type ISeriesApi,
  type MouseEventParams,
  type Time
} from 'lightweight-charts'
import { yyyymmddToIso } from '../../../../shared/constants/market'
import type { OhlcvBar } from '../../../../shared/types/market'
import { LWC_FONT_STACK } from '../../theme/lwcFont'
import { PriceLegend, type PriceLegendBar } from './PriceLegend'

const UP_COLOR = '#ef5350'
const DOWN_COLOR = '#26a69a'

interface CandlePoint {
  time: Time
  open: number
  high: number
  low: number
  close: number
}

interface VolumePoint {
  time: Time
  value: number
  color: string
}

function isCompleteOhlc(bar: OhlcvBar): bar is OhlcvBar & {
  open: number
  high: number
  low: number
  close: number
} {
  return bar.open !== null && bar.high !== null && bar.low !== null && bar.close !== null
}

function toLegendBar(bar: OhlcvBar): PriceLegendBar | null {
  if (!isCompleteOhlc(bar)) {
    return null
  }
  return {
    date: yyyymmddToIso(bar.trade_date),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    vol: bar.vol,
    amount: bar.amount
  }
}

function barsToChartData(bars: OhlcvBar[]): { candles: CandlePoint[]; volumes: VolumePoint[] } {
  const sorted = [...bars].sort((a, b) => a.trade_date.localeCompare(b.trade_date))
  const candles: CandlePoint[] = []
  const volumes: VolumePoint[] = []
  let prevClose: number | null = null

  for (const bar of sorted) {
    if (!isCompleteOhlc(bar)) {
      continue
    }
    const time = yyyymmddToIso(bar.trade_date) as Time
    candles.push({
      time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close
    })
    const down = prevClose !== null ? bar.close < prevClose : bar.close < bar.open
    volumes.push({
      time,
      value: bar.vol ?? 0,
      color: down ? DOWN_COLOR : UP_COLOR
    })
    prevClose = bar.close
  }

  return { candles, volumes }
}

function buildTimeToBar(bars: OhlcvBar[]): Map<string, OhlcvBar> {
  const map = new Map<string, OhlcvBar>()
  for (const bar of bars) {
    if (!isCompleteOhlc(bar)) {
      continue
    }
    map.set(yyyymmddToIso(bar.trade_date), bar)
  }
  return map
}

function lastLegendBar(bars: OhlcvBar[]): PriceLegendBar | null {
  const sorted = [...bars].sort((a, b) => a.trade_date.localeCompare(b.trade_date))
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const legend = toLegendBar(sorted[i])
    if (legend) {
      return legend
    }
  }
  return null
}

interface KlineChartProps {
  bars: OhlcvBar[]
}

export function KlineChart({ bars }: KlineChartProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const barsRef = useRef(bars)
  const timeToBarRef = useRef<Map<string, OhlcvBar>>(new Map())
  const hoverDateRef = useRef<string | null>(null)
  barsRef.current = bars

  const [hoverBar, setHoverBar] = useState<PriceLegendBar | null>(null)
  const [hoverSource, setHoverSource] = useState(bars)
  if (bars !== hoverSource) {
    setHoverSource(bars)
    setHoverBar(null)
    hoverDateRef.current = null
  }

  const timeToBar = useMemo(() => buildTimeToBar(bars), [bars])
  const defaultBar = useMemo(() => lastLegendBar(bars), [bars])
  timeToBarRef.current = timeToBar

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

    candleRef.current = candle
    volumeRef.current = volume

    const initial = barsToChartData(barsRef.current)
    candle.setData(initial.candles)
    volume.setData(initial.volumes)

    const onCrosshairMove = (param: MouseEventParams<Time>): void => {
      if (!param.time) {
        if (hoverDateRef.current !== null) {
          hoverDateRef.current = null
          setHoverBar(null)
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
        }
        return
      }

      const date = String(param.time)
      if (hoverDateRef.current === date) {
        return
      }

      const orig = timeToBarRef.current.get(date)
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
    }

    chart.subscribeCrosshairMove(onCrosshairMove)

    const resize = (): void => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        chart.resize(el.clientWidth, el.clientHeight)
      }
    }
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    resize()

    return () => {
      observer.disconnect()
      chart.unsubscribeCrosshairMove(onCrosshairMove)
      chart.remove()
      candleRef.current = null
      volumeRef.current = null
    }
  }, [])

  useEffect(() => {
    const { candles, volumes } = barsToChartData(bars)
    candleRef.current?.setData(candles)
    volumeRef.current?.setData(volumes)
  }, [bars])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', minHeight: 0 }}
      />
      <PriceLegend bar={hoverBar ?? defaultBar} />
    </div>
  )
}

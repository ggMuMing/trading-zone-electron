import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import Typography from '@mui/material/Typography'
import Close from '@mui/icons-material/Close'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  HistogramSeries,
  LineSeries,
  createChart,
  type AutoscaleInfo,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time
} from 'lightweight-charts'
import { isoToYyyymmdd } from '../../../../shared/constants/market'
import { isChartUniverseIndexCode } from '../../../../shared/constants/chartUniverse'
import { closesFromBars, type PaperCloseBook } from '../../../../shared/paper/paperAccount'
import {
  paperArchiveStats,
  type PaperArchiveCurvePoint
} from '../../../../shared/paper/paperArchiveStats'
import type { AdjustType } from '../../../../shared/types/market'
import type { PaperArchive } from '../../../../shared/types/paperArchive'
import { lwcChromeOptions, useChartChrome } from '../../theme/chartChrome'
import { CHART_ICON_SX, ChartIconButton } from '../chart/ChartIconButton'

const POSITION_COLOR = '#00897b'
const POSITION_BAR_COLOR = '#ef6c00'
const RETURN_UP_COLOR = '#ef5350'
const RETURN_DOWN_COLOR = '#26a69a'
const EQUITY_LINE_STRETCH = 1.7
const RETURN_BAR_STRETCH = 0.72
const POSITION_LINE_STRETCH = 0.95
const POSITION_BAR_STRETCH = 0.68

export function PaperArchivePanel({
  open,
  record,
  adjust,
  onClose
}: {
  open: boolean
  record: PaperArchive | null
  adjust: AdjustType
  onClose: () => void
}): React.JSX.Element {
  return (
    <Dialog
      fullScreen
      open={open && record !== null}
      onClose={onClose}
      aria-labelledby="paper-archive-panel-title"
      slotProps={{
        paper: {
          sx: {
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column'
          }
        }
      }}
    >
      {open && record ? (
        <ArchivePanelBody key={record.id} record={record} adjust={adjust} onClose={onClose} />
      ) : null}
    </Dialog>
  )
}

function ArchivePanelBody({
  record,
  adjust,
  onClose
}: {
  record: PaperArchive
  adjust: AdjustType
  onClose: () => void
}): React.JSX.Element {
  const codes = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const trade of record.trades) {
      if (!trade.tsCode || seen.has(trade.tsCode)) {
        continue
      }
      seen.add(trade.tsCode)
      list.push(trade.tsCode)
    }
    return list
  }, [record])
  const [closes, setCloses] = useState<PaperCloseBook>({})
  const [closesReady, setClosesReady] = useState(codes.length === 0)

  useEffect(() => {
    if (codes.length === 0) {
      setCloses({})
      setClosesReady(true)
      return
    }
    let cancelled = false
    setClosesReady(false)
    void loadArchiveCloses(codes, record.startedOn, record.endedOn, adjust).then((book) => {
      if (cancelled) {
        return
      }
      setCloses(book)
      setClosesReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [adjust, codes, record.endedOn, record.startedOn])

  const stats = useMemo(() => paperArchiveStats(record, closes), [record, closes])
  const showCurve = closesReady
  const priceNote =
    showCurve && stats.hadPosition && !stats.pricedByClose
      ? '没有读到日线，资金和持仓按成交价计算。'
      : null

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            id="paper-archive-panel-title"
            variant="subtitle1"
            noWrap
            sx={{ fontWeight: 700 }}
          >
            {record.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {record.startedOn} 至 {record.endedOn} · {record.durationDays}天
          </Typography>
        </Box>
        <ChartIconButton ariaLabel="关闭" title="关闭" roomy onClick={onClose}>
          <Close sx={CHART_ICON_SX} />
        </ChartIconButton>
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          px: 2,
          pt: 1.5,
          pb: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 1.5
        }}
      >
        <Metric label="初始资金" value={formatYuan(stats.initialCapital)} />
        <Metric label="结算资金" value={formatYuan(stats.settlementCapital)} />
        <Metric label="总资产" value={formatYuan(stats.totalAssets)} />
        <Metric
          label="总收益率"
          value={formatSignedPct(stats.totalReturn)}
          color={signedColor(stats.totalReturn)}
        />
        <Metric
          label="最大回撤"
          value={showCurve ? formatPlainPct(stats.maxDrawdown) : '…'}
          color={showCurve ? signedColor(stats.maxDrawdown ? -stats.maxDrawdown : 0) : undefined}
        />
        <Metric label="交易笔数" value={formatCount(stats.closedCount)} />
        <Metric
          label="获胜笔数"
          value={formatCount(stats.winCount)}
          color={stats.winCount > 0 ? 'error.main' : undefined}
        />
        <Metric
          label="失败笔数"
          value={formatCount(stats.lossCount)}
          color={stats.lossCount > 0 ? 'success.main' : undefined}
        />
        <Metric label="胜率" value={formatPlainPct(stats.winRate)} />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ px: 2, pb: 1, flexShrink: 0 }}>
        清仓算一笔：盈利为胜，不盈利为负，未清仓不计入。
      </Typography>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          px: 2,
          pb: 2
        }}
      >
        <Box sx={{ flex: '1 1 520px', minHeight: 520, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
            资金变化
          </Typography>
          <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {showCurve ? (
              <EquityChart points={stats.points} initialCapital={stats.initialCapital} />
            ) : (
              <CurvePending />
            )}
          </Box>
        </Box>
        {priceNote ? (
          <Typography variant="caption" color="text.secondary">
            {priceNote}
          </Typography>
        ) : null}
      </Box>
    </Box>
  )
}

function Metric({
  label,
  value,
  color
}: {
  label: string
  value: string
  color?: string
}): React.JSX.Element {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography
        variant="body1"
        sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: color ?? 'text.primary' }}
      >
        {value}
      </Typography>
    </Box>
  )
}

function CurvePending(): React.JSX.Element {
  return (
    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        正在读取日线…
      </Typography>
    </Box>
  )
}

function EquityChart({
  points,
  initialCapital
}: {
  points: readonly PaperArchiveCurvePoint[]
  initialCapital: number
}): React.JSX.Element {
  const chrome = useChartChrome()
  const chromeRef = useRef(chrome)
  chromeRef.current = chrome
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const [hoverEquity, setHoverEquity] = useState<number | null>(null)
  const hoverRef = useRef<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || points.length === 0) {
      return
    }
    hoverRef.current = null
    setHoverEquity(null)
    const initial = chromeRef.current
    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      ...lwcChromeOptions(initial),
      rightPriceScale: { borderColor: initial.scaleBorder, borderVisible: false, visible: false },
      leftPriceScale: { borderColor: initial.scaleBorder, borderVisible: false, visible: true },
      timeScale: { borderColor: initial.scaleBorder, borderVisible: false, rightOffset: 4 }
    })
    chart.addPane(false)
    chart.addPane(false)
    chart.addPane(false)
    const panes = chart.panes()
    panes[0]?.setStretchFactor(EQUITY_LINE_STRETCH)
    panes[1]?.setStretchFactor(RETURN_BAR_STRETCH)
    panes[2]?.setStretchFactor(POSITION_LINE_STRETCH)
    panes[3]?.setStretchFactor(POSITION_BAR_STRETCH)
    const series = chart.addSeries(
      LineSeries,
      {
        color: initial.seriesBlue,
        lineWidth: 2,
        priceScaleId: 'left',
        lastValueVisible: true,
        priceLineVisible: false,
        priceFormat: yuanPriceFormat()
      },
      0
    )
    const returns = chart.addSeries(
      HistogramSeries,
      {
        priceScaleId: 'left',
        lastValueVisible: false,
        priceLineVisible: false,
        priceFormat: {
          type: 'custom',
          minMove: 0.01,
          formatter: (price: number) => formatAxisReturn(price)
        },
        autoscaleInfoProvider: (original) => includeZeroInScale(original())
      },
      1
    )
    const positionAmount = chart.addSeries(
      LineSeries,
      {
        color: POSITION_COLOR,
        lineWidth: 2,
        priceScaleId: 'left',
        lastValueVisible: true,
        priceLineVisible: false,
        priceFormat: yuanPriceFormat()
      },
      2
    )
    const positionRatio = chart.addSeries(
      HistogramSeries,
      {
        color: POSITION_BAR_COLOR,
        priceScaleId: 'left',
        lastValueVisible: true,
        priceLineVisible: false,
        priceFormat: {
          type: 'custom',
          minMove: 0.1,
          formatter: (price: number) => `${price.toFixed(0)}%`
        },
        autoscaleInfoProvider: () => ({
          priceRange: { minValue: 0, maxValue: 100 }
        })
      },
      3
    )
    series.setData(points.map((point) => ({ time: point.date as Time, value: point.equity })))
    returns.setData(returnBars(points))
    positionAmount.setData(
      points.map((point) => ({ time: point.date as Time, value: point.marketValue }))
    )
    positionRatio.setData(
      points.map((point) => ({
        time: point.date as Time,
        value: point.positionRatio * 100,
        color: POSITION_BAR_COLOR
      }))
    )
    const equityByDate = new Map(points.map((point) => [point.date, point.equity]))
    const onCrosshairMove = (param: MouseEventParams<Time>): void => {
      const next = equityAtCrosshair(param, equityByDate)
      if (hoverRef.current === next) {
        return
      }
      hoverRef.current = next
      setHoverEquity(next)
    }
    chart.subscribeCrosshairMove(onCrosshairMove)
    chart.priceScale('left', 1).applyOptions({
      borderVisible: false,
      scaleMargins: { top: 0.12, bottom: 0.12 }
    })
    chart.priceScale('left', 3).applyOptions({
      borderVisible: false,
      scaleMargins: { top: 0.05, bottom: 0 }
    })
    chart.timeScale().fitContent()
    chartRef.current = chart
    seriesRef.current = series
    const unbind = bindChartResize(chart, el)
    return () => {
      unbind()
      chart.unsubscribeCrosshairMove(onCrosshairMove)
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [points])

  useEffect(() => {
    chartRef.current?.applyOptions(lwcChromeOptions(chrome))
    seriesRef.current?.applyOptions({ color: chrome.seriesBlue })
  }, [chrome])

  if (points.length === 0) {
    return <CurveMessage text="暂无资金曲线" />
  }
  const latestEquity = points[points.length - 1]?.equity ?? null
  const cumulative = cumulativeReturn(hoverEquity ?? latestEquity, initialCapital)
  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      <Box ref={containerRef} sx={{ width: '100%', height: '100%' }} />
      <SeriesLegend
        items={[
          { color: chrome.seriesBlue, label: '总资产', bar: false },
          { color: RETURN_UP_COLOR, label: '正收益', bar: true },
          { color: RETURN_DOWN_COLOR, label: '负收益', bar: true },
          { color: POSITION_COLOR, label: '持仓金额', bar: false },
          { color: POSITION_BAR_COLOR, label: '仓位', bar: true },
          {
            color: chrome.seriesBlue,
            label: '累加收益',
            bar: false,
            swatch: false,
            value: formatSignedPct(cumulative),
            valueColor: signedColor(cumulative)
          }
        ]}
      />
    </Box>
  )
}

function SeriesLegend({
  items
}: {
  items: ReadonlyArray<{
    color: string
    label: string
    bar: boolean
    swatch?: boolean
    value?: string
    valueColor?: string
  }>
}): React.JSX.Element {
  const chrome = useChartChrome()
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 4,
        left: 0,
        right: 0,
        zIndex: 2,
        display: 'flex',
        justifyContent: 'center',
        gap: 1.5,
        flexWrap: 'wrap',
        pointerEvents: 'none'
      }}
    >
      {items.map((item) => (
        <Box
          key={item.label}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            fontSize: 12,
            color: chrome.text
          }}
        >
          {item.swatch === false ? null : (
            <Box
              sx={{
                width: 14,
                height: item.bar ? 8 : 0,
                borderTop: item.bar ? undefined : `2px solid ${item.color}`,
                bgcolor: item.bar ? item.color : undefined
              }}
            />
          )}
          {item.label}
          {item.value ? (
            <Box
              component="span"
              sx={{
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: item.valueColor ?? 'text.primary'
              }}
            >
              {item.value}
            </Box>
          ) : null}
        </Box>
      ))}
    </Box>
  )
}

function CurveMessage({ text }: { text: string }): React.JSX.Element {
  return (
    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        {text}
      </Typography>
    </Box>
  )
}

function returnBarColor(rate: number): string {
  if (rate > 0) {
    return RETURN_UP_COLOR
  }
  if (rate < 0) {
    return RETURN_DOWN_COLOR
  }
  return '#9e9e9e'
}

function equityAtCrosshair(
  param: MouseEventParams<Time>,
  equityByDate: ReadonlyMap<string, number>
): number | null {
  if (!param.time) {
    return null
  }
  const equity = equityByDate.get(chartTimeKey(param.time))
  return equity === undefined ? null : equity
}

function chartTimeKey(time: Time): string {
  if (typeof time === 'string') {
    return time
  }
  if (typeof time === 'number') {
    return String(time)
  }
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${time.year}-${pad(time.month)}-${pad(time.day)}`
}

function cumulativeReturn(equity: number | null, initial: number): number | null {
  if (equity === null || !(initial > 0) || !Number.isFinite(equity)) {
    return null
  }
  return (equity - initial) / initial
}

function returnBars(
  points: readonly PaperArchiveCurvePoint[]
): Array<{ time: Time; value: number; color: string }> {
  const bars: Array<{ time: Time; value: number; color: string }> = []
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const point = points[index]
    if (!previous || !point || !(previous.equity > 0)) {
      continue
    }
    const rate = ((point.equity - previous.equity) / previous.equity) * 100
    bars.push({
      time: point.date as Time,
      value: rate,
      color: returnBarColor(rate)
    })
  }
  return bars
}

function includeZeroInScale(info: AutoscaleInfo | null): AutoscaleInfo | null {
  if (info?.priceRange == null) {
    return { priceRange: { minValue: -1, maxValue: 1 } }
  }
  const minValue = Math.min(0, info.priceRange.minValue)
  const maxValue = Math.max(0, info.priceRange.maxValue)
  if (minValue === maxValue) {
    return { ...info, priceRange: { minValue: -1, maxValue: 1 } }
  }
  return { ...info, priceRange: { minValue, maxValue } }
}

function formatAxisReturn(price: number): string {
  const sign = price > 0 ? '+' : ''
  return `${sign}${price.toFixed(2)}%`
}

function bindChartResize(chart: IChartApi, el: HTMLElement): () => void {
  let seen = el.clientWidth > 0 && el.clientHeight > 0
  const observer = new ResizeObserver(() => {
    const width = el.clientWidth
    const height = el.clientHeight
    chart.applyOptions({ width, height })
    if (!seen && width > 0 && height > 0) {
      seen = true
      chart.timeScale().fitContent()
    }
  })
  observer.observe(el)
  return () => observer.disconnect()
}

function yuanPriceFormat(): {
  type: 'custom'
  minMove: number
  formatter: (price: number) => string
} {
  return {
    type: 'custom',
    minMove: 0.01,
    formatter: (price: number) => price.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
  }
}

async function loadArchiveCloses(
  codes: readonly string[],
  startedOn: string,
  endedOn: string,
  adjust: AdjustType
): Promise<PaperCloseBook> {
  const start = isoToYyyymmdd(startedOn)
  const end = isoToYyyymmdd(endedOn)
  if (start > end) {
    return {}
  }
  const rows = await Promise.all(
    codes.map(async (code) => {
      try {
        const result = await window.api.market.query({
          ts_code: code,
          adjust: isChartUniverseIndexCode(code) ? 'none' : adjust,
          start_date: start,
          end_date: end
        })
        return [code, closesFromBars(result.bars)] as const
      } catch {
        return [code, {}] as const
      }
    })
  )
  return Object.fromEntries(rows)
}

function formatYuan(value: number): string {
  if (!Number.isFinite(value)) {
    return '—'
  }
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatCount(value: number): string {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

function formatSignedPct(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) {
    return '—'
  }
  const pct = rate * 100
  const text = pct.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${pct > 0 ? '+' : ''}${text}%`
}

function formatPlainPct(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate)) {
    return '—'
  }
  const pct = rate * 100
  return `${pct.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

function signedColor(value: number | null): string | undefined {
  if (value === null || !Number.isFinite(value) || value === 0) {
    return undefined
  }
  return value > 0 ? 'error.main' : 'success.main'
}

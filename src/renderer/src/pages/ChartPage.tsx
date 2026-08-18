import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import GroupAddIcon from '@mui/icons-material/GroupAdd'
import RefreshIcon from '@mui/icons-material/Refresh'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { validateChartInput } from '../../../shared/chart/validateChartInput'
import { MARKET_SYNC_START, todayYyyymmdd } from '../../../shared/constants/market'
import type { ChartInput } from '../../../shared/types/chart'
import type { AdjustType, MarketCoverageResult } from '../../../shared/types/market'
import type { Stock } from '../../../shared/types/stock'
import { KlineChart } from './chart/KlineChart'
import { StockPicker } from './StockPicker'

function stripMacdPane(input: ChartInput): ChartInput {
  const primitives = input.primitives.filter((primitive) => primitive.pane !== 'macd')
  const series: ChartInput['series'] = {}
  for (const primitive of primitives) {
    series[primitive.id] = input.series[primitive.id] ?? []
  }
  return {
    ...input,
    primitives,
    series
  }
}

const PICKER_WIDTH_STORAGE_KEY = 'trading-zone.chart.stockPickerWidth'
const PICKER_WIDTH_MIN = 180
const PICKER_WIDTH_MAX = 320
const PICKER_WIDTH_DEFAULT = 220

function clampPickerWidth(value: number): number {
  return Math.min(PICKER_WIDTH_MAX, Math.max(PICKER_WIDTH_MIN, Math.round(value)))
}

function loadPickerWidth(): number {
  try {
    const raw = localStorage.getItem(PICKER_WIDTH_STORAGE_KEY)
    if (!raw) {
      return PICKER_WIDTH_DEFAULT
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      return PICKER_WIDTH_DEFAULT
    }
    return clampPickerWidth(parsed)
  } catch {
    return PICKER_WIDTH_DEFAULT
  }
}

export function ChartPage(): React.JSX.Element {
  const [loading, setLoading] = useState(true)
  const [querying, setQuerying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stocks, setStocks] = useState<Stock[]>([])
  const [coverage, setCoverage] = useState<MarketCoverageResult | null>(null)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [adjust, setAdjust] = useState<AdjustType>('none')
  const [chartRaw, setChartRaw] = useState<ChartInput | null>(null)
  const [pickerWidth, setPickerWidth] = useState(loadPickerWidth)
  const [resizing, setResizing] = useState(false)
  const [showMacd, setShowMacd] = useState(true)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const pickerWidthRef = useRef(pickerWidth)
  pickerWidthRef.current = pickerWidth

  const loadStocksAndCoverage = async (): Promise<void> => {
    const [listed, cov] = await Promise.all([
      window.api.stocks.list(),
      window.api.market.coverage()
    ])
    setStocks(listed)
    setCoverage(cov)
    setSelectedCode((prev) => {
      if (prev && listed.some((stock) => stock.ts_code === prev)) {
        return prev
      }
      return listed[0]?.ts_code ?? null
    })
  }

  const refreshAll = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      await loadStocksAndCoverage()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const queryEnd = coverage?.max_date || todayYyyymmdd()

  const loadChart = useCallback(async (tsCode: string, adj: AdjustType, endDate: string): Promise<void> => {
    setQuerying(true)
    setError(null)
    try {
      const result = await window.api.chart.build({
        ts_code: tsCode,
        adjust: adj,
        start_date: MARKET_SYNC_START,
        end_date: endDate
      })
      setChartRaw(result)
    } catch (err: unknown) {
      setChartRaw(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setQuerying(false)
    }
  }, [])

  useEffect(() => {
    void refreshAll()
  }, [])

  useEffect(() => {
    if (selectedCode) {
      void loadChart(selectedCode, adjust, queryEnd)
    } else {
      setChartRaw(null)
    }
  }, [selectedCode, adjust, queryEnd, loadChart])

  useEffect(() => {
    if (!resizing) {
      return
    }
    const previousCursor = document.body.style.cursor
    const previousSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousSelect
    }
  }, [resizing])

  const persistPickerWidth = (value: number): void => {
    localStorage.setItem(PICKER_WIDTH_STORAGE_KEY, String(value))
  }

  const handleSplitterPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeRef.current = { startX: event.clientX, startWidth: pickerWidth }
    setResizing(true)
  }

  const handleSplitterPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = resizeRef.current
    if (!drag) {
      return
    }
    setPickerWidth(clampPickerWidth(drag.startWidth + event.clientX - drag.startX))
  }

  const handleSplitterPointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!resizeRef.current) {
      return
    }
    resizeRef.current = null
    setResizing(false)
    persistPickerWidth(pickerWidthRef.current)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const isEmpty = stocks.length === 0
  const selected = stocks.find((stock) => stock.ts_code === selectedCode)
  const chartInput = useMemo(() => {
    if (!chartRaw) {
      return null
    }
    const result = validateChartInput(chartRaw)
    if (!result.ok) {
      return { error: result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ') }
    }
    const value = showMacd ? result.value : stripMacdPane(result.value)
    return { value }
  }, [chartRaw, showMacd])

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}
      >
        <Typography variant="h6" fontWeight={700}>
          图表
        </Typography>
        <Chip
          size="small"
          variant="outlined"
          label={
            coverage
              ? `行情 ${coverage.total_bars} 行 / 股票 ${stocks.length}`
              : `股票 ${stocks.length}`
          }
        />
        <Chip size="small" variant="outlined" label={`${MARKET_SYNC_START}–${queryEnd}`} />
        <Box sx={{ flexGrow: 1 }} />
        <IconButton aria-label="刷新" onClick={() => void refreshAll()} disabled={loading || querying}>
          <RefreshIcon />
        </IconButton>
      </Stack>

      {error ? (
        <Box sx={{ px: 2, pt: 1 }}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Box>
      ) : null}

      {isEmpty && !loading ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
          <Paper elevation={0} sx={{ p: 4, maxWidth: 480, border: 1, borderColor: 'divider', textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              尚未同步股票列表
            </Typography>
            <Typography variant="body2" color="text.secondary">
              请先到配置页更新数据。成功后本页可浏览全部股票并查看日线 K 线。
            </Typography>
          </Paper>
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', minHeight: 0, px: 2, py: 2, gap: 0.5 }}>
          <StockPicker
            stocks={stocks}
            selectedCode={selectedCode}
            width={pickerWidth}
            onSelect={setSelectedCode}
          />
          <Box
            role="separator"
            aria-orientation="vertical"
            aria-label="调整股票列表宽度"
            aria-valuemin={PICKER_WIDTH_MIN}
            aria-valuemax={PICKER_WIDTH_MAX}
            aria-valuenow={pickerWidth}
            onPointerDown={handleSplitterPointerDown}
            onPointerMove={handleSplitterPointerMove}
            onPointerUp={handleSplitterPointerUp}
            onPointerCancel={handleSplitterPointerUp}
            sx={{
              width: 8,
              flexShrink: 0,
              cursor: 'col-resize',
              alignSelf: 'stretch',
              position: 'relative',
              touchAction: 'none',
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 8,
                bottom: 8,
                left: '50%',
                width: 2,
                transform: 'translateX(-50%)',
                borderRadius: 1,
                bgcolor: resizing ? 'primary.main' : 'divider'
              },
              '&:hover::after': {
                bgcolor: 'primary.main'
              }
            }}
          />

          <Paper
            elevation={0}
            sx={{
              flex: 1,
              border: 1,
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              overflow: 'hidden'
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ sm: 'center' }}
              sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
            >
              <Typography variant="subtitle2" noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
                {selected ? `${selected.name ?? selected.ts_code}（${selected.ts_code}）` : '请选择股票'}
              </Typography>
              <Button size="small" startIcon={<GroupAddIcon />} disabled>
                加入分组
              </Button>
              <Button size="small" startIcon={<TrendingUpIcon />} disabled>
                指标
              </Button>
              <Chip
                size="small"
                label="MACD"
                color={showMacd ? 'primary' : 'default'}
                variant={showMacd ? 'filled' : 'outlined'}
                onClick={() => setShowMacd((prev) => !prev)}
                disabled={!selectedCode || querying || !chartRaw}
              />
              <ToggleButtonGroup
                size="small"
                exclusive
                value={adjust}
                onChange={(_e, value: AdjustType | null) => {
                  if (value) {
                    setAdjust(value)
                  }
                }}
                disabled={!selectedCode || querying}
              >
                <ToggleButton value="none">未复权</ToggleButton>
                <ToggleButton value="qfq">前复权</ToggleButton>
                <ToggleButton value="hfq">后复权</ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
              {!selectedCode ? (
                <Box
                  sx={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    请从左侧选择股票
                  </Typography>
                </Box>
              ) : !chartRaw ? (
                <Box
                  sx={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {querying || loading ? '加载中…' : '暂无日线数据'}
                  </Typography>
                </Box>
              ) : chartInput && 'error' in chartInput ? (
                <Box
                  sx={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: 2
                  }}
                >
                  <Typography variant="body2" color="error">
                    图表数据无效：{chartInput.error}
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ position: 'absolute', inset: 0, opacity: querying ? 0.7 : 1 }}>
                  {chartInput && 'value' in chartInput ? <KlineChart input={chartInput.value} /> : null}
                </Box>
              )}
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  )
}

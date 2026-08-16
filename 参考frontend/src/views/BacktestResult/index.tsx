import UploadFileIcon from '@mui/icons-material/UploadFile'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import {
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getChartLayout, getSelectedStrategies, getStockDailyData } from '../../api/api'
import type { StockDailyData } from '../../api/apiType'
import ChartComponent from '../../components/ChartComponent/ChartComponent'
import IndicatorSelectDialog from '../../components/ChartComponent/IndicatorSelectDialog'
import { syncChartLayout, syncSelectedStrategies } from '../../components/ChartComponent/ChartComponentProxy'
import { SeperatorBox, StyledButton } from '../../components/styled'
import { downColor, upColor } from '../../static'
import { parseBacktestResultJson, type BacktestInterval, type BacktestResult } from './types'

function formatPct(value: number) {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(2)}%`
}

function pctColor(value: number) {
  if (value > 0) return upColor
  if (value < 0) return downColor
  return undefined
}

function StatItem(props: { label: string, value: string, color?: string }) {
  const { label, value, color } = props
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
      <Typography variant="caption" sx={{ opacity: 0.65 }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, color: color || 'inherit' }}>{value}</Typography>
    </Box>
  )
}

export default function BacktestResultView() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const [selectedIntervalIndex, setSelectedIntervalIndex] = useState<number | null>(null)
  const [chartData, setChartData] = useState<StockDailyData[]>([])
  const [chartLoading, setChartLoading] = useState(false)
  const [indicatorOpen, setIndicatorOpen] = useState(false)
  const [autoOpenConfigInstanceId, setAutoOpenConfigInstanceId] = useState<string | null>(null)

  const selectedInterval = useMemo<BacktestInterval | null>(() => {
    if (!backtestResult || selectedIntervalIndex === null) return null
    return backtestResult.intervals[selectedIntervalIndex] ?? null
  }, [backtestResult, selectedIntervalIndex])

  const tradeMarkers = useMemo(() => {
    if (!backtestResult) return []
    return backtestResult.intervals.flatMap((interval, index) => [
      {
        time: interval.entry_date,
        position: 'belowBar' as const,
        shape: 'arrowUp' as const,
        color: upColor,
        text: `买${index + 1}`,
      },
      {
        time: interval.exit_date,
        position: 'aboveBar' as const,
        shape: 'arrowDown' as const,
        color: downColor,
        text: `卖${index + 1}`,
      },
    ])
  }, [backtestResult])

  const statRange = useMemo(() => {
    if (!selectedInterval) return null
    return {
      startDate: selectedInterval.entry_date,
      endDate: selectedInterval.exit_date,
    }
  }, [selectedInterval])

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setParseError('')
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      const result = parseBacktestResultJson(parsed)
      if ('error' in result) {
        setParseError(result.error)
        return
      }

      setBacktestResult(result.data)
      setFileName(file.name)
      setSelectedIntervalIndex(result.data.intervals.length > 0 ? 0 : null)
    } catch {
      setParseError('JSON 解析失败，请检查文件格式')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [layout, selected] = await Promise.all([getChartLayout(), getSelectedStrategies()])
      if (cancelled) return
      syncChartLayout(layout)
      syncSelectedStrategies(selected)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!backtestResult?.symbol) {
      setChartData([])
      return
    }

    let cancelled = false
    ;(async () => {
      setChartLoading(true)
      const rows = await getStockDailyData(backtestResult.symbol, backtestResult.adjust)
      if (!cancelled) {
        setChartData(rows)
        setChartLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [backtestResult?.symbol, backtestResult?.adjust])

  const summaryText = backtestResult?.summary
    ? `平均持续 ${backtestResult.summary.avg_duration.toFixed(1)} 天 · 平均收益 ${formatPct(backtestResult.summary.avg_return_pct)}`
    : ''

  return (
    <Paper variant="outlined" sx={{ height: '100%', padding: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingTop: 0 }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => void handleFileChange(event)}
      />

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', gap: 1, overflow: 'hidden' }}>
        <Paper variant="outlined" sx={{ width: 360, flexShrink: 0, p: 1, display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>回测结果</Typography>
            <StyledButton
              size="small"
              startIcon={<UploadFileIcon />}
              onClick={handleImportClick}
            >
              导入 JSON
            </StyledButton>
          </Box>

          {fileName ? (
            <Typography variant="caption" sx={{ opacity: 0.75, wordBreak: 'break-all' }}>
              文件：{fileName}
            </Typography>
          ) : null}

          {parseError ? (
            <Typography variant="caption" color="error">{parseError}</Typography>
          ) : null}

          {backtestResult ? (
            <>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {backtestResult.symbol}
                {' · '}
                {backtestResult.adjust === 'qfq' ? '前复权' : backtestResult.adjust === 'hfq' ? '后复权' : '不复权'}
              </Typography>

              {backtestResult.data_range ? (
                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                  数据区间：{backtestResult.data_range.start} ~ {backtestResult.data_range.end}
                </Typography>
              ) : null}

              {summaryText ? (
                <Typography variant="caption" sx={{ opacity: 0.75 }}>
                  {summaryText}
                </Typography>
              ) : null}

              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                共 {backtestResult.interval_count ?? backtestResult.intervals.length} 个交易区间
              </Typography>
            </>
          ) : (
            <Typography variant="body2" sx={{ opacity: 0.65 }}>
              请导入 vectorbt 回测导出的 JSON 文件
            </Typography>
          )}

          <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {!backtestResult ? (
              <Typography variant="body2" sx={{ p: 1, opacity: 0.65 }}>暂无区间数据</Typography>
            ) : (
              <List dense disablePadding>
                {backtestResult.intervals.map((interval, index) => (
                  <ListItem key={`${interval.entry_date}-${interval.exit_date}-${index}`} disablePadding>
                    <ListItemButton
                      selected={selectedIntervalIndex === index}
                      onClick={() => setSelectedIntervalIndex(index)}
                    >
                      <ListItemText
                        primary={`#${index + 1} ${interval.entry_date} → ${interval.exit_date}`}
                        secondary={`${interval.duration} 天 · 收益 ${formatPct(interval.return_pct)}`}
                        primaryTypographyProps={{ fontSize: 13, fontWeight: 700 }}
                        secondaryTypographyProps={{
                          fontSize: 12,
                          sx: { color: pctColor(interval.return_pct) },
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Paper>

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Paper variant="outlined" sx={{ margin: '5px 0', padding: '5px 2px', flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ px: 1, minWidth: 160, fontSize: 15, fontWeight: 700 }}>
                {backtestResult?.symbol || '未导入回测数据'}
              </Typography>
              <SeperatorBox />
              <StyledButton
                startIcon={<TrendingUpIcon />}
                size="small"
                sx={{ height: '32px' }}
                disabled={!backtestResult}
                onClick={() => setIndicatorOpen(true)}
              >
                Indicators
              </StyledButton>
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {chartLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (!backtestResult || chartData.length === 0) ? (
              <Box sx={{ p: 1 }}>
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  {backtestResult ? '暂无 K 线数据' : '导入 JSON 后查看图表'}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <ChartComponent
                  chartData={chartData}
                  stockCode={backtestResult.symbol}
                  adjust={backtestResult.adjust}
                  tradeMarkers={tradeMarkers}
                  statRange={statRange}
                  openIndicatorsConfig={(instanceId) => {
                    setAutoOpenConfigInstanceId(instanceId)
                    setIndicatorOpen(true)
                  }}
                />
              </Box>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ mt: 1, p: 1.5, flexShrink: 0, minHeight: 96 }}>
            {!selectedInterval ? (
              <Typography variant="body2" sx={{ opacity: 0.65 }}>
                选择左侧交易区间查看详细回测数据
              </Typography>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1.5 }}>
                <StatItem label="入场日期" value={selectedInterval.entry_date} />
                <StatItem label="离场日期" value={selectedInterval.exit_date} />
                <StatItem label="持续天数" value={`${selectedInterval.duration} 天`} />
                <StatItem
                  label="区间收益"
                  value={formatPct(selectedInterval.return_pct)}
                  color={pctColor(selectedInterval.return_pct)}
                />
                <StatItem label="入场价" value={selectedInterval.entry_price.toFixed(4)} />
                <StatItem label="离场价" value={selectedInterval.exit_price.toFixed(4)} />
                <StatItem
                  label="最大涨幅"
                  value={formatPct(selectedInterval.max_gain_pct)}
                  color={pctColor(selectedInterval.max_gain_pct)}
                />
                <StatItem
                  label="最大回撤"
                  value={formatPct(selectedInterval.max_drawdown_pct)}
                  color={pctColor(selectedInterval.max_drawdown_pct)}
                />
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      <IndicatorSelectDialog
        isOpen={indicatorOpen}
        autoOpenConfigForInstanceId={autoOpenConfigInstanceId}
        configOnly={Boolean(autoOpenConfigInstanceId)}
        onClose={() => {
          setIndicatorOpen(false)
          setAutoOpenConfigInstanceId(null)
        }}
      />
    </Paper>
  )
}

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ArrowDownward from '@mui/icons-material/ArrowDownward'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import Close from '@mui/icons-material/Close'
import PlayArrow from '@mui/icons-material/PlayArrow'
import PlayCircleOutline from '@mui/icons-material/PlayCircleOutline'
import Refresh from '@mui/icons-material/Refresh'
import Search from '@mui/icons-material/Search'
import SkipNext from '@mui/icons-material/SkipNext'
import SkipPrevious from '@mui/icons-material/SkipPrevious'
import Stop from '@mui/icons-material/Stop'
import ViewColumn from '@mui/icons-material/ViewColumn'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { isoToYyyymmdd, yyyymmddToIso } from '../../../../shared/constants/market'
import type { AdjustType } from '../../../../shared/types/market'
import type { StrategyRunResult } from '../../../../shared/types/pythonProtocol'
import { CHART_ICON_SX, ChartIconButton } from './ChartIconButton'
import { SettingsTab, SettingsTabs } from './SettingsTabs'
import {
  highlightKindOf,
  isSignalTruthy,
  markersFromSeries,
  rowTimeIso,
  type StrategyChartOverlay
} from './strategyOverlay'

export interface StrategyPanelProps {
  strategyId: string
  strategyName: string
  tsCode: string | null
  adjust: AdjustType
  defaultStart: string
  defaultEnd: string
  disabled?: boolean
  onClose: () => void
  onOverlayChange: (overlay: StrategyChartOverlay | null) => void
}

type SeriesTab = 'buy' | 'sell' | 'mixed' | 'custom'

const REQUIRED_COLUMNS = [
  'time',
  'open',
  'high',
  'low',
  'close',
  'vol',
  'buy_signal',
  'sell_signal'
] as const

const COLUMN_LABELS: Record<string, string> = {
  time: '日期',
  open: '开',
  high: '高',
  low: '低',
  close: '收',
  vol: '量',
  buy_signal: '买点',
  sell_signal: '卖点'
}

const STAT_LABELS: Record<string, string> = {
  buy_count: '买入信号数量',
  bar_count: '总K线数'
}

/** Inclusive calendar days allowed in the custom-data filter. */
const CUSTOM_RANGE_MAX_DAYS = 200

function parseIsoDay(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return null
  }
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }
  return date
}

function formatIsoDay(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addIsoDays(iso: string, days: number): string {
  const date = parseIsoDay(iso)
  if (!date) {
    return iso
  }
  date.setDate(date.getDate() + days)
  return formatIsoDay(date)
}

function inclusiveDayCount(startIso: string, endIso: string): number | null {
  const start = parseIsoDay(startIso)
  const end = parseIsoDay(endIso)
  if (!start || !end) {
    return null
  }
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
}

function clampIsoRangeToMaxDays(
  startIso: string,
  endIso: string,
  maxDays: number
): { start: string; end: string } {
  const start = parseIsoDay(startIso)
  const end = parseIsoDay(endIso)
  if (!start || !end) {
    return { start: startIso, end: endIso }
  }
  if (end < start) {
    return { start: endIso, end: endIso }
  }
  const count = inclusiveDayCount(startIso, endIso)
  if (count !== null && count <= maxDays) {
    return { start: startIso, end: endIso }
  }
  return { start: addIsoDays(endIso, -(maxDays - 1)), end: endIso }
}

function formatCell(key: string, value: unknown): string {
  if (value === null || value === undefined) {
    return '—'
  }
  if (key === 'time') {
    const text = String(value)
    return text.length === 8 ? yyyymmddToIso(text) : text
  }
  if (key === 'buy_signal' || key === 'sell_signal') {
    return isSignalTruthy(value) ? '是' : '否'
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否'
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return '—'
    }
    if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-9) {
      return String(Math.round(value))
    }
    return value.toFixed(4)
  }
  return String(value)
}

function formatStatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—'
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return String(value)
}

function rowTime(row: Record<string, unknown>): string {
  return String(row.time ?? '')
}

function isRowBelowVisible(row: HTMLElement, container: HTMLElement): boolean {
  const rowRect = row.getBoundingClientRect()
  const box = container.getBoundingClientRect()
  return rowRect.bottom > box.bottom + 1
}

export function StrategyPanel({
  strategyId,
  strategyName,
  tsCode,
  adjust,
  defaultStart,
  defaultEnd,
  disabled = false,
  onClose,
  onOverlayChange
}: StrategyPanelProps): React.JSX.Element {
  const [startDate, setStartDate] = useState(yyyymmddToIso(defaultStart))
  const [endDate, setEndDate] = useState(yyyymmddToIso(defaultEnd))
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<StrategyRunResult | null>(null)
  const [tab, setTab] = useState<SeriesTab>('buy')
  const [timeAsc, setTimeAsc] = useState(false)
  const [extraColumns, setExtraColumns] = useState<string[]>([])
  const [columnMenu, setColumnMenu] = useState<HTMLElement | null>(null)
  const columnButtonRef = useRef<HTMLSpanElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null)
  const pendingScrollRef = useRef<'next' | null>(null)
  const onOverlayChangeRef = useRef(onOverlayChange)
  onOverlayChangeRef.current = onOverlayChange
  const initialCustomRange = clampIsoRangeToMaxDays(
    yyyymmddToIso(defaultStart),
    yyyymmddToIso(defaultEnd),
    CUSTOM_RANGE_MAX_DAYS
  )
  const [customStart, setCustomStart] = useState(initialCustomRange.start)
  const [customEnd, setCustomEnd] = useState(initialCustomRange.end)
  const [appliedCustomStart, setAppliedCustomStart] = useState<string | null>(null)
  const [appliedCustomEnd, setAppliedCustomEnd] = useState<string | null>(null)
  const [replayActive, setReplayActive] = useState(false)
  const [replayIndex, setReplayIndex] = useState(0)

  const optionalColumns = useMemo(() => {
    const first = result?.series[0]
    if (!first) {
      return []
    }
    const required = new Set<string>(REQUIRED_COLUMNS)
    return Object.keys(first).filter((key) => !required.has(key))
  }, [result])

  const visibleColumns = useMemo(() => {
    const extra = extraColumns.filter((key) => optionalColumns.includes(key))
    return [...REQUIRED_COLUMNS, ...extra]
  }, [extraColumns, optionalColumns])

  const tabRows = useMemo(() => {
    const series = result?.series ?? []
    let rows: Record<string, unknown>[]
    if (tab === 'buy') {
      rows = series.filter((row) => isSignalTruthy(row.buy_signal))
    } else if (tab === 'sell') {
      rows = series.filter((row) => isSignalTruthy(row.sell_signal))
    } else if (tab === 'mixed') {
      rows = series.filter((row) => isSignalTruthy(row.buy_signal) || isSignalTruthy(row.sell_signal))
    } else if (appliedCustomStart && appliedCustomEnd) {
      rows = series.filter((row) => {
        const time = rowTime(row)
        return time >= appliedCustomStart && time <= appliedCustomEnd
      })
    } else {
      rows = []
    }
    const sorted = [...rows]
    sorted.sort((left, right) => {
      const cmp = rowTime(left).localeCompare(rowTime(right))
      return timeAsc ? cmp : -cmp
    })
    return sorted
  }, [appliedCustomEnd, appliedCustomStart, result, tab, timeAsc])

  const selectedIndex =
    replayActive && tabRows.length > 0 ? Math.min(Math.max(replayIndex, 0), tabRows.length - 1) : -1

  useEffect(() => {
    setResult(null)
    setError(null)
    setReplayActive(false)
    setReplayIndex(0)
    setExtraColumns([])
    setAppliedCustomStart(null)
    setAppliedCustomEnd(null)
  }, [tsCode, adjust])

  useEffect(() => {
    if (!result) {
      onOverlayChangeRef.current(null)
      return
    }
    const selected = selectedIndex >= 0 ? tabRows[selectedIndex] : undefined
    const overlay: StrategyChartOverlay = {
      markers: markersFromSeries(result.series),
      highlight:
        replayActive && selected
          ? { timeIso: rowTimeIso(selected), kind: highlightKindOf(selected) }
          : null
    }
    onOverlayChangeRef.current(overlay)
  }, [replayActive, result, selectedIndex, tabRows])

  useEffect(() => {
    return () => {
      onOverlayChangeRef.current(null)
    }
  }, [])

  useLayoutEffect(() => {
    if (pendingScrollRef.current !== 'next') {
      return
    }
    pendingScrollRef.current = null
    const row = selectedRowRef.current
    const list = listRef.current
    if (!row || !list || !isRowBelowVisible(row, list)) {
      return
    }
    row.scrollIntoView({ block: 'end', inline: 'nearest' })
  }, [selectedIndex])

  const resetReplay = (): void => {
    setReplayActive(false)
    setReplayIndex(0)
  }

  const handleRun = async (): Promise<void> => {
    if (!tsCode) {
      setError('请先选择标的')
      return
    }
    const start = isoToYyyymmdd(startDate)
    const end = isoToYyyymmdd(endDate)
    if (start.length !== 8 || end.length !== 8) {
      setError('请选择有效的起止日期')
      return
    }
    if (start > end) {
      setError('起始日不能晚于结束日')
      return
    }
    setRunning(true)
    setError(null)
    resetReplay()
    try {
      const next = await window.api.strategy.run({
        strategy_id: strategyId,
        ts_code: tsCode,
        start_date: start,
        end_date: end,
        adjust
      })
      setResult(next)
      setExtraColumns([])
      const nextCustom = clampIsoRangeToMaxDays(startDate, endDate, CUSTOM_RANGE_MAX_DAYS)
      setCustomStart(nextCustom.start)
      setCustomEnd(nextCustom.end)
      setAppliedCustomStart(null)
      setAppliedCustomEnd(null)
    } catch (err: unknown) {
      setResult(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }

  const handleCustomStartChange = (nextStart: string): void => {
    setCustomStart(nextStart)
  }

  const handleCustomEndChange = (nextEnd: string): void => {
    setCustomEnd(nextEnd)
  }

  const handleCustomQuery = (): void => {
    const start = isoToYyyymmdd(customStart)
    const end = isoToYyyymmdd(customEnd)
    if (start.length !== 8 || end.length !== 8) {
      setError('请选择有效的自选日期')
      return
    }
    if (start > end) {
      setError('自选起始日不能晚于结束日')
      return
    }
    const days = inclusiveDayCount(customStart, customEnd)
    if (days === null || days > CUSTOM_RANGE_MAX_DAYS) {
      setError(`自选区间最多 ${CUSTOM_RANGE_MAX_DAYS} 天`)
      return
    }
    setError(null)
    setAppliedCustomStart(start)
    setAppliedCustomEnd(end)
    if (replayActive) {
      setReplayIndex(0)
    }
  }

  const handleTabChange = (_event: unknown, next: SeriesTab): void => {
    setTab(next)
    if (replayActive) {
      setReplayIndex(0)
    }
  }

  const startReplay = (): void => {
    if (tabRows.length === 0) {
      return
    }
    setReplayActive(true)
    setReplayIndex(0)
  }

  const cancelReplay = (): void => {
    resetReplay()
  }

  const statsEntries = Object.entries(result?.stats ?? {})
  const busy = disabled || running
  const canStart = tabRows.length > 0
  const prevDisabled = !replayActive || selectedIndex <= 0
  const refreshDisabled = !replayActive || tabRows.length === 0
  const nextDisabled = !replayActive || selectedIndex < 0 || selectedIndex >= tabRows.length - 1
  const customRangeDays = inclusiveDayCount(customStart, customEnd)
  const customQueryDisabled =
    busy ||
    !result ||
    isoToYyyymmdd(customStart).length !== 8 ||
    isoToYyyymmdd(customEnd).length !== 8 ||
    isoToYyyymmdd(customStart) > isoToYyyymmdd(customEnd) ||
    customRangeDays === null ||
    customRangeDays > CUSTOM_RANGE_MAX_DAYS

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        bgcolor: 'background.paper'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Typography variant="subtitle2" noWrap sx={{ flex: 1, fontWeight: 700 }} title={strategyName}>
          {strategyName}
        </Typography>
        <ChartIconButton ariaLabel="关闭策略面板" title="关闭" roomy onClick={onClose}>
          <Close sx={CHART_ICON_SX} />
        </ChartIconButton>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1,
            py: (theme) => `calc(${theme.spacing(1)} + 5px)`
          }}
        >
          <TextField
            size="small"
            type="date"
            label="起始"
            value={startDate}
            disabled={busy}
            onChange={(event) => setStartDate(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ flex: 1, minWidth: 0 }}
          />
          <TextField
            size="small"
            type="date"
            label="结束"
            value={endDate}
            disabled={busy}
            onChange={(event) => setEndDate(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ flex: 1, minWidth: 0 }}
          />
          <ChartIconButton
            ariaLabel="执行策略"
            title="执行"
            roomy
            disabled={busy || !tsCode}
            onClick={() => void handleRun()}
          >
            <PlayArrow sx={CHART_ICON_SX} />
          </ChartIconButton>
        </Box>
        {error ? (
          <Alert severity="error" sx={{ mx: 1, mb: 1 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
      </Box>

      <Box
        sx={{
          px: 1,
          py: (theme) => `calc(${theme.spacing(1)} + 5px)`,
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        {statsEntries.length > 0 ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              columnGap: 1,
              rowGap: 0.5
            }}
          >
            {statsEntries.map(([key, value]) => (
              <Typography key={key} variant="body2" noWrap>
                <Box component="span" sx={{ fontWeight: 700 }}>
                  {STAT_LABELS[key] ?? key}
                </Box>
                ：{formatStatValue(value)}
              </Typography>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {running ? '执行中…' : '选择区间后点击执行'}
          </Typography>
        )}
      </Box>

      <SettingsTabs
        value={tab}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="买卖点列表"
        sx={{ px: 1 }}
      >
        <SettingsTab disableRipple value="buy" label="买点" />
        <SettingsTab disableRipple value="sell" label="卖点" />
        <SettingsTab disableRipple value="mixed" label="买卖混合" />
        <SettingsTab disableRipple value="custom" label="自选数据" />
      </SettingsTabs>

      {tab === 'custom' ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 1, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            type="date"
            label="起始"
            value={customStart}
            disabled={busy || !result}
            onChange={(event) => handleCustomStartChange(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ flex: 1, minWidth: 0 }}
          />
          <TextField
            size="small"
            type="date"
            label="结束"
            value={customEnd}
            disabled={busy || !result}
            onChange={(event) => handleCustomEndChange(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ flex: 1, minWidth: 0 }}
          />
          <ChartIconButton
            ariaLabel="查询自选数据"
            title={
              customRangeDays !== null && customRangeDays > CUSTOM_RANGE_MAX_DAYS
                ? `自选区间最多 ${CUSTOM_RANGE_MAX_DAYS} 天`
                : '查询'
            }
            roomy
            disabled={customQueryDisabled}
            onClick={handleCustomQuery}
          >
            <Search sx={CHART_ICON_SX} />
          </ChartIconButton>
          <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>
            日期可任意选择；超过 {CUSTOM_RANGE_MAX_DAYS} 天时查询不可用，需点击查询后显示
          </Typography>
        </Box>
      ) : null}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, flexWrap: 'wrap' }}>
        <Box ref={columnButtonRef} component="span">
          <ChartIconButton
            ariaLabel="选择列"
            title="列选择"
            roomy
            disabled={!result}
            onClick={() => setColumnMenu(columnButtonRef.current)}
          >
            <ViewColumn sx={CHART_ICON_SX} />
          </ChartIconButton>
        </Box>
        <ChartIconButton
          ariaLabel={timeAsc ? '切换为时间降序' : '切换为时间升序'}
          title={timeAsc ? '时间升序' : '时间降序'}
          roomy
          onClick={() => setTimeAsc((prev) => !prev)}
        >
          {timeAsc ? <ArrowUpward sx={CHART_ICON_SX} /> : <ArrowDownward sx={CHART_ICON_SX} />}
        </ChartIconButton>
        <ChartIconButton
          ariaLabel="上一根K线"
          title="上一根"
          roomy
          disabled={prevDisabled}
          onClick={() => setReplayIndex((current) => Math.max(0, current - 1))}
        >
          <SkipPrevious sx={CHART_ICON_SX} />
        </ChartIconButton>
        <ChartIconButton
          ariaLabel="回到第一根K线"
          title="刷新"
          roomy
          disabled={refreshDisabled}
          onClick={() => setReplayIndex(0)}
        >
          <Refresh sx={CHART_ICON_SX} />
        </ChartIconButton>
        {replayActive ? (
          <ChartIconButton ariaLabel="取消复盘" title="取消" roomy onClick={cancelReplay}>
            <Stop sx={CHART_ICON_SX} />
          </ChartIconButton>
        ) : (
          <ChartIconButton
            ariaLabel="开始复盘"
            title="开始"
            roomy
            disabled={!canStart}
            onClick={startReplay}
          >
            <PlayCircleOutline sx={CHART_ICON_SX} />
          </ChartIconButton>
        )}
        <ChartIconButton
          ariaLabel="下一根K线"
          title="下一根"
          roomy
          disabled={nextDisabled}
          onClick={() => {
            pendingScrollRef.current = 'next'
            setReplayIndex((current) => Math.min(tabRows.length - 1, current + 1))
          }}
        >
          <SkipNext sx={CHART_ICON_SX} />
        </ChartIconButton>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', flexShrink: 0 }}>
          {tabRows.length} 行
        </Typography>
      </Box>
      <Menu
        anchorEl={columnMenu}
        open={Boolean(columnMenu)}
        onClose={() => setColumnMenu(null)}
      >
        {REQUIRED_COLUMNS.map((key) => (
          <MenuItem key={key} disabled>
            {COLUMN_LABELS[key] ?? key}（必选）
          </MenuItem>
        ))}
        {optionalColumns.length === 0 ? (
          <MenuItem disabled>没有可选列</MenuItem>
        ) : (
          optionalColumns.map((key) => {
            const checked = extraColumns.includes(key)
            return (
              <MenuItem
                key={key}
                onClick={() => {
                  setExtraColumns((current) =>
                    current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
                  )
                }}
              >
                {checked ? '✓ ' : ''}
                {COLUMN_LABELS[key] ?? key}
              </MenuItem>
            )
          })
        )}
      </Menu>

      <Box ref={listRef} sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {!result ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
            尚无执行结果
          </Typography>
        ) : tabRows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
            {tab === 'custom' && !appliedCustomStart
              ? `请选择不超过 ${CUSTOM_RANGE_MAX_DAYS} 天的区间后查询`
              : tab === 'sell'
                ? '没有卖点'
                : '没有符合条件的数据'}
          </Typography>
        ) : (
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {visibleColumns.map((key) => (
                  <TableCell key={key} sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                    {COLUMN_LABELS[key] ?? key}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {tabRows.map((row, index) => {
                const selected = replayActive && index === selectedIndex
                return (
                  <TableRow
                    key={`${rowTime(row)}-${index}`}
                    hover
                    ref={selected ? selectedRowRef : undefined}
                    selected={selected}
                    onClick={() => {
                      if (replayActive) {
                        setReplayIndex(index)
                      }
                    }}
                    sx={{
                      cursor: replayActive ? 'pointer' : 'default',
                      bgcolor: selected ? 'action.selected' : undefined
                    }}
                  >
                    {visibleColumns.map((key) => (
                      <TableCell key={key} sx={{ whiteSpace: 'nowrap' }}>
                        {formatCell(key, row[key])}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Box>
    </Box>
  )
}

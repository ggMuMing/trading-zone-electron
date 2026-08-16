import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import RefreshIcon from '@mui/icons-material/Refresh'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MARKET_SYNC_START,
  todayYyyymmdd
} from '../../../shared/constants/market'
import type { AdjustType, MarketCoverageResult, OhlcvBar } from '../../../shared/types/market'
import type { Stock } from '../../../shared/types/stock'
import { StockPicker } from './StockPicker'

type BarColumnId =
  | 'trade_date'
  | 'open'
  | 'close'
  | 'high'
  | 'low'
  | 'vol'
  | 'amount'
  | 'pre_close'
  | 'change'
  | 'pct_chg'
  | 'ah_vol'
  | 'ah_amount'
  | 'adj_factor'

type SortDir = 'asc' | 'desc'

interface BarColumn {
  id: BarColumnId
  label: string
  required: boolean
  defaultVisible: boolean
  align: 'left' | 'right'
  digits: number
}

const BAR_COLUMNS: BarColumn[] = [
  { id: 'trade_date', label: '日期', required: true, defaultVisible: true, align: 'left', digits: 0 },
  { id: 'open', label: '开盘', required: true, defaultVisible: true, align: 'right', digits: 2 },
  { id: 'close', label: '收盘', required: true, defaultVisible: true, align: 'right', digits: 2 },
  { id: 'high', label: '最高价', required: true, defaultVisible: true, align: 'right', digits: 2 },
  { id: 'low', label: '最低价', required: true, defaultVisible: true, align: 'right', digits: 2 },
  { id: 'vol', label: '成交量', required: true, defaultVisible: true, align: 'right', digits: 0 },
  { id: 'amount', label: '成交额', required: true, defaultVisible: true, align: 'right', digits: 0 },
  { id: 'pre_close', label: '昨收', required: false, defaultVisible: false, align: 'right', digits: 2 },
  { id: 'change', label: '涨跌额', required: false, defaultVisible: false, align: 'right', digits: 2 },
  { id: 'pct_chg', label: '涨跌幅', required: false, defaultVisible: false, align: 'right', digits: 2 },
  { id: 'ah_vol', label: '盘后量', required: false, defaultVisible: false, align: 'right', digits: 0 },
  { id: 'ah_amount', label: '盘后额', required: false, defaultVisible: false, align: 'right', digits: 0 },
  { id: 'adj_factor', label: '因子', required: false, defaultVisible: true, align: 'right', digits: 4 }
]

const OPTIONAL_COLUMN_STORAGE_KEY = 'trading-zone.market.optionalColumns'
const PICKER_WIDTH_STORAGE_KEY = 'trading-zone.market.stockPickerWidth'
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

function defaultOptionalVisibility(): Record<string, boolean> {
  const next: Record<string, boolean> = {}
  for (const col of BAR_COLUMNS) {
    if (!col.required) {
      next[col.id] = col.defaultVisible
    }
  }
  return next
}

function loadOptionalVisibility(): Record<string, boolean> {
  const defaults = defaultOptionalVisibility()
  try {
    const raw = localStorage.getItem(OPTIONAL_COLUMN_STORAGE_KEY)
    if (!raw) {
      return defaults
    }
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return { ...defaults, ...parsed }
  } catch {
    return defaults
  }
}

function formatNum(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }
  return value.toFixed(digits)
}

function formatCell(column: BarColumn, row: OhlcvBar): string {
  const value = row[column.id]
  if (column.id === 'trade_date') {
    return String(value ?? '—')
  }
  return formatNum(typeof value === 'number' ? value : null, column.digits)
}

function compareBars(a: OhlcvBar, b: OhlcvBar, key: BarColumnId, dir: SortDir): number {
  const left = a[key]
  const right = b[key]
  let cmp = 0
  if (typeof left === 'string' || typeof right === 'string') {
    cmp = String(left ?? '').localeCompare(String(right ?? ''))
  } else {
    const ln = left === null || left === undefined || Number.isNaN(left) ? null : left
    const rn = right === null || right === undefined || Number.isNaN(right) ? null : right
    if (ln === null && rn === null) {
      cmp = 0
    } else if (ln === null) {
      cmp = 1
    } else if (rn === null) {
      cmp = -1
    } else {
      cmp = ln - rn
    }
  }
  return dir === 'asc' ? cmp : -cmp
}

export function MarketPage(): React.JSX.Element {
  const [loading, setLoading] = useState(true)
  const [querying, setQuerying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stocks, setStocks] = useState<Stock[]>([])
  const [coverage, setCoverage] = useState<MarketCoverageResult | null>(null)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [adjust, setAdjust] = useState<AdjustType>('none')
  const [bars, setBars] = useState<OhlcvBar[]>([])
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const [sortBy, setSortBy] = useState<BarColumnId>('trade_date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [optionalVisible, setOptionalVisible] = useState<Record<string, boolean>>(loadOptionalVisibility)
  const [columnMenuEl, setColumnMenuEl] = useState<null | HTMLElement>(null)
  const [pickerWidth, setPickerWidth] = useState(loadPickerWidth)
  const [resizing, setResizing] = useState(false)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const pickerWidthRef = useRef(pickerWidth)
  pickerWidthRef.current = pickerWidth

  const visibleColumns = useMemo(
    () => BAR_COLUMNS.filter((col) => col.required || optionalVisible[col.id]),
    [optionalVisible]
  )

  const sortedBars = useMemo(
    () => [...bars].sort((a, b) => compareBars(a, b, sortBy, sortDir)),
    [bars, sortBy, sortDir]
  )

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

  const loadBars = useCallback(async (tsCode: string, adj: AdjustType, endDate: string): Promise<void> => {
    setQuerying(true)
    setError(null)
    try {
      const result = await window.api.market.query({
        ts_code: tsCode,
        adjust: adj,
        start_date: MARKET_SYNC_START,
        end_date: endDate
      })
      setBars(result.bars)
      setSortBy('trade_date')
      setSortDir('asc')
      setPage(0)
    } catch (err: unknown) {
      setBars([])
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
      void loadBars(selectedCode, adjust, queryEnd)
    } else {
      setBars([])
    }
  }, [selectedCode, adjust, queryEnd, loadBars])

  const isEmpty = stocks.length === 0
  const pageRows = sortedBars.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
  const selected = stocks.find((stock) => stock.ts_code === selectedCode)

  const handleSort = (columnId: BarColumnId): void => {
    if (sortBy === columnId) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(columnId)
      setSortDir('asc')
    }
    setPage(0)
  }

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

  const handleToggleOptional = (columnId: BarColumnId): void => {
    setOptionalVisible((prev) => {
      const next = { ...prev, [columnId]: !prev[columnId] }
      localStorage.setItem(OPTIONAL_COLUMN_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}
      >
        <Typography variant="h6" fontWeight={700}>
          行情
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
        <Chip
          size="small"
          variant="outlined"
          label={`${MARKET_SYNC_START}–${queryEnd}`}
        />
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
              请先到配置页更新数据。成功后本页可浏览全部股票并查看日线。
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
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                {selected
                  ? `${selected.name ?? selected.ts_code}（${selected.ts_code}）日线`
                  : '请选择股票'}
              </Typography>
              <Button
                size="small"
                startIcon={<ViewColumnIcon />}
                onClick={(e) => setColumnMenuEl(e.currentTarget)}
              >
                列
              </Button>
              <Menu
                anchorEl={columnMenuEl}
                open={Boolean(columnMenuEl)}
                onClose={() => setColumnMenuEl(null)}
              >
                <Box sx={{ px: 2, py: 1, display: 'flex', flexDirection: 'column' }}>
                  {BAR_COLUMNS.map((col) => (
                    <FormControlLabel
                      key={col.id}
                      control={
                        <Checkbox
                          size="small"
                          checked={col.required || Boolean(optionalVisible[col.id])}
                          disabled={col.required}
                          onChange={() => handleToggleOptional(col.id)}
                        />
                      }
                      label={col.label}
                    />
                  ))}
                </Box>
              </Menu>
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

            <TableContainer sx={{ flex: 1 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {visibleColumns.map((col) => (
                      <TableCell key={col.id} align={col.align} sortDirection={sortBy === col.id ? sortDir : false}>
                        <TableSortLabel
                          active={sortBy === col.id}
                          direction={sortBy === col.id ? sortDir : 'asc'}
                          onClick={() => handleSort(col.id)}
                        >
                          {col.label}
                        </TableSortLabel>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!selectedCode ? (
                    <TableRow>
                      <TableCell colSpan={visibleColumns.length} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        请从左侧选择股票
                      </TableCell>
                    </TableRow>
                  ) : pageRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={visibleColumns.length} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        {querying || loading ? '加载中…' : '暂无日线数据'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((row) => (
                      <TableRow key={`${row.ts_code}-${row.trade_date}`} hover>
                        {visibleColumns.map((col) => (
                          <TableCell key={col.id} align={col.align}>
                            {formatCell(col, row)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={sortedBars.length}
              page={page}
              onPageChange={(_, next) => setPage(next)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10))
                setPage(0)
              }}
              rowsPerPageOptions={[25, 50, 100, 200]}
              labelRowsPerPage="每页"
            />
          </Paper>
        </Box>
      )}
    </Box>
  )
}

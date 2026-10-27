import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { JournalTextField } from './journalField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useEffect, useMemo, useState } from 'react'
import { journalStatus, netPnl, replayPosition } from '../../../../shared/tradeJournal/tradeJournal'
import type { TradeJournal, TradeJournalStatus, TradeSide, TradeStyle } from '../../../../shared/types/tradeJournal'
import type { Stock } from '../../../../shared/types/stock'
import { matchesStockQuery, pinyinInitials } from '../stockMatch'
import { JournalDialog } from './JournalDialog'
import { queryLatestCloses } from './journalQuotes'
import {
  compareFills,
  formatMoney,
  formatNetPnl,
  formatPrice,
  formatQty,
  sideLabel,
  statusLabel,
  styleLabel
} from './journalText'

interface Filters {
  entryFrom: string
  entryTo: string
  symbol: string
  side: '' | TradeSide
  style: '' | TradeStyle
  status: '' | TradeJournalStatus
  pnlMin: string
  pnlMax: string
}

const EMPTY_FILTERS: Filters = {
  entryFrom: '',
  entryTo: '',
  symbol: '',
  side: '',
  style: '',
  status: '',
  pnlMin: '',
  pnlMax: ''
}

export function JournalPage(): React.JSX.Element {
  const [records, setRecords] = useState<TradeJournal[]>([])
  const [stocks, setStocks] = useState<Stock[]>([])
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [closes, setCloses] = useState<Record<string, number | null>>({})
  const [closesReady, setClosesReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<TradeJournal | null | 'create'>(null)

  const initials = useMemo(() => {
    const map = new Map<string, string>()
    for (const stock of stocks) {
      map.set(stock.ts_code, pinyinInitials(stock.name))
    }
    return map
  }, [stocks])

  const removeRecord = (record: TradeJournal): void => {
    if (!window.confirm(`删除「${record.name} ${record.tsCode}」？`)) {
      return
    }
    void window.api.tradeJournal
      .remove({ id: record.id })
      .then(() => {
        setExpanded((current) => (current === record.id ? null : current))
        setDialog((current) => (current !== 'create' && current?.id === record.id ? null : current))
        load()
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
      })
  }

  const load = (): void => {
    void Promise.all([window.api.tradeJournal.list(), window.api.stocks.list()])
      .then(([nextRecords, nextStocks]) => {
        setRecords(nextRecords)
        setStocks(nextStocks)
        setError(null)
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
      })
  }

  useEffect(() => {
    load()
  }, [])

  const openCodes = useMemo(() => {
    const codes = new Set<string>()
    for (const record of records) {
      if (journalStatus(record) === 'open') {
        codes.add(record.tsCode)
      }
    }
    return [...codes].sort()
  }, [records])

  useEffect(() => {
    if (openCodes.length === 0) {
      setCloses({})
      setClosesReady(true)
      return
    }
    let cancelled = false
    setClosesReady(false)
    void queryLatestCloses(openCodes).then((map) => {
      if (!cancelled) {
        setCloses(map)
        setClosesReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [openCodes])

  const visible = useMemo(
    () =>
      records
        .filter((record) => matchesFilters(record, filters, stocks, initials, closes, closesReady))
        .sort((left, right) => {
          if (left.entryDate !== right.entryDate) {
            return left.entryDate < right.entryDate ? 1 : -1
          }
          return left.updatedAt < right.updatedAt ? 1 : -1
        }),
    [records, filters, stocks, initials, closes, closesReady]
  )

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        p: 2,
        gap: 1.5
      }}
    >
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
        <JournalTextField
          size="small"
          type="date"
          label="进场从"
          value={filters.entryFrom}
          onChange={(event) => setFilters((prev) => ({ ...prev, entryFrom: event.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: 150 }}
        />
        <JournalTextField
          size="small"
          type="date"
          label="进场到"
          value={filters.entryTo}
          onChange={(event) => setFilters((prev) => ({ ...prev, entryTo: event.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: 150 }}
        />
        <JournalTextField
          size="small"
          label="标的"
          value={filters.symbol}
          onChange={(event) => setFilters((prev) => ({ ...prev, symbol: event.target.value }))}
          sx={{ width: 160 }}
        />
        <JournalTextField
          select
          size="small"
          label="方向"
          value={filters.side}
          onChange={(event) => setFilters((prev) => ({ ...prev, side: event.target.value as Filters['side'] }))}
          sx={{ width: 120 }}
        >
          <MenuItem value="">全部</MenuItem>
          <MenuItem value="long">做多</MenuItem>
          <MenuItem value="short">做空</MenuItem>
        </JournalTextField>
        <JournalTextField
          select
          size="small"
          label="交易类型"
          value={filters.style}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, style: event.target.value as Filters['style'] }))
          }
          sx={{ width: 140 }}
        >
          <MenuItem value="">全部</MenuItem>
          <MenuItem value="left">左侧交易</MenuItem>
          <MenuItem value="right">右侧交易</MenuItem>
        </JournalTextField>
        <JournalTextField
          select
          size="small"
          label="状态"
          value={filters.status}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, status: event.target.value as Filters['status'] }))
          }
          sx={{ width: 120 }}
        >
          <MenuItem value="">全部</MenuItem>
          <MenuItem value="planned">计划中</MenuItem>
          <MenuItem value="open">进行中</MenuItem>
          <MenuItem value="closed">已完成</MenuItem>
        </JournalTextField>
        <JournalTextField
          size="small"
          label="净盈亏最小"
          value={filters.pnlMin}
          onChange={(event) => setFilters((prev) => ({ ...prev, pnlMin: event.target.value }))}
          slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          sx={{ width: 130 }}
        />
        <JournalTextField
          size="small"
          label="净盈亏最大"
          value={filters.pnlMax}
          onChange={(event) => setFilters((prev) => ({ ...prev, pnlMax: event.target.value }))}
          slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          sx={{ width: 130 }}
        />
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialog('create')}>
          创建
        </Button>
      </Stack>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <TableContainer sx={{ flex: 1, minHeight: 0 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>标的</TableCell>
              <TableCell>进场时间</TableCell>
              <TableCell>方向</TableCell>
              <TableCell>交易类型</TableCell>
              <TableCell>状态</TableCell>
              <TableCell align="right">净盈亏</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary">
                    {records.length === 0 ? '还没有交易记录' : '没有符合条件的记录'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              visible.map((record) => {
                const status = journalStatus(record)
                const open = expanded === record.id
                return (
                  <JournalRows
                    key={record.id}
                    record={record}
                    open={open}
                    status={status}
                    pnlText={pnlText(record, closes, closesReady)}
                    onToggle={() => setExpanded((current) => (current === record.id ? null : record.id))}
                    onEdit={() => setDialog(record)}
                    onDelete={() => removeRecord(record)}
                  />
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {dialog != null ? (
        <JournalDialog
          key={dialog === 'create' ? 'create' : dialog.id}
          record={dialog === 'create' ? null : dialog}
          stocks={stocks}
          initials={initials}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            load()
          }}
        />
      ) : null}
    </Box>
  )
}

function JournalRows({
  record,
  open,
  status,
  pnlText: pnl,
  onToggle,
  onEdit,
  onDelete
}: {
  record: TradeJournal
  open: boolean
  status: TradeJournalStatus
  pnlText: string
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}): React.JSX.Element {
  const position = replayPosition(record)
  const buys = [...record.buys].sort(compareFills)
  const sells = [...record.sells].sort(compareFills)
  return (
    <>
      <TableRow hover>
        <TableCell>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <IconButton size="small" aria-label={open ? '收起详情' : '展开详情'} onClick={onToggle}>
              {open ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
            </IconButton>
            <span>
              {record.name} {record.tsCode}
            </span>
          </Stack>
        </TableCell>
        <TableCell>{record.entryDate}</TableCell>
        <TableCell>{sideLabel(record.side)}</TableCell>
        <TableCell>{styleLabel(record.style)}</TableCell>
        <TableCell
          sx={(theme) => ({
            color:
              status === 'planned'
                ? theme.palette.mode === 'dark'
                  ? '#ffd54f'
                  : '#c49000'
                : status === 'open'
                  ? theme.palette.primary.main
                  : theme.palette.error.main
          })}
        >
          {statusLabel(status)}
        </TableCell>
        <TableCell align="right">{pnl}</TableCell>
        <TableCell align="right">
          <Tooltip title={status === 'closed' ? '已完成的交易不能修改' : '编辑'}>
            <span>
              <IconButton aria-label="编辑" disabled={status === 'closed'} onClick={onEdit}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="删除">
            <IconButton aria-label="删除" onClick={onDelete}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>
      {open ? (
        <TableRow>
          <TableCell colSpan={7} sx={{ bgcolor: 'action.hover' }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3, rowGap: 1, alignItems: 'flex-start', py: 1 }}>
              <DetailLine label="进场理由" value={record.reason || '—'} />
              <DetailLine label="信息来源机构" value={record.sourceOrg || '—'} />
              <DetailLine label="信息来源个人" value={record.sourcePerson || '—'} />
              <DetailLine label="进场价" value={formatPrice(record.entryPrice)} />
              <DetailLine label="交易数量" value={formatQty(record.quantity)} />
              <DetailLine
                label="盈亏平衡价"
                value={record.breakevenPrice == null ? '—' : formatPrice(record.breakevenPrice)}
              />
              <DetailLine label="持仓数量" value={formatQty(position.quantity)} />
              <DetailLine
                label="持仓均价"
                value={position.avgCost == null ? '—' : formatPrice(position.avgCost)}
              />
              <DetailLine label="总费用" value={formatMoney(position.totalFee)} />
              <Box sx={{ flex: '0 0 auto' }}>
                <Typography variant="body2">买入</Typography>
                <FillList
                  rows={buys.map((fill) => ({
                    id: fill.id,
                    cells: [
                      fill.tradeDate,
                      formatPrice(fill.price),
                      formatQty(fill.quantity),
                      formatMoney(fill.fee),
                      formatSignedCell(fill.firstDayPnl)
                    ]
                  }))}
                  empty="还没有买入记录"
                />
              </Box>
              <Box sx={{ flex: '0 0 auto' }}>
                <Typography variant="body2">卖出</Typography>
                <FillList
                  rows={sells.map((fill) => ({
                    id: fill.id,
                    cells: [fill.tradeDate, formatPrice(fill.price), formatQty(fill.quantity), formatMoney(fill.fee)]
                  }))}
                  empty="还没有卖出记录"
                />
              </Box>
            </Box>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}

function DetailLine({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <Typography variant="body2" sx={{ flex: '0 0 auto' }}>
      {label}：{value}
    </Typography>
  )
}

function FillList({
  rows,
  empty
}: {
  rows: Array<{ id: string; cells: string[] }>
  empty: string
}): React.JSX.Element {
  if (rows.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {empty}
      </Typography>
    )
  }
  return (
    <Stack spacing={0.25}>
      {rows.map((row) => (
        <Typography key={row.id} variant="body2" color="text.secondary">
          {row.cells.join(' · ')}
        </Typography>
      ))}
    </Stack>
  )
}

function formatSignedCell(value: number): string {
  return formatNetPnl({ state: 'value', value })
}

function pnlText(record: TradeJournal, closes: Record<string, number | null>, ready: boolean): string {
  const status = journalStatus(record)
  if (status === 'planned') {
    return '—'
  }
  if (status === 'open' && !ready) {
    return '…'
  }
  const close = status === 'open' ? (closes[record.tsCode] ?? null) : null
  return formatNetPnl(netPnl(record, close))
}

function pnlNumber(
  record: TradeJournal,
  closes: Record<string, number | null>,
  ready: boolean
): number | null {
  const status = journalStatus(record)
  if (status === 'planned' || (status === 'open' && !ready)) {
    return null
  }
  const close = status === 'open' ? (closes[record.tsCode] ?? null) : null
  const result = netPnl(record, close)
  return result.state === 'value' ? result.value : null
}

function matchesFilters(
  record: TradeJournal,
  filters: Filters,
  stocks: Stock[],
  initials: Map<string, string>,
  closes: Record<string, number | null>,
  closesReady: boolean
): boolean {
  if (filters.entryFrom && record.entryDate < filters.entryFrom) {
    return false
  }
  if (filters.entryTo && record.entryDate > filters.entryTo) {
    return false
  }
  if (!symbolMatches(record, filters.symbol, stocks, initials)) {
    return false
  }
  if (filters.side && record.side !== filters.side) {
    return false
  }
  if (filters.style && record.style !== filters.style) {
    return false
  }
  if (filters.status && journalStatus(record) !== filters.status) {
    return false
  }
  const min = bound(filters.pnlMin)
  const max = bound(filters.pnlMax)
  if (min != null || max != null) {
    const value = pnlNumber(record, closes, closesReady)
    if (value == null) {
      return false
    }
    if (min != null && value < min) {
      return false
    }
    if (max != null && value > max) {
      return false
    }
  }
  return true
}

function symbolMatches(
  record: TradeJournal,
  query: string,
  stocks: Stock[],
  initials: Map<string, string>
): boolean {
  const keyword = query.trim().toLowerCase()
  if (!keyword) {
    return true
  }
  const stock = stocks.find((item) => item.ts_code === record.tsCode)
  if (stock) {
    return matchesStockQuery(stock, keyword, initials.get(stock.ts_code) ?? pinyinInitials(stock.name))
  }
  if (record.tsCode.toLowerCase().includes(keyword) || record.name.toLowerCase().includes(keyword)) {
    return true
  }
  const letters = pinyinInitials(record.name)
  return /^[a-z]+$/.test(keyword) && letters.includes(keyword)
}

function bound(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) {
    return null
  }
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import InputAdornment from '@mui/material/InputAdornment'
import Link from '@mui/material/Link'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Popover from '@mui/material/Popover'
import TextField from '@mui/material/TextField'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import DeleteOutline from '@mui/icons-material/DeleteOutline'
import FolderOpen from '@mui/icons-material/FolderOpen'
import InsertChartOutlined from '@mui/icons-material/InsertChartOutlined'
import PendingActions from '@mui/icons-material/PendingActions'
import Save from '@mui/icons-material/Save'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  conditionalHistoryStart,
  settleConditionalOrders,
  type PaperConditionalOrder
} from '../../../../shared/paper/paperConditional'
import { closesFromBars, valuePaperAccount, type PaperCloseBook, type PaperValuedPosition } from '../../../../shared/paper/paperAccount'
import { paperBuyCash, paperSellCash } from '../../../../shared/paper/paperFees'
import {
  applyPaperBuy,
  applyPaperSell,
  paperLotShares,
  paperMaxBuyShares,
  paperSellableShares,
  positionCostPrice,
  type PaperLot
} from '../../../../shared/paper/paperPosition'
import { isoToYyyymmdd, yyyymmddToIso } from '../../../../shared/constants/market'
import {
  defaultPaperPlanDraft,
  paperMasksSymbol,
  paperPlanDraftOf,
  paperPlanError,
  PAPER_DEFAULT_PLAN_NAME,
  PAPER_GROUP_SIZE_MAX
} from '../../../../shared/paper/paperPlan'
import {
  paperArchiveNameError,
  paperArchiveReturn,
  paperArchiveSymbols,
  paperReplayDurationDays
} from '../../../../shared/paper/paperArchive'
import { isChartUniverseIndexCode } from '../../../../shared/constants/chartUniverse'
import type { PaperArchive } from '../../../../shared/types/paperArchive'
import type { SymbolGroupTree } from '../../../../shared/types/symbolGroup'
import type {
  PaperPlan,
  PaperPlanDraft,
  PaperStartMode,
  PaperSymbolCount,
  PaperSymbolRef,
  PaperSymbolSource
} from '../../../../shared/types/paperPlan'
import type { Stock } from '../../../../shared/types/stock'
import { CHART_ICON_SX, ChartIconButton } from '../chart/ChartIconButton'
import { ConditionalOrderDialog } from './ConditionalOrderDialog'
import { PaperArchivePanel } from './PaperArchivePanel'
import { paperFieldSx, PAPER_FIELD_INSET } from './paperFieldSx'
import { PaperSymbolPicker } from './PaperSymbolPicker'
import { SettingsTab, SettingsTabs } from '../chart/SettingsTabs'
import type { ChartPanelQuote, ChartRightPanelContext } from '../ChartPage'
import type { ChartLimitMark } from '../chart/LimitMarkPrimitive'

type PaperPanelTab = 'template' | 'trade' | 'records'

const choiceLabelSx = {
  m: 0,
  '& .MuiFormControlLabel-label': { fontSize: 14 }
} as const

const tradeFieldSx = [paperFieldSx, { display: 'flex', mt: 1.5, mb: 0.5 }] as const
const orderFieldSx = [paperFieldSx, { mx: 0, width: '100%', mt: 1.5 }] as const
const textLinkSx = {
  border: 0,
  p: 0,
  background: 'none',
  font: 'inherit',
  fontSize: 'inherit',
  lineHeight: 'inherit',
  verticalAlign: 'baseline',
  cursor: 'pointer'
} as const

const NO_CHART_LIMITS: readonly ChartLimitMark[] = []
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function numberValue(value: number): string | number {
  return Number.isFinite(value) ? value : ''
}

function ModeCheckbox({
  label,
  checked,
  disabled,
  onSelect
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <FormControlLabel
      sx={choiceLabelSx}
      disabled={disabled}
      control={<Checkbox size="small" checked={checked} onChange={onSelect} />}
      label={label}
    />
  )
}

function FieldText({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Box component="span" sx={{ fontWeight: 700 }}>
      {children}
    </Box>
  )
}

function bundleGroupLabel(tree: SymbolGroupTree | null, groupId: string): string {
  if (!groupId) {
    return '未选择'
  }
  if (!tree) {
    return '分组'
  }
  const groups = [...tree.uncategorized, ...tree.categories.flatMap((category) => category.groups)]
  return groups.find((group) => group.id === groupId)?.name ?? '分组已删除'
}

function TemplateSummary({
  draft,
  bundleGroupName
}: {
  draft: PaperPlanDraft
  bundleGroupName: string
}): React.JSX.Element {
  const capital = Number.isFinite(draft.capital) ? String(draft.capital) : '-'
  const stamp = Number.isFinite(draft.stampTaxPct) ? String(draft.stampTaxPct) : '-'
  const commission = Number.isFinite(draft.commissionPct) ? String(draft.commissionPct) : '-'
  const timeValue =
    draft.startMode === 'fixed' ? (
      <>
        <FieldText>固定日期</FieldText> <FieldText>{draft.fixedDate}</FieldText>
      </>
    ) : (
      <>
        <FieldText>随机</FieldText>
        {draft.hideStartTime ? (
          <>
            {' '}
            <FieldText>隐藏时间</FieldText>
          </>
        ) : null}
      </>
    )
  const symbolValue = (
    <>
      {draft.symbolCount === 'single' ? (
        <FieldText>单个标的</FieldText>
      ) : draft.symbolCount === 'bundle' ? (
        <FieldText>{`分组标的 ${bundleGroupName} ${draft.symbols.length} 只`}</FieldText>
      ) : (
        <FieldText>{`一组 ${draft.groupSize} 个`}</FieldText>
      )}{' '}
      {draft.symbolCount === 'bundle' ? (
        draft.hideSymbol ? (
          <FieldText>隐藏名称和代码</FieldText>
        ) : null
      ) : draft.symbolSource === 'random' ? (
        <>
          <FieldText>随机</FieldText>
          {draft.hideSymbol ? (
            <>
              {' '}
              <FieldText>隐藏名称和代码</FieldText>
            </>
          ) : null}
        </>
      ) : (
        <>
          <FieldText>指定</FieldText>{' '}
          {draft.symbols.length === 0 ? <FieldText>未选择</FieldText> : draft.symbols.map((symbol, index) => (
            <Box component="span" key={symbol.tsCode}>
              {index > 0 ? '、' : null}
              {symbol.name ? `${symbol.name} ${symbol.tsCode}` : symbol.tsCode}
            </Box>
          ))}
        </>
      )}
    </>
  )
  const capitalValue = (
    <>
      总资金 <FieldText>{capital}</FieldText> 元，印花税 <FieldText>{stamp}</FieldText>%，手续费{' '}
      <FieldText>{commission}</FieldText>%
    </>
  )
  const rows = [
    { label: '时间', value: timeValue },
    { label: '标的', value: symbolValue },
    { label: '资金', value: capitalValue }
  ]

  return (
    <Table
      size="small"
      sx={{
        mx: PAPER_FIELD_INSET,
        width: `calc(100% - ${PAPER_FIELD_INSET} - ${PAPER_FIELD_INSET})`,
        '& .MuiTableCell-root': {
          borderColor: 'divider',
          px: 1,
          py: 0.75,
          fontSize: 14,
          lineHeight: 1.7,
          verticalAlign: 'top'
        },
        '& .MuiTableCell-root:first-of-type': {
          width: 52,
          whiteSpace: 'nowrap',
          fontWeight: 400
        }
      }}
    >
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label}>
            <TableCell>{row.label}</TableCell>
            <TableCell>{row.value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function pnlColor(value: number): string | undefined {
  if (value > 0) {
    return 'error.main'
  }
  if (value < 0) {
    return 'success.main'
  }
  return undefined
}

function formatYuan(value: number): string {
  if (!Number.isFinite(value)) {
    return '-'
  }
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function CapitalSummary({
  total,
  marketValue,
  pnl,
  available
}: {
  total: number
  marketValue: number
  pnl: number
  available: number
}): React.JSX.Element {
  const fields: Array<{ label: string; value: string; signed: number | null }> = [
    { label: '总资产', value: formatYuan(total), signed: null },
    { label: '证券市值', value: formatYuan(marketValue), signed: null },
    { label: '持仓盈亏', value: formatYuan(pnl), signed: pnl },
    { label: '可用资金', value: formatYuan(available), signed: null }
  ]
  return (
    <Box
      sx={{
        mx: PAPER_FIELD_INSET,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        columnGap: 1.5,
        rowGap: 1
      }}
    >
      {fields.map((field) => (
        <Box key={field.label} sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {field.label}
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: field.signed === null ? undefined : pnlColor(field.signed) }}
          >
            {field.value}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

function formatOrderPrice(value: number): string {
  return Number(value.toFixed(4)).toString()
}

function barPriceRange(bar: ChartPanelQuote | null): { low: number; high: number } | null {
  if (!bar || !Number.isFinite(bar.low) || !Number.isFinite(bar.high)) {
    return null
  }
  return { low: Math.min(bar.low, bar.high), high: Math.max(bar.low, bar.high) }
}

function priceInBar(value: string, bar: ChartPanelQuote | null): boolean {
  const price = Number(value)
  const range = barPriceRange(bar)
  if (!range || !Number.isFinite(price) || price <= 0) {
    return false
  }
  const rounded = Number(price.toFixed(4))
  const low = Number(range.low.toFixed(4))
  const high = Number(range.high.toFixed(4))
  return rounded >= low && rounded <= high
}

function PositionBoard({
  positions,
  labelOf
}: {
  positions: readonly PaperValuedPosition[]
  labelOf: (position: PaperValuedPosition) => string
}): React.JSX.Element | null {
  if (positions.length === 0) {
    return null
  }
  return (
    <Table
      size="small"
      sx={{
        mt: 1.5,
        '& .MuiTableCell-root': {
          px: 0.75,
          py: 0.5,
          fontSize: 12,
          lineHeight: 1.4,
          borderColor: 'divider',
          whiteSpace: 'nowrap'
        },
        '& .MuiTableCell-head': { fontWeight: 700 }
      }}
    >
      <TableHead>
        <TableRow>
          <TableCell align="left">持仓标的</TableCell>
          <TableCell align="left">数量</TableCell>
          <TableCell align="left">持仓成本</TableCell>
          <TableCell align="left">当前价格</TableCell>
          <TableCell align="left">盈亏</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {positions.map((position) => {
          const { costPrice, price, pnl } = position
          return (
            <TableRow key={position.tsCode}>
              <TableCell>{labelOf(position)}</TableCell>
              <TableCell align="left" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {position.shares}
              </TableCell>
              <TableCell align="left" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {costPrice === null ? '—' : formatOrderPrice(costPrice)}
              </TableCell>
              <TableCell align="left" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {price === null ? '—' : formatOrderPrice(price)}
              </TableCell>
              <TableCell
                align="left"
                sx={{ fontVariantNumeric: 'tabular-nums', color: pnl === null ? 'text.secondary' : pnlColor(pnl) }}
              >
                {pnl === null ? '—' : formatYuan(pnl)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function OrderPriceField({
  label,
  value,
  bar,
  onChange
}: {
  label: string
  value: string
  bar: ChartPanelQuote | null
  onChange: (value: string) => void
}): React.JSX.Element {
  const apply = (price: number | undefined): void => {
    if (price === undefined || !Number.isFinite(price)) {
      return
    }
    onChange(formatOrderPrice(price))
  }
  const range = barPriceRange(bar)
  const outOfRange = value.trim() !== '' && range !== null && !priceInBar(value, bar)
  const rangeLabel = range ? `${formatOrderPrice(range.low)}–${formatOrderPrice(range.high)}` : null
  return (
    <Box>
      <TextField
        size="small"
        type="number"
        label={label}
        value={value}
        error={outOfRange}
        onChange={(event) => onChange(event.target.value)}
        slotProps={{
          htmlInput: {
            min: range?.low ?? 0,
            max: range?.high,
            step: 0.01,
            'aria-label': label
          },
          input: {
            endAdornment: (
              <InputAdornment position="end" sx={{ gap: 0.25, maxHeight: 22, ml: 0.25 }}>
                <Button
                  size="small"
                  title="开盘价"
                  aria-label={`${label}设为开盘价`}
                  disabled={!bar}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => apply(bar?.open)}
                  sx={{ minWidth: 22, width: 22, height: 22, p: 0, fontSize: 13, lineHeight: 1 }}
                >
                  开
                </Button>
                <Button
                  size="small"
                  title="收盘价"
                  aria-label={`${label}设为收盘价`}
                  disabled={!bar}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => apply(bar?.close)}
                  sx={{ minWidth: 22, width: 22, height: 22, p: 0, fontSize: 13, lineHeight: 1 }}
                >
                  收
                </Button>
              </InputAdornment>
            )
          }
        }}
        sx={[paperFieldSx, { mx: 0, width: '100%' }]}
      />
      <Typography
        variant="caption"
        color={outOfRange ? 'error' : 'text.secondary'}
        sx={{ display: 'block', mt: 0.75 }}
      >
        {rangeLabel ? `区间 ${rangeLabel}` : '—'}
      </Typography>
    </Box>
  )
}

interface PaperTrade {
  id: number
  time: string
  name: string
  tsCode: string
  side: 'buy' | 'sell'
  price: number
  shares: number
  amount: number
}

function TradeRecords({
  trades,
  symbolAlias,
  hideTime,
  onLocate
}: {
  trades: readonly PaperTrade[]
  symbolAlias: ReadonlyMap<string, string>
  hideTime: boolean
  onLocate?: (trade: PaperTrade) => void
}): React.JSX.Element {
  return (
    <Table
      size="small"
      stickyHeader
      sx={{
        '& .MuiTableCell-root': {
          px: 0.75,
          py: 0.75,
          fontSize: 12,
          lineHeight: 1.4,
          borderColor: 'divider',
          verticalAlign: 'top'
        },
        '& .MuiTableCell-head': {
          fontWeight: 700,
          whiteSpace: 'nowrap',
          bgcolor: 'background.paper'
        }
      }}
    >
      <TableHead>
        <TableRow>
          <TableCell>时间</TableCell>
          <TableCell>名称/代码</TableCell>
          <TableCell>方向</TableCell>
          <TableCell align="right">价格/数量</TableCell>
          <TableCell align="right">金额</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {trades.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', py: 3 }}>
              还没有交易记录
            </TableCell>
          </TableRow>
        ) : (
          trades.map((trade) => {
            const alias = symbolAlias.get(trade.tsCode)
            return (
              <TableRow key={trade.id}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {hideTime || !trade.time ? (
                    '—'
                  ) : (
                    <Link
                      component="button"
                      type="button"
                      underline="hover"
                      onClick={() => onLocate?.(trade)}
                      sx={textLinkSx}
                    >
                      {trade.time}
                    </Link>
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ whiteSpace: 'nowrap' }}>{alias ?? (trade.name || '—')}</Box>
                    {alias ? null : (
                      <Box sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{trade.tsCode || '—'}</Box>
                    )}
                  </Box>
                </TableCell>
                <TableCell sx={{ color: trade.side === 'buy' ? 'error.main' : 'success.main', fontWeight: 700 }}>
                  {trade.side === 'buy' ? '买入' : '卖出'}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  <Box>{formatOrderPrice(trade.price)}</Box>
                  <Box>{trade.shares}</Box>
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {formatYuan(trade.amount)}
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}

function formatReturn(record: PaperArchive): string {
  const rate = paperArchiveReturn(record)
  if (rate === null) {
    return '—'
  }
  const pct = rate * 100
  const text = pct.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${pct > 0 ? '+' : ''}${text}%`
}

function formatArchiveTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function ArchiveRecords({
  records,
  selectedId,
  canOpen,
  onOpen
}: {
  records: readonly PaperArchive[]
  selectedId: string | null
  canOpen: boolean
  onOpen: (record: PaperArchive) => void
}): React.JSX.Element {
  return (
    <Table
      size="small"
      stickyHeader
      sx={{
        '& .MuiTableCell-root': {
          px: 0.75,
          py: 0.75,
          fontSize: 12,
          lineHeight: 1.4,
          borderColor: 'divider',
          verticalAlign: 'top',
          whiteSpace: 'nowrap'
        },
        '& .MuiTableCell-head': {
          fontWeight: 700,
          bgcolor: 'background.paper'
        }
      }}
    >
      <TableHead>
        <TableRow>
          <TableCell align="left">名称</TableCell>
          <TableCell align="left">归档时间</TableCell>
          <TableCell align="left">模板</TableCell>
          <TableCell align="left">开始时间</TableCell>
          <TableCell align="left">截止时间</TableCell>
          <TableCell align="left">持续时间</TableCell>
          <TableCell align="left">总资金</TableCell>
          <TableCell align="left">结算资金</TableCell>
          <TableCell align="left">总收益率</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {records.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9} align="center" sx={{ color: 'text.secondary', py: 3 }}>
              还没有模拟记录
            </TableCell>
          </TableRow>
        ) : (
          records.map((record) => {
            const rate = paperArchiveReturn(record)
            const selected = record.id === selectedId
            return (
              <TableRow key={record.id} sx={selected ? { bgcolor: 'action.selected' } : undefined}>
                <TableCell>
                  {canOpen ? (
                    <Link component="button" type="button" underline="hover" onClick={() => onOpen(record)} sx={textLinkSx}>
                      {record.name}
                    </Link>
                  ) : (
                    record.name
                  )}
                </TableCell>
                <TableCell>{formatArchiveTime(record.archivedAt)}</TableCell>
                <TableCell>{record.template.name}</TableCell>
                <TableCell>{record.startedOn}</TableCell>
                <TableCell>{record.endedOn}</TableCell>
                <TableCell>{record.durationDays}天</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatYuan(record.template.capital)}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatYuan(record.capital.available)}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontVariantNumeric: 'tabular-nums',
                    color: rate === null ? 'text.secondary' : rate > 0 ? 'error.main' : rate < 0 ? 'success.main' : 'text.primary'
                  }}
                >
                  {formatReturn(record)}
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}

function SectionTitle({ children }: { children: string }): React.JSX.Element {
  return (
    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>
      {children}
    </Typography>
  )
}

function stockFromRef(ref: PaperSymbolRef): Stock {
  return {
    ts_code: ref.tsCode,
    symbol: ref.tsCode.split('.')[0] ?? ref.tsCode,
    name: ref.name,
    area: null,
    industry: null,
    market: null,
    list_date: null,
    list_status: 'L',
    delist_date: null,
    synced_at: ''
  }
}

function pickSessionStocks(draft: PaperPlanDraft, universe: readonly Stock[]): Stock[] {
  if (draft.symbolSource === 'specified') {
    const byCode = new Map(universe.map((stock) => [stock.ts_code, stock]))
    return draft.symbols.map((ref) => byCode.get(ref.tsCode) ?? stockFromRef(ref))
  }
  const count = draft.symbolCount === 'single' ? 1 : draft.groupSize
  const pool = [...universe]
  const picked: Stock[] = []
  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length)
    const [stock] = pool.splice(index, 1)
    if (stock) {
      picked.push(stock)
    }
  }
  return picked
}

export function PaperTradingPanel({
  symbol,
  bar,
  session
}: {
  symbol: Stock | null
  bar: ChartPanelQuote | null
  session: ChartRightPanelContext
}): React.JSX.Element {
  const [plans, setPlans] = useState<PaperPlan[]>([])
  const [draft, setDraft] = useState<PaperPlanDraft>(() => defaultPaperPlanDraft(PAPER_DEFAULT_PLAN_NAME))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stocks, setStocks] = useState<Stock[]>([])
  const [stocksLoading, setStocksLoading] = useState(true)
  const [stocksError, setStocksError] = useState<string | null>(null)
  const [groupTree, setGroupTree] = useState<SymbolGroupTree | null>(null)
  const [planMenuOpen, setPlanMenuOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [tab, setTab] = useState<PaperPanelTab>('trade')
  const [tradeTemplateId, setTradeTemplateId] = useState<string | null>(null)
  const [buyPrice, setBuyPrice] = useState('')
  const [buyQty, setBuyQty] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [sellQty, setSellQty] = useState('')
  const [lots, setLots] = useState<PaperLot[]>([])
  const [trades, setTrades] = useState<PaperTrade[]>([])
  const [conditionalOrders, setConditionalOrders] = useState<PaperConditionalOrder[]>([])
  const [conditionalOpen, setConditionalOpen] = useState(false)
  const [showOrderLimits, setShowOrderLimits] = useState(false)
  const tradeSeq = useRef(0)
  const orderSeq = useRef(0)
  const [sessionCapital, setSessionCapital] = useState<number | null>(null)
  const [closeBook, setCloseBook] = useState<PaperCloseBook>({})
  const closeSeriesRef = useRef<{ adjust: string; endDate: string; byCode: PaperCloseBook }>({
    adjust: '',
    endDate: '',
    byCode: {}
  })
  const [trading, setTrading] = useState(false)
  const [archiveReady, setArchiveReady] = useState(false)
  const [archives, setArchives] = useState<PaperArchive[]>([])
  const [viewingArchiveId, setViewingArchiveId] = useState<string | null>(null)
  const [archivePanelOpen, setArchivePanelOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveName, setArchiveName] = useState('')
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [breakpoint, setBreakpoint] = useState<string | null>(null)
  const [sessionStart, setSessionStart] = useState<string | null>(null)
  const [pendingStart, setPendingStart] = useState(false)
  const [sessionSymbols, setSessionSymbols] = useState<Stock[]>([])
  const [maskSymbols, setMaskSymbols] = useState(false)
  const [hideSessionTime, setHideSessionTime] = useState(false)
  const planAnchorRef = useRef<HTMLDivElement>(null)
  const saveAnchorRef = useRef<HTMLDivElement>(null)
  const archiveAnchorRef = useRef<HTMLButtonElement>(null)
  const sessionRef = useRef(session)
  sessionRef.current = session
  const templateLocked = trading || pendingStart || breakpoint !== null
  const formDisabled = busy || templateLocked

  const viewingArchive = archives.find((record) => record.id === viewingArchiveId) ?? null

  useEffect(() => {
    const code = symbol?.ts_code
    const source = viewingArchive?.trades ?? trades
    const seen = new Set<string>()
    const markers: Array<{ timeIso: string; side: 'buy' | 'sell' }> = []
    for (const trade of source) {
      if (!code || trade.tsCode !== code || !trade.time) {
        continue
      }
      const key = `${trade.time}:${trade.side}`
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      markers.push({ timeIso: trade.time, side: trade.side })
    }
    session.setTradeMarkers(markers)
  }, [viewingArchive, trades, symbol, session.setTradeMarkers])

  useEffect(() => {
    let cancelled = false
    void window.api.symbolGroup
      .tree()
      .then((next) => {
        if (!cancelled) {
          setGroupTree(next)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGroupTree(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [draft.symbolCount])

  useEffect(() => {
    let cancelled = false
    void window.api.paperPlan
      .list()
      .then((listed) => {
        if (!cancelled) {
          setPlans(listed)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(errorMessage(err))
        }
      })
    void window.api.stocks
      .list()
      .then((listed) => {
        if (!cancelled) {
          setStocks(listed)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStocksError(errorMessage(err))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setStocksLoading(false)
        }
      })
    void window.api.paperArchive
      .list()
      .then((listed) => {
        if (!cancelled) {
          setArchives(listed)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(errorMessage(err))
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (tradeTemplateId !== null && !plans.some((plan) => plan.id === tradeTemplateId)) {
      setTradeTemplateId(null)
    }
  }, [plans, tradeTemplateId])

  const applyTemplate = (plan: PaperPlan | null): void => {
    if (busy || templateLocked) {
      return
    }
    const next = plan ? paperPlanDraftOf(plan) : defaultPaperPlanDraft(PAPER_DEFAULT_PLAN_NAME)
    setDraft(next)
    setError(null)
    setPlanMenuOpen(false)
  }

  const updateDraft = (patch: Partial<PaperPlanDraft>): void => {
    if (templateLocked) {
      return
    }
    setDraft((current) => (current ? { ...current, ...patch } : current))
    setError(null)
  }

  const setSymbolCount = (symbolCount: PaperSymbolCount): void => {
    if (templateLocked) {
      return
    }
    setDraft((current) => {
      if (!current) {
        return current
      }
      if (symbolCount === 'bundle') {
        return {
          ...current,
          symbolCount,
          symbols: current.symbolCount === 'bundle' ? current.symbols : [],
          bundleGroupId: current.symbolCount === 'bundle' ? current.bundleGroupId : ''
        }
      }
      const limit = symbolCount === 'single' ? 1 : current.groupSize
      return {
        ...current,
        symbolCount,
        symbols: Number.isInteger(limit) && limit >= 1 ? current.symbols.slice(0, limit) : current.symbols
      }
    })
    setError(null)
  }

  const chooseBundleGroup = (groupId: string): void => {
    if (templateLocked) {
      return
    }
    if (!groupId) {
      updateDraft({ bundleGroupId: '', symbols: [], symbolSource: 'specified' })
      return
    }
    setBusy(true)
    setError(null)
    void window.api.symbolGroup
      .members({ groupId })
      .then((members) => {
        updateDraft({
          bundleGroupId: groupId,
          symbolSource: 'specified',
          symbols: members.map((member) => ({ tsCode: member.tsCode, name: member.name }))
        })
      })
      .catch((err: unknown) => {
        setError(errorMessage(err))
      })
      .finally(() => {
        setBusy(false)
      })
  }

  const setGroupSize = (groupSize: number): void => {
    if (templateLocked) {
      return
    }
    setDraft((current) => {
      if (!current) {
        return current
      }
      return {
        ...current,
        groupSize,
        symbols:
          Number.isInteger(groupSize) && groupSize >= 1
            ? current.symbols.slice(0, groupSize)
            : current.symbols
      }
    })
    setError(null)
  }

  const openSave = (): void => {
    if (busy || templateLocked) {
      return
    }
    setSaveName('')
    setSaveError(null)
    setSaveOpen(true)
  }

  const commitSave = async (): Promise<void> => {
    if (busy || templateLocked) {
      return
    }
    const trimmed = saveName.trim()
    if (!trimmed) {
      setSaveError('请填写方案名称')
      return
    }
    const named = { ...draft, name: trimmed }
    const invalid = paperPlanError(named)
    if (invalid) {
      setSaveError(invalid)
      return
    }
    setBusy(true)
    setSaveError(null)
    try {
      const existing = plans.find((plan) => plan.name === trimmed)
      const saved = existing
        ? await window.api.paperPlan.update({ id: existing.id, draft: named })
        : await window.api.paperPlan.create({ draft: named })
      setPlans((current) =>
        [saved, ...current.filter((item) => item.id !== saved.id)].sort((left, right) =>
          right.updatedAt.localeCompare(left.updatedAt)
        )
      )
      setDraft(paperPlanDraftOf(saved))
      setSaveOpen(false)
    } catch (err: unknown) {
      setSaveError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (plan: PaperPlan): Promise<void> => {
    if (busy || templateLocked) {
      return
    }
    if (!window.confirm(`删除方案「${plan.name}」？`)) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await window.api.paperPlan.remove({ id: plan.id })
      setPlans((current) => current.filter((item) => item.id !== plan.id))
    } catch (err: unknown) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const symbolLimit = !draft ? 1 : draft.symbolCount === 'single' ? 1 : draft.groupSize
  const tradeTemplate = tradeTemplateId ? (plans.find((plan) => plan.id === tradeTemplateId) ?? null) : null
  const tradeDraft = tradeTemplate
    ? paperPlanDraftOf(tradeTemplate)
    : defaultPaperPlanDraft(PAPER_DEFAULT_PLAN_NAME)
  const templateCapital = Number.isFinite(tradeDraft.capital) ? tradeDraft.capital : 0
  const available = sessionCapital ?? templateCapital
  const positionCodes = useMemo(() => {
    const codes = new Set<string>()
    for (const lot of lots) {
      if (lot.shares > 0) {
        codes.add(lot.tsCode)
      }
    }
    return [...codes].sort()
  }, [lots])
  const positionKey = positionCodes.join(',')

  useEffect(() => {
    const cutoff = session.cutoff
    if (!cutoff || positionCodes.length === 0) {
      return
    }
    const adjust = session.adjust
    const endDate =
      session.coverageMax && session.coverageMax >= isoToYyyymmdd(cutoff)
        ? session.coverageMax
        : isoToYyyymmdd(cutoff)
    const loaded = closeSeriesRef.current
    const sameAdjust = loaded.adjust === adjust
    const coversEnd = sameAdjust && loaded.endDate >= endDate
    const missing = coversEnd
      ? positionCodes.filter((code) => loaded.byCode[code] === undefined)
      : positionCodes
    if (missing.length === 0) {
      return
    }
    let cancelled = false
    void Promise.all(
      missing.map(async (code) => {
        const result = await window.api.market.query({
          ts_code: code,
          adjust: isChartUniverseIndexCode(code) ? 'none' : adjust,
          end_date: endDate
        })
        return [code, closesFromBars(result.bars)] as const
      })
    )
      .then((rows) => {
        if (cancelled) {
          return
        }
        const byCode: Record<string, Record<string, number>> = sameAdjust
          ? { ...closeSeriesRef.current.byCode }
          : {}
        for (const [code, closes] of rows) {
          byCode[code] = closes
        }
        closeSeriesRef.current = {
          adjust,
          endDate: coversEnd ? closeSeriesRef.current.endDate : endDate,
          byCode
        }
        setCloseBook(byCode)
      })
      .catch(() => {
        if (!cancelled && !sameAdjust) {
          closeSeriesRef.current = { adjust, endDate: '', byCode: {} }
          setCloseBook({})
        }
      })
    return () => {
      cancelled = true
    }
  }, [positionKey, session.cutoff, session.adjust, session.coverageMax])

  const commissionPct = tradeDraft.commissionPct
  const stampTaxPct = tradeDraft.stampTaxPct
  const account = useMemo(
    () =>
      valuePaperAccount({
        lots,
        cash: available,
        time: session.cutoff,
        book: closeBook,
        commissionPct,
        stampTaxPct
      }),
    [lots, available, session.cutoff, closeBook, commissionPct, stampTaxPct]
  )

  useEffect(() => {
    setLots([])
    setTrades([])
    setConditionalOrders([])
    setSessionCapital(null)
  }, [tradeTemplateId, templateCapital])

  const templateKey = `${tradeTemplateId ?? 'default'}:${templateCapital}`
  const seenTemplate = useRef(templateKey)
  useEffect(() => {
    if (seenTemplate.current === templateKey) {
      return
    }
    seenTemplate.current = templateKey
    setTrading(false)
    setArchiveReady(false)
    setBreakpoint(null)
    setSessionStart(null)
    setPendingStart(false)
    setSessionSymbols([])
    setMaskSymbols(false)
    setHideSessionTime(false)
    setViewingArchiveId(null)
    sessionRef.current.setReplayRunning(false)
    sessionRef.current.setCutoff(null)
    sessionRef.current.showSymbols([], { maskSymbol: false, hideTime: false })
  }, [templateKey])

  useEffect(() => {
    if (!pendingStart || sessionSymbols.length === 0) {
      return
    }
    const lead = sessionSymbols[0]
    if (!lead) {
      return
    }
    if (session.chartFault === lead.ts_code) {
      setError('没有加载到该标的的K线')
      setPendingStart(false)
      return
    }
    if (session.chartCode !== lead.ts_code || !session.chartTimes || session.chartTimes.length === 0) {
      return
    }
    const times = session.chartTimes
    const iso =
      tradeDraft.startMode === 'fixed'
        ? times.find((time) => time >= tradeDraft.fixedDate)
        : times[Math.floor(Math.random() * times.length)]
    if (!iso) {
      setError('所选标的在开始日期之后没有K线')
      setPendingStart(false)
      return
    }
    session.setCutoff(iso)
    session.setReplayRunning(true)
    setSessionStart(iso)
    setBreakpoint(iso)
    setTrading(true)
    setArchiveReady(false)
    setPendingStart(false)
  }, [pendingStart, sessionSymbols, session, tradeDraft])

  const buyable = paperMaxBuyShares(available, buyPrice, tradeDraft.commissionPct)
  const sellable = paperSellableShares(lots, bar?.time ?? null, symbol?.ts_code ?? null)
  const buyShares = paperLotShares(buyQty)
  const sellShares = paperLotShares(sellQty)
  const buyPriceOk = priceInBar(buyPrice, bar)
  const sellPriceOk = priceInBar(sellPrice, bar)
  const canBuy =
    trading &&
    buyShares !== null &&
    buyShares <= buyable &&
    buyPriceOk
  const canSell =
    trading &&
    sellShares !== null &&
    sellShares <= sellable &&
    sellPriceOk

  const lotsRef = useRef(lots)
  lotsRef.current = lots
  const ordersRef = useRef(conditionalOrders)
  ordersRef.current = conditionalOrders
  const capitalRef = useRef(available)
  capitalRef.current = available
  const barRef = useRef(bar)
  barRef.current = bar
  const symbolRef = useRef(symbol)
  symbolRef.current = symbol
  const feeRef = useRef({ commissionPct, stampTaxPct })
  feeRef.current = { commissionPct, stampTaxPct }
  const heldCostPrice =
    viewingArchiveId || !symbol ? null : positionCostPrice(lots, symbol.ts_code)

  useEffect(() => {
    session.setCostPrice(heldCostPrice)
  }, [heldCostPrice, session.setCostPrice])

  useEffect(() => {
    const clear = session.setCostPrice
    return () => clear(null)
  }, [session.setCostPrice])

  const chartLimitPrices = useMemo(() => {
    if (!trading || !showOrderLimits || viewingArchiveId || !symbol) {
      return NO_CHART_LIMITS
    }
    const marks: ChartLimitMark[] = []
    for (const order of conditionalOrders) {
      if (order.status !== 'pending' || order.tsCode !== symbol.ts_code) {
        continue
      }
      const price = Number(order.limitPrice.toFixed(4))
      if (!Number.isFinite(price)) {
        continue
      }
      const side = order.side === 'buy' ? '买入' : '卖出'
      marks.push({ price, label: `${side} 限价 ${price} 数量 ${order.shares}` })
    }
    return marks.length === 0 ? NO_CHART_LIMITS : marks
  }, [trading, showOrderLimits, viewingArchiveId, symbol, conditionalOrders])

  useEffect(() => {
    if (!trading) {
      setConditionalOpen(false)
    }
  }, [trading])

  useEffect(() => {
    session.setLimitPrices(chartLimitPrices)
  }, [chartLimitPrices, session.setLimitPrices])

  useEffect(() => {
    const clear = session.setLimitPrices
    return () => clear([])
  }, [session.setLimitPrices])

  useEffect(() => {
    if (!trading) {
      return
    }
    const quote = barRef.current
    const code = symbol?.ts_code
    const times = session.chartTimes
    if (!quote || !code || !times || session.chartCode !== code) {
      return
    }
    const currentTime = quote.time
    const historyStart = conditionalHistoryStart(ordersRef.current, times, currentTime, code)
    let cancelled = false
    const run = async (): Promise<void> => {
      const quotes = new Map<string, { time: string; low: number; high: number }>()
      if (historyStart) {
        try {
          const result = await window.api.market.query({
            ts_code: code,
            adjust: isChartUniverseIndexCode(code) ? 'none' : sessionRef.current.adjust,
            end_date: isoToYyyymmdd(currentTime)
          })
          for (const item of result.bars) {
            if (item.low == null || item.high == null) {
              continue
            }
            if (!Number.isFinite(item.low) || !Number.isFinite(item.high)) {
              continue
            }
            const time = yyyymmddToIso(item.trade_date)
            quotes.set(time, { time, low: item.low, high: item.high })
          }
        } catch {
          // 缺历史行情时停在缺口，不跳过中间 K 线。
        }
      }
      if (cancelled) {
        return
      }
      const live = barRef.current
      if (!live || live.time !== currentTime || symbolRef.current?.ts_code !== code) {
        return
      }
      quotes.set(live.time, { time: live.time, low: live.low, high: live.high })
      const fees = feeRef.current
      const settled = settleConditionalOrders({
        orders: ordersRef.current,
        lots: lotsRef.current,
        capital: capitalRef.current,
        times,
        currentTime,
        tsCode: code,
        quotes,
        commissionPct: fees.commissionPct,
        stampTaxPct: fees.stampTaxPct
      })
      if (!settled.changed || cancelled) {
        return
      }
      setConditionalOrders([...settled.orders])
      setLots([...settled.lots])
      setSessionCapital(settled.capital)
      if (settled.trades.length > 0) {
        setTrades((current) => [
          ...settled.trades
            .slice()
            .reverse()
            .map((trade) => {
              tradeSeq.current += 1
              return { ...trade, id: tradeSeq.current }
            }),
          ...current
        ])
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [trading, bar?.time, symbol?.ts_code, session.chartTimes, session.chartCode, session.adjust])

  const beginTrading = (): void => {
    setError(null)
    if (breakpoint) {
      setViewingArchiveId(null)
      session.setCutoff(breakpoint)
      session.setReplayRunning(true)
      setTrading(true)
      setArchiveReady(false)
      return
    }
    const bundle = tradeDraft.symbolCount === 'bundle'
    const need = bundle
      ? tradeDraft.symbols.length
      : tradeDraft.symbolCount === 'single'
        ? 1
        : tradeDraft.groupSize
    const picked = pickSessionStocks(
      bundle ? { ...tradeDraft, symbolSource: 'specified' } : tradeDraft,
      stocks
    )
    if (bundle && picked.length === 0) {
      setError('请先在模板里保留至少 1 个标的')
      return
    }
    if (!bundle && tradeDraft.symbolSource === 'specified' && picked.length !== need) {
      setError('请先在模板里选满指定标的')
      return
    }
    if (!bundle && picked.length < need) {
      setError(stocksLoading ? '标的列表还在加载' : '没有足够的标的可以开始')
      return
    }
    setViewingArchiveId(null)
    session.setReplayRunning(false)
    session.setCutoff(null)
    const maskSymbol = paperMasksSymbol(tradeDraft)
    const hideTime = tradeDraft.startMode === 'random' && tradeDraft.hideStartTime
    setMaskSymbols(maskSymbol)
    setHideSessionTime(hideTime)
    setSessionSymbols(picked)
    setPendingStart(true)
    session.showSymbols(picked, { maskSymbol, hideTime })
  }

  const endTrading = (): void => {
    if (session.cutoff) {
      setBreakpoint(session.cutoff)
    }
    session.setReplayRunning(false)
    setTrading(false)
    setArchiveReady(true)
    setPendingStart(false)
  }

  const openArchive = (): void => {
    if (!archiveReady || busy) {
      return
    }
    setArchiveName('')
    setArchiveError(null)
    setArchiveOpen(true)
  }

  const commitArchive = async (): Promise<void> => {
    if (!archiveReady || busy) {
      return
    }
    const nameError = paperArchiveNameError(archiveName)
    if (nameError) {
      setArchiveError(nameError)
      return
    }
    const startedOn = sessionStart
    const endedOn = session.cutoff ?? breakpoint
    if (!startedOn || !endedOn) {
      setArchiveError('缺少开始或截止时间')
      return
    }
    let durationDays = 0
    try {
      durationDays = paperReplayDurationDays(startedOn, endedOn)
    } catch (err: unknown) {
      setArchiveError(errorMessage(err))
      return
    }
    setBusy(true)
    setArchiveError(null)
    try {
      const saved = await window.api.paperArchive.create({
        draft: {
          name: archiveName.trim(),
          template: tradeDraft,
          capital: {
            totalAssets: account.total,
            marketValue: account.marketValue,
            pnl: account.pnl,
            available: account.cash
          },
          startedOn,
          endedOn,
          durationDays,
          symbols: sessionSymbols.map((item) => ({ tsCode: item.ts_code, name: item.name })),
          trades
        }
      })
      setArchives((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
      setArchiveOpen(false)
    } catch (err: unknown) {
      setArchiveError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const resetTrading = (): void => {
    if (trading || pendingStart) {
      return
    }
    setError(null)
    setLots([])
    setTrades([])
    setConditionalOrders([])
    setSessionCapital(null)
    setBuyPrice('')
    setBuyQty('')
    setSellPrice('')
    setSellQty('')
    setArchiveReady(false)
    setBreakpoint(null)
    setSessionStart(null)
    setSessionSymbols([])
    setMaskSymbols(false)
    setHideSessionTime(false)
    setViewingArchiveId(null)
    session.setReplayRunning(false)
    session.setCutoff(null)
    session.showSymbols([], { maskSymbol: false, hideTime: false })
  }

  const viewArchive = (record: PaperArchive): void => {
    if (trading || pendingStart || breakpoint !== null || viewingArchiveId === record.id) {
      return
    }
    const picked = paperArchiveSymbols(record).map(
      (ref) => stocks.find((item) => item.ts_code === ref.tsCode) ?? stockFromRef(ref)
    )
    const maskSymbol = paperMasksSymbol(record.template)
    const hideTime = record.template.startMode === 'random' && record.template.hideStartTime
    setViewingArchiveId(record.id)
    session.showSymbols(picked, { maskSymbol, hideTime })
    session.setCutoff(record.endedOn)
    session.setReplayRunning(false)
  }

  const submitBuy = (): void => {
    if (!canBuy || buyShares === null) {
      return
    }
    const price = Number(buyPrice)
    const notional = price * buyShares
    const spent = paperBuyCash(price, buyShares, tradeDraft.commissionPct)
    const date = bar?.time ?? null
    const tsCode = symbol?.ts_code
    if (!tsCode || spent > available + 1e-6) {
      return
    }
    setSessionCapital(available - spent)
    setLots((current) =>
      applyPaperBuy(current, {
        tsCode,
        name: symbol?.name ?? '',
        date,
        shares: buyShares,
        cost: spent
      })
    )
    setBuyPrice('')
    setBuyQty('')
    tradeSeq.current += 1
    setTrades((current) => [
      {
        id: tradeSeq.current,
        time: date ?? '',
        name: symbol?.name ?? '',
        tsCode: symbol?.ts_code ?? '',
        side: 'buy',
        price,
        shares: buyShares,
        amount: notional
      },
      ...current
    ])
  }

  const submitSell = (): void => {
    if (!canSell || sellShares === null || sellable < sellShares) {
      return
    }
    const price = Number(sellPrice)
    const today = bar?.time ?? null
    const tsCode = symbol?.ts_code
    if (!tsCode || !today) {
      return
    }
    const received = paperSellCash(price, sellShares, tradeDraft.commissionPct, tradeDraft.stampTaxPct)
    const next = applyPaperSell(lots, {
      tsCode,
      today,
      shares: sellShares,
      proceeds: received
    })
    if (!next) {
      return
    }
    setSessionCapital(available + received)
    setLots(next)
    setSellPrice('')
    setSellQty('')
    tradeSeq.current += 1
    setTrades((current) => [
      {
        id: tradeSeq.current,
        time: today,
        name: symbol?.name ?? '',
        tsCode: symbol?.ts_code ?? '',
        side: 'sell',
        price,
        shares: sellShares,
        amount: price * sellShares
      },
      ...current
    ])
  }

  const createConditionalOrder = (input: {
    side: 'buy' | 'sell'
    limitPrice: number
    shares: number
    duration: number
  }): string | null => {
    if (!trading || !symbol || !bar) {
      return '请先开始交易并等到当前 K 线'
    }
    orderSeq.current += 1
    const created: PaperConditionalOrder = {
      id: orderSeq.current,
      tsCode: symbol.ts_code,
      name: symbol.name ?? '',
      side: input.side,
      limitPrice: input.limitPrice,
      shares: input.shares,
      duration: input.duration,
      createdTime: bar.time,
      status: 'pending',
      checkedThrough: null
    }
    setConditionalOrders((current) => [created, ...current])
    return null
  }

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
      <SettingsTabs
        value={tab}
        onChange={(_event, next: PaperPanelTab) => {
          if (busy) {
            return
          }
          setPlanMenuOpen(false)
          setSaveOpen(false)
          setArchiveOpen(false)
          setTab(next)
        }}
        aria-label="模拟盘"
        sx={{ px: 1, flexShrink: 0 }}
      >
        <SettingsTab disableRipple value="trade" label="交易" />
        <SettingsTab disableRipple value="template" label="模板" />
        <SettingsTab disableRipple value="records" label="模拟记录" />
      </SettingsTabs>
      <Menu
        anchorEl={planAnchorRef.current}
        open={planMenuOpen}
        onClose={() => setPlanMenuOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => applyTemplate(null)}>
          <Typography variant="body2" noWrap>
            {PAPER_DEFAULT_PLAN_NAME}
          </Typography>
        </MenuItem>
        {plans.map((plan) => (
          <MenuItem
            key={plan.id}
            onClick={() => applyTemplate(plan)}
            sx={{
              pr: 1,
              '& .plan-delete': { opacity: 0, pointerEvents: 'none' },
              '&:hover .plan-delete': { opacity: 1, pointerEvents: 'auto' }
            }}
          >
            <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
              {plan.name}
            </Typography>
            <Box
              className="plan-delete"
              sx={{ display: 'inline-flex', ml: 1 }}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <ChartIconButton
                ariaLabel={`删除${plan.name}`}
                title="删除"
                roomy
                disabled={formDisabled}
                onClick={() => void handleRemove(plan)}
              >
                <DeleteOutline sx={CHART_ICON_SX} />
              </ChartIconButton>
            </Box>
          </MenuItem>
        ))}
      </Menu>
      <Popover
        open={saveOpen}
        anchorEl={saveAnchorRef.current}
        onClose={() => {
          if (!busy) {
            setSaveOpen(false)
          }
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { p: 1.5, width: 240 } } }}
      >
        <TextField
          size="small"
          fullWidth
          autoFocus
          required
          label="名称"
          placeholder="方案名称"
          value={saveName}
          disabled={formDisabled}
          error={saveError === '请填写方案名称'}
          onChange={(event) => {
            setSaveName(event.target.value)
            setSaveError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void commitSave()
            }
          }}
        />
        {saveError ? (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.75 }}>
            {saveError}
          </Typography>
        ) : null}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Button
            size="small"
            variant="contained"
            disabled={formDisabled || saveName.trim().length === 0}
            onClick={() => void commitSave()}
          >
            保存
          </Button>
        </Box>
      </Popover>
      <Popover
        open={archiveOpen}
        anchorEl={archiveAnchorRef.current}
        onClose={() => {
          if (!busy) {
            setArchiveOpen(false)
          }
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{ paper: { sx: { p: 1.5, width: 240 } } }}
      >
        <TextField
          size="small"
          fullWidth
          autoFocus
          required
          label="名称"
          placeholder="归档名称"
          value={archiveName}
          disabled={busy}
          error={archiveError === '请填写归档名称'}
          onChange={(event) => {
            setArchiveName(event.target.value)
            setArchiveError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void commitArchive()
            }
          }}
        />
        {archiveError ? (
          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.75 }}>
            {archiveError}
          </Typography>
        ) : null}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Button
            size="small"
            variant="contained"
            disabled={busy || archiveName.trim().length === 0}
            onClick={() => void commitArchive()}
          >
            归档
          </Button>
        </Box>
      </Popover>

      {error ? (
        <Alert severity="error" sx={{ m: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {tab === 'template' ? (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Box sx={{ px: 1, py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: 700 }}>
                模拟开始时间
              </Typography>
              <Box ref={planAnchorRef} sx={{ display: 'inline-flex' }}>
                <ChartIconButton
                  ariaLabel="载入方案"
                  title="载入方案"
                  roomy
                  disabled={templateLocked}
                  onClick={() => setPlanMenuOpen(true)}
                >
                  <FolderOpen sx={CHART_ICON_SX} />
                </ChartIconButton>
              </Box>
              <Box ref={saveAnchorRef} sx={{ display: 'inline-flex' }}>
                <ChartIconButton
                  ariaLabel="保存方案"
                  title="保存"
                  roomy
                  disabled={templateLocked}
                  onClick={openSave}
                >
                  <Save sx={CHART_ICON_SX} />
                </ChartIconButton>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <ModeCheckbox
                label="随机时间"
                checked={draft.startMode === 'random'}
                disabled={formDisabled}
                onSelect={() => updateDraft({ startMode: 'random' satisfies PaperStartMode })}
              />
              <ModeCheckbox
                label="固定日期"
                checked={draft.startMode === 'fixed'}
                disabled={formDisabled}
                onSelect={() => updateDraft({ startMode: 'fixed' })}
              />
            </Box>
            {draft.startMode === 'fixed' ? (
              <TextField
                size="small"
                type="date"
                disabled={formDisabled}
                value={draft.fixedDate}
                onChange={(event) => updateDraft({ fixedDate: event.target.value })}
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { 'aria-label': '固定开始日期' }
                }}
                sx={[paperFieldSx, { mt: 0.75 }]}
              />
            ) : (
              <ModeCheckbox
                label="隐藏时间"
                checked={draft.hideStartTime}
                disabled={formDisabled}
                onSelect={() => updateDraft({ hideStartTime: !draft.hideStartTime })}
              />
            )}
          </Box>

          <Box sx={{ px: 1, py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <SectionTitle>标的选择</SectionTitle>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <ModeCheckbox
                label="单个标的"
                checked={draft.symbolCount === 'single'}
                disabled={formDisabled}
                onSelect={() => setSymbolCount('single')}
              />
              <ModeCheckbox
                label="一组标的"
                checked={draft.symbolCount === 'group'}
                disabled={formDisabled}
                onSelect={() => setSymbolCount('group')}
              />
              <ModeCheckbox
                label="分组标的"
                checked={draft.symbolCount === 'bundle'}
                disabled={formDisabled}
                onSelect={() => setSymbolCount('bundle')}
              />
            </Box>
            {draft.symbolCount === 'bundle' ? (
              <Box sx={{ mt: 1 }}>
                <TextField
                  select
                  size="small"
                  fullWidth
                  label="分组"
                  disabled={formDisabled}
                  value={draft.bundleGroupId}
                  onChange={(event) => chooseBundleGroup(event.target.value)}
                  sx={paperFieldSx}
                >
                  <MenuItem value="">请选择分组</MenuItem>
                  {groupTree && groupTree.uncategorized.length > 0 ? (
                    <ListSubheader>未分类</ListSubheader>
                  ) : null}
                  {groupTree?.uncategorized.map((group) => (
                    <MenuItem key={group.id} value={group.id}>
                      {group.name}
                    </MenuItem>
                  ))}
                  {groupTree?.categories.flatMap((category) =>
                    category.groups.length === 0
                      ? []
                      : [
                          <ListSubheader key={`head-${category.id}`}>{category.name}</ListSubheader>,
                          ...category.groups.map((group) => (
                            <MenuItem key={group.id} value={group.id}>
                              {group.name}
                            </MenuItem>
                          ))
                        ]
                  )}
                </TextField>
                <ModeCheckbox
                  label="隐藏标的名称和代码"
                  checked={draft.hideSymbol}
                  disabled={formDisabled}
                  onSelect={() => updateDraft({ hideSymbol: !draft.hideSymbol })}
                />
                {draft.symbols.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    请选择分组
                  </Typography>
                ) : (
                  <List dense disablePadding sx={{ maxHeight: 220, overflow: 'auto' }}>
                    {draft.symbols.map((item) => (
                      <ListItem
                        key={item.tsCode}
                        secondaryAction={
                          <IconButton
                            edge="end"
                            size="small"
                            aria-label={`删除 ${item.name}`}
                            disabled={formDisabled}
                            onClick={() =>
                              updateDraft({
                                symbols: draft.symbols.filter((symbol) => symbol.tsCode !== item.tsCode)
                              })
                            }
                          >
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        }
                      >
                        <ListItemText
                          primary={item.name}
                          secondary={item.tsCode}
                          primaryTypographyProps={{ noWrap: true, variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            ) : (
              <>
                {draft.symbolCount === 'group' ? (
                  <TextField
                    size="small"
                    type="number"
                    label="数量"
                    disabled={formDisabled}
                    value={numberValue(draft.groupSize)}
                    onChange={(event) => {
                      const next = event.target.value
                      setGroupSize(next === '' ? Number.NaN : Number(next))
                    }}
                    helperText={`1 到 ${PAPER_GROUP_SIZE_MAX} 个`}
                    slotProps={{
                      htmlInput: { min: 1, max: PAPER_GROUP_SIZE_MAX, step: 1, 'aria-label': '标的数量' }
                    }}
                    sx={[paperFieldSx, { mt: 1 }]}
                  />
                ) : null}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <ModeCheckbox
                    label="指定标的"
                    checked={draft.symbolSource === 'specified'}
                    disabled={formDisabled}
                    onSelect={() => updateDraft({ symbolSource: 'specified' satisfies PaperSymbolSource })}
                  />
                  <ModeCheckbox
                    label="随机标的"
                    checked={draft.symbolSource === 'random'}
                    disabled={formDisabled}
                    onSelect={() => updateDraft({ symbolSource: 'random' })}
                  />
                </Box>
                {draft.symbolSource === 'specified' ? (
                  <Box sx={{ mt: 1 }}>
                    <PaperSymbolPicker
                      stocks={stocks}
                      stocksLoading={stocksLoading}
                      stocksError={stocksError}
                      symbols={draft.symbols}
                      limit={Number.isInteger(symbolLimit) && symbolLimit >= 1 ? symbolLimit : 1}
                      selectedBelowSearch
                      placeholderGrid={draft.symbolCount === 'group'}
                      disabled={formDisabled}
                      onChange={(symbols: PaperSymbolRef[]) => updateDraft({ symbols })}
                    />
                  </Box>
                ) : (
                  <ModeCheckbox
                    label="隐藏标的名称和代码"
                    checked={draft.hideSymbol}
                    disabled={formDisabled}
                    onSelect={() => updateDraft({ hideSymbol: !draft.hideSymbol })}
                  />
                )}
              </>
            )}
          </Box>

          <Box sx={{ px: 1, py: 1 }}>
            <SectionTitle>交易设置</SectionTitle>
            <TextField
              size="small"
              type="number"
              label="总资金（元）"
              disabled={formDisabled}
              value={numberValue(draft.capital)}
              onChange={(event) => {
                const next = event.target.value
                updateDraft({ capital: next === '' ? Number.NaN : Number(next) })
              }}
              slotProps={{ htmlInput: { min: 0, step: 1000, 'aria-label': '总资金' } }}
              sx={tradeFieldSx}
            />
            <TextField
              size="small"
              type="number"
              label="印花税（%）"
              disabled={formDisabled}
              value={numberValue(draft.stampTaxPct)}
              onChange={(event) => {
                const next = event.target.value
                updateDraft({ stampTaxPct: next === '' ? Number.NaN : Number(next) })
              }}
              slotProps={{ htmlInput: { min: 0, max: 100, step: 0.001, 'aria-label': '印花税' } }}
              sx={tradeFieldSx}
            />
            <TextField
              size="small"
              type="number"
              label="手续费（%）"
              disabled={formDisabled}
              value={numberValue(draft.commissionPct)}
              onChange={(event) => {
                const next = event.target.value
                updateDraft({ commissionPct: next === '' ? Number.NaN : Number(next) })
              }}
              helperText="按成交额的百分数，0.05 表示万五"
              slotProps={{ htmlInput: { min: 0, max: 100, step: 0.001, 'aria-label': '手续费' } }}
              sx={tradeFieldSx}
            />
          </Box>
        </Box>
      ) : tab === 'trade' ? (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Box sx={{ px: 1, py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Box
              sx={{
                mx: PAPER_FIELD_INSET,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                columnGap: 1.5
              }}
            >
              <Button
                size="small"
                variant="contained"
                fullWidth
                color={trading ? 'error' : 'primary'}
                disabled={pendingStart || (stocksLoading && !breakpoint)}
                onClick={trading ? endTrading : beginTrading}
              >
                {pendingStart ? '加载中' : trading ? '结束交易' : '开始交易'}
              </Button>
              <Button
                ref={archiveAnchorRef}
                size="small"
                variant="outlined"
                fullWidth
                disabled={!archiveReady || busy}
                onClick={openArchive}
              >
                归档交易
              </Button>
              <Button
                size="small"
                variant="outlined"
                fullWidth
                disabled={trading || pendingStart}
                onClick={resetTrading}
              >
                重置交易
              </Button>
            </Box>
          </Box>
          <Box sx={{ px: 1, py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <SectionTitle>模板</SectionTitle>
            <TextField
              select
              size="small"
              value={tradeTemplateId ?? 'default'}
              disabled={formDisabled}
              onChange={(event) => {
                if (templateLocked) {
                  return
                }
                const next = event.target.value
                setTradeTemplateId(next === 'default' ? null : next)
              }}
              slotProps={{
                htmlInput: { 'aria-label': '模板' },
                select: { displayEmpty: true }
              }}
              sx={paperFieldSx}
            >
              <MenuItem value="default">{PAPER_DEFAULT_PLAN_NAME}</MenuItem>
              {plans.map((plan) => (
                <MenuItem key={plan.id} value={plan.id}>
                  {plan.name}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ px: 1, py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <TemplateSummary
              draft={tradeDraft}
              bundleGroupName={bundleGroupLabel(groupTree, tradeDraft.bundleGroupId)}
            />
          </Box>
          <Box sx={{ px: 1, py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <SectionTitle>资金管理</SectionTitle>
            <CapitalSummary
              total={account.total}
              marketValue={account.marketValue}
              pnl={account.pnl}
              available={account.cash}
            />
            <PositionBoard
              positions={account.positions}
              labelOf={(position) => session.symbolAlias.get(position.tsCode) ?? (position.name || position.tsCode)}
            />
          </Box>
          <Box sx={{ px: 1, py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 0.75
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                交易
              </Typography>
              <ChartIconButton
                ariaLabel="条件单"
                title={trading ? '条件单' : '开始交易后才能使用条件单'}
                boxed
                disabled={!trading || !symbol}
                onClick={() => {
                  if (trading && symbol) {
                    setConditionalOpen(true)
                  }
                }}
              >
                <PendingActions sx={CHART_ICON_SX} />
              </ChartIconButton>
            </Box>
            <TextField
              size="small"
              value={
                symbol
                  ? (session.symbolAlias.get(symbol.ts_code) ??
                    `${symbol.name || symbol.ts_code}（${symbol.ts_code}）`)
                  : ''
              }
              slotProps={{ htmlInput: { readOnly: true, 'aria-label': '交易标的' } }}
              sx={paperFieldSx}
            />
            <Box
              sx={{
                mx: PAPER_FIELD_INSET,
                mt: 1.5,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                columnGap: 1.5,
                alignItems: 'start'
              }}
            >
              <Box>
                <OrderPriceField label="买入价格" value={buyPrice} bar={bar} onChange={setBuyPrice} />
                <TextField
                  size="small"
                  type="number"
                  label="买入数量"
                  value={buyQty}
                  onChange={(event) => setBuyQty(event.target.value)}
                  slotProps={{ htmlInput: { min: 0, step: 100, 'aria-label': '买入数量' } }}
                  sx={orderFieldSx}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                  可买 {buyable} 股
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  fullWidth
                  disabled={!canBuy}
                  onClick={submitBuy}
                  sx={{ mt: 1 }}
                >
                  买入
                </Button>
              </Box>
              <Box>
                <OrderPriceField label="卖出价格" value={sellPrice} bar={bar} onChange={setSellPrice} />
                <TextField
                  size="small"
                  type="number"
                  label="卖出数量"
                  value={sellQty}
                  onChange={(event) => setSellQty(event.target.value)}
                  slotProps={{ htmlInput: { min: 0, step: 100, 'aria-label': '卖出数量' } }}
                  sx={orderFieldSx}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                  可卖 {sellable} 股
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  fullWidth
                  disabled={!canSell}
                  onClick={submitSell}
                  sx={{ mt: 1 }}
                >
                  卖出
                </Button>
              </Box>
            </Box>
          </Box>
          <Box sx={{ py: 1 }}>
            <Box sx={{ px: 1 }}>
              <SectionTitle>交易记录</SectionTitle>
            </Box>
            <TradeRecords
              trades={trades}
              symbolAlias={maskSymbols ? session.symbolAlias : new Map()}
              hideTime={hideSessionTime}
              onLocate={(trade) => {
                if (trade.time) {
                  session.locateTrade(trade.tsCode, trade.time)
                }
              }}
            />
          </Box>
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <ArchiveRecords
              records={archives}
              selectedId={viewingArchiveId}
              canOpen={!trading && !pendingStart && breakpoint === null}
              onOpen={viewArchive}
            />
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ px: 1, pt: 1 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 0.75
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  交易记录
                </Typography>
                <ChartIconButton
                  ariaLabel="数据面板"
                  title={viewingArchive ? '数据面板' : '选择一条模拟记录'}
                  roomy
                  disabled={viewingArchive === null}
                  onClick={() => setArchivePanelOpen(true)}
                >
                  <InsertChartOutlined sx={CHART_ICON_SX} />
                </ChartIconButton>
              </Box>
            </Box>
            {viewingArchive ? (
              <TradeRecords
                trades={viewingArchive.trades}
                symbolAlias={
                  paperMasksSymbol(viewingArchive.template) ? session.symbolAlias : new Map()
                }
                hideTime={
                  viewingArchive.template.startMode === 'random' && viewingArchive.template.hideStartTime
                }
                onLocate={(trade) => {
                  if (trade.time) {
                    session.locateTrade(trade.tsCode, trade.time)
                  }
                }}
              />
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                选择一条模拟记录
              </Typography>
            )}
          </Box>
        </Box>
      )}
      <PaperArchivePanel
        open={archivePanelOpen && viewingArchive !== null}
        record={viewingArchive}
        adjust={session.adjust}
        onClose={() => setArchivePanelOpen(false)}
      />
      <ConditionalOrderDialog
        open={conditionalOpen}
        trading={trading}
        hideTime={hideSessionTime}
        orders={conditionalOrders}
        showOnChart={showOrderLimits}
        symbolLabel={
          symbol
            ? (session.symbolAlias.get(symbol.ts_code) ??
              `${symbol.name || symbol.ts_code}（${symbol.ts_code}）`)
            : ''
        }
        symbolLabelOf={(order) => session.symbolAlias.get(order.tsCode) ?? (order.name || order.tsCode)}
        onClose={() => setConditionalOpen(false)}
        onCreate={createConditionalOrder}
        onShowOnChartChange={setShowOrderLimits}
      />
    </Box>
  )
}

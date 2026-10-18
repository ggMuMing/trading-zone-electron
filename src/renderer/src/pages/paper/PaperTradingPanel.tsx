import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import InputAdornment from '@mui/material/InputAdornment'
import FormControlLabel from '@mui/material/FormControlLabel'
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
import Save from '@mui/icons-material/Save'
import { useEffect, useRef, useState } from 'react'
import {
  defaultPaperPlanDraft,
  paperPlanDraftOf,
  paperPlanError,
  PAPER_DEFAULT_PLAN_NAME,
  PAPER_GROUP_SIZE_MAX
} from '../../../../shared/paper/paperPlan'
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
import { paperFieldSx, PAPER_FIELD_INSET } from './paperFieldSx'
import { PaperSymbolPicker } from './PaperSymbolPicker'
import { SettingsTab, SettingsTabs } from '../chart/SettingsTabs'
import type { ChartPanelQuote, ChartRightPanelContext } from '../ChartPage'

type PaperPanelTab = 'template' | 'trade' | 'records'

const choiceLabelSx = {
  m: 0,
  '& .MuiFormControlLabel-label': { fontSize: 14 }
} as const

const tradeFieldSx = [paperFieldSx, { display: 'flex', mt: 1.5, mb: 0.5 }] as const
const orderFieldSx = [paperFieldSx, { mx: 0, width: '100%', mt: 1.5 }] as const

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

function TemplateSummary({ draft }: { draft: PaperPlanDraft }): React.JSX.Element {
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
      ) : (
        <FieldText>{`一组 ${draft.groupSize} 个`}</FieldText>
      )}{' '}
      {draft.symbolSource === 'random' ? (
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

const SHARE_LOT = 100

interface PaperLot {
  date: string | null
  shares: number
  cost: number
}

function floorLot(shares: number): number {
  if (!Number.isFinite(shares) || shares < SHARE_LOT) {
    return 0
  }
  return Math.floor(shares / SHARE_LOT) * SHARE_LOT
}

function maxBuyShares(cash: number, priceText: string): number {
  const price = Number(priceText)
  if (!Number.isFinite(cash) || cash <= 0 || !Number.isFinite(price) || price <= 0) {
    return 0
  }
  return floorLot(cash / price)
}

function sellableShares(lots: readonly PaperLot[], today: string | null): number {
  if (!today) {
    return 0
  }
  const free = lots.reduce((sum, lot) => sum + (lot.date !== null && lot.date < today ? lot.shares : 0), 0)
  return floorLot(free)
}

function lotShares(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null
  }
  const qty = Number(value)
  return qty >= SHARE_LOT && qty % SHARE_LOT === 0 ? qty : null
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
  const fields = [
    { label: '总资产', value: formatYuan(total) },
    { label: '证券市值', value: formatYuan(marketValue) },
    { label: '持仓盈亏', value: formatYuan(pnl) },
    { label: '可用资金', value: formatYuan(available) }
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
          <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
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
  return (
    <TextField
      size="small"
      type="number"
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      slotProps={{
        htmlInput: { min: 0, step: 0.01, 'aria-label': label },
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
  hideTime
}: {
  trades: readonly PaperTrade[]
  symbolAlias: ReadonlyMap<string, string>
  hideTime: boolean
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
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{hideTime ? '—' : trade.time || '—'}</TableCell>
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
  const tradeSeq = useRef(0)
  const [sessionCapital, setSessionCapital] = useState<number | null>(null)
  const [trading, setTrading] = useState(false)
  const [archiveReady, setArchiveReady] = useState(false)
  const [breakpoint, setBreakpoint] = useState<string | null>(null)
  const [pendingStart, setPendingStart] = useState(false)
  const [sessionSymbols, setSessionSymbols] = useState<Stock[]>([])
  const [maskSymbols, setMaskSymbols] = useState(false)
  const [hideSessionTime, setHideSessionTime] = useState(false)
  const planAnchorRef = useRef<HTMLDivElement>(null)
  const saveAnchorRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef(session)
  sessionRef.current = session
  const templateLocked = trading || pendingStart || breakpoint !== null
  const formDisabled = busy || templateLocked

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
      const limit = symbolCount === 'single' ? 1 : current.groupSize
      return {
        ...current,
        symbolCount,
        symbols: Number.isInteger(limit) && limit >= 1 ? current.symbols.slice(0, limit) : current.symbols
      }
    })
    setError(null)
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
  const heldShares = lots.reduce((sum, lot) => sum + lot.shares, 0)
  const costAmount = lots.reduce((sum, lot) => sum + lot.cost, 0)
  const available = sessionCapital ?? templateCapital
  const marketValue = heldShares > 0 ? costAmount : 0

  useEffect(() => {
    setLots([])
    setTrades([])
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
    setPendingStart(false)
    setSessionSymbols([])
    setMaskSymbols(false)
    setHideSessionTime(false)
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
    setBreakpoint(iso)
    setTrading(true)
    setArchiveReady(false)
    setPendingStart(false)
  }, [pendingStart, sessionSymbols, session, tradeDraft])

  const buyable = maxBuyShares(available, buyPrice)
  const sellable = sellableShares(lots, bar?.time ?? null)
  const buyShares = lotShares(buyQty)
  const sellShares = lotShares(sellQty)
  const canBuy =
    trading &&
    buyShares !== null &&
    buyShares <= buyable &&
    Number(buyPrice) > 0 &&
    Number.isFinite(Number(buyPrice))
  const canSell =
    trading &&
    sellShares !== null &&
    sellShares <= sellable &&
    Number(sellPrice) > 0 &&
    Number.isFinite(Number(sellPrice))

  const beginTrading = (): void => {
    setError(null)
    if (breakpoint) {
      session.setCutoff(breakpoint)
      session.setReplayRunning(true)
      setTrading(true)
      setArchiveReady(false)
      return
    }
    const need = tradeDraft.symbolCount === 'single' ? 1 : tradeDraft.groupSize
    const picked = pickSessionStocks(tradeDraft, stocks)
    if (tradeDraft.symbolSource === 'specified' && picked.length !== need) {
      setError('请先在模板里选满指定标的')
      return
    }
    if (picked.length < need) {
      setError(stocksLoading ? '标的列表还在加载' : '没有足够的标的可以开始')
      return
    }
    const maskSymbol = tradeDraft.symbolSource === 'random' && tradeDraft.hideSymbol
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

  const resetTrading = (): void => {
    if (trading || pendingStart) {
      return
    }
    setError(null)
    setLots([])
    setTrades([])
    setSessionCapital(null)
    setBuyPrice('')
    setBuyQty('')
    setSellPrice('')
    setSellQty('')
    setArchiveReady(false)
    setBreakpoint(null)
    setSessionSymbols([])
    setMaskSymbols(false)
    setHideSessionTime(false)
    session.setReplayRunning(false)
    session.setCutoff(null)
    session.showSymbols([], { maskSymbol: false, hideTime: false })
  }

  const submitBuy = (): void => {
    if (!canBuy || buyShares === null) {
      return
    }
    const price = Number(buyPrice)
    const cost = price * buyShares
    const date = bar?.time ?? null
    setSessionCapital(available - cost)
    setLots((current) => {
      const index = current.findIndex((lot) => lot.date === date)
      if (index < 0) {
        return [...current, { date, shares: buyShares, cost }]
      }
      return current.map((lot, lotIndex) =>
        lotIndex === index ? { ...lot, shares: lot.shares + buyShares, cost: lot.cost + cost } : lot
      )
    })
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
        amount: cost
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
    let remaining = sellShares
    const next: PaperLot[] = []
    for (const lot of lots) {
      const eligible = today !== null && lot.date !== null && lot.date < today
      if (!eligible || remaining <= 0 || lot.shares <= 0) {
        next.push(lot)
        continue
      }
      const take = Math.min(lot.shares, remaining)
      const takeCost = (lot.cost / lot.shares) * take
      remaining -= take
      if (lot.shares > take) {
        next.push({ ...lot, shares: lot.shares - take, cost: lot.cost - takeCost })
      }
    }
    if (remaining > 0) {
      return
    }
    setSessionCapital(available + price * sellShares)
    setLots(next)
    setSellQty('')
    tradeSeq.current += 1
    setTrades((current) => [
      {
        id: tradeSeq.current,
        time: today ?? '',
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
          setTab(next)
        }}
        aria-label="模拟盘"
        sx={{ px: 1, flexShrink: 0 }}
      >
        <SettingsTab disableRipple value="trade" label="交易" />
        <SettingsTab disableRipple value="template" label="模板" />
        <SettingsTab disableRipple value="records" label="交易记录" />
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
            </Box>
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
              <Button size="small" variant="outlined" fullWidth disabled={!archiveReady}>
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
            <TemplateSummary draft={tradeDraft} />
          </Box>
          <Box sx={{ px: 1, py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <SectionTitle>资金管理</SectionTitle>
            <CapitalSummary
              total={available + marketValue}
              marketValue={marketValue}
              pnl={0}
              available={available}
            />
          </Box>
          <Box sx={{ px: 1, py: 1, borderBottom: 1, borderColor: 'divider' }}>
            <SectionTitle>交易</SectionTitle>
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
                  slotProps={{ htmlInput: { min: 0, step: 1, 'aria-label': '买入数量' } }}
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
                  slotProps={{ htmlInput: { min: 0, step: 1, 'aria-label': '卖出数量' } }}
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
            />
          </Box>
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0 }} />
      )}
    </Box>
  )
}

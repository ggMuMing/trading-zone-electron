import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import { JournalTextField, journalChoiceSx } from './journalField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useEffect, useMemo, useState } from 'react'
import {
  closingFillError,
  firstDayPnl,
  journalStatus,
  netPnl,
  planFees,
  readTradeJournalDraft,
  replayPosition,
  tradeJournalDraftOf,
  type PlanFeeResult
} from '../../../../shared/tradeJournal/tradeJournal'
import type {
  TradeBuyFill,
  TradeFill,
  TradeJournal,
  TradeJournalDraft,
  TradeOrderType,
  TradeSide,
  TradeStyle
} from '../../../../shared/types/tradeJournal'
import type { Stock } from '../../../../shared/types/stock'
import { matchesStockQuery } from '../stockMatch'
import { queryDailyClose, queryLatestCloses } from './journalQuotes'
import {
  compareFills,
  formatInputNumber,
  formatMoney,
  formatNetPnl,
  formatPrice,
  formatQty,
  statusLabel
} from './journalText'

interface JournalDialogProps {
  record: TradeJournal | null
  stocks: Stock[]
  initials: Map<string, string>
  onClose: () => void
  onSaved: () => void
}

interface JournalFormState {
  commissionPct: string
  stampTaxPct: string
  otherFee: string
  tsCode: string
  name: string
  side: TradeSide | ''
  style: TradeStyle
  reason: string
  sourceOrg: string
  sourcePerson: string
  entryPrice: string
  entryDate: string
  quantity: string
  orderType: TradeOrderType
  entryFeeAuto: boolean
  entryFee: string
  flatExitFeeAuto: boolean
  flatExitFee: string
  breakevenAuto: boolean
  breakevenPrice: string
  reasonStillHolds: boolean
  buys: TradeBuyFill[]
  sells: TradeFill[]
}

interface FillEditorState {
  tradeDate: string
  price: string
  quantity: string
  fee: string
  firstDayPnlAuto: boolean
  firstDayPnl: string
}

export function JournalDialog({
  record,
  stocks,
  initials,
  onClose,
  onSaved
}: JournalDialogProps): React.JSX.Element {
  const locked = record != null
  const [form, setForm] = useState<JournalFormState>(() => (record ? formFromRecord(record) : emptyForm()))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [checked, setChecked] = useState(false)
  const [buyEditor, setBuyEditor] = useState<FillEditorState | null>(null)
  const [sellEditor, setSellEditor] = useState<FillEditorState | null>(null)
  const [fillError, setFillError] = useState<string | null>(null)
  const [autoPnl, setAutoPnl] = useState<number | null>(null)
  const [autoPnlError, setAutoPnlError] = useState<string | null>(null)
  const [pnlLoading, setPnlLoading] = useState(false)
  const [latestClose, setLatestClose] = useState<number | null>(null)
  const [closeReady, setCloseReady] = useState(false)

  const fees = useMemo(() => (locked ? null : feesOf(form)), [locked, form])
  const entryFeeShown = shownFee(locked, form.entryFeeAuto, form.entryFee, fees?.entryFee)
  const flatExitShown = shownFee(locked, form.flatExitFeeAuto, form.flatExitFee, fees?.flatExitFee)
  const breakevenShown = shownFee(locked, form.breakevenAuto, form.breakevenPrice, fees?.breakevenPrice)

  useEffect(() => {
    const side = form.side
    if (!buyEditor?.firstDayPnlAuto || (side !== 'long' && side !== 'short') || !form.tsCode) {
      setAutoPnl(null)
      setAutoPnlError(null)
      setPnlLoading(false)
      return
    }
    if (!isIsoDate(buyEditor.tradeDate)) {
      setAutoPnl(null)
      setAutoPnlError(null)
      setPnlLoading(false)
      return
    }
    const price = Number(buyEditor.price)
    const quantity = Number(buyEditor.quantity)
    if (!(price > 0) || !(quantity > 0)) {
      setAutoPnl(null)
      setAutoPnlError(null)
      setPnlLoading(false)
      return
    }
    let cancelled = false
    setPnlLoading(true)
    setAutoPnlError(null)
    void queryDailyClose(form.tsCode, buyEditor.tradeDate)
      .then((close) => {
        if (cancelled) {
          return
        }
        if (close == null) {
          setAutoPnl(null)
          setAutoPnlError('缺少该日行情')
          return
        }
        setAutoPnl(firstDayPnl(side, price, quantity, close))
        setAutoPnlError(null)
      })
      .catch(() => {
        if (!cancelled) {
          setAutoPnl(null)
          setAutoPnlError('缺少该日行情')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPnlLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [buyEditor, form.side, form.tsCode])

  useEffect(() => {
    if ((form.side !== 'long' && form.side !== 'short') || !form.tsCode) {
      setLatestClose(null)
      setCloseReady(true)
      return
    }
    let status: ReturnType<typeof journalStatus>
    try {
      status = journalStatus({ side: form.side, buys: form.buys, sells: form.sells })
    } catch {
      setCloseReady(true)
      return
    }
    if (status !== 'open') {
      setLatestClose(null)
      setCloseReady(true)
      return
    }
    let cancelled = false
    setCloseReady(false)
    void queryLatestCloses([form.tsCode]).then((map) => {
      if (!cancelled) {
        setLatestClose(map[form.tsCode] ?? null)
        setCloseReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [form.side, form.tsCode, form.buys, form.sells])

  const position = useMemo(() => {
    if (form.side !== 'long' && form.side !== 'short') {
      return { quantity: 0, avgCost: null as number | null, totalFee: 0, realized: 0 }
    }
    try {
      return replayPosition({ side: form.side, buys: form.buys, sells: form.sells })
    } catch {
      return { quantity: 0, avgCost: null, totalFee: 0, realized: 0 }
    }
  }, [form.side, form.buys, form.sells])

  const netText = useMemo(() => {
    if ((form.side !== 'long' && form.side !== 'short') || (form.buys.length === 0 && form.sells.length === 0)) {
      return '—'
    }
    let status: ReturnType<typeof journalStatus>
    try {
      status = journalStatus({ side: form.side, buys: form.buys, sells: form.sells })
    } catch {
      return '—'
    }
    if (status === 'open' && !closeReady) {
      return '…'
    }
    return formatNetPnl(
      netPnl({ side: form.side, buys: form.buys, sells: form.sells }, status === 'open' ? latestClose : null)
    )
  }, [form.side, form.buys, form.sells, closeReady, latestClose])

  let statusText: string | null = null
  if (locked && (form.side === 'long' || form.side === 'short')) {
    try {
      statusText = statusLabel(journalStatus({ side: form.side, buys: form.buys, sells: form.sells }))
    } catch {
      statusText = null
    }
  }

  const requiredErrors = useMemo(() => (checked && !locked ? requiredFieldErrors(form) : {}), [checked, locked, form])

  const save = (): void => {
    if (!locked) {
      setChecked(true)
      if (Object.keys(requiredFieldErrors(form)).length > 0) {
        setError(null)
        return
      }
    }
    setSaving(true)
    setError(null)
    let draft: TradeJournalDraft
    try {
      draft = draftFromForm(form, locked)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : String(reason))
      setSaving(false)
      return
    }
    if (journalStatus(draft) === 'closed' && !window.confirm('保存后变为已完成，不能再改')) {
      setSaving(false)
      return
    }
    const request = record
      ? window.api.tradeJournal.update({ id: record.id, draft })
      : window.api.tradeJournal.create({ draft })
    void request
      .then(() => onSaved())
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason))
        setSaving(false)
      })
  }

  const addBuy = (): void => {
    if (!buyEditor) {
      return
    }
    const built = buildFill(form, 'buy', buyEditor, buyEditor.firstDayPnlAuto ? autoPnl : Number(buyEditor.firstDayPnl), {
      loading: buyEditor.firstDayPnlAuto && pnlLoading,
      autoError: autoPnlError
    })
    if (typeof built === 'string') {
      setFillError(built)
      return
    }
    setForm((prev) => ({ ...prev, buys: [...prev.buys, built] }))
    setBuyEditor(null)
    setFillError(null)
  }

  const addSell = (): void => {
    if (!sellEditor) {
      return
    }
    const built = buildFill(form, 'sell', sellEditor, 0, { loading: false, autoError: null })
    if (typeof built === 'string') {
      setFillError(built)
      return
    }
    const fill: TradeFill = {
      id: built.id,
      seq: built.seq,
      tradeDate: built.tradeDate,
      price: built.price,
      quantity: built.quantity,
      fee: built.fee
    }
    setForm((prev) => ({ ...prev, sells: [...prev.sells, fill] }))
    setSellEditor(null)
    setFillError(null)
  }

  const removeFill = (kind: 'buy' | 'sell', id: string): void => {
    const buys = kind === 'buy' ? form.buys.filter((fill) => fill.id !== id) : form.buys
    const sells = kind === 'sell' ? form.sells.filter((fill) => fill.id !== id) : form.sells
    if (form.side === 'long' || form.side === 'short') {
      try {
        replayPosition({ side: form.side, buys, sells })
      } catch (reason: unknown) {
        setError(reason instanceof Error ? reason.message : String(reason))
        return
      }
    }
    setForm((prev) => ({ ...prev, buys, sells }))
  }

  return (
    <Dialog
      fullScreen
      open
      onClose={onClose}
      slotProps={{
        paper: {
          sx: (theme) =>
            theme.palette.mode === 'dark'
              ? { bgcolor: 'background.default', backgroundImage: 'none' }
              : { backgroundImage: 'none' }
        }
      }}
    >
      <Box sx={{ height: '100%', overflow: 'auto' }}>
        <Box sx={{ width: 'max-content', minWidth: '100%', display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ width: 960, px: 3, py: 2 }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={(theme) => ({
                position: 'sticky',
                top: 0,
                zIndex: 1,
                py: 1.25,
                mb: 1,
                bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'background.paper',
                borderBottom: 1,
                borderColor: 'divider'
              })}
            >
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                {locked ? '编辑交易' : '创建交易'}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button onClick={onClose}>关闭</Button>
                <Button variant="contained" onClick={save} disabled={saving}>
                  保存
                </Button>
              </Stack>
            </Stack>
            {statusText ? (
              <Typography variant="body2" sx={{ mb: 1 }}>
                状态：{statusText}
              </Typography>
            ) : null}
            {Object.keys(requiredErrors).length > 0 ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {Object.values(requiredErrors).join('；')}
              </Alert>
            ) : error ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            ) : null}
            <SectionTitle>息费</SectionTitle>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
              <JournalTextField
                size="small"
                label="佣金（%）"
                required
                value={form.commissionPct}
                disabled={locked}
                error={Boolean(requiredErrors.commissionPct)}
                helperText={requiredErrors.commissionPct}
                onChange={(event) => setForm((prev) => ({ ...prev, commissionPct: event.target.value }))}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
              <JournalTextField
                size="small"
                label="印花税（%）"
                required
                value={form.stampTaxPct}
                disabled={locked}
                error={Boolean(requiredErrors.stampTaxPct)}
                helperText={requiredErrors.stampTaxPct}
                onChange={(event) => setForm((prev) => ({ ...prev, stampTaxPct: event.target.value }))}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
              <JournalTextField
                size="small"
                label="其他费用和"
                value={form.otherFee}
                disabled={locked}
                onChange={(event) => setForm((prev) => ({ ...prev, otherFee: event.target.value }))}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
            </Box>
            <SectionTitle>交易分析</SectionTitle>
            <FieldGrid>
              {locked ? (
                <JournalTextField size="small" label="标的" value={`${form.name} ${form.tsCode}`} disabled required />
              ) : (
                <Autocomplete
                  options={stocks}
                  value={stocks.find((stock) => stock.ts_code === form.tsCode) ?? null}
                  onChange={(_event, option) =>
                    setForm((prev) => ({
                      ...prev,
                      tsCode: option?.ts_code ?? '',
                      name: option?.name ?? ''
                    }))
                  }
                  getOptionLabel={(stock) => `${stock.name} ${stock.ts_code}`}
                  isOptionEqualToValue={(left, right) => left.ts_code === right.ts_code}
                  filterOptions={(options, state) => {
                    const query = state.inputValue.trim().toLowerCase()
                    if (!query) {
                      return []
                    }
                    return options
                      .filter((stock) => matchesStockQuery(stock, query, initials.get(stock.ts_code) ?? ''))
                      .slice(0, 30)
                  }}
                  renderInput={(params) => (
                    <JournalTextField
                      {...params}
                      size="small"
                      label="标的"
                      required
                      placeholder="输入名称或代码"
                      error={Boolean(requiredErrors.symbol)}
                      helperText={requiredErrors.symbol}
                    />
                  )}
                />
              )}
              <JournalTextField
                select
                size="small"
                label="方向"
                required
                value={form.side}
                disabled={locked}
                error={Boolean(requiredErrors.side)}
                helperText={requiredErrors.side}
                onChange={(event) => setForm((prev) => ({ ...prev, side: event.target.value as TradeSide }))}
              >
                <MenuItem value="">请选择</MenuItem>
                <MenuItem value="long">做多</MenuItem>
                <MenuItem value="short">做空</MenuItem>
              </JournalTextField>
              <JournalTextField
                select
                size="small"
                label="交易类型"
                value={form.style}
                disabled={locked}
                onChange={(event) => setForm((prev) => ({ ...prev, style: event.target.value as TradeStyle }))}
              >
                <MenuItem value="left">左侧交易</MenuItem>
                <MenuItem value="right">右侧交易</MenuItem>
              </JournalTextField>
              <JournalTextField
                select
                size="small"
                label="入场指令"
                value={form.orderType}
                disabled={locked}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, orderType: event.target.value as TradeOrderType }))
                }
              >
                <MenuItem value="limit">限价单</MenuItem>
                <MenuItem value="market">市价单</MenuItem>
              </JournalTextField>
              <JournalTextField
                size="small"
                label="明确进场理由"
                value={form.reason}
                disabled={locked}
                multiline
                minRows={3}
                onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
                sx={{ gridColumn: '1 / -1' }}
              />
              <JournalTextField
                size="small"
                label="信息来源机构"
                value={form.sourceOrg}
                disabled={locked}
                onChange={(event) => setForm((prev) => ({ ...prev, sourceOrg: event.target.value }))}
              />
              <JournalTextField
                size="small"
                label="信息来源个人"
                value={form.sourcePerson}
                disabled={locked}
                onChange={(event) => setForm((prev) => ({ ...prev, sourcePerson: event.target.value }))}
              />
              <JournalTextField
                size="small"
                label="进场价"
                required
                value={form.entryPrice}
                disabled={locked}
                error={Boolean(requiredErrors.entryPrice)}
                helperText={requiredErrors.entryPrice}
                onChange={(event) => setForm((prev) => ({ ...prev, entryPrice: event.target.value }))}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
              <JournalTextField
                size="small"
                type="date"
                label="进场时间"
                required
                value={form.entryDate}
                disabled={locked}
                error={Boolean(requiredErrors.entryDate)}
                helperText={requiredErrors.entryDate}
                onChange={(event) => setForm((prev) => ({ ...prev, entryDate: event.target.value }))}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <JournalTextField
                size="small"
                label="交易数量"
                required
                value={form.quantity}
                disabled={locked}
                error={Boolean(requiredErrors.quantity)}
                helperText={requiredErrors.quantity}
                onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
              <FeeField
                label="进场费用"
                helper="进场费用=佣金+滑点"
                value={entryFeeShown}
                auto={form.entryFeeAuto}
                disabled={locked}
                errorText={requiredErrors.entryFee}
                onChange={(value) => setForm((prev) => ({ ...prev, entryFee: value }))}
                onAuto={(checked) =>
                  setForm((prev) => ({
                    ...prev,
                    entryFeeAuto: checked,
                    entryFee: checked ? prev.entryFee : entryFeeShown
                  }))
                }
              />
              <FeeField
                label="原地出场费用"
                helper="以入场价出场产生的费用"
                value={flatExitShown}
                auto={form.flatExitFeeAuto}
                disabled={locked}
                errorText={requiredErrors.flatExitFee}
                onChange={(value) => setForm((prev) => ({ ...prev, flatExitFee: value }))}
                onAuto={(checked) =>
                  setForm((prev) => ({
                    ...prev,
                    flatExitFeeAuto: checked,
                    flatExitFee: checked ? prev.flatExitFee : flatExitShown
                  }))
                }
              />
              <FeeField
                label="盈亏平衡价"
                helper={
                  !locked && form.breakevenAuto && fees != null && fees.breakevenPrice == null
                    ? '加入买入和原地卖出费用后得出的价格。无法计算'
                    : '加入买入和原地卖出费用后得出的价格'
                }
                value={breakevenShown}
                auto={form.breakevenAuto}
                disabled={locked}
                errorText={requiredErrors.breakeven}
                onChange={(value) => setForm((prev) => ({ ...prev, breakevenPrice: value }))}
                onAuto={(checked) =>
                  setForm((prev) => ({
                    ...prev,
                    breakevenAuto: checked,
                    breakevenPrice: checked ? prev.breakevenPrice : breakevenShown
                  }))
                }
              />
            </FieldGrid>
            <SectionTitle>投后管理</SectionTitle>
            <FormControlLabel
              sx={journalChoiceSx}
              control={
                <Checkbox
                  size="small"
                  checked={form.reasonStillHolds}
                  onChange={(event) => setForm((prev) => ({ ...prev, reasonStillHolds: event.target.checked }))}
                />
              }
              label="进场理由是否仍成立"
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, my: 1 }}>
              <Stat label="持仓数量" value={formatQty(position.quantity)} />
              <Stat label="持仓成本" value={position.avgCost == null ? '—' : formatPrice(position.avgCost)} />
              <Stat label="交易费用" value={formatMoney(position.totalFee)} />
              <Stat label="净收益" value={netText} />
            </Box>
            {fillError ? (
              <Alert severity="warning" sx={{ mb: 1 }}>
                {fillError}
              </Alert>
            ) : null}
            <FillSection
              title="买入"
              rows={[...form.buys].sort(compareFills)}
              extraHeader="入场首日盈亏"
              extraCell={(fill) => formatNetPnl({ state: 'value', value: (fill as TradeBuyFill).firstDayPnl })}
              editor={buyEditor}
              showPnl
              pnlValue={buyEditor?.firstDayPnlAuto ? (autoPnl == null ? '' : formatInputNumber(autoPnl)) : undefined}
              pnlError={autoPnlError}
              addDisabled={Boolean(buyEditor?.firstDayPnlAuto && pnlLoading)}
              onOpen={() => {
                setBuyEditor(emptyFillEditor())
                setSellEditor(null)
                setFillError(null)
              }}
              onChange={setBuyEditor}
              onAdd={addBuy}
              onCancel={() => {
                setBuyEditor(null)
                setFillError(null)
              }}
              onRemove={(id) => removeFill('buy', id)}
            />
            <FillSection
              title="卖出"
              rows={[...form.sells].sort(compareFills)}
              editor={sellEditor}
              showPnl={false}
              addDisabled={false}
              onOpen={() => {
                setSellEditor(emptyFillEditor())
                setBuyEditor(null)
                setFillError(null)
              }}
              onChange={setSellEditor}
              onAdd={addSell}
              onCancel={() => {
                setSellEditor(null)
                setFillError(null)
              }}
              onRemove={(id) => removeFill('sell', id)}
            />
          </Box>
        </Box>
      </Box>
    </Dialog>
  )
}

function SectionTitle({ children }: { children: string }): React.JSX.Element {
  return (
    <Typography variant="subtitle1" sx={{ mt: 2.5, mb: 1.5, fontWeight: 700, color: 'text.primary' }}>
      {children}
    </Typography>
  )
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  )
}

function FieldGrid({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>{children}</Box>
}

function FeeField({
  label,
  helper,
  value,
  auto,
  disabled,
  errorText,
  onChange,
  onAuto
}: {
  label: string
  helper: string
  value: string
  auto: boolean
  disabled: boolean
  errorText?: string
  onChange: (value: string) => void
  onAuto: (checked: boolean) => void
}): React.JSX.Element {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <JournalTextField
        size="small"
        fullWidth
        label={label}
        value={value}
        disabled={disabled || auto}
        error={Boolean(errorText)}
        helperText={errorText ?? helper}
        onChange={(event) => onChange(event.target.value)}
        slotProps={{ htmlInput: { inputMode: 'decimal' } }}
      />
      <FormControlLabel
        sx={journalChoiceSx}
        control={
          <Checkbox
            size="small"
            checked={auto}
            disabled={disabled}
            onChange={(event) => onAuto(event.target.checked)}
          />
        }
        label="自动计算"
      />
    </Stack>
  )
}

function FillSection({
  title,
  rows,
  extraHeader,
  extraCell,
  editor,
  showPnl,
  pnlValue,
  pnlError,
  addDisabled,
  onOpen,
  onChange,
  onAdd,
  onCancel,
  onRemove
}: {
  title: string
  rows: Array<TradeFill | TradeBuyFill>
  extraHeader?: string
  extraCell?: (fill: TradeFill | TradeBuyFill) => string
  editor: FillEditorState | null
  showPnl: boolean
  pnlValue?: string
  pnlError?: string | null
  addDisabled: boolean
  onOpen: () => void
  onChange: (next: FillEditorState) => void
  onAdd: () => void
  onCancel: () => void
  onRemove: (id: string) => void
}): React.JSX.Element {
  return (
    <Box sx={{ mt: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="body1">{title}</Typography>
        <Tooltip title={title}>
          <span>
            <IconButton size="small" aria-label={title} onClick={onOpen} disabled={editor != null}>
              <AddIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      {editor ? (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="flex-start" sx={{ my: 1 }}>
          <JournalTextField
            size="small"
            type="date"
            label="成交时间"
            value={editor.tradeDate}
            onChange={(event) => onChange({ ...editor, tradeDate: event.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ width: 160 }}
          />
          <JournalTextField
            size="small"
            label="成交价"
            value={editor.price}
            onChange={(event) => onChange({ ...editor, price: event.target.value })}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            sx={{ width: 120 }}
          />
          <JournalTextField
            size="small"
            label="成交数量"
            value={editor.quantity}
            onChange={(event) => onChange({ ...editor, quantity: event.target.value })}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            sx={{ width: 120 }}
          />
          <JournalTextField
            size="small"
            label="成交费用"
            value={editor.fee}
            onChange={(event) => onChange({ ...editor, fee: event.target.value })}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            sx={{ width: 120 }}
          />
          {showPnl ? (
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <JournalTextField
                size="small"
                label="入场首日盈亏"
                value={editor.firstDayPnlAuto ? (pnlValue ?? '') : editor.firstDayPnl}
                disabled={editor.firstDayPnlAuto}
                helperText={pnlError ?? '可用成交当日收盘自动计算'}
                onChange={(event) => onChange({ ...editor, firstDayPnl: event.target.value })}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                sx={{ width: 180 }}
              />
              <FormControlLabel
                sx={journalChoiceSx}
                control={
                  <Checkbox
                    size="small"
                    checked={editor.firstDayPnlAuto}
                    onChange={(event) => onChange({ ...editor, firstDayPnlAuto: event.target.checked })}
                  />
                }
                label="自动计算"
              />
            </Stack>
          ) : null}
          <Button size="small" variant="contained" onClick={onAdd} disabled={addDisabled}>
            加入
          </Button>
          <Button size="small" onClick={onCancel}>
            取消
          </Button>
        </Stack>
      ) : null}
      {rows.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          还没有{title}记录
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>成交时间</TableCell>
              <TableCell align="right">成交价</TableCell>
              <TableCell align="right">成交数量</TableCell>
              <TableCell align="right">成交费用</TableCell>
              {extraHeader ? <TableCell align="right">{extraHeader}</TableCell> : null}
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((fill) => (
              <TableRow key={fill.id}>
                <TableCell>{fill.tradeDate}</TableCell>
                <TableCell align="right">{formatPrice(fill.price)}</TableCell>
                <TableCell align="right">{formatQty(fill.quantity)}</TableCell>
                <TableCell align="right">{formatMoney(fill.fee)}</TableCell>
                {extraCell ? <TableCell align="right">{extraCell(fill)}</TableCell> : null}
                <TableCell align="right">
                  <IconButton aria-label={`删除${title}`} onClick={() => onRemove(fill.id)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  )
}

function emptyForm(): JournalFormState {
  return {
    commissionPct: '0.05',
    stampTaxPct: '0.05',
    otherFee: '0',
    tsCode: '',
    name: '',
    side: '',
    style: 'left',
    reason: '',
    sourceOrg: '',
    sourcePerson: '',
    entryPrice: '',
    entryDate: '',
    quantity: '',
    orderType: 'limit',
    entryFeeAuto: true,
    entryFee: '',
    flatExitFeeAuto: true,
    flatExitFee: '',
    breakevenAuto: true,
    breakevenPrice: '',
    reasonStillHolds: true,
    buys: [],
    sells: []
  }
}

function formFromRecord(record: TradeJournal): JournalFormState {
  const draft = tradeJournalDraftOf(record)
  return {
    commissionPct: String(draft.commissionPct),
    stampTaxPct: String(draft.stampTaxPct),
    otherFee: String(draft.otherFee),
    tsCode: draft.tsCode,
    name: draft.name,
    side: draft.side,
    style: draft.style,
    reason: draft.reason,
    sourceOrg: draft.sourceOrg,
    sourcePerson: draft.sourcePerson,
    entryPrice: String(draft.entryPrice),
    entryDate: draft.entryDate,
    quantity: String(draft.quantity),
    orderType: draft.orderType,
    entryFeeAuto: draft.entryFeeAuto,
    entryFee: draft.entryFee == null ? '' : String(draft.entryFee),
    flatExitFeeAuto: draft.flatExitFeeAuto,
    flatExitFee: draft.flatExitFee == null ? '' : String(draft.flatExitFee),
    breakevenAuto: draft.breakevenAuto,
    breakevenPrice: draft.breakevenPrice == null ? '' : String(draft.breakevenPrice),
    reasonStillHolds: draft.reasonStillHolds,
    buys: draft.buys,
    sells: draft.sells
  }
}

function emptyFillEditor(): FillEditorState {
  return {
    tradeDate: '',
    price: '',
    quantity: '',
    fee: '',
    firstDayPnlAuto: true,
    firstDayPnl: ''
  }
}

function feesOf(form: JournalFormState): PlanFeeResult | null {
  if (form.side !== 'long' && form.side !== 'short') {
    return null
  }
  return planFees({
    side: form.side,
    entryPrice: Number(form.entryPrice),
    quantity: Number(form.quantity),
    commissionPct: Number(form.commissionPct),
    stampTaxPct: Number(form.stampTaxPct),
    otherFee: form.otherFee.trim() === '' ? 0 : Number(form.otherFee)
  })
}

function shownFee(locked: boolean, auto: boolean, stored: string, computed: number | null | undefined): string {
  if (locked || !auto) {
    return stored
  }
  return computed == null ? '' : formatInputNumber(computed)
}

function draftFromForm(form: JournalFormState, locked: boolean): TradeJournalDraft {
  if (form.side !== 'long' && form.side !== 'short') {
    throw new Error('请选择方向')
  }
  const fees = locked ? null : feesOf(form)
  const entryFee = form.entryFeeAuto && !locked ? (fees?.entryFee ?? null) : numberOrNull(form.entryFee)
  const flatExitFee =
    form.flatExitFeeAuto && !locked ? (fees?.flatExitFee ?? null) : numberOrNull(form.flatExitFee)
  const breakevenPrice =
    form.breakevenAuto && !locked ? (fees?.breakevenPrice ?? null) : numberOrNull(form.breakevenPrice)
  return readTradeJournalDraft({
    commissionPct: Number(form.commissionPct),
    stampTaxPct: Number(form.stampTaxPct),
    otherFee: form.otherFee.trim() === '' ? 0 : Number(form.otherFee),
    tsCode: form.tsCode,
    name: form.name,
    side: form.side,
    style: form.style,
    reason: form.reason,
    sourceOrg: form.sourceOrg,
    sourcePerson: form.sourcePerson,
    entryPrice: Number(form.entryPrice),
    entryDate: form.entryDate,
    quantity: Number(form.quantity),
    orderType: form.orderType,
    entryFeeAuto: form.entryFeeAuto,
    entryFee,
    flatExitFeeAuto: form.flatExitFeeAuto,
    flatExitFee,
    breakevenAuto: form.breakevenAuto,
    breakevenPrice,
    reasonStillHolds: form.reasonStillHolds,
    buys: form.buys,
    sells: form.sells
  })
}

function buildFill(
  form: JournalFormState,
  kind: 'buy' | 'sell',
  editor: FillEditorState,
  pnl: number | null,
  auto: { loading: boolean; autoError: string | null }
): TradeBuyFill | string {
  if (form.side !== 'long' && form.side !== 'short') {
    return '请先选择方向'
  }
  if (!form.tsCode) {
    return '请先选择标的'
  }
  if (!isIsoDate(editor.tradeDate)) {
    return '请填写成交时间'
  }
  const price = Number(editor.price)
  const quantity = Number(editor.quantity)
  const fee = Number(editor.fee)
  if (!(price > 0)) {
    return '成交价需大于 0'
  }
  if (!(quantity > 0)) {
    return '成交数量需大于 0'
  }
  if (!Number.isFinite(fee) || fee < 0) {
    return '成交费用需大于等于 0'
  }
  const closeError = closingFillError({ side: form.side, buys: form.buys, sells: form.sells }, kind, quantity)
  if (closeError) {
    return closeError
  }
  let firstDayPnlValue = 0
  if (kind === 'buy') {
    if (editor.firstDayPnlAuto) {
      if (auto.loading) {
        return '正在计算入场首日盈亏'
      }
      if (pnl == null || !Number.isFinite(pnl)) {
        return auto.autoError ?? '缺少该日行情'
      }
      firstDayPnlValue = pnl
    } else if (pnl == null || !Number.isFinite(pnl)) {
      return '请填写入场首日盈亏'
    } else {
      firstDayPnlValue = pnl
    }
  }
  return {
    id: crypto.randomUUID().replaceAll('-', ''),
    seq: nextSeq(form),
    tradeDate: editor.tradeDate,
    price,
    quantity,
    fee,
    firstDayPnl: firstDayPnlValue,
    firstDayPnlAuto: kind === 'buy' ? editor.firstDayPnlAuto : false
  }
}

function nextSeq(form: JournalFormState): number {
  const seqs = [...form.buys, ...form.sells].map((fill) => fill.seq)
  return seqs.length === 0 ? 0 : Math.max(...seqs) + 1
}

function numberOrNull(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) {
    return null
  }
  return Number(trimmed)
}

function requiredFieldErrors(form: JournalFormState): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!isPercentText(form.commissionPct)) {
    errors.commissionPct = '请填写佣金'
  }
  if (!isPercentText(form.stampTaxPct)) {
    errors.stampTaxPct = '请填写印花税'
  }
  if (!form.tsCode.trim() || !form.name.trim()) {
    errors.symbol = '请选择标的'
  }
  if (form.side !== 'long' && form.side !== 'short') {
    errors.side = '请选择方向'
  }
  if (!(Number(form.entryPrice) > 0)) {
    errors.entryPrice = '请填写进场价'
  }
  if (!isIsoDate(form.entryDate)) {
    errors.entryDate = '请填写进场时间'
  }
  if (!(Number(form.quantity) > 0)) {
    errors.quantity = '请填写交易数量'
  }
  if (!form.entryFeeAuto && !isFeeText(form.entryFee)) {
    errors.entryFee = '请填写进场费用'
  }
  if (!form.flatExitFeeAuto && !isFeeText(form.flatExitFee)) {
    errors.flatExitFee = '请填写原地出场费用'
  }
  if (!form.breakevenAuto && !(Number(form.breakevenPrice) > 0)) {
    errors.breakeven = '请填写盈亏平衡价'
  }
  return errors
}

function isPercentText(text: string): boolean {
  const value = Number(text)
  return text.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= 100
}

function isFeeText(text: string): boolean {
  const value = Number(text)
  return text.trim() !== '' && Number.isFinite(value) && value >= 0
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

import CloseIcon from '@mui/icons-material/Close'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormHelperText from '@mui/material/FormHelperText'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  emptyChartReviewDraft,
  sameChartReview
} from '../../../../shared/chartReview/readChartReview'
import {
  CHART_REVIEW_MA,
  type ChartReviewDraft,
  type ChartReviewKeyPoint,
  type ChartReviewMa,
  type ChartReviewRectangle,
  type ChartReviewVolatility,
  type ChartReviewYesNo
} from '../../../../shared/types/chartReview'
import type { Stock } from '../../../../shared/types/stock'
import { matchesStockQuery, pinyinInitials } from '../stockMatch'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

const KEY_POINT_OPTIONS: Array<{ value: ChartReviewKeyPoint; label: string }> = [
  { value: 'left', label: '左侧关键点' },
  { value: 'none', label: '无关键点' },
  { value: 'right', label: '右侧关键点' }
]

const RECTANGLE_OPTIONS: Array<{ value: ChartReviewRectangle; label: string }> = [
  { value: 'absent', label: '未形成矩形' },
  { value: 'inside', label: '矩形中' },
  { value: 'breakout', label: '突破矩形' }
]

const VOLATILITY_OPTIONS: Array<{ value: ChartReviewVolatility; label: string }> = [
  { value: 'squeeze', label: '坍缩' },
  { value: 'expand', label: '扩大' }
]

const YES_NO_OPTIONS: Array<{ value: ChartReviewYesNo; label: string }> = [
  { value: 'yes', label: '是' },
  { value: 'no', label: '否' }
]

const LEADER_OPTIONS: Array<{ value: ChartReviewYesNo; label: string }> = [
  { value: 'yes', label: '有' },
  { value: 'no', label: '无' }
]

export interface ReviewPanelHandle {
  confirmLeave: () => Promise<boolean>
}

export interface ReviewPanelProps {
  tsCode: string | null
  symbolLabel: string
  chartCode: string | null
  chartTimes: readonly string[] | null
  chartFault: string | null
  stocks: readonly Stock[]
  onJumpToDate: (isoDate: string) => void
  onClose: () => void
}

export const ReviewPanel = forwardRef<ReviewPanelHandle, ReviewPanelProps>(function ReviewPanel(
  { tsCode, symbolLabel, chartCode, chartTimes, chartFault, stocks, onJumpToDate, onClose },
  ref
) {
  const [tradeDate, setTradeDate] = useState<string | null>(null)
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())
  const [draft, setDraft] = useState<ChartReviewDraft>(() => emptyChartReviewDraft())
  const [saved, setSaved] = useState<ChartReviewDraft>(() => emptyChartReviewDraft())
  const [hasRecord, setHasRecord] = useState(false)
  const [savedDates, setSavedDates] = useState<readonly string[]>([])
  const [volumeText, setVolumeText] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const draftRef = useRef(draft)
  const savedRef = useRef(saved)
  const leaveResolveRef = useRef<((ok: boolean) => void) | null>(null)
  const leavePendingRef = useRef<Promise<boolean> | null>(null)
  const performSaveRef = useRef<() => Promise<boolean>>(async () => false)
  draftRef.current = draft
  savedRef.current = saved

  const timeSet = useMemo(() => new Set(chartTimes ?? []), [chartTimes])
  const savedDateSet = useMemo(() => new Set(savedDates), [savedDates])
  const chartReady = Boolean(tsCode && chartCode === tsCode && chartTimes && chartTimes.length > 0)
  const formEnabled = chartReady && tradeDate != null && !loading && !saving
  const dirty = !loading && !sameChartReview(draft, saved)
  const cells = useMemo(() => buildMonthCells(viewYear, viewMonth), [viewYear, viewMonth])
  const initials = useMemo(() => {
    const map = new Map<string, string>()
    for (const stock of stocks) {
      map.set(stock.ts_code, pinyinInitials(stock.name))
    }
    return map
  }, [stocks])
  const leaderOptions = useMemo(() => {
    const options = stocks.map((stock) => ({
      tsCode: stock.ts_code,
      name: stock.name || stock.ts_code
    }))
    if (draft.leaderTsCode && !options.some((option) => option.tsCode === draft.leaderTsCode)) {
      options.unshift({
        tsCode: draft.leaderTsCode,
        name: draft.leaderName || draft.leaderTsCode
      })
    }
    return options
  }, [stocks, draft.leaderTsCode, draft.leaderName])
  const leaderValue =
    leaderOptions.find((option) => option.tsCode === draft.leaderTsCode) ?? null

  const locatedKeyRef = useRef<string | null>(null)
  const loadedKeyRef = useRef<string | null>(null)
  const jumpRef = useRef(onJumpToDate)
  jumpRef.current = onJumpToDate

  useEffect(() => {
    if (!tsCode || chartCode !== tsCode || !chartTimes || chartTimes.length === 0) {
      return
    }
    const next =
      tradeDate && chartTimes.includes(tradeDate)
        ? tradeDate
        : (chartTimes[chartTimes.length - 1] ?? null)
    if (!next) {
      return
    }
    if (next !== tradeDate) {
      setTradeDate(next)
    }
    const locatedKey = `${tsCode}:${next}`
    if (locatedKeyRef.current !== locatedKey) {
      locatedKeyRef.current = locatedKey
      jumpRef.current(next)
    }
  }, [tsCode, chartCode, chartTimes, tradeDate])

  useEffect(() => {
    if (!tradeDate) {
      return
    }
    const year = Number(tradeDate.slice(0, 4))
    const month = Number(tradeDate.slice(5, 7)) - 1
    if (Number.isFinite(year) && month >= 0 && month <= 11) {
      setViewYear(year)
      setViewMonth(month)
    }
  }, [tradeDate])

  useEffect(() => {
    if (!tsCode || !tradeDate || chartCode !== tsCode || !chartTimes?.includes(tradeDate)) {
      return
    }
    const key = `${tsCode}:${tradeDate}`
    if (loadedKeyRef.current === key) {
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    const code = tsCode
    const date = tradeDate
    void (async () => {
      try {
        const [record, dates] = await Promise.all([
          window.api.chartReview.get({ tsCode: code, tradeDate: date }),
          window.api.chartReview.dates({ tsCode: code })
        ])
        if (cancelled) {
          return
        }
        const next = record?.draft ?? emptyChartReviewDraft()
        draftRef.current = next
        savedRef.current = next
        setDraft(next)
        setSaved(next)
        setHasRecord(record != null)
        setSavedDates(dates)
        setVolumeText(volumeTextOf(next))
        setSaveError(null)
        loadedKeyRef.current = key
      } catch (error: unknown) {
        if (cancelled) {
          return
        }
        setLoadError(error instanceof Error ? error.message : String(error))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tsCode, tradeDate, chartCode, chartTimes])

  const updateDraft = (next: ChartReviewDraft): void => {
    draftRef.current = next
    setDraft(next)
  }

  const performSave = async (): Promise<boolean> => {
    if (!tsCode || !tradeDate || chartCode !== tsCode) {
      return false
    }
    setSaving(true)
    setSaveError(null)
    try {
      const record = await window.api.chartReview.save({
        tsCode,
        tradeDate,
        draft: draftRef.current
      })
      draftRef.current = record.draft
      savedRef.current = record.draft
      setDraft(record.draft)
      setSaved(record.draft)
      setHasRecord(true)
      setSavedDates((current) =>
        current.includes(tradeDate) ? current : [...current, tradeDate].sort()
      )
      setVolumeText(volumeTextOf(record.draft))
      return true
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : String(error))
      return false
    } finally {
      setSaving(false)
    }
  }
  performSaveRef.current = performSave

  const finishLeave = (ok: boolean): void => {
    const resolve = leaveResolveRef.current
    leaveResolveRef.current = null
    leavePendingRef.current = null
    setLeaveOpen(false)
    resolve?.(ok)
  }

  const confirmLeave = (): Promise<boolean> => {
    if (sameChartReview(draftRef.current, savedRef.current)) {
      return Promise.resolve(true)
    }
    if (leavePendingRef.current) {
      return leavePendingRef.current
    }
    const pending = new Promise<boolean>((resolve) => {
      leaveResolveRef.current = resolve
    })
    leavePendingRef.current = pending
    setLeaveOpen(true)
    return pending
  }

  const confirmLeaveRef = useRef(confirmLeave)
  confirmLeaveRef.current = confirmLeave

  useImperativeHandle(
    ref,
    () => ({
      confirmLeave: () => confirmLeaveRef.current()
    }),
    []
  )

  const discardDraft = (): void => {
    const next = savedRef.current
    draftRef.current = next
    setDraft(next)
    setVolumeText(volumeTextOf(next))
    setSaveError(null)
    finishLeave(true)
  }

  const selectDate = (iso: string): void => {
    if (!timeSet.has(iso) || iso === tradeDate || loading || saving) {
      return
    }
    void (async () => {
      const ok = await confirmLeave()
      if (!ok) {
        return
      }
      setTradeDate(iso)
      onJumpToDate(iso)
    })()
  }

  const shiftView = (delta: number): void => {
    const next = new Date(Date.UTC(viewYear, viewMonth + delta, 1))
    setViewYear(next.getUTCFullYear())
    setViewMonth(next.getUTCMonth())
  }

  const clearRecord = async (): Promise<void> => {
    if (!tsCode || !tradeDate) {
      return
    }
    try {
      await window.api.chartReview.clear({ tsCode, tradeDate })
      const blank = emptyChartReviewDraft()
      draftRef.current = blank
      savedRef.current = blank
      setDraft(blank)
      setSaved(blank)
      setHasRecord(false)
      setSavedDates((current) => current.filter((date) => date !== tradeDate))
      setVolumeText('')
      setSaveError(null)
      setClearOpen(false)
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : String(error))
      setClearOpen(false)
    }
  }

  const statusText = !tsCode
    ? '请从左侧选择股票'
    : chartFault === tsCode
      ? '图表未能加载'
      : !chartReady
        ? loading || chartCode !== tsCode
          ? '加载中…'
          : '暂无日线数据'
        : loading
          ? '加载中…'
          : null

  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}
      >
        <Typography variant="subtitle2">复盘</Typography>
        <Typography variant="caption" noWrap sx={{ flex: 1, minWidth: 0 }} color="text.secondary">
          {symbolLabel}
        </Typography>
        <IconButton size="small" aria-label="关闭复盘" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 1.5, py: 1.5 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <IconButton size="small" aria-label="上个月" onClick={() => shiftView(-1)} disabled={loading}>
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
            <Typography variant="body2">
              {viewYear}年{viewMonth + 1}月
            </Typography>
            <IconButton size="small" aria-label="下个月" onClick={() => shiftView(1)} disabled={loading}>
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.25 }}>
            {WEEKDAYS.map((label) => (
              <Typography key={label} variant="caption" align="center" color="text.secondary">
                {label}
              </Typography>
            ))}
            {cells.map((cell) => {
              const selectable = chartReady && timeSet.has(cell.iso)
              const selected = cell.iso === tradeDate
              const marked = savedDateSet.has(cell.iso)
              return (
                <Button
                  key={cell.iso}
                  size="small"
                  disabled={!selectable || loading || saving}
                  onClick={() => selectDate(cell.iso)}
                  aria-label={cell.iso}
                  aria-pressed={selected}
                  sx={{
                    minWidth: 0,
                    px: 0,
                    py: 0.5,
                    color: selected
                      ? 'primary.contrastText'
                      : cell.inMonth
                        ? 'text.primary'
                        : 'text.disabled',
                    bgcolor: selected ? 'primary.main' : 'transparent',
                    position: 'relative'
                  }}
                >
                  {Number(cell.iso.slice(8, 10))}
                  {marked ? (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 2,
                        left: '50%',
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        transform: 'translateX(-50%)',
                        bgcolor: selected ? 'primary.contrastText' : 'primary.main'
                      }}
                    />
                  ) : null}
                </Button>
              )
            })}
          </Box>
          {statusText ? (
            <Typography variant="body2" color="text.secondary">
              {statusText}
            </Typography>
          ) : null}
          {loadError ? (
            <Typography variant="body2" color="error">
              {loadError}
            </Typography>
          ) : null}
          {tsCode && chartReady && tradeDate ? (
            <Stack spacing={1.5}>
              <Typography variant="subtitle2">看多</Typography>
              <ExclusiveChoice
                label="关键点"
                value={draft.keyPoint}
                options={KEY_POINT_OPTIONS}
                disabled={!formEnabled}
                onChange={(keyPoint) => updateDraft({ ...draft, keyPoint })}
              />
              <ExclusiveChoice
                label="矩形"
                value={draft.rectangle}
                options={RECTANGLE_OPTIONS}
                disabled={!formEnabled}
                onChange={(rectangle) => updateDraft({ ...draft, rectangle })}
              />
              <TextField
                size="small"
                label="处于矩形的位置"
                value={draft.rectanglePosition ?? ''}
                disabled={!formEnabled || draft.rectangle !== 'inside'}
                helperText={draft.rectangle === 'inside' ? undefined : '选择「矩形中」后可填'}
                onChange={(event) =>
                  updateDraft({ ...draft, rectanglePosition: event.target.value })
                }
              />
              <ExclusiveChoice
                label="是否回踩矩形"
                value={draft.rectangleRetest}
                options={YES_NO_OPTIONS}
                disabled={!formEnabled || draft.rectangle !== 'breakout'}
                hint={draft.rectangle === 'breakout' ? undefined : '选择「突破矩形」后可选'}
                onChange={(rectangleRetest) => updateDraft({ ...draft, rectangleRetest })}
              />
              <ExclusiveChoice
                label="波动率"
                value={draft.volatility}
                options={VOLATILITY_OPTIONS}
                disabled={!formEnabled}
                onChange={(volatility) => updateDraft({ ...draft, volatility })}
              />
              <ExclusiveChoice
                label="成交量放大"
                value={draft.volumeExpand}
                options={YES_NO_OPTIONS}
                disabled={!formEnabled}
                onChange={(volumeExpand) => updateDraft({ ...draft, volumeExpand })}
              />
              <TextField
                size="small"
                label="倍量"
                value={volumeText}
                disabled={!formEnabled || draft.volumeExpand !== 'yes'}
                helperText={draft.volumeExpand === 'yes' ? undefined : '选择「是」后可填'}
                onChange={(event) => {
                  const text = event.target.value
                  setVolumeText(text)
                  updateDraft({ ...draft, volumeMultiple: parseVolume(text) })
                }}
                slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              />
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary">
                  站上均线
                </Typography>
                <ToggleButtonGroup
                  size="small"
                  value={draft.aboveMa}
                  disabled={!formEnabled}
                  onChange={(_event, aboveMa: ChartReviewMa[] | null) =>
                    updateDraft({ ...draft, aboveMa: aboveMa ?? [] })
                  }
                  sx={{ flexWrap: 'wrap' }}
                >
                  {CHART_REVIEW_MA.map((period) => (
                    <ToggleButton key={period} value={period}>
                      {period}日
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Stack>
              <ExclusiveChoice
                label="是否符合2B法则"
                value={draft.rule2b}
                options={YES_NO_OPTIONS}
                disabled={!formEnabled}
                onChange={(rule2b) => updateDraft({ ...draft, rule2b })}
              />
              <ExclusiveChoice
                label="板块领头羊效应"
                value={draft.sectorLeader}
                options={LEADER_OPTIONS}
                disabled={!formEnabled}
                onChange={(sectorLeader) => updateDraft({ ...draft, sectorLeader })}
              />
              <Autocomplete
                options={leaderOptions}
                value={leaderValue}
                disabled={!formEnabled || draft.sectorLeader !== 'yes'}
                onChange={(_event, option) =>
                  updateDraft({
                    ...draft,
                    leaderTsCode: option?.tsCode ?? null,
                    leaderName: option?.name ?? null
                  })
                }
                getOptionLabel={(option) => `${option.name} ${option.tsCode}`}
                isOptionEqualToValue={(left, right) => left.tsCode === right.tsCode}
                filterOptions={(options, state) => {
                  const query = state.inputValue.trim().toLowerCase()
                  if (!query) {
                    return []
                  }
                  return options
                    .filter((option) => {
                      const stock = stocks.find((item) => item.ts_code === option.tsCode)
                      if (!stock) {
                        return (
                          option.tsCode.toLowerCase().includes(query) ||
                          option.name.toLowerCase().includes(query)
                        )
                      }
                      return matchesStockQuery(stock, query, initials.get(stock.ts_code) ?? '')
                    })
                    .slice(0, 30)
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    label="指定标的"
                    placeholder="输入名称或代码"
                    helperText={draft.sectorLeader === 'yes' ? undefined : '选择「有」后可填'}
                  />
                )}
              />
              <Typography variant="subtitle2">看空</Typography>
              <ExclusiveChoice
                label="跌破底分型"
                value={draft.breakBottomFractal}
                options={YES_NO_OPTIONS}
                disabled={!formEnabled}
                onChange={(breakBottomFractal) => updateDraft({ ...draft, breakBottomFractal })}
              />
              <ExclusiveChoice
                label="破位下跌"
                value={draft.breakdown}
                options={YES_NO_OPTIONS}
                disabled={!formEnabled}
                onChange={(breakdown) => updateDraft({ ...draft, breakdown })}
              />
              <ExclusiveChoice
                label="高位放天量"
                value={draft.climaxVolume}
                options={YES_NO_OPTIONS}
                disabled={!formEnabled}
                onChange={(climaxVolume) => updateDraft({ ...draft, climaxVolume })}
              />
              <ExclusiveChoice
                label="技术压力位"
                value={draft.resistance}
                options={YES_NO_OPTIONS}
                disabled={!formEnabled}
                onChange={(resistance) => updateDraft({ ...draft, resistance })}
              />
              <TextField
                size="small"
                label="备注说明"
                value={draft.resistanceNote ?? ''}
                disabled={!formEnabled || draft.resistance !== 'yes'}
                helperText={draft.resistance === 'yes' ? undefined : '选择「是」后可填'}
                onChange={(event) => updateDraft({ ...draft, resistanceNote: event.target.value })}
              />
              {saveError ? <FormHelperText error>{saveError}</FormHelperText> : null}
            </Stack>
          ) : null}
        </Stack>
      </Box>
      <Stack
        direction="row"
        spacing={1}
        justifyContent="flex-end"
        sx={{ px: 1.5, py: 1, borderTop: 1, borderColor: 'divider' }}
      >
        <Button
          size="small"
          disabled={!hasRecord || !formEnabled}
          onClick={() => setClearOpen(true)}
        >
          清空
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={!dirty || !formEnabled}
          onClick={() => void performSave()}
        >
          保存
        </Button>
      </Stack>
      <Dialog open={leaveOpen} onClose={() => finishLeave(false)}>
        <DialogTitle>复盘尚未保存</DialogTitle>
        <DialogContent>
          <Typography variant="body2">保存当前修改，或放弃这些修改。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => finishLeave(false)}>留下</Button>
          <Button onClick={discardDraft}>放弃</Button>
          <Button variant="contained" onClick={() => void performSaveRef.current().then(finishLeave)}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={clearOpen} onClose={() => setClearOpen(false)}>
        <DialogTitle>清空该日复盘</DialogTitle>
        <DialogContent>
          <Typography variant="body2">删除这一天已保存的复盘记录。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearOpen(false)}>取消</Button>
          <Button color="error" onClick={() => void clearRecord()}>
            清空
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
})

function ExclusiveChoice<T extends string>({
  label,
  value,
  options,
  disabled,
  error,
  hint,
  onChange
}: {
  label: string
  value: T | null
  options: ReadonlyArray<{ value: T; label: string }>
  disabled: boolean
  error?: string
  hint?: string
  onChange: (value: T | null) => void
}): React.JSX.Element {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color={error ? 'error' : 'text.secondary'}>
        {label}
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={value}
        disabled={disabled}
        onChange={(_event, next: T | null) => onChange(next)}
        sx={{ flexWrap: 'wrap' }}
      >
        {options.map((option) => (
          <ToggleButton key={option.value} value={option.value}>
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {error ? <FormHelperText error>{error}</FormHelperText> : hint ? <FormHelperText>{hint}</FormHelperText> : null}
    </Stack>
  )
}

function volumeTextOf(draft: ChartReviewDraft): string {
  return draft.volumeMultiple == null ? '' : String(draft.volumeMultiple)
}

function parseVolume(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) {
    return null
  }
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

function buildMonthCells(year: number, month: number): Array<{ iso: string; inMonth: boolean }> {
  const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const cells: Array<{ iso: string; inMonth: boolean }> = []
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ iso: formatUtc(new Date(Date.UTC(year, month, 1 - (firstWeekday - index)))), inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ iso: formatUtc(new Date(Date.UTC(year, month, day))), inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1]
    const cursor = last ? utcFromIso(last.iso) : new Date(Date.UTC(year, month, daysInMonth))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    cells.push({ iso: formatUtc(cursor), inMonth: false })
  }
  return cells
}

function formatUtc(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function utcFromIso(iso: string): Date {
  const year = Number(iso.slice(0, 4))
  const month = Number(iso.slice(5, 7))
  const day = Number(iso.slice(8, 10))
  return new Date(Date.UTC(year, month - 1, day))
}

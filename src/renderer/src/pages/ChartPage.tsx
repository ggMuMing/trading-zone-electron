import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_SCRIPT_TITLE } from '../../../shared/chart/indicatorScript'
import { validateChartInput } from '../../../shared/chart/validateChartInput'
import {
  CHART_UNIVERSE_ALL,
  CHART_UNIVERSE_DELISTED,
  CHART_UNIVERSE_INDEX_BROAD,
  CHART_UNIVERSE_INDEX_MARKET,
  industryUniverseId,
  isChartUniverseIndexCode,
  parseConstituentsIndexCode,
  parseIndustryIndexCode
} from '../../../shared/constants/chartUniverse'
import {
  DASHBOARD_BROAD_INDICES,
  DASHBOARD_MARKET_INDICES,
  type DashboardIndexMeta
} from '../../../shared/constants/dashboard'
import {
  MARKET_SYNC_EARLIEST,
  isoToYyyymmdd,
  todayYyyymmdd,
  yyyymmddToIso
} from '../../../shared/constants/market'
import type { ChartInput, ChartPeriod } from '../../../shared/types/chart'
import type {
  ChartLayout,
  ChartLayoutItem,
  LayoutItemParams,
  LayoutReorderDirection
} from '../../../shared/types/chartLayout'
import type {
  IndicatorScript,
  ScriptTryParams,
  ScriptTryResult
} from '../../../shared/types/indicatorScript'
import type {
  AdjustType,
  MarketCoverageResult,
  MarketQueryParams
} from '../../../shared/types/market'
import type { Stock } from '../../../shared/types/stock'
import type { StrategyInfo } from '../../../shared/types/pythonProtocol'
import { ChartToolbar } from './chart/ChartToolbar'
import { nearestTradingDate } from './chart/locateDate'
import { IndustryBreadcrumb } from './chart/IndustryBreadcrumb'
import { IndicatorDialog } from './chart/IndicatorDialog'
import { IndicatorSettingsDialog } from './chart/IndicatorSettingsDialog'
import { KlineChart, type ChartLocateRequest } from './chart/KlineChart'
import type { ReplayStartRequest } from './chart/ReplayPanel'
import { sliceChartInput } from './chart/sliceChartInput'
import { ScriptEditorPanel, type ScriptDraft } from './chart/scriptEditor/ScriptEditorPanel'
import { StrategyPanel } from './chart/StrategyPanel'
import type { StrategyChartOverlay } from './chart/strategyOverlay'
import { StockPicker } from './StockPicker'

const PICKER_WIDTH_STORAGE_KEY = 'trading-zone.chart.stockPickerWidth'
const STRATEGY_WIDTH_STORAGE_KEY = 'trading-zone.chart.strategyPanelWidth'
const UNIVERSE_STORAGE_KEY = 'trading-zone.chart.universeId'
const PICKER_WIDTH_MIN = 180
const PICKER_WIDTH_MAX = 320
const PICKER_WIDTH_DEFAULT = 220
const STRATEGY_WIDTH_MIN = 280
const STRATEGY_WIDTH_DEFAULT = 360

function clampPickerWidth(value: number): number {
  return Math.min(PICKER_WIDTH_MAX, Math.max(PICKER_WIDTH_MIN, Math.round(value)))
}

function clampStrategyWidth(value: number, maxWidth: number): number {
  const max = Math.max(STRATEGY_WIDTH_MIN, maxWidth)
  return Math.min(max, Math.max(STRATEGY_WIDTH_MIN, Math.round(value)))
}

function paramsEqual(left: LayoutItemParams, right: LayoutItemParams): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function loadUniverseId(): string {
  try {
    const raw = localStorage.getItem(UNIVERSE_STORAGE_KEY)
    return raw?.trim() || CHART_UNIVERSE_ALL
  } catch {
    return CHART_UNIVERSE_ALL
  }
}

function indexMetaToStock(meta: DashboardIndexMeta): Stock {
  return {
    ts_code: meta.ts_code,
    symbol: meta.ts_code.split('.')[0] ?? meta.ts_code,
    name: meta.name,
    area: null,
    industry: null,
    market: null,
    list_date: null,
    list_status: 'L',
    delist_date: null,
    synced_at: ''
  }
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

function letterAlias(index: number): string {
  return index >= 0 && index < 26 ? String.fromCharCode(65 + index) : `S${index + 1}`
}

function loadStrategyWidth(storageKey: string): number {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) {
      return STRATEGY_WIDTH_DEFAULT
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      return STRATEGY_WIDTH_DEFAULT
    }
    return Math.max(STRATEGY_WIDTH_MIN, Math.round(parsed))
  } catch {
    return STRATEGY_WIDTH_DEFAULT
  }
}

export interface ChartPanelQuote {
  time: string
  open: number
  close: number
}

export interface ChartSessionPresentation {
  maskSymbol: boolean
  hideTime: boolean
}

export interface ChartRightPanelContext {
  stock: Stock | null
  bar: ChartPanelQuote | null
  chartCode: string | null
  chartTimes: readonly string[] | null
  cutoff: string | null
  chartFault: string | null
  symbolAlias: ReadonlyMap<string, string>
  showSymbols: (stocks: Stock[], presentation: ChartSessionPresentation) => void
  setCutoff: (isoDate: string | null) => void
  setReplayRunning: (running: boolean) => void
}

export interface ChartPageProps {
  /** 常驻右栏。有值时占用策略面板那一列，并关闭策略选择。传入函数时带上图表当前标的和当前 K 线。 */
  rightPanel?: ReactNode | ((context: ChartRightPanelContext) => ReactNode)
  rightPanelWidthStorageKey?: string
  rightPanelResizeLabel?: string
  /** 右栏固定宽度。设置后不再显示拖动条，也不读写宽度缓存。 */
  rightPanelFixedWidth?: number
  /** 固定标的。传入后左侧只显示这些股票，不提供范围选择和搜索。 */
  fixedPickerStocks?: readonly Stock[]
  /** 左侧标的列表固定宽度。设置后不再显示拖动条。 */
  pickerFixedWidth?: number
  /** 为 false 时隐藏分组、跳转、回放和右侧面包屑。 */
  showToolbarExtras?: boolean
  /** 固定开始日的回放。设置后工具栏显示开始、终止、下一根，不显示回放配置。 */
  replayFixedStart?: string
  /** 模拟盘：工具栏只保留下一根，开始和结束由右栏控制。 */
  paperSession?: boolean
}

export function ChartPage({
  rightPanel = null,
  rightPanelWidthStorageKey = STRATEGY_WIDTH_STORAGE_KEY,
  rightPanelResizeLabel = '调整侧栏宽度',
  rightPanelFixedWidth,
  fixedPickerStocks,
  pickerFixedWidth,
  showToolbarExtras = true,
  replayFixedStart,
  paperSession = false
}: ChartPageProps = {}): React.JSX.Element {
  const [loading, setLoading] = useState(true)
  const [querying, setQuerying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [allStocks, setAllStocks] = useState<Stock[]>([])
  const [pickerStocks, setPickerStocks] = useState<Stock[]>(() =>
    fixedPickerStocks ? [...fixedPickerStocks] : []
  )
  const [universeId, setUniverseId] = useState(loadUniverseId)
  const [universeCaption, setUniverseCaption] = useState<string | null>(null)
  const [universeLoading, setUniverseLoading] = useState(false)
  const [coverage, setCoverage] = useState<MarketCoverageResult | null>(null)
  const [selectedCode, setSelectedCode] = useState<string | null>(
    () => fixedPickerStocks?.[0]?.ts_code ?? null
  )
  const [adjust, setAdjust] = useState<AdjustType>('qfq')
  const [period, setPeriod] = useState<ChartPeriod>('day')
  const [chartRaw, setChartRaw] = useState<ChartInput | null>(null)
  const [layout, setLayout] = useState<ChartLayout | null>(null)
  const [scripts, setScripts] = useState<IndicatorScript[]>([])
  const [exampleSource, setExampleSource] = useState('')
  const [indicatorOpen, setIndicatorOpen] = useState(false)
  const [settingsItem, setSettingsItem] = useState<ChartLayoutItem | null>(null)
  const [scriptDraft, setScriptDraft] = useState<ScriptDraft | null>(null)
  const [pickerWidth, setPickerWidth] = useState(loadPickerWidth)
  const [resizing, setResizing] = useState(false)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const pickerWidthRef = useRef(pickerWidth)
  pickerWidthRef.current = pickerWidth
  const [replayCutoff, setReplayCutoff] = useState<string | null>(null)
  const [replayRunning, setReplayRunning] = useState(false)
  const [chartCode, setChartCode] = useState<string | null>(null)
  const [chartFault, setChartFault] = useState<string | null>(null)
  const [hideChartTime, setHideChartTime] = useState(false)
  const [symbolAlias, setSymbolAlias] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyInfo | null>(null)
  const [strategyOverlay, setStrategyOverlay] = useState<StrategyChartOverlay | null>(null)
  const hasRightPanel = rightPanel != null
  const [strategyWidth, setStrategyWidth] = useState(() => loadStrategyWidth(rightPanelWidthStorageKey))
  const [strategyResizing, setStrategyResizing] = useState(false)
  const [locateRequest, setLocateRequest] = useState<ChartLocateRequest | null>(null)
  const strategyResizeRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const strategyWidthRef = useRef(strategyWidth)
  strategyWidthRef.current = strategyWidth
  const chartRowRef = useRef<HTMLDivElement>(null)

  const resolvePickerStocks = useCallback(
    async (nextUniverseId: string, listed: Stock[]): Promise<Stock[]> => {
      if (nextUniverseId === CHART_UNIVERSE_ALL) {
        setUniverseCaption(null)
        return listed
      }
      if (nextUniverseId === CHART_UNIVERSE_DELISTED) {
        const delisted = await window.api.stocks.listDelisted()
        setUniverseCaption(`退市 ${delisted.length} 只`)
        return delisted
      }
      if (nextUniverseId === CHART_UNIVERSE_INDEX_MARKET) {
        setUniverseCaption(null)
        return DASHBOARD_MARKET_INDICES.map(indexMetaToStock)
      }
      if (nextUniverseId === CHART_UNIVERSE_INDEX_BROAD) {
        setUniverseCaption(null)
        return DASHBOARD_BROAD_INDICES.map(indexMetaToStock)
      }
      const industryCode = parseIndustryIndexCode(nextUniverseId)
      if (industryCode) {
        const result = await window.api.industry.members({ index_code: industryCode })
        setUniverseCaption(null)
        const codeSet = new Set(result.con_codes)
        return listed.filter((stock) => codeSet.has(stock.ts_code))
      }
      const indexCode = parseConstituentsIndexCode(nextUniverseId)
      if (!indexCode) {
        setUniverseCaption(null)
        return listed
      }
      const result = await window.api.market.indexConstituents({ index_code: indexCode })
      setUniverseCaption(result.as_of ? yyyymmddToIso(result.as_of) : null)
      const codeSet = new Set(result.con_codes)
      return listed.filter((stock) => codeSet.has(stock.ts_code))
    },
    []
  )

  const applyUniverse = useCallback(
    async (nextUniverseId: string, listed: Stock[], selectFirst: boolean): Promise<void> => {
      setUniverseLoading(true)
      try {
        const nextPickerStocks = await resolvePickerStocks(nextUniverseId, listed)
        setPickerStocks(nextPickerStocks)
        if (selectFirst) {
          setSelectedCode(nextPickerStocks[0]?.ts_code ?? null)
        } else {
          setSelectedCode((prev) => {
            if (prev && nextPickerStocks.some((stock) => stock.ts_code === prev)) {
              return prev
            }
            return nextPickerStocks[0]?.ts_code ?? null
          })
        }
      } finally {
        setUniverseLoading(false)
      }
    },
    [resolvePickerStocks]
  )

  const loadStocksAndCoverage = async (): Promise<void> => {
    const [listed, cov, currentLayout, example, listedScripts] = await Promise.all([
      window.api.stocks.list(),
      window.api.market.coverage(),
      window.api.chartLayout.get(),
      window.api.indicatorScript.exampleSource(),
      window.api.indicatorScript.list()
    ])
    setAllStocks(listed)
    setCoverage(cov)
    setLayout(currentLayout)
    setExampleSource(example)
    setScripts(listedScripts)
    if (!fixedPickerStocks) {
      await applyUniverse(universeId, listed, false)
    }
  }

  const handleUniverseChange = (nextUniverseId: string): void => {
    setUniverseId(nextUniverseId)
    try {
      localStorage.setItem(UNIVERSE_STORAGE_KEY, nextUniverseId)
    } catch {
      // ignore storage failures
    }
    void applyUniverse(nextUniverseId, allStocks, true)
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
  const queryEndRef = useRef(queryEnd)
  queryEndRef.current = queryEnd

  const selectedIsIndex = selectedCode ? isChartUniverseIndexCode(selectedCode) : false
  const effectiveAdjust: AdjustType = selectedIsIndex ? 'none' : adjust

  const chartRequestRef = useRef(0)

  const executeScripts = useCallback(
    async (tsCode: string, adj: AdjustType, endIso?: string | null): Promise<void> => {
      const requestId = chartRequestRef.current + 1
      chartRequestRef.current = requestId
      setQuerying(true)
      setError(null)
      setChartFault(null)
      try {
        const queryAdjust = isChartUniverseIndexCode(tsCode) ? 'none' : adj
        const result = await window.api.chart.build({
          ts_code: tsCode,
          adjust: queryAdjust,
          start_date: MARKET_SYNC_EARLIEST,
          end_date: endIso ? isoToYyyymmdd(endIso) : queryEndRef.current
        })
        if (requestId !== chartRequestRef.current) {
          return
        }
        setChartRaw(result)
        setChartCode(tsCode)
      } catch (err: unknown) {
        if (requestId !== chartRequestRef.current) {
          return
        }
        setChartRaw(null)
        setChartCode(null)
        setChartFault(tsCode)
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (requestId === chartRequestRef.current) {
          setQuerying(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    void refreshAll()
  }, [])

  useEffect(() => {
    setLocateRequest(null)
    setChartRaw(null)
  }, [selectedCode])

  useEffect(() => {
    if (!selectedCode) {
      setChartRaw(null)
      return
    }
    void period
    void executeScripts(selectedCode, effectiveAdjust, null)
  }, [selectedCode, effectiveAdjust, period, executeScripts])

  useEffect(() => {
    if (!resizing && !strategyResizing) {
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
  }, [resizing, strategyResizing])

  const persistPickerWidth = (value: number): void => {
    localStorage.setItem(PICKER_WIDTH_STORAGE_KEY, String(value))
  }

  const strategyMaxWidth = (): number => {
    const rowWidth = chartRowRef.current?.clientWidth ?? window.innerWidth
    const workspace = Math.max(0, rowWidth - pickerWidthRef.current - 16)
    return Math.floor(workspace / 2)
  }

  const persistStrategyWidth = (value: number): void => {
    localStorage.setItem(rightPanelWidthStorageKey, String(value))
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

  const handleStrategySplitterPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    strategyResizeRef.current = { startX: event.clientX, startWidth: strategyWidth }
    setStrategyResizing(true)
  }

  const handleStrategySplitterPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = strategyResizeRef.current
    if (!drag) {
      return
    }
    setStrategyWidth(
      clampStrategyWidth(drag.startWidth + (drag.startX - event.clientX), strategyMaxWidth())
    )
  }

  const handleStrategySplitterPointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!strategyResizeRef.current) {
      return
    }
    strategyResizeRef.current = null
    setStrategyResizing(false)
    persistStrategyWidth(strategyWidthRef.current)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  useEffect(() => {
    if (!selectedStrategy) {
      setStrategyOverlay(null)
    }
  }, [selectedStrategy])

  const closeStrategyPanel = useCallback((): void => {
    setStrategyOverlay(null)
    setSelectedStrategy(null)
  }, [])

  useEffect(() => {
    if (rightPanelFixedWidth != null || (!selectedStrategy && !hasRightPanel)) {
      return
    }
    const clampToWorkspace = (): void => {
      setStrategyWidth((current) => clampStrategyWidth(current, strategyMaxWidth()))
    }
    clampToWorkspace()
    window.addEventListener('resize', clampToWorkspace)
    return () => window.removeEventListener('resize', clampToWorkspace)
  }, [selectedStrategy, hasRightPanel, rightPanelFixedWidth])

  const applyLayoutAndExecute = (next: ChartLayout): void => {
    setLayout(next)
    if (selectedCode) {
      void executeScripts(selectedCode, effectiveAdjust, null)
    }
  }

  const handleAddIndicator = async (ref: string): Promise<void> => {
    try {
      const next = await window.api.chartLayout.add({ kind: 'script', ref })
      applyLayoutAndExecute(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleRemoveIndicator = async (id: string): Promise<void> => {
    try {
      const next = await window.api.chartLayout.remove({ id })
      applyLayoutAndExecute(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleUpdateIndicator = async (id: string, params: LayoutItemParams): Promise<void> => {
    const current = layout?.items.find((item) => item.id === id)
    if (current && paramsEqual(current.params, params)) {
      return
    }
    try {
      const next = await window.api.chartLayout.update({ id, params })
      applyLayoutAndExecute(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleMovePane = async (id: string, direction: LayoutReorderDirection): Promise<void> => {
    try {
      setLayout(await window.api.chartLayout.reorder({ id, direction }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const applyScripts = (next: IndicatorScript[]): void => {
    setScripts(next)
  }

  const handleCreateScript = async (
    title: string,
    source: string
  ): Promise<IndicatorScript | null> => {
    try {
      const knownIds = new Set(scripts.map((script) => script.id))
      const next = await window.api.indicatorScript.create({ title, source })
      applyScripts(next)
      return next.find((script) => !knownIds.has(script.id)) ?? null
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    }
  }

  const handleUpdateScript = async (
    id: string,
    patch: { title: string; source: string }
  ): Promise<void> => {
    try {
      applyScripts(
        await window.api.indicatorScript.update({ id, title: patch.title, source: patch.source })
      )
      applyLayoutAndExecute(await window.api.chartLayout.get())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleRenameScript = async (id: string, title: string): Promise<void> => {
    try {
      applyScripts(await window.api.indicatorScript.update({ id, title }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const openNewScriptEditor = (): void => {
    setIndicatorOpen(false)
    setScriptDraft({ id: null, title: DEFAULT_SCRIPT_TITLE, source: exampleSource })
  }

  const openEditScriptEditor = (script: IndicatorScript): void => {
    setIndicatorOpen(false)
    setScriptDraft({ id: script.id, title: script.title, source: script.source })
  }

  const openLayoutSettings = (instanceId: string): void => {
    const item = layout?.items.find((entry) => entry.id === instanceId)
    if (item) {
      setSettingsItem(item)
    }
  }

  const openLayoutEditor = (instanceId: string): void => {
    const item = layout?.items.find((entry) => entry.id === instanceId)
    if (!item) {
      return
    }
    const script = scripts.find((entry) => entry.id === item.ref)
    if (script) {
      openEditScriptEditor(script)
    }
  }

  const handleRemoveScript = async (id: string): Promise<void> => {
    try {
      applyScripts(await window.api.indicatorScript.remove({ id }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleTryScript = async (params: ScriptTryParams): Promise<ScriptTryResult> => {
    return window.api.indicatorScript.try(params)
  }

  const tryQuery: MarketQueryParams | null = selectedCode
    ? {
        ts_code: selectedCode,
        adjust: effectiveAdjust,
        start_date: MARKET_SYNC_EARLIEST,
        end_date: replayCutoff ? isoToYyyymmdd(replayCutoff) : queryEnd
      }
    : null

  useEffect(() => {
    if (!indicatorOpen) {
      return
    }
    void window.api.indicatorScript
      .list()
      .then(applyScripts)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
      })
  }, [indicatorOpen])

  const isAllEmpty = allStocks.length === 0
  const constituentsEmpty =
    parseConstituentsIndexCode(universeId) !== null && pickerStocks.length === 0 && !universeLoading
  const industryEmpty =
    parseIndustryIndexCode(universeId) !== null && pickerStocks.length === 0 && !universeLoading
  const selected = pickerStocks.find((stock) => stock.ts_code === selectedCode)
  const delistedEmpty =
    universeId === CHART_UNIVERSE_DELISTED && pickerStocks.length === 0 && !universeLoading
  const constituentsEmptyHint = constituentsEmpty
    ? '尚无成分股数据，请到配置页更新成分股'
    : industryEmpty
      ? '尚无行业数据，请到配置页更新行业分类'
      : delistedEmpty
        ? '尚无退市股票，请到配置页更新数据'
        : null
  const fullChartInput = useMemo(() => {
    if (!chartRaw) {
      return null
    }
    const result = validateChartInput(chartRaw)
    if (!result.ok) {
      return { error: result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ') }
    }
    return { value: result.value }
  }, [chartRaw])
  const chartInput = useMemo(() => {
    if (!fullChartInput || !('value' in fullChartInput) || !fullChartInput.value || !replayCutoff) {
      return fullChartInput
    }
    const first = fullChartInput.value.timeDomain[0]
    if (first && first > replayCutoff) {
      return { beforeCutoff: true as const }
    }
    return { value: sliceChartInput(fullChartInput.value, replayCutoff) }
  }, [fullChartInput, replayCutoff])
  const chartTimes =
    fullChartInput && 'value' in fullChartInput && fullChartInput.value
      ? fullChartInput.value.timeDomain
      : null
  const displayedBar = ((): ChartPanelQuote | null => {
    if (!chartInput || !('value' in chartInput) || !chartInput.value) {
      return null
    }
    const { candle, timeDomain } = chartInput.value
    const lastTime = timeDomain[timeDomain.length - 1]
    const point =
      (lastTime ? candle.find((item) => item.time === lastTime) : undefined) ?? candle[candle.length - 1]
    if (!point || !Number.isFinite(point.open) || !Number.isFinite(point.close)) {
      return null
    }
    return { time: point.time, open: point.open, close: point.close }
  })()

  const handleJumpToDate = (isoDate: string): void => {
    if (!chartTimes) {
      return
    }
    const timeIso = nearestTradingDate(chartTimes, isoDate)
    if (!timeIso) {
      return
    }
    setLocateRequest((current) => ({ timeIso, token: (current?.token ?? 0) + 1 }))
  }

  const replayActive = replayRunning
  const replayCanStep = Boolean(
    replayRunning && replayCutoff && chartTimes?.some((time) => time > replayCutoff)
  )
  const replayCanStart =
    !querying &&
    Boolean(
      chartTimes &&
        chartTimes.length > 0 &&
        (replayFixedStart == null || chartTimes.some((time) => time >= replayFixedStart))
    )

  const handleReplayStart = (request: ReplayStartRequest): void => {
    if (!chartTimes || chartTimes.length === 0 || replayActive) {
      return
    }
    const isoDate =
      request.mode === 'random'
        ? chartTimes[Math.floor(Math.random() * chartTimes.length)]
        : nearestTradingDate(chartTimes, request.isoDate)
    if (!isoDate) {
      return
    }
    setReplayCutoff(isoDate)
    setReplayRunning(true)
  }

  const handleReplayBegin = (): void => {
    if (!chartTimes || chartTimes.length === 0 || replayActive || !replayFixedStart) {
      return
    }
    const isoDate = chartTimes.find((time) => time >= replayFixedStart)
    if (!isoDate) {
      return
    }
    setReplayCutoff(isoDate)
    setReplayRunning(true)
  }

  const handleReplayStop = (): void => {
    setReplayCutoff(null)
    setReplayRunning(false)
  }

  const handleReplayNext = (): void => {
    if (!replayCutoff || !chartTimes) {
      return
    }
    const nextTime = chartTimes.find((time) => time > replayCutoff)
    if (!nextTime) {
      return
    }
    setReplayCutoff(nextTime)
  }

  const showSessionSymbols = (nextStocks: Stock[], presentation: ChartSessionPresentation): void => {
    setPickerStocks([...nextStocks])
    setSelectedCode(nextStocks[0]?.ts_code ?? null)
    setHideChartTime(presentation.hideTime)
    if (!presentation.maskSymbol) {
      setSymbolAlias(new Map())
      return
    }
    const aliases = new Map<string, string>()
    nextStocks.forEach((stock, index) => {
      aliases.set(stock.ts_code, letterAlias(index))
    })
    setSymbolAlias(aliases)
  }

  const panelContext: ChartRightPanelContext = {
    stock: selected ?? null,
    bar: displayedBar,
    chartCode,
    chartTimes,
    cutoff: replayCutoff,
    chartFault,
    symbolAlias,
    showSymbols: showSessionSymbols,
    setCutoff: setReplayCutoff,
    setReplayRunning
  }
  const selectedAlias = selected ? symbolAlias.get(selected.ts_code) : undefined
  const pickerView = pickerStocks.map((stock) => {
    const alias = symbolAlias.get(stock.ts_code)
    return alias ? { ...stock, name: alias } : stock
  })

  return (
    <Box
      sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {error ? (
        <Box sx={{ px: 2, pt: 1 }}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Box>
      ) : null}

      {!fixedPickerStocks && isAllEmpty && universeId === CHART_UNIVERSE_ALL && !loading ? (
        <Box
          sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}
        >
          <Paper
            elevation={0}
            sx={{ p: 4, maxWidth: 480, border: 1, borderColor: 'divider', textAlign: 'center' }}
          >
            <Typography variant="h6" gutterBottom>
              尚未同步股票列表
            </Typography>
            <Typography variant="body2" color="text.secondary">
              请先到配置页更新数据。成功后本页可浏览全部股票并查看日线 K 线。
            </Typography>
          </Paper>
        </Box>
      ) : (
        <Box
          ref={chartRowRef}
          sx={{
            flex: 1,
            display: 'flex',
            minHeight: 0,
            px: 2,
            py: 2,
            gap: 0.5,
            position: 'relative',
            padding: 0
          }}
        >
          <StockPicker
            stocks={pickerView}
            selectedCode={selectedCode}
            width={pickerFixedWidth ?? pickerWidth}
            universeId={universeId}
            universeCaption={universeCaption}
            emptyHint={constituentsEmptyHint}
            hideCode={symbolAlias.size > 0}
            onSelect={setSelectedCode}
            onUniverseChange={fixedPickerStocks ? undefined : handleUniverseChange}
            showSearch={!fixedPickerStocks}
          />
          {pickerFixedWidth != null ? (
            <Box
              sx={{
                width: 8,
                flexShrink: 0,
                alignSelf: 'stretch',
                position: 'relative',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: 8,
                  bottom: 8,
                  left: '50%',
                  width: 2,
                  transform: 'translateX(-50%)',
                  borderRadius: 1,
                  bgcolor: 'divider'
                }
              }}
            />
          ) : (
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
          )}

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
            <ChartToolbar
              symbolLabel={
                selectedAlias ??
                (selected ? `${selected.name || selected.ts_code}（${selected.ts_code}）` : '请选择股票')
              }
              period={period}
              onPeriodChange={setPeriod}
              periodDisabled={replayCutoff !== null}
              adjust={effectiveAdjust}
              onAdjustChange={setAdjust}
              adjustDisabled={!selectedCode || querying || selectedIsIndex}
              onOpenIndicators={() => setIndicatorOpen(true)}
              indicatorsDisabled={loading}
              onJumpToDate={handleJumpToDate}
              jumpDisabled={replayCutoff !== null || !chartTimes || chartTimes.length === 0}
              jumpMin={chartTimes?.[0]}
              jumpMax={chartTimes ? chartTimes[chartTimes.length - 1] : undefined}
              replayCanStart={replayCanStart}
              replayActive={replayActive}
              replayCanStep={replayCanStep}
              showGroup={showToolbarExtras}
              showJump={showToolbarExtras}
              replayDirect={replayFixedStart != null || paperSession}
              replayShowStart={!paperSession}
              onReplayBegin={replayFixedStart != null ? handleReplayBegin : undefined}
              onReplayStart={showToolbarExtras ? handleReplayStart : undefined}
              onReplayStop={
                paperSession
                  ? undefined
                  : showToolbarExtras || replayFixedStart != null
                    ? handleReplayStop
                    : undefined
              }
              onReplayNext={
                showToolbarExtras || replayFixedStart != null || paperSession
                  ? handleReplayNext
                  : undefined
              }
              trailing={
                showToolbarExtras ? (
                  <IndustryBreadcrumb
                    tsCode={selectedIsIndex ? null : selectedCode}
                    onNavigate={(indexCode) => handleUniverseChange(industryUniverseId(indexCode))}
                  />
                ) : null
              }
            />

            <Box sx={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
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
              ) : chartInput && 'beforeCutoff' in chartInput ? (
                <Box
                  sx={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    截止日之前没有K线
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
                  {chartInput && 'value' in chartInput ? (
                    <KlineChart
                      input={chartInput.value}
                      layout={layout}
                      scripts={scripts}
                      overlay={strategyOverlay}
                      focusTimeIso={strategyOverlay?.highlight?.timeIso ?? null}
                      locateRequest={locateRequest}
                      hideTimeAxis={hideChartTime}
                      hidePriceLegend={hideChartTime}
                      onOpenSettings={openLayoutSettings}
                      onOpenEditor={openLayoutEditor}
                      onRemove={(id) => void handleRemoveIndicator(id)}
                      onMovePane={(id, direction) => void handleMovePane(id, direction)}
                    />
                  ) : null}
                </Box>
              )}
            </Box>
          </Paper>
          {hasRightPanel || selectedStrategy ? (
            <>
              {rightPanelFixedWidth != null ? (
                <Box
                  sx={{
                    width: 8,
                    flexShrink: 0,
                    alignSelf: 'stretch',
                    position: 'relative',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: 8,
                      bottom: 8,
                      left: '50%',
                      width: 2,
                      transform: 'translateX(-50%)',
                      borderRadius: 1,
                      bgcolor: 'divider'
                    }
                  }}
                />
              ) : (
                <Box
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={hasRightPanel ? rightPanelResizeLabel : '调整策略面板宽度'}
                  aria-valuemin={STRATEGY_WIDTH_MIN}
                  aria-valuemax={strategyMaxWidth()}
                  aria-valuenow={strategyWidth}
                  onPointerDown={handleStrategySplitterPointerDown}
                  onPointerMove={handleStrategySplitterPointerMove}
                  onPointerUp={handleStrategySplitterPointerUp}
                  onPointerCancel={handleStrategySplitterPointerUp}
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
                      bgcolor: strategyResizing ? 'primary.main' : 'divider'
                    },
                    '&:hover::after': {
                      bgcolor: 'primary.main'
                    }
                  }}
                />
              )}
              <Paper
                elevation={0}
                sx={{
                  width:
                    rightPanelFixedWidth ??
                    clampStrategyWidth(strategyWidth, strategyMaxWidth()),
                  flexShrink: 0,
                  border: 1,
                  borderColor: 'divider',
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: 0,
                  overflow: 'hidden'
                }}
              >
                {hasRightPanel ? (
                  typeof rightPanel === 'function' ? rightPanel(panelContext) : rightPanel
                ) : selectedStrategy ? (
                  <StrategyPanel
                    key={selectedStrategy.id}
                    strategyId={selectedStrategy.id}
                    strategyName={selectedStrategy.name}
                    parameters={selectedStrategy.parameters}
                    tsCode={selectedCode}
                    adjust={effectiveAdjust}
                    defaultStart={MARKET_SYNC_EARLIEST}
                    defaultEnd={queryEnd}
                    disabled={querying}
                    onClose={closeStrategyPanel}
                    onOverlayChange={setStrategyOverlay}
                  />
                ) : null}
              </Paper>
            </>
          ) : null}
          {scriptDraft ? (
            <ScriptEditorPanel
              draft={scriptDraft}
              scripts={scripts}
              disabled={querying}
              tryQuery={tryQuery}
              onDraftChange={setScriptDraft}
              onClose={() => setScriptDraft(null)}
              onCreateNew={openNewScriptEditor}
              onTry={handleTryScript}
              onCreate={handleCreateScript}
              onUpdate={handleUpdateScript}
              onRename={handleRenameScript}
            />
          ) : null}
        </Box>
      )}
      <IndicatorDialog
        open={indicatorOpen}
        exampleSource={exampleSource}
        layout={layout}
        scripts={scripts}
        selectedStrategyId={selectedStrategy?.id ?? null}
        disabled={querying}
        strategyDisabled={replayActive || hasRightPanel}
        onClose={() => setIndicatorOpen(false)}
        onAdd={(ref) => void handleAddIndicator(ref)}
        onCreateEditor={openNewScriptEditor}
        onEditEditor={openEditScriptEditor}
        onRemoveScript={(id) => void handleRemoveScript(id)}
        onSelectStrategy={(strategy) => setSelectedStrategy(strategy)}
      />
      <IndicatorSettingsDialog
        item={settingsItem}
        scripts={scripts}
        disabled={querying}
        onClose={() => setSettingsItem(null)}
        onSave={(id, params) => {
          setSettingsItem(null)
          void handleUpdateIndicator(id, params)
        }}
      />
    </Box>
  )
}

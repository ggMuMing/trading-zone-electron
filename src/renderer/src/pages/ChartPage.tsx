import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_SCRIPT_TITLE } from '../../../shared/chart/indicatorScript'
import { validateChartInput } from '../../../shared/chart/validateChartInput'
import { MARKET_SYNC_START, todayYyyymmdd } from '../../../shared/constants/market'
import type { ChartInput, ChartPeriod } from '../../../shared/types/chart'
import type {
  ChartLayout,
  ChartLayoutItem,
  LayoutItemParams,
  LayoutReorderDirection
} from '../../../shared/types/chartLayout'
import type { IndicatorScript, ScriptTryParams, ScriptTryResult } from '../../../shared/types/indicatorScript'
import type { AdjustType, MarketCoverageResult, MarketQueryParams } from '../../../shared/types/market'
import type { Stock } from '../../../shared/types/stock'
import { ChartToolbar } from './chart/ChartToolbar'
import { IndicatorDialog } from './chart/IndicatorDialog'
import { IndicatorSettingsDialog } from './chart/IndicatorSettingsDialog'
import { KlineChart } from './chart/KlineChart'
import { ScriptEditorPanel, type ScriptDraft } from './chart/scriptEditor/ScriptEditorPanel'
import { StockPicker } from './StockPicker'

const PICKER_WIDTH_STORAGE_KEY = 'trading-zone.chart.stockPickerWidth'
const PICKER_WIDTH_MIN = 180
const PICKER_WIDTH_MAX = 320
const PICKER_WIDTH_DEFAULT = 220

function clampPickerWidth(value: number): number {
  return Math.min(PICKER_WIDTH_MAX, Math.max(PICKER_WIDTH_MIN, Math.round(value)))
}

function paramsEqual(left: LayoutItemParams, right: LayoutItemParams): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
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
  const [scriptRunNonce, setScriptRunNonce] = useState(0)
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const pickerWidthRef = useRef(pickerWidth)
  pickerWidthRef.current = pickerWidth

  const loadStocksAndCoverage = async (): Promise<void> => {
    const [listed, cov, currentLayout, example, listedScripts] = await Promise.all([
      window.api.stocks.list(),
      window.api.market.coverage(),
      window.api.chartLayout.get(),
      window.api.indicatorScript.exampleSource(),
      window.api.indicatorScript.list()
    ])
    setStocks(listed)
    setCoverage(cov)
    setLayout(currentLayout)
    setExampleSource(example)
    setScripts(listedScripts)
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
  const queryEndRef = useRef(queryEnd)
  queryEndRef.current = queryEnd

  const executeScripts = useCallback(async (tsCode: string, adj: AdjustType): Promise<void> => {
    setQuerying(true)
    setError(null)
    try {
      const result = await window.api.chart.build({
        ts_code: tsCode,
        adjust: adj,
        start_date: MARKET_SYNC_START,
        end_date: queryEndRef.current
      })
      setChartRaw(result)
    } catch (err: unknown) {
      setChartRaw(null)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setQuerying(false)
    }
  }, [])

  const handleRefresh = async (): Promise<void> => {
    await refreshAll()
    setScriptRunNonce((nonce) => nonce + 1)
  }

  useEffect(() => {
    void refreshAll()
  }, [])

  useEffect(() => {
    if (!selectedCode) {
      setChartRaw(null)
      return
    }
    void period
    void executeScripts(selectedCode, adjust)
  }, [selectedCode, adjust, period, scriptRunNonce, executeScripts])

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

  const applyLayoutAndExecute = (next: ChartLayout): void => {
    setLayout(next)
    if (selectedCode) {
      void executeScripts(selectedCode, adjust)
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

  const handleCreateScript = async (title: string, source: string): Promise<IndicatorScript | null> => {
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

  const handleUpdateScript = async (id: string, patch: { title: string; source: string }): Promise<void> => {
    try {
      applyScripts(await window.api.indicatorScript.update({ id, title: patch.title, source: patch.source }))
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
        adjust,
        start_date: MARKET_SYNC_START,
        end_date: queryEnd
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
    return { value: result.value }
  }, [chartRaw])

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
        <IconButton aria-label="刷新" onClick={() => void handleRefresh()} disabled={loading || querying}>
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
        <Box sx={{ flex: 1, display: 'flex', minHeight: 0, px: 2, py: 2, gap: 0.5, position: 'relative' }}>
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
            <ChartToolbar
              symbolLabel={
                selected ? `${selected.name ?? selected.ts_code}（${selected.ts_code}）` : '请选择股票'
              }
              period={period}
              onPeriodChange={setPeriod}
              adjust={adjust}
              onAdjustChange={setAdjust}
              adjustDisabled={!selectedCode || querying}
              onOpenIndicators={() => setIndicatorOpen(true)}
              indicatorsDisabled={loading}
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
        disabled={querying}
        onClose={() => setIndicatorOpen(false)}
        onAdd={(ref) => void handleAddIndicator(ref)}
        onRemove={(id) => void handleRemoveIndicator(id)}
        onOpenSettings={(item) => openLayoutSettings(item.id)}
        onCreateEditor={openNewScriptEditor}
        onEditEditor={openEditScriptEditor}
        onRemoveScript={(id) => void handleRemoveScript(id)}
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

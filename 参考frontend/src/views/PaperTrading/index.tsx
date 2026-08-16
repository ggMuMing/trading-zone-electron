import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SkipNextIcon from '@mui/icons-material/SkipNext'
import StopIcon from '@mui/icons-material/Stop'
import SaveIcon from '@mui/icons-material/Save'
import HistoryIcon from '@mui/icons-material/History'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import {
  Box,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getChartLayout, getStockAll, getStockDailyData } from '../../api/api'
import PaperTradingChart from '../../components/PaperTradingChart/PaperTradingChart'
import IndicatorSelectDialog from '../../components/ChartComponent/IndicatorSelectDialog'
import SymbolSearchDialog from '../../components/ChartComponent/SymbolSearchDialog'
import { syncChartLayout } from '../../components/ChartComponent/ChartComponentProxy'
import { SeperatorBox, StyledButton } from '../../components/styled'
import { downColor, upColor } from '../../static'
import type {
  PaperTradingConfig,
  PaperTradingPhase,
  PaperTradingRuntime,
  PaperTradingSessionRecord,
  PaperTradeRecord,
} from './types'
import {
  advanceNextBar,
  buildSessionRecord,
  buildTradeMarkers,
  computeStats,
  computeRoundTripWinStats,
  createRuntime,
  deleteSessionRecord,
  executeBuy,
  executeSell,
  formatTradeDateDisplay,
  getCurrentBar,
  getVisibleChartData,
  getConfigSimBarCount,
  isSimulationComplete,
  loadSavedSessions,
  MIN_SIM_BAR_COUNT,
  maxBuyableLots,
  maxSellableLots,
  pickRandomItem,
  resolveSimStartIndex,
  runtimeFromSession,
  saveSessionRecord,
} from './utils'

const DEFAULT_CONFIG: PaperTradingConfig = {
  initialCapital: 50000,
  stockPickMode: 'random',
  fixedSymbol: '',
  fixedStockName: '',
  startDateMode: 'random',
  fixedStartDate: '',
  simBarCount: MIN_SIM_BAR_COUNT,
  commissionRate: 0.0005,
  stampTaxRate: 0.0005,
  adjust: 'qfq',
}

function formatMoney(value: number) {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

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

function SetupSectionTitle({ children }: { children: string }) {
  return (
    <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 700, display: 'block' }}>
      {children}
    </Typography>
  )
}

export default function PaperTradingView() {
  const [phase, setPhase] = useState<PaperTradingPhase>('setup')
  const [config, setConfig] = useState<PaperTradingConfig>(DEFAULT_CONFIG)
  const [runtime, setRuntime] = useState<PaperTradingRuntime | null>(null)
  const [configDraft, setConfigDraft] = useState<PaperTradingConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tradeLots, setTradeLots] = useState(1)
  const [savedSessions, setSavedSessions] = useState<PaperTradingSessionRecord[]>([])
  const [reviewSession, setReviewSession] = useState<PaperTradingSessionRecord | null>(null)
  const [reviewRuntime, setReviewRuntime] = useState<PaperTradingRuntime | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [symbolSearchOpen, setSymbolSearchOpen] = useState(false)
  const [indicatorOpen, setIndicatorOpen] = useState(false)
  const [autoOpenConfigInstanceId, setAutoOpenConfigInstanceId] = useState<string | null>(null)

  const refreshSavedSessions = useCallback(() => {
    setSavedSessions(loadSavedSessions())
  }, [])

  useEffect(() => {
    queueMicrotask(refreshSavedSessions)
  }, [refreshSavedSessions])

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        const nextLayout = await getChartLayout()
        if (!cancelled) syncChartLayout(nextLayout)
      })()
    return () => { cancelled = true }
  }, [])

  const activeRuntime = useMemo(() => {
    if (phase === 'review' && reviewRuntime) return reviewRuntime
    return runtime
  }, [phase, reviewRuntime, runtime])

  const activeConfig = useMemo(() => {
    if (phase === 'review' && reviewSession) return reviewSession.config
    return config
  }, [phase, reviewSession, config])

  const chartData = useMemo(() => {
    if (!activeRuntime) return []
    return getVisibleChartData(activeRuntime)
  }, [activeRuntime])

  const stats = useMemo(() => {
    if (!activeRuntime) return null
    return computeStats(activeRuntime, activeConfig)
  }, [activeRuntime, activeConfig])

  const currentBar = useMemo(() => {
    if (!activeRuntime) return null
    return getCurrentBar(activeRuntime)
  }, [activeRuntime])

  const canTrade = phase === 'running' && currentBar !== null
  const simBarCount = getConfigSimBarCount(activeConfig)
  const simBarCountInvalid = configDraft.simBarCount < MIN_SIM_BAR_COUNT
  const canNextBar = phase === 'running' && activeRuntime
    && !isSimulationComplete(activeRuntime)
  const isLastBar = phase === 'running' && activeRuntime
    && isSimulationComplete(activeRuntime)

  const tradeMarkers = useMemo(() => {
    if (!activeRuntime) return []
    return buildTradeMarkers(activeRuntime.trades)
  }, [activeRuntime])

  const chartMountKey = useMemo(() => {
    if (!activeRuntime) return 'empty'
    return activeRuntime.sessionKey
  }, [activeRuntime])

  const maxBuyLots = useMemo(() => {
    if (!canTrade || !currentBar || !activeRuntime) return 0
    return maxBuyableLots(activeRuntime.cash, currentBar.close, activeConfig.commissionRate)
  }, [canTrade, currentBar, activeRuntime, activeConfig.commissionRate])

  const maxSellLots = useMemo(() => {
    if (!canTrade || !currentBar || !activeRuntime) return 0
    return maxSellableLots(activeRuntime.lots, currentBar.trade_date)
  }, [canTrade, currentBar, activeRuntime])

  const estimatedBuyCost = useMemo(() => {
    if (!currentBar) return null
    const price = currentBar.close
    const gross = price * tradeLots * 100
    const commission = gross * activeConfig.commissionRate
    return gross + commission
  }, [currentBar, tradeLots, activeConfig.commissionRate])

  const handleStart = async () => {
    setError('')
    setLoading(true)
    try {
      let symbol = configDraft.fixedSymbol
      let stockName = configDraft.fixedStockName

      if (configDraft.stockPickMode === 'random') {
        const stocks = await getStockAll()
        const picked = pickRandomItem(stocks.filter((s) => s.symbol))
        if (!picked) throw new Error('无法获取股票列表')
        symbol = picked.symbol
        stockName = picked.name ?? ''
      } else if (!symbol) {
        throw new Error('请选择股票')
      }

      const fullData = await getStockDailyData(symbol, configDraft.adjust)
      if (fullData.length === 0) {
        throw new Error('该股票无 K 线数据')
      }

      const simStartIndex = resolveSimStartIndex(fullData, configDraft)
      const nextRuntime = createRuntime(symbol, stockName, fullData, configDraft, simStartIndex)

      setConfig(configDraft)
      setRuntime(nextRuntime)
      setPhase('running')
      setReviewSession(null)
      setReviewRuntime(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '启动失败')
    } finally {
      setLoading(false)
    }
  }

  const handleNextBar = () => {
    if (!runtime) return
    const next = advanceNextBar(runtime)
    if (!next) return
    setRuntime(next)
    if (isSimulationComplete(next)) {
      setPhase('ended')
    }
  }

  const handleEnd = () => {
    setPhase('ended')
  }

  const handleSave = () => {
    if (!runtime) return
    const record = buildSessionRecord(runtime, config)
    const result = saveSessionRecord(record)
    if (!result.ok) {
      setError(result.error)
      return
    }
    refreshSavedSessions()
    setError('')
  }

  const handleReset = () => {
    setPhase('setup')
    setRuntime(null)
    setReviewSession(null)
    setReviewRuntime(null)
    setConfigDraft(config)
    setError('')
  }

  const handleReview = async (session: PaperTradingSessionRecord) => {
    setReviewLoading(true)
    setError('')
    try {
      const fullData = await getStockDailyData(session.symbol, session.config.adjust)
      if (fullData.length <= session.simStartIndex) {
        throw new Error('K 线数据不足，无法复盘')
      }
      setReviewSession(session)
      setReviewRuntime(runtimeFromSession(session, fullData))
      setPhase('review')
      setRuntime(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载复盘数据失败')
    } finally {
      setReviewLoading(false)
    }
  }

  const handleDeleteSession = (id: string) => {
    deleteSessionRecord(id)
    refreshSavedSessions()
    if (reviewSession?.id === id) {
      setReviewSession(null)
      setReviewRuntime(null)
      setPhase('setup')
    }
  }

  const runTrade = (side: 'buy' | 'sell') => {
    if (!runtime) return
    setError('')
    const result = side === 'buy'
      ? executeBuy(runtime, config, tradeLots)
      : executeSell(runtime, config, tradeLots)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setRuntime(result.runtime)
  }

  const renderSetupForm = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 0.5, overflow: 'auto', flex: 1, minHeight: 0 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <SetupSectionTitle>模拟资金</SetupSectionTitle>
        <TextField
          label="初始资金"
          type="number"
          size="small"
          value={configDraft.initialCapital}
          onChange={(e) => setConfigDraft((c) => ({ ...c, initialCapital: Number(e.target.value) || 0 }))}
          InputProps={{ endAdornment: <InputAdornment position="end">元</InputAdornment> }}
          sx={{ marginBottom: 2 }}
        />
        <TextField
          label="佣金比例"
          type="number"
          size="small"
          value={configDraft.commissionRate}
          onChange={(e) => setConfigDraft((c) => ({ ...c, commissionRate: Number(e.target.value) || 0 }))}
          sx={{ marginBottom: 2 }}
        />
        <TextField
          label="印花税（卖出）"
          type="number"
          size="small"
          value={configDraft.stampTaxRate}
          onChange={(e) => setConfigDraft((c) => ({ ...c, stampTaxRate: Number(e.target.value) || 0 }))}
          sx={{ marginBottom: 2 }}
        />
      </Box>

      <Divider />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <SetupSectionTitle>模拟交易</SetupSectionTitle>
        <FormControl>
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1 }}>
            <RadioGroup
              row
              value={configDraft.stockPickMode}
              onChange={(e) => setConfigDraft((c) => ({ ...c, stockPickMode: e.target.value as 'random' | 'fixed' }))}
            >
              <FormControlLabel value="random" control={<Radio size="small" />} label="随机股票" />
              <FormControlLabel value="fixed" control={<Radio size="small" />} label="指定股票" />
            </RadioGroup>
            {configDraft.stockPickMode === 'fixed' ? (
              <StyledButton size="small" sx={{ alignSelf: 'flex-start', mt: 0.5 }} onClick={() => setSymbolSearchOpen(true)}>
                {configDraft.fixedSymbol
                  ? `${configDraft.fixedSymbol} ${configDraft.fixedStockName}`
                  : '选择股票'}
              </StyledButton>
            ) : null}
          </Box>


        </FormControl>

        <FormControl>
          {/* <Typography variant="caption" sx={{ opacity: 0.7, mb: 0.5 }}>起始交易日</Typography> */}
          <RadioGroup
            row
            value={configDraft.startDateMode}
            onChange={(e) => setConfigDraft((c) => ({ ...c, startDateMode: e.target.value as 'random' | 'fixed' }))}
          >
            <FormControlLabel value="random" control={<Radio size="small" />} label="随机日期" />
            <FormControlLabel value="fixed" control={<Radio size="small" />} label="固定日期" />
          </RadioGroup>

          <TextField
            label="起始日期"
            size="small"
            placeholder="YYYY-MM-DD"
            value={configDraft.fixedStartDate}
            onChange={(e) => setConfigDraft((c) => ({ ...c, fixedStartDate: e.target.value }))}
            sx={{ mt: 0.5, marginTop: 2 }}
            disabled={configDraft.startDateMode !== 'fixed'}
          />
        </FormControl>

        <TextField
          label="模拟 K 线数量"
          type="number"
          size="small"
          value={configDraft.simBarCount || ''}
          onChange={(e) => {
            const raw = e.target.value
            setConfigDraft((c) => ({
              ...c,
              simBarCount: raw === '' ? 0 : Number(raw),
            }))
          }}
          error={simBarCountInvalid}
          helperText={simBarCountInvalid
            ? `模拟 K 线数量不能少于 ${MIN_SIM_BAR_COUNT} 根`
            : '起始日之后逐根揭示的 K 线数；起始日之前的 K 线会全部加载'}
          sx={{ marginTop: 3 }}
        />
      </Box>
    </Box>
  )

  const renderTradePanel = () => {
    if (!stats || !activeRuntime) return null
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>交易</Typography>
        <Typography variant="caption" sx={{ opacity: 0.75 }}>
          当前：{currentBar ? formatTradeDateDisplay(currentBar.trade_date) : '未进入交易区间'}
          {currentBar ? ` · 收盘 ${currentBar.close.toFixed(2)}` : ''}
        </Typography> */}
        <Typography variant="caption" sx={{ opacity: 0.65 }}>
          T+1 · 1 手 = 100 股 · 可买 {maxBuyLots} 手 · 可卖 {maxSellLots} 手
        </Typography>

        <TextField
          label="手数"
          type="number"
          size="small"
          value={tradeLots}
          onChange={(e) => setTradeLots(Math.max(1, Number(e.target.value) || 1))}
          disabled={!canTrade}
        />

        {estimatedBuyCost !== null ? (
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            预估买入成本：{formatMoney(estimatedBuyCost)} 元（含佣金）
          </Typography>
        ) : null}

        <Box sx={{ display: 'flex', gap: 1 }}>
          <StyledButton
            size="small"
            disabled={!canTrade || tradeLots > maxBuyLots}
            onClick={() => runTrade('buy')}
            sx={{ flex: 1, color: upColor }}
          >
            买入
          </StyledButton>
          <StyledButton
            size="small"
            disabled={!canTrade || tradeLots > maxSellLots}
            onClick={() => runTrade('sell')}
            sx={{ flex: 1, color: downColor }}
          >
            卖出
          </StyledButton>
        </Box>

        <Divider />

        <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 700 }}>持仓</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
          <StatItem label="持仓股数" value={`${stats.shares}`} />
          <StatItem label="持仓市值" value={formatMoney(stats.marketValue)} />
          <StatItem
            label="持仓成本"
            value={stats.shares > 0 ? formatMoney(stats.positionCost) : '—'}
          />
          <StatItem
            label="持仓收益"
            value={stats.shares > 0 ? formatMoney(stats.positionPnl) : '—'}
            color={stats.shares > 0 ? pctColor(stats.positionPnl) : undefined}
          />
          <StatItem
            label="持仓盈亏比例"
            value={stats.shares > 0 ? formatPct(stats.positionPnlRatePct) : '—'}
            color={stats.shares > 0 ? pctColor(stats.positionPnlRatePct) : undefined}
          />
        </Box>

        <Divider />

        <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 700 }}>综合</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
          <StatItem label="可用资金" value={formatMoney(stats.cash)} />
          <StatItem label="总资产" value={formatMoney(stats.equity)} />
          <StatItem
            label="收益"
            value={formatMoney(stats.totalReturn)}
            color={pctColor(stats.totalReturn)}
          />
          <StatItem
            label="收益率"
            value={formatPct(stats.returnRatePct)}
            color={pctColor(stats.returnRatePct)}
          />
          <StatItem
            label="胜率"
            value={stats.closedTradeCount > 0 ? formatPct(stats.winRatePct) : '—'}
          />
          <StatItem
            label="盈利轮次"
            value={stats.closedTradeCount > 0 ? `${stats.winCount} / ${stats.closedTradeCount}` : '—'}
          />
        </Box>
      </Box>
    )
  }

  const renderTradeList = (trades: PaperTradeRecord[]) => (
    <List dense disablePadding sx={{ maxHeight: 200, overflow: 'auto' }}>
      {trades.length === 0 ? (
        <Typography variant="body2" sx={{ p: 1, opacity: 0.65 }}>暂无成交</Typography>
      ) : (
        [...trades].reverse().map((trade) => (
          <ListItem key={trade.id} disablePadding sx={{ px: 1 }}>
            <ListItemText
              primary={`${trade.side === 'buy' ? '买' : '卖'} ${formatTradeDateDisplay(trade.tradeDate)} · ${trade.lots}手 @ ${trade.price.toFixed(2)}`}
              secondary={
                trade.realizedPnl !== null
                  ? `盈亏 ${formatMoney(trade.realizedPnl)} · 资金 ${formatMoney(trade.cashAfter)}`
                  : `资金 ${formatMoney(trade.cashAfter)}`
              }
              primaryTypographyProps={{ fontSize: 12, fontWeight: 700, color: trade.side === 'buy' ? upColor : downColor }}
              secondaryTypographyProps={{ fontSize: 11 }}
            />
          </ListItem>
        ))
      )}
    </List>
  )

  return (
    <Paper variant="outlined" sx={{ height: '100%', padding: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingTop: 0 }}>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', gap: 1, overflow: 'hidden' }}>
        <Paper variant="outlined" sx={{ width: 360, flexShrink: 0, p: 1, display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden' }}>
          {phase === 'setup' ? (
            <>
              <StyledButton
                startIcon={<PlayArrowIcon />}
                disabled={loading || simBarCountInvalid}
                onClick={() => void handleStart()}
              >
                {loading ? '加载中…' : '开始模拟'}
              </StyledButton>
              {error ? <Typography variant="caption" color="error">{error}</Typography> : null}
              {renderSetupForm()}
            </>
          ) : null}

          {phase !== 'setup' && error ? <Typography variant="caption" color="error">{error}</Typography> : null}

          {(phase === 'running' || phase === 'ended') && runtime ? (
            <>
              {/* <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {runtime.symbol} {runtime.stockName ? `· ${runtime.stockName}` : ''}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                起始：{formatTradeDateDisplay(runtime.fullData[runtime.simStartIndex]?.trade_date ?? '')}
                {' · 计划模拟 '}{simBarCount} 根
              </Typography> */}

              {phase === 'running' ? (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <StyledButton
                    size="small"
                    startIcon={<SkipNextIcon />}
                    disabled={!canNextBar}
                    onClick={handleNextBar}
                  >
                    下一根 K 线
                  </StyledButton>
                  <StyledButton size="small" startIcon={<StopIcon />} onClick={handleEnd}>
                    结束
                  </StyledButton>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <StyledButton size="small" startIcon={<SaveIcon />} onClick={handleSave}>
                    保存结果
                  </StyledButton>
                  <StyledButton size="small" onClick={handleReset}>
                    新模拟
                  </StyledButton>
                </Box>
              )}

              {isLastBar && phase === 'running' ? (
                <Typography variant="caption" sx={{ color: 'warning.main' }}>
                  已完成 {simBarCount} 根模拟 K 线，可结束并保存
                </Typography>
              ) : null}

              {phase === 'running' ? renderTradePanel() : null}

              {phase === 'ended' && stats ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 700 }}>持仓</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
                    <StatItem
                      label="持仓成本"
                      value={stats.shares > 0 ? formatMoney(stats.positionCost) : '—'}
                    />
                    <StatItem
                      label="持仓收益"
                      value={stats.shares > 0 ? formatMoney(stats.positionPnl) : '—'}
                      color={stats.shares > 0 ? pctColor(stats.positionPnl) : undefined}
                    />
                  </Box>
                  <Divider />
                  <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 700 }}>综合</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
                    <StatItem label="最终资产" value={formatMoney(stats.equity)} />
                    <StatItem label="收益率" value={formatPct(stats.returnRatePct)} color={pctColor(stats.returnRatePct)} />
                    <StatItem
                      label="胜率"
                      value={stats.closedTradeCount > 0 ? formatPct(stats.winRatePct) : '—'}
                    />
                  </Box>
                </Box>
              ) : null}

              <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 700 }}>成交记录</Typography>
              {renderTradeList(runtime.trades)}
            </>
          ) : null}

          {phase === 'review' && reviewSession ? (
            <>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {reviewSession.symbol} · {formatTradeDateDisplay(reviewSession.simStartDate)} → {formatTradeDateDisplay(reviewSession.simEndDate)}
              </Typography>
              {(() => {
                const reviewWin = computeRoundTripWinStats(reviewSession.trades)
                return (
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
                    <StatItem label="收益率" value={formatPct(reviewSession.returnRatePct)} color={pctColor(reviewSession.returnRatePct)} />
                    <StatItem
                      label="胜率"
                      value={reviewWin.closedTradeCount > 0 ? formatPct(reviewWin.winRatePct) : '—'}
                    />
                    <StatItem
                      label="盈利轮次"
                      value={reviewWin.closedTradeCount > 0 ? `${reviewWin.winCount} / ${reviewWin.closedTradeCount}` : '—'}
                    />
                  </Box>
                )
              })()}
              <StyledButton size="small" onClick={handleReset}>返回配置</StyledButton>
              <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 700 }}>成交记录</Typography>
              {renderTradeList(reviewSession.trades)}
            </>
          ) : null}

          <Divider />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <HistoryIcon fontSize="small" sx={{ opacity: 0.7 }} />
            <Typography variant="caption" sx={{ fontWeight: 700, flex: 1 }}>历史复盘</Typography>
          </Box>

          <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {savedSessions.length === 0 ? (
              <Typography variant="body2" sx={{ p: 1, opacity: 0.65 }}>暂无保存记录</Typography>
            ) : (
              <List dense disablePadding>
                {savedSessions.map((session) => (
                  <ListItem
                    key={session.id}
                    disablePadding
                    secondaryAction={(
                      <StyledButton
                        size="small"
                        sx={{ minWidth: 32, p: 0.5 }}
                        onClick={() => handleDeleteSession(session.id)}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </StyledButton>
                    )}
                  >
                    <ListItemButton
                      onClick={() => void handleReview(session)}
                      selected={reviewSession?.id === session.id}
                      disabled={reviewLoading}
                    >
                      <ListItemText
                        primary={`${session.symbol} ${formatPct(session.returnRatePct)}`}
                        secondary={new Date(session.savedAt).toLocaleString('zh-CN')}
                        primaryTypographyProps={{ fontSize: 13, fontWeight: 700 }}
                        secondaryTypographyProps={{ fontSize: 11 }}
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
                {activeRuntime ? `${activeRuntime.symbol}${activeRuntime.stockName ? ` ${activeRuntime.stockName}` : ''}` : '模拟盘'}
              </Typography>
              <SeperatorBox />
              <StyledButton
                startIcon={<TrendingUpIcon />}
                size="small"
                sx={{ height: '32px' }}
                disabled={!activeRuntime}
                onClick={() => setIndicatorOpen(true)}
              >
                Indicators
              </StyledButton>
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {(loading || reviewLoading) ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (!activeRuntime || chartData.length === 0) ? (
              <Box sx={{ p: 1 }}>
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  {phase === 'setup' ? '完成左侧配置后点击「开始模拟」' : '暂无 K 线数据'}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <PaperTradingChart
                  key={chartMountKey}
                  chartData={chartData}
                  stockCode={activeRuntime.symbol}
                  adjust={activeConfig.adjust}
                  incrementalChartUpdate={phase === 'running' || phase === 'ended'}
                  clipIndicatorToChartData
                  tradeMarkers={tradeMarkers}
                  openIndicatorsConfig={(instanceId) => {
                    setAutoOpenConfigInstanceId(instanceId)
                    setIndicatorOpen(true)
                  }}
                />
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      <SymbolSearchDialog
        open={symbolSearchOpen}
        onClose={() => setSymbolSearchOpen(false)}
        onSelect={(item) => {
          setConfigDraft((c) => ({
            ...c,
            fixedSymbol: item.symbol,
            fixedStockName: item.name,
            stockPickMode: 'fixed',
          }))
          setSymbolSearchOpen(false)
        }}
      />

      <IndicatorSelectDialog
        isOpen={indicatorOpen}
        indicatorsOnly
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

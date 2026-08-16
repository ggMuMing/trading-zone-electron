import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import GroupAddIcon from '@mui/icons-material/GroupAdd'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import {
  Box,
  Checkbox,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createStockScreeningStrategy,
  deleteStockScreeningStrategy,
  getChartLayout,
  getSelectedStrategies,
  getStockDailyData,
  getStockScreeningResults,
  getStockScreeningStrategies,
  getStockScreeningTask,
  getStrategyList,
  runStockScreening,
  updateStockScreeningResultFlag,
} from '../../api/api'
import type {
  Stock,
  StockDailyData,
  StockScreeningFilterType,
  StockScreeningResultStock,
  StockScreeningStrategy,
  StockScreeningTaskProgress,
  StrategySummary,
} from '../../api/apiType'
import ChartComponent from '../../components/ChartComponent/ChartComponent'
import AddToStockGroupDialog from '../../components/ChartComponent/AddToStockGroupDialog'
import IndicatorSelectDialog from '../../components/ChartComponent/IndicatorSelectDialog'
import { syncChartLayout, syncSelectedStrategies } from '../../components/ChartComponent/ChartComponentProxy'
import { SeperatorBox, StyledButton, StyledDialog } from '../../components/styled'

const todayText = () => new Date().toISOString().slice(0, 10)
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default function StockScreeningView() {
  const [screeningStrategies, setScreeningStrategies] = useState<StockScreeningStrategy[]>([])
  const [builtInStrategies, setBuiltInStrategies] = useState<StrategySummary[]>([])
  const [selectedStrategyName, setSelectedStrategyName] = useState('')
  const [tradeDate, setTradeDate] = useState(todayText)
  const [filterType, setFilterType] = useState<StockScreeningFilterType>('all')
  const [resultStocks, setResultStocks] = useState<StockScreeningResultStock[]>([])
  const [selectedStock, setSelectedStock] = useState<StockScreeningResultStock | null>(null)
  const [chartData, setChartData] = useState<StockDailyData[]>([])
  const [loadingResults, setLoadingResults] = useState(false)
  const [running, setRunning] = useState(false)
  const [screeningProgress, setScreeningProgress] = useState<StockScreeningTaskProgress | null>(null)
  const [chartLoading, setChartLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newStrategyName, setNewStrategyName] = useState('')
  const [newStrategyIds, setNewStrategyIds] = useState<string[]>([])
  const [savingStrategy, setSavingStrategy] = useState(false)
  const [addToGroupOpen, setAddToGroupOpen] = useState(false)
  const [indicatorOpen, setIndicatorOpen] = useState(false)
  const [autoOpenConfigInstanceId, setAutoOpenConfigInstanceId] = useState<string | null>(null)

  const selectedStrategy = useMemo(
    () => screeningStrategies.find((item) => item.name === selectedStrategyName) || null,
    [screeningStrategies, selectedStrategyName],
  )

  const selectedStockLabel = selectedStock
    ? `${selectedStock.symbol}${selectedStock.name ? ` - ${selectedStock.name}` : ''}`
    : '未选择股票'

  const refreshStrategies = useCallback(async () => {
    const rows = await getStockScreeningStrategies()
    setScreeningStrategies(rows)
    setSelectedStrategyName((current) => current || rows[0]?.name || '')
  }, [])

  const refreshResults = useCallback(async () => {
    if (!selectedStrategyName || !tradeDate) {
      setResultStocks([])
      setSelectedStock(null)
      return
    }
    setLoadingResults(true)
    const result = await getStockScreeningResults(selectedStrategyName, tradeDate, filterType)
    setResultStocks(result.stocks)
    setSelectedStock((current) => {
      if (current && result.stocks.some((item) => item.symbol === current.symbol)) {
        return result.stocks.find((item) => item.symbol === current.symbol) || current
      }
      return result.stocks[0] || null
    })
    setLoadingResults(false)
  }, [filterType, selectedStrategyName, tradeDate])

  useEffect(() => {
    void refreshStrategies()
    getStrategyList().then(setBuiltInStrategies)
  }, [refreshStrategies])

  useEffect(() => {
    void refreshResults()
  }, [refreshResults])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [layout, selected] = await Promise.all([getChartLayout(), getSelectedStrategies()])
      if (cancelled) return
      syncChartLayout(layout)
      syncSelectedStrategies(selected)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedStock?.symbol) {
      setChartData([])
      return
    }
    let cancelled = false
    ;(async () => {
      setChartLoading(true)
      const rows = await getStockDailyData(selectedStock.symbol, 'qfq')
      if (!cancelled) {
        setChartData(rows)
        setChartLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedStock?.symbol])

  const handleRun = async () => {
    if (!selectedStrategyName || !tradeDate) return
    setRunning(true)
    setScreeningProgress(null)
    setError('')
    setMessage('')
    const task = await runStockScreening(selectedStrategyName, tradeDate)
    if (!task) {
      setRunning(false)
      setError('提交选股任务失败')
      return
    }
    setScreeningProgress(task.progress)

    let currentTask = task
    while (currentTask.status === 'running') {
      await wait(1000)
      const nextTask = await getStockScreeningTask(task.task_id)
      if (!nextTask) {
        setRunning(false)
        setError('获取选股任务进度失败')
        return
      }
      currentTask = nextTask
      setScreeningProgress(nextTask.progress)
    }

    setRunning(false)
    if (currentTask.status === 'failed' || !currentTask.result) {
      setError(currentTask.error || '执行选股失败')
      return
    }

    const result = currentTask.result
    const totalSeconds = result.timings?.total_seconds
    const timingText = typeof totalSeconds === 'number' ? `，耗时 ${totalSeconds.toFixed(1)} 秒` : ''
    const workerText = result.worker_count ? `，并发 ${result.worker_count}` : ''
    setMessage(`扫描 ${result.scanned_count} 只股票，命中 ${result.matched_count} 只，跳过 ${result.skipped_count} 只${workerText}${timingText}`)
    await refreshResults()
  }

  const handleCreateStrategy = async () => {
    if (!newStrategyName.trim() || newStrategyIds.length === 0) return
    setSavingStrategy(true)
    setError('')
    const created = await createStockScreeningStrategy(newStrategyName.trim(), newStrategyIds)
    setSavingStrategy(false)
    if (!created) {
      setError('创建选股策略失败，请检查名称是否重复或包含特殊字符')
      return
    }
    setCreateDialogOpen(false)
    setNewStrategyName('')
    setNewStrategyIds([])
    await refreshStrategies()
    setSelectedStrategyName(created.name)
  }

  const handleDeleteStrategy = async () => {
    if (!selectedStrategyName) return
    const okToDelete = window.confirm(`确认删除选股策略「${selectedStrategyName}」及其结果吗？`)
    if (!okToDelete) return
    const ok = await deleteStockScreeningStrategy(selectedStrategyName)
    if (!ok) {
      setError('删除选股策略失败')
      return
    }
    setSelectedStrategyName('')
    setResultStocks([])
    setSelectedStock(null)
    await refreshStrategies()
  }

  const toggleBuiltInStrategy = (strategyId: string) => {
    setNewStrategyIds((current) => (
      current.includes(strategyId)
        ? current.filter((id) => id !== strategyId)
        : [...current, strategyId]
    ))
  }

  const toggleFocus = async (stock: StockScreeningResultStock) => {
    if (!selectedStrategyName) return
    const nextFlag: 1 | 2 = stock.flag === 2 ? 1 : 2
    const updated = await updateStockScreeningResultFlag(selectedStrategyName, tradeDate, stock.symbol, nextFlag)
    if (!updated) {
      setError('更新重点关注失败')
      return
    }
    setResultStocks((current) => current.map((item) => (
      item.symbol === stock.symbol ? { ...item, flag: nextFlag } : item
    )))
    setSelectedStock((current) => (
      current?.symbol === stock.symbol ? { ...current, flag: nextFlag } : current
    ))
  }

  const selectedStockForGroup: Stock | null = selectedStock
    ? { symbol: selectedStock.symbol, name: selectedStock.name }
    : null

  return (
    <Paper variant="outlined" sx={{ height: '100%', padding: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingTop: 0 }}>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', gap: 1, overflow: 'hidden' }}>
        <Paper variant="outlined" sx={{ width: 360, flexShrink: 0, p: 1, display: 'flex', flexDirection: 'column', gap: 1, overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>每日选股</Typography>
            <IconButton size="small" onClick={() => setCreateDialogOpen(true)}>
              <AddIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" disabled={!selectedStrategyName} onClick={() => void handleDeleteStrategy()}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>

          <FormControl size="small" fullWidth>
            <Select
              value={selectedStrategyName}
              displayEmpty
              onChange={(event) => setSelectedStrategyName(event.target.value)}
            >
              <MenuItem value="">选择选股策略</MenuItem>
              {screeningStrategies.map((item) => (
                <MenuItem key={item.name} value={item.name}>{item.name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedStrategy ? (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              具体策略：{selectedStrategy.strategy_ids.join(' + ')}
            </Typography>
          ) : null}

          <TextField
            size="small"
            type="date"
            value={tradeDate}
            onChange={(event) => setTradeDate(event.target.value)}
            fullWidth
          />

          <StyledButton
            startIcon={running ? <CircularProgress size={16} /> : <PlayArrowIcon />}
            disabled={!selectedStrategyName || !tradeDate || running}
            onClick={() => void handleRun()}
          >
            {running ? '执行中' : '执行选股'}
          </StyledButton>

          <ToggleButtonGroup
            exclusive
            size="small"
            value={filterType}
            onChange={(_, next) => {
              if (next) setFilterType(next)
            }}
            fullWidth
          >
            <ToggleButton value="all">全部</ToggleButton>
            <ToggleButton value="focus">重点关注</ToggleButton>
            <ToggleButton value="normal">非重点关注</ToggleButton>
          </ToggleButtonGroup>

          {message ? <Typography variant="caption" sx={{ opacity: 0.75 }}>{message}</Typography> : null}
          {running && screeningProgress ? (
            <Typography variant="caption" sx={{ opacity: 0.75 }}>
              进度：{screeningProgress.scanned_count}/{screeningProgress.total_count || '-'}
              ，命中 {screeningProgress.matched_count}，跳过 {screeningProgress.skipped_count}
            </Typography>
          ) : null}
          {error ? <Typography variant="caption" color="error">{error}</Typography> : null}

          <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {loadingResults ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={22} />
              </Box>
            ) : resultStocks.length === 0 ? (
              <Typography variant="body2" sx={{ p: 1, opacity: 0.65 }}>暂无选股结果</Typography>
            ) : (
              <List dense disablePadding>
                {resultStocks.map((stock) => (
                  <ListItem
                    key={stock.symbol}
                    disablePadding
                    secondaryAction={(
                      <IconButton edge="end" size="small" onClick={() => void toggleFocus(stock)}>
                        {stock.flag === 2 ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                      </IconButton>
                    )}
                  >
                    <ListItemButton
                      selected={selectedStock?.symbol === stock.symbol}
                      onClick={() => setSelectedStock(stock)}
                    >
                      <ListItemText
                        primary={stock.symbol}
                        secondary={stock.name || ' '}
                        primaryTypographyProps={{ fontSize: 13, fontWeight: 700 }}
                        secondaryTypographyProps={{ fontSize: 12 }}
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
              <Typography sx={{ px: 1, minWidth: 160, fontSize: 15, fontWeight: 700 }}>{selectedStockLabel}</Typography>
              <SeperatorBox />
              <StyledButton
                startIcon={<GroupAddIcon />}
                size="small"
                sx={{ height: '32px' }}
                disabled={!selectedStock}
                onClick={() => setAddToGroupOpen(true)}
              >
                加入分组
              </StyledButton>
              <SeperatorBox />
              <StyledButton
                startIcon={<TrendingUpIcon />}
                size="small"
                sx={{ height: '32px' }}
                onClick={() => setIndicatorOpen(true)}
              >
                Indicators
              </StyledButton>
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
            {(!chartLoading && chartData.length === 0) ? (
              <Box sx={{ p: 1 }}>
                <Typography variant="body2" sx={{ opacity: 0.7 }}>请选择一只选股结果查看图表</Typography>
              </Box>
            ) : (
              <Box sx={{ flex: 1, minHeight: 0, opacity: chartLoading ? 0.7 : 1 }}>
                <ChartComponent
                  chartData={chartData}
                  stockCode={selectedStock?.symbol || ''}
                  adjust="qfq"
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

      <StyledDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>创建选股策略</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <TextField
            size="small"
            label="策略名称"
            value={newStrategyName}
            onChange={(event) => setNewStrategyName(event.target.value)}
            helperText="仅支持英文大小写、数字和中文字符"
            fullWidth
          />
          <Typography variant="body2" sx={{ fontWeight: 700 }}>选择具体策略（AND）</Typography>
          <List dense disablePadding sx={{ maxHeight: 260, overflow: 'auto' }}>
            {builtInStrategies.map((strategy) => (
              <ListItem key={strategy.id} disablePadding>
                <ListItemButton onClick={() => toggleBuiltInStrategy(strategy.id)}>
                  <Checkbox size="small" checked={newStrategyIds.includes(strategy.id)} />
                  <ListItemText
                    primary={strategy.name}
                    secondary={strategy.description || strategy.id}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <StyledButton onClick={() => setCreateDialogOpen(false)} disabled={savingStrategy}>取消</StyledButton>
          <StyledButton
            disabled={savingStrategy || !newStrategyName.trim() || newStrategyIds.length === 0}
            onClick={() => void handleCreateStrategy()}
          >
            {savingStrategy ? '保存中' : '创建'}
          </StyledButton>
        </DialogActions>
      </StyledDialog>

      <AddToStockGroupDialog
        open={addToGroupOpen}
        onClose={() => setAddToGroupOpen(false)}
        stock={selectedStockForGroup}
      />

      <IndicatorSelectDialog
        isOpen={indicatorOpen}
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

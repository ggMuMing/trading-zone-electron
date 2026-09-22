import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import SyncIcon from '@mui/icons-material/Sync'
import { useEffect, useMemo, useState } from 'react'
import {
  isDailyBarHistoryStepUnlocked,
  PIPELINE_STEPS,
  type PipelineStepId,
  type PipelineStepMeta
} from '../../../shared/constants/pipeline'
import { yyyymmddToIso } from '../../../shared/constants/market'
import type { BoardStats, MarketSyncProgress } from '../../../shared/types/market'
import type {
  PipelineGlobalStatus,
  PipelineStatusResult,
  PipelineStepState,
  PipelineStepStatus
} from '../../../shared/types/pipeline'

const BOARD_LABELS: Array<{ key: keyof Omit<BoardStats, 'total'>; label: string }> = [
  { key: 'sse_main', label: '上证主板' },
  { key: 'szse_main', label: '深证主板' },
  { key: 'chinext', label: '创业板' },
  { key: 'star', label: '科创板' },
  { key: 'bse', label: '北证' },
  { key: 'other', label: '其他' }
]

const STEP_STATUS_LABELS: Record<PipelineStepStatus, string> = {
  not_started: '未开始',
  stale: '待更新',
  fresh: '最新',
  running: '进行中',
  failed: '失败'
}

const STEP_STATUS_COLORS: Record<PipelineStepStatus, 'default' | 'success' | 'warning' | 'error'> =
  {
    not_started: 'default',
    stale: 'warning',
    fresh: 'success',
    running: 'warning',
    failed: 'error'
  }

const GLOBAL_BUTTON_LABELS: Record<PipelineGlobalStatus, string> = {
  init: '初始化数据',
  stale: '更新数据',
  fresh: '数据已更新',
  running: '进行中…'
}

const EXPAND_COL_WIDTH = 44
const ORDINAL_COL_WIDTH = 120

function childrenByParent(): Map<PipelineStepId, PipelineStepMeta[]> {
  const map = new Map<PipelineStepId, PipelineStepMeta[]>()
  for (const step of PIPELINE_STEPS) {
    if (!step.parent) {
      continue
    }
    const list = map.get(step.parent) ?? []
    list.push(step)
    map.set(step.parent, list)
  }
  return map
}

const PIPELINE_CHILDREN_BY_PARENT = childrenByParent()

function formatCoverage(step: PipelineStepState): string {
  if (!step.coverage_start && !step.coverage_end) {
    return '—'
  }
  const start = step.coverage_start ? yyyymmddToIso(step.coverage_start) : '—'
  const end = step.coverage_end ? yyyymmddToIso(step.coverage_end) : '—'
  return `${start} ～ ${end}`
}

interface SettingsPageProps {
  syncing: boolean
  clearing: boolean
  progress: MarketSyncProgress | null
  onSyncingChange: (syncing: boolean) => void
  onClearingChange: (clearing: boolean) => void
}

export function SettingsPage({
  syncing,
  clearing,
  progress,
  onSyncingChange,
  onClearingChange
}: SettingsPageProps): React.JSX.Element {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pythonReady, setPythonReady] = useState('检测中…')
  const [hasToken, setHasToken] = useState(false)
  const [tokenMasked, setTokenMasked] = useState<string | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [status, setStatus] = useState<PipelineStatusResult | null>(null)
  const [boardStats, setBoardStats] = useState<BoardStats | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  /** 步骤 4 等带子步的行：默认收起，4.1 不占用主列表。 */
  const [expandedParents, setExpandedParents] = useState<Partial<Record<PipelineStepId, boolean>>>(
    {}
  )

  const visiblePipelineSteps = useMemo(
    () =>
      PIPELINE_STEPS.filter((meta) => {
        if (!meta.parent) {
          return true
        }
        return expandedParents[meta.parent] === true
      }),
    [expandedParents]
  )

  /** 打开页只自动刷新交易日历；失败保留本地日历，其它步骤照常出状态。 */
  const loadAll = async (refreshCalendar: boolean): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const [ready, tokenConfigured, masked, boards] = await Promise.all([
        window.api.python.ready(),
        window.api.config.hasTushareToken(),
        window.api.config.getTushareTokenMasked(),
        window.api.stocks.boardStats()
      ])
      setHasToken(tokenConfigured)
      setTokenMasked(masked)
      setBoardStats(boards)
      if (ready) {
        const importsOk = Object.values(ready.imports).every(Boolean)
        setPythonReady(importsOk ? `Python ${ready.python}` : '依赖未就绪')
        if (!importsOk) {
          setError(`Python import 失败：${JSON.stringify(ready.imports)}`)
        }
      } else {
        setPythonReady('未就绪')
      }
      setStatus(
        refreshCalendar
          ? await window.api.market.refreshCalendar()
          : await window.api.market.pipelineStatus()
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll(true)
  }, [])

  const globalStatus: PipelineGlobalStatus = syncing ? 'running' : status?.global ?? 'init'
  const busy = loading || syncing || clearing
  const stepById = new Map<string, PipelineStepState>(
    (status?.steps ?? []).map((step) => [step.id, step])
  )
  const runningStepId = progress?.step_id ?? null

  const handleSaveToken = async (): Promise<void> => {
    setError(null)
    setMessage(null)
    try {
      await window.api.config.setTushareToken(tokenInput)
      setTokenInput('')
      setMessage('Token 已保存到本地配置')
      await loadAll(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const runAndReload = async (run: () => Promise<{ errors: Array<{ message: string }> }>) => {
    onSyncingChange(true)
    setError(null)
    setMessage(null)
    setConfirmClear(false)
    try {
      const result = await run()
      if (result.errors.length > 0) {
        setError(result.errors.map((item) => item.message).join('；'))
      } else {
        setMessage('数据已更新到最近一个已收盘开市日')
      }
      await loadAll(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      onSyncingChange(false)
    }
  }

  const handleRunPipeline = (): void => {
    void runAndReload(() => window.api.market.runPipeline())
  }

  const handleRunStep = (stepId: PipelineStepId): void => {
    void runAndReload(() => window.api.market.runStep({ step_id: stepId }))
  }

  const handleClear = async (): Promise<void> => {
    if (!confirmClear) {
      setConfirmClear(true)
      setMessage(null)
      setError(null)
      return
    }
    onClearingChange(true)
    setError(null)
    setMessage(null)
    setConfirmClear(false)
    try {
      await window.api.market.clear()
      setMessage('已清除本地行情数据与初始化状态（Token 与股票列表保留）')
      await loadAll(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      onClearingChange(false)
    }
  }

  const progressValue =
    progress && progress.total_pending > 0
      ? Math.round((progress.done_days / progress.total_pending) * 100)
      : undefined

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 2 }}>
      <Stack spacing={2} sx={{ maxWidth: 880, mx: 'auto' }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography variant="h6" fontWeight={700}>
            配置
          </Typography>
          <Chip
            size="small"
            label={pythonReady}
            color={pythonReady.startsWith('Python') ? 'success' : 'warning'}
            variant="outlined"
          />
          <Chip
            size="small"
            label={hasToken ? `Token ${tokenMasked ?? '已配置'}` : 'Token 未配置'}
            color={hasToken ? 'default' : 'warning'}
            variant="outlined"
          />
        </Stack>

        {loading || syncing || clearing ? (
          <LinearProgress
            variant={progressValue === undefined ? 'indeterminate' : 'determinate'}
            value={progressValue}
          />
        ) : null}
        {progress && syncing ? (
          <Typography variant="body2" color="text.secondary">
            {progress.message}
          </Typography>
        ) : null}
        {clearing ? (
          <Typography variant="body2" color="text.secondary">
            正在清除本地行情数据，请稍候…（Token 与股票列表会保留）
          </Typography>
        ) : null}
        {confirmClear && !clearing ? (
          <Alert severity="warning" onClose={() => setConfirmClear(false)}>
            再次点击「确认清除数据？」将清空日线、复权因子、指数、两融、期指、成分、交易日覆盖表与初始化状态。Token
            与股票列表不会删除。
          </Alert>
        ) : null}
        {status?.calendar_error ? (
          <Alert severity="info">
            交易日历未能刷新，已沿用本地日历继续判定：{status.calendar_error}
          </Alert>
        ) : null}

        {message ? (
          <Alert severity="success" onClose={() => setMessage(null)}>
            {message}
          </Alert>
        ) : null}
        {error ? (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}

        <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom>
            Tushare Token
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <TextField
              size="small"
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="写入 userData；也可设环境变量 TUSHARE_TOKEN"
              fullWidth
            />
            <Button
              variant="outlined"
              onClick={() => void handleSaveToken()}
              disabled={!tokenInput.trim() || busy}
            >
              保存
            </Button>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
          <Stack direction="row" alignItems="flex-start" spacing={1}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2">数据管理</Typography>
              <Typography variant="caption" color="text.secondary">
                区间写死在代码里：全量类 2000-01-01 起按品种上市日裁剪，股票日线默认段 2024-01-01
                起，更早历史用行内子步倒序补。
              </Typography>
            </Box>
            <Chip
              size="small"
              label={`截至 ${
                status?.last_closed_trade_date
                  ? yyyymmddToIso(status.last_closed_trade_date)
                  : '—'
              }`}
              variant="outlined"
            />
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
            <Button
              variant="contained"
              startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
              onClick={handleRunPipeline}
              disabled={busy || globalStatus === 'fresh' || !hasToken}
            >
              {GLOBAL_BUTTON_LABELS[globalStatus]}
            </Button>
            <Button
              color="warning"
              variant="outlined"
              onClick={() => void handleClear()}
              disabled={busy}
              startIcon={clearing ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {clearing ? '清除中…' : confirmClear ? '确认清除数据？' : '清除所有数据'}
            </Button>
            <Button variant="outlined" disabled title="本轮不开放">
              自定义管理数据
            </Button>
          </Stack>

          <Table size="small" sx={{ mt: 1.5, tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: EXPAND_COL_WIDTH, px: 0.5 }} aria-label="展开子步骤" />
                <TableCell sx={{ width: ORDINAL_COL_WIDTH, minWidth: ORDINAL_COL_WIDTH }}>
                  序号
                </TableCell>
                <TableCell>数据处理步骤</TableCell>
                <TableCell sx={{ width: 210 }}>覆盖区间</TableCell>
                <TableCell align="right" sx={{ width: 120 }}>
                  当前状态
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visiblePipelineSteps.map((meta) => {
                const step = stepById.get(meta.id)
                const stepStatus: PipelineStepStatus =
                  runningStepId === meta.id ? 'running' : step?.status ?? 'not_started'
                const histUnlocked = meta.parent
                  ? isDailyBarHistoryStepUnlocked(meta, stepById)
                  : true
                const showInlineRun = !meta.required && stepStatus !== 'fresh'
                const canRunSubStep = showInlineRun && histUnlocked
                const lockTitle = meta.parent
                  ? histUnlocked
                    ? undefined
                    : (() => {
                        const hist = PIPELINE_STEPS.filter((s) => s.parent === 'daily_bar')
                        const idx = hist.findIndex((s) => s.id === meta.id)
                        if (idx <= 0) {
                          return '请先完成步骤 4 默认段'
                        }
                        return `请先完成步骤 ${hist[idx - 1]?.ordinal ?? '4.x'}`
                      })()
                  : undefined
                const childSteps = PIPELINE_CHILDREN_BY_PARENT.get(meta.id)
                const hasChildSteps = Boolean(childSteps && childSteps.length > 0)
                const expanded = expandedParents[meta.id] === true
                return (
                  <TableRow key={meta.id} hover>
                    <TableCell sx={{ width: EXPAND_COL_WIDTH, px: 0.5, verticalAlign: 'middle' }}>
                      {hasChildSteps ? (
                        <IconButton
                          size="small"
                          aria-expanded={expanded}
                          aria-label={expanded ? '收起历史子步骤' : '展开历史子步骤'}
                          onClick={() =>
                            setExpandedParents((prev) => ({
                              ...prev,
                              [meta.id]: !prev[meta.id]
                            }))
                          }
                        >
                          {expanded ? (
                            <ExpandLess fontSize="small" />
                          ) : (
                            <ExpandMore fontSize="small" />
                          )}
                        </IconButton>
                      ) : null}
                    </TableCell>
                    <TableCell
                      sx={{
                        width: ORDINAL_COL_WIDTH,
                        minWidth: ORDINAL_COL_WIDTH,
                        whiteSpace: 'nowrap',
                        pl: meta.parent ? 1 : 2
                      }}
                    >
                      <Typography variant="body2" color="text.secondary" noWrap>
                        步骤 {meta.ordinal}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={meta.parent ? 400 : 600}>
                        {meta.title}
                      </Typography>
                      {step?.error ? (
                        <Typography variant="caption" color="error">
                          {step.error}
                        </Typography>
                      ) : step?.detail ? (
                        <Typography variant="caption" color="text.secondary">
                          {step.detail}
                        </Typography>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {step ? formatCoverage(step) : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        size="small"
                        variant="outlined"
                        label={
                          showInlineRun && !histUnlocked
                            ? STEP_STATUS_LABELS.not_started
                            : STEP_STATUS_LABELS[stepStatus]
                        }
                        color={
                          showInlineRun && !histUnlocked
                            ? STEP_STATUS_COLORS.not_started
                            : STEP_STATUS_COLORS[stepStatus]
                        }
                        clickable={canRunSubStep && !busy && hasToken}
                        disabled={busy || !hasToken || (showInlineRun && !canRunSubStep)}
                        onClick={
                          canRunSubStep && !busy && hasToken
                            ? () => handleRunStep(meta.id)
                            : undefined
                        }
                        title={lockTitle}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {!hasToken ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              未配置 Token 时无法拉取数据，状态仍按本地库展示。
            </Typography>
          ) : null}
        </Paper>

        <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom>
            板块只数（在市股票列表）
          </Typography>
          {boardStats && boardStats.total > 0 ? (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {BOARD_LABELS.map((item) => (
                <Chip
                  key={item.key}
                  size="small"
                  variant="outlined"
                  label={`${item.label} ${boardStats[item.key]}`}
                />
              ))}
              <Chip size="small" label={`合计 ${boardStats.total}`} />
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              尚无股票列表，跑完步骤 3 后显示各板块只数。
            </Typography>
          )}
        </Paper>
      </Stack>
    </Box>
  )
}

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import SyncIcon from '@mui/icons-material/Sync'
import { useEffect, useState } from 'react'
import {
  MARKET_SYNC_START,
  isoToYyyymmdd,
  todayYyyymmdd,
  yyyymmddToIso
} from '../../../shared/constants/market'
import type { BoardStats, MarketCoverageResult, MarketSyncProgress } from '../../../shared/types/market'

const BOARD_LABELS: Array<{ key: keyof Omit<BoardStats, 'total'>; label: string }> = [
  { key: 'sse_main', label: '上证主板' },
  { key: 'szse_main', label: '深证主板' },
  { key: 'chinext', label: '创业板' },
  { key: 'star', label: '科创板' },
  { key: 'bse', label: '北证' },
  { key: 'other', label: '其他' }
]

function formatYmd(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }
  return yyyymmddToIso(value)
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
  const [endDate, setEndDate] = useState(todayYyyymmdd())
  const [coverage, setCoverage] = useState<MarketCoverageResult | null>(null)
  const [boardStats, setBoardStats] = useState<BoardStats | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const loadAll = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const [ready, tokenConfigured, masked, cov, boards] = await Promise.all([
        window.api.python.ready(),
        window.api.config.hasTushareToken(),
        window.api.config.getTushareTokenMasked(),
        window.api.market.coverage(),
        window.api.stocks.boardStats()
      ])
      setHasToken(tokenConfigured)
      setTokenMasked(masked)
      setCoverage(cov)
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  const today = todayYyyymmdd()
  const startIso = yyyymmddToIso(MARKET_SYNC_START)
  const endIso = yyyymmddToIso(endDate)
  const minEndIso = startIso
  const maxEndIso = yyyymmddToIso(today)
  const isEmpty = (coverage?.total_bars ?? 0) === 0
  const busy = loading || syncing || clearing

  const handleSaveToken = async (): Promise<void> => {
    setError(null)
    setMessage(null)
    try {
      await window.api.config.setTushareToken(tokenInput)
      setTokenInput('')
      setMessage('Token 已保存到本地配置')
      await loadAll()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleSync = async (): Promise<void> => {
    onSyncingChange(true)
    setError(null)
    setMessage(null)
    setConfirmClear(false)
    try {
      const result = await window.api.market.sync({
        start_date: MARKET_SYNC_START,
        end_date: endDate
      })
      const errHint =
        result.errors.length > 0 ? `；失败 ${result.errors.length} 日` : ''
      setMessage(
        `更新完成：列表 ${result.stock_list_count} 条，补齐 ${result.fetched_days} 日，跳过 ${result.skipped_days} 日，日线 ${result.bar_count} 行${errHint}`
      )
      await loadAll()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      onSyncingChange(false)
    }
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
      setMessage('已清除本地行情数据（Token 与股票列表保留）')
      await loadAll()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      onClearingChange(false)
    }
  }

  const progressValue =
    progress && progress.total_pending > 0
      ? Math.round((progress.done_days / progress.total_pending) * 100)
      : progress?.stage === 'done'
        ? 100
        : syncing
          ? undefined
          : 0

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

        {(loading || syncing || clearing) && (
          <LinearProgress
            variant={progressValue === undefined || clearing ? 'indeterminate' : 'determinate'}
            value={clearing ? undefined : progressValue}
          />
        )}
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
            再次点击「确认清除行情？」将清空日线、复权因子与交易日覆盖表。Token 与股票列表不会删除。
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
            <Button variant="outlined" onClick={() => void handleSaveToken()} disabled={!tokenInput.trim() || busy}>
              保存
            </Button>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom>
            更新窗口
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <TextField
              size="small"
              type="date"
              label="起始日"
              value={startIso}
              disabled
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small"
              type="date"
              label="截止日"
              value={endIso}
              onChange={(e) => setEndDate(isoToYyyymmdd(e.target.value))}
              disabled={busy}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { min: minEndIso, max: maxEndIso }
              }}
            />
            <Button
              variant="contained"
              startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
              onClick={() => void handleSync()}
              disabled={busy}
            >
              {syncing ? '更新中…' : '更新数据'}
            </Button>
            <Button
              color="warning"
              variant="outlined"
              onClick={() => void handleClear()}
              disabled={busy}
              startIcon={clearing ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {clearing ? '清除中…' : confirmClear ? '确认清除行情？' : '清除所有股票数据'}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            起始日锁定为 {MARKET_SYNC_START}。缩小截止日不会删除已下载数据；已完整的交易日会被跳过。
          </Typography>
        </Paper>

        {isEmpty && !loading ? (
          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              尚未拉取行情数据
            </Typography>
            <Typography variant="body2" color="text.secondary">
              将同步 A 股列表，并按交易日补齐 {MARKET_SYNC_START} 至 {endDate} 的全市场日线与复权因子。
            </Typography>
          </Paper>
        ) : (
          <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" gutterBottom>
              库内覆盖
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip size="small" variant="outlined" label={`起始 ${formatYmd(coverage?.min_date)}`} />
              <Chip size="small" variant="outlined" label={`截止 ${formatYmd(coverage?.max_date)}`} />
              <Chip size="small" variant="outlined" label={`股票 ${coverage?.stock_count ?? 0}`} />
              <Chip size="small" variant="outlined" label={`日线 ${coverage?.total_bars ?? 0} 行`} />
              <Chip size="small" variant="outlined" label={`完整交易日 ${coverage?.complete_days ?? 0}`} />
            </Stack>
          </Paper>
        )}

        <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom>
            板块只数（股票列表）
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
              尚无股票列表，更新数据后显示各板块只数。
            </Typography>
          )}
        </Paper>
      </Stack>
    </Box>
  )
}

import Alert from '@mui/material/Alert'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import RefreshIcon from '@mui/icons-material/Refresh'
import SyncIcon from '@mui/icons-material/Sync'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useEffect, useMemo, useState } from 'react'
import type { Stock } from '../../shared/types/stock'

function App(): React.JSX.Element {
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pythonReady, setPythonReady] = useState<string>('检测中…')
  const [hasToken, setHasToken] = useState(false)
  const [tokenMasked, setTokenMasked] = useState<string | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [tokenPanelOpen, setTokenPanelOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)

  const loadStocks = async (): Promise<void> => {
    const list = await window.api.stocks.list()
    setStocks(list)
  }

  const loadMeta = async (): Promise<void> => {
    const [ready, tokenConfigured, masked] = await Promise.all([
      window.api.python.ready(),
      window.api.config.hasTushareToken(),
      window.api.config.getTushareTokenMasked()
    ])
    setHasToken(tokenConfigured)
    setTokenMasked(masked)
    if (ready) {
      const importsOk = Object.values(ready.imports).every(Boolean)
      setPythonReady(importsOk ? `Python ${ready.python}` : '依赖未就绪')
      if (!importsOk) {
        setError(`Python import 失败：${JSON.stringify(ready.imports)}`)
      }
    } else {
      setPythonReady('未就绪')
    }
  }

  const refreshAll = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([loadStocks(), loadMeta()])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshAll()
  }, [])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) {
      return stocks
    }
    return stocks.filter(
      (s) =>
        s.ts_code.toLowerCase().includes(q) ||
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.industry ?? '').toLowerCase().includes(q) ||
        (s.market ?? '').toLowerCase().includes(q)
    )
  }, [stocks, filter])

  const pageRows = useMemo(() => {
    const start = page * rowsPerPage
    return filtered.slice(start, start + rowsPerPage)
  }, [filtered, page, rowsPerPage])

  useEffect(() => {
    setPage(0)
  }, [filter])

  const handleSaveToken = async (): Promise<void> => {
    setError(null)
    setMessage(null)
    try {
      await window.api.config.setTushareToken(tokenInput)
      setTokenInput('')
      setMessage('Token 已保存到本地配置')
      await loadMeta()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleSync = async (): Promise<void> => {
    setSyncing(true)
    setError(null)
    setMessage(null)
    try {
      const result = await window.api.stocks.sync()
      setMessage(`同步完成：拉取 ${result.fetched} 条，写入 ${result.count} 条`)
      await loadStocks()
      await loadMeta()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <AppBar position="static" elevation={0} color="transparent" sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ gap: 2, flexWrap: 'wrap', py: 1 }}>
          <Typography variant="h6" component="h1" fontWeight={700} sx={{ mr: 1 }}>
            Trading Zone
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
            onClick={() => setTokenPanelOpen((v) => !v)}
          />
          <Chip size="small" label={`${stocks.length} 只股票`} variant="outlined" />
          <Box sx={{ flexGrow: 1 }} />
          <TextField
            size="small"
            placeholder="搜索代码 / 名称 / 行业"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            sx={{ width: 220 }}
          />
          <IconButton aria-label="刷新" onClick={() => void refreshAll()} disabled={loading || syncing}>
            <RefreshIcon />
          </IconButton>
          <Button
            variant="contained"
            startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
            onClick={() => void handleSync()}
            disabled={syncing || loading}
          >
            {syncing ? '同步中…' : '同步股票列表'}
          </Button>
          <IconButton
            aria-label="Token 设置"
            onClick={() => setTokenPanelOpen((v) => !v)}
            size="small"
          >
            {tokenPanelOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Toolbar>
        {(loading || syncing) && <LinearProgress />}
      </AppBar>

      <Collapse in={tokenPanelOpen}>
        <Paper square elevation={0} sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
              Tushare Token
            </Typography>
            <TextField
              size="small"
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="写入 userData；也可设环境变量 TUSHARE_TOKEN"
              fullWidth
            />
            <Button variant="outlined" onClick={() => void handleSaveToken()} disabled={!tokenInput.trim()}>
              保存
            </Button>
          </Stack>
        </Paper>
      </Collapse>

      <Box sx={{ px: 2, pt: 1.5 }}>
        <Stack spacing={1}>
          {message ? <Alert severity="success" onClose={() => setMessage(null)}>{message}</Alert> : null}
          {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}
        </Stack>
      </Box>

      <TableContainer component={Paper} elevation={0} sx={{ flex: 1, mx: 2, my: 1.5, border: 1, borderColor: 'divider' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>代码</TableCell>
              <TableCell>名称</TableCell>
              <TableCell>行业</TableCell>
              <TableCell>市场</TableCell>
              <TableCell>上市日期</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  {loading
                    ? '加载中…'
                    : filter
                      ? '无匹配结果'
                      : '暂无股票数据，请配置 Token 后点击「同步股票列表」'}
                </TableCell>
              </TableRow>
            ) : (
              pageRows.map((row) => (
                <TableRow key={row.ts_code} hover>
                  <TableCell>{row.ts_code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.industry ?? '—'}</TableCell>
                  <TableCell>{row.market ?? '—'}</TableCell>
                  <TableCell>{row.list_date ?? '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={filtered.length}
        page={page}
        onPageChange={(_, next) => setPage(next)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10))
          setPage(0)
        }}
        rowsPerPageOptions={[25, 50, 100, 200]}
        labelRowsPerPage="每页"
      />
    </Box>
  )
}

export default App

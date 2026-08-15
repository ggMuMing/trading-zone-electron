import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useCallback, useEffect, useState } from 'react'
import {
  MARKET_SYNC_START,
  todayYyyymmdd
} from '../../../shared/constants/market'
import type { AdjustType, MarketCoverageResult, MarketPoolItem, OhlcvBar } from '../../../shared/types/market'

function formatNum(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—'
  }
  return value.toFixed(digits)
}

export function MarketPage(): React.JSX.Element {
  const [loading, setLoading] = useState(true)
  const [querying, setQuerying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pool, setPool] = useState<MarketPoolItem[]>([])
  const [coverage, setCoverage] = useState<MarketCoverageResult | null>(null)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [adjust, setAdjust] = useState<AdjustType>('none')
  const [bars, setBars] = useState<OhlcvBar[]>([])
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)

  const loadPoolAndCoverage = async (): Promise<void> => {
    const [poolItems, cov] = await Promise.all([
      window.api.market.pool(),
      window.api.market.coverage()
    ])
    setPool(poolItems)
    setCoverage(cov)
    setSelectedCode((prev) => {
      if (prev && poolItems.some((p) => p.ts_code === prev)) {
        return prev
      }
      return poolItems[0]?.ts_code ?? null
    })
  }

  const refreshAll = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      await loadPoolAndCoverage()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const queryEnd = coverage?.max_date || todayYyyymmdd()

  const loadBars = useCallback(async (tsCode: string, adj: AdjustType, endDate: string): Promise<void> => {
    setQuerying(true)
    setError(null)
    try {
      const result = await window.api.market.query({
        ts_code: tsCode,
        adjust: adj,
        start_date: MARKET_SYNC_START,
        end_date: endDate
      })
      setBars(result.bars)
      setPage(0)
    } catch (err: unknown) {
      setBars([])
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setQuerying(false)
    }
  }, [])

  useEffect(() => {
    void refreshAll()
  }, [])

  useEffect(() => {
    if (selectedCode) {
      void loadBars(selectedCode, adjust, queryEnd)
    } else {
      setBars([])
    }
  }, [selectedCode, adjust, queryEnd, loadBars])

  const isEmpty = pool.length === 0
  const pageRows = bars.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
  const selected = pool.find((p) => p.ts_code === selectedCode)

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}
      >
        <Typography variant="h6" fontWeight={700}>
          行情
        </Typography>
        <Chip
          size="small"
          variant="outlined"
          label={
            coverage
              ? `行情 ${coverage.total_bars} 行 / 池 ${pool.length}`
              : `池 ${pool.length}`
          }
        />
        <Chip
          size="small"
          variant="outlined"
          label={`${MARKET_SYNC_START}–${queryEnd}`}
        />
        <Box sx={{ flexGrow: 1 }} />
        <IconButton aria-label="刷新" onClick={() => void refreshAll()} disabled={loading || querying}>
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
              尚未准备股票池
            </Typography>
            <Typography variant="body2" color="text.secondary">
              请先到配置页更新数据。成功后会自动填入前 10 支股票供本页查看。
            </Typography>
          </Paper>
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', minHeight: 0, px: 2, py: 2, gap: 2 }}>
          <Paper
            elevation={0}
            sx={{
              width: 260,
              flexShrink: 0,
              border: 1,
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2">股票池（{pool.length}）</Typography>
            </Box>
            <List dense sx={{ flex: 1, overflow: 'auto', py: 0 }}>
              {pool.map((item) => (
                <ListItemButton
                  key={item.ts_code}
                  selected={item.ts_code === selectedCode}
                  onClick={() => setSelectedCode(item.ts_code)}
                >
                  <ListItemText
                    primary={`${item.rank}. ${item.name ?? item.ts_code}`}
                    secondary={item.ts_code}
                    primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Paper>

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
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ sm: 'center' }}
              sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
            >
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                {selected
                  ? `${selected.name ?? selected.ts_code}（${selected.ts_code}）日线`
                  : '请选择股票'}
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={adjust}
                onChange={(_e, value: AdjustType | null) => {
                  if (value) {
                    setAdjust(value)
                  }
                }}
                disabled={!selectedCode || querying}
              >
                <ToggleButton value="none">未复权</ToggleButton>
                <ToggleButton value="qfq">前复权</ToggleButton>
                <ToggleButton value="hfq">后复权</ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            <TableContainer sx={{ flex: 1 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>日期</TableCell>
                    <TableCell align="right">开</TableCell>
                    <TableCell align="right">高</TableCell>
                    <TableCell align="right">低</TableCell>
                    <TableCell align="right">收</TableCell>
                    <TableCell align="right">量</TableCell>
                    <TableCell align="right">额</TableCell>
                    <TableCell align="right">因子</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!selectedCode ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        请从左侧选择股票
                      </TableCell>
                    </TableRow>
                  ) : pageRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        {querying || loading ? '加载中…' : '暂无日线数据'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((row) => (
                      <TableRow key={`${row.ts_code}-${row.trade_date}`} hover>
                        <TableCell>{row.trade_date}</TableCell>
                        <TableCell align="right">{formatNum(row.open)}</TableCell>
                        <TableCell align="right">{formatNum(row.high)}</TableCell>
                        <TableCell align="right">{formatNum(row.low)}</TableCell>
                        <TableCell align="right">{formatNum(row.close)}</TableCell>
                        <TableCell align="right">{formatNum(row.vol, 0)}</TableCell>
                        <TableCell align="right">{formatNum(row.amount, 0)}</TableCell>
                        <TableCell align="right">{formatNum(row.adj_factor, 4)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={bars.length}
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
          </Paper>
        </Box>
      )}
    </Box>
  )
}

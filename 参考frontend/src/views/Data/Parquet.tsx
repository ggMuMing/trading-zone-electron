import { useEffect, useMemo, useState } from 'react'
import {
  Autocomplete,
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { getParquetColumns, getParquetPage, getStockListByFilter } from '../../api/api'
import type { ParquetColumn, Stock } from '../../api/apiType'

function ParquetView() {
  const [adjust, setAdjust] = useState<'qfq' | 'hfq'>('qfq')
  const [stockOptions, setStockOptions] = useState<Stock[]>([])
  const [stockLoading, setStockLoading] = useState(false)
  const [stockInput, setStockInput] = useState('')
  const [stockValue, setStockValue] = useState<Stock | null>(null)
  const symbol = stockValue?.symbol ?? ''
  const [columns, setColumns] = useState<ParquetColumn[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [count, setCount] = useState<number>(0)
  const [page, setPage] = useState<number>(0) // MUI uses 0-based
  const [pageSize, setPageSize] = useState<number>(50)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const visibleColumnNames = useMemo(() => columns.map(c => c.name), [columns])

  const load = async (nextPage0: number, nextPageSize: number) => {
    if (!symbol) {
      setColumns([])
      setRows([])
      setCount(0)
      return
    }
    setLoading(true)
    setError('')
    try {
      const schema = await getParquetColumns(symbol, adjust)
      setColumns(schema)
      const result = await getParquetPage(symbol, adjust, nextPage0 + 1, nextPageSize)
      setRows(result.data)
      setCount(result.count)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setRows([])
      setCount(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const normalized = stockInput.trim()
    const selectedLabel = stockValue ? `${stockValue.symbol}${stockValue.name ? ` - ${stockValue.name}` : ''}` : ''

    const handle = window.setTimeout(() => {
      ; (async () => {
        const cond = normalized
        if (!cond || cond === selectedLabel) {
          setStockOptions([])
          return
        }
        setStockLoading(true)
        try {
          const items = await getStockListByFilter(cond)
          if (!cancelled) setStockOptions(items)
        } finally {
          if (!cancelled) setStockLoading(false)
        }
      })()
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [stockInput, stockValue])

  useEffect(() => {
    load(0, pageSize)
    setPage(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, adjust])

  return (
    <Box sx={{ height: 'calc(100% - 44px)', padding: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginBottom: 1 }}>
        <Autocomplete
          sx={{ minWidth: 260, flex: 1 }}
          size="small"
          options={stockOptions}
          value={stockValue}
          inputValue={stockInput}
          onInputChange={(_, v) => setStockInput(v)}
          onChange={(_, v) => setStockValue(v)}
          filterOptions={(x) => x}
          loading={stockLoading}
          noOptionsText={stockInput.trim() ? '无匹配股票' : '输入代码/名称搜索'}
          getOptionLabel={(o) => `${o.symbol}${o.name ? ` - ${o.name}` : ''}`}
          renderInput={(params) => (
            <TextField
              {...params}
              label="股票"
              placeholder="输入代码/名称，例如 000001 / 平安"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {stockLoading ? <CircularProgress color="inherit" size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>复权</InputLabel>
          <Select
            label="复权"
            value={adjust}
            onChange={(e) => setAdjust(e.target.value as 'qfq' | 'hfq')}
          >
            <MenuItem value="qfq">前复权</MenuItem>
            <MenuItem value="hfq">后复权</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {error && (
        <Paper variant="outlined" sx={{ padding: 1, marginBottom: 1 }}>
          <Typography color="error" variant="body2">{error}</Typography>
        </Paper>
      )}

      <Paper variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!loading && rows.length === 0 && (

          <Box sx={{ padding: 1 }}>
            <Typography variant="body2" sx={{ opacity: 0.7 }}>暂无数据</Typography>
          </Box>

        )}
        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {visibleColumnNames.map((name) => (
                  <TableCell key={name} sx={{ whiteSpace: 'nowrap' }}>{name}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={`${page}-${i}`}>
                  {visibleColumnNames.map((name) => (
                    <TableCell key={name} sx={{ whiteSpace: 'nowrap' }}>
                      {r[name] == null ? '' : String(r[name])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={count}
          page={page}
          onPageChange={async (_e, nextPage) => {
            setPage(nextPage)
            await load(nextPage, pageSize)
          }}
          rowsPerPage={pageSize}
          onRowsPerPageChange={async (e) => {
            const next = parseInt(e.target.value, 10)
            setPageSize(next)
            setPage(0)
            await load(0, next)
          }}
          rowsPerPageOptions={[10, 25, 50, 100, 200]}
        />
      </Paper>
    </Box>
  )
}

export default ParquetView


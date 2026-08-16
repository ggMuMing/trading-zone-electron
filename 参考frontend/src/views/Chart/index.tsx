import GroupAddIcon from '@mui/icons-material/GroupAdd'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { Box, FormControl, MenuItem, Paper, Select, Typography } from '@mui/material'
import type { StockDailyData } from '../../api/apiType'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSnapshot } from 'valtio'
import { getStockDailyData, getChartLayout, getSelectedStrategies } from '../../api/api'
import ChartComponent from '../../components/ChartComponent/ChartComponent'
import { syncChartLayout, syncSelectedStrategies } from '../../components/ChartComponent/ChartComponentProxy'
import IndicatorSelectDialog from '../../components/ChartComponent/IndicatorSelectDialog'
import { StyledButton, SeperatorBox } from '../../components/styled'
import AddToStockGroupDialog from '../../components/ChartComponent/AddToStockGroupDialog'
import StockGroupSidebar from '../../components/ChartComponent/StockGroupSidebar'
import globalSymbolSearchState, { openSymbolSearch, setGlobalSelectedStock } from '../../state/globalSymbolSearchState'

export default function ChartView() {
  const [adjust, setAdjust] = useState<'qfq' | 'hfq' | 'standard'>('qfq')
  const { selectedStock: stockValue, selectedStockSource } = useSnapshot(globalSymbolSearchState)
  const symbol = stockValue?.symbol ?? ''
  const [chartData, setChartData] = useState<StockDailyData[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [isIndicatorSelectVisible, setIsIndicatorSelectVisible] = useState(false)
  const [autoOpenConfigInstanceId, setAutoOpenConfigInstanceId] = useState<string | null>(null)
  const [addToGroupOpen, setAddToGroupOpen] = useState(false)
  const [sidebarStocksRefreshKey, setSidebarStocksRefreshKey] = useState(0)

  const selectedStockLabel = useMemo(() => {
    if (!stockValue) return ''
    return `${stockValue.symbol}${stockValue.name ? ` - ${stockValue.name}` : ''}`
  }, [stockValue])

  const handleSelectStockFromSidebar = useCallback((stock: { symbol: string; name: string } | null) => {
    setGlobalSelectedStock(stock, 'sidebar')
  }, [])

  useEffect(() => {
    if (!symbol) {
      const timer = window.setTimeout(() => {
        setChartData([])
        setLoading(false)
        setError('')
      }, 0)
      return () => window.clearTimeout(timer)
    }
    let cancelled = false
      ; (async () => {
        setLoading(true)
        setError('')
        const rows = await getStockDailyData(symbol, adjust)
        if (!cancelled) setChartData(rows)
        if (!cancelled) setLoading(false)
      })()
    return () => {
      cancelled = true
    }
  }, [symbol, adjust])

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        const nextLayout = await getChartLayout()
        if (!cancelled) syncChartLayout(nextLayout)
      })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        const selected = await getSelectedStrategies()
        if (!cancelled) syncSelectedStrategies(selected)
      })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Paper variant='outlined' sx={{ height: 'calc(100%)', padding: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingTop: 0 }}>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
        <StockGroupSidebar
          selectedSymbol={symbol}
          selectionSource={selectedStockSource}
          stocksRefreshKey={sidebarStocksRefreshKey}
          onSelectStock={handleSelectStockFromSidebar}
        />
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Paper variant="outlined" sx={{ margin: '5px 0', padding: '5px 2px', flexShrink: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StyledButton
                size="small"
                onClick={() => {
                  openSymbolSearch()
                }}
                sx={{
                  flex: '0 1 auto',
                  width: 'fit-content',
                  minWidth: 150,
                  maxWidth: 520,
                  height: '32px',
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  fontSize: 15,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  px: 1.25,
                  '& .MuiButton-startIcon': { mr: 1 },
                  '& .MuiButton-endIcon': { ml: 1 },
                  '& .MuiButton-iconSizeSmall': { fontSize: 18 },
                  '& .MuiButton-sizeSmall': { height: 32 },
                  '& > span': {
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100%',
                  },
                }}
              >
                {selectedStockLabel || '选择股票'}
              </StyledButton>

              <SeperatorBox />

              <FormControl
                size="small"
                sx={{
                  minWidth: 0,
                  '& .MuiInputBase-root': {
                    height: 32,
                    color: 'var(--c-texPri)',
                    fontSize: 14,
                    backgroundColor: 'transparent',
                    borderRadius: '6px',
                    transition: 'background-color 120ms ease',
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    border: 'none',
                  },
                  '&:hover .MuiInputBase-root': {
                    backgroundColor: 'var(--ca-sidIteSelBac)',
                  },
                  '& .MuiSelect-select': {
                    padding: '4px 22px 4px 8px',
                    display: 'flex',
                    alignItems: 'center',
                  },
                  '& .MuiSelect-icon': {
                    color: 'var(--c-texSec)',
                    right: 2,
                    fontSize: 18,
                  },
                }}
              >
                <Select
                  value={adjust}
                  onChange={(e) => setAdjust(e.target.value as 'qfq' | 'hfq' | 'standard')}
                  MenuProps={{
                    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
                    transformOrigin: { vertical: 'top', horizontal: 'left' },
                    PaperProps: {
                      sx: {
                        mt: '2px',
                        backgroundColor: 'var(--c-bacEle)',
                        border: '1px solid var(--c-borPri)',
                        borderRadius: '6px',
                        boxShadow: 'var(--c-shaSM)',
                        overflow: 'hidden',
                        '& .MuiList-root': { padding: '4px' },
                        '& .MuiMenuItem-root': {
                          fontSize: 14,
                          color: 'var(--c-texPri)',
                          padding: '6px 10px 6px 26px',
                          minHeight: 30,
                          borderRadius: '4px',
                          position: 'relative',
                          '&:hover': {
                            backgroundColor: 'var(--ca-sidIteSelBac)',
                          },
                          '&.Mui-selected': {
                            backgroundColor: 'transparent',
                            fontWeight: 600,
                            '&:hover': { backgroundColor: 'var(--ca-sidIteSelBac)' },
                            '&::before': {
                              content: '"\\2713"',
                              position: 'absolute',
                              left: 8,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              color: 'var(--c-texPri)',
                              fontSize: 12,
                              lineHeight: 1,
                            },
                          },
                        },
                      },
                    },
                  }}
                  sx={{
                    fontWeight: 500,
                    fontSize: '15px',
                  }}
                >
                  <MenuItem value="qfq">前复权</MenuItem>
                  <MenuItem value="standard">不复权</MenuItem>
                  <MenuItem value="hfq">后复权</MenuItem>
                </Select>
              </FormControl>

              <SeperatorBox />

              <StyledButton
                startIcon={<GroupAddIcon />}
                size="small"
                sx={{ height: '32px' }}
                disabled={!stockValue?.symbol}
                onClick={() => setAddToGroupOpen(true)}
              >
                加入分组
              </StyledButton>

              <SeperatorBox />

              <StyledButton
                startIcon={<TrendingUpIcon />}
                size="small"
                sx={{ height: '32px' }}
                onClick={() => {
                  setIsIndicatorSelectVisible(true)
                }}
              >
                Indicators
              </StyledButton>
            </Box>
          </Paper>

          {error && (
            <Paper variant="outlined" sx={{ padding: 1, marginBottom: 1, flexShrink: 0 }}>
              <Typography color="error" variant="body2">{error}</Typography>
            </Paper>
          )}

          <Paper
            variant="outlined"
            sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            {(!loading && chartData.length === 0) ? (
              <Box sx={{ padding: 1 }}>
                <Typography variant="body2" sx={{ opacity: 0.7 }}>暂无数据</Typography>
              </Box>
            ) : (
              <Box sx={{ flex: 1, minHeight: 0, opacity: loading ? 0.7 : 1 }}>
                <ChartComponent
                  chartData={chartData}
                  stockCode={symbol}
                  adjust={adjust}
                  openIndicatorsConfig={(instanceId) => {
                    setAutoOpenConfigInstanceId(instanceId)
                    setIsIndicatorSelectVisible(true)
                  }}
                />
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      <AddToStockGroupDialog
        open={addToGroupOpen}
        onClose={() => setAddToGroupOpen(false)}
        stock={stockValue}
        onAdded={() => setSidebarStocksRefreshKey((key) => key + 1)}
      />
      <IndicatorSelectDialog
        isOpen={isIndicatorSelectVisible}
        autoOpenConfigForInstanceId={autoOpenConfigInstanceId}
        configOnly={Boolean(autoOpenConfigInstanceId)}
        onClose={() => {
          setIsIndicatorSelectVisible(false)
          setAutoOpenConfigInstanceId(null)
        }}
      />
    </Paper>
  )
}


import Box from '@mui/material/Box'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useMemo, useRef, useState } from 'react'
import {
  CHART_UNIVERSE_ALL,
  CHART_UNIVERSE_INDEX_BROAD,
  CHART_UNIVERSE_INDEX_MARKET,
  CHART_UNIVERSE_OPTIONS
} from '../../../shared/constants/chartUniverse'
import type { Stock } from '../../../shared/types/stock'

const ROW_HEIGHT = 60

function matchesStock(stock: Stock, query: string): boolean {
  return (
    stock.ts_code.toLowerCase().includes(query) ||
    stock.symbol.toLowerCase().includes(query) ||
    stock.name.toLowerCase().includes(query)
  )
}

interface StockPickerProps {
  stocks: Stock[]
  selectedCode: string | null
  width: number
  onSelect: (tsCode: string) => void
  universeId?: string
  universeCaption?: string | null
  emptyHint?: string | null
  onUniverseChange?: (universeId: string) => void
}

export function StockPicker({
  stocks,
  selectedCode,
  width,
  universeId = CHART_UNIVERSE_ALL,
  universeCaption,
  emptyHint,
  onSelect,
  onUniverseChange
}: StockPickerProps): React.JSX.Element {
  const universeEnabled = Boolean(onUniverseChange)
  const [keyword, setKeyword] = useState('')
  const parentRef = useRef<HTMLDivElement>(null)
  const query = keyword.trim().toLowerCase()

  const filtered = useMemo(
    () => (query ? stocks.filter((stock) => matchesStock(stock, query)) : stocks),
    [stocks, query]
  )

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8
  })

  return (
    <Paper
      elevation={0}
      sx={{
        width,
        flexShrink: 0,
        border: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ px: universeEnabled ? 1.5 : 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        {universeEnabled ? (
          <Select
            size="small"
            fullWidth
            value={universeId}
            onChange={(event) => onUniverseChange?.(String(event.target.value))}
            renderValue={(value) => {
              const option = CHART_UNIVERSE_OPTIONS.find((item) => item.id === value)
              return option?.label ?? value
            }}
          >
            <MenuItem value={CHART_UNIVERSE_ALL}>全市场</MenuItem>
            <ListSubheader disableSticky>指数行情</ListSubheader>
            <MenuItem value={CHART_UNIVERSE_INDEX_MARKET}>大盘指数</MenuItem>
            <MenuItem value={CHART_UNIVERSE_INDEX_BROAD}>宽基指数</MenuItem>
            <ListSubheader disableSticky>成分股</ListSubheader>
            {CHART_UNIVERSE_OPTIONS.filter((item) => item.kind === 'constituents').map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.label}
              </MenuItem>
            ))}
          </Select>
        ) : (
          <Typography variant="subtitle2">
            股票（{filtered.length} / {stocks.length}）
          </Typography>
        )}
        {universeEnabled ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            {filtered.length} / {stocks.length}
            {universeCaption ? ` · 快照 ${universeCaption}` : ''}
          </Typography>
        ) : null}
      </Box>
      <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          size="small"
          fullWidth
          autoComplete="off"
          placeholder="代码 / 名称"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </Box>
      {filtered.length === 0 ? (
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 2
          }}
        >
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {emptyHint ?? (query ? '无匹配股票' : '列表为空')}
          </Typography>
        </Box>
      ) : (
        <Box ref={parentRef} sx={{ flex: 1, overflow: 'auto' }}>
          <Box
            sx={{
              height: virtualizer.getTotalSize(),
              width: '100%',
              position: 'relative'
            }}
          >
            {virtualizer.getVirtualItems().map((row) => {
              const item = filtered[row.index]
              if (!item) {
                return null
              }
              return (
                <ListItemButton
                  key={item.ts_code}
                  dense
                  selected={item.ts_code === selectedCode}
                  onClick={() => onSelect(item.ts_code)}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: row.size,
                    transform: `translateY(${row.start}px)`
                  }}
                >
                  <ListItemText
                    primary={item.name || item.ts_code}
                    secondary={item.ts_code}
                    primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItemButton>
              )
            })}
          </Box>
        </Box>
      )}
    </Paper>
  )
}

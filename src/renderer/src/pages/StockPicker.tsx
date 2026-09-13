import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CHART_UNIVERSE_ALL,
  parseIndustryIndexCode,
  resolveUniverseLabel
} from '../../../shared/constants/chartUniverse'
import type { Stock } from '../../../shared/types/stock'
import { UniversePickerDialog } from './chart/UniversePickerDialog'

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
  const [pickerOpen, setPickerOpen] = useState(false)
  const [industryNames, setIndustryNames] = useState<Map<string, string>>(new Map())
  const parentRef = useRef<HTMLDivElement>(null)
  const query = keyword.trim().toLowerCase()

  useEffect(() => {
    if (!universeEnabled || !parseIndustryIndexCode(universeId)) {
      return
    }
    let cancelled = false
    void window.api.industry
      .tree()
      .then((rows) => {
        if (cancelled) {
          return
        }
        setIndustryNames(new Map(rows.map((row) => [row.index_code, row.name])))
      })
      .catch(() => {
        if (!cancelled) {
          setIndustryNames(new Map())
        }
      })
    return () => {
      cancelled = true
    }
  }, [universeEnabled, universeId])

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
          <>
            <Button
              size="small"
              fullWidth
              variant="outlined"
              endIcon={<ArrowDropDownIcon />}
              onClick={() => setPickerOpen(true)}
              sx={{ justifyContent: 'space-between', textTransform: 'none' }}
            >
              <Typography variant="body2" noWrap>
                {resolveUniverseLabel(universeId, industryNames)}
              </Typography>
            </Button>
            <UniversePickerDialog
              open={pickerOpen}
              universeId={universeId}
              onClose={() => setPickerOpen(false)}
              onSelect={(nextId) => onUniverseChange?.(nextId)}
            />
          </>
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

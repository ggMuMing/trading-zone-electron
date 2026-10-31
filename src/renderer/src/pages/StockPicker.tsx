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
  parseGroupId,
  parseIndustryIndexCode,
  resolveUniverseLabel
} from '../../../shared/constants/chartUniverse'
import type { Stock } from '../../../shared/types/stock'
import { UniversePickerDialog } from './chart/UniversePickerDialog'
import { matchesStockQuery, pinyinInitials } from './stockMatch'

const ROW_HEIGHT = 60

interface StockPickerProps {
  stocks: Stock[]
  selectedCode: string | null
  width: number
  onSelect: (tsCode: string) => void
  universeId?: string
  universeCaption?: string | null
  emptyHint?: string | null
  /** 为 true 时列表只显示名称，不显示代码。 */
  hideCode?: boolean
  onUniverseChange?: (universeId: string) => void
  showSearch?: boolean
}

export function StockPicker({
  stocks,
  selectedCode,
  width,
  universeId = CHART_UNIVERSE_ALL,
  universeCaption,
  emptyHint,
  hideCode = false,
  onSelect,
  onUniverseChange,
  showSearch = true
}: StockPickerProps): React.JSX.Element {
  const universeEnabled = Boolean(onUniverseChange)
  const [keyword, setKeyword] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [industryNames, setIndustryNames] = useState<Map<string, string>>(new Map())
  const [groupNames, setGroupNames] = useState<Map<string, string>>(new Map())
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

  useEffect(() => {
    if (!universeEnabled || !parseGroupId(universeId)) {
      return
    }
    let cancelled = false
    void window.api.symbolGroup
      .tree()
      .then((result) => {
        if (cancelled) {
          return
        }
        const names = new Map<string, string>()
        for (const group of result.uncategorized) {
          names.set(group.id, group.name)
        }
        for (const category of result.categories) {
          for (const group of category.groups) {
            names.set(group.id, group.name)
          }
        }
        setGroupNames(names)
      })
      .catch(() => {
        if (!cancelled) {
          setGroupNames(new Map())
        }
      })
    return () => {
      cancelled = true
    }
  }, [universeEnabled, universeId])

  const initialsByCode = useMemo(() => {
    const map = new Map<string, string>()
    for (const stock of stocks) {
      map.set(stock.ts_code, pinyinInitials(stock.name))
    }
    return map
  }, [stocks])

  const filtered = useMemo(
    () =>
      query
        ? stocks.filter((stock) =>
            matchesStockQuery(stock, query, initialsByCode.get(stock.ts_code) ?? '')
          )
        : stocks,
    [stocks, query, initialsByCode]
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
      {universeEnabled ? (
        <Box sx={{ px: 1.5, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Button
            size="small"
            fullWidth
            variant="outlined"
            endIcon={<ArrowDropDownIcon />}
            onClick={() => setPickerOpen(true)}
            sx={{ justifyContent: 'space-between', textTransform: 'none' }}
          >
            <Typography variant="body2" noWrap>
              {resolveUniverseLabel(universeId, industryNames, groupNames)}
            </Typography>
          </Button>
          <UniversePickerDialog
            open={pickerOpen}
            universeId={universeId}
            onClose={() => setPickerOpen(false)}
            onSelect={(nextId) => onUniverseChange?.(nextId)}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            {filtered.length} / {stocks.length}
            {universeCaption ? ` · 快照 ${universeCaption}` : ''}
          </Typography>
        </Box>
      ) : showSearch ? (
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2">
            股票（{filtered.length} / {stocks.length}）
          </Typography>
        </Box>
      ) : null}
      {showSearch ? (
        <Box sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            size="small"
            fullWidth
            autoComplete="off"
            placeholder="代码 / 名称 / 首字母"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </Box>
      ) : null}
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
                    primary={item.name || (hideCode ? '' : item.ts_code)}
                    secondary={hideCode ? undefined : item.ts_code}
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

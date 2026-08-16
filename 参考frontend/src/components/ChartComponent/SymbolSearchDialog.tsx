import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ClearIcon from '@mui/icons-material/Clear'
import SearchIcon from '@mui/icons-material/Search'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import type { StockSymbolSearchItem } from '../../api/apiType'
import { searchStockSymbols } from '../../api/api'

export type SymbolSearchAssetTag = 'all' | 'stocks'

type SymbolSearchDialogProps = {
  open: boolean
  onClose: () => void
  /** 从键盘打开时带入的首字符 */
  initialQuery?: string
  onSelect: (item: StockSymbolSearchItem) => void
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</>
  const lowerText = text.toLowerCase()
  const lowerQ = q.toLowerCase()
  const idx = lowerText.indexOf(lowerQ)
  if (idx < 0) return <>{text}</>
  const before = text.slice(0, idx)
  const mid = text.slice(idx, idx + q.length)
  const after = text.slice(idx + q.length)
  return (
    <>
      {before}
      <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
        {mid}
      </Box>
      {after}
    </>
  )
}

function EmptyState({
  icon,
  text,
}: {
  icon: React.ReactNode
  text: string
}) {
  return (
    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
      <Stack spacing={1.25} alignItems="center" sx={{ opacity: 0.8 }}>
        <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, textAlign: 'center', color: 'text.secondary' }}>
          {text}
        </Typography>
      </Stack>
    </Box>
  )
}

export default function SymbolSearchDialog(props: SymbolSearchDialogProps) {
  const { open, onClose, initialQuery = '', onSelect } = props
  const [query, setQuery] = useState('')
  const [assetTag, setAssetTag] = useState<SymbolSearchAssetTag>('all')
  const [results, setResults] = useState<StockSymbolSearchItem[]>([])
  const [loading, setLoading] = useState(false)
  /** 键盘高亮行；null 表示未选中任何一行（与鼠标点击无关） */
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null)
  const highlightIndexRef = useRef<number | null>(null)
  const itemRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    highlightIndexRef.current = highlightIndex
  }, [highlightIndex])

  useEffect(() => {
    if (!open) return
    setQuery(initialQuery)
    setAssetTag('all')
    setHighlightIndex(null)
  }, [open, initialQuery])

  useEffect(() => {
    setHighlightIndex(null)
  }, [results])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    let cancelled = false
    const handle = window.setTimeout(() => {
      ; (async () => {
        setLoading(true)
        try {
          const items = await searchStockSymbols(q, assetTag)
          if (!cancelled) setResults(items)
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [open, query, assetTag])

  const handlePick = useCallback(
    (item: StockSymbolSearchItem) => {
      onSelect(item)
      onClose()
    },
    [onSelect, onClose],
  )

  useEffect(() => {
    if (highlightIndex === null) return
    const el = itemRefs.current[highlightIndex]
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex])

  const onSearchFieldKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowDown' && results.length > 0) {
        e.preventDefault()
        setHighlightIndex((prev) => {
          if (prev === null) return 0
          return prev < results.length - 1 ? prev + 1 : prev
        })
        return
      }
      if (e.key === 'ArrowUp' && results.length > 0) {
        const prev = highlightIndexRef.current
        if (prev === null) return
        e.preventDefault()
        setHighlightIndex(prev <= 0 ? null : prev - 1)
        return
      }
      if (e.key === 'Enter') {
        const prev = highlightIndexRef.current
        if (prev === null || !results[prev]) return
        e.preventDefault()
        handlePick(results[prev])
      }
    },
    [results, handlePick],
  )

  const trimmedQuery = query.trim()

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        <Typography component="span" variant="h6">
          标的搜索
        </Typography>
        <IconButton aria-label="关闭" onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 0, display: 'flex', flexDirection: 'column', gap: 1, minHeight: 180, height: 500, paddingLeft: 0, paddingRight: 0 }}>
        <Box sx={{ overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ paddingLeft: '24px', paddingRight: '24px' }}>
            <TextField
              autoFocus
              fullWidth
              size="small"
              placeholder="输入代码、名称或拼音缩写"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchFieldKeyDown}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ opacity: 0.7 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    {loading ? <CircularProgress color="inherit" size={18} /> : null}
                    {query ? (
                      <IconButton
                        aria-label="清除"
                        size="small"
                        onClick={() => {
                          setQuery('')
                          setResults([])
                        }}
                      >
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </InputAdornment>
                ),
              }}
            />

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap marginTop={2} marginBottom={1.5}>
              <Chip
                label="All"
                size="small"
                color={assetTag === 'all' ? 'primary' : 'default'}
                onClick={() => setAssetTag('all')}
                variant={assetTag === 'all' ? 'filled' : 'outlined'}
              />
              <Chip
                label="Stocks"
                size="small"
                color={assetTag === 'stocks' ? 'primary' : 'default'}
                onClick={() => setAssetTag('stocks')}
                variant={assetTag === 'stocks' ? 'filled' : 'outlined'}
              />
            </Stack>
          </Box>
          <Box sx={{ height: '390px', overflow: 'auto' }}>
            {!trimmedQuery ? (
              <EmptyState icon={<SearchIcon sx={{ fontSize: 44 }} />} text="输入关键字以搜索" />
            ) : results.length === 0 && !loading ? (
              <EmptyState icon={<SearchOffIcon sx={{ fontSize: 44 }} />} text="无匹配标的" />
            ) : (
              <List dense disablePadding>
                {results.map((row, index) => (
                  <ListItemButton
                    key={row.symbol}
                    selected={highlightIndex === index}
                    ref={(el) => {
                      itemRefs.current[index] = el
                    }}
                    onClick={() => handlePick(row)}
                    disableRipple
                    disableTouchRipple
                    sx={{
                      alignItems: 'flex-start',
                      py: 1,
                      paddingLeft: '24px',
                      paddingRight: '24px',
                      transition: 'none',
                    }}
                  >
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, width: '100%', alignItems: 'baseline' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 72 }}>
                        <HighlightMatch text={row.symbol} query={trimmedQuery} />
                      </Typography>
                      <Typography variant="body2" sx={{ flex: '1 1 140px', minWidth: 0 }}>
                        <HighlightMatch text={row.name} query={trimmedQuery} />
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.75, minWidth: 0 }}>
                        {row.industry ?? '—'}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.85, whiteSpace: 'nowrap' }}>
                        {row.type === 'stock' ? '股票' : row.type}
                      </Typography>

                    </Box>
                  </ListItemButton>
                ))}
              </List>
            )}
          </Box>
        </Box>
      </DialogContent>
    </Dialog >
  )
}

import CloseIcon from '@mui/icons-material/Close'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { useEffect, useRef, useState } from 'react'
import type { DashboardBar } from '../../../../../shared/types/dashboard'
import type { HeatmapStockTile } from '../../../../../shared/types/heatmap'
import { DOWN_COLOR, UP_COLOR, formatPct } from '../format'
import { MiniKline } from '../MiniKline'
import type { HeatmapLayoutStock } from './heatmapPaint'

const CARD_WIDTH = 440
const CARD_HEIGHT = 520

export function HeatmapHoverCard({
  stock,
  peers,
  asOf,
  hostWidth,
  hostHeight,
  onClose
}: {
  stock: HeatmapLayoutStock
  peers: HeatmapStockTile[]
  asOf: string
  hostWidth: number
  hostHeight: number
  onClose: () => void
}): React.JSX.Element {
  const [bars, setBars] = useState<DashboardBar[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const activeRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const place = placeCard(stock, hostWidth, hostHeight)
  const rows = [...peers].sort(byPctDesc)

  useEffect(() => {
    let cancelled = false
    setBars(null)
    setError(null)
    window.api.market
      .query({
        ts_code: stock.tsCode,
        adjust: 'none',
        start_date: shiftYears(asOf, -1),
        end_date: asOf
      })
      .then((result) => {
        if (cancelled) {
          return
        }
        setBars(
          result.bars.map((bar) => ({
            trade_date: bar.trade_date,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            pct_chg: bar.pct_chg,
            vol: bar.vol,
            amount: bar.amount
          }))
        )
      })
      .catch((reason: unknown) => {
        if (cancelled) {
          return
        }
        setBars([])
        setError(reason instanceof Error ? reason.message : 'K线读取失败')
      })
    return () => {
      cancelled = true
    }
  }, [asOf, stock.tsCode])

  useEffect(() => {
    const row = activeRef.current
    const list = listRef.current
    if (!row || !list) {
      return
    }
    const rowTop = row.offsetTop
    const rowBottom = rowTop + row.offsetHeight
    if (rowTop < list.scrollTop) {
      list.scrollTop = rowTop
    } else if (rowBottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = rowBottom - list.clientHeight
    }
  }, [stock.tsCode])

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'absolute',
        left: place.left,
        top: place.top,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        pointerEvents: 'auto'
      }}
    >
      <Box sx={{ height: 250, minHeight: 250, position: 'relative', zIndex: 0 }}>
        {bars ? <MiniKline bars={bars} /> : null}
        {bars === null ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            正在读取K线
          </Typography>
        ) : null}
        {error ? (
          <Typography
            variant="caption"
            color="error"
            sx={{ position: 'absolute', left: 8, right: 8, bottom: 6 }}
          >
            {error}
          </Typography>
        ) : null}
      </Box>
      <Box sx={{ px: 1.25, pt: 0.75, pb: 0.5, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.4 }}>
          {stock.name}
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
            {stock.tsCode}
          </Typography>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {stock.sectorName}
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 72px 72px',
          px: 1.25,
          py: 0.25,
          fontSize: 12,
          color: 'text.secondary'
        }}
      >
        <span>名称</span>
        <Box component="span" sx={{ textAlign: 'right' }}>
          价格
        </Box>
        <Box component="span" sx={{ textAlign: 'right' }}>
          涨跌幅
        </Box>
      </Box>
      <Box
        ref={listRef}
        sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 0.5, pb: 0.5, position: 'relative' }}
      >
        {rows.map((row) => {
          const active = row.ts_code === stock.tsCode
          return (
            <Box
              key={row.ts_code}
              ref={active ? activeRef : undefined}
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 72px 72px',
                px: 0.75,
                py: 0.25,
                fontSize: 12,
                lineHeight: '20px',
                borderRadius: 0.5,
                bgcolor: active ? 'action.selected' : 'transparent'
              }}
            >
              <Box
                component="span"
                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {row.name}
              </Box>
              <Box component="span" sx={{ textAlign: 'right' }}>
                {formatPrice(row.close)}
              </Box>
              <Box component="span" sx={{ textAlign: 'right', color: pctColor(row.pct_chg) }}>
                {formatPct(row.pct_chg)}
              </Box>
            </Box>
          )
        })}
      </Box>
      <IconButton
        aria-label="关闭"
        size="small"
        onClick={(event) => {
          event.stopPropagation()
          onClose()
        }}
        sx={{
          position: 'absolute',
          top: 6,
          right: 6,
          zIndex: 5,
          width: 28,
          height: 28,
          color: 'text.primary',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          boxShadow: 1,
          '&:hover': { bgcolor: 'action.hover' }
        }}
      >
        <CloseIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Paper>
  )
}

function placeCard(
  stock: HeatmapLayoutStock,
  hostWidth: number,
  hostHeight: number
): { left: number; top: number } {
  const gap = 8
  let left = stock.x + stock.width + gap
  if (left + CARD_WIDTH > hostWidth - 8) {
    left = stock.x - gap - CARD_WIDTH
  }
  if (left < 8) {
    left = Math.max(8, hostWidth - CARD_WIDTH - 8)
  }
  let top = stock.y
  if (top + CARD_HEIGHT > hostHeight - 8) {
    top = hostHeight - CARD_HEIGHT - 8
  }
  if (top < 8) {
    top = 8
  }
  return { left, top }
}

function byPctDesc(left: HeatmapStockTile, right: HeatmapStockTile): number {
  if (left.pct_chg == null && right.pct_chg == null) {
    return left.name.localeCompare(right.name, 'zh-CN')
  }
  if (left.pct_chg == null) {
    return 1
  }
  if (right.pct_chg == null) {
    return -1
  }
  if (right.pct_chg !== left.pct_chg) {
    return right.pct_chg - left.pct_chg
  }
  return left.name.localeCompare(right.name, 'zh-CN')
}

function formatPrice(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return '—'
  }
  return value.toFixed(2)
}

function pctColor(value: number | null): string | undefined {
  if (value == null || !Number.isFinite(value) || Math.abs(value) < 0.005) {
    return undefined
  }
  return value > 0 ? UP_COLOR : DOWN_COLOR
}

function shiftYears(yyyymmdd: string, years: number): string {
  const date = new Date(
    Number(yyyymmdd.slice(0, 4)),
    Number(yyyymmdd.slice(4, 6)) - 1,
    Number(yyyymmdd.slice(6, 8))
  )
  date.setFullYear(date.getFullYear() + years)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}${month}${day}`
}

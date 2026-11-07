import Box from '@mui/material/Box'
import { useEffect, useRef, useState } from 'react'
import type {
  HeatmapFocus,
  HeatmapIndustryLevel,
  HeatmapSector,
  HeatmapStockTile
} from '../../../../../shared/types/heatmap'
import { useColorMode } from '../../../theme/colorMode'
import { HeatmapHoverCard } from './HeatmapHoverCard'
import { paintHeatmap, type HeatmapLayoutStock, type HeatmapTitleAction } from './heatmapPaint'

export function HeatmapCanvas({
  sectors,
  focus,
  industryLevel,
  asOf,
  navEnabled,
  dimmed,
  onNavigate
}: {
  sectors: HeatmapSector[]
  focus: HeatmapFocus | null
  industryLevel: HeatmapIndustryLevel
  asOf: string | null
  navEnabled: boolean
  dimmed: boolean
  onNavigate: (action: HeatmapTitleAction) => void
}): React.JSX.Element {
  const { mode } = useColorMode()
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef<HeatmapLayoutStock[]>([])
  const actionRef = useRef<HeatmapTitleAction[]>([])
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [selected, setSelected] = useState<HeatmapLayoutStock | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) {
      return
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }
      setSize({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height)
      })
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || size.width < 2 || size.height < 2) {
      layoutRef.current = []
      actionRef.current = []
      return
    }
    const painted = paintHeatmap(
      canvas,
      size.width,
      size.height,
      sectors,
      focus,
      industryLevel,
      mode
    )
    layoutRef.current = painted.stocks
    actionRef.current = painted.actions
  }, [focus, industryLevel, mode, sectors, size.height, size.width])

  useEffect(() => {
    setSelected(null)
  }, [sectors, size.height, size.width])

  const peers = selected ? stocksInGroup(sectors, focus, selected.sectorCode) : []

  return (
    <Box
      ref={hostRef}
      sx={{ position: 'absolute', inset: 0, opacity: dimmed ? 0.55 : 1, cursor: 'pointer' }}
      onClick={(event) => {
        if (cardRef.current?.contains(event.target as Node)) {
          return
        }
        const host = hostRef.current
        if (!host) {
          return
        }
        const bounds = host.getBoundingClientRect()
        const x = event.clientX - bounds.left
        const y = event.clientY - bounds.top
        const action = findAction(actionRef.current, x, y)
        if (action) {
          if (navEnabled) {
            onNavigate(action)
          }
          return
        }
        const hit = findHit(layoutRef.current, x, y)
        if (!hit) {
          setSelected(null)
          return
        }
        setSelected((current) => (current?.tsCode === hit.tsCode ? null : hit))
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', pointerEvents: 'none' }} />
      {selected ? (
        <Box
          sx={{
            position: 'absolute',
            left: selected.x,
            top: selected.y,
            width: selected.width,
            height: selected.height,
            boxSizing: 'border-box',
            border: '2px solid',
            borderColor: 'common.white',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.55)',
            pointerEvents: 'none',
            zIndex: 1
          }}
        />
      ) : null}
      {selected && asOf ? (
        <Box ref={cardRef}>
          <HeatmapHoverCard
            stock={selected}
            peers={peers}
            asOf={asOf}
            hostWidth={size.width}
            hostHeight={size.height}
            onClose={() => setSelected(null)}
          />
        </Box>
      ) : null}
    </Box>
  )
}

function stocksInGroup(
  sectors: HeatmapSector[],
  focus: HeatmapFocus | null,
  code: string
): HeatmapStockTile[] {
  if (focus && focus.code === code && focus.stocks.length > 0) {
    return focus.stocks
  }
  for (const sector of sectors) {
    if (sector.code === code) {
      return sector.stocks.length > 0 ? sector.stocks : flattenStocks(sector.children)
    }
    const child = sector.children.find((item) => item.code === code)
    if (child) {
      return child.stocks
    }
  }
  return []
}

function flattenStocks(sectors: HeatmapSector[]): HeatmapStockTile[] {
  const stocks: HeatmapStockTile[] = []
  for (const sector of sectors) {
    stocks.push(...(sector.children.length > 0 ? flattenStocks(sector.children) : sector.stocks))
  }
  return stocks
}

function findAction(
  actions: HeatmapTitleAction[],
  x: number,
  y: number
): HeatmapTitleAction | null {
  return actions.find((action) => contains(action, x, y)) ?? null
}

function findHit(stocks: HeatmapLayoutStock[], x: number, y: number): HeatmapLayoutStock | null {
  for (let index = stocks.length - 1; index >= 0; index -= 1) {
    const stock = stocks[index]
    if (contains(stock, x, y)) {
      return stock
    }
  }
  return null
}

function contains(
  rect: { x: number; y: number; width: number; height: number },
  x: number,
  y: number
): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
}

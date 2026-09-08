import Add from '@mui/icons-material/Add'
import Box from '@mui/material/Box'
import Popover from '@mui/material/Popover'
import Slider from '@mui/material/Slider'
import Typography from '@mui/material/Typography'
import { useMemo, useRef, useState } from 'react'
import type { LineWidth } from '../../../../shared/types/chartLayout'

const LINE_WIDTHS: LineWidth[] = [1, 2, 3, 4]
const SWATCH = 16
const COLS = 12
const LINE_MARK_WIDTH = 18
const LINE_MARK_PX: Record<LineWidth, number> = { 1: 1, 2: 2, 3: 3, 4: 4 }

function lineMarkHeight(width: LineWidth): string {
  return `${LINE_MARK_PX[width]}px`
}

function LineWidthMark({
  width,
  color
}: {
  width: LineWidth
  color: string
}): React.JSX.Element {
  return (
    <Box
      sx={{
        width: LINE_MARK_WIDTH,
        height: lineMarkHeight(width),
        bgcolor: color,
        borderRadius: 0
      }}
    />
  )
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const light = l / 100
  const a = sat * Math.min(light, 1 - light)
  const channel = (n: number): number => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (light - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))
  }
  return `#${[channel(0), channel(8), channel(4)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase()
}

function buildPalette(): string[] {
  const grays = Array.from({ length: COLS }, (_, index) => {
    const light = 100 - (index * 100) / (COLS - 1)
    return hslToHex(0, 0, light)
  })
  const hues = [0, 18, 32, 48, 70, 120, 160, 190, 220, 255, 290, 330]
  const lights = [88, 74, 60, 48, 36, 24, 14]
  const rows = lights.map((light) => hues.map((hue) => hslToHex(hue, 78, light)))
  return [...grays, ...rows.flat()]
}

const PALETTE = buildPalette()

const CHECKER = `linear-gradient(45deg, #bbb 25%, transparent 25%),
  linear-gradient(-45deg, #bbb 25%, transparent 25%),
  linear-gradient(45deg, transparent 75%, #bbb 75%),
  linear-gradient(-45deg, transparent 75%, #bbb 75%)`

function normalizeHex(value: string): string {
  const raw = value.trim()
  const short = /^#([0-9a-fA-F]{3})$/.exec(raw)
  if (short) {
    const [r, g, b] = short[1].split('')
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  const hex = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(raw)
  if (hex) {
    return `#${hex[1]}`.toUpperCase()
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(raw)
  if (rgb) {
    return `#${[rgb[1], rgb[2], rgb[3]]
      .map((part) => Number(part).toString(16).padStart(2, '0'))
      .join('')}`.toUpperCase()
  }
  return raw.toUpperCase()
}

function parseOpacity(value: string): number {
  const hex = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/.exec(value.trim())
  if (hex) {
    return Math.round((Number.parseInt(hex[2], 16) / 255) * 100)
  }
  const rgba = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([0-9.]+)\s*\)/i.exec(value.trim())
  if (rgba) {
    return Math.round(Math.min(1, Math.max(0, Number(rgba[1]))) * 100)
  }
  return 100
}

function withOpacity(hexRgb: string, opacity: number): string {
  const base = normalizeHex(hexRgb)
  const rgb = /^#([0-9a-fA-F]{6})$/.exec(base)
  if (!rgb) {
    return hexRgb
  }
  if (opacity >= 100) {
    return `#${rgb[1]}`.toUpperCase()
  }
  const alpha = Math.round((Math.min(100, Math.max(0, opacity)) / 100) * 255)
    .toString(16)
    .padStart(2, '0')
  return `#${rgb[1]}${alpha}`.toUpperCase()
}

function previewColor(value: string): string {
  const hex = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(value.trim())
  if (hex) {
    if (!hex[2]) {
      return `#${hex[1]}`
    }
    const alpha = Number.parseInt(hex[2], 16) / 255
    const r = Number.parseInt(hex[1].slice(0, 2), 16)
    const g = Number.parseInt(hex[1].slice(2, 4), 16)
    const b = Number.parseInt(hex[1].slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return value || '#000000'
}

export function StylePalette({
  color,
  lineWidth,
  showWidth = false,
  onChange
}: {
  color: string
  lineWidth?: LineWidth
  showWidth?: boolean
  onChange: (next: { color: string; lineWidth?: LineWidth }) => void
}): React.JSX.Element {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const hex = useMemo(() => normalizeHex(color), [color])
  const opacity = useMemo(() => parseOpacity(color), [color])
  const width = lineWidth === 2 || lineWidth === 3 || lineWidth === 4 ? lineWidth : 1
  const open = Boolean(anchor)

  const commitColor = (nextHex: string, nextOpacity = opacity): void => {
    onChange({ color: withOpacity(nextHex, nextOpacity), lineWidth: showWidth ? width : undefined })
  }

  return (
    <>
      <Box
        component="button"
        type="button"
        title="颜色与线宽"
        aria-label="颜色与线宽"
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          minWidth: 36,
          height: 28,
          px: 0.5,
          border: '1px solid rgba(0, 0, 0, 0.22)',
          borderRadius: '4px',
          bgcolor: '#fff',
          cursor: 'pointer',
          '&:hover': { borderColor: '#ed6c02' }
        }}
      >
        <Box
          sx={{
            width: 18,
            height: 18,
            borderRadius: '3px',
            border: '1px solid rgba(0, 0, 0, 0.2)',
            backgroundImage: CHECKER,
            backgroundSize: '8px 8px',
            backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0'
          }}
        >
          <Box sx={{ width: 1, height: 1, borderRadius: '2px', bgcolor: previewColor(color) }} />
        </Box>
        {showWidth ? <LineWidthMark width={width} color="#333" /> : null}
      </Box>
      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 248,
              p: 1.25,
              bgcolor: '#2b2b2b',
              color: '#eee',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)'
            }
          }
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLS}, ${SWATCH}px)`,
            gap: '3px',
            justifyContent: 'center'
          }}
        >
          {PALETTE.map((swatch) => {
            const selected = swatch === hex
            return (
              <Box
                key={swatch}
                component="button"
                type="button"
                title={swatch}
                onClick={() => commitColor(swatch)}
                sx={{
                  width: SWATCH,
                  height: SWATCH,
                  p: 0,
                  borderRadius: '3px',
                  border: selected ? '2px solid #111' : '1px solid rgba(255,255,255,0.12)',
                  outline: selected ? '1px solid #f3a33c' : 'none',
                  bgcolor: swatch,
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              />
            )
          })}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
          <Box
            component="button"
            type="button"
            title="自定义颜色"
            aria-label="自定义颜色"
            onClick={() => fileRef.current?.click()}
            sx={{
              width: 22,
              height: 22,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed rgba(255,255,255,0.35)',
              borderRadius: '4px',
              bgcolor: 'transparent',
              color: '#ddd',
              cursor: 'pointer',
              '&:hover': { borderColor: '#f3a33c', color: '#f3a33c' }
            }}
          >
            <Add sx={{ fontSize: 16 }} />
          </Box>
          <input
            ref={fileRef}
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#000000'}
            onChange={(event) => commitColor(event.target.value)}
            style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
          />
        </Box>
        <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.12)', mt: 1.25, pt: 1.25 }}>
          <Typography sx={{ fontSize: 12, color: '#bdbdbd', mb: 0.75 }}>不透明度</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Slider
              size="small"
              min={0}
              max={100}
              value={opacity}
              onChange={(_, next) => commitColor(hex, Array.isArray(next) ? next[0] : next)}
              sx={{
                flex: 1,
                color: '#4ea3ff',
                '& .MuiSlider-rail': {
                  height: 8,
                  borderRadius: 4,
                  opacity: 1,
                  backgroundImage: `${CHECKER}, linear-gradient(90deg, transparent, ${hex})`,
                  backgroundSize: '8px 8px, 100% 100%',
                  backgroundColor: hex
                },
                '& .MuiSlider-track': { display: 'none' },
                '& .MuiSlider-thumb': {
                  width: 14,
                  height: 14,
                  bgcolor: '#fff',
                  border: '2px solid #111'
                }
              }}
            />
            <Box
              sx={{
                minWidth: 44,
                px: 0.75,
                py: 0.25,
                borderRadius: '4px',
                bgcolor: '#1f1f1f',
                border: '1px solid rgba(255,255,255,0.16)',
                fontSize: 12,
                textAlign: 'center'
              }}
            >
              {opacity}%
            </Box>
          </Box>
        </Box>
        {showWidth ? (
          <Box sx={{ mt: 1.25 }}>
            <Typography sx={{ fontSize: 12, color: '#bdbdbd', mb: 0.75 }}>厚度</Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                border: '1px solid rgba(255,255,255,0.16)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}
            >
              {LINE_WIDTHS.map((item) => {
                const selected = item === width
                return (
                  <Box
                    key={item}
                    component="button"
                    type="button"
                    title={`线宽 ${item}`}
                    aria-label={`线宽 ${item}`}
                    onClick={() => onChange({ color, lineWidth: item })}
                    sx={{
                      height: 28,
                      border: 0,
                      borderRight: '1px solid rgba(255,255,255,0.12)',
                      bgcolor: selected ? '#f3f3f3' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      '&:last-of-type': { borderRight: 0 }
                    }}
                  >
                    <LineWidthMark width={item} color={selected ? '#111' : '#eee'} />
                  </Box>
                )
              })}
            </Box>
          </Box>
        ) : null}
      </Popover>
    </>
  )
}

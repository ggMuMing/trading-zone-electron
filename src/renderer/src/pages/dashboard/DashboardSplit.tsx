import Box from '@mui/material/Box'
import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'

const HANDLE_PX = 6

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

interface SplitProps {
  orientation: 'horizontal' | 'vertical'
  value: number
  min: number
  max: number
  onChange: (next: number) => void
  first: React.ReactNode
  second: React.ReactNode
}

function Split({ orientation, value, min, max, onChange, first, second }: SplitProps): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ start: number; size: number; origin: number } | null>(null)
  const isHorizontal = orientation === 'horizontal'

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const root = rootRef.current
      if (!root) {
        return
      }
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      const rect = root.getBoundingClientRect()
      dragRef.current = {
        start: isHorizontal ? event.clientX : event.clientY,
        size: isHorizontal ? rect.width : rect.height,
        origin: value
      }
    },
    [isHorizontal, value]
  )

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.size <= 0) {
        return
      }
      const current = isHorizontal ? event.clientX : event.clientY
      const delta = (current - drag.start) / drag.size
      onChange(clamp(drag.origin + delta, min, max))
    },
    [isHorizontal, min, max, onChange]
  )

  const endDrag = useCallback(() => {
    dragRef.current = null
  }, [])

  const firstFlex = `${value} 1 0%`
  const secondFlex = `${1 - value} 1 0%`

  return (
    <Box
      ref={rootRef}
      sx={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        width: '100%'
      }}
    >
      <Box sx={{ flex: firstFlex, minWidth: 0, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {first}
      </Box>
      <Box
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        sx={{
          flex: `0 0 ${HANDLE_PX}px`,
          cursor: isHorizontal ? 'col-resize' : 'row-resize',
          bgcolor: 'divider',
          '&:hover': { bgcolor: 'action.selected' },
          touchAction: 'none',
          userSelect: 'none'
        }}
      />
      <Box sx={{ flex: secondFlex, minWidth: 0, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {second}
      </Box>
    </Box>
  )
}

interface DashboardSplitProps {
  leftRatio: number
  topRatio: number
  onLeftRatioChange: (next: number) => void
  onTopRatioChange: (next: number) => void
  top: React.ReactNode
  bottom: React.ReactNode
  right: React.ReactNode
}

export const DASHBOARD_LEFT_MIN = 0.25
export const DASHBOARD_LEFT_MAX = 0.75
export const DASHBOARD_TOP_MIN = 0.5
export const DASHBOARD_TOP_MAX = 0.75

export function DashboardSplit({
  leftRatio,
  topRatio,
  onLeftRatioChange,
  onTopRatioChange,
  top,
  bottom,
  right
}: DashboardSplitProps): React.JSX.Element {
  return (
    <Split
      orientation="horizontal"
      value={leftRatio}
      min={DASHBOARD_LEFT_MIN}
      max={DASHBOARD_LEFT_MAX}
      onChange={onLeftRatioChange}
      first={
        <Split
          orientation="vertical"
          value={topRatio}
          min={DASHBOARD_TOP_MIN}
          max={DASHBOARD_TOP_MAX}
          onChange={onTopRatioChange}
          first={top}
          second={bottom}
        />
      }
      second={right}
    />
  )
}

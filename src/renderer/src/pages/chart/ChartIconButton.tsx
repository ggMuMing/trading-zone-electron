import Box from '@mui/material/Box'
import type { ReactNode } from 'react'
import { CHART_ICON_HOVER, useChartChrome } from '../../theme/chartChrome'

export const CHART_ICON_SX = { fontSize: 16 }

export function ChartIconButton({
  disabled,
  onClick,
  children,
  ariaLabel,
  title,
  boxed = false,
  roomy = false
}: {
  disabled?: boolean
  onClick?: () => void
  children: ReactNode
  ariaLabel: string
  title?: string
  boxed?: boolean
  roomy?: boolean
}): React.JSX.Element {
  const hint = title ?? ariaLabel
  const chrome = useChartChrome()
  return (
    <Box
      component="span"
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      title={hint}
      onClick={(event) => {
        event.stopPropagation()
        event.preventDefault()
        if (!disabled) {
          onClick?.()
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return
        }
        event.stopPropagation()
        event.preventDefault()
        if (!disabled) {
          onClick?.()
        }
      }}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        color: chrome.icon,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        borderRadius: '3px',
        lineHeight: 1,
        boxShadow: 'none',
        ...(boxed
          ? {
              width: 22,
              height: 22,
              bgcolor: chrome.iconBg,
              border: `1px solid ${chrome.iconBorder}`
            }
          : roomy
            ? {
                width: 24,
                height: 24
              }
            : {}),
        '&:hover': disabled
          ? undefined
          : {
              color: CHART_ICON_HOVER,
              bgcolor: chrome.iconHoverBg,
              boxShadow: 'none',
              ...(boxed ? { borderColor: CHART_ICON_HOVER } : {})
            }
      }}
    >
      {children}
    </Box>
  )
}
